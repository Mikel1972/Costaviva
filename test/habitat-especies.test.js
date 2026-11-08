// Fondo que necesita cada especie (2026-11-08, Mikel: "el rodaballo es de
// fondos de arena: en Armintza es imposible").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { topeHabitat, TOPE_HABITAT } from "../assets/js/ventana-actividad.js";

const datos = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const esp = (id) => datos.especies.find((e) => e.id === id);
const ARMINTZA = { orilla_tipo: "acantilado", fondo_roca: 0.85, fondo_arena: 0.05, fondo_fango: 0, fondo_grava: 0 };
const BAKIO = { orilla_tipo: "playa_arena", fondo_roca: 0.18, fondo_arena: 0.82 };

test("hábitat: rodaballo en roca (Armintza) queda en pocas probabilidades; en la playa de Bakio, no", () => {
  const r = topeHabitat(esp("rodaballo"), ARMINTZA, "costa");
  assert.deepEqual(r, { tope: TOPE_HABITAT, prefiere: "arena", hay: "roca" });
  assert.equal(topeHabitat(esp("rodaballo"), BAKIO, "costa"), null);
});

test("hábitat: peces de roca en una playa de arena sin roca quedan limitados; en roca, no", () => {
  const playa = { orilla_tipo: "playa_arena", fondo_roca: 0.02, fondo_arena: 0.98 };
  assert.equal(topeHabitat(esp("congrio"), playa, "costa")?.prefiere, "roca");
  assert.equal(topeHabitat(esp("congrio"), ARMINTZA, "costa"), null);
});

test("hábitat: sin dato de fondo, en embarcación o sin preferencia no limita", () => {
  assert.equal(topeHabitat(esp("rodaballo"), null, "costa"), null);
  assert.equal(topeHabitat(esp("rodaballo"), ARMINTZA, "embarcacion"), null);
  assert.equal(topeHabitat(esp("lubina"), ARMINTZA, "costa"), null);
  assert.equal(topeHabitat(esp("rodaballo"), { orilla_tipo: null, fondo_roca: null }, "costa"), null);
});

test("hábitat: cada preferencia de fondo es arena, fango o roca y lleva fuente", () => {
  const con = datos.especies.filter((e) => e.sustrato);
  assert.ok(con.length >= 16);
  for (const e of con) {
    assert.ok(e.sustrato.preferido.every((x) => ["arena", "fango", "roca"].includes(x)), e.id);
    assert.ok(Array.isArray(e.sustrato.fuentes), e.id);
  }
});
