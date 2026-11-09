// Guía «Cómo funciona» (2026-11-09).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pantallasGuia } from "../assets/js/guia.js";

const dic = (idioma) => readFileSync(new URL(`../assets/i18n/${idioma}.js`, import.meta.url), "utf8");

test("una pantalla por idea, adaptadas a la modalidad", () => {
  for (const m of ["costa", "embarcacion", "submarina"]) {
    const p = pantallasGuia(m);
    assert.equal(p.length, 9);
    assert.ok(p.some((x) => x.id === `mod_${m}_1`) && p.some((x) => x.id === `mod_${m}_2`), m);
  }
  assert.deepEqual(pantallasGuia("rara").map((x) => x.id), pantallasGuia("costa").map((x) => x.id));
});

test("todos los textos están en es, en y pt", () => {
  const claves = new Set(["guia.pregunta", "guia.pregunta_texto", "guia.saltar", "guia.siguiente", "guia.terminar", "comun.menu.guia"]);
  for (const m of ["costa", "embarcacion", "submarina"]) {
    claves.add(`guia.op_${m}`);
    for (const p of pantallasGuia(m)) { claves.add(`guia.${p.id}.titulo`); claves.add(`guia.${p.id}.texto`); }
  }
  for (const idioma of ["es", "en", "pt"]) {
    const d = dic(idioma);
    for (const k of claves) assert.ok(d.includes(`"${k}"`), `${idioma}: falta ${k}`);
  }
});

test("el menú 👤 de cada página con sesión tiene «Cómo funciona» y carga la guía", () => {
  for (const p of ["index.html", "diario.html", "grupos.html", "alarma.html"]) {
    const h = readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    assert.match(h, /id="btnGuia"/, p);
    assert.match(h, /src="\/assets\/js\/guia\.js"/, p);
  }
});

import { BOTONES, posicionGlobo } from "../assets/js/guia-botones.js";

test("qué es cada botón: cada uno tiene nombre y explicación en es, en y pt", () => {
  for (const idioma of ["es", "en", "pt"]) {
    const d = dic(idioma);
    for (const b of BOTONES) for (const c of ["titulo", "texto"]) assert.ok(d.includes(`"guia.b.${b.id}.${c}"`), `${idioma}: guia.b.${b.id}.${c}`);
  }
  const h = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const b of BOTONES.filter((x) => x.sel.startsWith("#"))) assert.ok(h.includes(`id="${b.sel.slice(1)}"`) || b.id === "region" || b.id === "tresd", `${b.sel} no está en index.html`);
});

test("el globo nunca se sale de la pantalla", () => {
  const p = { w: 390, h: 800 }, g = { w: 280, h: 90 };
  assert.deepEqual(posicionGlobo({ x: 380, y: 20 }, g, p), { left: 100, top: 38 }, "arriba a la derecha: debajo y dentro");
  assert.deepEqual(posicionGlobo({ x: 10, y: 780 }, g, p), { left: 10, top: 672 }, "abajo a la izquierda: encima");
});
