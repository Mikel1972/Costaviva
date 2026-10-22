// Capa de la flota pesquera faenando (assets/js/capa-flota.js, fase 2,
// 2026-10-22): lo puro (filtro por periodo y eslora, umbral de 3 barcos,
// colores, celdas), los textos en es/en/pt y cómo la monta index.html (solo
// en Embarcación, por el evento `modalidad`). Sin red ni DOM. Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  zonasVisibles, colorFlota, limitesCelda, capaVisible, textoCelda, textoVacio, claveClase,
  MIN_BARCOS, CLASES, PERIODOS, TRAMOS, CADUCA_H,
} from "../assets/js/capa-flota.js";
import { leerDiccionario } from "./i18n-html.js";

const AHORA = new Date("2026-10-22T12:30:00Z");
const RECIENTE = "2026-10-22T12:10:00Z";
const z = (periodo, clase, n, lat = 43.6, lon = -3.1, calculado = RECIENTE) => ({ periodo, clase, n_barcos: n, celda_lat: lat, celda_lon: lon, especie_probable: null, calculado });

test("solo en Embarcación", () => {
  assert.equal(capaVisible("embarcacion"), true);
  for (const m of ["costa", "submarina", undefined]) assert.equal(capaVisible(m), false);
});

test("filtro por periodo (Hoy 24 h / Ayer) y por eslora", () => {
  const filas = [z("24h", "todas", 5), z("24h", "<24", 3), z("ayer", "todas", 4, 43.5), z("ayer", ">40", 3, 43.5)];
  assert.deepEqual(zonasVisibles(filas, { ahora: AHORA }).map((f) => f.n_barcos), [5]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "24h", clase: "<24", ahora: AHORA }).map((f) => f.n_barcos), [3]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "ayer", ahora: AHORA }).map((f) => f.celda_lat), [43.5]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "ayer", clase: "24-40", ahora: AHORA }), []);
  assert.deepEqual(PERIODOS, ["24h", "ayer"]);
  assert.deepEqual(CLASES, ["todas", "<24", "24-40", ">40"]);
});

test("privacidad: aunque llegara una celda con menos de 3 barcos, no se pinta", () => {
  assert.equal(MIN_BARCOS, 3);
  assert.deepEqual(zonasVisibles([z("24h", "todas", 2), z("24h", "todas", 1), z("24h", "todas", "2")], { ahora: AHORA }), []);
  assert.equal(zonasVisibles([z("24h", "todas", "3")], { ahora: AHORA }).length, 1);
});

test("un cálculo caducado (el robot parado) no se enseña como 'últimas 24 h'", () => {
  assert.equal(CADUCA_H, 26);
  const viejo = new Date(AHORA.getTime() - 27 * 3600_000).toISOString();
  assert.deepEqual(zonasVisibles([z("24h", "todas", 9, 43.6, -3.1, viejo)], { ahora: AHORA }), []);
  assert.equal(zonasVisibles(null, { ahora: AHORA }).length, 0);
});

test("color por número de barcos: escala de ámbar a granate, más oscuro con más barcos", () => {
  assert.equal(colorFlota(3), TRAMOS[0].color);
  assert.equal(colorFlota(4), TRAMOS[0].color);
  assert.equal(colorFlota(5), TRAMOS[1].color);
  assert.equal(colorFlota(12), TRAMOS[2].color);
  assert.equal(colorFlota(200), TRAMOS[3].color);
  assert.equal(new Set(TRAMOS.map((t) => t.color)).size, TRAMOS.length);
});

test("celda de 0,05° (~5 km): esquina sur-oeste + paso", () => {
  assert.deepEqual(limitesCelda(43.6, -3.1), [[43.6, -3.1], [43.65, -3.05]]);
  assert.deepEqual(limitesCelda("43.45", "-2.95"), [[43.45, -2.95], [43.5, -2.9]]);
});

test("textos: tooltip con barcos y eslora; vacío según el periodo; especie probable cuando llegue", () => {
  assert.equal(textoCelda(z("24h", "todas", 4)), "4 barcos faenando");
  assert.equal(textoCelda(z("24h", ">40", 3)), "3 barcos faenando · Más de 40 m");
  assert.equal(textoCelda({ ...z("24h", "todas", 6), especie_probable: "anchoa" }), "6 barcos faenando · Probablemente anchoa");
  assert.equal(textoVacio("24h"), "Sin flota faenando registrada en las últimas 24 h");
  assert.equal(textoVacio("ayer"), "Sin flota faenando registrada ayer");
});

test("i18n: todas las claves flota.* en es, en y pt (también las compuestas)", () => {
  const dic = (i) => leerDiccionario(new URL(`../assets/i18n/${i}.js`, import.meta.url));
  const ES = dic("es"), EN = dic("en"), PT = dic("pt");
  const usadas = [...readFileSync(new URL("../assets/js/capa-flota.js", import.meta.url), "utf8").matchAll(/I18n\.t\("(flota\.[\w.]+)"/g)].map((m) => m[1]);
  const compuestas = CLASES.map((c) => `flota.clase.${claveClase(c)}`);
  for (const k of [...usadas, ...compuestas, "flota.vacio_24h", "flota.vacio_ayer", "flota.hoy", "flota.ayer"]) {
    for (const [n, d] of [["es", ES], ["en", EN], ["pt", PT]]) assert.ok(k in d, `${k} en ${n}`);
  }
  assert.equal(ES["flota.hoy"], "Hoy (24 h)");
  assert.equal(ES["flota.ayer"], "Ayer");
  assert.match(ES["flota.atribucion"], /Datos AIS: .*aisstream\.io/);
  assert.match(EN["flota.atribucion"], /AIS data: .*aisstream\.io/);
  assert.match(PT["flota.atribucion"], /Dados AIS: .*aisstream\.io/);
});

test("index.html: carga el módulo, lo monta con flota_zonas y avisa de la modalidad con un evento", () => {
  const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const JS = readFileSync(new URL("../assets/js/capa-flota.js", import.meta.url), "utf8");
  assert.match(HTML, /import \* as Flota from "\/assets\/js\/capa-flota\.js";/);
  assert.match(HTML, /\.from\("flota_zonas"\)/);
  assert.doesNotMatch(HTML, /\.from\("flota_faena"\)|\.from\("flota_barcos"\)/, "las tablas con barcos nunca desde el navegador");
  // La capa no depende de las pestañas: evento `modalidad` desde pintarPestanasModalidad.
  assert.match(HTML, /new CustomEvent\("modalidad", \{ detail: \{ modalidad: vaEstado\.modalidad \} \}\)/);
  const pintar = HTML.slice(HTML.indexOf("function pintarPestanasModalidad"), HTML.indexOf("function elegirModalidad"));
  assert.match(pintar, /avisarModalidad\(\)/);
  assert.match(JS, /document\.addEventListener\("modalidad"/);
  assert.doesNotMatch(JS, /modTab-/);
  // Gratis para todos: nada de premium en la capa.
  assert.doesNotMatch(JS, /premium/i);
  assert.ok(!/\son[a-z]+=/i.test(JS), "sin on*= (CSP)");
});
