// test/tierra-capas.test.js
// La tierra por encima de las capas del mar (2026-10-12): polígonos de OSM por
// región y recorte de las imágenes (assets/js/capas-mar.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { factorRecorte, pixelTierra, extenderAlaCosta } from "../assets/js/capas-mar.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(RAIZ, "index.html"), "utf8");

// Punto en polígono (par-impar) sobre todos los anillos de un MultiPolygon.
function enTierra(g, lon, lat) {
  let dentro = false;
  for (const poli of g.features[0].geometry.coordinates) for (const a of poli) {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i], [xj, yj] = a[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

test("tierra de NZ y de España: islas pequeñas dentro, mar fuera, servida en público", () => {
  const nz = JSON.parse(readFileSync(join(RAIZ, "assets/datos/tierra/nz.geojson"), "utf8"));
  const es = JSON.parse(readFileSync(join(RAIZ, "assets/datos/tierra/es.geojson"), "utf8"));
  assert.ok(enTierra(nz, 172.135, -34.155), "Manawatāwhi / Great Island (Three Kings)");
  assert.ok(enTierra(nz, 183.5, -44.0), "Chatham, al este del 180 (+360)");
  assert.ok(enTierra(nz, 175.49, -36.3), "Aotea");
  assert.ok(!enTierra(nz, 174.0, -37.5), "mar de Tasmania");
  assert.ok(enTierra(es, -2.93, 43.26), "Bilbao");
  assert.ok(!enTierra(es, -2.9, 43.6), "mar Cantábrico");
  assert.match(nz.atribucion, /OpenStreetMap/);
  assert.ok(esRutaPermitida("/assets/datos/tierra/nz.geojson"));
});

test("recorte: factor de ampliación, proyección de Leaflet y relleno de la franja de costa", () => {
  assert.equal(factorRecorte(288), 5);
  assert.equal(factorRecorte(2000), 1);
  assert.equal(factorRecorte(10), 8);
  const caja = { norte: -28, sur: -54, oeste: 162, este: 186 };
  assert.deepEqual(pixelTierra(caja, 100, 100, 162, -28).map(Math.round), [0, 0]);
  assert.deepEqual(pixelTierra(caja, 100, 100, 186, -54).map(Math.round), [100, 100]);
  // Mercator: el centro en latitud no cae en la mitad de la imagen.
  assert.ok(pixelTierra(caja, 100, 100, 174, -41)[1] < 50);
  // 3x1: mar | tierra del modelo | mar  ->  la del centro toma la media.
  const px = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0, 30, 40, 50, 255]);
  extenderAlaCosta(px, 3, 1, 1);
  assert.deepEqual([...px.slice(4, 8)], [20, 30, 40, 255]);
});

test("mapa: las capas del mar bajan la tierra de su región y la recortan (no en los trazos)", () => {
  assert.match(html, /cargarTierra\(prefijo === "nz\/" \? "nz" : "es"\)/);
  assert.match(html, /urlSinTierra\(lienzo, d, d, false\)/);
  assert.match(html, /def\.tipo !== "frentes"\)\);/);
});
