// Contraste con DeepL (scripts/i18n/contraste.mjs, 2026-10-11): las partes
// puras, sin red. La llamada a DeepL solo corre en i18n-contraste.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aplanar, proteger, desproteger, distancia, diferenciasGlosario, comparar, informe, leerDiccionario, UMBRAL } from "../scripts/i18n/contraste.mjs";

const GLOSARIO = JSON.parse(readFileSync(new URL("../i18n/glosario-pt.json", import.meta.url), "utf8"));

test("lee los diccionarios reales y aplana los plurales", () => {
  const es = aplanar(leerDiccionario(readFileSync(new URL("../assets/i18n/es.js", import.meta.url), "utf8")));
  const pt = aplanar(leerDiccionario(readFileSync(new URL("../assets/i18n/pt.js", import.meta.url), "utf8")));
  assert.ok(Object.keys(es).length > 900);
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(es).sort());
  assert.equal(pt["comun.n_dias#one"], "{n} dia");
});

test("las variables {x} no se traducen: se protegen y se recuperan", () => {
  const s = "actualizado hace {minutos} min";
  assert.equal(proteger(s), "actualizado hace <x>{minutos}</x> min");
  assert.equal(desproteger("atualizado há <x>{minutos}</x> min"), "atualizado há {minutos} min");
  assert.equal(desproteger("há <x> {minutos} </x> min"), "há {minutos} min");
  assert.equal(desproteger("quase plana (&lt;0,5 m)"), "quase plana (<0,5 m)", "entidades de DeepL");
});

test("distancia normalizada: 0 iguales, ignora etiquetas, mayúsculas y variables", () => {
  assert.equal(distancia("Maré a encher", "maré a encher"), 0);
  assert.equal(distancia("<b>Em defeso:</b> {n}", "Em defeso: {x}"), 0);
  assert.ok(distancia("Maré a encher", "A maré a encher") < UMBRAL);
  assert.ok(distancia("Terminar sessão", "Encerrar a sessão do utilizador agora") > UMBRAL);
});

test("glosario: marca cuando DeepL y nosotros no usamos el mismo término", () => {
  const g = diferenciasGlosario("🔺 Pleamar a las {hora}", "🔺 Preia-mar às {hora}", "🔺 Maré alta às {hora}", GLOSARIO);
  assert.deepEqual(g, [{ termino: "preia-mar", nuestra: true, deepl: false }]);
  assert.deepEqual(diferenciasGlosario("Cebo", "Isco", "Isco", GLOSARIO), []);
});

test("comparar + informe: solo lo que difiere, en una tabla Markdown", () => {
  const es = { a: "Marea subiendo", b: "Cebo", c: "Pleamar" };
  const nuestras = { a: "Maré a encher", b: "Isco", c: "Preia-mar" };
  const deepl = { a: "Maré a encher", b: "Isca | viva", c: "Maré alta" };
  const filas = comparar(es, nuestras, deepl, GLOSARIO);
  assert.deepEqual(filas.map((f) => f.clave).sort(), ["b", "c"]);
  const md = informe({ idioma: "pt", filas, total: 3, caracteres: 30, fecha: "2026-10-11" });
  assert.match(md, /Claves a revisar: \*\*2\*\*/);
  assert.match(md, /Isca \\\| viva/, "las barras se escapan");
});

test("el workflow es manual, usa el secreto y no gasta API de Anthropic", () => {
  const yml = readFileSync(new URL("../.github/workflows/i18n-contraste.yml", import.meta.url), "utf8");
  assert.match(yml, /workflow_dispatch:/);
  assert.doesNotMatch(yml, /schedule:/);
  assert.match(yml, /DEEPL_API_KEY: \$\{\{ secrets\.DEEPL_API_KEY \}\}/);
  assert.doesNotMatch(yml, /ANTHROPIC_API_KEY|claude -p/);
  const src = readFileSync(new URL("../scripts/i18n/contraste.mjs", import.meta.url), "utf8");
  assert.match(src, /api-free\.deepl\.com/);
  assert.match(src, /PT-PT/);
});
