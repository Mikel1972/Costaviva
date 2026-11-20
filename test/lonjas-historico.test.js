// Histórico de lonjas de bajura de Galicia (fase 1 de los patrones, 2026-11-20).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agregarDia, zonasDeLonjas, aCsv, deCsv, plan, diasEntre, ANO_INICIO, GRUPOS } from "../scripts/lonjas/historico-galicia.mjs";

const CATALOGO = JSON.parse(readFileSync(new URL("../scripts/lonjas/lonjas-galicia.json", import.meta.url), "utf8"));

test("zonas: toda lonja actual tiene zona, salvo las de altura; las de altura sin zona", () => {
  const altura = ["Vigo", "Marín", "A Coruña (Lonja Coruña, S.A.)", "Burela", "Celeiro"];
  const zonas = new Set(["miño-vigo", "pontevedra", "arousa", "muros-noia", "costa-da-morte", "artabro", "rias-altas", "marina"]);
  for (const l of CATALOGO.lonjas) {
    if (altura.includes(l.nombre) || l.nombre === "Pontevedra (Mercado)") assert.equal(l.zona, null, l.nombre);
    else assert.ok(zonas.has(l.zona), `${l.nombre}: ${l.zona}`);
  }
  assert.equal(zonasDeLonjas(CATALOGO).get("Vigo (Canido)"), "miño-vigo");
  assert.equal(zonasDeLonjas(CATALOGO).get("Ribeira."), "arousa");
});

test("agregarDia: suma por zona y especie, solo peces y cefalópodos, sin altura, avisa de lonjas nuevas", () => {
  const zonas = zonasDeLonjas(CATALOGO);
  const f = (lonja, especie, kg, grupo = "Peixes") => ({ fecha: "2010-07-14", lonja, especie, grupo, kg, importe: kg * 2 });
  const r = agregarDia([
    f("Ribeira.", "Xurelo", 100), f("Aguiño", "Xurelo", 50.5), f("Cambados", "Polbo", 20, "Cefalópodos"),
    f("Cambados", "Ameixa fina", 900, "Bivalvos"), f("Vigo", "Pescada", 5000), f("Lonxa nova", "Xurelo", 7),
  ], zonas);
  assert.deepEqual(r.filas, [
    { fecha: "2010-07-14", zona: "arousa", grupo: "Cefalópodos", especie: "Polbo", kg: 20, importe: 40 },
    { fecha: "2010-07-14", zona: "arousa", grupo: "Peixes", especie: "Xurelo", kg: 150.5, importe: 301 },
  ]);
  assert.equal(r.kgAltura, 5000);
  assert.deepEqual(r.desconocidas, ["Lonxa nova"]);
  assert.deepEqual(GRUPOS, ["Peixes", "Cefalópodos"]);
});

test("CSV: ida y vuelta, también con comas y comillas en el nombre", () => {
  const filas = [{ fecha: "2010-07-14", zona: "arousa", grupo: "Peixes", especie: 'Raia "cravuda", grande', kg: 1.5, importe: 3 }];
  assert.deepEqual(deCsv(aCsv(filas)), filas);
  assert.deepEqual(deCsv(aCsv([])), []);
});

test("plan: primero el año en curso hasta hace 3 días, luego fallidos y años sin completar del más reciente al más antiguo", () => {
  assert.equal(ANO_INICIO, 2002);
  const hoy = "2026-01-10";
  const p = plan({ anos: {} }, hoy, 10);
  assert.deepEqual(p.slice(0, 7), diasEntre("2026-01-01", "2026-01-07"));
  assert.deepEqual(p.slice(7), ["2025-01-01", "2025-01-02", "2025-01-03"]);
  const estado = { anos: { 2026: { hasta: "2026-01-07" }, 2025: { hasta: "2025-12-31", completo: true }, 2024: { hasta: "2024-12-30", fallidos: ["2024-03-05"] } } };
  assert.deepEqual(plan(estado, hoy, 5), ["2024-03-05", "2024-12-31", "2023-01-01", "2023-01-02", "2023-01-03"]);
  // Todo completo: nada.
  const todo = { anos: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [2002 + i, { hasta: `${2002 + i}-12-31`, completo: true }])) };
  todo.anos[2026] = { hasta: "2026-01-07" };
  assert.deepEqual(plan(todo, hoy, 100), []);
});
