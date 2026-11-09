// Picadas de cada salida (2026-11-08): número, no "pocas o muchas".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { picadasPorHora } from "../scripts/aprendizaje/casos.mjs";

test("picadas: actividad por hora = picadas sin sacar + capturas", () => {
  assert.equal(picadasPorHora({ picadas: 1, hora_inicio: "09:00", hora_fin: "12:00" }, 1), 0.67);
});

test("picadas: por hora a partir del inicio y el fin de la salida", () => {
  assert.equal(picadasPorHora({ picadas: 2, hora_inicio: "09:00:00", hora_fin: "12:00:00" }), 0.67);
  assert.equal(picadasPorHora({ picadas: 3, hora_inicio: "23:00", hora_fin: "01:00" }), 1.5);
  assert.equal(picadasPorHora({ picadas: null, hora_inicio: "09:00", hora_fin: "12:00" }), null);
  assert.equal(picadasPorHora({ picadas: 2, hora_inicio: "09:00", hora_fin: null }), null);
  assert.equal(picadasPorHora({ picadas: 2, hora_inicio: "09:00", hora_fin: "09:05" }), null);
});

test("picadas: el diario tiene el campo numérico y el botón +1, y la migración la columna", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /id="salidaPicadas" inputmode="numeric" min="0" max="999" step="1"/);
  assert.match(html, /class="secundario mas-picada"/);
  const sql = readFileSync(new URL("../supabase/migrations/20261108230000_salidas_picadas.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists picadas smallint/);
});
