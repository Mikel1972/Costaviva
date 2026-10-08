// Tests de la elección de especie del post de Instagram (scripts/marketing/
// especie-post.mjs) y de las especies de temporada que usa el índice de
// pesca (assets/js/ventana-actividad.js). Lógica pura, sin red.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { especiesDeTemporada, vedaActiva, coincideTemperatura, textoMeses } from "../assets/js/ventana-actividad.js";
import { regionDelPost, postEnEuskadi, elegirEspeciePost } from "../scripts/marketing/especie-post.mjs";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const ids = (l) => l.map((e) => e.id);

test("temporada oficial del Cantábrico: lubina abr-dic y chipirón may-dic (Gobierno Vasco)", () => {
  assert.ok(ids(especiesDeTemporada(DATOS, "cantabrico", 6)).includes("lubina"));
  assert.ok(!ids(especiesDeTemporada(DATOS, "cantabrico", 2)).includes("lubina"));
  assert.ok(ids(especiesDeTemporada(DATOS, "cantabrico", 7)).includes("calamar"));
  assert.ok(!ids(especiesDeTemporada(DATOS, "cantabrico", 1)).includes("calamar"));
});

test("abadejo: nunca de temporada durante la veda recreativa (1 ene - 30 abr)", () => {
  const abadejo = DATOS.especies.find((e) => e.id === "abadejo");
  for (const mes of [1, 2, 3, 4]) {
    assert.ok(vedaActiva(abadejo, "cantabrico", mes));
    for (const region of ["cantabrico", "atlantico_norte", "portugal"]) {
      assert.ok(!ids(especiesDeTemporada(DATOS, region, mes)).includes("abadejo"), `${region} mes ${mes}`);
    }
  }
  assert.equal(vedaActiva(abadejo, "cantabrico", 10), null);
  assert.equal(vedaActiva(abadejo, "mediterraneo", 2), null);
});

test("un rango de temperatura de FishBase no cuenta para el índice de pesca", () => {
  const sargo = DATOS.especies.find((e) => e.id === "sargo");
  assert.equal(coincideTemperatura(sargo, 18), null);
  const lubina = DATOS.especies.find((e) => e.id === "lubina");
  assert.equal(coincideTemperatura(lubina, 18), true);
  assert.equal(coincideTemperatura(lubina, 26), false);
  assert.equal(coincideTemperatura(lubina, null), null);
});

test("textoMeses", () => {
  assert.equal(textoMeses([4, 5, 6, 7, 8, 9, 10, 11, 12]), "abr–dic");
  assert.equal(textoMeses([9, 10, 11, 12, 1, 2]), "sep–feb");
  assert.equal(textoMeses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "todo el año");
});

test("región del post según la zona de la rotación; por defecto Cantábrico", () => {
  assert.equal(regionDelPost(null, {}), "cantabrico");
  assert.equal(regionDelPost({ ultimaZona: "Alicante" }, {}), "mediterraneo");
  assert.equal(regionDelPost({ ultimaZona: "Galicia" }, {}), "atlantico_norte");
  assert.equal(regionDelPost({ ultimaZona: "Alicante" }, { REGION_POST: "portugal" }), "portugal");
  assert.equal(postEnEuskadi({ ultimaZona: "País Vasco — Bizkaia" }, {}), true);
  assert.equal(postEnEuskadi({ ultimaZona: "Cantabria" }, {}), false);
});

test("post: siempre una especie de temporada y fuera de veda, sin datos de FishBase", () => {
  for (const region of ["cantabrico", "atlantico_norte", "mediterraneo"]) {
    for (let mes = 1; mes <= 12; mes++) {
      for (let dia = 0; dia < 5; dia++) {
        const r = elegirEspeciePost(DATOS, region, mes, dia, { euskadi: region === "cantabrico" });
        if (!r) continue;
        assert.ok(r.especie.presencia[region].meses.includes(mes));
        assert.equal(vedaActiva(r.especie, region, mes), null);
        assert.doesNotMatch(r.nota, /FishBase/i);
      }
    }
  }
  const r = elegirEspeciePost(DATOS, "cantabrico", 10, 0, { euskadi: true });
  assert.match(r.nota, /Temporada en el Cantábrico/);
});
