// Las tres copias de la lista de spots de España (functions/prevision.js,
// index.html con su respaldo fijo y diario.html para el desplegable) tienen
// que ser la misma: slug, nombre y coordenadas. El 2026-10-09 se vio que al
// diario le faltaban los 10 de Gipuzkoa desde el 2026-09-14 (no se podían
// elegir al apuntar una salida). No se unifican en un solo fichero porque
// index.html y diario.html son scripts sin build y necesitan la lista antes
// de la primera respuesta del servidor; este test las mantiene iguales. Los
// spots de regiones nuevas (NZ) NO van en el HTML: llegan del servidor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTS_ES } from "../functions/prevision.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const clave = (slug, nombre, lat, lon) => `${slug}|${nombre}|${(+lat).toFixed(4)}|${(+lon).toFixed(4)}`;

function deHtml(html) {
  const filas = [
    ...[...html.matchAll(/\{ slug: "([a-z0-9-]+)", nombre: "([^"]*)", lat: (-?[\d.]+), lon: (-?[\d.]+)/g)],
    ...[...html.matchAll(/\["([a-z0-9-]+)", "([^"]*)", (-?[\d.]+), (-?[\d.]+)\]/g)],
  ];
  return filas.map((m) => clave(m[1], m[2], m[3], m[4])).sort();
}

const servidor = SPOTS_ES.map((s) => clave(s.slug, s.nombre, s.lat, s.lon)).sort();

test("index.html lleva los mismos spots que prevision.js", () => {
  assert.deepEqual(deHtml(leer("index.html")), servidor);
});

test("diario.html lleva los mismos spots que prevision.js", () => {
  assert.deepEqual(deHtml(leer("diario.html")), servidor);
});
