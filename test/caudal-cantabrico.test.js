// Parser de la tabla de caudales del SAIH Cantábrico (functions/prevision.js).
// Fixture: HTML real de visor.saichcantabrico.es del 2026-10-08, recortado a
// unas pocas filas. Bug que reproduce (ROBOT.md 2026-10-08): una fila con los
// umbrales en "-" hacía que el regex cruzara a la fila siguiente, así que
// `sella` daba el caudal del Piloña (otra estación llamada "Arriondas") y
// `ason` salía null.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsearCaudalCantabrico } from "../functions/prevision.js";

const html = readFileSync(new URL("./fixtures/saich-cantabrico-tabla-caudal.html", import.meta.url), "utf8");
const r = parsearCaudalCantabrico(html);

test("sella: fila del Sella en Arriondas, no la del Piloña (umbrales en '-')", () => {
  assert.equal(r.sella?.caudal, 205.58);
  assert.equal(r.sella.umbralBajo, 438);
  assert.equal(r.sella.umbralAlto, 885);
  assert.equal(r.sella.actualizado, "08:25 | 08-10-2026");
});

test("ason: Ramales de la Victoria tras una fila con umbrales en '-'", () => {
  assert.equal(r.ason?.caudal, 84.02);
  assert.equal(r.ason.umbralBajo, 205);
  assert.equal(r.ason.umbralAlto, 284);
});

test("filas normales: besaya, pas, eo", () => {
  assert.deepEqual(r.besaya, { caudal: 69.9, actualizado: "08:25 | 08-10-2026", estacion: "Puente de Torres", umbralBajo: 226, umbralAlto: 474 });
  assert.deepEqual(r.pas, { caudal: 38.43, actualizado: "08:25 | 08-10-2026", estacion: "Puente Viesgo", umbralBajo: 251, umbralAlto: 374 });
  assert.equal(r.eo?.caudal, 3.96);
});

test("HTML sin filas: todo null, sin excepción", () => {
  const v = parsearCaudalCantabrico("<table></table>");
  assert.deepEqual(v, { sella: null, besaya: null, pas: null, ason: null, eo: null });
});
