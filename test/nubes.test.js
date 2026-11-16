// Nubosidad observada (METAR) para "ahora" (2026-11-16, caso real: Lemoiz
// de noche, la app decía 100 % y se veían estrellas; Bilbao daba CAVOK).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { porcentajeMetar, elegirMetar, MAX_KM_METAR } from "../assets/js/nubes.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const LEMOIZ = { lat: 43.43, lon: -2.88 };
const AHORA = Date.parse("2026-11-16T00:26:00Z");
const bilbao = { icaoId: "LEBB", name: "Bilbao Arpt, PV, ES", lat: 43.298, lon: -2.906, obsTime: Date.parse("2026-11-16T00:00:00Z") / 1000, cover: "CAVOK", clouds: [] };

test("Lemoiz, 16-nov 01:26: el METAR de Bilbao (CAVOK) dice despejado", () => {
  const o = elegirMetar([bilbao], LEMOIZ.lat, LEMOIZ.lon, AHORA);
  assert.equal(o.nubosidad, 0);
  assert.equal(o.estacion, "LEBB");
  assert.equal(o.nombre, "Bilbao");
  assert.equal(o.distanciaKm, 15);
  assert.equal(o.edadMin, 26);
});

test("capas del METAR a porcentaje: manda la más tapada", () => {
  assert.equal(porcentajeMetar({ cover: "BKN", clouds: [{ cover: "SCT" }, { cover: "BKN" }] }), 75);
  assert.equal(porcentajeMetar({ cover: "FEW", clouds: [{ cover: "FEW" }] }), 20);
  assert.equal(porcentajeMetar({ cover: "OVC", clouds: [{ cover: "OVC" }] }), 100);
  assert.equal(porcentajeMetar({ cover: "CLR", clouds: [] }), 0);
  assert.equal(porcentajeMetar({ cover: "???" }), null);
});

test("no vale un parte viejo, lejano o sin nubes legibles; gana el más cercano", () => {
  assert.equal(elegirMetar([{ ...bilbao, obsTime: bilbao.obsTime - 3 * 3600 }], LEMOIZ.lat, LEMOIZ.lon, AHORA), null);
  assert.equal(elegirMetar([{ ...bilbao, lat: 44.2 }], LEMOIZ.lat, LEMOIZ.lon, AHORA), null, `más de ${MAX_KM_METAR} km`);
  assert.equal(elegirMetar([{ ...bilbao, cover: "?" }], LEMOIZ.lat, LEMOIZ.lon, AHORA), null);
  const lejos = { ...bilbao, icaoId: "LEXJ", lat: 43.427, lon: -3.82, cover: "SCT", clouds: [{ cover: "SCT" }] };
  assert.equal(elegirMetar([lejos, bilbao], LEMOIZ.lat, LEMOIZ.lon, AHORA).estacion, "LEBB");
});

test("el panel pinta la observación y /cielo es público", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /pintarCieloObservado\(s\);/);
  assert.match(html, /fetch\(`\/cielo\?lat=/);
  assert.ok(esRutaPermitida("/cielo"));
});
