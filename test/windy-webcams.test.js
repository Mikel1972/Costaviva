// Webcams de Windy con su reproductor (2026-11-17, permiso de Windy con dos
// condiciones: gratis para todos y atribución con dos enlaces).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMARAS_EXTERNAS, CONDICIONES, htmlCamarasWindy, esCamaraWindy, ATRIBUCION_WINDY, ORIGEN_IFRAME_WINDY } from "../assets/js/camaras-externas.js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

test("cada cámara de Windy lleva su reproductor oficial y nunca se analiza", () => {
  const w = CAMARAS_EXTERNAS.filter(esCamaraWindy);
  assert.ok(w.length >= 1);
  for (const c of w) {
    assert.equal(c.modo, "iframe_oficial");
    assert.equal(c.iframe, `${ORIGEN_IFRAME_WINDY}/webcams/public/embed/player/${c.windy_id}/day`);
    assert.equal(c.analisis_permitido, false);
  }
  assert.equal(CONDICIONES.windy.analisis_permitido, false);
});

test("atribución exacta de Windy con sus dos enlaces", () => {
  const html = htmlCamarasWindy(CAMARAS_EXTERNAS.filter(esCamaraWindy).slice(0, 1), "es", (k) => k);
  assert.match(html, /Webcams provided by <a href="https:\/\/www\.windy\.com" target="_blank" rel="noopener">windy\.com<\/a> - <a href="https:\/\/www\.windy\.com\/webcams\/add" target="_blank" rel="noopener">add new webcam<\/a>/);
  assert.equal(ATRIBUCION_WINDY.texto, "Webcams provided by {windy} - {add}");
  assert.equal(htmlCamarasWindy([], "es", (k) => k), "");
});

test("gratis para todos: el bloque de Windy no se oculta sin Premium y la CSP deja su iframe", () => {
  const index = leer("index.html");
  assert.match(index, /<div id="panelWindyBox"/);
  assert.doesNotMatch(index, /sin-premium[^{]*#panelWindyBox/);
  // El bloque Premium de webcams no incluye las de Windy.
  const i = index.indexOf('<div id="panelWebcamBox"');
  const j = index.indexOf('<div id="panelWindyBox"');
  assert.ok(j > i && index.slice(i, j).split("<div").length - 1 === index.slice(i, j).split("</div>").length - 1, "panelWindyBox fuera de panelWebcamBox");
  assert.match(leer("functions/_middleware.js"), /\.\.\.ORIGENES_IFRAME_NZ, ORIGEN_IFRAME_WINDY\]/);
});
