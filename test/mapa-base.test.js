// Mapa base (assets/js/mapa-base.js, 2026-10-08): OpenFreeMap con los colores
// "Amanecer" puestos en el ESTILO (no con filtros) y atribuciones obligatorias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../assets/js/mapa-base.js");
const { retocarEstilo, COLORES, ATRIBUCION, ATRIBUCION_RELIEVE, URL_ESTILO } = globalThis.MapaBase;

const estilo = () => ({
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
    { id: "water", type: "fill", paint: { "fill-color": "rgb(158,189,255)" } },
    { id: "waterway_river", type: "line", paint: { "line-color": "#a0c8f0" } },
    { id: "water_name_point_label", type: "symbol", paint: { "text-color": "#495e91" } },
    { id: "road_motorway", type: "line", paint: { "line-color": "#fc8" } },
    { id: "park", type: "fill" },
  ],
});

test("retoca solo tierra, mar, ríos y rótulos del mar", () => {
  const e = retocarEstilo(estilo());
  const por = Object.fromEntries(e.layers.map((l) => [l.id, l.paint]));
  assert.equal(por.background["background-color"], COLORES.tierra);
  assert.equal(por.water["fill-color"], COLORES.mar);
  assert.equal(por.waterway_river["line-color"], COLORES.rio);
  assert.equal(por.water_name_point_label["text-color"], COLORES.rotuloMar);
  assert.equal(por.road_motorway["line-color"], "#fc8");
  assert.deepEqual(por.park, {});
});

test("atribuciones obligatorias de OpenFreeMap/OpenStreetMap y EMODnet", () => {
  assert.match(ATRIBUCION, /OpenFreeMap/);
  assert.match(ATRIBUCION, /OpenMapTiles/);
  assert.match(ATRIBUCION, /OpenStreetMap contributors/);
  assert.match(ATRIBUCION_RELIEVE, /EMODnet/);
  assert.match(ATRIBUCION_RELIEVE, /CC BY 4\.0/);
  assert.equal(URL_ESTILO, "https://tiles.openfreemap.org/styles/liberty");
});

test("index.html ya no pide teselas de Esri y carga MapLibre con SRI", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!/arcgisonline\.com/.test(html), "sin teselas de Esri");
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:maplibre)[^>]*>/g)) {
    assert.match(m[0], /integrity="sha(384|512)-/, `sin SRI: ${m[0].slice(0, 80)}`);
    assert.match(m[0], /@?\d+\.\d+\.\d+/, "versión fija");
  }
});
