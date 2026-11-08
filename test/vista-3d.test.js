// Vista 3D del relieve y del fondo del mar (2026-11-08). Lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { teselaPrueba, ZONAS_EMODNET, zonaEmodnet, fuenteRelieve, URL_EMODNET, INCLINACION_MINIMA, ZOOM_MAX_BATIMETRIA, estilo3D, vistaInicial, URL_DEM, COLORES_PROFUNDIDAD, EXAGERACION, INCLINACION } from "../assets/js/vista-3d.js";

test("estilo 3D: relieve con batimetría, mar por profundidad, ortofoto en España y agua encima de la foto", () => {
  const e = estilo3D();
  assert.equal(e.version, 8);
  assert.match(URL_DEM, /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//);
  assert.equal(e.sources.dem.encoding, "terrarium");
  assert.deepEqual(e.terrain, { source: "demTerreno", exaggeration: EXAGERACION });
  // Batimetría solo hasta zoom 10 en las Terrain Tiles (desde el 11, mar = 0).
  assert.equal(ZOOM_MAX_BATIMETRIA, 10);
  assert.equal(e.sources.dem.maxzoom, 10);
  assert.equal(e.sources.demTerreno.maxzoom, 10);
  assert.equal(e.sources.demSombra.maxzoom, 15);
  const ids = e.layers.map((l) => l.id);
  assert.ok(ids.indexOf("pnoa0") < ids.indexOf("agua"), "el agua tapa la foto del mar");
  assert.ok(ids.indexOf("agua") < ids.indexOf("profundidad"), "el color por profundidad encima del agua");
  const relieve = e.layers.find((l) => l.id === "profundidad").paint["color-relief-color"];
  assert.equal(relieve.at(-1), "rgba(0,0,0,0)", "en tierra, transparente");
  assert.ok(COLORES_PROFUNDIDAD.every(([m]) => m < 0));
  for (const id of ["dem", "ofm", "pnoa0"]) assert.ok(e.sources[id].attribution, `${id} sin atribución`);
  assert.doesNotMatch(JSON.stringify(e), /arcgis|esri|mapbox|googleapis/i, "nada de pago");
});

test("vista inicial: mismo sitio, un zoom menos (teselas de 512) e inclinada", () => {
  assert.deepEqual(vistaInicial({ lat: 43.4, lng: -2.8 }, 12), { center: [-2.8, 43.4], zoom: 11, pitch: INCLINACION, bearing: 0 });
  assert.equal(vistaInicial({ lat: 0, lng: 0 }, 1).zoom, 1);
});

test("index.html: botón 3D con su módulo, sin on*= (CSP)", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /import \* as Vista3D from "\/assets\/js\/vista-3d\.js"/);
  assert.match(html, /id="boton3d"/);
  assert.match(html, /registrarEvento\("ver_vista_3d"\)/);
});

test("EMODnet: dentro de sus zonas el relieve fino propio; fuera, AWS", () => {
  assert.match(URL_EMODNET, /^https:\/\/imncbmizxkorotpeisic\.supabase\.co\/storage\/v1\/object\/public\/fuentes-gratuitas\/relieve-emodnet\/\{z\}\/\{x\}\/\{y\}\.png$/);
  assert.ok(zonaEmodnet(43.4, -2.8), "Bizkaia");
  assert.ok(zonaEmodnet(28.1, -15.4), "Canarias");
  assert.equal(zonaEmodnet(-36.8, 174.7), null, "Auckland");
  const es = fuenteRelieve(43.4, -2.8);
  assert.deepEqual(es.tiles, [URL_EMODNET]);
  assert.match(es.attribution, /EMODnet/);
  assert.deepEqual(es.bounds, [-10.5, 35.0, 5.0, 46.5]);
  assert.deepEqual(fuenteRelieve(-36.8, 174.7).tiles, [URL_DEM]);
  const e = estilo3D({ lat: 43.4, lng: -2.8 });
  assert.deepEqual(e.sources.dem.tiles, [URL_EMODNET]);
  assert.deepEqual(e.sources.demTerreno.tiles, [URL_EMODNET]);
  assert.deepEqual(e.sources.demSombra.tiles, [URL_DEM], "sombreado de tierra: AWS al detalle");
  // Mismas zonas en el script que prepara las teselas.
  const py = readFileSync(new URL("../scripts/relieve/emodnet_teselas.py", import.meta.url), "utf8");
  for (const [n, [s, o, no, e]] of Object.entries(ZONAS_EMODNET)) assert.ok(py.includes(`"${n}": [${s.toFixed(1)}, ${o.toFixed(1)}, ${no.toFixed(1)}, ${e.toFixed(1)}]`), n);
});

test("nunca plana: inclinación mínima (Mikel: «cuando lo inclino, pasa a 2D»)", () => {
  assert.equal(INCLINACION_MINIMA, 25);
  const js = readFileSync(new URL("../assets/js/vista-3d.js", import.meta.url), "utf8");
  assert.match(js, /minPitch: INCLINACION_MINIMA/);
  // Más mapa y menos franjas (Mikel): cielo acotado y créditos plegados.
  assert.match(js, /maxPitch: INCLINACION_MAXIMA/);
  assert.match(js, /new gl\.AttributionControl\(\{ compact: true \}\)/);
  assert.match(js, /maplibregl-compact-show/);
});

test("si las teselas de EMODnet aún no están, el 3D usa el relieve de AWS (no se queda en blanco)", () => {
  assert.equal(teselaPrueba(ZONAS_EMODNET.iberia), URL_EMODNET.replace("{z}", "5").replace("{x}", "15").replace("{y}", "12"));
  const e = estilo3D({ lat: 43.4, lng: -2.8 }, false);
  assert.deepEqual(e.sources.dem.tiles, [URL_DEM]);
  assert.deepEqual(e.sources.demTerreno.tiles, [URL_DEM]);
});
