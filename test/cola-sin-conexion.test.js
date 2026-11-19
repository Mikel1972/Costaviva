// Apuntes sin cobertura (assets/js/cola-sin-conexion.js), 2026-11-19.
// La parte de IndexedDB se probó en Chromium (encolar con foto, fallo de red
// que corta la pasada, subida y vaciado de la cola); aquí lo que corre en Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esFalloDeRed, subirPendientes } from "../assets/js/cola-sin-conexion.js";

test("distingue falta de red de un error real de la base de datos", () => {
  assert.equal(esFalloDeRed(null, false), true); // el móvil dice que no hay red
  assert.equal(esFalloDeRed(new TypeError("Failed to fetch"), true), true);
  assert.equal(esFalloDeRed({ message: "TypeError: Load failed" }, true), true); // Safari
  assert.equal(esFalloDeRed({ message: "NetworkError when attempting to fetch resource." }, true), true); // Firefox
  assert.equal(esFalloDeRed({ message: 'new row violates row-level security policy for table "capturas"' }, true), false);
  assert.equal(esFalloDeRed(null, true), false);
});

test("sin IndexedDB no rompe: no sube nada", async () => {
  assert.equal(await subirPendientes(async () => true, null), 0);
});

test("el diario guarda en la cola sin red y sube al volver", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /ColaSinConexion\.encolar\(\{\s*tipo: "captura"/);
  assert.match(html, /ColaSinConexion\.encolar\(\{ tipo: "picada"/);
  assert.match(html, /window\.addEventListener\("online", \(\) => \{ sincronizarApuntes\(\); \}\)/);
  assert.match(html, /await sincronizarApuntes\(\);\nawait cargarDatos\(\);/);
  assert.match(html, /id="avisoPendientes"/);
});
