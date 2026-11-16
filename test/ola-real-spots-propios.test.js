// "Ola real que veo" también en los spots propios (2026-11-16, Mikel en
// Lemoiz: "en otros sitios sí").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function cargar(nombre) {
  const i = html.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0);
  let n = 0;
  for (let j = html.indexOf("{", i); j < html.length; j++) {
    if (html[j] === "{") n++;
    else if (html[j] === "}" && --n === 0) return new Function(`${html.slice(i, j + 1)}; return ${nombre};`)();
  }
}
const slugEtiquetaOla = cargar("slugEtiquetaOla");

test("spot propio (Lemoiz): 'u' + uuid sin guiones, dentro del CHECK de la tabla", () => {
  const s = slugEtiquetaOla({ slug: "d8d7d347-b333-44b1-b840-c0b2165548e6", esUsuario: true });
  assert.equal(s, "ud8d7d347b33344b1b840c0b2165548e6");
  assert.match(s, /^[a-z0-9]{2,40}$/);
});

test("spot del catálogo: su slug de siempre; sin slug, sin botón", () => {
  assert.equal(slugEtiquetaOla({ slug: "zarautz" }), "zarautz");
  assert.equal(slugEtiquetaOla({}), null);
  assert.match(html, /spot_slug: slugEtiquetaOla\(s\)/);
  assert.doesNotMatch(html, /window\.usuarioIdActual && s && !s\.esUsuario\)/);
});
