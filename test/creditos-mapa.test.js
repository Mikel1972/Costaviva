// Créditos del mapa (assets/js/creditos-mapa.js, 2026-10-08): en el móvil se
// pliegan en "ⓒ Fuentes" para no tapar el botón ⓘ de la leyenda; en
// escritorio siempre abiertos y empezando a la derecha del ⓘ. Sin red ni DOM.
// Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../assets/js/creditos-mapa.js");
const { debePlegar, textoBoton, ANCHO_MOVIL } = globalThis.CreditosMapa;
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const JS = readFileSync(new URL("../assets/js/creditos-mapa.js", import.meta.url), "utf8");

test("solo se pliegan en el móvil (mismo corte que el @media de index.html)", () => {
  assert.equal(ANCHO_MOVIL, 720);
  for (const w of [360, 390, 430, 720]) assert.equal(debePlegar(w), true, `${w}px`);
  for (const w of [721, 1280, 1440]) assert.equal(debePlegar(w), false, `${w}px`);
  assert.equal(debePlegar(undefined), false);
  assert.equal(debePlegar(0), false);
  assert.match(HTML, /@media \(max-width: 720px\)/);
});

test("el botón dice qué hace y se puede leer", () => {
  assert.deepEqual(textoBoton(false), { texto: "ⓒ Fuentes", etiqueta: "Ver las fuentes y créditos del mapa" });
  assert.equal(textoBoton(true).texto, "✕");
  assert.match(textoBoton(true).etiqueta, /Ocultar/);
});

test("index.html: carga el script, lo monta y los créditos no tapan el ⓘ", () => {
  assert.match(HTML, /<script src="\/assets\/js\/creditos-mapa\.js"><\/script>/);
  assert.match(HTML, /window\.CreditosMapa\.montar\(map,/);
  // Escritorio: la esquina de abajo a la derecha empieza tras el ⓘ (16 + 44 + 16).
  assert.match(HTML, /\.leaflet-bottom\.leaflet-right \{ left: 76px; \}/);
  // Móvil: abiertos no pasan del ⓘ (10 + 40 + 10) y plegados solo queda la píldora.
  assert.match(HTML, /max-width: calc\(100vw - 60px\)/);
  assert.match(HTML, /\.creditos-plegados \.creditos-texto \{ display: none; \}/);
  // Nunca se quita la atribución de Leaflet: solo el prefijo "Leaflet".
  assert.match(HTML, /attributionControl: true/);
  assert.ok(!/attributionControl\.remove\(\)/.test(HTML));
});

test("sin on*= ni colores sueltos (CSP y tokens Amanecer)", () => {
  assert.ok(!/\son[a-z]+=/i.test(JS), "nada de on*= en el script");
  const css = HTML.slice(HTML.indexOf(".creditos-boton {"), HTML.indexOf(".creditos-boton:focus-visible"));
  assert.ok(css.length > 0 && !/#[0-9a-f]{3,6}\b/i.test(css), "el botón usa var(--...)");
});
