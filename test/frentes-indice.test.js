// Tests de "〰 Frentes en el índice" (2026-10-09, pedido de Mikel): reglas
// expertas de frentes, clorofila y corriente con peso pequeño y fuente
// citada, la regla de Mikel "borde de borrasca" para los túnidos, el
// contexto que lee el índice (assets/js/frentes.js contextoFrentes), que
// nunca penalicen por falta de dato, que el panel fijo de escenarios no se
// mueva sin señal, su paso por el aprendizaje (rejugar, ajuste, propuesta de
// retirarla) y el histórico hacia atrás de descargar-capas.py. Lógica pura,
// sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as F from "../assets/js/frentes.js";
import { calcularVentana, indiceSpot, paraUsuario, frentesDelDia, repartirAportes } from "../assets/js/ventana-actividad.js";
import { validarRegla, usaFrentes, VARIABLES_CONTEXTO, VARIABLES_FRENTES } from "../assets/js/reglas-expertas.js";
import { decodificarHistorico, contextosFrentesCasos } from "../scripts/aprendizaje/frentes-sombra.mjs";
import { terminosFrentes, recalcular } from "../scripts/aprendizaje/rejugar.mjs";
import { cambiosSeguros } from "../scripts/aprendizaje/ajuste.mjs";
import { prepararCasos } from "../scripts/aprendizaje/semanal.mjs";
import { panelReferencia, compararPaneles } from "../scripts/aprendizaje/deriva.mjs";

const DATOS = JSON.parse(readFileSync("assets/datos/especies.json", "utf8"));
const X = JSON.parse(readFileSync("test/fixtures/frentes-mini.json", "utf8"));
const D = X.frentes;
const BYTES = Uint8Array.from(Buffer.from(D.datos, "base64"));
const REGLAS = DATOS.reglas_expertas.reglas;
const R = (id) => REGLAS.find((r) => r.id === id);
const FRENTES = ["frente_cerca_tunidos", "frente_clorofila_bonito", "clorofila_alta_submarina", "corriente_fuerte_fondo"];
const BORRASCA = "borde_borrasca_tunidos";
const sinReglas = (ids) => { const d = structuredClone(DATOS); d.reglas_expertas.reglas = d.reglas_expertas.reglas.filter((r) => !ids.includes(r.id)); return d; };

// Serie horaria de 5 días + 1 (hora 120 = "ahora"), como la del índice.
function serie({ fecha = "2026-08-15", presion0 = 1014, dPresion24 = 0, viento = 8, ola = 0.8, tempAgua = 20 } = {}) {
  const h = [];
  const t0 = Date.parse(`${fecha}T12:00:00Z`) - 120 * 3600e3;
  for (let i = 0; i <= 130; i++) {
    const t = new Date(t0 + i * 3600e3).toISOString();
    const p = i < 96 ? presion0 : presion0 + (dPresion24 * Math.min(24, i - 96)) / 24;
    h.push({ hora: `${t.slice(0, 13)}:00`, nivelMar: Math.sin(i / 2), ola, viento, vientoDir: 200, tempAgua, presion: p, lluvia: 0 });
  }
  return h;
}
const I = 120;
const ventana = (especieId, modalidad, horas, extra = {}, datos = DATOS) => calcularVentana(
  datos.especies.find((e) => e.id === especieId), datos.reglas_por_defecto, horas,
  { lat: 43.45, lon: -2.9, region: "cantabrico", modalidad, reglasModalidad: datos.reglas_por_modalidad, reglasExpertas: datos.reglas_expertas, soloIndice: I, ...extra },
)[I];
const termino = (r, id) => r.razones.find((x) => x.factor === `regla:${id}`);

// ---------------------------------------------------------------------------
test("frentes-indice: las reglas nuevas tienen la forma, la fuente (DOI) y el peso pequeño acordados", () => {
  const ctxVal = { fuentes: DATOS.fuentes, especies: DATOS.especies.map((e) => e.id), regiones: Object.keys(DATOS.regiones), grupos: DATOS.reglas_expertas.grupos_especies };
  const minCientifica = Math.min(...REGLAS.filter((r) => r.tipo === "cientifica" && !FRENTES.includes(r.id)).map((r) => r.confianza));
  for (const id of FRENTES) {
    const r = R(id);
    assert.ok(r, id);
    assert.deepEqual(validarRegla(r, ctxVal), [], id);
    assert.ok(usaFrentes(r), `${id} mira la capa de frentes`);
    assert.equal(r.tipo, "cientifica", id);
    assert.equal(r.confianza, minCientifica, `${id}: la confianza mínima de las reglas de fuente bibliográfica`);
    assert.equal(r.retirar_si_nulo, true, id);
    // ▲ / ▼ suaves: ni con la confianza al máximo que permite el ajuste
    // (+50 %) llega a 6 puntos cerca de 50 (▲▲ / ▼▼).
    const loMax = Math.abs(r.efecto.logodds) * r.confianza * 1.5;
    assert.ok(Math.abs(repartirAportes([loMax]).aportes[0]) < 6, `${id}: ${loMax}`);
    for (const f of [r.fuente, ...(r.fuentes_adicionales || [])]) {
      assert.ok(DATOS.fuentes[f], `${id}: fuente ${f}`);
      if (f !== "stoner_2004") assert.match(DATOS.fuentes[f].url, /^https:\/\/doi\.org\/10\./, `${id}: ${f} con DOI`);
      assert.doesNotMatch(DATOS.fuentes[f].licencia, /\bNC\b|no comercial/i, f);
    }
  }
  for (const v of VARIABLES_FRENTES) assert.ok(VARIABLES_CONTEXTO.includes(v), v);
  // Sin fuente no se añade: nada para caballa, jurel ni lubina en superficie.
  for (const id of FRENTES) for (const e of ["caballa", "jurel"]) assert.ok(!(R(id).ambito.especies || []).includes(e) || R(id).ambito.modalidades.includes("submarina"), `${id}/${e}`);
});

test("frentes-indice: contextoFrentes lee la capa como el aprendizaje (y sin capa todo es null)", () => {
  const [lat, lon] = [D.norte - 6 * D.paso, D.oeste + 6 * D.paso];
  const c = F.contextoFrentes(D, BYTES, lat, lon);
  const r = F.rasgosPunto(D, BYTES, lat, lon, { radioKm: F.RADIO_CONTEXTO_KM });
  assert.equal(c.frente_clorofila_km, r.frente_clorofila ? r.dist_frente_clorofila_km : F.SIN_FRENTE_KM);
  assert.ok(c.frente_km <= c.frente_clorofila_km);
  assert.equal(c.clorofila_nivel, r.nivel_clorofila);
  assert.equal(c.corriente_ms, null, "sin bytes de velocidad, sin corriente");
  const h = decodificarHistorico(X.historico);
  const ch = F.contextoFrentes(h.d, h.bytes, lat, lon, { vel: h.vel });
  assert.equal(typeof ch.corriente_ms, "number");
  assert.deepEqual(F.contextoFrentes(null, null, lat, lon), { frente_km: null, frente_clorofila_km: null, clorofila_nivel: null, corriente_ms: null });
  assert.equal(F.contextoFrentes(D, BYTES, 10, 10).frente_km, null, "fuera de la malla");
  // frentes.json del día: velocidad en base64 en la malla de los códigos.
  const C = JSON.parse(readFileSync("test/fixtures/corriente-mini.json", "utf8"));
  const v = F.bytesVelocidadDia(C.frentes ?? C, (b) => Uint8Array.from(Buffer.from(b, "base64")));
  assert.ok(v === null || v.length === (C.frentes ?? C).filas * (C.frentes ?? C).columnas);
});

test("frentes-indice: solo vale el día de la capa (o el siguiente)", () => {
  const f = { fecha: "2026-08-15", frente_km: 3, frente_clorofila_km: 3, clorofila_nivel: "alta", corriente_ms: 0.7 };
  assert.equal(frentesDelDia(f, "2026-08-15").frente_km, 3);
  assert.equal(frentesDelDia(f, "2026-08-16").frente_km, 3);
  assert.equal(frentesDelDia(f, "2026-08-17").frente_km, null);
  assert.equal(frentesDelDia(f, "2026-08-14").frente_km, null);
  assert.equal(frentesDelDia(null, "2026-08-15").clorofila_nivel, null);
});

test("frentes-indice: frente cerca suma ▲ a los túnidos en barco, en lenguaje llano; sin dato no resta nada", () => {
  const horas = serie({ fecha: "2026-07-10" });
  const fr = (km) => ({ frentes: { fecha: "2026-07-10", frente_km: km, frente_clorofila_km: km, clorofila_nivel: "moderada", corriente_ms: 0.1 } });
  const cerca = ventana("atun_rojo", "embarcacion", horas, fr(4));
  const t = termino(cerca, "frente_cerca_tunidos");
  assert.ok(t && t.aporte > 0 && t.aporte < 6, JSON.stringify(t));
  assert.ok(Math.abs(t.lo - 0.3 * 0.4) < 1e-9);
  const u = paraUsuario(cerca.razones);
  const m = u.motivos.find((x) => x.texto === R("frente_cerca_tunidos").texto);
  assert.equal(m.flecha, "▲");
  assert.doesNotMatch(m.texto, /\d/, "sin números para el usuario");
  // De 10 a 20 km se apaga; a 20 km o más, nada.
  assert.ok(termino(ventana("atun_rojo", "embarcacion", horas, fr(15)), "frente_cerca_tunidos").lo < t.lo);
  assert.equal(termino(ventana("atun_rojo", "embarcacion", horas, fr(25)), "frente_cerca_tunidos"), undefined);
  assert.equal(termino(ventana("atun_rojo", "embarcacion", horas, fr(F.SIN_FRENTE_KM)), "frente_cerca_tunidos"), undefined);
  // Sin capa (o de otro día): ni término ni cambio en la nota ni en la cobertura.
  const base = ventana("atun_rojo", "embarcacion", horas, {}, sinReglas(FRENTES));
  for (const extra of [{}, { frentes: null }, { frentes: { fecha: "2026-07-01", frente_km: 2 } }]) {
    const r = ventana("atun_rojo", "embarcacion", horas, extra);
    assert.equal(termino(r, "frente_cerca_tunidos"), undefined);
    assert.equal(r.puntuacion, base.puntuacion);
    assert.equal(r.cobertura, base.cobertura, "la falta de capa no rebaja la fiabilidad");
  }
  // Desde costa no aplica nunca.
  assert.equal(termino(ventana("atun_rojo", "costa", horas, fr(2)), "frente_cerca_tunidos"), undefined);
});

test("frentes-indice: bonito solo con borde de clorofila y solo en agosto-septiembre", () => {
  const fr = (fecha, chl, km = 99) => ({ frentes: { fecha, frente_km: Math.min(chl, km), frente_clorofila_km: chl, clorofila_nivel: "moderada", corriente_ms: 0.1 } });
  assert.ok(termino(ventana("bonito_norte", "embarcacion", serie({ fecha: "2026-08-20" }), fr("2026-08-20", 5)), "frente_clorofila_bonito"));
  assert.equal(termino(ventana("bonito_norte", "embarcacion", serie({ fecha: "2026-07-20" }), fr("2026-07-20", 5)), "frente_clorofila_bonito"), undefined);
  // Solo frente térmico (Sagarminaga 2014: sin relación consistente): nada.
  const soloTermico = ventana("bonito_norte", "embarcacion", serie({ fecha: "2026-08-20" }), fr("2026-08-20", 99, 3));
  assert.equal(termino(soloTermico, "frente_clorofila_bonito"), undefined);
  assert.equal(termino(soloTermico, "frente_cerca_tunidos"), undefined, "el bonito no está en la regla general");
});

test("frentes-indice: clorofila alta resta ▼ en submarina; corriente fuerte resta ▼ a fondo en barco", () => {
  const horas = serie({ fecha: "2026-08-15" });
  const fr = (f) => ({ frentes: { fecha: "2026-08-15", frente_km: 99, frente_clorofila_km: 99, clorofila_nivel: "moderada", corriente_ms: 0.1, ...f } });
  const sub = ventana("sargo", "submarina", horas, fr({ clorofila_nivel: "alta" }));
  const t = termino(sub, "clorofila_alta_submarina");
  assert.ok(t && t.aporte < 0 && t.aporte > -6);
  assert.equal(paraUsuario(sub.razones).motivos.find((x) => x.texto === R("clorofila_alta_submarina").texto).flecha, "▼");
  assert.equal(termino(ventana("sargo", "submarina", horas, fr({ clorofila_nivel: "moderada" })), "clorofila_alta_submarina"), undefined);
  assert.equal(termino(ventana("sargo", "costa", horas, fr({ clorofila_nivel: "alta" })), "clorofila_alta_submarina"), undefined);
  const fondo = ventana("congrio", "embarcacion", horas, fr({ corriente_ms: 0.6 }));
  assert.ok(termino(fondo, "corriente_fuerte_fondo").aporte < 0);
  assert.equal(termino(ventana("congrio", "embarcacion", horas, fr({ corriente_ms: 0.3 })), "corriente_fuerte_fondo"), undefined);
  assert.equal(termino(ventana("congrio", "costa", horas, fr({ corriente_ms: 0.9 })), "corriente_fuerte_fondo"), undefined);
});

test("frentes-indice: borde de borrasca (regla de Mikel) suma a los túnidos en barco, nunca con mar peligroso ni en el núcleo", () => {
  const r = R(BORRASCA);
  assert.equal(r.fuente, "mikel_experiencia_local");
  assert.equal(r.tipo, "heuristica_experta_local");
  assert.equal(r.confianza, 0.6);
  assert.deepEqual(r.ambito.modalidades, ["embarcacion"]);
  assert.deepEqual(r.ambito.especies, ["bonito_norte", "atun_rojo", "bacoreta"]);
  assert.ok(Math.abs(repartirAportes([r.efecto.logodds * r.confianza]).aportes[0]) < 6, "▲, no ▲▲");
  const borde = { fecha: "2026-08-15", presion0: 1014, dPresion24: -5, viento: 20, ola: 1.2 };
  const t = termino(ventana("bonito_norte", "embarcacion", serie(borde)), BORRASCA);
  assert.ok(t && t.aporte > 0, "borde de borrasca: suma");
  const u = paraUsuario(ventana("bonito_norte", "embarcacion", serie(borde)).razones).motivos.find((x) => x.texto === r.texto);
  assert.equal(u.flecha, "▲");
  assert.equal(r.texto, "borde de borrasca: suele mover a los túnidos");
  const no = (cambio, motivo) => assert.equal(termino(ventana("bonito_norte", "embarcacion", serie({ ...borde, ...cambio })), BORRASCA), undefined, motivo);
  no({ ola: 3 }, "mar peligroso: nunca");
  no({ viento: 40 }, "viento de temporal (núcleo)");
  no({ viento: 5 }, "calma: no es una borrasca");
  no({ dPresion24: 0 }, "presión estable");
  no({ dPresion24: -14 }, "bajada explosiva: el núcleo encima");
  no({ presion0: 1000 }, "presión ya por debajo de 1000 hPa");
  // El aviso de ola peligrosa sigue saliendo aparte.
  assert.ok(ventana("bonito_norte", "embarcacion", serie({ ...borde, ola: 3 })).avisoOla);
  // Solo embarcación y solo túnidos.
  assert.equal(termino(ventana("bonito_norte", "costa", serie(borde)), BORRASCA), undefined);
  assert.equal(termino(ventana("caballa", "embarcacion", serie(borde)), BORRASCA), undefined);
});

test("frentes-indice: el panel fijo de escenarios no se mueve sin señal de frentes (y poco con todas a la vez)", () => {
  // Sin la regla de borrasca en los dos lados: solo cuentan las de frentes.
  const sin = sinReglas([...FRENTES, BORRASCA]);
  const sinBorr = sinReglas([BORRASCA]);
  // Escenarios sin capa (como el panel del aprendizaje): nada.
  assert.equal(compararPaneles(panelReferencia(sin), panelReferencia(sinBorr)).max_abs, 0);
  // Con capa pero sin frente, clorofila moderada y corriente floja: nada.
  const sinSenal = (e) => ({ frentes: { fecha: e.fecha, frente_km: 99, frente_clorofila_km: 99, clorofila_nivel: "moderada", corriente_ms: 0.1 } });
  assert.equal(compararPaneles(panelReferencia(sin, { contexto: sinSenal }), panelReferencia(sinBorr, { contexto: sinSenal })).max_abs, 0);
  // Todas las señales a la vez en todos los escenarios: ≤ 3 de media, ≤ 5 en alguno.
  const todo = (e) => ({ frentes: { fecha: e.fecha, frente_km: 2, frente_clorofila_km: 2, clorofila_nivel: "alta", corriente_ms: 0.9 } });
  const c = compararPaneles(panelReferencia(sin, { contexto: todo }), panelReferencia(sinBorr, { contexto: todo }));
  assert.ok(c.media_abs <= 3 && c.max_abs <= 5, JSON.stringify(c));
  // La regla de borrasca, con el panel de siempre: dentro de las barreras del ajuste.
  const b = compararPaneles(panelReferencia(sinReglas([BORRASCA])), panelReferencia(DATOS));
  assert.ok(b.media_abs <= 3 && b.max_abs <= 10, JSON.stringify(b));
});

test("frentes-indice: el aprendizaje rejuega las reglas de frentes con la capa del día de cada salida", () => {
  const caso = { ref: "c1", fecha: "2026-07-10", hora: 12, lat: 43.45, lon: -2.9, modalidad: "embarcacion", region: "cantabrico" };
  const fr = { fecha: "2026-07-10", frente_km: 3, frente_clorofila_km: 3, clorofila_nivel: "moderada", corriente_ms: 0.1 };
  assert.deepEqual(terminosFrentes(DATOS, caso, fr, "atun_rojo"), [{ u: "regla:frente_cerca_tunidos", lo: 0.12 }]);
  assert.deepEqual(terminosFrentes(DATOS, caso, null, "atun_rojo"), []);
  assert.deepEqual(terminosFrentes(DATOS, caso, { ...fr, fecha: "2026-07-01" }, "atun_rojo"), [], "capa de otro día");
  // Casos con solo los términos que guardó el diario: se añaden (sin duplicar).
  const base = { ...caso, guardado: { p: 0.5, especie: "atun_rojo", terminos: [{ u: "luz", lo: 0.1 }], ranking: [] } };
  const extras = { frentesPorRef: new Map([["c1", fr]]) };
  const { casos } = prepararCasos([base], { datos: DATOS, extras });
  assert.deepEqual(casos[0].terminos.map((t) => t.u), ["luz", "regla:frente_cerca_tunidos"]);
  const dup = { ...base, guardado: { ...base.guardado, terminos: [{ u: "regla:frente_cerca_tunidos", lo: 0.12 }] } };
  assert.equal(prepararCasos([dup], { datos: DATOS, extras }).casos[0].terminos.length, 1);
  // Con serie: recalcular() pasa la capa al índice.
  const s = serie({ fecha: "2026-07-10" });
  const con = recalcular(DATOS, caso, s, extras);
  const sinCapa = recalcular(DATOS, caso, s, {});
  assert.ok(con.terminos.some((t) => t.u === "regla:frente_cerca_tunidos") || con.especie !== "atun_rojo");
  assert.ok(!sinCapa.terminos.some((t) => t.u === "regla:frente_cerca_tunidos"));
  // Contexto de cada caso a partir del histórico decodificado.
  const h = decodificarHistorico(X.historico);
  const [lat, lon] = [D.norte - 6 * D.paso, D.oeste + 6 * D.paso];
  const m = contextosFrentesCasos([{ ref: "a", fecha: "2026-10-09", lat, lon }, { ref: "b", fecha: "2026-01-01", lat, lon }], new Map([["2026-10-09", h]]));
  assert.equal(m.get("a").fecha, "2026-10-09");
  assert.ok(!m.has("b"), "sin capa ese día: no entra");
});

test("frentes-indice: con barreras cumplidas, signo contrario o efecto nulo → propuesta de retirarla (nunca cambia el signo sola)", () => {
  const u = "regla:frente_cerca_tunidos";
  const est = new Map([[u, { n: 60, usuarios: new Set(["a", "b", "c", "d", "e", "f"]) }]]);
  const totales = { n: 200, positivos: 80, negativos: 120 };
  const llamar = (m, sd) => cambiosSeguros({ ajuste: { [u]: { m, sd } }, estadisticas: est, datos: DATOS, totales });
  const contrario = llamar(-0.5, 0.3);
  assert.equal(contrario.a_preguntar[0].tipo, "retirar");
  assert.equal(contrario.automaticos.length, 0);
  const nulo = llamar(0.5, 0.3);
  assert.equal(nulo.a_preguntar[0]?.tipo, "retirar", "efecto nulo: se propone desactivarla");
  assert.match(nulo.a_preguntar[0].motivo, /efecto nulo/);
  // Si los datos la apoyan: sube la confianza con los límites (±20 %/semana).
  const apoya = llamar(1.6, 0.2);
  assert.equal(apoya.automaticos[0].tipo, "confianza");
  assert.equal(apoya.automaticos[0].propuesto, 0.48);
  // La regla de Mikel no lleva retirar_si_nulo: con efecto dudoso solo baja la confianza.
  const ub = `regla:${BORRASCA}`;
  const r = cambiosSeguros({ ajuste: { [ub]: { m: 0.5, sd: 0.3 } }, estadisticas: new Map([[ub, est.get(u)]]), datos: DATOS, totales });
  assert.equal(r.automaticos[0].tipo, "confianza");
  assert.ok(r.automaticos[0].propuesto > 0);
});

test("frentes-indice: histórico hacia atrás en descargar-capas.py y en el workflow, y lectura en index.html", () => {
  const py = readFileSync("scripts/fuentes/descargar-capas.py", "utf8");
  assert.match(py, /def construir_frentes\(/);
  assert.match(py, /--desde/);
  assert.match(py, /--existentes-url/);
  assert.match(py, /--max-minutos/);
  // El diario y el histórico usan el mismo cálculo.
  assert.equal((py.match(/calcular_frentes\(chl, obs, temp, u, v, lats, previos=previos\)/g) || []).length, 1);
  assert.match(py, /if a\.desde:\s+historico\(a\)\s+return/);
  const wf = readFileSync(".github/workflows/fuentes-gratuitas.yml", "utf8");
  assert.match(wf, /historico_frentes:/);
  assert.match(wf, /inputs\.parte == 'historico_frentes'/);
  assert.match(wf, /descargar-capas\.py --salida \/tmp\/historico/);
  assert.match(wf, /--existentes-url https:\/\/imncbmizxkorotpeisic\.supabase\.co\/storage\/v1\/object\/public\/fuentes-gratuitas\/capas\/historico\//);
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /frentes: dia === 0 \? frentesDeSpot\(s, modalidad\) : null/);
  assert.match(html, /const MODALIDADES_FRENTES = new Set\(\["embarcacion", "submarina"\]\)/);
  assert.match(html, /cargarCapaMar\(CM, "frentes"\)/, "misma caché y misma petición que la capa del mapa");
  assert.match(html, /await frentesIndice\(modalidad\);/);
});
