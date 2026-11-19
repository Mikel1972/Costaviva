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
  assert.match(html, /window\.addEventListener\("online", \(\) => \{ sincronizarApuntes\(\)/);
  assert.match(html, /await sincronizarApuntes\(\);\nawait cargarDatos\(\);/);
  assert.match(html, /id="avisoPendientes"/);
});

test("abrir sin cobertura: copia local, sesión del último usuario y service worker", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /ColaSinConexion\.guardarCopia\(usuario\.id/);
  assert.match(html, /ColaSinConexion\.leerCopia\(usuario\.id\)/);
  assert.match(html, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  // Lo de otro usuario del mismo móvil nunca se sube con la cuenta actual.
  assert.match(html, /if \(item\.usuario && item\.usuario !== usuario\.id\) return false;/);
  // Cerrar sesión avisa si hay apuntes sin subir y borra la copia local.
  assert.match(html, /diario\.sin_conexion\.cerrar_sesion/);
  assert.match(html, /ColaSinConexion\.borrarTodo\(\)/);
});

test("el service worker solo guarda el diario y sus ficheros, y va primero a la red", async () => {
  const fuente = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const { runInNewContext } = await import("node:vm");
  const ctx = { self: { location: { origin: "https://costaviva.org" }, addEventListener() {} }, URL, setTimeout, clearTimeout };
  runInNewContext(fuente, ctx);
  const g = (u) => runInNewContext(`seGuarda(${JSON.stringify(u)})`, ctx);
  assert.equal(g("https://costaviva.org/diario"), true);
  assert.equal(g("https://costaviva.org/assets/js/regiones.js"), true);
  assert.equal(g("https://esm.sh/@supabase/supabase-js@2"), true);
  assert.equal(g("https://costaviva.org/"), false);
  assert.equal(g("https://costaviva.org/meteo/marine?x=1"), false);
  assert.equal(g("https://imncbmizxkorotpeisic.supabase.co/rest/v1/capturas"), false);
  assert.match(fuente, /async function redPrimero/);
  const rutas = readFileSync(new URL("../functions/_lib/rutas-publicas.js", import.meta.url), "utf8");
  assert.match(rutas, /"\/sw\.js"/);
});
