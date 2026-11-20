// Revisor de espejos (2026-11-20, Mikel: «crea un agente que revise que
// siempre son espejos»). Sin IA: cada página pública del sitemap tiene que
// existir en español, inglés y portugués. Lo que aún falta está en
// datos-robots/seo/espejo-pendientes.json y solo puede encoger.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { huecos, locsDeSitemap, claveDeUrl } from "../scripts/seo/espejo.mjs";

const PENDIENTES = JSON.parse(readFileSync("datos-robots/seo/espejo-pendientes.json", "utf8")).faltan;
const FALTAN = huecos(locsDeSitemap(readFileSync("sitemap.xml", "utf8")));

test("espejo: cada ruta se reduce a la misma clave en los tres idiomas", () => {
  assert.deepEqual(claveDeUrl("https://costaviva.org/mareas/bakio"), { idioma: "es", clave: "mareas/bakio" });
  assert.deepEqual(claveDeUrl("https://costaviva.org/en/tides/bakio"), { idioma: "en", clave: "mareas/bakio" });
  assert.deepEqual(claveDeUrl("https://costaviva.org/pt/especies/lubina"), { idioma: "pt", clave: "especies/lubina" });
  assert.deepEqual(claveDeUrl("https://costaviva.org/en/species/lubina"), { idioma: "en", clave: "especies/lubina" });
  assert.deepEqual(claveDeUrl("https://costaviva.org/"), { idioma: "es", clave: "inicio" });
});

test("espejo: ninguna página nueva sin su versión en los tres idiomas", () => {
  const nuevos = FALTAN.filter((h) => !PENDIENTES.includes(h));
  assert.deepEqual(nuevos, [], "Página publicada en un idioma y no en los otros: tradúcela o crea su versión (es/en/pt).");
});

test("espejo: la lista de pendientes solo encoge (quita lo que ya está cubierto)", () => {
  const cubiertos = PENDIENTES.filter((h) => !FALTAN.includes(h));
  assert.deepEqual(cubiertos, [], "Ya tienen espejo: node scripts/seo/espejo.mjs --escribir");
});

test("espejo: el centro de formación está completo en los tres idiomas", () => {
  assert.deepEqual(FALTAN.filter((h) => / aprende/.test(h)), []);
});
