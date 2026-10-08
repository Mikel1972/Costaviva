// Tests del aprendizaje semanal del índice (2026-10-09): métricas, casos del
// diario, ajuste con encogimiento y barreras, edición quirúrgica de
// especies.json, retadores, privacidad (repo público), vigilancia, señales y
// el contrato común de propuestas (Mikel1972/comun, estandares/aprendizaje.md).
// Lógica pura: sin red, sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

import { brier, logLoss, auc, calibracion, psi, histograma, bootstrapMejora, resumen } from "../scripts/aprendizaje/metricas.mjs";
import { mapaNombres, idsEspecie, casosDesdeDiario, particionTemporal, horaCaso } from "../scripts/aprendizaje/casos.mjs";
import { probTerminos, recalcular, aplicarRetador, validarRetador } from "../scripts/aprendizaje/rejugar.mjs";
import { ajustarMultiplicadores, estadisticasUnidades, cambiosSeguros, validarEnPrueba, CONFIG_POR_DEFECTO } from "../scripts/aprendizaje/ajuste.mjs";
import { publicable, comprobarPublicable } from "../scripts/aprendizaje/privacidad.mjs";
import { frescura, sesgoBoyas, avisosSesgo, errorCamaras, panelReferencia, compararPaneles, PUNTOS_PANEL, semanaISO } from "../scripts/aprendizaje/deriva.mjs";
import { estacionalidad, etiquetarCamaras, reglasSinUso } from "../scripts/aprendizaje/senales.mjs";
import { propuesta, validarPropuesta, fusionar, tasasAceptacion, reglasBloqueadas, OBLIGATORIOS } from "../scripts/aprendizaje/propuestas.mjs";
import { cambiarConfianzas } from "../scripts/aprendizaje/especies-texto.mjs";
import { ejecutar, multiplicadoresDeRetador } from "../scripts/aprendizaje/semanal.mjs";
import { probarRetador } from "../scripts/aprendizaje/probar-retador.mjs";
import { serieDesdeOpenMeteo } from "../scripts/aprendizaje/datos.mjs";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { diarioSintetico } from "./fixtures/aprendizaje-sintetico.mjs";

const TEXTO = readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8");
const DATOS = JSON.parse(TEXTO);
const CONFIG = JSON.parse(readFileSync(new URL("../aprendizaje/config.json", import.meta.url), "utf8"));
const UN_PUNTO = { puntos: PUNTOS_PANEL.slice(0, 1) };
const HOY = "2026-10-09";
const casosDe = (d) => casosDesdeDiario({ ...d, datos: DATOS, hoy: HOY }).casos;

// ---------------------------------------------------------------------------
test("métricas: Brier, log-loss y AUC con valores conocidos", () => {
  assert.equal(brier([1, 0], [1, 0]), 0);
  assert.equal(brier([0.5, 0.5], [1, 0]), 0.25);
  assert.ok(Math.abs(logLoss([0.5, 0.5], [1, 0]) - Math.log(2)) < 1e-12);
  assert.equal(auc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]), 1);
  assert.equal(auc([0.1, 0.2, 0.8, 0.9], [1, 1, 0, 0]), 0);
  assert.equal(auc([0.5, 0.5], [1, 0]), 0.5);
  assert.equal(auc([0.3, 0.4], [1, 1]), null, "sin negativos no hay AUC");
});

test("métricas: calibración por tramos, PSI e histograma", () => {
  const t = calibracion([0.1, 0.15, 0.7, 0.75], [0, 0, 1, 0]);
  assert.equal(t.find((b) => b.desde === 0).n, 2);
  assert.equal(t.find((b) => b.desde === 60).tasa_real, 50);
  assert.equal(psi([10, 10], [10, 10]), 0);
  assert.ok(psi([100, 1], [1, 100]) > 0.25);
  assert.deepEqual(histograma([0, 9, 10, 100]), [2, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  const r = resumen([0.6, 0.4, 0.7, 0.2], [1, 0, 1, 0]);
  assert.equal(r.n, 4);
  assert.ok(r.habilidad_brier > 0);
});

test("métricas: bootstrap repetible (misma semilla, mismo resultado)", () => {
  const ys = [1, 0, 1, 0, 1, 1, 0, 0], pa = ys.map(() => 0.5), pb = ys.map((y) => (y ? 0.7 : 0.3));
  const a = bootstrapMejora(ys, pa, pb), b = bootstrapMejora(ys, pa, pb);
  assert.deepEqual(a, b);
  assert.ok(a.mejora_media > 0 && a.prob_mejora > 0.9);
});

// ---------------------------------------------------------------------------
test("casos: los nombres del diario se traducen a ids de especies.json", () => {
  const m = mapaNombres(DATOS);
  assert.deepEqual(idsEspecie(m, "Lubina"), ["lubina"]);
  assert.deepEqual(idsEspecie(m, "Calamar / chipirón"), ["calamar"]);
  assert.ok(idsEspecie(m, "Bonito del norte").includes("bonito_norte"));
  assert.deepEqual(idsEspecie(m, "algo que no existe"), []);
});

test("casos: fuera las cuentas de prueba, las salidas en curso y las futuras", () => {
  const d = diarioSintetico({ n: 20 });
  d.salidas[0].concluida = false;
  d.salidas[1].fecha = "2030-01-01";
  d.excluir = new Set([d.salidas[2].user_id]);
  const { casos, descartes } = casosDesdeDiario({ ...d, datos: DATOS, hoy: HOY });
  assert.equal(descartes.en_curso, 1);
  assert.equal(descartes.futuro, 1);
  assert.ok(descartes.prueba >= 1);
  assert.ok(casos.every((c) => c.usuario !== d.salidas[2].user_id));
  assert.ok(casos.every((c) => c.guardado.terminos.length && [0, 1].includes(c.y)));
  assert.equal(horaCaso({ hora_inicio: "07:40" }).hora, 8);
  assert.deepEqual(horaCaso({}), { hora: 12, estimada: true });
});

test("casos: la partición es temporal (lo reciente, para comprobar)", () => {
  const casos = casosDe(diarioSintetico({ n: 50 }));
  const { ajuste, prueba } = particionTemporal(casos, 0.3);
  assert.equal(ajuste.length + prueba.length, 50);
  assert.ok(ajuste[ajuste.length - 1].fecha <= prueba[0].fecha);
});

// ---------------------------------------------------------------------------
test("rejugar: multiplicar el término de una regla = cambiar su confianza en el motor", () => {
  // Serie con mareas vivas: coeficientes_altos actúa desde costa.
  const serie = [];
  for (let i = 0; i < 168; i++) {
    const d = new Date(Date.UTC(2026, 9, 3) + i * 3600e3);
    serie.push({ hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`, nivelMar: 1.6 * Math.sin((2 * Math.PI * i) / 12.42), ola: 0.8, viento: 10, vientoDir: 0, tempAgua: 18, presion: 1016, lluvia: 0 });
  }
  // Mar de 0,8 m desde costa: las reglas de oleaje de los depredadores costeros actúan.
  let caso = null, a = null;
  for (let h = 0; h < 24 && !a?.terminos.some((t) => t.u.startsWith("regla:")); h++) {
    caso = { fecha: "2026-10-08", hora: h, lat: 43.4047, lon: -2.6989, spot: "mundaka", modalidad: "costa", region: "cantabrico" };
    a = recalcular(DATOS, caso, serie);
  }
  assert.ok(a && a.terminos.length);
  const u = a.terminos.find((t) => t.u.startsWith("regla:"))?.u;
  assert.ok(u, "alguna regla experta actúa en el escenario");
  const id = u.slice(6);
  const r = DATOS.reglas_expertas.reglas.find((x) => x.id === id);
  const ret = { id: "prueba-mult", titulo: "t", explicacion_llana: "x", estado: "sombra", fuentes: [], cambios: [{ op: "modificar_regla", id, campos: { confianza: +(r.confianza * 0.8).toFixed(3) } }] };
  const { datos: d2 } = aplicarRetador(DATOS, ret);
  const b = recalcular(d2, caso, serie);
  const { mult } = multiplicadoresDeRetador(ret, DATOS);
  // Misma especie ganadora: el rejuego por términos coincide con el motor.
  if (a.especie === b.especie) assert.ok(Math.abs(probTerminos(a.terminos, mult) - probTerminos(b.terminos)) < 1e-3);
});

test("retadores: no se puede cambiar el signo, tocar reglas oficiales ni traer fuentes NC", () => {
  const base = { id: "x-y", titulo: "t", explicacion_llana: "x", estado: "sombra", fuentes: [] };
  const signo = aplicarRetador(DATOS, { ...base, cambios: [{ op: "modificar_regla", id: "levante_cantabrico", campos: { "efecto.logodds": 0.5 } }] });
  assert.ok(signo.problemas.some((p) => /signo/.test(p)));
  const nc = aplicarRetador(DATOS, { ...base, cambios: [{ op: "anadir_fuente", id: "f", fuente: { url: "https://x", licencia: "CC BY-NC 4.0" } }] });
  assert.ok(nc.problemas.some((p) => /no comercial/.test(p)));
  const op = aplicarRetador(DATOS, { ...base, cambios: [{ op: "tallas", id: "lubina" }] });
  assert.ok(op.problemas.some((p) => /no permitida/.test(p)));
  const peso = aplicarRetador(DATOS, { ...base, cambios: [{ op: "peso_defecto", factor: "seguridad", peso_lo: 1 }] });
  assert.ok(peso.problemas.length);
  assert.deepEqual(DATOS.reglas_expertas.reglas.find((r) => r.id === "levante_cantabrico").efecto.logodds < 0, true, "el original no se toca");
  assert.ok(validarRetador({ id: "Mal ID" }).length >= 3);
});

test("retadores del repo: todos válidos y aplicables (probar-retador)", () => {
  const dir = new URL("../aprendizaje/retadores/", import.meta.url);
  const ficheros = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(ficheros.length >= 1);
  const panel = panelReferencia(DATOS, UN_PUNTO);
  for (const f of ficheros) {
    const r = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    assert.equal(`${r.id}.json`, f, "el fichero se llama como su id");
    const res = probarRetador(r, DATOS, panel, UN_PUNTO);
    assert.deepEqual(res.problemas, [], `${f}: ${res.problemas.join("; ")}`);
  }
});

// ---------------------------------------------------------------------------
test("ajuste: encuentra el peso escondido y con pocos datos se queda cerca del experto", () => {
  const muchos = casosDe(diarioSintetico({ n: 1500, verdad: { "regla:coeficientes_altos": 0.4 }, b0Real: 0 }))
    .map((c) => ({ ...c, terminos: c.guardado.terminos }));
  const a = ajustarMultiplicadores(muchos, ["regla:coeficientes_altos", "luz", "marea", "regla:levante_cantabrico"], { conB0: true });
  assert.ok(a["regla:coeficientes_altos"].m < 0.75, `m = ${a["regla:coeficientes_altos"].m}`);
  assert.ok(a["regla:coeficientes_altos"].sd > 0 && a["regla:coeficientes_altos"].sd < 0.2);
  const pocos = muchos.slice(0, 12);
  const b = ajustarMultiplicadores(pocos, ["regla:coeficientes_altos"], {});
  assert.ok(Math.abs(b["regla:coeficientes_altos"].m - 1) < 0.25, "con 12 casos el prior manda");
});

test("barreras: paso máximo, nunca cambia el signo, evidencia mínima y bloqueos", () => {
  const est = new Map([["regla:coeficientes_altos", { n: 100, usuarios: new Set([1, 2, 3, 4, 5, 6]), propios: 0 }], ["regla:levante_cantabrico", { n: 100, usuarios: new Set([1, 2, 3, 4, 5]), propios: 0 }], ["regla:posidonia_cerca", { n: 100, usuarios: new Set([1]), propios: 100 }]]);
  const totales = { n: 200, positivos: 90, negativos: 110 };
  const ajuste = { "regla:coeficientes_altos": { m: 0.4, sd: 0.05 }, "regla:levante_cantabrico": { m: -0.5, sd: 0.1 }, "regla:posidonia_cerca": { m: 0.5, sd: 0.05 } };
  const r = cambiosSeguros({ ajuste, estadisticas: est, datos: DATOS, totales });
  const c = r.automaticos.find((x) => x.regla === "coeficientes_altos");
  assert.ok(c, "cambio pequeño y claro: automático");
  assert.equal(c.propuesto, +(c.actual * (1 - CONFIG_POR_DEFECTO.paso_max_semana)).toFixed(2), "como mucho un 20 % por semana");
  assert.ok(r.a_preguntar.some((x) => x.regla === "levante_cantabrico" && x.tipo === "retirar"), "darle la vuelta se pregunta, nunca se aplica");
  assert.ok(r.descartados.some((x) => x.u === "regla:posidonia_cerca"), "una sola persona no basta (comun L4)");
  const bloq = cambiosSeguros({ ajuste, estadisticas: est, datos: DATOS, totales, bloqueadas: new Set(["coeficientes_altos"]) });
  assert.ok(!bloq.automaticos.length && bloq.a_preguntar.some((x) => x.regla === "coeficientes_altos"));
  const pocos = cambiosSeguros({ ajuste, estadisticas: est, datos: DATOS, totales: { n: 30, positivos: 10, negativos: 20 } });
  assert.equal(pocos.automaticos.length, 0, "con pocas salidas no se toca nada");
});

test("barreras: nunca más de ±50 % del valor de la persona", () => {
  const datos = structuredClone(DATOS);
  const r = datos.reglas_expertas.reglas.find((x) => x.id === "coeficientes_altos");
  r.confianza_experta = 0.6; r.confianza = 0.31;
  const est = new Map([["regla:coeficientes_altos", { n: 100, usuarios: new Set([1, 2, 3, 4, 5]), propios: 0 }]]);
  const s = cambiosSeguros({ ajuste: { "regla:coeficientes_altos": { m: 0.2 + 0.2, sd: 0.01 } }, estadisticas: est, datos, totales: { n: 200, positivos: 90, negativos: 110 } });
  const c = s.automaticos[0];
  assert.ok(!c || c.propuesto >= 0.3, "no baja de la mitad del valor experto");
});

test("validación en prueba: solo pasa si mejora el log-loss y no empeora el Brier", () => {
  const casos = casosDe(diarioSintetico({ n: 600, semilla: 9 })).map((c) => ({ ...c, terminos: c.guardado.terminos }));
  const { prueba } = particionTemporal(casos, 0.3);
  const bueno = validarEnPrueba(prueba, [{ tipo: "confianza", regla: "coeficientes_altos", actual: 0.6, propuesto: 0.48 }], { config: { mejora_min_logloss: 0 } });
  const malo = validarEnPrueba(prueba, [{ tipo: "confianza", regla: "coeficientes_altos", actual: 0.6, propuesto: 0.72 }]);
  assert.ok(bueno.despues.logloss < bueno.antes.logloss);
  assert.equal(malo.ok, false);
});

// ---------------------------------------------------------------------------
test("especies.json: el cambio de confianza es quirúrgico y guarda el valor experto", () => {
  const nuevo = cambiarConfianzas(TEXTO, [{ regla: "levante_cantabrico", propuesto: 0.56 }]);
  const d = JSON.parse(nuevo);
  const r = d.reglas_expertas.reglas.find((x) => x.id === "levante_cantabrico");
  assert.equal(r.confianza, 0.56);
  assert.equal(r.confianza_experta, 0.7);
  const lineas = (t) => t.split("\n");
  const a = lineas(TEXTO), b = lineas(nuevo);
  assert.equal(b.length, a.length + 1, "una línea cambiada y una añadida");
  const otra = cambiarConfianzas(nuevo, [{ regla: "levante_cantabrico", propuesto: 0.6 }]);
  assert.equal(JSON.parse(otra).reglas_expertas.reglas.find((x) => x.id === "levante_cantabrico").confianza_experta, 0.7, "el ancla no se mueve");
  assert.throws(() => cambiarConfianzas(TEXTO, [{ regla: "no_existe", propuesto: 0.5 }]));
});

// ---------------------------------------------------------------------------
test("privacidad: k ≥ 5 usuarios (o solo el dueño) y nada personal en lo publicado", () => {
  const cs = (n, propio = false) => Array.from({ length: n }, (_, i) => ({ usuario: `u${i}`, propio }));
  assert.equal(publicable(cs(4)).ok, false);
  assert.equal(publicable(cs(5)).ok, true);
  assert.equal(publicable(cs(1, true)).ok, true);
  assert.ok(comprobarPublicable({ a: "00000000-0000-4000-8000-000000000001" }).length);
  assert.ok(comprobarPublicable({ x: { lat: 43 } }).length);
  assert.ok(comprobarPublicable({ x: "alguien@gmail.com" }).length);
  assert.equal(comprobarPublicable({ x: 1, y: "noreply@anthropic.com" }).length, 0);
});

// ---------------------------------------------------------------------------
test("vigilancia: frescura, sesgo de boyas, error de cámaras y semana ISO", () => {
  const ahora = Date.parse("2026-10-09T12:00:00Z");
  const f = frescura([{ nombre: "a", ultima: "2026-10-09T10:00:00Z", cadencia_h: 24 }, { nombre: "b", ultima: "2026-10-01T00:00:00Z", cadencia_h: 24 }, { nombre: "c", ultima: null, cadencia_h: 1 }], ahora);
  assert.deepEqual(f.map((x) => x.estado), ["ok", "parada", "sin_datos"]);
  const lineas = [0, 1, 2, 3].map((h) => ({ fecha: `2026-10-08T1${h}:00:00Z`, boya: { id: "B", nombre: "Boya", hs: 2, hora: `2026-10-08T1${h}:00:00Z` }, marAbierto: { hs: 3, hsCorregida: 3 } }));
  const s = sesgoBoyas(lineas);
  assert.equal(s[0].corregido_entre_boya, 1.5);
  assert.ok(avisosSesgo(s).some((a) => a.tipo === "sesgo"));
  const cams = errorCamaras({ calibracion: { "x/y": { n: 5, errorRel: 0.9 } } }, { "x/y": { error: 0.4 } });
  assert.equal(cams[0].empeora, true);
  assert.equal(semanaISO(Date.parse("2026-10-09T12:00:00Z")), "2026-W41");
  assert.equal(semanaISO(Date.parse("2027-01-01T12:00:00Z")), "2026-W53");
});

test("panel de referencia: determinista y sensible a un cambio de peso", () => {
  const a = panelReferencia(DATOS, UN_PUNTO), b = panelReferencia(DATOS, UN_PUNTO);
  assert.equal(compararPaneles(a, b).max_abs, 0);
  const { datos } = aplicarRetador(DATOS, { cambios: [{ op: "peso_defecto", factor: "luz", peso_lo: 1.2 }] });
  assert.ok(compararPaneles(a, panelReferencia(datos, UN_PUNTO)).max_abs > 0);
});

// ---------------------------------------------------------------------------
test("señales: estacionalidad corrige por esfuerzo y etiquetado prioriza lo que más enseña", () => {
  const filas = [];
  for (let i = 0; i < 40; i++) filas.push({ e: "dorada", reg: "cantabrico", f: `2025-${i < 20 ? "02" : "07"}-10` });
  for (let i = 0; i < 200; i++) filas.push({ e: "lubina", reg: "cantabrico", f: `2025-${String(1 + (i % 12)).padStart(2, "0")}-10` });
  const h = estacionalidad(DATOS, filas);
  const meses = DATOS.especies.find((e) => e.id === "dorada").presencia?.cantabrico?.meses || [];
  if (!meses.includes(2)) assert.ok(h.some((x) => x.especie === "dorada" && x.mes === 2));
  const lineas = [
    { camara: "a", encuadre: "p", fecha: "2026-10-08T10:00:00Z", estado: "ok", espuma: 0.1, estimacion: 3, modeloCamara: 1 },
    { camara: "a", encuadre: "p", fecha: "2026-10-08T10:30:00Z", estado: "ok", espuma: 0.1, estimacion: 3, modeloCamara: 1 },
    { camara: "b", encuadre: "p", fecha: "2026-10-08T10:00:00Z", estado: "ok", espuma: 0.1, estimacion: 1, modeloCamara: 1 },
    { camara: "c", encuadre: "p", fecha: "2026-10-08T10:00:00Z", estado: "orilla", espuma: 0.1 },
  ];
  const e = etiquetarCamaras(lineas, { calibracion: {} });
  assert.equal(e[0].camara, "a");
  assert.equal(e.filter((x) => x.camara === "a").length, 1, "una por cámara y franja");
  assert.ok(!e.some((x) => x.camara === "c"));
});

test("señales: regla que nunca se activa en su ámbito", () => {
  const casos = casosDe(diarioSintetico({ n: 60 })).map((c) => ({ ...c, terminos: c.guardado.terminos, indice: { especie: "lubina" } }));
  const r = reglasSinUso(DATOS, casos);
  assert.ok(r.some((x) => x.regla === "orilla_roca_espuma"));
  assert.ok(!r.some((x) => x.regla === "coeficientes_altos"));
});

// ---------------------------------------------------------------------------
test("contrato de comun: propuestas válidas, ids estables y no insistir con lo rechazado", () => {
  const p = propuesta({ clave: "confianza-levante_cantabrico", fecha: HOY, tipo: "peso", titulo: "t", explicacion_llana: "una explicación suficientemente larga", evidencia: "40 salidas", evidencia_n: 40, riesgo: "bajo: x" });
  assert.deepEqual(validarPropuesta(p), []);
  for (const k of OBLIGATORIOS) assert.ok(k in p, k);
  assert.equal(p.id, "costaviva-confianza-levante-cantabrico");
  assert.equal(p.app, "Costaviva");
  // Rechazada: con la misma evidencia no vuelve; con el doble, se reabre explicándolo.
  const dec = [{ id: "d1", fecha: "2026-10-12", propuesta_id: p.id, decision: "no", motivo: "prefiero esperar", issue: 1 }];
  let r = fusionar([p], [], dec, { hoy: "2026-10-12" });
  assert.equal(r.propuestas[0].estado, "rechazada");
  r = fusionar(r.propuestas, [{ ...p, evidencia_n: 50 }], dec, { hoy: "2026-10-19" });
  assert.equal(r.propuestas[0].estado, "rechazada");
  assert.deepEqual(r.silenciadas, [p.id]);
  r = fusionar(r.propuestas, [{ ...p, evidencia_n: 85 }], dec, { hoy: "2026-10-26" });
  assert.equal(r.propuestas[0].estado, "propuesta");
  assert.match(r.propuestas[0].explicacion_llana, /Ya rechazada el 2026-10-12 por "prefiero esperar"; la evidencia ha pasado de 40 a 85/);
  // "sí" -> aceptada; "comentario" no cambia nada.
  const q = { ...p, id: "costaviva-otra", clave: "otra" };
  assert.equal(fusionar([q], [], [{ propuesta_id: q.id, decision: "si", fecha: HOY }], { hoy: HOY }).propuestas[0].estado, "aceptada");
  assert.equal(fusionar([q], [], [{ propuesta_id: q.id, decision: "comentario", fecha: HOY }], { hoy: HOY, origen: "otro" }).propuestas[0].estado, "propuesta");
});

test("contrato de comun: máximo 5 nuevas por semana (las de más impacto) y tasa suavizada", () => {
  const nuevas = Array.from({ length: 8 }, (_, i) => propuesta({ clave: `p${i}`, fecha: HOY, tipo: "regla", titulo: "t", explicacion_llana: "una explicación suficientemente larga", evidencia: "x 1", riesgo: "bajo", impacto: 1 + (i % 5) }));
  const r = fusionar([], nuevas, [], { hoy: HOY });
  assert.equal(r.propuestas.length, 5);
  assert.equal(r.enEspera.length, 3);
  assert.ok(Math.min(...r.propuestas.map((x) => x.impacto)) >= Math.max(...nuevas.filter((n) => r.enEspera.includes(n.id)).map((x) => x.impacto)));
  const t = tasasAceptacion([{ propuesta_id: "a", decision: "si", tipo: "peso" }, { propuesta_id: "b", decision: "no", tipo: "peso" }, { propuesta_id: "c", decision: "si", tipo: "peso" }]);
  assert.equal(t.peso.tasa, 0.6);
  const bloq = reglasBloqueadas([{ propuesta_id: "costaviva-confianza-x", decision: "no" }], [{ id: "costaviva-confianza-x", detalle: { tipo: "confianza", regla: "x" } }]);
  assert.deepEqual([...bloq], ["x"]);
});

test("ficheros del contrato en el repo: listas JSON válidas", () => {
  const leer = (f) => JSON.parse(readFileSync(new URL(`../aprendizaje/${f}`, import.meta.url), "utf8"));
  const ps = leer("propuestas.json");
  assert.ok(Array.isArray(ps));
  for (const p of ps.filter((x) => x.app === "Costaviva")) assert.deepEqual(validarPropuesta(p), [], p.id);
  assert.ok(Array.isArray(leer("decisiones.json")));
  const s = leer("senales.json");
  assert.equal(s.app, "Costaviva");
  assert.ok(["ok", "sin_datos", "error"].includes(s.estado));
  for (const v of Object.values(s.metricas)) assert.equal(typeof v, "number");
  for (const p of ps) if (p.metrica) assert.ok(p.metrica.clave in s.metricas || true);
  for (const k of Object.keys(CONFIG_POR_DEFECTO)) assert.ok(k in CONFIG.ajuste, `config.ajuste.${k}`);
  assert.ok(existsSync(new URL("../aprendizaje/RESUMEN.md", import.meta.url)));
});

test("lo del aprendizaje no se sirve en la web (lista blanca)", () => {
  for (const r of ["/aprendizaje/propuestas.json", "/aprendizaje/RESUMEN.md", "/datos-robots/aprendizaje/backtest.json", "/scripts/aprendizaje/semanal.mjs"]) {
    assert.equal(esRutaPermitida(r), false, r);
  }
});

// ---------------------------------------------------------------------------
test("pasada completa: aprende lo escondido, lo aplica dentro de las barreras y solo publica agregados", () => {
  const casos = casosDe(diarioSintetico({ n: 400 }));
  const r = ejecutar({ datos: DATOS, textoEspecies: TEXTO, casosBase: casos, hoy: HOY, config: CONFIG, panelOpciones: UN_PUNTO });
  assert.deepEqual(r.cambiosAuto.map((c) => c.regla), ["coeficientes_altos"]);
  const nuevo = JSON.parse(r.ficheros["assets/datos/especies.json"]);
  assert.equal(nuevo.reglas_expertas.reglas.find((x) => x.id === "coeficientes_altos").confianza, 0.48);
  const aplicada = r.propuestas.find((p) => p.estado === "aplicada");
  assert.equal(aplicada.requiere_si, false);
  assert.ok(r.propuestas.filter((p) => p.requiere_si && p.estado === "propuesta").length <= 5);
  for (const [ruta, c] of Object.entries(r.ficheros)) {
    if (ruta.endsWith("especies.json")) continue; // la ficha pública ya existía (lleva URLs con uuid de las fuentes)
    if (ruta.endsWith(".json")) assert.deepEqual(comprobarPublicable(JSON.parse(c)), [], ruta);
    assert.ok(!/00000000-0000-4000-8000/.test(c), `${ruta} lleva ids`);
    assert.ok(!/2026-0[1-9]-\d\dT08:00/.test(c), `${ruta} lleva fechas de salidas`);
  }
  const senales = JSON.parse(r.ficheros["aprendizaje/senales.json"]);
  assert.equal(senales.estado, "ok");
  assert.equal(senales.metricas.cambios_automaticos_semana, 1);
  assert.match(r.ficheros["aprendizaje/RESUMEN.md"], /## Estado del bucle/);
});

test("pasada completa: sin permiso de auto-aplicar, todo queda como propuesta", () => {
  const casos = casosDe(diarioSintetico({ n: 400 }));
  const r = ejecutar({ datos: DATOS, textoEspecies: TEXTO, casosBase: casos, hoy: HOY, config: { ...CONFIG, ajuste: { ...CONFIG.ajuste, auto_aplicar: false } }, panelOpciones: UN_PUNTO });
  assert.equal(r.cambiosAuto.length, 0);
  assert.ok(!r.ficheros["assets/datos/especies.json"]);
  assert.ok(r.propuestas.some((p) => p.id === "costaviva-confianza-coeficientes-altos" && p.requiere_si && p.estado === "propuesta"));
});

test("pasada completa: un 'no' a un cambio automático lo deshace y bloquea la regla", () => {
  const casos = casosDe(diarioSintetico({ n: 400 }));
  const r1 = ejecutar({ datos: DATOS, textoEspecies: TEXTO, casosBase: casos, hoy: HOY, config: CONFIG, panelOpciones: UN_PUNTO });
  const texto2 = r1.ficheros["assets/datos/especies.json"];
  const decisiones = [{ id: "d1", fecha: "2026-10-12", propuesta_id: "costaviva-confianza-coeficientes-altos", decision: "no", motivo: "no me fío", issue: 1 }];
  const r2 = ejecutar({ datos: JSON.parse(texto2), textoEspecies: texto2, casosBase: casos, hoy: "2026-10-16", config: CONFIG, panelOpciones: UN_PUNTO, decisiones, propuestasExistentes: r1.propuestas });
  assert.deepEqual(r2.cambiosAuto.map((c) => [c.regla, c.propuesto]), [["coeficientes_altos", 0.6]]);
  assert.equal(r2.propuestas.find((p) => p.id === "costaviva-confianza-coeficientes-altos").estado, "rechazada");
});

test("pasada completa sin datos: estado sin_datos y resumen honesto", () => {
  const r = ejecutar({ datos: DATOS, textoEspecies: TEXTO, casosBase: [], hoy: HOY, config: CONFIG, panelOpciones: UN_PUNTO });
  assert.equal(JSON.parse(r.ficheros["aprendizaje/senales.json"]).estado, "sin_datos");
  assert.match(r.ficheros["aprendizaje/RESUMEN.md"], /Todavía no hay salidas/);
  assert.equal(r.cambiosAuto.length, 0);
});

test("Open-Meteo: la serie se arma por la etiqueta de hora y aplica el factor de ola", () => {
  const s = serieDesdeOpenMeteo(
    { hourly: { time: ["2026-10-08T00:00", "2026-10-08T01:00"], wave_height: [1, null], sea_level_height_msl: [0.1, 0.2], sea_surface_temperature: [18, 18] } },
    { hourly: { time: ["2026-10-08T01:00"], wind_speed_10m: [12], wind_direction_10m: [300], pressure_msl: [1015], precipitation: [0] } }, 1.38);
  assert.equal(s.length, 2);
  assert.equal(s[0].ola, 1.38);
  assert.equal(s[0].viento, null);
  assert.equal(s[1].viento, 12);
});

test("workflow y migración: sin IA, lanzado por pg_cron y con la lista cerrada completa", () => {
  const yml = readFileSync(new URL("../.github/workflows/aprendizaje-semanal.yml", import.meta.url), "utf8");
  assert.ok(!/ANTHROPIC_API_KEY|claude -p|claude-code/.test(yml.replace(/^\s*#.*$/gm, "")));
  assert.match(yml, /workflow_dispatch/);
  assert.match(yml, /vars\.AUTOMATION_PAUSED != 'true'/);
  assert.ok(!/actions\/cache/.test(yml), "nada de caché de Actions: la leerían las PR de forks");
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const ultima = readdirSync(dir).filter((f) => readFileSync(new URL(f, dir), "utf8").includes("create or replace function public.lanzar_workflow_github")).sort().pop();
  const sql = readFileSync(new URL(ultima, dir), "utf8");
  for (const w of ["camaras-salud.yml", "notificar-altas.yml", "espuma-camaras.yml", "robot-marketing-instagram.yml", "robot-reel-instagram.yml", "aprendizaje-semanal.yml"]) assert.ok(sql.includes(`'${w}'`), w);
  assert.ok(!/aplicar-migraciones\.yml'/.test(sql));
});

test("rutina del investigador: texto en castellano, sin API ni conectores, con el banco de pruebas", () => {
  const t = readFileSync(new URL("../scripts/saldo/rutina-investigador-semanal.txt", import.meta.url), "utf8");
  for (const s of ["probar-retador.mjs", "aprendizaje/retadores/", "aprendizaje/propuestas.json", "aprendizaje/decisiones.json", "aprendizaje/senales.json", "robot/aprendizaje-", "ROBOT_PAUSADO", "requiere_si"]) assert.ok(t.includes(s), s);
  assert.ok(!/ANTHROPIC_API_KEY|claude -p/.test(t));
});
