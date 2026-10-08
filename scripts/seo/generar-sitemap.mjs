// scripts/seo/generar-sitemap.mjs
// Genera sitemap.xml (estático, misma URL que ya está enviada en Search
// Console: https://costaviva.org/sitemap.xml) a partir de los datos: spots de
// functions/prevision.js, regiones de functions/mareas/_regiones.js y
// especies de assets/datos/especies.json. Sin IA ni red.
//
// También escribe 404.html (la página de "no encontrada" de base.js) y,
// antes, functions/_lib/seo/estilos.js (el CSS en línea de las páginas
// públicas, scripts/seo/generar-estilos.mjs), del que depende 404.html.
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
import { escribirEstilos, RUTA_ESTILOS } from "./generar-estilos.mjs";

// Primero el CSS en línea; functions/ se importa después (import dinámico)
// para que 404.html salga ya con el estilos.js nuevo.
const comprobar = process.argv.includes("--check");
let desfasado = false;
if (!escribirEstilos({ comprobar })) {
  if (comprobar) {
    console.error(`${RUTA_ESTILOS} está desfasado: ejecuta node scripts/seo/generar-sitemap.mjs`);
    desfasado = true;
  } else console.log(`${RUTA_ESTILOS} escrito`);
}
const { htmlNoEncontradaGeneral } = await import("../../functions/_lib/seo/base.js");
const { urlsSitemap, xmlSitemap } = await import("../../functions/_lib/seo/sitemap.js");
const { SPOTS } = await import("../../functions/prevision.js");

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
for (const [nombre, contenido] of ficheros) {
  const destino = join(RAIZ, nombre);
  if (comprobar) {
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
