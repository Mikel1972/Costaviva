// Tests del índice de pesca v2 (2026-10-08): escala logística, filtros duros,
// curva gaussiana de temperatura, motor de reglas expertas (ámbito, retardos,
// tendencias), las 5 reglas de Mikel, fiabilidad y las condiciones por fecha
// de las salidas del diario (Fase 0). Lógica pura: sin red, sin Supabase,
// sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sigmoide, repartirAportes, pesoLogOdds, factorTemperatura, calcularVentana, indiceSpot, fiabilidad,
  reglasParaModalidad, rioDeSpot, distanciaKm, INDICE_VERSION, VARIABLE_DE_FACTOR, avisoOlaPeligrosa,
  paraUsuario, TEXTO_INTERNO,
} from "../assets/js/ventana-actividad.js";
import {
  enSector, valorExpresion, evaluarCondicion, enAmbito, reglasEnAmbito, efectoRegla, validarRegla,
  iluminacionLunar, coeficienteMareaAstronomico,
} from "../assets/js/reglas-expertas.js";
import {
  planCondiciones, ventanasConsulta, indiceHoraSalida, horaRedondeada, lunaDeFecha, tendenciaPresion,
  serieHoraria, resumenIndice, diasEntre,
} from "../assets/js/condiciones-salida.js";
import { validarConsultaProxy } from "../functions/_lib/open-meteo.js";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const especie = (id) => DATOS.especies.find((e) => e.id === id);
const MUNDAKA = { lat: 43.4047, lon: -2.6989, slug: "mundaka" };
const VALENCIA = { lat: 39.47, lon: -0.33, slug: "valencia" };
const RIOS = [{
  rio: "Oka", spotCosta: "mundaka",
  puntos: [{ tramo: "Cabecera (Muxika)", lat: 43.2467, lon: -2.6733 }, { tramo: "Desembocadura (Urdaibai/Mundaka)", lat: 43.4055, lon: -2.6965 }],
}];

// Serie de `n` horas desde `inicio` (UTC usado como etiqueta local).
function serie(f = () => ({}), { inicio = Date.UTC(2026, 9, 3), n = 168 } = {}) {
  const h = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(inicio + i * 3600000);
    h.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.6 * Math.sin((2 * Math.PI * i) / 12.42), ola: 0.8, viento: 10, vientoDir: 0, tempAgua: 18,
      presion: 1016, lluvia: 0, ...f(i),
    });
  }
  return h;
}
const idx = (h, hora) => h.findIndex((x) => x.hora === hora);
const ctxBase = (extra = {}) => ({
  ...MUNDAKA, modalidad: "costa", reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas, ...extra,
});
const enHora = (id, horas, hora, extra = {}) => calcularVentana(especie(id), DATOS.reglas_por_defecto, horas, ctxBase(extra))[idx(horas, hora)];
const razon = (r, factor) => r.razones.find((x) => x.factor === factor);
const HOY = "2026-10-08T13:00";

// ---------------------------------------------------------------------------
// Escala logística
// ---------------------------------------------------------------------------
test("logística: σ(0) = 50 % y simetría", () => {
  assert.equal(sigmoide(0), 0.5);
  assert.ok(Math.abs(sigmoide(1) + sigmoide(-1) - 1) < 1e-12);
});

test("logística: los aportes en puntos suman exactamente P - 50 y conservan el signo", () => {
  for (const los of [[0.4, -0.2, 0.48], [1.2, 0.8, 0.6], [-0.9, -0.5, 0.1], [0, 0, 0], [2, -2, 0.01]]) {
    const r = repartirAportes(los);
    assert.equal(r.base, 50);
    assert.equal(r.aportes.reduce((s, x) => s + x, 0), r.puntuacion - 50, JSON.stringify(los));
    los.forEach((x, k) => { if (Math.abs(x) > 0.05) assert.ok(Math.sign(r.aportes[k]) === Math.sign(x), `${los}`); });
    assert.ok(r.puntuacion >= 0 && r.puntuacion <= 100);
  }
  // Cerca de 50, 1 log-odd ≈ 25 puntos (por eso peso_lo = puntos/25).
  assert.equal(repartirAportes([0.04]).puntuacion, 51);
  // Lejos de 50 se satura sin recortar.
  assert.ok(repartirAportes([10]).puntuacion <= 100);
});

test("pesos: todo en peso_lo (= puntos antiguos / 25); un `peso` antiguo se convierte", () => {
  const busca = (o) => Object.values(o || {}).filter((r) => r && typeof r === "object" && "peso" in r);
  assert.deepEqual(busca(DATOS.reglas_por_defecto), []);
  for (const m of Object.values(DATOS.reglas_por_modalidad)) assert.deepEqual(busca(m), []);
  for (const e of DATOS.especies) assert.deepEqual(busca(e.reglas), [], e.id);
  assert.equal(DATOS.reglas_por_defecto.luz.peso_lo, 0.4);
  assert.equal(DATOS.reglas_por_defecto.temperatura.peso_lo, 0.48);
  assert.equal(pesoLogOdds({ peso: 10 }), 0.4);
  assert.equal(pesoLogOdds({ peso_lo: 0.3, peso: 99 }), 0.3);
  // Override antiguo de una especie: manda sobre el peso_lo por defecto.
  const r = reglasParaModalidad(DATOS.reglas_por_defecto, { reglas: { marea: { peso: 20 } } }, "costa", DATOS.reglas_por_modalidad);
  assert.equal(r.marea.peso_lo, 0.8);
  assert.equal(r.marea.peso, undefined);
});

// Puntuaciones de la fórmula v1 (50 + Σ puntos) en la misma serie de
// test/ventana-actividad.test.js, sin reglas expertas: la v2 no debe mover
// las puntuaciones típicas más de unos pocos puntos.
const V1 = [
  ["lubina", "costa", [86, 86, 72, 74, 74, 82, 82, 88, 80, 68, 68, 82, 82, 82, 82, 68, 68, 68, 76, 88, 88, 74, 74, 74, 88, 88, 88, 74, 74, 74, 82, 88, 88, 68, 68, 68, 82, 82, 82, 68, 68, 68, 76, 88, 88, 82, 82, 82]],
  ["dorada", "costa", [82, 82, 66, 68, 68, 76, 76, 86, 78, 68, 68, 84, 84, 84, 84, 68, 68, 68, 76, 86, 86, 68, 68, 68, 84, 84, 84, 68, 68, 68, 76, 86, 86, 68, 68, 68, 84, 84, 84, 68, 68, 68, 76, 86, 86, 76, 76, 76]],
  ["calamar", "costa", [74, 74, 68, 70, 70, 73, 73, 69, 66, 57, 57, 63, 63, 63, 63, 57, 57, 57, 60, 75, 75, 70, 70, 70, 76, 76, 76, 70, 70, 70, 73, 69, 69, 57, 57, 57, 63, 63, 63, 57, 57, 57, 60, 75, 75, 73, 73, 73]],
  ["bonito_norte", "embarcacion", [70, 70, 70, 72, 72, 72, 72, 77, 77, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 77, 77, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 77, 77, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 77, 77, 72, 72, 72]],
  ["sargo", "submarina", [0, 0, 0, 0, 0, 0, 0, 0, 57, 53, 53, 53, 53, 53, 53, 53, 53, 53, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 54, 53, 53, 53, 53, 53, 53, 53, 53, 53, 50, 50, 0, 0, 0, 0]],
];
test("v2 frente a v1: sin cambios bruscos en las puntuaciones típicas (≤ 8 puntos)", () => {
  const s = serie((i) => ({ nivelMar: 1.8 * Math.sin((2 * Math.PI * i) / 12.42), ola: 1.0, viento: 10, tempAgua: 18, presion: 1015 - i * 0.2, vientoDir: null }),
    { inicio: Date.UTC(2026, 9, 7), n: 48 });
  // Mide solo el cambio de FÓRMULA: con los datos de antes de los ajustes de
  // evidencia que aprobó Mikel el 2026-10-08 (bonito 16-19 °C, presión por
  // defecto 0,24). Esos ajustes mueven la nota a propósito (test aparte).
  const defectoAntes = { ...DATOS.reglas_por_defecto, presion: { ...DATOS.reglas_por_defecto.presion, peso_lo: 0.24 } };
  const especieAntes = (id) => (id === "bonito_norte"
    ? { ...especie(id), temperatura_agua: { ...especie(id).temperatura_agua, rango: [16, 19], fuentes: ["app_index"], verificado: false } }
    : especie(id));
  for (const [id, modalidad, antes] of V1) {
    const r = calcularVentana(especieAntes(id), defectoAntes, s, { lat: 43.40, lon: -2.70, modalidad, reglasModalidad: DATOS.reglas_por_modalidad });
    r.forEach((x, i) => assert.ok(Math.abs(x.puntuacion - antes[i]) <= 8, `${id}/${modalidad} ${x.hora}: ${antes[i]} -> ${x.puntuacion}`));
  }
});

// ---------------------------------------------------------------------------
// Temperatura gaussiana
// ---------------------------------------------------------------------------
test("temperatura: gaussiana alrededor del óptimo, σ = media anchura del rango", () => {
  assert.ok(Math.abs(factorTemperatura(16, [8, 24]) - 1) < 1e-9);
  const borde = factorTemperatura(24, [8, 24]);
  assert.ok(borde > 0.15 && borde < 0.25, `borde ${borde}`);
  assert.ok(Math.abs(factorTemperatura(8, [8, 24]) - borde) < 1e-9, "simétrica");
  assert.ok(factorTemperatura(40, [8, 24]) < -0.9);
  let prev = 2;
  for (let t = 16; t <= 34; t += 1) { const f = factorTemperatura(t, [8, 24]); assert.ok(f < prev); prev = f; }
  // Rango estrecho (bonito 16-19): a 3 °C del borde ya resta casi entero.
  assert.ok(factorTemperatura(22, [16, 19]) < -0.8);
});

test("temperatura: un rango de fuente NC (FishBase) sigue sin puntuar", () => {
  const r = enHora("sargo", serie(), HOY);
  const t = razon(r, "temperatura");
  assert.ok(t && t.aporte === 0 && /pendiente/.test(t.texto));
});

// ---------------------------------------------------------------------------
// Filtros duros
// ---------------------------------------------------------------------------
test("filtro: una especie en veda no entra en el índice del spot", () => {
  // Abadejo en marzo en el Cantábrico: veda recreativa.
  const s = serie(() => ({}), { inicio: Date.UTC(2026, 2, 3) });
  const ind = indiceSpot(DATOS, s, idx(s, "2026-03-08T13:00"), { ...MUNDAKA, modalidad: "costa" });
  assert.ok(!ind.ranking.some((x) => x.id === "abadejo"));
  // En octubre sí entra.
  const o = indiceSpot(DATOS, serie(), idx(serie(), HOY), { ...MUNDAKA, modalidad: "costa" });
  assert.ok(o.ranking.some((x) => x.id === "abadejo"));
});

test("filtro: la freza avisa (devuélvelo) y nunca suma", () => {
  const s = serie(() => ({ tempAgua: 13 }), { inicio: Date.UTC(2026, 1, 3) });
  const i = idx(s, "2026-02-08T13:00");
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, s, ctxBase())[i];
  assert.ok(!r.razones.some((x) => /freza/i.test(x.texto) && x.aporte > 0));
  const ind = indiceSpot(DATOS, s, i, { ...MUNDAKA, modalidad: "costa" });
  if (ind.especie.id === "lubina") assert.match(ind.freza.texto, /devu[eé]lvelo/);
  // La fórmula no tiene ningún factor de freza.
  assert.ok(!("freza" in DATOS.reglas_por_defecto));
});

// Ola peligrosa (decisión de Mikel, 2026-10-08): fuera de la nota. Antes,
// "tope de seguridad (mar de 3-3,5 m, peligrosa desde costa: máximo 20)".
test("ola peligrosa: la nota no tiene tope por ola y la suma sigue cuadrando", () => {
  const s = serie(() => ({ ola: 3.2 }));
  for (const id of ["lubina", "calamar", "sargo"]) {
    const r = enHora(id, s, HOY);
    assert.ok(r.marPeligrosa && r.avisoOla, id);
    assert.ok(!razon(r, "tope"), `${id}: sin motivo de tope`);
    assert.equal(50 + r.razones.reduce((a, x) => a + x.aporte, 0), r.puntuacion, id);
  }
  // La lubina desde costa con 3,2 m: el factor de oleaje lo sustituyen las
  // reglas de mar movida (que no llegan a 3,2 m), así que la nota es la de
  // los demás factores, muy por encima del antiguo tope de 20.
  assert.ok(enHora("lubina", s, HOY).puntuacion > 20);
  // Misma nota que si la regla de oleaje no tuviera umbral de aviso con el
  // factor saturado a -1 (lo que pasa por encima de max_seguro_m).
  const sinAviso = structuredClone(DATOS.reglas_por_defecto);
  sinAviso.oleaje.max_seguro_m = 1.6; // -(3,2-1,5)/0,1 => satura en -1 igual que antes
  const calamar = enHora("calamar", s, HOY);
  const calamarSinAviso = calcularVentana(especie("calamar"), sinAviso, s, ctxBase())[idx(s, HOY)];
  assert.equal(calamar.puntuacion, calamarSinAviso.puntuacion);
});

test("ola peligrosa: aviso aparte, no es un motivo con flecha", () => {
  const r = enHora("calamar", serie(() => ({ ola: 3.2 })), HOY);
  assert.equal(r.avisoOla.texto, "⚠️ Ola peligrosa desde costa (3-3,5 m): extrema la precaución");
  assert.ok(!r.razones.some((x) => /peligros|precauci/i.test(x.texto)), "el aviso no está entre los motivos");
  assert.equal(razon(r, "oleaje").texto, "mar de 3-3,5 m");
  const ind = indiceSpot(DATOS, serie(() => ({ ola: 3.2 })), idx(serie(), HOY), { ...MUNDAKA, modalidad: "costa" });
  assert.equal(ind.avisoOla.texto, ind.resultado.avisoOla.texto);
  assert.equal(indiceSpot(DATOS, serie(), idx(serie(), HOY), { ...MUNDAKA, modalidad: "costa" }).avisoOla, null);
});

test("ola peligrosa: umbrales por modalidad (costa 2,5, embarcación 2,5, submarina 1,5), estrictamente por encima", () => {
  const umbrales = {
    costa: DATOS.reglas_por_defecto.oleaje,
    embarcacion: DATOS.reglas_por_modalidad.embarcacion.oleaje,
    submarina: DATOS.reglas_por_modalidad.submarina.oleaje,
  };
  assert.equal(umbrales.costa.max_seguro_m, 2.5);
  assert.equal(umbrales.embarcacion.max_seguro_m, 2.5);
  assert.equal(umbrales.submarina.max_seguro_m, 1.5);
  for (const o of Object.values(umbrales)) assert.ok(!("tope_si_peligrosa" in o), "ya no hay tope por ola");
  // Función pura, en el umbral y justo por encima.
  assert.equal(avisoOlaPeligrosa(2.5, umbrales.costa), null);
  assert.match(avisoOlaPeligrosa(2.51, umbrales.costa).texto, /^⚠️ Ola peligrosa desde costa \(2,5-3 m\): extrema la precaución$/);
  assert.equal(avisoOlaPeligrosa(2.5, umbrales.embarcacion), null);
  assert.match(avisoOlaPeligrosa(2.6, umbrales.embarcacion).texto, /^⚠️ Ola peligrosa para salir en embarcación de recreo \(2,5-3 m\)/);
  assert.equal(avisoOlaPeligrosa(1.5, umbrales.submarina), null);
  assert.match(avisoOlaPeligrosa(1.6, umbrales.submarina).texto, /^⚠️ Ola peligrosa para bucear \(1,5-2 m\)/);
  assert.equal(avisoOlaPeligrosa(null, umbrales.costa), null);
  // En el cálculo de cada modalidad.
  const casos = [["costa", 2.5, 2.6], ["embarcacion", 2.5, 2.6], ["submarina", 1.5, 1.6]];
  for (const [modalidad, en, encima] of casos) {
    const a = enHora("lubina", serie(() => ({ ola: en })), HOY, { modalidad });
    const b = enHora("lubina", serie(() => ({ ola: encima })), HOY, { modalidad });
    assert.equal(a.avisoOla, null, `${modalidad} ${en} m: sin aviso`);
    assert.ok(b.avisoOla && b.marPeligrosa, `${modalidad} ${encima} m: con aviso`);
    assert.ok(!razon(b, "tope"), `${modalidad}: sin tope por ola`);
  }
});

test("filtro: submarina de noche = 0", () => {
  const r = enHora("sargo", serie(), "2026-10-08T02:00", { modalidad: "submarina" });
  assert.equal(r.puntuacion, 0);
  assert.ok(r.prohibida);
});

test("sin especies de temporada con esa modalidad: S/D (null), nunca un número", () => {
  const s = serie(() => ({}), { inicio: Date.UTC(2026, 9, 3) });
  const ind = indiceSpot({ ...DATOS, especies: [] }, s, idx(s, HOY), { ...MUNDAKA, modalidad: "costa" });
  assert.equal(ind.puntuacion, null);
});

test("50 + la suma de los aportes mostrados da la puntuación (también con reglas expertas)", () => {
  const s = serie((i) => ({ presion: 1020 - Math.max(0, i - 114) * 0.5, ola: 1.8, vientoDir: 90, viento: 20 }));
  for (const id of ["lubina", "sargo", "calamar"]) {
    for (const r of calcularVentana(especie(id), DATOS.reglas_por_defecto, s, ctxBase())) {
      assert.equal(50 + r.razones.reduce((a, x) => a + x.aporte, 0), r.puntuacion, `${id} ${r.hora}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Motor de reglas expertas
// ---------------------------------------------------------------------------
test("reglas: todas las del JSON están bien formadas (fuente, ámbito, variables, confianza)", () => {
  const b = DATOS.reglas_expertas;
  assert.ok(b.reglas.length >= 8);
  const ids = new Set();
  for (const r of b.reglas) {
    assert.ok(!ids.has(r.id), `id repetido ${r.id}`); ids.add(r.id);
    assert.deepEqual(validarRegla(r, {
      fuentes: DATOS.fuentes, especies: DATOS.especies.map((e) => e.id), regiones: DATOS.regiones, grupos: b.grupos_especies,
    }), [], r.id);
  }
  // Las de Mikel: su fuente, tipo local y por validar.
  const deMikel = b.reglas.filter((r) => r.fuente === "mikel_experiencia_local");
  assert.ok(deMikel.length >= 8);
  for (const r of deMikel) {
    assert.equal(r.tipo, "heuristica_experta_local");
    assert.equal(r.estado, "por_validar");
    assert.ok(r.validacion);
  }
  assert.equal(DATOS.fuentes.mikel_experiencia_local.titulo, "Mikel (experiencia local de pesca)");
});

test("propuestas_evidencia: lo que queda, bien formado y SIN activar; el top 10, activado", () => {
  // Bloque de propuestas con fuente científica (2026-10-08). El índice no lo
  // lee. Mikel aprobó el top 10 (y presion_defecto_peso) el mismo día: están
  // en `activadas` y ya no en `reglas`/`ajustes`.
  const p = DATOS.propuestas_evidencia;
  assert.ok(p && p.estado === "pendiente_de_aprobacion");
  const fuentes = { ...DATOS.fuentes, ...p.fuentes };
  for (const [id, f] of Object.entries(p.fuentes)) {
    assert.ok(!DATOS.fuentes[id], `fuente de propuesta duplicada en fuentes: ${id}`);
    assert.match(f.url || "", /^https:\/\//, `${id} sin url`);
    assert.ok(f.licencia && f.fecha_consulta, `${id} sin licencia o fecha_consulta`);
  }
  const activas = new Set(DATOS.reglas_expertas.reglas.map((r) => r.id));
  const ids = new Set();
  for (const r of p.reglas) {
    assert.ok(!activas.has(r.id) && !ids.has(r.id), `id repetido ${r.id}`); ids.add(r.id);
    assert.equal(r.tipo, "cientifica");
    assert.equal(r.estado, "por_validar");
    for (const fx of r.fuentes_adicionales || []) assert.ok(fuentes[fx], `${r.id}: fuente desconocida ${fx}`);
    assert.deepEqual(validarRegla(r, {
      fuentes, especies: DATOS.especies.map((e) => e.id), regiones: DATOS.regiones, grupos: DATOS.reglas_expertas.grupos_especies,
    }), [], r.id);
  }
  for (const a of p.ajustes) {
    assert.ok(a.id && a.objetivo && a.motivo && fuentes[a.fuente], `ajuste ${a.id} incompleto`);
    ids.add(a.id);
  }
  const activadas = new Set(p.activadas.map((a) => a.id));
  assert.equal(p.top10.length, 10);
  for (const id of p.top10) {
    assert.ok(activadas.has(id), `top10: ${id} sin activar`);
    assert.ok(!ids.has(id), `top10: ${id} sigue también como propuesta`);
  }
  // Lo que no aprobó: sigue como propuesta.
  for (const id of ["lisa_rio_crecido", "levante_cantabrico_confianza", "calamar_luna_llena", "congrio_luna_cuartos", "sepia_fuente_temperatura"]) {
    assert.ok(ids.has(id) && !activadas.has(id), id);
  }
  assert.equal(DATOS.reglas_expertas.reglas.find((r) => r.id === "levante_cantabrico").confianza, 0.7);
  // Toda fuente citada por una regla activa está en `fuentes`.
  for (const r of DATOS.reglas_expertas.reglas) {
    for (const f of [r.fuente, ...(r.fuentes_adicionales || [])]) assert.ok(DATOS.fuentes[f], `${r.id}: ${f} no está en fuentes`);
  }
});

test("reglas: sector circular, también cruzando el norte", () => {
  assert.equal(enSector(90, [33.75, 146.25]), true);
  assert.equal(enSector(200, [33.75, 146.25]), false);
  assert.equal(enSector(350, [315, 45]), true);
  assert.equal(enSector(10, [315, 45]), true);
  assert.equal(enSector(180, [315, 45]), false);
  assert.equal(enSector(null, [0, 90]), null);
});

test("reglas: agregados con retardo y tendencia (delta, media, fracción) y sin dato -> null", () => {
  const h = serie((i) => ({ presion: 1000 + i, viento: i % 2 ? 30 : 10, vientoDir: i < 50 ? 270 : 90 }));
  assert.equal(valorExpresion({ var: "presion", agregado: "delta", desde_h: -6, hasta_h: 0 }, h, 100), 6);
  assert.equal(valorExpresion({ var: "presion", agregado: "delta", desde_h: -24, hasta_h: -6 }, h, 100), 18);
  assert.equal(valorExpresion({ var: "viento", agregado: "media", desde_h: -3, hasta_h: 0 }, h, 100), 20);
  assert.equal(valorExpresion({ var: "viento_dir", agregado: "fraccion", desde_h: -9, hasta_h: 0, cumple: { op: "sector", valor: [236.25, 326.25] } }, h, 55), 0.4);
  // Fracción con dos condiciones por hora (dirección Y fuerza).
  const f = valorExpresion({ var: "viento_dir", agregado: "fraccion", desde_h: -9, hasta_h: 0,
    cumple: [{ var: "viento_dir", op: "sector", valor: [236.25, 326.25] }, { var: "viento", op: ">=", valor: 25 }] }, h, 55);
  assert.equal(f, 0.2);
  // Ventana antes del inicio de la serie: sin dato.
  assert.equal(valorExpresion({ var: "presion", agregado: "delta", desde_h: -24, hasta_h: 0 }, h, 10), null);
  // Menos del 60 % de horas con dato: sin dato.
  const huecos = serie((i) => ({ presion: i % 3 ? null : 1010 }));
  assert.equal(valorExpresion({ var: "presion", agregado: "media", desde_h: -9, hasta_h: 0 }, huecos, 50), null);
  assert.equal(evaluarCondicion({ var: "caudal_rio", op: "==", valor: "alto" }, h, 5, {}), null);
  assert.throws(() => valorExpresion({ var: "inventada" }, h, 5));
});

test("reglas: ámbito por región, modalidad, especie, grupo, exclusión y mes", () => {
  const grupos = { costeros: { especies: ["lubina", "sargo"] } };
  const r = { ambito: { regiones: ["cantabrico"], modalidades: ["costa"], especies: ["@costeros"], especies_excluidas: ["sargo"], meses: [9, 10] } };
  const a = { especieId: "lubina", modalidad: "costa", region: "cantabrico", mes: 10 };
  assert.equal(enAmbito(r, a, grupos), true);
  assert.equal(enAmbito(r, { ...a, especieId: "sargo" }, grupos), false);
  assert.equal(enAmbito(r, { ...a, especieId: "calamar" }, grupos), false);
  assert.equal(enAmbito(r, { ...a, region: "mediterraneo" }, grupos), false);
  assert.equal(enAmbito(r, { ...a, modalidad: "embarcacion" }, grupos), false);
  assert.equal(enAmbito(r, { ...a, mes: 3 }, grupos), false);
  assert.equal(enAmbito({}, a), true, "sin ámbito: aplica a todo");
  // Una regla retirada no aplica.
  const { reglas } = reglasEnAmbito({ reglas: [{ id: "x", estado: "retirada" }, { id: "y", estado: "por_validar" }] }, a);
  assert.deepEqual(reglas.map((x) => x.id), ["y"]);
});

test("reglas: la confianza encoge el efecto y la escala lo gradúa", () => {
  const h = serie((i) => ({ presion: 1020 - i * 0.5 }));
  const r = {
    condiciones: [{ var: "presion", agregado: "delta", desde_h: -6, hasta_h: 0, op: "<=", valor: -1 }],
    efecto: { logodds: 1, escala: { var: "presion", agregado: "delta", desde_h: -6, hasta_h: 0, de: -1, a: -4, minimo: 0.3 } },
    confianza: 0.5,
  };
  const e = efectoRegla(r, h, 50);
  assert.ok(Math.abs(e.intensidad - 2 / 3) < 1e-9); // -3 hPa en 6 h
  assert.ok(Math.abs(e.lo - 1 / 3) < 1e-9);
  assert.equal(efectoRegla({ ...r, condiciones: [{ ...r.condiciones[0], valor: -5 }] }, h, 50), null);
});

test("reglas: un factor sustituido no se cuenta dos veces", () => {
  const s = serie((i) => ({ presion: 1020 - Math.max(0, i - 114) * 0.5 }));
  const lubina = enHora("lubina", s, HOY);
  assert.ok(!razon(lubina, "presion"), "la presión de 3 h la sustituyen las reglas de Mikel");
  // El calamar no está en el grupo: conserva el factor por defecto.
  const calamar = enHora("calamar", s, HOY);
  assert.ok(razon(calamar, "presion"));
  assert.ok(!calamar.razones.some((x) => x.factor.startsWith("regla:presion")));
});

// ---------------------------------------------------------------------------
// Las 5 reglas de Mikel
// ---------------------------------------------------------------------------
test("Mikel 1: presión bajando (6 h y 24 h) suma a los depredadores costeros; subiendo tras el frente resta", () => {
  const baja = serie((i) => ({ presion: 1020 - Math.max(0, i - 114) * 0.5 })); // -3 hPa en 6 h, -5 en 24 h
  const r = enHora("lubina", baja, HOY);
  assert.ok(razon(r, "regla:presion_bajando_6h").aporte > 0);
  // Excluyentes: si está cayendo ahora, la de 24 h no suma otra vez.
  assert.ok(!razon(r, "regla:presion_bajando_24h"));
  // Caída lenta: -5 hPa en 24 h pero quieta en las últimas 6 h -> la de 24 h.
  const i24 = idx(serie(), HOY);
  const lenta = serie((i) => ({ presion: i <= i24 - 24 ? 1020 : i <= i24 - 6 ? 1020 - (i - (i24 - 24)) * (5 / 18) : 1015 }));
  const rl = enHora("lubina", lenta, HOY);
  assert.ok(razon(rl, "regla:presion_bajando_24h").aporte > 0);
  assert.ok(!razon(rl, "regla:presion_bajando_6h"));
  const estable = enHora("lubina", serie(), HOY);
  assert.ok(r.puntuacion > estable.puntuacion);
  // Tras el frente: bajó 4 hPa entre -24 h y -6 h y ahora sube 2 en 6 h.
  const i0 = idx(serie(), HOY);
  const tras = serie((i) => ({ presion: i < i0 - 24 ? 1012 : i <= i0 - 6 ? 1012 - (i - (i0 - 24)) * (4 / 18) : 1008 + (i - (i0 - 6)) / 3 }));
  const rt = enHora("lubina", tras, HOY);
  assert.ok(razon(rt, "regla:presion_subiendo_tras_frente").aporte < 0);
  // No aplica en submarina (ámbito costa/embarcación).
  assert.ok(!razon(enHora("lubina", baja, HOY, { modalidad: "submarina" }), "regla:presion_bajando_6h"));
});

test("Mikel 2: mar algo movida (1-2,5 m) suma desde costa, y por encima avisa de ola peligrosa", () => {
  const r = enHora("sargo", serie(() => ({ ola: 1.8 })), HOY);
  assert.ok(razon(r, "regla:mar_movida_depredadores_costa").aporte > 0);
  // Sustituye al factor de oleaje: un solo motivo de ola (antes salían
  // "+ mar algo movida" y "− mar de 2-2,5 m" a la vez, visto por Mikel).
  const r2 = enHora("lubina", serie(() => ({ ola: 2.2 })), HOY);
  assert.equal(r2.razones.filter((x) => x.variable === "ola").length, 1);
  assert.ok(!razon(r2, "oleaje"));
  // El resto de la escala, también con un solo motivo.
  assert.ok(razon(enHora("lubina", serie(() => ({ ola: 0.7 })), HOY), "regla:mar_poca_depredadores_costa").aporte > 0);
  assert.ok(razon(enHora("lubina", serie(() => ({ ola: 0.2 })), HOY), "regla:mar_plana_depredadores_costa").aporte < 0);
  // Otras especies desde costa y los depredadores en embarcación: factor base.
  assert.ok(razon(enHora("calamar", serie(() => ({ ola: 2.2 })), HOY), "oleaje"));
  assert.ok(razon(enHora("lubina", serie(() => ({ ola: 2.2 })), HOY, { modalidad: "embarcacion" }), "oleaje"));
  assert.ok(!razon(enHora("sargo", serie(() => ({ ola: 0.4 })), HOY), "regla:mar_movida_depredadores_costa"));
  assert.ok(!razon(enHora("sargo", serie(() => ({ ola: 1.8 })), HOY, { modalidad: "embarcacion" }), "regla:mar_movida_depredadores_costa"));
  const peligro = enHora("lubina", serie(() => ({ ola: 2.8 })), HOY);
  assert.ok(peligro.marPeligrosa && peligro.avisoOla, "el aviso va aparte aunque el factor esté sustituido");
  assert.match(peligro.avisoOla.texto, /Ola peligrosa desde costa \(2,5-3 m\)/);
  assert.ok(!razon(peligro, "tope"), "la ola ya no pone tope");
  assert.ok(!razon(peligro, "regla:mar_movida_depredadores_costa"));
});

test("Mikel 3: río crecido: la lubina se arrima a la desembocadura, el resto se aparta; sin río, nada", () => {
  const rio = rioDeSpot(MUNDAKA, RIOS);
  assert.equal(rio.nombre, "Oka");
  assert.ok(rio.distancia_desembocadura_km < 1);
  assert.equal(rioDeSpot({ slug: "otro", lat: 43, lon: -3 }, RIOS), null);
  assert.ok(Math.abs(distanciaKm(43, -3, 43.1, -3) - 11.12) < 0.05);
  const s = serie();
  const lub = enHora("lubina", s, HOY, { caudalRio: "alto", rio });
  assert.ok(razon(lub, "regla:rio_crecido_lubina_desembocadura").aporte > 0);
  assert.ok(!razon(lub, "regla:rio_crecido_salinidad_resto"));
  const sargo = enHora("sargo", s, HOY, { caudalRio: "alto", rio });
  assert.ok(razon(sargo, "regla:rio_crecido_salinidad_resto").aporte < 0);
  // Caudal normal: nada. Spot sin río conocido: nada, y queda como "sin dato".
  assert.ok(!razon(enHora("lubina", s, HOY, { caudalRio: "normal", rio }), "regla:rio_crecido_lubina_desembocadura"));
  const sinRio = enHora("lubina", s, HOY, { caudalRio: "alto", rio: null });
  assert.ok(!razon(sinRio, "regla:rio_crecido_lubina_desembocadura"));
  assert.ok(sinRio.sinDato.includes("rio_crecido_lubina_desembocadura"));
  // Lejos de la desembocadura (> 3 km): nada.
  assert.ok(!razon(enHora("lubina", s, HOY, { caudalRio: "alto", rio: { nombre: "x", distancia_desembocadura_km: 8 } }), "regla:rio_crecido_lubina_desembocadura"));
});

test("Mikel 4: levante (NE-E-SE) resta en el Cantábrico, no en el Mediterráneo ni con calma", () => {
  const este = serie(() => ({ vientoDir: 90, viento: 20 }));
  const r = enHora("lubina", este, HOY);
  assert.ok(razon(r, "regla:levante_cantabrico").aporte < 0);
  assert.ok(r.puntuacion < enHora("lubina", serie(() => ({ vientoDir: 300, viento: 20 })), HOY).puntuacion);
  for (const dir of [40, 135]) assert.ok(razon(enHora("lubina", serie(() => ({ vientoDir: dir, viento: 20 })), HOY), "regla:levante_cantabrico"), `${dir}°`);
  assert.ok(!razon(enHora("lubina", serie(() => ({ vientoDir: 200, viento: 20 })), HOY), "regla:levante_cantabrico"));
  assert.ok(!razon(enHora("lubina", serie(() => ({ vientoDir: 90, viento: 3 })), HOY), "regla:levante_cantabrico"), "calma");
  const med = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, este, ctxBase({ ...VALENCIA }))[idx(este, HOY)];
  assert.ok(!razon(med, "regla:levante_cantabrico"));
});

test("Mikel 5: bonito, 1-5 días después de temporales del oeste en verano (embarcación, Cantábrico)", () => {
  const inicio = Date.UTC(2026, 7, 10);
  const tranquilo = serie(() => ({ tempAgua: 18 }), { inicio });
  const temporal = serie((i) => (i < 72 ? { viento: 35, vientoDir: 280, tempAgua: 18 } : { tempAgua: 18 }), { inicio });
  const hora = "2026-08-15T13:00";
  const ctx = { modalidad: "embarcacion" };
  const r = enHora("bonito_norte", temporal, hora, ctx);
  assert.ok(razon(r, "regla:bonito_temporales_oeste").aporte > 0);
  assert.ok(r.puntuacion > enHora("bonito_norte", tranquilo, hora, ctx).puntuacion);
  // Confianza baja: efecto pequeño (menos de 6 puntos).
  assert.ok(razon(r, "regla:bonito_temporales_oeste").aporte <= 6);
  // Temporal de hoy (no de hace 1-5 días): no cuenta.
  const hoyMismo = serie((i) => (i >= 110 ? { viento: 35, vientoDir: 280 } : {}), { inicio });
  assert.ok(!razon(enHora("bonito_norte", hoyMismo, hora, ctx), "regla:bonito_temporales_oeste"));
  // Fuera de junio-septiembre, no.
  const oct = serie((i) => (i < 72 ? { viento: 35, vientoDir: 280 } : {}));
  assert.ok(!razon(enHora("bonito_norte", oct, HOY, ctx), "regla:bonito_temporales_oeste"));
  // Sin los días previos en la serie: sin dato, no aplica.
  const corta = serie(() => ({}), { inicio: Date.UTC(2026, 7, 15), n: 24 });
  const rc = enHora("bonito_norte", corta, hora, ctx);
  assert.ok(rc.sinDato.includes("bonito_temporales_oeste"));
});


// ---------------------------------------------------------------------------
// Luna y coeficiente de marea (astronomía local, sin red)
// ---------------------------------------------------------------------------
test("luna: fracción iluminada con fechas conocidas (llena 26-10-2026, nueva 10-10-2026, cuarto 18-10-2026)", () => {
  assert.ok(iluminacionLunar(Date.UTC(2026, 9, 26, 4, 12)) > 0.99);
  assert.ok(iluminacionLunar(Date.UTC(2026, 9, 10, 15, 50)) < 0.01);
  assert.ok(Math.abs(iluminacionLunar(Date.UTC(2026, 9, 18, 16, 13)) - 0.5) < 0.03);
  assert.ok(iluminacionLunar(Date.UTC(2026, 10, 24, 15)) > 0.99, "llena del 24-11-2026");
  // Coherente con la fase de la app (faseLunar) el día de la llena.
  assert.ok(iluminacionLunar(Date.UTC(2026, 9, 26, 6)) > 0.98);
});

test("coeficiente de marea: reales de sept. 2026 (±5), vivas en nueva/llena, muertas en cuartos, escala 20-120", () => {
  const reales = { 5: 42, 6: 51, 7: 66, 8: 80, 9: 92, 10: 100 }; // CALIBRACION.jsonl (tides4fishing, igual en todos los puertos)
  for (const [d, v] of Object.entries(reales)) {
    const c = coeficienteMareaAstronomico(Date.UTC(2026, 8, Number(d), 12));
    assert.ok(Math.abs(c - v) <= 5, `${d}-9: ${c} frente a ${v}`);
  }
  const c = (m, d) => coeficienteMareaAstronomico(Date.UTC(2026, m - 1, d, 12));
  assert.ok(c(10, 11) >= 90 && c(10, 27) >= 100, "vivas tras la nueva (10-10) y la llena (26-10)");
  assert.ok(c(10, 4) < 50 && c(10, 19) < 40, "muertas tras los cuartos");
  for (let d = 0; d < 400; d++) {
    const x = coeficienteMareaAstronomico(Date.UTC(2026, 0, 1) + d * 86400000);
    assert.ok(Number.isInteger(x) && x >= 20 && x <= 120);
  }
});

// ---------------------------------------------------------------------------
// Ajustes de evidencia aprobados por Mikel (2026-10-08) y reglas nuevas
// ---------------------------------------------------------------------------
const regla = (id) => DATOS.reglas_expertas.reglas.find((r) => r.id === id);

test("evidencia: presión con menos confianza y la mitad de peso por defecto; rangos del bonito y del pulpo", () => {
  assert.deepEqual(["presion_bajando_6h", "presion_bajando_24h", "presion_subiendo_tras_frente"].map((id) => regla(id).confianza), [0.4, 0.35, 0.3]);
  assert.equal(DATOS.reglas_por_defecto.presion.peso_lo, 0.12);
  assert.deepEqual(especie("bonito_norte").temperatura_agua.rango, [16, 18]);
  assert.deepEqual(especie("pulpo").temperatura_agua.rango, [16, 21]);
  // El pulpo ya puntúa la temperatura: con 18,5 °C suma, con 12 °C resta.
  assert.ok(razon(enHora("pulpo", serie(() => ({ tempAgua: 18.5 })), HOY), "temperatura").aporte > 0);
  assert.ok(razon(enHora("pulpo", serie(() => ({ tempAgua: 12 })), HOY), "temperatura").aporte < 0);
});

test("evidencia 1 y 7: río crecido: los cefalópodos con regla propia y más fuerte; la dorada ya no resta", () => {
  const rio = rioDeSpot(MUNDAKA, RIOS), s = serie(), ctx = { caudalRio: "alto", rio };
  for (const id of ["pulpo", "sepia", "calamar"]) {
    const r = enHora(id, s, HOY, ctx);
    assert.ok(razon(r, "regla:rio_crecido_cefalopodos").aporte < 0, id);
    assert.ok(!razon(r, "regla:rio_crecido_salinidad_resto"), id);
  }
  const sargo = razon(enHora("sargo", s, HOY, ctx), "regla:rio_crecido_salinidad_resto");
  assert.ok(Math.abs(razon(enHora("pulpo", s, HOY, ctx), "regla:rio_crecido_cefalopodos").lo) > Math.abs(sargo.lo));
  const dorada = enHora("dorada", s, HOY, ctx);
  assert.ok(!dorada.razones.some((x) => x.factor.startsWith("regla:rio_crecido")));
  assert.ok(!razon(enHora("pulpo", s, HOY, { caudalRio: "normal", rio }), "regla:rio_crecido_cefalopodos"));
});

test("evidencia 10: lluvia fuerte (≥ 40 mm en 48 h) aleja al pulpo y la sepia", () => {
  const i0 = idx(serie(), HOY);
  const lluvia = serie((i) => ({ lluvia: i > i0 - 48 && i <= i0 ? 1.5 : 0 })); // 72 mm
  for (const id of ["pulpo", "sepia"]) assert.ok(razon(enHora(id, lluvia, HOY), "regla:lluvia_fuerte_pulpo").aporte < 0, id);
  assert.ok(!razon(enHora("lubina", lluvia, HOY), "regla:lluvia_fuerte_pulpo"));
  const poca = serie((i) => ({ lluvia: i > i0 - 48 && i <= i0 ? 0.5 : 0 })); // 24 mm
  assert.ok(!razon(enHora("pulpo", poca, HOY), "regla:lluvia_fuerte_pulpo"));
});

test("evidencia 6: agua enfriada de golpe (≥ 1,5 °C en 48 h) resta a los depredadores costeros", () => {
  const i0 = idx(serie(), HOY);
  const frio = serie((i) => ({ tempAgua: i <= i0 - 48 ? 18 : 18 - ((i - (i0 - 48)) / 48) * 2.5 }));
  assert.ok(razon(enHora("lubina", frio, HOY), "regla:enfriamiento_brusco_agua").aporte < 0);
  assert.ok(razon(enHora("sargo", frio, HOY, { modalidad: "embarcacion" }), "regla:enfriamiento_brusco_agua").aporte < 0);
  assert.ok(!razon(enHora("calamar", frio, HOY), "regla:enfriamiento_brusco_agua"));
  assert.ok(!razon(enHora("lubina", serie(), HOY), "regla:enfriamiento_brusco_agua"));
});

test("evidencia 3 y 5: bonito: resta con mar muy agitada la víspera; el oeste solo suma ya calmado", () => {
  const inicio = Date.UTC(2026, 7, 10), hora = "2026-08-15T13:00", ctx = { modalidad: "embarcacion" };
  const i0 = idx(serie(() => ({}), { inicio }), hora);
  const agitada = serie((i) => ({ tempAgua: 17, ola: i >= i0 - 36 && i <= i0 - 6 ? 3 : 1 }), { inicio });
  assert.ok(razon(enHora("bonito_norte", agitada, hora, ctx), "regla:bonito_mar_agitada_previa").aporte < 0);
  assert.ok(!razon(enHora("bonito_norte", serie(() => ({ tempAgua: 17 }), { inicio }), hora, ctx), "regla:bonito_mar_agitada_previa"));
  // Temporal del oeste hace 2-5 días pero con viento fuerte todavía ahora: no suma.
  const sigue = serie((i) => (i < 72 ? { viento: 35, vientoDir: 280 } : { viento: 28, vientoDir: 0 }), { inicio });
  assert.ok(!razon(enHora("bonito_norte", sigue, hora, ctx), "regla:bonito_temporales_oeste"));
  // Ya calmado (10 km/h): suma (lo comprueba también "Mikel 5").
  const calmado = serie((i) => (i < 72 ? { viento: 35, vientoDir: 280 } : {}), { inicio });
  assert.ok(razon(enHora("bonito_norte", calmado, hora, ctx), "regla:bonito_temporales_oeste").aporte > 0);
  // 16-18 °C: con el agua a 19 °C ya está fuera de su rango.
  assert.ok(razon(enHora("bonito_norte", serie(() => ({ tempAgua: 19 }), { inicio }), hora, ctx), "temperatura").aporte < 0);
});

test("evidencia 9: lubina de noche en invierno desde costa", () => {
  const inv = serie(() => ({}), { inicio: Date.UTC(2026, 11, 1), n: 72 });
  assert.ok(razon(enHora("lubina", inv, "2026-12-02T02:00"), "regla:lubina_noche_invierno").aporte > 0);
  assert.ok(!razon(enHora("lubina", inv, "2026-12-02T13:00"), "regla:lubina_noche_invierno"), "de día no");
  assert.ok(!razon(enHora("lubina", serie(), "2026-10-07T02:00"), "regla:lubina_noche_invierno"), "en octubre no");
  assert.ok(!razon(enHora("lubina", inv, "2026-12-02T02:00", { modalidad: "embarcacion" }), "regla:lubina_noche_invierno"));
});

test("Mikel 6: el congrio no entra con luna llena (de noche)", () => {
  assert.equal(regla("congrio_luna_llena").fuente, "mikel_experiencia_local");
  const llena = serie(() => ({}), { inicio: Date.UTC(2026, 9, 24), n: 96 });
  const r = enHora("congrio", llena, "2026-10-26T02:00");
  assert.ok(razon(r, "regla:congrio_luna_llena").aporte < 0);
  assert.equal(razon(r, "regla:congrio_luna_llena").texto, "luna llena: el congrio entra poco");
  assert.ok(razon(enHora("congrio", llena, "2026-10-26T02:00", { modalidad: "embarcacion" }), "regla:congrio_luna_llena").aporte < 0);
  assert.ok(!razon(enHora("congrio", llena, "2026-10-26T13:00"), "regla:congrio_luna_llena"), "de día no");
  assert.ok(!razon(enHora("lubina", llena, "2026-10-26T02:00"), "regla:congrio_luna_llena"), "solo el congrio");
  const nueva = serie(() => ({}), { inicio: Date.UTC(2026, 9, 9), n: 72 });
  assert.ok(!razon(enHora("congrio", nueva, "2026-10-10T23:00"), "regla:congrio_luna_llena"), "luna nueva");
  // Más llena, más efecto (escala de 0,8 a 1).
  const casi = serie(() => ({}), { inicio: Date.UTC(2026, 9, 21), n: 72 });
  const rc = razon(enHora("congrio", casi, "2026-10-22T23:00"), "regla:congrio_luna_llena");
  assert.ok(rc && Math.abs(rc.lo) < Math.abs(razon(r, "regla:congrio_luna_llena").lo));
});

test("Mikel 7: mareas vivas (coeficiente ≥ 90) suman desde costa; refuerzo del rodaballo de playa en otoño", () => {
  const vivas = serie(() => ({}), { inicio: Date.UTC(2026, 9, 25), n: 72 }); // ~104-106
  const muertas = serie(() => ({}), { inicio: Date.UTC(2026, 9, 17), n: 72 }); // ~23-44
  const r = enHora("lubina", vivas, "2026-10-27T13:00");
  assert.ok(razon(r, "regla:coeficientes_altos").aporte > 0);
  assert.equal(razon(r, "regla:coeficientes_altos").texto.split(":")[0], "mareas vivas");
  assert.ok(!razon(enHora("lubina", muertas, "2026-10-19T13:00"), "regla:coeficientes_altos"));
  assert.ok(!razon(enHora("lubina", vivas, "2026-10-27T13:00", { modalidad: "embarcacion" }), "regla:coeficientes_altos"));
  assert.ok(!razon(enHora("bonito_norte", vivas, "2026-10-27T13:00", { modalidad: "embarcacion" }), "regla:coeficientes_altos"));
  // Rodaballo desde playa (Bakio) en noviembre con vivas: general + refuerzo.
  const BAKIO = { lat: 43.43, lon: -2.81, slug: "bakio" };
  const nov = serie(() => ({}), { inicio: Date.UTC(2026, 10, 23), n: 72 });
  const rod = enHora("rodaballo", nov, "2026-11-25T13:00", BAKIO);
  assert.ok(razon(rod, "regla:coeficientes_altos").aporte > 0);
  assert.ok(razon(rod, "regla:rodaballo_mareas_vivas_otono").aporte > 0);
  // Con muertas en noviembre, nada de las dos.
  const novM = serie(() => ({}), { inicio: Date.UTC(2026, 10, 16), n: 72 });
  const rodM = enHora("rodaballo", novM, "2026-11-17T13:00", BAKIO);
  assert.ok(!rodM.razones.some((x) => /coeficientes_altos|rodaballo_mareas/.test(x.factor)));
  // El rodaballo está de temporada en el Cantábrico en otoño y solo desde costa.
  assert.deepEqual(especie("rodaballo").presencia.cantabrico.meses, [10, 11, 12]);
  assert.equal(especie("rodaballo").modalidades.costa.aplica, true);
});

test("textos de las reglas nuevas: cortos y sin números de puntos ni nombres de fuente", () => {
  const nuevas = ["rio_crecido_cefalopodos", "lluvia_fuerte_pulpo", "enfriamiento_brusco_agua", "bonito_mar_agitada_previa",
    "lubina_noche_invierno", "congrio_luna_llena", "coeficientes_altos", "rodaballo_mareas_vivas_otono"];
  for (const id of nuevas) {
    const t = regla(id).texto;
    assert.ok(t.length <= 80, `${id}: ${t}`);
    assert.doesNotMatch(t, /mikel|regla|fiabilidad|confianza|log-odds|puntos|\(|_/i, id);
  }
});

test("cada variable cuenta una sola vez por hora (factores base y reglas expertas)", () => {
  const i0 = idx(serie(), HOY);
  const escenarios = [
    serie(),
    serie((i) => ({ presion: 1020 - Math.max(0, i - 114) * 0.5, ola: 1.8, vientoDir: 90, viento: 20 })),
    serie((i) => ({ presion: i < i0 - 24 ? 1012 : i <= i0 - 6 ? 1012 - (i - (i0 - 24)) * (6 / 18) : 1006 + (i - (i0 - 6)) / 3, ola: 2.4 })),
    serie(() => ({ ola: 0.2, vientoDir: 120, viento: 35 })),
    serie(() => ({ ola: 3 })),
    serie((i) => (i < 72 ? { viento: 35, vientoDir: 280 } : { vientoDir: 90, viento: 15 }), { inicio: Date.UTC(2026, 7, 10) }),
  ];
  const rio = rioDeSpot(MUNDAKA, RIOS);
  for (const s of escenarios) {
    for (const modalidad of ["costa", "embarcacion", "submarina"]) {
      for (const e of DATOS.especies) {
        for (const extra of [{}, { caudalRio: "alto", rio, turbidez: "turbia" }]) {
          const res = calcularVentana(e, DATOS.reglas_por_defecto, s, ctxBase({ modalidad, ...extra }));
          for (const r of res) {
            const vars = r.razones.filter((x) => x.aporte !== 0 && x.variable).map((x) => x.variable);
            assert.equal(new Set(vars).size, vars.length, `${e.id}/${modalidad} ${r.hora}: ${vars.join(", ")}`);
          }
        }
      }
    }
  }
  // Y por construcción: una regla con la variable de un factor base lo sustituye.
  for (const r of DATOS.reglas_expertas.reglas) {
    const base = Object.entries(VARIABLE_DE_FACTOR).find(([, v]) => v === r.variable)?.[0];
    if (base) assert.ok((r.sustituye || []).includes(base), `${r.id} puntúa ${r.variable} sin sustituir ${base}`);
  }
});

// ---------------------------------------------------------------------------
// Índice del spot y fiabilidad
// ---------------------------------------------------------------------------
test("índice del spot: la mejor especie de temporada de la pestaña, con nombre; el bonito nunca desde costa", () => {
  const s = serie();
  const i = idx(s, HOY);
  const ind = indiceSpot(DATOS, s, i, { ...MUNDAKA, modalidad: "costa", horaActual: "2026-10-08T13" });
  assert.equal(ind.version, INDICE_VERSION);
  assert.equal(ind.puntuacion, ind.ranking[0].puntuacion);
  assert.ok(ind.ranking.every((x, k) => k === 0 || x.puntuacion <= ind.ranking[k - 1].puntuacion));
  assert.ok(ind.especie.nombre);
  assert.ok(!ind.ranking.some((x) => x.id === "bonito_norte"));
  // Es exactamente la puntuación de la ventana de esa especie a esa hora.
  const v = calcularVentana(especie(ind.especie.id), DATOS.reglas_por_defecto, s, ctxBase({ rio: null }))[i];
  assert.equal(v.puntuacion, ind.puntuacion);
});

test("fiabilidad: ★ criterio experto; rebajas por horizonte y por datos; ★★ con base científica; ★★★ con el diario", () => {
  const s = serie();
  const r = enHora("lubina", s, HOY);
  const f = fiabilidad(r, { especieId: "lubina", modalidad: "costa", region: "cantabrico", horaActual: "2026-10-08T12" });
  assert.equal(f.nivel, 1);
  assert.match(f.etiqueta, /^★ criterio experto/);
  const lejos = fiabilidad({ ...r, hora: "2026-10-11T13:00" }, { horaActual: "2026-10-08T12" });
  assert.ok(lejos.rebajas.some((x) => /48 h/.test(x)));
  const pocoDato = fiabilidad({ ...r, cobertura: 0.4 }, {});
  assert.ok(pocoDato.rebajas.some((x) => /40 %/.test(x)));
  assert.equal(fiabilidad({ ...r, fraccionCientifica: 0.7 }, { datosMedidos: true }).etiqueta, "★★ con base científica");
  const val = { por_combinacion: { "lubina|costa|cantabrico": { diario: true } } };
  assert.equal(fiabilidad(r, { especieId: "lubina", modalidad: "costa", region: "cantabrico", validacion: val, datosMedidos: true }).nivel, 3);
  // Con huecos de datos baja la cobertura.
  const sinMar = serie(() => ({ nivelMar: null, ola: null, tempAgua: null }));
  assert.ok(enHora("lubina", sinMar, HOY).cobertura < 0.6);
});

// ---------------------------------------------------------------------------
// Fase 0: condiciones de las salidas del diario por fecha
// ---------------------------------------------------------------------------
test("diario: plan por fecha (hoy, pasado, antigua sin dato, futuro, lejana)", () => {
  const hoy = "2026-10-08";
  assert.equal(planCondiciones(hoy, hoy).modo, "hoy");
  assert.equal(planCondiciones("2026-10-01", hoy).modo, "pasado");
  const vieja = planCondiciones("2026-05-01", hoy);
  assert.equal(vieja.modo, "antigua");
  assert.equal(vieja.pedir, false);
  assert.equal(vieja.estado, "sin_dato_fecha_antigua");
  assert.equal(planCondiciones("2026-10-12", hoy).modo, "futuro");
  assert.equal(planCondiciones("2026-11-30", hoy).estado, "sin_prevision_fecha_lejana");
  assert.equal(planCondiciones(null, hoy).modo, "sin_fecha");
});

test("diario: las ventanas caben en el proxy /meteo/ (≤ 31 días) y en lo que sirve Open-Meteo", () => {
  const hoy = "2026-10-08";
  for (const fecha of ["2026-10-08", "2026-09-20", "2026-07-12", "2026-10-20"]) {
    const v = ventanasConsulta(fecha, hoy);
    for (const [api, w, vars] of [["forecast", v.atmosfera, "windspeed_10m,winddirection_10m,pressure_msl,cloudcover,precipitation"],
      ["marine", v.mar, "wave_height,sea_level_height_msl,sea_surface_temperature"]]) {
      assert.ok(diasEntre(w.inicio, w.fin) <= 31 && diasEntre(w.inicio, w.fin) >= 0, `${fecha} ${api}`);
      assert.ok(diasEntre(w.inicio, hoy) <= 90, `${fecha} ${api} demasiado atrás`);
      const q = new URLSearchParams(`latitude=43.40&longitude=-2.70&timezone=Europe/Madrid&start_date=${w.inicio}&end_date=${w.fin}&hourly=${vars}${api === "forecast" ? "&windspeed_unit=kmh" : ""}`);
      const r = validarConsultaProxy(api, q, { hoy });
      assert.ok(r.ok, `${fecha} ${api}: ${r.error}`);
    }
    // La atmósfera trae los 5 días previos (reglas con retardo).
    if (fecha === "2026-09-20") assert.equal(v.atmosfera.inicio, "2026-09-15");
  }
});

test("diario (el bug): una salida retroactiva sin hora NUNCA usa la hora de hoy", () => {
  // Serie de mar de ±8 días alrededor del 2026-10-03: incluye hoy (08/10).
  const lista = serie(() => ({}), { inicio: Date.UTC(2026, 8, 25), n: 17 * 24 }).map((h) => h.hora);
  const r = indiceHoraSalida(lista, "2026-10-03", null, { hoy: "2026-10-08", horaActual: "2026-10-08T17" });
  assert.equal(lista[r.i], "2026-10-03T12:00");
  assert.equal(r.estimada, true);
  // Con hora: la de esa fecha.
  assert.equal(lista[indiceHoraSalida(lista, "2026-10-03", "07:40", { hoy: "2026-10-08" }).i], "2026-10-03T08:00");
  // Hoy sin hora: la hora actual.
  assert.equal(lista[indiceHoraSalida(lista, "2026-10-08", null, { hoy: "2026-10-08", horaActual: "2026-10-08T17" }).i], "2026-10-08T17:00");
  // 23:40 -> las 00 del día SIGUIENTE (antes: las 00 del mismo día).
  assert.deepEqual(horaRedondeada("2026-10-03", "23:40"), { fecha: "2026-10-04", hora: 0 });
  assert.equal(lista[indiceHoraSalida(lista, "2026-10-03", "23:40").i], "2026-10-04T00:00");
  // Fecha que no está en la serie: -1 (null), nunca otra fecha.
  assert.equal(indiceHoraSalida(lista, "2025-01-01", "10:00").i, -1);
});

test("diario: luna de la fecha de la salida (no la de hoy) y tendencia de presión", () => {
  assert.equal(lunaDeFecha("2026-10-26").fase, "Luna llena");
  assert.ok(lunaDeFecha("2026-10-26").iluminacion > 95);
  assert.ok(lunaDeFecha("2026-10-10").iluminacion < 10); // luna nueva ~10/10/2026
  assert.equal(tendenciaPresion([1010, 1009, 1008, 1007], 3), "bajando");
  assert.equal(tendenciaPresion([1010, 1010, 1010, 1010.5], 3), "estable");
  assert.equal(tendenciaPresion([1010, null, 1012], 2), null);
});

test("diario: la serie junta mar y atmósfera por la hora y el resumen guarda versión, factores y ranking", () => {
  const marino = { hourly: { time: ["2026-10-03T11:00", "2026-10-03T12:00"], wave_height: [1, 2], sea_level_height_msl: [0.1, 0.2], sea_surface_temperature: [18, 18.2] } };
  const tiempo = { hourly: { time: ["2026-10-03T10:00", "2026-10-03T11:00", "2026-10-03T12:00"], windspeed_10m: [5, 6, 7], winddirection_10m: [90, 95, 100], pressure_msl: [1010, 1011, 1012], precipitation: [0, 0, 1] } };
  const s = serieHoraria(marino, tiempo, 1.5);
  assert.deepEqual(s.map((h) => h.hora), ["2026-10-03T10:00", "2026-10-03T11:00", "2026-10-03T12:00"]);
  assert.equal(s[0].ola, null);
  assert.equal(s[2].ola, 3);
  assert.equal(s[2].vientoDir, 100);
  const serieLarga = serie(() => ({}), { inicio: Date.UTC(2026, 8, 28) });
  const i = idx(serieLarga, "2026-10-03T12:00");
  const ind = indiceSpot(DATOS, serieLarga, i, { ...MUNDAKA, modalidad: "costa", horaActual: "2026-10-08T13" });
  const res = resumenIndice(ind, { estimada: true });
  assert.equal(res.indice_puntuacion, ind.puntuacion);
  assert.equal(res.indice_especie, ind.especie.id);
  assert.equal(res.indice_factores.version, INDICE_VERSION);
  assert.equal(res.indice_factores.hora_estimada, true);
  assert.ok(res.indice_factores.razones.every((r) => typeof r.aporte === "number"));
  assert.ok(res.indice_factores.ranking.length >= 2);
  assert.ok(JSON.stringify(res).length < 6000, "compacto");
  // Ola peligrosa: se guarda como nota aparte (aviso_ola), no como motivo.
  assert.equal(res.indice_factores.aviso_ola, null);
  const serieOla = serie(() => ({ ola: 3.2 }), { inicio: Date.UTC(2026, 8, 28) });
  const resOla = resumenIndice(indiceSpot(DATOS, serieOla, i, { ...MUNDAKA, modalidad: "costa", horaActual: "2026-10-08T13" }));
  assert.match(resOla.indice_factores.aviso_ola, /^⚠️ Ola peligrosa desde costa/);
  assert.ok(!resOla.indice_factores.razones.some((r) => r.factor === "tope"));
  assert.equal(resumenIndice({ puntuacion: null, motivo: "sin_especies", version: INDICE_VERSION }).indice_puntuacion, null);
});

test("diario.html: boya y /luna solo para salidas de hoy, sin fallback a forecast_days=1 ni a la hora de ahora", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  const ctx = html.slice(html.indexOf("async function contextoAmbiental("), html.indexOf("// especies.json para el índice de la salida"));
  assert.ok(ctx.length > 1000);
  assert.ok(!/"forecast_days=1"/.test(ctx));
  assert.ok(!/hs\.slice\(0, 13\) === horaActualMadridISO\(\)/.test(ctx));
  assert.match(ctx, /tipoSalida === "embarcacion" && \(plan\.modo === "hoy"/);
  assert.match(ctx, /plan\.modo === "hoy" \|\| plan\.modo === "sin_fecha"\s*\n\s*\? fetch\(`\/luna/);
  assert.match(html, /import \* as CondSalida from "\/assets\/js\/condiciones-salida\.js"/);
  // Sin columnas aún en producción: reintenta sin ellas.
  assert.match(html, /PGRST204/);
});

test("la fiabilidad no se enseña al usuario: solo en el detalle del admin", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const diario = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  const ini = index.indexOf("function htmlPorque(");
  const admin = index.slice(ini, index.indexOf("\n}\n", ini));
  const fuera = index.replace(admin, "");
  assert.ok(/Fiabilidad/.test(admin), "el admin la ve en su desplegable");
  assert.ok(!/[>`"]Fiabilidad/.test(fuera), "index.html no la pinta fuera del detalle del admin");
  assert.ok(!/fiabilidad \$\{/.test(diario), "diario.html no la pinta");
  // Ni números por factor ni etiquetas de fuente para el usuario.
  assert.ok(!/regla de Mikel|experiencia local|va-pts/.test(fuera.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\/.*$/gm, "")));
});

// Lo que ve el usuario (Mikel, 2026-10-08): solo motivos con flecha y avisos
// útiles. Nada neutro "·", ni "pendiente", "no cuenta" o "fuente": eso va
// solo al "Detalle (admin)".
const PROHIBIDO_USUARIO = /·|pendiente|no cuenta|fuente/i;
test("usuario: solo motivos con flecha y avisos útiles, nada interno (ficha, ventana, diario, posts)", async () => {
  const escenarios = [
    ["cantábrico", serie(), MUNDAKA],
    ["mediterráneo (marea que no cuenta)", serie((i) => ({ nivelMar: 0.03 * Math.sin(i) })), VALENCIA],
    ["ola peligrosa y viento", serie(() => ({ ola: 3.2, viento: 35 })), MUNDAKA],
    ["agua fría", serie(() => ({ tempAgua: 11 })), MUNDAKA],
  ];
  let internosVistos = 0, neutrosVistos = 0, avisosVistos = 0;
  for (const [nombre, s, spot] of escenarios) {
    for (const modalidad of ["costa", "embarcacion", "submarina"]) {
      for (const e of DATOS.especies) {
        const res = calcularVentana(e, DATOS.reglas_por_defecto, s, ctxBase({ ...spot, modalidad }));
        for (const hh of ["06", "07", "13", "19", "23"]) {
          const r = res[idx(s, `2026-10-08T${hh}:00`)];
          if (!r) continue;
          internosVistos += r.razones.filter((x) => TEXTO_INTERNO.test(x.texto)).length;
          neutrosVistos += r.razones.filter((x) => !x.aporte).length;
          const u = paraUsuario(r.razones);
          avisosVistos += u.avisos.length;
          for (const m of u.motivos) {
            assert.ok(["▲▲", "▲", "▼", "▼▼"].includes(m.flecha), `${nombre}/${modalidad}/${e.id}: ${m.texto}`);
            assert.ok(!PROHIBIDO_USUARIO.test(m.texto), `${nombre}/${modalidad}/${e.id}: "${m.texto}"`);
          }
          for (const a of u.avisos) {
            assert.match(a, /^⚠️ /);
            assert.ok(!PROHIBIDO_USUARIO.test(a), `${nombre}/${modalidad}/${e.id}: "${a}"`);
          }
          if (r.avisoOla) assert.ok(!PROHIBIDO_USUARIO.test(r.avisoOla.texto));
        }
      }
    }
  }
  // El test tiene sentido: había texto interno y neutro que se ha quedado fuera.
  assert.ok(internosVistos > 0 && neutrosVistos > 0 && avisosVistos > 0, `${internosVistos}/${neutrosVistos}/${avisosVistos}`);

  // La ficha y la ventana (index.html): el HTML de usuario de htmlPorque.
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const extrae = (ini) => { const a = html.indexOf(ini); let i = html.indexOf("{", html.indexOf(")", a)), d = 0; for (; ; i++) { if (html[i] === "{") d++; if (html[i] === "}" && --d === 0) break; } return html.slice(a, i + 1); };
  const consts = html.match(/const FLECHA_ETIQUETA = [^\n]+/)[0];
  const window = { VentanaActividad: { paraUsuario }, esAdminCostaviva: false };
  const htmlPorque = new Function("window", `${extrae("function escVA(")}\n${consts}\n${extrae("function htmlPorque(")}\nreturn htmlPorque;`)(window);
  const conTodo = [
    { factor: "temperatura", texto: "agua a 20 °C (rango de la especie pendiente de fuente abierta: no cuenta)", aporte: 0 },
    { factor: "marea", texto: "marea casi nula aquí (0,1 m): no cuenta", aporte: 0 },
    { factor: "luz", texto: "pleno día", aporte: 0 },
    { factor: "presion", texto: "presión bajando", aporte: 4 },
    { factor: "oleaje", texto: "mar de 2-2,5 m", aporte: -7 },
    { factor: "legal", texto: "legal solo desde la salida del sol (08:12)", aporte: 0 },
  ];
  const usuario = htmlPorque(conTodo, { etiqueta: "★ criterio experto" });
  assert.ok(!PROHIBIDO_USUARIO.test(usuario), usuario);
  assert.ok(!/criterio experto|Detalle \(admin\)/.test(usuario), "ni fiabilidad ni detalle para el usuario");
  assert.match(usuario, /▼▼<\/span><span>mar de 2-2,5 m/);
  assert.match(usuario, /⚠️ legal solo desde la salida del sol/);
  window.esAdminCostaviva = true;
  const admin = htmlPorque(conTodo, { etiqueta: "★ criterio experto" });
  assert.match(admin, /Detalle \(admin\)[\s\S]*pendiente de fuente abierta/);
  assert.match(admin, /Fiabilidad: ★ criterio experto/);
  // Diario: el mismo filtro de texto interno que paraUsuario.
  const diario = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.ok(diario.includes(`!/${TEXTO_INTERNO.source}/i.test(x.texto || "")`), "diario.html filtra lo interno igual que la ficha");
  // Posts y reels: motivosDestacados usa el mismo filtro.
  const { motivosDestacados } = await import("../scripts/marketing/pieza-datos.mjs");
  const posts = motivosDestacados(conTodo, 10);
  assert.deepEqual(posts.map((m) => m.texto), ["mar de 2-2,5 m", "presión bajando"]);
});

// Mar grande desde costa (2026-10-08): sin el tope de ola, por encima de
// 2,5 m la ola no restaba nada a los depredadores costeros (sus reglas de
// mar plana/poca/movida sustituyen al factor de oleaje y acaban en 2,5 m).
test("mar_grande_depredadores: cierra el hueco de más de 2,5 m desde costa; la ola cuenta una vez", () => {
  // El escenario de la captura del aviso: dorada en Bakio a las 12:00 con 3,1 m.
  const bakio = (ola) => {
    const h = [];
    for (let i = 0; i < 72; i++) {
      const d = new Date(Date.UTC(2026, 9, 7) + i * 3600e3);
      h.push({ hora: d.toISOString().slice(0, 13) + ":00", nivelMar: 1.6 * Math.sin((2 * Math.PI * i) / 12.42), ola: i < 24 ? 1.6 : ola,
        viento: 18, vientoDir: 300, tempAgua: 18.5, presion: 1012 - Math.max(0, i - 30) * 0.25, lluvia: 0 });
    }
    return h;
  };
  const dorada = (ola, modalidad = "costa") => enHora("dorada", bakio(ola), "2026-10-08T12:00", { lat: 43.4297, lon: -2.8103, modalidad });
  const r = dorada(3.1);
  assert.equal(r.puntuacion, 54, "antes daba 72");
  const ola = r.razones.filter((x) => x.variable === "ola");
  assert.equal(ola.length, 1, "la ola cuenta una sola vez");
  assert.equal(ola[0].factor, "regla:mar_grande_depredadores");
  assert.equal(ola[0].texto, "mar demasiado grande: se apartan de la orilla");
  assert.ok(ola[0].aporte <= -6, "▼▼");
  assert.ok(r.avisoOla, "y el aviso aparte");
  // Crece con la altura hasta ~4 m; en 2,5 m justos manda todavía mar movida.
  assert.ok(dorada(4).puntuacion < r.puntuacion);
  assert.equal(dorada(5).puntuacion, dorada(4).puntuacion);
  assert.ok(razon(dorada(2.5), "regla:mar_movida_depredadores_costa"));
  assert.ok(!razon(dorada(2.5), "regla:mar_grande_depredadores"));
  // Embarcación y submarina: el factor de oleaje no está sustituido, así que
  // ya resta con mar grande (sin hueco) y la regla nueva no aplica.
  for (const modalidad of ["embarcacion", "submarina"]) {
    const m = dorada(3.1, modalidad);
    if (m.prohibida) continue;
    assert.ok(!razon(m, "regla:mar_grande_depredadores"), modalidad);
    assert.ok(razon(m, "oleaje").aporte < 0, `${modalidad}: el factor de oleaje resta`);
  }
  // Ninguna regla experta sustituye al oleaje fuera de costa.
  for (const rg of DATOS.reglas_expertas.reglas) {
    if ((rg.sustituye || []).includes("oleaje")) assert.deepEqual(rg.ambito.modalidades, ["costa"], rg.id);
  }
});
