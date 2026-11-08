// Vista 3D del relieve y del fondo del mar (2026-11-08). Lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ZOOM_MAX_BATIMETRIA, estilo3D, vistaInicial, URL_DEM, COLORES_PROFUNDIDAD, EXAGERACION, INCLINACION } from "../assets/js/vista-3d.js";

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
