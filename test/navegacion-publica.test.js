// «Siempre tiene que haber una de atrás» (Mikel, 2026-11-20): todas las
// páginas públicas llevan «← Atrás» o un enlace para volver.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migasHtml } from "../functions/_lib/seo/base.js";

test("migas: siempre «← Atrás» a la página de arriba (o al mapa en la primera)", () => {
  assert.match(migasHtml([{ nombre: "Aprende", ruta: "/aprende" }, { nombre: "Nudo palomar", ruta: "/aprende/nudo-palomar" }]), /class="volver"><a href="\/aprende">← Atrás: Aprende/);
  assert.match(migasHtml([{ nombre: "Spots", ruta: "/spots" }]), /href="\/">← Atrás: Mapa/);
  assert.match(migasHtml([{ nombre: "Tides", ruta: "/en/tides" }], "en"), /← Back: Map/);
});

test("mareas, empieza, clubes, privacidad y términos: con enlace para volver", () => {
  for (const f of ["functions/mareas/index.js", "functions/mareas/region/[region].js", "functions/mareas/[slug].js"]) {
    assert.match(readFileSync(f, "utf8"), /class="nav-cv"[\s\S]{0,200}← Atrás/, f);
  }
  for (const f of ["empieza.html", "clubes.html", "privacidad.html", "terminos.html"]) {
    assert.match(readFileSync(f, "utf8"), /href="\/"|>Volver /, f);
  }
});
