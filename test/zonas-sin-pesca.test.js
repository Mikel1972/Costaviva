// test/zonas-sin-pesca.test.js
// Capa "Zonas sin pesca" (2026-10-12): datos públicos por región, estilo
// (trama roja / naranja) y que el mapa la monta siempre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { estiloZona, esSinPesca, regionVisible, REGIONES_ZONAS, ZOOM_MIN_ZONAS, ID_TRAMA } from "../assets/js/zonas-sin-pesca.js";
import { zonasNZ, normalizarGeometria } from "../scripts/fuentes/zonas-sin-pesca.mjs";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (f) => JSON.parse(readFileSync(join(RAIZ, f), "utf8"));
const html = readFileSync(join(RAIZ, "index.html"), "utf8");

test("estilo: rojo para no pesca, naranja discontinuo para protección del fondo", () => {
  assert.equal(estiloZona("reserva").color, "#D0021B");
  assert.equal(estiloZona("hpa").className, "zona-sin-pesca");
  assert.equal(estiloZona("spa").className, "zona-fondo");
  assert.ok(estiloZona("spa").dashArray);
  assert.ok(esSinPesca("reserva") && esSinPesca("hpa") && !esSinPesca("spa"));
  assert.match(html, /\.zona-sin-pesca \{ fill: url\(#tramaZonaSinPesca\); \}/);
  assert.equal(ID_TRAMA, "tramaZonaSinPesca");
});

test("NZ: las 68 zonas del DOC, en la copia del mundo del mapa (162..186) y públicas", () => {
  const doc = json("datos/nz/reservas-marinas-doc.geojson");
  const nz = json("assets/datos/zonas-sin-pesca/nz.geojson");
  assert.deepEqual(nz, JSON.parse(JSON.stringify(zonasNZ(doc))), "regenerar con scripts/fuentes/zonas-sin-pesca.mjs");
  assert.equal(nz.features.length, doc.features.length);
  assert.match(nz.atribucion, /Te Papa Atawhai 2025/);
  for (const f of nz.features) {
    const c = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of c) for (const a of p) for (const [lon] of a) assert.ok(lon >= 160 && lon <= 186, `${f.properties.nombre}: ${lon}`);
  }
  assert.ok(nz.features.some((f) => /Kermadec/.test(f.properties.nombre)));
  assert.ok(esRutaPermitida(REGIONES_ZONAS.nz.url), "el fichero de la capa se sirve en público");
  assert.deepEqual(normalizarGeometria({ type: "Polygon", coordinates: [[[-178.12345, -29.1], [179.5, -29.2]]] }, 0).coordinates, [[[181.8766, -29.1], [179.5, -29.2]]]);
});

test("región visible: también una vuelta del mundo más allá; desde zoom 4", () => {
  const caja = REGIONES_ZONAS.nz.caja;
  assert.ok(regionVisible(caja, { sur: -40, norte: -35, oeste: 170, este: 178 }));
  assert.ok(regionVisible(caja, { sur: -45, norte: -42, oeste: -178, este: -175 }), "Chatham en la copia de -180");
  assert.ok(!regionVisible(caja, { sur: 40, norte: 44, oeste: -10, este: 4 }), "España no pide NZ");
  assert.equal(ZOOM_MIN_ZONAS, 4);
});

test("mapa: la capa se monta siempre (sin botón) y sale en la leyenda", () => {
  assert.match(html, /import \* as ZonasSinPesca from "\/assets\/js\/zonas-sin-pesca\.js";/);
  assert.match(html, /Z\.montarCapa\(map, L, \{/);
  assert.match(html, /data-i18n="mapa\.leyenda\.zonas"/);
});

test("España: zonas de los textos legales, cada una con su norma; rojas sin pesca y naranjas parciales", async () => {
  const { zonasESconBaleares, anadirTraducciones, leerTraduccionesReglas } = await import("../scripts/fuentes/zonas-sin-pesca.mjs");
  const boe = json("datos/es/zonas-sin-pesca-boe.geojson");
  const ideib = json("datos/es/reservas-marines-ideib.geojson");
  const es = json("assets/datos/zonas-sin-pesca/es.geojson");
  assert.deepEqual(es, JSON.parse(JSON.stringify(anadirTraducciones(zonasESconBaleares(boe, ideib), leerTraduccionesReglas()))), "regenerar con scripts/fuentes/zonas-sin-pesca.mjs");
  assert.equal(es.features.length, boe.features.length + ideib.features.length);
  for (const f of es.features) {
    assert.ok(["reserva", "parcial"].includes(f.properties.tipo), f.properties.nombre);
    assert.ok(f.properties.regla && f.properties.norma, `${f.properties.nombre}: regla y norma`);
    assert.match(f.properties.url, /^https:\/\//);
  }
  const nombres = es.features.filter((f) => f.properties.tipo === "reserva").map((f) => f.properties.nombre).join(" | ");
  for (const r of ["Cabo de Palos", "Tabarca", "Columbretes", "Cabo de Gata", "Alborán", "Graciosa", "Restinga", "La Palma", "Masía Blanca", "Cabo Tiñoso", "Cabrera", "Medes"]) {
    assert.match(nombres, new RegExp(r), r);
  }
  assert.ok(!esSinPesca("parcial"));
  assert.equal(estiloZona("parcial").className, "zona-fondo");
  assert.ok(esRutaPermitida(REGIONES_ZONAS.es.url));
  assert.ok(regionVisible(REGIONES_ZONAS.es.caja, { sur: 37, norte: 38, oeste: -1, este: 0 }));
});

test("Portugal: zonas del Diário da República (continente, Madeira y Azores)", async () => {
  const { zonasPT, anadirTraducciones, leerTraduccionesReglas } = await import("../scripts/fuentes/zonas-sin-pesca.mjs");
  const dr = json("datos/pt/zonas-sin-pesca-dr.geojson");
  const pt = json("assets/datos/zonas-sin-pesca/pt.geojson");
  assert.deepEqual(pt, JSON.parse(JSON.stringify(anadirTraducciones(zonasPT(dr), leerTraduccionesReglas()))), "regenerar con scripts/fuentes/zonas-sin-pesca.mjs");
  assert.equal(pt.region, "pt");
  for (const f of pt.features) assert.ok(f.properties.regla && f.properties.norma && /^https:\/\//.test(f.properties.url), f.properties.nombre);
  const nombres = pt.features.map((f) => f.properties.nombre).join(" | ");
  for (const r of ["Berlengas", "Garajau", "Selvagens", "Desertas"]) assert.match(nombres, new RegExp(r), r);
  assert.ok(regionVisible(REGIONES_ZONAS.pt.caja, { sur: 37.5, norte: 39, oeste: -29, este: -27 }), "Azores");
  assert.ok(esRutaPermitida(REGIONES_ZONAS.pt.url));
});

test("reglas de España y Portugal también en portugués y en inglés (DeepL revisado)", () => {
  for (const r of ["es", "pt"]) {
    for (const f of json(`assets/datos/zonas-sin-pesca/${r}.geojson`).features) {
      if (!f.properties.regla) continue;
      assert.ok(f.properties.regla_pt && f.properties.regla_en, `${f.properties.nombre}: falta traducción (traducir-reglas-zonas.yml)`);
    }
  }
  // Revisiones a mano que DeepL había cambiado de sentido.
  const pt = JSON.stringify(json("assets/datos/zonas-sin-pesca/pt.geojson"));
  assert.match(pt, /a apanha só é permitida a residentes/);
  assert.doesNotMatch(pt, /garoupa/);
  assert.match(html, /idioma: I18n\.idioma\(\),/);
});

test("Baleares: reservas del Govern balear del IDEIB con la cita exacta que pide el ICGIB (2026-11-10)", async () => {
  const { convertirIDEIB, ATRIBUCION_IDEIB, SERVICIO_IDEIB } = await import("../scripts/fuentes/ideib-reservas-marines.mjs");
  const es = json("assets/datos/zonas-sin-pesca/es.geojson");
  assert.match(es.atribucion, /Servei de mapa de les Reserves Marines de les Illes Balears<\/a> CC BY-SA 4\.0 Govern de les Illes Balears, Direcció General de Pesca/);
  assert.ok(es.atribucion.includes(`href="${SERVICIO_IDEIB}"`));
  assert.equal(SERVICIO_IDEIB, "https://ideib.caib.es/geoserveis/rest/services/public/GOIB_ReservesMarines/");
  const ideib = json("datos/es/reservas-marines-ideib.geojson");
  assert.equal(ideib.atribucion, ATRIBUCION_IDEIB);
  const nombres = ideib.features.map((f) => f.properties.reserva).join(" | ");
  for (const r of ["Badia de Palma", "Migjorn de Mallorca", "Freus d'Eivissa", "Nord de Menorca", "Tagomago", "Illa de l’Aire"]) assert.ok(nombres.includes(r), r);
  // Sin repetidos ni zonas de buceo; las estatales vienen del BOE.
  const props = (geo) => ({ OBJECTID: geo.id, NOM: "X", PROTECCIO: geo.p, NORMA: null, URL: "http://www.caib.es/a", "SHAPE.AREA": 5000 });
  const g = { type: "Polygon", coordinates: [[[3, 39], [3.1, 39], [3.1, 39.1], [3, 39]]] };
  const prueba = convertirIDEIB({ features: [
    { properties: props({ id: 2, p: "Reserva integral" }), geometry: g },
    { properties: props({ id: 1, p: "Reserva integral" }), geometry: g },
    { properties: props({ id: 3, p: "Zona especial de busseig" }), geometry: g },
    { properties: props({ id: 4, p: "Reserva marina" }), geometry: g },
  ] });
  assert.equal(prueba.features.length, 2);
  assert.equal(prueba.features[0].properties.ideib_objectid, 1);
  assert.equal(prueba.features[0].properties.tipo, "sin_pesca");
  assert.equal(prueba.features[1].properties.tipo, "parcial");
  assert.match(prueba.features[0].properties.referencia.url, /^https:\/\//);
});
