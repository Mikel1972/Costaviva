// «Siempre tiene que haber una de atrás» (Mikel, 2026-11-20): todas las
// páginas públicas llevan «← Atrás» o un enlace para volver.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migasHtml } from "../functions/_lib/seo/base.js";

test("migas: siempre «← Atrás» a la página de arriba (o al mapa en la primera)", () => {
  assert.match(migasHtml([{ nombre: "Aprende", ruta: "/aprende" }, { nombre: "Nudo palomar", ruta: "/aprende/nudo-palomar" }]), /class="volver"><a href="\/aprende">← Atrás: Aprende/);
  // En la primera, sin «Atrás: Mapa»: ya está el botón «🗺️ Mapa» (Mikel: «es redundante»).
  assert.doesNotMatch(migasHtml([{ nombre: "Spots", ruta: "/spots" }]), /volver/);
  assert.match(migasHtml([{ nombre: "Tides", ruta: "/en/tides" }, { nombre: "Napier", ruta: "/en/tides/napier" }], "en"), /← Back: Tides/);
});

test("mareas, empieza, clubes, privacidad y términos: con enlace para volver", () => {
  assert.match(readFileSync("functions/mareas/index.js", "utf8"), /class="nav-cv"[\s\S]{0,200}🗺️ Mapa/);
  assert.doesNotMatch(readFileSync("functions/mareas/index.js", "utf8"), /Atrás: Mapa/);
  for (const f of ["functions/mareas/region/[region].js", "functions/mareas/[slug].js"]) {
    assert.match(readFileSync(f, "utf8"), /class="nav-cv"[\s\S]{0,200}← Atrás/, f);
  }
  for (const f of ["empieza.html", "clubes.html", "privacidad.html", "terminos.html"]) {
    assert.match(readFileSync(f, "utf8"), /href="\/"|>Volver /, f);
  }
});
