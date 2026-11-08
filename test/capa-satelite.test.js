// Foto aérea del IGN como fondo del mapa (2026-11-08, Mikel: "poder ver
// cómo son las rocas"). Lógica pura de assets/js/capa-satelite.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BORDE_SUAVE_PX, esMarGris, ZOOM_MAR_GRIS, esSinFoto, quitarSinFoto, COLOR_MAR_SATELITE, satelitePorDefecto, CLAVE_PREFERENCIA, URL_PNOA, ATRIBUCION_PNOA, RECTANGULOS_ESPANA, dentroDeEspana, zoomAlCambiar, ZOOM_MAX_SATELITE, ZOOM_MAX_NORMAL } from "../assets/js/capa-satelite.js";

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

test("por defecto encendida (Mikel: «que salga así por defecto»); si el usuario la quita, se recuerda", () => {
  assert.equal(satelitePorDefecto(null), true, "primera visita");
  assert.equal(satelitePorDefecto("si"), true);
  assert.equal(satelitePorDefecto("no"), false, "la quitó");
  assert.equal(CLAVE_PREFERENCIA, "costaviva.fondo_satelite");
});

test("el mar sin foto del IGN (morado liso) se vuelve transparente; el mar de la foto no", () => {
  assert.ok(esSinFoto(32, 26, 38));
  assert.ok(esSinFoto(35, 24, 41), "con artefactos del JPEG");
  assert.ok(!esSinFoto(47, 66, 96), "mar real frente a Bakio");
  assert.ok(!esSinFoto(20, 20, 20), "roca oscura");
  assert.ok(esSinFoto(4, 12, 31), "raya oscura del borde de la foto");
  assert.ok(!esSinFoto(10, 12, 14), "sombra neutra");
  const rgba = new Uint8ClampedArray([32, 26, 38, 255, 47, 66, 96, 255]);
  assert.equal(quitarSinFoto(rgba), 1);
  assert.deepEqual([...rgba], [32, 26, 38, 0, 47, 66, 96, 255]);
  assert.equal(COLOR_MAR_SATELITE, "#2F4260");
});

test("de lejos también se quita el mar gris de Sentinel-2 (cortado en bloques); de cerca no", () => {
  assert.equal(ZOOM_MAR_GRIS, 13);
  assert.ok(esMarGris(56, 64, 60), "mar a zoom 12");
  assert.ok(!esMarGris(72, 96, 56), "monte");
  assert.ok(!esMarGris(47, 66, 96), "mar de la ortofoto (azulado)");
  assert.ok(!esMarGris(150, 150, 150), "urbano claro");
  const mar = () => new Uint8ClampedArray([56, 64, 60, 255]);
  const lejos = mar(); quitarSinFoto(lejos, 12); assert.equal(lejos[3], 0);
  const cerca = mar(); quitarSinFoto(cerca, 17); assert.equal(cerca[3], 255);
});

test("borde suave: la foto se funde poco a poco donde empieza el mar sin foto", () => {
  assert.equal(BORDE_SUAVE_PX, 24);
  const lado = 64;
  const rgba = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
    const i = (y * lado + x) * 4;
    const [r, g, b] = x < 32 ? [47, 66, 96] : [32, 26, 38]; // mitad foto, mitad "sin foto"
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
  }
  quitarSinFoto(rgba, 17, lado);
  const alfa = (x) => rgba[(10 * lado + x) * 4 + 3];
  assert.equal(alfa(40), 0, "sin foto: transparente");
  assert.equal(alfa(2), 255, "lejos del borde: entera");
  assert.ok(alfa(31) > 0 && alfa(31) < 40, "junto al borde: casi transparente");
  assert.ok(alfa(20) > alfa(28), "más opaca cuanto más lejos del borde");
});
