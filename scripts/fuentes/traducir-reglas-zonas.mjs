// scripts/fuentes/traducir-reglas-zonas.mjs
// Traduce al portugués de Portugal y al inglés las reglas de las zonas sin
// pesca de España y Portugal (2026-10-12): el popup del mapa las enseñaba en
// español aunque la app estuviera en portugués o en inglés. Con DeepL (API
// Free, secret DEEPL_API_KEY: solo existe en GitHub, por eso lo lanza
// .github/workflows/traducir-reglas-zonas.yml). Sin IA. Los textos son
// resúmenes de normas públicas: no llevan datos de nadie.
//
// Guarda en datos/zonas-sin-pesca-traducciones.json { "<regla en español>":
// { pt, en } } y solo pide lo que falte (volver a lanzarlo no gasta cupo).
// Los nombres propios de artes («chumbadinha», apanha, corrico...) van entre
// comillas o en cursiva en el original y DeepL los deja. Revisión: la
// traducción la valida Claude a mano (Mikel, 2026-10-11: "valídalo tú") y
// las correcciones se escriben en el JSON, que manda sobre DeepL.
//
// Después: node scripts/fuentes/zonas-sin-pesca.mjs (mete regla_pt y
// regla_en en assets/datos/zonas-sin-pesca/{es,pt}.geojson).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FICHERO = join(RAIZ, "datos", "zonas-sin-pesca-traducciones.json");
const ORIGENES = ["datos/es/zonas-sin-pesca-boe.geojson", "datos/pt/zonas-sin-pesca-dr.geojson"];
export const DESTINOS = { pt: "PT-PT", en: "EN-GB" };

export function reglas() {
  const s = new Set();
  for (const f of ORIGENES) {
    for (const z of JSON.parse(readFileSync(join(RAIZ, f), "utf8")).features || []) {
      if (z.properties?.regla) s.add(z.properties.regla);
    }
  }
  return [...s].sort();
}

export function leerTraducciones() {
  return existsSync(FICHERO) ? JSON.parse(readFileSync(FICHERO, "utf8")) : {};
}

async function deepl(textos, destino, clave) {
  const base = clave.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const r = await fetch(`${base}/v2/translate`, {
    method: "POST",
    headers: { "Authorization": `DeepL-Auth-Key ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: textos, source_lang: "ES", target_lang: destino, preserve_formatting: true, formality: "default" }),
  });
  if (!r.ok) throw new Error(`DeepL ${destino}: HTTP ${r.status}`);
  return (await r.json()).translations.map((t) => t.text);
}

async function main() {
  const clave = process.env.DEEPL_API_KEY;
  if (!clave) throw new Error("Falta DEEPL_API_KEY.");
  const trad = leerTraducciones();
  const todas = reglas();
  let pedidas = 0;
  for (const [id, destino] of Object.entries(DESTINOS)) {
    const faltan = todas.filter((t) => !trad[t]?.[id]);
    for (let i = 0; i < faltan.length; i += 25) {
      const lote = faltan.slice(i, i + 25);
      const res = await deepl(lote, destino, clave);
      lote.forEach((t, k) => { trad[t] = { ...(trad[t] || {}), [id]: res[k] }; });
      pedidas += lote.reduce((n, t) => n + t.length, 0);
    }
  }
  // Solo las reglas que siguen existiendo, en orden estable.
  const salida = Object.fromEntries(todas.filter((t) => trad[t]).map((t) => [t, trad[t]]));
  writeFileSync(FICHERO, JSON.stringify(salida, null, 2) + "\n");
  console.log(`${todas.length} reglas; ${pedidas} caracteres pedidos a DeepL.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
