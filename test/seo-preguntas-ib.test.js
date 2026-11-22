// Preguntas frecuentes y «peces de la zona» también en inglés y portugués
// (2026-11-22, GSC: «diferencia entre chipirón y calamar», «peces de galicia»).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crearPaginasIb } from "../functions/_lib/seo/paginas-ib.js";
import { SPOTS } from "../functions/_lib/seo/carga.js";

const d = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url)));
const calamar = d.especies.find((e) => e.id === "calamar");

test("toda pregunta frecuente tiene fuente con enlace y traducción a en y pt", () => {
  for (const e of d.especies) {
    for (const q of e.preguntas || []) {
      assert.ok((q.fuentes || []).length && q.fuentes.every((id) => d.fuentes[id]?.url), `${e.id}: ${q.pregunta}`);
      for (const i of ["en", "pt"]) assert.ok(q[`pregunta_${i}`] && q[`respuesta_${i}`], `${e.id} ${i}: ${q.pregunta}`);
    }
  }
});

for (const [idioma, titulo, peces] of [["pt", "Perguntas frequentes", "Peixes de"], ["en", "Frequently asked questions", "Fish of"]]) {
  test(`${idioma}: el calamar enseña sus preguntas con FAQPage y Galicia todos sus peces`, () => {
    const P = crearPaginasIb(idioma);
    const h = P.paginaEspecie(calamar, d, SPOTS, 11).html;
    assert.ok(h.includes(titulo));
    assert.ok(h.includes('"FAQPage"'));
    assert.ok(h.includes(calamar.preguntas[0][`pregunta_${idioma}`]));
    assert.ok(h.includes(d.fuentes.mercasa_calamar.url));
    const r = P.paginaRegionSpots("galicia", SPOTS, d, 11).html;
    assert.ok(r.includes(peces));
    assert.ok((r.match(/<li[^>]*><a href="[^"]*(?:especies|species)\//g) || []).length >= 20);
  });
}
