// Menú de cuenta (2026-10-11): con el desplegable abierto, la cabecera tiene
// que quedar por encima del mapa y de la ficha del spot (z-index 1000).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("menú de cuenta: la cabecera sube por encima del mapa al abrirlo", () => {
  const css = readFileSync("assets/css/costaviva.css", "utf8");
  const m = css.match(/header:has\(\.cuenta-menu-dropdown\.visible\) \{ z-index: (\d+); \}/);
  assert.ok(m, "falta la regla que sube la cabecera");
  assert.ok(Number(m[1]) > 1100, "debe quedar por encima de la ficha (1000) y del menú inferior (1100)");
});
