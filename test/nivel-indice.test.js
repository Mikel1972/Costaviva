// Niveles y colores de los índices (assets/js/nivel-indice.js, 2026-10-08).
// El fallo que corrige: el índice de pesca (alto = bueno) se pintaba con la
// escala del de mar (alto = malo) y un 77 salía en el color de "malo".
import { test } from "node:test";
import assert from "node:assert/strict";

await import("../assets/js/nivel-indice.js");
const { nivelMar, nivelPesca, colorNivel, COLORES } = globalThis.NivelIndice;

test("índice de pesca: alto es bueno", () => {
  assert.equal(nivelPesca(77), "bueno");
  assert.equal(nivelPesca(60), "bueno");
  assert.equal(nivelPesca(59), "medio");
  assert.equal(nivelPesca(40), "medio");
  assert.equal(nivelPesca(39), "malo");
  assert.equal(nivelPesca(0), "malo");
});

test("índice de mar: alto es mar agitado (malo)", () => {
  assert.equal(nivelMar(10), "bueno");
  assert.equal(nivelMar(33), "bueno");
  assert.equal(nivelMar(34), "medio");
  assert.equal(nivelMar(66), "medio");
  assert.equal(nivelMar(67), "malo");
  assert.equal(nivelMar(100), "malo");
});

test("sin dato: nivel sd en los dos, nunca un color de la escala", () => {
  for (const v of [null, undefined, NaN]) {
    assert.equal(nivelMar(v), "sd");
    assert.equal(nivelPesca(v), "sd");
  }
  assert.equal(colorNivel("sd"), COLORES.sd);
  assert.equal(colorNivel("raro"), COLORES.sd);
});

test("un 77 de pesca y un 20 de mar salen del mismo color (los dos son buenos)", () => {
  assert.equal(colorNivel(nivelPesca(77)), colorNivel(nivelMar(20)));
  assert.notEqual(colorNivel(nivelPesca(77)), colorNivel(nivelMar(77)));
});
