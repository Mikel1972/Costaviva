// Foto aérea del IGN como fondo del mapa (2026-11-08, Mikel: "poder ver
// cómo son las rocas"). Lógica pura de assets/js/capa-satelite.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { URL_PNOA, ATRIBUCION_PNOA, RECTANGULOS_ESPANA, dentroDeEspana, zoomAlCambiar, ZOOM_MAX_SATELITE, ZOOM_MAX_NORMAL } from "../assets/js/capa-satelite.js";

test("PNOA del IGN: WMTS en Google Mercator, JPEG, con su atribución CC BY 4.0", () => {
  assert.match(URL_PNOA, /^https:\/\/www\.ign\.es\/wmts\/pnoa-ma\?/);
  for (const p of ["layer=OI.OrthoimageCoverage", "tilematrixset=GoogleMapsCompatible", "TileMatrix={z}", "TileRow={y}", "TileCol={x}", "Format=image/jpeg"]) assert.ok(URL_PNOA.includes(p), p);
  assert.match(ATRIBUCION_PNOA, /PNOA cedido por © .*Instituto Geográfico Nacional/);
  assert.match(ATRIBUCION_PNOA, /CC BY 4\.0/);
  assert.doesNotMatch(URL_PNOA + ATRIBUCION_PNOA, /arcgis|esri/i, "Esri no (licencia comercial)");
});

test("solo dentro de España: cubre sus spots y no pisa Portugal", () => {
  const espana = { Bakio: [43.43, -2.81], Mundaka: [43.4, -2.7], Baiona: [42.12, -8.85], Ayamonte: [37.21, -7.41], Cadiz: [36.53, -6.3],
    Almeria: [36.83, -2.46], Palma: [39.57, 2.65], Ciutadella: [40.0, 3.84], LasPalmas: [28.14, -15.43], Roses: [42.26, 3.18], Melilla: [35.29, -2.94] };
  for (const [n, [la, lo]] of Object.entries(espana)) assert.ok(dentroDeEspana(la, lo), n);
  const fuera = { Caminha: [41.874, -8.84], Lisboa: [38.72, -9.14], Porto: [41.15, -8.62], Faro: [37.02, -7.93], Nazare: [39.6, -9.08], Auckland: [-36.85, 174.76], Biarritz: [43.48, -1.56] };
  for (const [n, [la, lo]] of Object.entries(fuera)) {
    if (n === "Biarritz") continue; // Francia junto a la frontera: tesela vacía, no blanca (PNOA la deja transparente)
    assert.ok(!dentroDeEspana(la, lo), n);
  }
  assert.equal(RECTANGULOS_ESPANA.length, 5);
});

test("zoom: con satélite hasta 19 (rocas); al quitarlo vuelve a 17", () => {
  assert.equal(ZOOM_MAX_SATELITE, 19);
  assert.equal(ZOOM_MAX_NORMAL, 17);
  assert.deepEqual(zoomAlCambiar(true, 16), { max: 19, zoom: 16 });
  assert.deepEqual(zoomAlCambiar(false, 19), { max: 17, zoom: 17 });
  assert.deepEqual(zoomAlCambiar(false, 12), { max: 17, zoom: 12 });
});
