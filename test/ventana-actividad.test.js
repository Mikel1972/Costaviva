// Tests de la ventana de actividad (assets/js/ventana-actividad.js) y de la
// integridad de las fichas de especies (assets/datos/especies.json).
// Lógica pura: sin red, sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  regionPorCoordenadas, solDelDia, minutosMadrid, analizarMarea,
  calcularVentana, mejoresVentanas, estadoFreza, tallasParaRegion, enEuskadi, faseLunar, cebosParaRegion,
} from "../assets/js/ventana-actividad.js";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const especie = (id) => DATOS.especies.find((e) => e.id === id);

// Serie sintética de 48 h: marea semidiurna (12,42 h) con la amplitud dada.
function serie(amplitud, extra = {}) {
  const horas = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, 9, 7, 0, 0) + i * 3600000);
    const hora = `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`;
    horas.push({
      hora,
      nivelMar: amplitud * Math.sin((2 * Math.PI * i) / 12.42),
      ola: 1.0, viento: 10, tempAgua: 18, presion: 1015 - i * 0.2, ...extra,
    });
  }
  return horas;
}

test("regiones por coordenadas en toda la costa ibérica", () => {
  const casos = [
    [43.40, -2.70, "cantabrico"], [43.32, -1.98, "cantabrico"], [43.55, -5.66, "cantabrico"],
    [42.24, -8.72, "atlantico_norte"], [43.37, -8.40, "atlantico_norte"],
    [39.36, -9.38, "portugal"], [41.15, -8.68, "portugal"], [37.01, -7.93, "portugal"],
    [36.53, -6.29, "golfo_cadiz"], [39.47, -0.37, "mediterraneo"], [41.67, 3.17, "mediterraneo"],
    [39.57, 2.65, "baleares"], [28.10, -15.41, "canarias"], [37.74, -25.67, "azores"], [32.65, -16.91, "madeira"],
  ];
  for (const [lat, lon, esperado] of casos) assert.equal(regionPorCoordenadas(lat, lon), esperado, `${lat},${lon}`);
});

test("amanecer y anochecer en Bilbao el 7 de octubre (hora de Madrid)", () => {
  const sol = solDelDia("2026-10-07", 43.26, -2.93);
  const am = minutosMadrid(sol.amanecer), an = minutosMadrid(sol.anochecer);
  // Referencia: ~08:13 y ~19:38 (CEST). Margen amplio: es para franjas de ±1 h.
  assert.ok(Math.abs(am - (8 * 60 + 13)) <= 15, `amanecer ${am}`);
  assert.ok(Math.abs(an - (19 * 60 + 38)) <= 15, `anochecer ${an}`);
});

test("fase lunar: luna llena conocida", () => {
  // Luna llena del 2026-10-26 (aprox.).
  assert.equal(faseLunar(Date.UTC(2026, 9, 26, 6)).nombre, "luna llena");
});

test("análisis de marea: tendencia, repunte y rango", () => {
  const m = analizarMarea(serie(1.5).map((h) => h.nivelMar));
  assert.equal(m[1].tendencia, "subiendo");
  assert.ok(m[12].rango > 2.9 && m[12].rango <= 3.0);
  assert.ok(m.some((x) => x.repunte));
});

test("Mediterráneo: con marea de centímetros la marea no cuenta", () => {
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(0.08), { lat: 39.47, lon: -0.37 });
  for (const h of r) {
    const m = h.razones.find((x) => x.factor === "marea");
    assert.ok(m, "debe explicar por qué la marea no cuenta");
    assert.equal(m.aporte, 0);
    assert.match(m.texto, /casi nula/);
  }
});

test("Cantábrico: la marea sí aporta y se explica", () => {
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(1.8), { lat: 43.40, lon: -2.70 });
  assert.ok(r.some((h) => h.razones.some((x) => x.factor === "marea" && x.aporte > 0 && x.texto === "marea subiendo")));
});

test("la puntuación es 50 + la suma de los aportes mostrados (sin caja negra)", () => {
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(1.8), { lat: 43.40, lon: -2.70, turbidez: "turbia" });
  for (const h of r) {
    const suma = 50 + h.razones.reduce((s, x) => s + x.aporte, 0);
    if (suma >= 0 && suma <= 100 && !h.marPeligrosa) assert.equal(h.puntuacion, suma, h.hora);
    assert.ok(h.puntuacion >= 0 && h.puntuacion <= 100);
  }
});

test("mar peligrosa desde costa: tope y aviso", () => {
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(1.8, { ola: 3.2 }), { lat: 43.40, lon: -2.70 });
  for (const h of r) {
    assert.ok(h.puntuacion <= 20);
    assert.ok(h.razones.some((x) => /peligrosa/.test(x.texto)));
  }
});

test("sin rango de temperatura no se inventa nada", () => {
  const r = calcularVentana(especie("salmonete"), DATOS.reglas_por_defecto, serie(1.8), { lat: 43.40, lon: -2.70 });
  assert.ok(r.every((h) => !h.razones.some((x) => x.factor === "temperatura")));
});

test("un rango de temperatura de fuente NC (FishBase) no puntúa", () => {
  const r = calcularVentana(especie("sargo"), DATOS.reglas_por_defecto, serie(1.8), { lat: 43.40, lon: -2.70 });
  for (const h of r) {
    const t = h.razones.find((x) => x.factor === "temperatura");
    assert.ok(t && t.aporte === 0 && /pendiente/.test(t.texto));
  }
});

test("mejores ventanas: tramos seguidos, con su porqué", () => {
  const r = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(1.8), { lat: 43.40, lon: -2.70 });
  const v = mejoresVentanas(r.slice(0, 24), { umbral: 55 });
  assert.ok(v.length >= 1);
  assert.match(v[0].desde, /^\d\d:00$/);
  assert.ok(v[0].porque.length >= 1);
});

test("freza: aviso solo con dato, nunca 'no está en freza' por falta de dato", () => {
  assert.equal(estadoFreza(especie("lubina"), "cantabrico", 2).enFreza, true);
  assert.equal(estadoFreza(especie("lubina"), "cantabrico", 8).enFreza, false);
  assert.equal(estadoFreza(especie("lubina"), "mediterraneo", 2), null);
  assert.equal(estadoFreza(especie("salmonete"), "cantabrico", 2), null);
});

test("tallas por región: Euskadi primero en la costa vasca", () => {
  const l = especie("lubina");
  assert.ok(enEuskadi(43.40, -2.70));
  assert.equal(tallasParaRegion(l, "cantabrico", true)[0].jurisdiccion, "ES-PV");
  assert.equal(tallasParaRegion(l, "cantabrico", false)[0].jurisdiccion, "ES-recreativa-CNW");
  assert.equal(tallasParaRegion(l, "portugal")[0].jurisdiccion, "PT");
});

// ---------------------------------------------------------------------------
// Integridad de especies.json: lo que la rutina semanal no puede romper.
// ---------------------------------------------------------------------------
function idsCitados(o, out = []) {
  if (Array.isArray(o)) o.forEach((x) => idsCitados(x, out));
  else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if ((k === "fuentes" || k === "nombres_fuentes") && Array.isArray(v)) out.push(...v);
      else if (k === "fuente" && typeof v === "string") out.push(v);
      else idsCitados(v, out);
    }
  }
  return out;
}

test("especies.json: toda fuente citada existe y tiene licencia y fecha de consulta", () => {
  for (const id of idsCitados(DATOS.especies)) assert.ok(DATOS.fuentes[id], `fuente desconocida: ${id}`);
  for (const [id, f] of Object.entries(DATOS.fuentes)) {
    assert.ok(f.licencia, `${id} sin licencia`);
    assert.ok(f.fecha_consulta, `${id} sin fecha_consulta`);
  }
});

test("especies.json: ninguna fuente NC sostiene un dato salvo marcado como pendiente", () => {
  const esNC = (id) => /\bNC\b|non-?commercial|no comercial/i.test(DATOS.fuentes[id].licencia) || DATOS.fuentes[id].tipo === "excluido";
  for (const e of DATOS.especies) {
    for (const [campo, v] of Object.entries(e)) {
      const ids = idsCitados(v);
      if (!ids.some(esNC)) continue;
      assert.equal(campo, "temperatura_agua", `${e.id}.${campo} usa una fuente NC`);
      assert.ok(v.fuente_pendiente, `${e.id}.${campo} usa una fuente NC sin fuente_pendiente`);
    }
  }
});

test("especies.json: cada talla con valor tiene url y fecha_revision", () => {
  for (const e of DATOS.especies) {
    for (const t of e.talla_minima || []) {
      if (t.valor_cm === null && t.peso_g === undefined) continue;
      assert.match(t.url || "", /^https:\/\//, `${e.id} ${t.jurisdiccion} sin url`);
      assert.match(t.fecha_revision || "", /^\d{4}-\d{2}-\d{2}$/, `${e.id} ${t.jurisdiccion} sin fecha_revision`);
    }
  }
});

test("especies.json: cada regla por defecto y cada override explica su porqué", () => {
  for (const [k, r] of Object.entries(DATOS.reglas_por_defecto)) {
    assert.ok(r.criterio && r.tipo, `regla por defecto ${k} sin criterio/tipo`);
  }
  for (const e of DATOS.especies) {
    for (const [k, r] of Object.entries(e.reglas || {})) {
      const cambiaAlgoMasQueElPeso = Object.keys(r).some((x) => !["peso", "tipo", "criterio", "fuente"].includes(x));
      if (cambiaAlgoMasQueElPeso || r.peso !== undefined) {
        assert.ok(r.criterio || r.fuente || DATOS.reglas_por_defecto[k]?.criterio, `${e.id}.reglas.${k} sin criterio ni fuente`);
      }
    }
  }
});

test("especies.json: meses válidos y regiones conocidas", () => {
  const regiones = new Set(DATOS.regiones);
  for (const e of DATOS.especies) {
    assert.ok(e.id && e.nombres?.es, "falta id o nombre");
    for (const [reg, p] of [...Object.entries(e.presencia || {}), ...Object.entries(e.freza?.por_region || {})]) {
      assert.ok(regiones.has(reg), `${e.id}: región ${reg} desconocida`);
      assert.ok(p.meses.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), `${e.id} ${reg}: mes inválido`);
    }
  }
});

test("especies.json: todas las especies (28 originales + 25 del 2026-10-08, rodaballo incluido) tienen cebos, cada uno con fuente o criterio", () => {
  assert.ok(DATOS.especies.length >= 53, `solo ${DATOS.especies.length} especies`);
  assert.equal(new Set(DATOS.especies.map((e) => e.id)).size, DATOS.especies.length, "ids repetidos");
  for (const e of DATOS.especies) {
    assert.ok(Array.isArray(e.cebos) && e.cebos.length >= 1, `${e.id} sin cebos`);
    for (const c of e.cebos) {
      assert.ok(c.nombre && ["natural", "artificial"].includes(c.tipo) && c.modalidad, `${e.id}: cebo mal formado`);
      if (c.fuente) {
        assert.ok(DATOS.fuentes[c.fuente], `${e.id}: fuente ${c.fuente} desconocida`);
        assert.match(c.url || "", /^https:\/\//);
        assert.match(c.fecha_revision || "", /^\d{4}-\d{2}-\d{2}$/);
      } else {
        assert.equal(c.tipo_fuente, "heuristica_experta", `${e.id}: ${c.nombre} sin fuente ni marca de heurística`);
        assert.ok(c.criterio, `${e.id}: ${c.nombre} sin criterio`);
      }
      if (c.region) assert.ok(DATOS.regiones.includes(c.region));
    }
  }
});

test("cebos por región: primero los que tienen fuente, máximo 5", () => {
  const c = cebosParaRegion(especie("lubina"), "cantabrico");
  assert.ok(c.length <= 5 && c[0].fuente);
  const idxHeur = c.findIndex((x) => !x.fuente);
  if (idxHeur >= 0) assert.ok(c.slice(idxHeur).every((x) => !x.fuente));
});
