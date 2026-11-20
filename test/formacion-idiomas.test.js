// Centro de formación en tres idiomas (2026-11-20, Mikel: «todo lo que
// hagamos debe estar en todos los idiomas»): /aprende, /en/aprende y
// /pt/aprende con las mismas fichas.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { paginaIndiceFormacion, paginaFicha } from "../functions/_lib/seo/paginas-formacion.js";

const leer = (r) => JSON.parse(readFileSync(r, "utf8"));
const ES = leer("assets/datos/formacion.json");
const IDIOMAS = { en: leer("assets/datos/formacion.en.json"), pt: leer("assets/datos/formacion.pt.json") };
const GLOSARIO = leer("i18n/glosario-pt.json");

test("formación: inglés y portugués con las mismas fichas, temas y capítulos que el español", () => {
  for (const [l, d] of Object.entries(IDIOMAS)) {
    assert.deepEqual(d.fichas.map((f) => f.id), ES.fichas.map((f) => f.id), l);
    assert.deepEqual(d.fichas.map((f) => f.tema), ES.fichas.map((f) => f.tema), l);
    assert.deepEqual(Object.keys(d.temas), Object.keys(ES.temas), l);
    assert.deepEqual(d.capitulos.map((c) => [c.id, c.temas]), ES.capitulos.map((c) => [c.id, c.temas]), l);
    for (const [i, f] of d.fichas.entries()) {
      const e = ES.fichas[i];
      // Mismas fuentes (las URL no se traducen) y mismos bloques.
      assert.deepEqual((f.fuentes || []).map((x) => x.url), (e.fuentes || []).map((x) => x.url), `${l} ${f.id}`);
      for (const k of ["pasos", "como_es", "medidas", "usos_costa", "usos_embarcacion", "colores", "por_especie", "pasarse"]) assert.equal((f[k] || []).length, (e[k] || []).length, `${l} ${f.id} ${k}`);
      assert.notEqual(f.nombre, "", `${l} ${f.id}`);
    }
  }
});

test("formación en portugués: sin variantes prohibidas ni brasileñismos del glosario", () => {
  const prohibidos = [...new Set([...GLOSARIO.terminos.flatMap((t) => t.prohibidos), ...GLOSARIO.brasilenismos])];
  const texto = JSON.stringify(IDIOMAS.pt.fichas.map(({ fuentes, fuente, imagen, resistencia, ...r }) => r));
  const palabra = (t) => new RegExp(`(^|[^\\p{L}-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}-])`, "iu");
  assert.deepEqual(prohibidos.filter((p) => palabra(p).test(texto)), []);
});

test("formación: páginas en inglés y portugués con su idioma, enlaces propios y hreflang a los tres", () => {
  for (const [l, d] of Object.entries(IDIOMAS)) {
    const indice = paginaIndiceFormacion(d, l).html;
    assert.match(indice, new RegExp(`<html lang="${l === "pt" ? "pt-PT" : "en"}"`));
    assert.match(indice, new RegExp(`href="/${l}/aprende/nudo-palomar"`));
    assert.doesNotMatch(indice, /en preparación/);
    for (const f of d.fichas) {
      const { html } = paginaFicha(d, f, l);
      assert.match(html, /hreflang="es"/, `${l} ${f.id}`);
      assert.match(html, new RegExp(`hreflang="${l === "pt" ? "pt-PT" : "en"}" href="https://costaviva.org/${l}/aprende/${f.id}"`), `${l} ${f.id}`);
      assert.doesNotMatch(html, /Desde costa|Paso a paso|Fuentes</, `${l} ${f.id}: texto en español`);
    }
  }
  assert.ok(existsSync("functions/en/aprende/[slug].js") && existsSync("functions/pt/aprende/[slug].js"));
});
