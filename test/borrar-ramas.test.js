// Pruebas de scripts/ramas/borrar-ramas-fusionadas.mjs (copia del de comun).
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidir } from "../scripts/ramas/borrar-ramas-fusionadas.mjs";

const rama = (name, sha = "s1") => ({ name, commit: { sha } });
const sin = { abiertas: new Set(), fusionadas: new Map(), comparacion: "diverged" };

test("borrar-ramas: main y las ramas con PR abierta se quedan", () => {
  assert.equal(decidir(rama("main"), sin), "main");
  assert.equal(decidir(rama("robot/x"), { ...sin, abiertas: new Set(["robot/x"]) }), "PR abierta");
});

test("borrar-ramas: se borra si está dentro de main o es el último commit de una PR fusionada", () => {
  assert.equal(decidir(rama("x"), { ...sin, comparacion: "behind" }), null);
  assert.equal(decidir(rama("x", "s9"), { ...sin, fusionadas: new Map([["x", new Set(["s9"])]]) }), null);
});

test("borrar-ramas: con trabajo que no está en main, se queda", () => {
  assert.equal(decidir(rama("x", "s10"), { ...sin, fusionadas: new Map([["x", new Set(["s9"])]]) }), "con cambios que no están en main");
  assert.equal(decidir(rama("x"), sin), "con cambios que no están en main");
});
