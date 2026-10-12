// Glosario del portugués (i18n/glosario-pt.json, 2026-10-11).
//
// Lo que protege:
//   1. Coherencia: si la clave en español usa un término del glosario
//      (pleamar, cebo, spot...), su portugués usa SIEMPRE el término fijado
//      (preia-mar, isco, pesqueiro...), en singular o plural.
//   2. Ninguna variante prohibida (brasileña, anterior al Acuerdo de 1990 o
//      castellana) en todo pt.js.
//   3. Cada término lleva su fuente.
// Sin red: corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerDiccionario } from "./i18n-html.js";

const ES = leerDiccionario(new URL("../assets/i18n/es.js", import.meta.url));
const PT = leerDiccionario(new URL("../assets/i18n/pt.js", import.meta.url));
const GLOSARIO = JSON.parse(readFileSync(new URL("../i18n/glosario-pt.json", import.meta.url), "utf8"));

// Texto visible de un valor (plurales incluidos), sin etiquetas ni URLs.
const texto = (v) => (typeof v === "object" ? Object.values(v).join(" ") : String(v))
  .replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\{\w+\}/g, " ");
// Plural: ligação -> ligações; palavra-passe -> palavras-passe; maré -> marés.
const plural = (t) => (t.endsWith("ão") ? t.slice(0, -2) + "ões" : /-/.test(t) ? t.replace(/^(\p{L}+)-/u, "$1s-") : t + "s");
const palabra = (t) => new RegExp(`(^|[^\\p{L}-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}-])`, "iu");

// Claves donde el término español aparece en otro sentido o en un nombre
// propio: { clave: "motivo" }. Hoy ninguna.
const EXCEPCIONES = {};

test("glosario: cada término con su español, su portugués y su fuente", () => {
  assert.ok(GLOSARIO.terminos.length >= 15);
  for (const t of GLOSARIO.terminos) {
    assert.ok(t.es && t.pt && t.fuente, JSON.stringify(t));
    assert.ok(Array.isArray(t.prohibidos), t.pt);
    new RegExp(t.es, "iu");
  }
});

test("glosario: pt.js usa siempre el término fijado donde es.js usa el español", () => {
  const malas = [];
  for (const t of GLOSARIO.terminos) {
    const reEs = new RegExp(t.es, "iu");
    for (const k of Object.keys(ES)) {
      if (EXCEPCIONES[k] || !reEs.test(texto(ES[k]))) continue;
      const pt = texto(PT[k]);
      if (!palabra(t.pt).test(pt) && !palabra(plural(t.pt)).test(pt)) malas.push(`${k}: «${t.pt}» falta en «${pt.slice(0, 90)}»`);
    }
  }
  assert.deepEqual(malas, []);
});

test("glosario: ninguna variante prohibida ni brasileñismo en pt.js", () => {
  const prohibidos = [...new Set([...GLOSARIO.terminos.flatMap((t) => t.prohibidos), ...GLOSARIO.brasilenismos])];
  const malas = [];
  for (const [k, v] of Object.entries(PT)) {
    const s = texto(v);
    for (const p of prohibidos) if (palabra(p).test(s)) malas.push(`${k}: «${p}»`);
  }
  assert.deepEqual(malas, []);
});

test("portugués europeo: sin «estar + gerundio» (en Portugal, «estar a + infinitivo»)", () => {
  const re = /\b(estou|está|estás|estamos|estão|estava|estavam|fica|ficam)\s+\p{L}+ndo\b/iu;
  assert.deepEqual(Object.entries(PT).filter(([, v]) => re.test(texto(v))).map(([k]) => k), []);
});
