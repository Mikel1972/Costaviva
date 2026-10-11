// scripts/precios/fuentes.mjs
// Descarga, sin IA, los dos datos públicos de los que salen los precios:
//   - Tipos de cambio de referencia del BCE (eurofxref-daily.xml): 1 EUR = x.
//   - RNB per cápita, método Atlas, USD corrientes (Banco Mundial,
//     indicador NY.GNP.PCAP.CD, licencia CC BY 4.0), último año disponible.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RUTA_CONFIG = join(RAIZ, "functions", "_lib", "precios-zonas.json");

export const URL_BCE = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export const URL_BM_PAISES = "https://api.worldbank.org/v2/country?format=json&per_page=400";
export const urlBmIndicador = (ind) =>
  `https://api.worldbank.org/v2/country/all/indicator/${ind}?format=json&mrnev=1&per_page=20000`;

export function leerConfig() {
  return JSON.parse(readFileSync(RUTA_CONFIG, "utf8"));
}
export function guardarConfig(config) {
  writeFileSync(RUTA_CONFIG, JSON.stringify(config, null, 2) + "\n");
}

// Lee el XML del BCE: fecha y { USD: 1.12, NZD: 1.99, ... }.
export function parsearBce(xml) {
  const fecha = (xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/) || [])[1] || null;
  const eur_a = {};
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) eur_a[m[1]] = Number(m[2]);
  if (!fecha || !Object.keys(eur_a).length) throw new Error("respuesta del BCE ilegible");
  return { fuente: "Banco Central Europeo, tipos de cambio de referencia del euro (eurofxref-daily)", url: URL_BCE, fecha, eur_a };
}

export async function descargarBce() {
  const r = await fetch(URL_BCE);
  if (!r.ok) throw new Error(`BCE HTTP ${r.status}`);
  return parsearBce(await r.text());
}

// { ES: { rnb: 37120, anio: "2025", nombre: "Spain" }, ... } solo países (sin agregados).
export async function descargarRenta(indicador) {
  const rp = await fetch(URL_BM_PAISES);
  if (!rp.ok) throw new Error(`Banco Mundial (países) HTTP ${rp.status}`);
  const [, paises] = await rp.json();
  const esPais = new Set(paises.filter((p) => p.region?.id && p.region.id !== "NA").map((p) => p.iso2Code));
  const ri = await fetch(urlBmIndicador(indicador));
  if (!ri.ok) throw new Error(`Banco Mundial (${indicador}) HTTP ${ri.status}`);
  const [, filas] = await ri.json();
  const out = {};
  for (const f of filas || []) {
    const iso2 = f.country?.id;
    if (!esPais.has(iso2) || typeof f.value !== "number") continue;
    out[iso2] = { rnb: f.value, anio: f.date, nombre: f.country.value };
  }
  if (!out.ES) throw new Error("el Banco Mundial no ha devuelto el dato de España");
  return out;
}
