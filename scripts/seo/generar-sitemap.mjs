// scripts/seo/generar-sitemap.mjs
// Genera sitemap.xml (estático, misma URL que ya está enviada en Search
// Console: https://costaviva.org/sitemap.xml) a partir de los datos: spots de
// functions/prevision.js, regiones de functions/mareas/_regiones.js y
// especies de assets/datos/especies.json. Sin IA ni red.
//
// También escribe 404.html (la página de "no encontrada" de base.js).
//
//   node scripts/seo/generar-sitemap.mjs          # reescribe sitemap.xml y 404.html
//   node scripts/seo/generar-sitemap.mjs --check  # falla si está desfasado
//
// Volver a ejecutarlo al añadir spots, especies o regiones (el test
// test/seo-paginas.test.js avisa si falta alguna URL). lastmod = fecha de los
// datos de los que sale la página (no la de hoy: Google ignora los lastmod
// que cambian sin que cambie la página).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { urlsSitemap, xmlSitemap } from "../../functions/_lib/seo/sitemap.js";
import { htmlNoEncontradaGeneral } from "../../functions/_lib/seo/base.js";
import { SPOTS } from "../../functions/prevision.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), "utf8"));
const especies = leer("assets/datos/especies.json");
const tipoFondo = leer("assets/datos/tipo-fondo.json");
const profundidad = leer("assets/datos/profundidad-spots.json");

const ficheros = [
  ["sitemap.xml", xmlSitemap(urlsSitemap({ spots: SPOTS, especies, tipoFondo, profundidad }))],
  // 404.html (2026-10-08): la misma página que da el middleware.
  ["404.html", `${htmlNoEncontradaGeneral()}\n`],
];
let desfasado = false;
for (const [nombre, contenido] of ficheros) {
  const destino = join(RAIZ, nombre);
  if (process.argv.includes("--check")) {
    let actual = "";
    try { actual = readFileSync(destino, "utf8"); } catch { /* no existe */ }
    if (actual !== contenido) {
      console.error(`${nombre} está desfasado: ejecuta node scripts/seo/generar-sitemap.mjs`);
      desfasado = true;
    } else console.log(`${nombre} al día`);
  } else {
    writeFileSync(destino, contenido);
    console.log(nombre === "sitemap.xml" ? `sitemap.xml: ${(contenido.match(/<loc>/g) || []).length} URLs` : `${nombre} escrito`);
  }
}
if (desfasado) process.exit(1);
