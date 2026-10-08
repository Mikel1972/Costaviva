// scripts/seo/generar-sitemap.mjs
// Genera sitemap.xml (estático, misma URL que ya está enviada en Search
// Console: https://costaviva.org/sitemap.xml) a partir de los datos: spots de
// functions/prevision.js, regiones de functions/mareas/_regiones.js y
// especies de assets/datos/especies.json. Sin IA ni red.
//
//   node scripts/seo/generar-sitemap.mjs          # reescribe sitemap.xml
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
import { SPOTS } from "../../functions/prevision.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), "utf8"));
const especies = leer("assets/datos/especies.json");
const tipoFondo = leer("assets/datos/tipo-fondo.json");
const profundidad = leer("assets/datos/profundidad-spots.json");

const xml = xmlSitemap(urlsSitemap({ spots: SPOTS, especies, tipoFondo, profundidad }));
const destino = join(RAIZ, "sitemap.xml");
if (process.argv.includes("--check")) {
  if (readFileSync(destino, "utf8") !== xml) {
    console.error("sitemap.xml está desfasado: ejecuta node scripts/seo/generar-sitemap.mjs");
    process.exit(1);
  }
  console.log("sitemap.xml al día");
} else {
  writeFileSync(destino, xml);
  console.log(`sitemap.xml: ${(xml.match(/<loc>/g) || []).length} URLs`);
}
