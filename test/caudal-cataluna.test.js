// Parser del caudal de la Agència Catalana de l'Aigua (functions/prevision.js,
// dataset 2bwe-vgpr de dades obertes de la Generalitat). Filas reales del
// 2026-10-21/22, recortadas a los campos que se usan. Sustituye la PR #220.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsearCaudalCataluna, CAUDAL_CATALUNYA_ESTACIONES } from "../functions/prevision.js";
import { RIOS_SPOT } from "../functions/_lib/seo/datos.js";

const filas = [
  { dia: "2026-10-22T00:00:00.000", codi_variable: "4140493", estaci: "Aforament - Qualitat - Castelló d'Empúries", cabal_riu_m3_s: "0.503" },
  { dia: "2026-10-22T00:00:00.000", codi_variable: "4343824", estaci: "Aforament - Qualitat - Fogars de la Selva (Can Simó)", cabal_riu_m3_s: "3.295" },
  { dia: "2026-10-21T00:00:00.000", codi_variable: "4140493", estaci: "Aforament - Qualitat - Castelló d'Empúries", cabal_riu_m3_s: "0.533" },
  { dia: "2026-10-21T00:00:00.000", codi_variable: "4343824", estaci: "Aforament - Qualitat - Fogars de la Selva (Can Simó)", cabal_riu_m3_s: "3.410" },
];

test("tordera y muga: el dato más reciente de cada estación", () => {
  assert.deepEqual(parsearCaudalCataluna(filas), {
    tordera: { caudal: 3.295, actualizado: "2026-10-22", estacion: "Fogars de la Selva (Can Simó)" },
    muga: { caudal: 0.503, actualizado: "2026-10-22", estacion: "Castelló d'Empúries" },
  });
});

test("no depende del orden de las filas ni se lía con otras estaciones", () => {
  const otra = { dia: "2026-10-23T00:00:00.000", codi_variable: "4140492", cabal_riu_m3_s: "9.9" };
  const r = parsearCaudalCataluna([otra, ...filas].reverse());
  assert.equal(r.muga.caudal, 0.503);
  assert.equal(r.tordera.caudal, 3.295);
});

test("caudal vacío o no numérico: se usa el día anterior; sin filas, null", () => {
  const r = parsearCaudalCataluna([{ ...filas[1], cabal_riu_m3_s: "" }, filas[3]]);
  assert.equal(r.tordera.caudal, 3.41);
  assert.equal(r.tordera.actualizado, "2026-10-21");
  assert.equal(r.muga, null);
  assert.deepEqual(parsearCaudalCataluna(null), { tordera: null, muga: null });
  assert.deepEqual(parsearCaudalCataluna({ error: "x" }), { tordera: null, muga: null });
});

test("cada estación tiene su río en RIOS (index.html) y en RIOS_SPOT", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const e of CAUDAL_CATALUNYA_ESTACIONES) {
    assert.ok(html.includes(`slugCaudal: "${e.slugRio}"`), e.slugRio);
    assert.ok(Object.values(RIOS_SPOT).some((r) => r.clave === e.slugRio), e.slugRio);
  }
  assert.equal(RIOS_SPOT.blanes?.rio, "Tordera");
  assert.equal(RIOS_SPOT.roses?.rio, "Muga");
});

test("la leyenda de ríos cita Tordera, Muga y la ACA en los tres idiomas", () => {
  for (const idioma of ["es", "en", "pt"]) {
    const src = readFileSync(new URL(`../assets/i18n/${idioma}.js`, import.meta.url), "utf8");
    const linea = src.split("\n").find((l) => l.includes('"mapa.leyenda.rios"'));
    assert.ok(linea, idioma);
    for (const t of ["Tordera", "Muga", "Agència Catalana de l'Aigua"]) assert.ok(linea.includes(t), `${idioma}: ${t}`);
  }
});
