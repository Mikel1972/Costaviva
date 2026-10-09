// scripts/aprendizaje/semanal.mjs
//
// Aprendizaje semanal del índice de pesca, SIN IA (2026-10-09, pedido de
// Mikel: "que los algoritmos aprendan solos de los resultados y solo me
// pregunten sí/no una vez por semana"). Lo lanza aprendizaje-semanal.yml
// (pg_cron vía lanzar_workflow_github(), el `schedule:` de GitHub no es fiable).
//
// Qué hace cada semana:
//   1. Banco de pruebas: rehace el índice de cada salida terminada del diario
//      (con la serie de condiciones de su fecha si hay OPEN_METEO_API_KEY; si
//      no, con los términos que guardó el diario) y lo compara con lo que
//      pasó: Brier, log-loss, AUC, calibración por tramos, acierto de especie
//      y lo que aporta cada factor o regla (ablación).
//   2. Ajuste de pesos con encogimiento hacia el criterio experto y barreras
//      (ajuste.mjs). Los cambios pequeños y validados se aplican solos por PR
//      (el workflow corre los tests y la fusiona solo si todo pasa); el resto
//      va a aprendizaje/propuestas.json para el sí/no de Mikel.
//   3. Campeón/retadores: cada retador de aprendizaje/retadores/ se calcula
//      "en la sombra" sobre los mismos casos y se registra semana a semana.
//   4. Vigilancia: fuentes paradas, sesgo modelo/boyas, error de las
//      cámaras, cambios bruscos en la distribución del índice.
//   5. Señales: reglas que nunca se activan, especialización por región,
//      meses de temporada que dicen las observaciones abiertas, y qué fotos de
//      cámara conviene etiquetar primero.
//   5b. Frentes, clorofila y corrientes en la sombra (frentes-sombra.mjs):
//      efecto por modalidad × especie, sin signo supuesto; solo se propone
//      lo que supera las barreras.
//   6. Escribe solo AGREGADOS (repo público, k ≥ 5 usuarios, privacidad.mjs)
//      y el resumen para personas (aprendizaje/RESUMEN.md).
//
// Uso:
//   node scripts/aprendizaje/semanal.mjs                 pasada completa (necesita Supabase)
//   node scripts/aprendizaje/semanal.mjs --entrada f.json  con casos de un fichero (pruebas)
//   node scripts/aprendizaje/semanal.mjs --solo-retadores DIR --salida-evaluacion F
//   node scripts/aprendizaje/semanal.mjs --degradar-auto "motivo"   (el workflow, si la PR automática falla)
//   node scripts/aprendizaje/semanal.mjs --poner-pr N               (el workflow, tras abrir la PR)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { resumen, logLoss, brier, auc, bootstrapMejora, histograma, psi } from "./metricas.mjs";
import { casosDesdeDiario, particionTemporal, aciertoEspecie } from "./casos.mjs";
import { probTerminos, recalcular, aplicarRetador, validarRetador } from "./rejugar.mjs";
import {
  ajustarMultiplicadores, estadisticasUnidades, ablacion, cambiosSeguros, validarEnPrueba,
  CONFIG_POR_DEFECTO, B0,
} from "./ajuste.mjs";
import { publicable, siPublicable, comprobarPublicable } from "./privacidad.mjs";
import { frescura, sesgoBoyas, avisosSesgo, errorCamaras, panelReferencia, compararPaneles, histogramaPanel, semanaISO } from "./deriva.mjs";
import { reglasSinUso, estacionalidad, etiquetarCamaras, especializacionRegional } from "./senales.mjs";
import { propuesta, fusionar, tasasAceptacion, reglasBloqueadas, validarPropuesta } from "./propuestas.mjs";
import { cambiarConfianzas } from "./especies-texto.mjs";
import { indiceSpot } from "../../assets/js/ventana-actividad.js";
import { evaluarSombra, publicarSombra, VARIABLES_SOMBRA, RADIO_KM, decodificarHistorico, rasgosCaso } from "./frentes-sombra.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RUTAS = {
  especies: "assets/datos/especies.json",
  tipoFondo: "assets/datos/tipo-fondo.json",
  profundidad: "assets/datos/profundidad-spots.json",
  config: "aprendizaje/config.json",
  propuestas: "aprendizaje/propuestas.json",
  senales: "aprendizaje/senales.json",
  decisiones: "aprendizaje/decisiones.json",
  resumen: "aprendizaje/RESUMEN.md",
  retadores: "aprendizaje/retadores",
  backtest: "datos-robots/aprendizaje/backtest.json",
  deriva: "datos-robots/aprendizaje/deriva.json",
  evalRetadores: "datos-robots/aprendizaje/retadores.json",
  frentesSombra: "datos-robots/aprendizaje/frentes-sombra.json",
  frentesHipotesis: "aprendizaje/frentes-hipotesis.json",
  etiquetar: "datos-robots/aprendizaje/etiquetar.json",
  historial: "datos-robots/aprendizaje/historial.jsonl",
  autoCambios: "datos-robots/aprendizaje/auto-cambios.json",
  admin: "assets/datos/aprendizaje-indice.json",
  espuma: "datos-robots/oleaje-camaras/espuma.jsonl",
  calibracionCamaras: "datos-robots/oleaje-camaras/calibracion.json",
};

const r4 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(4));
const fmt = (x, d = 2) => (x === null || x === undefined ? "—" : String(+Number(x).toFixed(d)).replace(".", ","));
const pct = (x) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);

// ---------------------------------------------------------------------------
// 1. Casos con su índice (recalculado con la serie o el guardado)
// ---------------------------------------------------------------------------
export function prepararCasos(casosBase, { datos, series = new Map(), extras = {} }) {
  const casos = [];
  const fuentes = { recalculado: 0, guardado: 0, sin_indice: 0 };
  for (const c of casosBase) {
    const serie = series.get(c.ref);
    let ind = serie ? recalcular(datos, c, serie, extras) : null;
    let fuente = "recalculado";
    if (!ind && c.guardado?.terminos?.length) {
      ind = { p: c.guardado.p, especie: c.guardado.especie, terminos: c.guardado.terminos, ranking: c.guardado.ranking };
      fuente = "guardado";
    }
    if (!ind) { fuentes.sin_indice++; continue; }
    fuentes[fuente]++;
    casos.push({ ...c, indice: ind, terminos: ind.terminos, fuente });
  }
  return { casos, fuentes };
}

function metricasPublicables(casos, b0 = 0) {
  const ys = casos.map((c) => c.y), ps = casos.map((c) => probTerminos(c.terminos, {}, b0));
  return siPublicable(casos, resumen(ps, ys));
}

function porGrupo(casos, clave, b0) {
  const g = {};
  for (const v of [...new Set(casos.map((c) => c[clave]))].sort()) g[v] = metricasPublicables(casos.filter((c) => c[clave] === v), b0);
  return g;
}

// ---------------------------------------------------------------------------
// Retadores
// ---------------------------------------------------------------------------
// Multiplicadores equivalentes a un retador, si se puede expresar así (solo
// cambios de peso, confianza o retirar). null si añade reglas o cambia
// condiciones: entonces solo se evalúa en casos con serie.
export function multiplicadoresDeRetador(retador, datos) {
  const mult = {};
  let b0 = 0;
  for (const c of retador.cambios || []) {
    if (c.op === "retirar_regla") mult[`regla:${c.id}`] = 0;
    else if (c.op === "modificar_regla") {
      const r = datos.reglas_expertas.reglas.find((x) => x.id === c.id);
      if (!r) return null;
      const campos = Object.keys(c.campos || {});
      if (campos.some((k) => !["confianza", "efecto.logodds"].includes(k))) return null;
      let f = 1;
      if ("confianza" in c.campos) f *= c.campos.confianza / (r.confianza || 1);
      if ("efecto.logodds" in c.campos) f *= c.campos["efecto.logodds"] / (r.efecto.logodds || 1);
      mult[`regla:${c.id}`] = f;
    } else if (c.op === "peso_defecto") {
      const actual = datos.reglas_por_defecto?.[c.factor]?.peso_lo;
      if (!actual) return null;
      mult[c.factor] = c.peso_lo / actual;
    } else if (c.op === "b0") b0 = c.valor - (datos.indice?.b0_logodds ?? 0);
    else if (c.op === "anadir_fuente") continue;
    else return null;
  }
  return { mult, b0 };
}

export function evaluarRetador(retador, { datos, casos, series = new Map(), extras = {}, panelCampeon = null, panelOpciones = {} }) {
  const problemas = validarRetador(retador);
  const { datos: datosRet, problemas: pa } = aplicarRetador(datos, retador);
  problemas.push(...pa);
  const out = { id: retador.id, titulo: retador.titulo, problemas };
  if (problemas.length) return out;
  if (panelCampeon) out.panel = compararPaneles(panelCampeon, panelReferencia(datosRet, panelOpciones));
  const comoMult = multiplicadoresDeRetador(retador, datos);
  const pares = [];
  for (const c of casos) {
    const serie = series.get(c.ref);
    if (serie && c.fuente === "recalculado") {
      const r = recalcular(datosRet, c, serie, extras);
      if (r) { pares.push({ c, pa: probTerminos(c.terminos), pb: probTerminos(r.terminos, {}, datosRet.indice?.b0_logodds ?? 0) }); continue; }
    }
    if (comoMult) pares.push({ c, pa: probTerminos(c.terminos), pb: probTerminos(c.terminos, comoMult.mult, comoMult.b0) });
  }
  out.n_casos = pares.length;
  const cs = pares.map((p) => p.c);
  const pub = publicable(cs);
  if (!pares.length || !pub.ok) { out.metricas = { oculto: true, motivo: pares.length ? pub.motivo : "sin casos evaluables" }; return out; }
  const ys = cs.map((c) => c.y), pA = pares.map((p) => p.pa), pB = pares.map((p) => p.pb);
  const mej = bootstrapMejora(ys, pA, pB, logLoss);
  out.metricas = {
    campeon: { logloss: r4(logLoss(pA, ys)), brier: r4(brier(pA, ys)), auc: r4(auc(pA, ys)) },
    retador: { logloss: r4(logLoss(pB, ys)), brier: r4(brier(pB, ys)), auc: r4(auc(pB, ys)) },
    mejora_logloss: mej,
  };
  out.gana = mej ? mej.mejora_media > 0 && mej.prob_mejora >= 0.5 : null;
  return out;
}

export function leerRetadores(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    try { return { fichero: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }; } catch (e) { return { fichero: f, id: f, error: e.message }; }
  });
}

// ---------------------------------------------------------------------------
// La pasada completa (pura: todo entra por parámetros, todo sale en `ficheros`)
// ---------------------------------------------------------------------------
export function ejecutar(p) {
  const {
    datos, textoEspecies, casosBase = [], descartes = {}, series = new Map(), avisoSeries = null, extras = {},
    config = {}, decisiones = [], propuestasExistentes = [], retadores = [], historial = [],
    espuma = [], calibracionCamaras = null, fuentesRepo = [], fuentesTablas = [], vigia = null,
    observaciones = [], comunidad = { filas: [], error: null }, panelOpciones = {}, rasgosFrentes = new Map(), avisoFrentes = null, hipotesisFrentes = null, hoy, ahora = Date.now(), pausado = false, sinAuto = null, errores = [],
  } = p;
  const cfg = { ...CONFIG_POR_DEFECTO, ...(config.ajuste || {}) };
  const cfgRet = { semanas_min_para_promover: 4, victorias_min_ultimas_4: 3, prob_mejora_min: 0.9, ...(config.retadores || {}) };
  const semana = semanaISO(Date.parse(`${hoy}T12:00:00Z`));
  const b0 = datos.indice?.b0_logodds ?? 0;

  // 1. Casos y banco de pruebas del campeón
  const { casos, fuentes } = prepararCasos(casosBase, { datos, series, extras });
  const ys = casos.map((c) => c.y);
  const totales = { n: casos.length, positivos: ys.filter(Boolean).length, negativos: ys.filter((y) => !y).length };
  const estadisticas = estadisticasUnidades(casos);
  const { ajuste: train, prueba } = particionTemporal(casos, 0.3);
  const backtestGlobal = metricasPublicables(casos, b0);

  // 2. Ajuste (sobre los casos antiguos) y validación (sobre los recientes)
  const estTrain = estadisticasUnidades(train);
  const unidades = [...estTrain.values()].filter((e) => e.n >= Math.min(cfg.min_casos_unidad, 10)).map((e) => e.u).sort();
  const ajuste = train.length >= 10 ? ajustarMultiplicadores(train, unidades, { tauPorDefecto: cfg.tau_prior, b0, conB0: true }) : {};
  const bloqueadas = reglasBloqueadas(decisiones, propuestasExistentes);
  const seguros = cambiosSeguros({ ajuste, estadisticas: estTrain, datos, config: cfg, bloqueadas, totales });
  const validacion = seguros.automaticos.length ? validarEnPrueba(prueba, seguros.automaticos, { b0, config: cfg }) : null;

  // Panel de referencia: ¿cuánto movería el índice?
  const panelCampeon = panelReferencia(datos, panelOpciones);
  let panelCambios = null, aplicar = [], motivoNoAplicar = null;
  if (seguros.automaticos.length) {
    const ret = { cambios: seguros.automaticos.map((c) => ({ op: "modificar_regla", id: c.regla, campos: { confianza: c.propuesto } })) };
    panelCambios = compararPaneles(panelCampeon, panelReferencia(aplicarRetador(datos, ret).datos, panelOpciones));
    const motivos = [];
    if (!cfg.auto_aplicar) motivos.push("auto_aplicar desactivado en aprendizaje/config.json");
    if (pausado) motivos.push("automatización en pausa (ROBOT_PAUSADO o AUTOMATION_PAUSED)");
    if (sinAuto) motivos.push(sinAuto);
    if (!validacion?.ok) motivos.push(...(validacion?.motivos || ["sin validación"]));
    if (panelCambios.media_abs > cfg.panel_max_media_puntos) motivos.push(`movería el panel de referencia ${panelCambios.media_abs} puntos de media (máximo ${cfg.panel_max_media_puntos})`);
    if (panelCambios.max_abs > cfg.panel_max_puntos) motivos.push(`movería algún escenario ${panelCambios.max_abs} puntos (máximo ${cfg.panel_max_puntos})`);
    if (motivos.length) motivoNoAplicar = motivos;
    else aplicar = seguros.automaticos;
  }

  // Reversiones: un "no" de Mikel a un cambio aplicado solo lo deshace: la
  // regla vuelve al valor que puso la persona (confianza_experta) y queda
  // bloqueada para el ajuste automático (reglasBloqueadas).
  const reversiones = [];
  const noA = new Set(decisiones.filter((x) => x.decision === "no").map((x) => x.propuesta_id ?? x.id));
  for (const prev of propuestasExistentes.filter((x) => noA.has(x.id) && x.detalle?.tipo === "confianza" && x.requiere_si === false)) {
    const regla = datos.reglas_expertas.reglas.find((r) => r.id === prev.detalle.regla);
    if (regla && regla.confianza_experta != null && regla.confianza !== regla.confianza_experta && !reversiones.some((x) => x.regla === regla.id)) {
      reversiones.push({ tipo: "confianza", regla: regla.id, actual: regla.confianza, propuesto: regla.confianza_experta, revierte: prev.id });
    }
  }
  const aplicarSinRevertidas = aplicar.filter((c) => !reversiones.some((r) => r.regla === c.regla));
  aplicar.length = 0;
  aplicar.push(...aplicarSinRevertidas);
  let nuevoTexto = null;
  const todosCambios = [...aplicar, ...reversiones];
  if (todosCambios.length && textoEspecies) nuevoTexto = cambiarConfianzas(textoEspecies, todosCambios);

  // 3. Retadores en la sombra (+ el ajuste libre, sin límites, como retador interno)
  const evalRetadores = [];
  for (const r of retadores.filter((x) => !x.error && (x.estado ?? "sombra") === "sombra")) {
    evalRetadores.push({ fichero: r.fichero, ...evaluarRetador(r, { datos, casos, series, extras, panelCampeon, panelOpciones }) });
  }
  for (const r of retadores.filter((x) => x.error)) evalRetadores.push({ fichero: r.fichero, id: r.id, problemas: [`JSON inválido: ${r.error}`] });
  const libre = Object.entries(ajuste).filter(([u]) => u.startsWith("regla:")).map(([u, a]) => ({ op: "modificar_regla", id: u.slice(6), campos: { confianza: +Math.max(0.05, Math.min(1, (datos.reglas_expertas.reglas.find((x) => x.id === u.slice(6))?.confianza ?? 1) * Math.max(0.05, a.m))).toFixed(3) } }));
  if (libre.length) {
    evalRetadores.push({ interno: true, ...evaluarRetador({ id: "ajuste-libre", titulo: "Ajuste sin barreras (solo referencia interna)", explicacion_llana: "Lo que pediría el ajuste si no tuviera límites semanales.", estado: "sombra", fuentes: [], cambios: libre }, { datos, casos: prueba, series, extras }) });
  }

  // 3b. Frentes, clorofila y corrientes en la sombra (todas las modalidades y especies)
  const sombraFrentes = evaluarSombra(casos, rasgosFrentes, datos, cfg, config.frentes || {});

  // 4. Vigilancia
  const fr = frescura([...fuentesRepo, ...fuentesTablas], ahora);
  const sesgo = sesgoBoyas(espuma);
  const avisosBoyas = avisosSesgo(sesgo);
  const ultimoHist = historial.filter((h) => h.semana !== semana).slice(-1)[0] || null;
  const camaras = errorCamaras(calibracionCamaras, ultimoHist?.camaras || null);
  const histPanel = histogramaPanel(panelCampeon);
  const psiPanel = ultimoHist?.panel_hist ? psi(ultimoHist.panel_hist, histPanel) : null;
  let vivo = null;
  if (vigia) {
    const puntos = [];
    for (const s of vigia) {
      for (let i = 0; i < s.serie.length; i++) {
        if (s.serie[i].hora < `${hoy}T00:00`) continue;
        const ind = indiceSpot(datos, s.serie, i, { lat: s.lat, lon: s.lon, modalidad: "costa" });
        if (Number.isFinite(ind?.puntuacion)) puntos.push(ind.puntuacion);
      }
    }
    const h = histograma(puntos);
    vivo = { n: puntos.length, media: puntos.length ? +(puntos.reduce((a, b) => a + b, 0) / puntos.length).toFixed(1) : null, hist: h, psi_semana_anterior: ultimoHist?.vivo_hist ? psi(ultimoHist.vivo_hist, h) : null };
  }
  const recientes = casos.filter((c) => (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${c.fecha}T12:00:00Z`)) / 86400e3 <= 7);
  const anteriores = casos.filter((c) => { const d = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${c.fecha}T12:00:00Z`)) / 86400e3; return d > 7 && d <= 35; });
  const diario = publicable(recientes).ok && publicable(anteriores).ok
    ? { recientes: recientes.length, psi: psi(histograma(anteriores.map((c) => 100 * c.indice.p)), histograma(recientes.map((c) => 100 * c.indice.p))) }
    : { oculto: true, motivo: "menos de 5 usuarios distintos en alguna de las dos ventanas" };
  const avisosDeriva = [
    ...fr.filter((f) => f.estado !== "ok").map((f) => ({ tipo: "fuente", texto: f.estado === "sin_datos" ? `${f.nombre}: sin datos${f.error ? ` (${f.error})` : ""}` : `${f.nombre}: último dato hace ${f.horas} h (se espera cada ${f.cadencia_h} h)` })),
    ...avisosBoyas.map((a) => ({ tipo: "boya", texto: a.texto })),
    ...camaras.filter((c) => c.empeora).map((c) => ({ tipo: "camara", texto: `la calibración de ${c.camara} empeora: error ${pct(c.error_antes)} → ${pct(c.error)}` })),
    ...(psiPanel !== null && psiPanel > 0.1 ? [{ tipo: "indice", texto: `los pesos o reglas han cambiado el índice del panel de referencia (PSI ${fmt(psiPanel, 3)})` }] : []),
    ...(vivo?.psi_semana_anterior > 0.25 ? [{ tipo: "indice", texto: `la distribución del índice en los spots vigía cambió mucho frente a la semana pasada (PSI ${fmt(vivo.psi_semana_anterior, 3)}): puede ser el tiempo o un dato roto` }] : []),
    ...(diario.psi > 0.25 ? [{ tipo: "indice", texto: `el índice de las salidas de esta semana se ha desplazado frente al mes anterior (PSI ${fmt(diario.psi, 3)})` }] : []),
  ];

  // 5. Señales
  const sinUso = reglasSinUso(datos, casos);
  const regional = Object.keys(ajuste).length ? especializacionRegional(train, ajuste) : [];
  const temporada = estacionalidad(datos, observaciones);
  const etiquetar = etiquetarCamaras(espuma, calibracionCamaras, { desde: ahora - 7 * 86400e3 });

  // 6. Propuestas (contrato de comun, estandares/aprendizaje.md). Evidencia
  // mínima de comun (L4): 20 casos o más y nunca una sola persona como fuente.
  const nuevas = [];
  const unidadTexto = (u) => {
    if (u.startsWith("regla:")) { const r = datos.reglas_expertas.reglas.find((x) => x.id === u.slice(6)); return r ? `«${r.texto}»` : u; }
    return { luz: "la luz (amanecer y atardecer)", marea: "la marea", temperatura: "la temperatura del agua", oleaje: "el oleaje", viento: "el viento", presion: "la presión", turbidez: "la turbidez", lluvia: "la lluvia", caudal_rio: "el caudal del río" }[u] || u;
  };
  const casosDe = (u) => casos.filter((c) => (c.terminos || []).some((t) => t.u === u && t.lo));
  const basta = (cs) => cs.length >= 20 && new Set(cs.map((c) => c.usuario)).size >= 2;
  const ll = (v) => (v ? `log-loss en las salidas recientes ${fmt(v.antes.logloss, 3)} → ${fmt(v.despues.logloss, 3)} (${v.antes.n} salidas)` : null);
  const pubPrueba = publicable(prueba).ok;
  const lineaValid = pubPrueba && validacion ? ll(validacion) : "mejora comprobada en las salidas recientes (números ocultos: menos de 5 personas)";
  const metricaLL = Number.isFinite(backtestGlobal.logloss) ? { clave: "logloss", valor_antes: backtestGlobal.logloss, objetivo: "bajar" } : undefined;
  for (const c of aplicar) {
    const sube = c.propuesto > c.actual;
    nuevas.push(propuesta({
      clave: `confianza-${c.regla}`, fecha: hoy, tipo: "peso", estado: "aplicada", requiere_si: false, impacto: 2,
      titulo: `${sube ? "Más" : "Menos"} peso a la regla ${c.regla} (aplicado solo)`,
      explicacion_llana: `La regla ${unidadTexto(`regla:${c.regla}`)} ${sube ? "acertó más" : "acertó menos"} de lo que suponía el criterio experto. Su peso pasa de ${fmt(c.actual)} a ${fmt(c.propuesto)} (como mucho un 20 % por semana y nunca más de la mitad lejos de lo que puso la persona, ${fmt(c.experta)}). Se ha comprobado con las salidas más recientes, que no se usaron para ajustar.`,
      deshacer: `di "no" en el Issue semanal: el lunes siguiente vuelve a ${fmt(c.experta)} y la regla queda fuera del ajuste automático.`,
      evidencia: `${c.n} salidas de ${c.usuarios} personas con la regla activa; multiplicador ${fmt(c.m)} ± ${fmt(c.sd)}; ${lineaValid}; panel de referencia ±${fmt(panelCambios?.media_abs, 1)} puntos de media`,
      evidencia_n: c.n, riesgo: "bajo: cambio pequeño, validado y reversible con un no", metrica: metricaLL,
      detalle: { tipo: "confianza", regla: c.regla, actual: c.actual, propuesto: c.propuesto, experta: c.experta, m: c.m, sd: c.sd, validacion: pubPrueba ? validacion : null, panel: panelCambios },
    }));
  }
  for (const c of reversiones) {
    nuevas.push(propuesta({
      clave: `revertir-${c.regla}`, fecha: hoy, tipo: "peso", estado: "aplicada", requiere_si: false, impacto: 1,
      titulo: `Deshecho el cambio de la regla ${c.regla} (dijiste que no)`,
      explicacion_llana: `Dijiste que no al cambio automático de la regla ${unidadTexto(`regla:${c.regla}`)}: su peso vuelve a ${fmt(c.propuesto)}, lo que puso la persona, y la regla queda fuera del ajuste automático.`,
      evidencia: `decisión en aprendizaje/decisiones.json sobre ${c.revierte}`, riesgo: "bajo: vuelve al valor de la persona",
      detalle: { tipo: "reversion", regla: c.regla, actual: c.actual, propuesto: c.propuesto, revierte: c.revierte },
    }));
  }
  for (const c of seguros.a_preguntar) {
    const cs = casosDe(c.u);
    if (c.tipo !== "b0" && !basta(cs)) continue;
    const n = publicable(cs).ok ? `${cs.length} salidas con este factor` : "salidas suficientes (números ocultos: menos de 5 personas)";
    const mult = `multiplicador ${fmt(c.m)} ± ${fmt(c.sd)}`;
    if (c.tipo === "b0") {
      if (!basta(casos)) continue;
      nuevas.push(propuesta({ clave: "b0", fecha: hoy, tipo: "peso", impacto: 4, esfuerzo: "bajo", titulo: `${c.m < 0 ? "Bajar" : "Subir"} todo el índice un poco`,
        explicacion_llana: `En conjunto ${c.motivo}: con el índice medio se pesca ${c.m < 0 ? "menos" : "más"} de lo que dice el número. Propuesta: mover la base del índice de ${fmt(c.actual)} a ${fmt(c.propuesto)} (todos los spots bajarían o subirían unos pocos puntos a la vez).`,
        deshacer: "volver a poner indice.b0_logodds en especies.json al valor anterior.",
        evidencia: `${publicable(casos).ok ? `${casos.length} salidas` : "salidas suficientes"}; desplazamiento ${fmt(c.m)} ± ${fmt(c.sd)} log-odds`, evidencia_n: casos.length,
        riesgo: "medio: cambia el número que ven todos", metrica: Number.isFinite(backtestGlobal.ece_puntos) ? { clave: "ece_puntos", valor_antes: backtestGlobal.ece_puntos, objetivo: "bajar" } : undefined, detalle: c }));
    } else if (c.tipo === "peso_defecto") {
      nuevas.push(propuesta({ clave: `peso-${c.factor}`, fecha: hoy, tipo: "peso", impacto: 3, titulo: `${c.m < 1 ? "Menos" : "Más"} peso a ${unidadTexto(c.factor)}`,
        explicacion_llana: `Los datos dicen que ${unidadTexto(c.factor)} ${c.m < 1 ? "pesa menos" : "pesa más"} de lo que cuenta hoy el índice. Propuesta: peso ${fmt(c.actual, 3)} → ${fmt(c.propuesto, 3)} (como mucho un 20 % por propuesta). Es un factor de todas las especies, por eso se pregunta.`,
        deshacer: `volver a poner reglas_por_defecto.${c.factor}.peso_lo a ${fmt(c.actual, 3)}.`,
        evidencia: `${n}; ${mult}`, evidencia_n: cs.length, riesgo: "medio: afecta a todas las especies", metrica: metricaLL, detalle: c }));
    } else if (c.tipo === "retirar") {
      nuevas.push(propuesta({ clave: `retirar-${c.regla}`, fecha: hoy, tipo: "regla", impacto: 3, titulo: `Retirar (o revisar) la regla ${c.regla}`,
        explicacion_llana: `La regla ${unidadTexto(c.u)}: ${c.motivo}. Propuesta: retirarla (estado "retirada", no se borra) o revisar sus condiciones.`,
        deshacer: `volver a poner su estado en "por_validar".`,
        evidencia: `${n}; ${mult}${publicable(cs).ok ? `; quitarla cambia el log-loss en ${fmt(-ablacion(casos, c.u, b0), 4)}` : ""}`, evidencia_n: cs.length, riesgo: "medio: deja de contar un factor", metrica: metricaLL, detalle: c }));
    } else {
      nuevas.push(propuesta({ clave: `confianza-${c.regla}`, fecha: hoy, tipo: "peso", impacto: 2, titulo: `Ajustar el peso de la regla ${c.regla}`,
        explicacion_llana: `Los datos piden ${c.m < 1 ? "menos" : "más"} peso para ${unidadTexto(c.u)}, pero no se ha aplicado solo: ${c.motivo}.${c.propuesto ? ` Propuesta: ${fmt(c.actual)} → ${fmt(c.propuesto)}.` : ""}`,
        deshacer: c.actual != null ? `volver a poner su confianza a ${fmt(c.actual)}.` : undefined,
        evidencia: `${n}; ${mult}`, evidencia_n: cs.length, riesgo: "bajo: solo el peso de una regla", metrica: metricaLL, detalle: c }));
    }
  }
  if (motivoNoAplicar && validacion?.ok) {
    // Sin validación en datos nuevos no se pregunta: sería ruido.
    for (const c of seguros.automaticos) {
      nuevas.push(propuesta({ clave: `confianza-${c.regla}`, fecha: hoy, tipo: "peso", impacto: 2, titulo: `Ajustar el peso de la regla ${c.regla}`,
        explicacion_llana: `El ajuste pide pasar el peso de ${unidadTexto(`regla:${c.regla}`)} de ${fmt(c.actual)} a ${fmt(c.propuesto)} y mejora las salidas recientes, pero no se aplicó solo: ${motivoNoAplicar.join("; ")}.`,
        deshacer: `volver a poner su confianza a ${fmt(c.actual)}.`,
        evidencia: `${c.n} salidas de ${c.usuarios} personas; multiplicador ${fmt(c.m)} ± ${fmt(c.sd)}; ${lineaValid}`, evidencia_n: c.n,
        riesgo: "bajo: solo el peso de una regla", metrica: metricaLL, detalle: { tipo: "confianza", ...c } }));
    }
  }
  for (const s of sinUso) {
    if (!basta(s.casos)) continue;
    nuevas.push(propuesta({ clave: `sin-uso-${s.regla}`, fecha: hoy, tipo: "regla", impacto: 1, titulo: `La regla ${s.regla} nunca se activa`,
      explicacion_llana: `Había salidas a las que la regla ${unidadTexto(`regla:${s.regla}`)} podía aplicarse y no se activó ni una vez: sus condiciones quizá son demasiado estrictas o faltan datos (río, turbidez...). Propuesta: revisar sus umbrales o retirarla.`,
      deshacer: "volver a su versión anterior (git).",
      evidencia: `0 veces activa en ${publicable(s.casos).ok ? s.en_ambito : "bastantes"} salidas de su ámbito`, evidencia_n: s.en_ambito,
      riesgo: "bajo: la regla hoy no cambia nada", metrica: { clave: "reglas_sin_uso", valor_antes: sinUso.length, objetivo: "bajar" }, detalle: { regla: s.regla } }));
  }
  for (const s of regional) {
    if (!publicable(s.casos).ok || !basta(s.casos)) continue;
    nuevas.push(propuesta({ clave: `region-${s.unidad.slice(6)}-${s.region}`, fecha: hoy, tipo: "regla", impacto: 2, esfuerzo: "medio", titulo: `La regla ${s.unidad.slice(6)} funciona distinto en ${s.region}`,
      explicacion_llana: `En ${s.region} la regla ${unidadTexto(s.unidad)} pide otro peso que en el resto. Propuesta: partirla en dos, una para ${s.region} con su propio peso.`,
      deshacer: "volver a la regla única (git).",
      evidencia: `${s.n} salidas en ${s.region}; multiplicador ×${fmt(s.m_region)} ± ${fmt(s.sd)} frente a ×${fmt(s.m_global)} en el resto`, evidencia_n: s.n,
      riesgo: "medio: cambia el índice en una región", metrica: metricaLL, detalle: { unidad: s.unidad, region: s.region, m_region: s.m_region, sd: s.sd, m_global: s.m_global } }));
  }
  for (const t of temporada) {
    const e = datos.especies.find((x) => x.id === t.especie);
    nuevas.push(propuesta({ clave: `temporada-${t.especie}-${t.region}-${t.mes}`, fecha: hoy, tipo: "dato", impacto: 2, titulo: `${e?.nombres?.es || t.especie}: ¿también en el mes ${t.mes} en ${t.region}?`,
      explicacion_llana: `Hay más observaciones abiertas (GBIF/iNaturalist, licencias libres) de ${e?.nombres?.es || t.especie} en ${t.region} en el mes ${t.mes} de lo esperable por la gente que observa ese mes. La ficha ${t.sin_presencia ? "no la da como presente en esa región" : "no da ese mes como temporada"}. Propuesta: añadir el mes (o revisarlo con una fuente oficial). Ojo: ver un pez buceando no es lo mismo que pescarlo.`,
      deshacer: "quitar el mes de presencia en especies.json.",
      evidencia: `${t.observaciones} observaciones ese mes de ${t.total_especie} de la especie en la región (×${fmt(t.ratio)} sobre lo esperado); fuente GBIF.org CC0/CC BY`, evidencia_n: t.observaciones,
      riesgo: "bajo: solo cambia qué especies salen de temporada", detalle: t }));
  }
  // Promoción de retadores con varias semanas ganando en la sombra
  const histRet = new Map();
  for (const h of [...historial.filter((x) => x.semana !== semana), { semana, retadores: evalRetadores.filter((r) => !r.interno).map((r) => ({ id: r.id, gana: r.gana ?? null, prob_mejora: r.metricas?.mejora_logloss?.prob_mejora ?? null })) }]) {
    for (const r of h.retadores || []) (histRet.get(r.id) || histRet.set(r.id, []).get(r.id)).push(r);
  }
  for (const r of evalRetadores.filter((x) => !x.interno && !x.problemas?.length)) {
    const serie = (histRet.get(r.id) || []).filter((x) => x.gana !== null);
    const ult4 = serie.slice(-4);
    const ok = serie.length >= cfgRet.semanas_min_para_promover && ult4.filter((x) => x.gana).length >= cfgRet.victorias_min_ultimas_4 && (r.metricas?.mejora_logloss?.prob_mejora ?? 0) >= cfgRet.prob_mejora_min;
    if (!ok) continue;
    const ret = retadores.find((x) => x.id === r.id);
    nuevas.push(propuesta({ clave: `promover-${r.id}`, fecha: hoy, tipo: "regla", impacto: 3, retador: r.id, titulo: `Activar el retador «${r.titulo}»`,
      explicacion_llana: `${ret?.explicacion_llana || r.titulo} Lleva ${serie.length} semanas calculándose en la sombra y ha ganado al índice actual ${ult4.filter((x) => x.gana).length} de las últimas 4.`,
      deshacer: "retirar las reglas que añadió o volver a los pesos anteriores (git).",
      evidencia: `${r.n_casos} salidas; log-loss ${fmt(r.metricas.campeon.logloss, 3)} → ${fmt(r.metricas.retador.logloss, 3)}; probabilidad de mejora ${pct(r.metricas.mejora_logloss.prob_mejora)}; movería el panel ${fmt(r.panel?.media_abs, 1)} puntos de media`, evidencia_n: r.n_casos,
      riesgo: "medio: cambia el índice que ve la gente", metrica: metricaLL, detalle: { retador: r.id, fuentes: ret?.fuentes || [] } }));
  }
  // Frentes: solo las combinaciones que superan TODAS las barreras (muestra,
  // 5 personas, efecto claro, validación en lo reciente). Siempre con sí.
  for (const k of sombraFrentes.superan) {
    const e = datos.especies.find((x) => x.id === k.especie);
    const v = VARIABLES_SOMBRA.find((x) => x.id === k.variable);
    const ayuda = k.efecto_logodds > 0;
    const prior = hipotesisFrentes?.grupos?.find((g) => g.especies.includes(k.especie) && g.variables?.includes(k.variable));
    nuevas.push(propuesta({
      clave: `frentes-${k.variable}-${k.modalidad}-${k.especie}`, fecha: hoy, tipo: "regla", impacto: 3, esfuerzo: "medio",
      titulo: `${e?.nombres?.es || k.especie} (${k.modalidad}): «${v?.texto || k.variable}» ${ayuda ? "ayuda" : "estorba"}`,
      explicacion_llana: `Con las salidas del diario, cuando hay ${v?.texto || k.variable} (a ${RADIO_KM[k.modalidad] ?? 10} km o menos) se pesca ${ayuda ? "más" : "menos"} ${e?.nombres?.es || k.especie} de lo que ya decía el índice. Propuesta: añadirlo al índice de esta especie en ${k.modalidad} (hay que leer la capa 〰 Frentes también en el índice en vivo).${prior ? ` Lo que decía la bibliografía antes de mirar los datos: ${prior.hipotesis}` : ""}`,
      evidencia: `${k.n} salidas (${k.con_rasgo} con el rasgo, ${k.con_captura} con captura); efecto ${fmt(k.efecto_logodds)} ± ${fmt(k.sd)} log-odds (${fmt(Math.abs(k.z), 1)} desviaciones); log-loss en lo reciente mejora ${fmt(k.mejora_logloss_reciente, 3)}`,
      evidencia_n: k.n, riesgo: "medio: añade un factor nuevo al índice que ve la gente",
      detalle: { tipo: "frentes", ...k, radio_km: RADIO_KM[k.modalidad] ?? 10 },
    }));
  }
  const { propuestas, silenciadas, enEspera } = fusionar(propuestasExistentes, nuevas, decisiones, { hoy });
  const invalidas = propuestas.filter((x) => x.origen === "aprendizaje-semanal").map((x) => ({ id: x.id, e: validarPropuesta(x) })).filter((x) => x.e.length);
  if (invalidas.length) throw new Error(`propuestas inválidas: ${JSON.stringify(invalidas)}`);

  // 7. Ficheros públicos
  const unidadesPub = {};
  for (const [u, e] of [...estadisticas].sort((a, b) => a[0].localeCompare(b[0]))) {
    const cs = casosDe(u);
    unidadesPub[u] = siPublicable(cs, {
      n: e.n, usuarios: e.propios === e.n ? "solo Mikel" : e.usuarios.size,
      aporte_medio_logodds: r4(e.sumaLo / e.n),
      tasa_pesca_si_suma: e.pos.n ? r4(e.pos.y / e.pos.n) : null, tasa_pesca_si_resta: e.neg.n ? r4(e.neg.y / e.neg.n) : null,
      ablacion_logloss: ablacion(casos, u, b0),
      ...(ajuste[u] ? { multiplicador: ajuste[u].m, sd: ajuste[u].sd } : {}),
    });
  }
  const conRanking = casos.filter((c) => c.y && c.especies.length && c.indice?.ranking?.length);
  const backtest = {
    generado_en: new Date(ahora).toISOString(), semana,
    nota: "Solo agregados de 5 usuarios distintos o más (o solo del dueño). p = índice/100 de la mejor especie a la hora de la salida; y = se pescó algo. Sin ids, fechas, horas, spots ni coordenadas.",
    datos: { casos: totales.n, por_fuente: fuentes, descartes, aviso_series: avisoSeries, errores },
    campeon: { version: datos.indice?.version, global: backtestGlobal, por_modalidad: porGrupo(casos, "modalidad", b0), por_region: porGrupo(casos, "region", b0), acierto_especie: siPublicable(conRanking, aciertoEspecie(casos)) },
    unidades: unidadesPub,
    ajuste: {
      casos_ajuste: train.length, casos_prueba: prueba.length,
      b0: ajuste[B0] && publicable(train).ok ? ajuste[B0] : null,
      automaticos: aplicar.map(({ u, regla, actual, propuesto, m, sd }) => ({ u, regla, actual, propuesto, m, sd })),
      no_aplicados: motivoNoAplicar ? { cambios: seguros.automaticos.map((c) => c.regla), motivos: motivoNoAplicar } : null,
      validacion: validacion && publicable(prueba).ok ? validacion : validacion ? { ok: validacion.ok, motivos: validacion.motivos } : null,
      panel: panelCambios, descartados: seguros.descartados.map(({ u, motivo }) => ({ u, motivo })),
    },
    comunidad: { error: comunidad.error, filas_k5: comunidad.filas.length, por_condiciones: comunidad.filas },
  };
  const deriva = {
    generado_en: new Date(ahora).toISOString(), semana,
    fuentes: fr.map(({ nombre, estado, horas, cadencia_h, error }) => ({ nombre, estado, horas, cadencia_h, ...(error ? { error } : {}) })),
    boyas: [...new Map(sesgo.map((s) => [s.boya, s])).values()], avisos_boyas: avisosBoyas,
    camaras, panel: { hist: histPanel, psi_semana_anterior: psiPanel }, vivo, diario, avisos: avisosDeriva,
  };
  const lineaHist = {
    semana, fecha: hoy,
    backtest: (() => { const g = backtest.campeon.global; return g.oculto ? { oculto: true } : { n: g.n, logloss: g.logloss, brier: g.brier, auc: g.auc }; })(),
    panel_hist: histPanel, vivo_hist: vivo?.hist ?? null,
    camaras: Object.fromEntries(camaras.map((c) => [c.camara, { error: c.error }])),
    boyas: sesgo.filter((s) => s.semana === semana).map(({ boya, n, corregido_entre_boya }) => ({ boya, n, corregido_entre_boya })),
    retadores: evalRetadores.filter((r) => !r.interno).map((r) => ({ id: r.id, n: r.n_casos ?? 0, gana: r.gana ?? null, prob_mejora: r.metricas?.mejora_logloss?.prob_mejora ?? null, mejora: r.metricas?.mejora_logloss?.mejora_media ?? null })),
    automaticos: todosCambios.map((c) => ({ regla: c.regla, de: c.actual, a: c.propuesto })),
  };
  const historialNuevo = [...historial.filter((h) => h.semana !== semana), lineaHist];
  const admin = {
    nota: "Aprendizaje semanal del índice (scripts/aprendizaje/semanal.mjs). Solo agregados. Lo enseña admin.html.",
    semana, version: datos.indice?.version,
    global: backtest.campeon.global, unidades: unidadesPub,
    automaticos: lineaHist.automaticos,
  };
  const g = backtestGlobal.oculto ? {} : backtestGlobal;
  const num = (x) => (Number.isFinite(x) ? x : undefined);
  const fechas = casos.map((c) => c.fecha).sort();
  const errCam = camaras.map((c) => c.error).filter(Number.isFinite);
  const metricas = Object.fromEntries(Object.entries({
    casos: totales.n,
    salidas_con_pesca_pct: num(g.tasa != null ? +(100 * g.tasa).toFixed(1) : undefined),
    auc: num(g.auc), brier: num(g.brier), logloss: num(g.logloss), ece_puntos: num(g.ece_puntos), habilidad_brier: num(g.habilidad_brier),
    acierto_especie_top3: num(backtest.campeon.acierto_especie?.top3),
    reglas_activas: datos.reglas_expertas.reglas.filter((x) => x.estado !== "retirada").length,
    reglas_sin_uso: sinUso.length,
    reglas_ajustadas_auto: (nuevoTexto ? JSON.parse(nuevoTexto) : datos).reglas_expertas.reglas.filter((x) => x.confianza_experta != null && x.confianza !== x.confianza_experta).length,
    cambios_automaticos_semana: todosCambios.length,
    retadores_en_sombra: evalRetadores.filter((r) => !r.interno && !r.problemas?.length).length,
    propuestas_abiertas: propuestas.filter((x) => x.estado === "propuesta").length,
    fuentes_no_ok: fr.filter((f) => f.estado !== "ok").length,
    avisos_deriva: avisosDeriva.length,
    boyas_sesgo_max_pct: avisosBoyas.length || sesgo.length ? Math.round(100 * Math.max(0, ...[...new Map(sesgo.map((x) => [x.boya, x])).values()].map((x) => Math.abs(x.corregido_entre_boya - 1)))) : undefined,
    camaras_error_medio_pct: errCam.length ? Math.round((100 * errCam.reduce((a, b) => a + b, 0)) / errCam.length) : undefined,
    panel_indice_medio: +(panelCampeon.puntuaciones.filter(Number.isFinite).reduce((a, b) => a + b, 0) / Math.max(1, panelCampeon.puntuaciones.filter(Number.isFinite).length)).toFixed(1),
    vivo_indice_medio: num(vivo?.media),
    observaciones_abiertas: observaciones.length,
    fotogramas_para_etiquetar: etiquetar.length,
  }).filter(([, v]) => v !== undefined));
  const tasas = tasasAceptacion(decisiones, propuestasExistentes);
  const senales = {
    app: "Costaviva", generado: new Date(ahora).toISOString(),
    ventana_dias: fechas.length ? Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fechas[0]}T12:00:00Z`)) / 86400e3) : 0,
    // "error" si no se pudo mirar la base de datos (comun L2): el bucle sale en ⚠️ en el resumen de comun.
    estado: errores.some((e) => /^sin SUPABASE/.test(e)) ? "error" : totales.n ? "ok" : "sin_datos",
    ...(errores.length ? { error: errores.join("; ") } : {}),
    ...(totales.n ? {} : { nota: "Sin salidas del diario con índice todavía: se vigilan las fuentes y el panel, y se aprende cuando las haya." }),
    metricas,
    // Para las rutinas y agentes (comun, barandillas: "ordenar prioridades").
    prioridades: {
      tasa_aceptacion_por_tipo: tasas,
      no_volver_a_proponer: propuestas.filter((x) => x.estado === "rechazada").map((x) => x.id),
      en_espera_por_tope_semanal: enEspera,
      reglas_bloqueadas_para_auto: [...bloqueadas],
    },
  };
  const resumenMd = escribirResumen({ sombraFrentes, avisoFrentes, senales, enEspera, semana, hoy, totales, fuentes, backtest, aplicar, reversiones, motivoNoAplicar, seguros, propuestas, deriva, avisosDeriva, evalRetadores, etiquetar, decisiones, silenciadas, config, avisoSeries, errores });

  const ficheros = {
    [RUTAS.backtest]: JSON.stringify(backtest, null, 1) + "\n",
    [RUTAS.deriva]: JSON.stringify(deriva, null, 1) + "\n",
    [RUTAS.evalRetadores]: JSON.stringify({ generado_en: new Date(ahora).toISOString(), semana, retadores: evalRetadores }, null, 1) + "\n",
    [RUTAS.frentesSombra]: JSON.stringify({
      generado_en: new Date(ahora).toISOString(), semana,
      nota: "Frentes, clorofila y corrientes EN LA SOMBRA (no tocan el índice en vivo). Efecto en log-odds por encima del índice de cada especie, prior centrado en 0 (sin signo supuesto). Solo agregados de 5 personas o más. Barreras: aprendizaje/config.json (ajuste y frentes). Rasgos: scripts/aprendizaje/frentes-sombra.mjs.",
      aviso: avisoFrentes, radio_km: RADIO_KM, ...publicarSombra(sombraFrentes),
    }, null, 1) + "\n",
    [RUTAS.etiquetar]: JSON.stringify({ generado_en: new Date(ahora).toISOString(), semana, nota: "Fotogramas que más enseñarían a la calibración de las cámaras si se etiquetan (etiquetar-olas.html o la rutina de etiquetado).", fotogramas: etiquetar }, null, 1) + "\n",
    [RUTAS.historial]: historialNuevo.map((h) => JSON.stringify(h)).join("\n") + "\n",
    [RUTAS.autoCambios]: JSON.stringify({ semana, cambios: todosCambios.map(({ regla, actual, propuesto, revierte }) => ({ regla, actual, propuesto, ...(revierte ? { revierte } : {}) })) }, null, 1) + "\n",
    [RUTAS.admin]: JSON.stringify(admin, null, 1) + "\n",
    [RUTAS.propuestas]: JSON.stringify(propuestas, null, 1) + "\n",
    [RUTAS.senales]: JSON.stringify(senales, null, 1) + "\n",
    [RUTAS.resumen]: resumenMd,
  };
  for (const [ruta, contenido] of Object.entries(ficheros)) {
    if (!ruta.endsWith(".json") && !ruta.endsWith(".jsonl")) continue;
    const objs = ruta.endsWith(".jsonl") ? contenido.trim().split("\n").map((l) => JSON.parse(l)) : [JSON.parse(contenido)];
    const probl = objs.flatMap((o) => comprobarPublicable(o, ruta));
    if (probl.length) throw new Error(`no publicable: ${probl.slice(0, 5).join("; ")}`);
  }
  if (nuevoTexto) ficheros[RUTAS.especies] = nuevoTexto;
  return { ficheros, cambiosAuto: todosCambios, propuestas, backtest, deriva, evalRetadores };
}

// ---------------------------------------------------------------------------
// Resumen para personas (castellano llano, sin jerga)
// ---------------------------------------------------------------------------
export function escribirResumen(r) {
  const L = [];
  const g = r.backtest.campeon.global;
  L.push(`# Aprendizaje de Costaviva — semana ${r.semana}`, "");
  L.push(`Generado el ${r.hoy} por el aprendizaje semanal (sin IA, \`aprendizaje-semanal.yml\`). Contrato de comun: \`estandares/aprendizaje.md\`. Detalle técnico en \`datos-robots/aprendizaje/\`; propuestas en \`aprendizaje/propuestas.json\`; señales en \`aprendizaje/senales.json\`.`, "");
  L.push("## Estado del bucle", "");
  L.push(`- Aprendizaje semanal: corrió el ${r.hoy} (${r.senales.estado}). Salidas usadas: ${r.totales.n}.`);
  L.push(`- Banco de pruebas: ${r.fuentes.recalculado} salidas recalculadas con el tiempo de su día y ${r.fuentes.guardado} con lo que guardó el diario.${r.avisoSeries ? ` ${r.avisoSeries}.` : ""}`);
  L.push(`- Retadores en la sombra: ${r.senales.metricas.retadores_en_sombra}. Reglas con peso ajustado por los datos: ${r.senales.metricas.reglas_ajustadas_auto}.`);
  L.push(`- Propuestas abiertas: ${r.senales.metricas.propuestas_abiertas}${r.enEspera.length ? ` (y ${r.enEspera.length} esperando turno: máximo 5 nuevas por semana)` : ""}. Las decides en el Issue semanal de comun.`);
  for (const e of r.errores) L.push(`- ⚠ ${e}`);
  L.push("");
  L.push("## En una frase", "");
  const preguntas = r.propuestas.filter((p) => p.requiere_si && p.estado === "propuesta").sort((a, b) => (b.impacto ?? 2) - (a.impacto ?? 2));
  if (!r.totales.n) L.push("Todavía no hay salidas del diario con índice para aprender: el sistema está listo y empezará en cuanto las haya.");
  else if (g.oculto) L.push(`Hay ${r.totales.n} salidas con índice, pero de menos de 5 personas distintas: se aprende con ellas, pero aquí no se publican sus números (privacidad).`);
  else L.push(`Con ${g.n} salidas, cuando el índice está más alto se pesca ${g.auc === null ? "(falta alguna salida sin pesca para saberlo)" : g.auc >= 0.6 ? "claramente más" : g.auc >= 0.53 ? "algo más" : "casi igual que cuando está bajo"} (AUC ${fmt(g.auc)}); se pescó algo en el ${pct(g.tasa)} de las salidas.`);
  L.push(`${r.aplicar.length + r.reversiones.length} cambio(s) aplicados solos y ${preguntas.length} pregunta(s) para ti.`, "");

  L.push("## Te pregunto (sí o no)", "");
  if (!preguntas.length) L.push("Nada esta semana.");
  for (const p of preguntas) L.push(`- **${p.titulo}** (\`${p.id}\`, impacto ${p.impacto ?? "?"}, riesgo ${p.riesgo}). ${p.explicacion_llana} _Evidencia:_ ${p.evidencia}.`);
  L.push("");

  L.push("## Cambios que se han aplicado solos", "");
  if (!r.aplicar.length && !r.reversiones.length) {
    L.push(r.motivoNoAplicar ? `Ninguno. El ajuste pedía tocar ${r.seguros.automaticos.map((c) => c.regla).join(", ")}, pero no se aplicó: ${r.motivoNoAplicar.join("; ")}.` : "Ninguno: los datos todavía no piden mover nada con seguridad.");
  }
  for (const c of r.aplicar) L.push(`- Regla \`${c.regla}\`: peso ${fmt(c.actual)} → ${fmt(c.propuesto)} (lo que puso la persona: ${fmt(c.experta)}).`);
  for (const c of r.reversiones) L.push(`- Deshecho el cambio de \`${c.regla}\` porque dijiste que no: vuelve a ${fmt(c.propuesto)}.`);
  L.push("", "Barreras: solo el peso (confianza) de reglas expertas, como mucho ±20 % por semana y ±50 % del valor de la persona, nunca cambia el signo, 30 salidas o más donde actuó y de 5 personas o más (nunca de una sola), mejora comprobada en las salidas más recientes, el panel de referencia no se mueve más de 3 puntos de media, tests en verde y como mucho 3 cambios. Un \"no\" tuyo lo deshace y bloquea esa regla.", "");

  L.push("## Qué tal acierta el índice", "");
  if (!g.oculto && g.n) {
    L.push("", "| Índice | Salidas | Se pescó algo |", "|---|---|---|");
    for (const b of g.calibracion) if (b.n) L.push(`| ${b.desde}-${b.hasta} | ${b.n} | ${b.tasa_real} % |`);
  }
  L.push("");

  L.push("## Vigilancia de los datos", "");
  if (!r.avisosDeriva.length) L.push("Todo en orden: las fuentes llegan, el modelo no se separa de las boyas y el índice no ha dado saltos raros.");
  for (const a of r.avisosDeriva) L.push(`- ${a.texto}`);
  L.push("");

  L.push("## Retadores en la sombra", "");
  const rets = r.evalRetadores.filter((x) => !x.interno);
  if (!rets.length) L.push("Ninguno. Los propone la rutina \"Costaviva - Investigador semanal\" en `aprendizaje/retadores/`.");
  for (const x of rets) {
    if (x.problemas?.length) { L.push(`- \`${x.id}\`: no se puede evaluar (${x.problemas.slice(0, 3).join("; ")}).`); continue; }
    const m = x.metricas;
    L.push(`- \`${x.id}\` (${x.titulo}): ${m?.oculto ? `sin resultado publicable (${m.motivo})` : `${x.gana ? "gana" : "no gana"} al índice actual en ${x.n_casos} salidas (probabilidad de mejora ${pct(m.mejora_logloss?.prob_mejora)})`}${x.panel ? `; movería el índice ${fmt(x.panel.media_abs, 1)} puntos de media` : ""}.`);
  }
  L.push("");

  if (r.sombraFrentes) {
    const sf = r.sombraFrentes;
    L.push("## Frentes, clorofila y corrientes (en la sombra)", "");
    L.push(`Se mira, para cada modalidad y cada especie, si pescar cerca de un borde de clorofila, de un cambio de temperatura, de una corriente que junta el agua (o con agua azul, verdosa o con floración, o con corriente fuerte) cambia lo que ya decía el índice, sin suponer de antemano si ayuda o estorba. No toca el índice en vivo.`);
    L.push(`- Salidas con la capa de su día: ${sf.casos_con_capa} de ${sf.casos}.${r.avisoFrentes ? ` ${r.avisoFrentes}.` : ""}`);
    if (sf.superan.length) for (const k of sf.superan) L.push(`- Supera todas las barreras: ${k.especie} en ${k.modalidad}, «${k.variable}» (${k.efecto_logodds > 0 ? "ayuda" : "estorba"}): va como pregunta.`);
    else L.push("- Ninguna combinación supera todavía las barreras (80 salidas, 15 con y 15 sin captura, 30 con y 30 sin el rasgo, 5 personas o más, efecto de 3 desviaciones y mejora en las salidas recientes). Todas siguen en la sombra, acumulando salidas.");
    L.push("");
  }
  L.push("## Para etiquetar (lo que más enseña)", "");
  if (!r.etiquetar.length) L.push("Nada pendiente.");
  for (const e of r.etiquetar.slice(0, 6)) L.push(`- Cámara ${e.camara} (${e.encuadre}), ${e.fecha.slice(0, 16).replace("T", " ")} UTC: ${e.motivo}.`);
  L.push("", "Se etiquetan en `etiquetar-olas.html` (admin) o con la rutina de etiquetado.", "");

  const tasas = tasasAceptacion(r.decisiones, r.propuestas);
  L.push("## Lo que sueles aceptar", "");
  const conTasa = Object.entries(tasas);
  if (!conTasa.length) L.push("Aún no hay decisiones. El orden de las propuestas usa impacto × (aceptadas + 1) / (decididas + 2) por tipo, como el resumen de comun.");
  for (const [tipo, v] of conTasa) L.push(`- ${tipo}: ${v.si} sí y ${v.no} no (peso para ordenar: ${fmt(v.tasa)}).`);
  if (r.silenciadas.length) L.push(`- No se vuelven a proponer (las rechazaste y la evidencia no se ha duplicado): ${r.silenciadas.join(", ")}.`);
  L.push("");

  L.push("## Ideas para más adelante", "");
  for (const i of r.config.ideas || []) L.push(`- ${i}`);
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function escribir(ficheros, raiz = RAIZ) {
  for (const [ruta, contenido] of Object.entries(ficheros)) {
    const abs = join(raiz, ruta);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contenido);
  }
}

const leer = (ruta, def) => { try { return JSON.parse(readFileSync(join(RAIZ, ruta), "utf8")); } catch { return def; } };

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const hoy = process.env.HOY || new Date().toISOString().slice(0, 10);

  if (args.includes("--degradar-auto")) {
    const motivo = val("--degradar-auto") || "la PR automática no se pudo completar";
    const ps = leer(RUTAS.propuestas, []);
    for (const p of ps) {
      if (p.estado === "aplicada" && p.requiere_si === false && p.fecha_aplicada === hoy) {
        p.estado = "propuesta"; p.requiere_si = true; delete p.fecha_aplicada;
        p.explicacion_llana += ` No se pudo aplicar solo (${motivo}): ¿lo aplico?`;
      }
    }
    writeFileSync(join(RAIZ, RUTAS.propuestas), JSON.stringify(ps, null, 1) + "\n");
    return;
  }
  if (args.includes("--poner-pr")) {
    const v = String(val("--poner-pr") || "");
    const pr = /^\d+$/.test(v) ? Number(v) : v || null;
    const ps = leer(RUTAS.propuestas, []);
    for (const p of ps) if (p.estado === "aplicada" && p.fecha_aplicada === hoy) p.pr = pr;
    writeFileSync(join(RAIZ, RUTAS.propuestas), JSON.stringify(ps, null, 1) + "\n");
    return;
  }

  const datos = leer(RUTAS.especies);
  const extras = { tipoFondo: leer(RUTAS.tipoFondo), profundidad: leer(RUTAS.profundidad) };
  const { leerHistoricoFrentes, leerDiario, leerComunidad, ultimaFila, seriesDeCasos, seriesVigia, leerJSONL, ultimoCommit, leerObservaciones } = await import("./datos.mjs");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, apiKey = (process.env.OPEN_METEO_API_KEY || "").trim();
  const config = leer(RUTAS.config, {});
  const cache = process.env.APRENDIZAJE_CACHE || join(process.env.RUNNER_TEMP || tmpdir(), "aprendizaje-cache");

  // Casos (del diario o de un fichero de pruebas)
  let casosBase = [], descartes = {}, errores = [];
  if (val("--entrada")) {
    const e = JSON.parse(readFileSync(val("--entrada"), "utf8"));
    ({ casos: casosBase, descartes } = casosDesdeDiario({ ...e, excluir: new Set(e.excluir || []), propios: new Set(e.propios || []), datos, hoy }));
  } else if (url && key) {
    const d = await leerDiario({ url, key, emailsPrueba: [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_B_EMAIL].filter(Boolean) });
    errores = d.errores;
    ({ casos: casosBase, descartes } = casosDesdeDiario({ ...d, datos, hoy }));
  } else if (!args.includes("--solo-retadores")) {
    errores.push("sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: pasada sin casos");
  }
  // Series: caché del runner (nunca en el repo: fecha + lugar de una salida es dato personal)
  mkdirSync(cache, { recursive: true });
  const rutaCache = join(cache, "series.json");
  let cacheSeries = {};
  try { cacheSeries = JSON.parse(readFileSync(rutaCache, "utf8")); } catch { /* sin caché */ }
  const faltan = casosBase.filter((c) => !cacheSeries[c.ref]);
  const { series: nuevas, aviso: avisoSeries } = await seriesDeCasos(faltan, { apiKey, hoy, maxLlamadas: config.series?.max_llamadas_open_meteo ?? 120 });
  for (const [k, v] of nuevas) cacheSeries[k] = v;
  writeFileSync(rutaCache, JSON.stringify(cacheSeries));
  const series = new Map(Object.entries(cacheSeries));

  if (args.includes("--solo-retadores")) {
    const dir = val("--solo-retadores");
    const panelCampeon = panelReferencia(datos);
    const { casos } = prepararCasos(casosBase, { datos, series, extras });
    const evals = leerRetadores(dir).map((r) => (r.error ? { fichero: r.fichero, problemas: [`JSON inválido: ${r.error}`] } : { fichero: r.fichero, ...evaluarRetador(r, { datos, casos, series, extras, panelCampeon }) }));
    const salida = { generado_en: new Date().toISOString(), nota: "Evaluación con los datos privados del diario (solo agregados k ≥ 5). La escribe aprendizaje-semanal.yml al subir una rama robot/aprendizaje-*.", casos: casos.length, aviso_series: avisoSeries, retadores: evals };
    const probl = comprobarPublicable(salida);
    if (probl.length) throw new Error(probl.join("; "));
    const f = val("--salida-evaluacion") || "aprendizaje/evaluacion-retadores.json";
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(salida, null, 1) + "\n");
    console.log(`Evaluados ${evals.length} retadores con ${casos.length} casos.`);
    return;
  }

  // Frescura de las fuentes
  const fuentesRepo = (config.fuentes_repo || []).map((f) => ({ nombre: f.nombre, cadencia_h: f.cadencia_h, ultima: ultimoCommit(RAIZ, f.ruta) }));
  const fuentesTablas = [];
  if (url && key) {
    for (const f of config.fuentes_tablas || []) {
      const r = await ultimaFila({ url, key }, f.tabla, f.columna);
      fuentesTablas.push({ nombre: f.nombre, cadencia_h: f.cadencia_h, ultima: r.ultima, ...(r.error ? { error: r.error } : {}) });
    }
  }
  let vigia = null;
  try { vigia = await seriesVigia({ apiKey }); } catch (e) { errores.push(`spots vigía: ${e.message}`); }
  const comunidad = url && key ? await leerComunidad({ url, key }) : { filas: [], error: "sin Supabase" };

  // Frentes de la fecha de cada salida (bucket público, sin clave).
  const rasgosFrentes = new Map();
  let avisoFrentes = null;
  if (casosBase.length) {
    try {
      const { mapa, aviso } = await leerHistoricoFrentes(casosBase.map((c) => c.fecha), { decodificar: decodificarHistorico });
      avisoFrentes = aviso;
      for (const c of casosBase) { const r = rasgosCaso(mapa.get(c.fecha), c); if (r) rasgosFrentes.set(c.ref, r); }
    } catch (e) { avisoFrentes = `capa de frentes: ${e.message}`; }
  }

  const pausado = existsSync(join(RAIZ, "ROBOT_PAUSADO")) || process.env.AUTOMATION_PAUSED === "true";
  const r = ejecutar({
    datos, textoEspecies: readFileSync(join(RAIZ, RUTAS.especies), "utf8"), casosBase, descartes, series, avisoSeries, extras,
    config, decisiones: leer(RUTAS.decisiones, []), propuestasExistentes: leer(RUTAS.propuestas, []),
    retadores: leerRetadores(join(RAIZ, RUTAS.retadores)), historial: leerJSONL(join(RAIZ, RUTAS.historial)),
    espuma: leerJSONL(join(RAIZ, RUTAS.espuma)), calibracionCamaras: leer(RUTAS.calibracionCamaras, null),
    fuentesRepo, fuentesTablas, vigia, observaciones: leerObservaciones(RAIZ), comunidad, hoy, pausado, errores,
    rasgosFrentes, avisoFrentes, hipotesisFrentes: leer(RUTAS.frentesHipotesis, null),
    sinAuto: args.includes("--no-aplicar") ? "lanzado a mano sin permitir cambios automáticos" : null,
  });
  escribir(r.ficheros);
  console.log(`Aprendizaje ${hoy}: ${r.backtest.datos.casos} casos, ${r.cambiosAuto.length} cambios automáticos, ${r.propuestas.filter((p) => p.requiere_si && p.estado === "propuesta").length} preguntas.`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `cambios=${r.cambiosAuto.length}\n`, { flag: "a" });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
