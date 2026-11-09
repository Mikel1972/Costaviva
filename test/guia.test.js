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
