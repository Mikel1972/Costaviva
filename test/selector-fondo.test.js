// Tests del botón único "Fondo" (2026-10-08, Mikel: "Fondos e Isób. muestran
// lo mismo"): la lógica pura del selector (assets/js/selector-fondo.js) y que
// index.html ya no tiene los botones Fondo (batimetría WMS), Isób. y Sustr.
// por separado. Sin red ni DOM. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPCIONES, NINGUNO, elegir, resumen } from "../assets/js/selector-fondo.js";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("selector: dos capas que se pueden marcar a la vez y 'Ninguno' las apaga", () => {
  assert.deepEqual(OPCIONES.map((o) => o.id), ["profundidad", "tipo"]);
  assert.deepEqual(OPCIONES.map((o) => o.texto), ["Profundidad", "Tipo de fondo"]);
  let e = { ...NINGUNO };
  e = elegir(e, "profundidad");
  assert.deepEqual(e, { profundidad: true, tipo: false });
  e = elegir(e, "tipo");
  assert.deepEqual(e, { profundidad: true, tipo: true }, "las dos a la vez");
  e = elegir(e, "profundidad");
  assert.deepEqual(e, { profundidad: false, tipo: true }, "quitar una no toca la otra");
  assert.deepEqual(elegir({ profundidad: true, tipo: true }, "ninguno"), NINGUNO);
  assert.deepEqual(elegir(e, "otra-cosa"), e, "opción desconocida: sin cambios");
  const antes = { profundidad: true, tipo: false };
  elegir(antes, "tipo");
  assert.deepEqual(antes, { profundidad: true, tipo: false }, "no muta el estado recibido");
});

test("selector: el botón se ve activo con alguna capa y dice cuáles", () => {
  assert.deepEqual(resumen(NINGUNO), { activo: false, texto: "Fondo del mar: ninguna capa" });
  assert.deepEqual(resumen({ profundidad: true, tipo: false }), { activo: true, texto: "Fondo del mar: profundidad" });
  assert.deepEqual(resumen({ profundidad: false, tipo: true }), { activo: true, texto: "Fondo del mar: tipo de fondo" });
  assert.equal(resumen({ profundidad: true, tipo: true }).texto, "Fondo del mar: profundidad y tipo de fondo");
});

test("index.html: un solo botón Fondo con su selector; fuera la capa WMS duplicada, Isób. y Sustr.", () => {
  assert.match(HTML, /id="toggleFondo"[^>]*>📏<span class="capa-label">Fondo<\/span>/);
  assert.match(HTML, /id="fondoSelector"[^>]*hidden/);
  assert.match(HTML, /import \* as SelectorFondo from "\/assets\/js\/selector-fondo\.js"/);
  assert.match(HTML, /capas: \{ profundidad: B, tipo: TF \}/);
  for (const fuera of ["toggleBatimetria", "toggleIsobatas", "toggleSustrato", "emodnet:mean,emodnet:contours",
    "capaBatimetria", ".isobatas-toggle", ".sustrato-toggle", ".batimetria-toggle", ">Isób.<", ">Sustr.<"]) {
    assert.ok(!HTML.includes(fuera), `sobra ${fuera}`);
  }
  // Seis botones por columna: Fondo en su sitio de la columna A y las capas
  // de Copernicus suben a donde estaba Sustr.
  assert.match(HTML, /\.fondo-toggle \{ top: 136px; right: 12px; \}/);
  assert.match(HTML, /\.clorofila-toggle \{ top: 260px; right: 74px; \}/);
  assert.match(HTML, /\.tempagua-toggle \{ top: 322px; right: 74px; \}/);
  // El selector sale a la izquierda de las dos columnas (74 + 54 + 10).
  assert.match(HTML, /\.fondo-selector \{\s*position: absolute; top: 136px; right: 138px;/);
});
