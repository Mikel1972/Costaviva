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
  reglasParaModalidad, rioDeSpot, distanciaKm, INDICE_VERSION, VARIABLE_DE_FACTOR,
} from "../assets/js/ventana-actividad.js";
import {
  enSector, valorExpresion, evaluarCondicion, enAmbito, reglasEnAmbito, efectoRegla, validarRegla,
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
  for (const [id, modalidad, antes] of V1) {
    const r = calcularVentana(especie(id), DATOS.reglas_por_defecto, s, { lat: 43.40, lon: -2.70, modalidad, reglasModalidad: DATOS.reglas_por_modalidad });
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

test("filtro: tope de seguridad aplicado al final, explicado y la suma sigue cuadrando", () => {
  const s = serie(() => ({ ola: 3.2 }));
  const r = enHora("lubina", s, HOY);
  assert.ok(r.puntuacion <= 20 && r.marPeligrosa);
  assert.ok(razon(r, "tope"));
  assert.equal(50 + r.razones.reduce((a, x) => a + x.aporte, 0), r.puntuacion);
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

test("propuestas_evidencia: bien formadas, con fuente y SIN activar", () => {
  // Bloque de propuestas con fuente científica (2026-10-08). No lo lee el
  // índice: solo se comprueba que, si Mikel aprueba una, se puede mover tal
  // cual a reglas_expertas.reglas.
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
  assert.equal(p.top10.length, 10);
  for (const id of p.top10) assert.ok(ids.has(id), `top10: ${id} no existe`);
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

test("Mikel 2: mar algo movida (1-2,5 m) suma desde costa, sin saltarse el tope de seguridad", () => {
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
  assert.ok(peligro.puntuacion <= 20 && peligro.marPeligrosa, "el tope va aparte aunque el factor esté sustituido");
  assert.match(razon(peligro, "tope").texto, /peligrosa/);
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
