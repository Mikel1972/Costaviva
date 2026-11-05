// Ningún email personal en el repo (2026-11-05, Mikel: "los emails no pueden
// quedar a la vista del público"). El repo es público: una dirección de un
// proveedor personal (gmail, yahoo, hotmail, outlook, icloud, proton, gmx…)
// en código, docs o migraciones queda a la vista de cualquiera y en los
// buscadores. Esta prueba recorre todos los ficheros que sigue git y falla
// con fichero:línea si aparece alguna.
//
// Las direcciones de organizaciones (datos@, avisos@, info@ de un dominio
// propio o de una agencia) no se miran: el problema son las personales.
//
// Lista blanca: SOLO direcciones de mentira que usan los tests para probar
// que los detectores de emails las cazan. Cadena exacta; nada de patrones.
// Si necesitas otra en un test, usa un dominio que no exista (ejemplo.test,
// costaviva.invalid) antes que añadirla aquí.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const PERMITIDAS = new Set([
  "alguien@gmail.com",       // test/aprendizaje.test.js
  "pepe.perez+x@gmail.com",  // test/aviso-condiciones.test.js
  "pepe@gmail.com",          // test/captacion.test.js
]);

const PROVEEDORES = [
  "gmail", "googlemail", "yahoo", "hotmail", "outlook", "live", "icloud", "me",
  "proton", "protonmail", "gmx", "aol", "msn", "telefonica", "movistar",
];
// Parte local + @ + proveedor + cualquier dominio de primer nivel (.com,
// .es, .co.uk, .me…). El proveedor tiene que ir justo tras la @ y seguido
// de un punto, para no cazar dominios que solo empiezan igual.
const EMAIL_PERSONAL = new RegExp(
  `[a-z0-9._%+-]+@(?:${PROVEEDORES.join("|")})\\.[a-z]{2,}(?:\\.[a-z]{2,})*`,
  "gi",
);

const BINARIOS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".avif", ".bmp", ".tif", ".tiff",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".zip", ".gz", ".tgz", ".br", ".pbf", ".mbtiles", ".sqlite", ".db",
]);
const DATOS_GRANDES = new Set([".json", ".geojson"]);
const MAX_DATOS = 2 * 1024 * 1024;

export function emailsPersonales(texto) {
  const hallados = [];
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    for (const m of lineas[i].matchAll(EMAIL_PERSONAL)) {
      const email = m[0].toLowerCase();
      if (!PERMITIDAS.has(email)) hallados.push({ linea: i + 1, email });
    }
  }
  return hallados;
}

function ficherosDelRepo() {
  const salida = execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 });
  return salida.toString("utf8").split("\0").filter(Boolean);
}

test("el detector caza direcciones personales y respeta la lista blanca exacta", () => {
  // La @ va en una variable para que este mismo fichero no salga en el
  // recorrido de abajo con direcciones que no están en la lista blanca.
  const A = "@";
  const caza = (t) => emailsPersonales(t).map((h) => h.email);
  assert.deepEqual(caza(`escribe a nombre.apellido${A}GMAIL.com`), [`nombre.apellido${A}gmail.com`]);
  assert.deepEqual(caza(`x+y${A}yahoo.es, z${A}hotmail.co.uk`), [`x+y${A}yahoo.es`, `z${A}hotmail.co.uk`]);
  assert.deepEqual(caza(`a${A}icloud.com b${A}me.com c${A}protonmail.ch d${A}gmx.de`), [`a${A}icloud.com`, `b${A}me.com`, `c${A}protonmail.ch`, `d${A}gmx.de`]);
  assert.deepEqual(caza(`datos${A}costaviva.org avisos${A}euskadi.eus info${A}mexico.es`), []);
  assert.deepEqual(caza([...PERMITIDAS].join(" ")), []);
  assert.deepEqual(caza(`otro.alguien${A}gmail.com`), [`otro.alguien${A}gmail.com`]);
  assert.deepEqual(emailsPersonales(`uno\ndos z${A}outlook.com`), [{ linea: 2, email: `z${A}outlook.com` }]);
});

test("ningún fichero del repo contiene un email personal", () => {
  const fallos = [];
  for (const ruta of ficherosDelRepo()) {
    if (ruta.startsWith("node_modules/") || ruta.includes("/node_modules/")) continue;
    const ext = extname(ruta).toLowerCase();
    if (BINARIOS.has(ext)) continue;
    const abs = join(RAIZ, ruta);
    if (!existsSync(abs)) continue; // borrado en el árbol de trabajo
    const info = statSync(abs);
    if (!info.isFile()) continue;
    if (DATOS_GRANDES.has(ext) && info.size > MAX_DATOS) continue;
    const bytes = readFileSync(abs);
    if (bytes.subarray(0, 8000).includes(0)) continue; // binario
    for (const h of emailsPersonales(bytes.toString("utf8"))) fallos.push(`${ruta}:${h.linea}`);
  }
  assert.deepEqual(fallos, [], `Email personal en el repo público (quítalo o descríbelo, p. ej. "la cuenta del administrador"):\n${fallos.join("\n")}`);
});
