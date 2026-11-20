// scripts/seo/espejo.mjs — ¿cada página pública existe en los tres idiomas?
//
// 2026-11-20, Mikel: «todo lo que hagamos debe estar en todos los idiomas…
// asegúrate que todas son espejo… crea un agente que revise que siempre son
// espejos». Sin IA (regla de coste): lee sitemap.xml, reduce cada URL a
// (tipo, slug) quitando el prefijo de idioma y las rutas propias de cada uno
// (/en/tides = /mareas, /en/species = /especies…) y lista lo que falta.
// Lo que falta HOY está en datos-robots/seo/espejo-pendientes.json y solo
// puede encoger: test/espejo-idiomas.test.js falla si aparece un hueco
// nuevo o si uno de la lista ya está cubierto y no se ha quitado.
// Uso: node scripts/seo/espejo.mjs [--escribir]  (--escribir rehace la lista)
import { readFileSync, writeFileSync } from "node:fs";

export const IDIOMAS = ["es", "en", "pt"];
// Tramo de ruta de cada tipo en cada idioma (sin el prefijo /en o /pt).
const TIPOS = {
  spots: { es: "spots", en: "spots", pt: "spots" },
  mareas: { es: "mareas", en: "tides", pt: "mareas" },
  especies: { es: "especies", en: "species", pt: "especies" },
  aprende: { es: "aprende", en: "aprende", pt: "aprende" },
};

// "https://costaviva.org/en/tides/region/otago" -> { idioma: "en", clave: "mareas/region/otago" }
export function claveDeUrl(loc) {
  const path = new URL(loc).pathname.replace(/\/$/, "") || "/";
  const m = /^\/(en|pt)(\/.*)?$/.exec(path);
  const idioma = m ? m[1] : "es";
  const resto = (m ? m[2] || "/" : path).replace(/^\//, "");
  if (!resto) return { idioma, clave: "inicio" };
  const [primero, ...demas] = resto.split("/");
  for (const [tipo, rutas] of Object.entries(TIPOS)) if (rutas[idioma] === primero) return { idioma, clave: [tipo, ...demas].join("/") };
  return { idioma, clave: resto };
}

export function huecos(locs) {
  const por = new Map();
  for (const loc of locs) {
    const { idioma, clave } = claveDeUrl(loc);
    if (!por.has(clave)) por.set(clave, new Set());
    por.get(clave).add(idioma);
  }
  const faltan = [];
  for (const [clave, idiomas] of [...por].sort(([a], [b]) => a.localeCompare(b))) for (const i of IDIOMAS) if (!idiomas.has(i)) faltan.push(`${i} ${clave}`);
  return faltan;
}

export const locsDeSitemap = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const faltan = huecos(locsDeSitemap(readFileSync("sitemap.xml", "utf8")));
  const resumen = {};
  for (const h of faltan) { const [i, c] = h.split(" "); const t = `${i} ${c.split("/")[0]}`; resumen[t] = (resumen[t] || 0) + 1; }
  console.log(`Huecos: ${faltan.length}`, resumen);
  if (process.argv.includes("--escribir")) {
    writeFileSync("datos-robots/seo/espejo-pendientes.json", JSON.stringify({ nota: "Páginas que aún no tienen espejo en un idioma. Solo puede encoger (test/espejo-idiomas.test.js).", generado: new Date().toISOString().slice(0, 10), faltan }, null, 1) + "\n");
    console.log("escrito datos-robots/seo/espejo-pendientes.json");
  }
}
