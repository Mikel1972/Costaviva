// test/coordenadas.test.js
// Coordenadas al tocar el mapa en Embarcación (2026-11-07): grados y minutos
// decimales para el GPS/plotter, grados decimales para pegar, y el toque del
// mapa en index.html solo las pide en Embarcación.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatoMinutos, formatoDecimal, normalizarLon, partesMinutos, copiarTexto } from "../assets/js/coordenadas.js";
import { I18n } from "../assets/js/i18n-modulo.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(RAIZ, "index.html"), "utf8");
const DIC = Object.fromEntries(["es", "en", "pt"].map((l) => {
  const s = readFileSync(join(RAIZ, "assets", "i18n", `${l}.js`), "utf8");
  return [l, JSON.parse(s.slice(s.indexOf("\n{") + 1, s.lastIndexOf("\n}") + 2))];
}));

test("grados y minutos decimales: el ejemplo de Bizkaia, coma en es/pt y punto en en", () => {
  // 43.40205 = 43° 24,123′; -2.69093 = 2° 41,4558′ ≈ 41,456′ W.
  assert.equal(formatoMinutos(43.40205, -2.69093, { coma: true }), "43° 24,123′ N · 2° 41,456′ W");
  assert.equal(formatoMinutos(43.40205, -2.69093, { coma: false }), "43° 24.123′ N · 2° 41.456′ W");
  // El separador lo da el idioma (I18n.usaComa).
  assert.equal(I18n.usaComa("es"), true);
  assert.equal(I18n.usaComa("pt"), true);
  assert.equal(I18n.usaComa("en"), false);
});

test("sur y oeste por el signo; minutos con dos cifras", () => {
  // Nueva Zelanda (Auckland): -36.8485, 174.7633.
  assert.equal(formatoMinutos(-36.8485, 174.7633, { coma: false }), "36° 50.910′ S · 174° 45.798′ E");
  assert.equal(formatoMinutos(43.05, -9.1, { coma: true }), "43° 03,000′ N · 9° 06,000′ W");
  // Ecuador y meridiano: N y E, sin "-0".
  assert.equal(formatoMinutos(0, 0, { coma: true }), "0° 00,000′ N · 0° 00,000′ E");
  assert.equal(formatoMinutos(-0.000001, -0.000001, { coma: true }), "0° 00,000′ N · 0° 00,000′ E");
});

test("59,9995′ pasa al grado siguiente (nunca 60,000′)", () => {
  const v = 43 + 59.9995 / 60;
  assert.deepEqual(partesMinutos(v, "N", "S"), { grados: 44, minutos: 0, letra: "N" });
  assert.equal(formatoMinutos(v, -(2 + 59.9996 / 60), { coma: true }), "44° 00,000′ N · 3° 00,000′ W");
  // Justo por debajo, se queda.
  assert.equal(formatoMinutos(43 + 59.9994 / 60, 0, { coma: true }).startsWith("43° 59,999′ N"), true);
});

test("grados decimales: punto, signo y 5 decimales; sin -0", () => {
  assert.equal(formatoDecimal(43.402049, -2.690931), "43.40205, -2.69093");
  assert.equal(formatoDecimal(-36.8485, 174.7633), "-36.84850, 174.76330");
  assert.equal(formatoDecimal(-0.000001, -0.000001), "0.00000, 0.00000");
});

test("longitud fuera de -180..180 (Leaflet al cruzar el antimeridiano)", () => {
  assert.equal(normalizarLon(186), -174);
  assert.equal(normalizarLon(-190), 170);
  assert.equal(normalizarLon(180), 180);
  assert.equal(normalizarLon(-2.5), -2.5);
  assert.equal(formatoDecimal(-41, 186), "-41.00000, -174.00000");
  assert.equal(formatoMinutos(-41, 186, { coma: false }), "41° 00.000′ S · 174° 00.000′ W");
});

test("copiarTexto: API del portapapeles y, si falla, execCommand", async () => {
  let copiado = null;
  assert.equal(await copiarTexto("a", { nav: { clipboard: { writeText: async (t) => { copiado = t; } } }, doc: null }), true);
  assert.equal(copiado, "a");
  // Sin API (o rechazada): textarea + execCommand("copy").
  const quitados = [];
  const doc = {
    body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() { quitados.push(1); } }),
    execCommand: (c) => c === "copy",
  };
  assert.equal(await copiarTexto("b", { nav: { clipboard: { writeText: async () => { throw new Error("no"); } } }, doc }), true);
  assert.equal(quitados.length, 1);
  assert.equal(await copiarTexto("c", { nav: {}, doc: { ...doc, execCommand: () => false } }), false);
  assert.equal(await copiarTexto("d", { nav: {}, doc: null }), false);
});

test("textos del globo en es, en y pt", () => {
  for (const k of ["coords.titulo", "coords.copiar", "coords.copiado", "coords.no_copiado", "coords.copiar_minutos", "coords.copiar_decimal", "coords.cerrar"]) {
    for (const l of ["es", "en", "pt"]) assert.ok(DIC[l][k], `${k} en ${l}`);
  }
  assert.equal(DIC.en["coords.copiar"], "Copy");
});

test("index.html: el globo de coordenadas solo en Embarcación, sin on*= y con el módulo cargado", () => {
  assert.match(html, /import \* as Coordenadas from "\/assets\/js\/coordenadas\.js"/);
  assert.match(html, /const conCoordenadas = \(\) => vaEstado\.modalidad === "embarcacion"/);
  // Sin capas de mar y fuera de Embarcación, el toque no abre nada (como antes).
  assert.match(html, /if \(!conCoordenadas\(\) \|\| e\.originalEvent\?\._cvCapa\) return;/);
  // Añadir ubicación manda sobre las coordenadas.
  const i = html.indexOf("map.on(\"click\", (e) => {\n  if (modoAnadirUbicacion) return;");
  assert.ok(i > 0);
  const src = readFileSync(join(RAIZ, "assets", "js", "coordenadas.js"), "utf8");
  assert.doesNotMatch(src, /\son[a-z]+=/);
});
