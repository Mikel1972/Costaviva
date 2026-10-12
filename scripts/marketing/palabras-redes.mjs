// scripts/marketing/palabras-redes.mjs
// Un solo cerebro para la web y las redes (2026-10-11, Mikel): el calendario
// de Instagram y Facebook elige tema con las palabras clave que deja cada
// lunes el robot de comun (Mikel1972/comun, scripts/seo/palabras.mjs, sin
// IA) en datos-robots/seo/palabras-<país>.json (el calendario de España lee
// palabras-es.json; el de Nueva Zelanda, palabras-nz.json con
// mercado "nz"). Lógica pura y sin red:
// test/palabras-redes.test.js.
//
// Qué decide aquí, y nada más:
//   - entre las especies que YA son válidas para el post (de temporada, fuera
//     de veda, de la modalidad: especie-post.mjs), la que más se busca y sube;
//   - dentro de la zona que toca en la rotación (regla de Mikel: cada post de
//     una zona distinta), el spot que más se busca;
//   - hashtags de los términos con demanda, y la página web del tema.
// Sin ese fichero (o con más de 21 días) todo sigue como antes: rotación.
// Nunca inventa nada: solo ordena opciones que ya salen de datos reales.

import { readFileSync, existsSync } from "node:fs";

export const MAX_DIAS = 21;
const DIA = 86400000;

export function leerPalabras(ruta, ahora = new Date()) {
  if (!existsSync(ruta)) return null;
  try {
    const d = JSON.parse(readFileSync(ruta, "utf8"));
    if (!Array.isArray(d.terminos) || !d.generado) return null;
    if (ahora - new Date(d.generado) > MAX_DIAS * DIA) return null;
    return d;
  } catch {
    return null;
  }
}

const slugDe = (url) => String(url || "").split("/").filter(Boolean).at(-1) || null;

// Valor de un término para redes esta semana: demanda (0-100) que sube y en
// temporada pesa más. Factores fijos y acotados (no se aprenden solos).
export function valorRedes(t, mes) {
  if (!t || !(t.puntuacion > 0)) return 0;
  let v = t.puntuacion;
  if (t.tendencia === "sube") v *= 1.3;
  else if (t.tendencia === "baja") v *= 0.8;
  const idx = t.estacionalidad?.indice_mes_actual;
  if (idx != null) v *= Math.min(1.5, Math.max(0.7, idx));
  else if (t.estacionalidad?.picos?.includes(mes)) v *= 1.2;
  return Math.round(v * 10) / 10;
}

// Mejor valor por slug de página (/especies/<slug>, /mareas/<slug>...).
export function valoresPorSlug(palabras, { grupos, prefijos, mercado = "es", mes }) {
  const m = new Map();
  for (const t of palabras?.terminos || []) {
    if (t.mercado !== mercado || (grupos && !grupos.includes(t.grupo))) continue;
    if (!t.url || !prefijos.some((p) => t.url.startsWith(p))) continue;
    const s = slugDe(t.url);
    const v = valorRedes(t, mes);
    if (s && v > (m.get(s) ?? 0)) m.set(s, v);
  }
  return m;
}

// Elige entre candidatas ya válidas. Devuelve null si ninguna tiene demanda
// (y entonces manda la rotación de siempre).
export function elegirPorDemanda(candidatas, slugDeCandidata, valores) {
  let mejor = null, max = 0;
  for (const c of candidatas) {
    const v = valores.get(slugDeCandidata(c)) ?? 0;
    if (v > max) { max = v; mejor = c; }
  }
  return mejor ? { elegida: mejor, valor: max } : null;
}

// Páginas de cada mercado (NZ, 2026-10-11: las públicas en inglés).
export const PREFIJOS = {
  es: { especie: ["/especies/"], spot: ["/mareas/", "/spots/"], zona: [] },
  nz: { especie: ["/en/species/"], spot: ["/en/tides/", "/en/spots/"], zona: ["/en/spots/region/", "/en/tides/region/"] },
};
const prefijosDe = (mercado) => PREFIJOS[mercado] || PREFIJOS.es;

// Preferencia de especie para elegirEspeciePost (id con _ → slug con -).
export function preferenciaEspecie(palabras, mes, mercado = "es") {
  if (!palabras) return null;
  const valores = valoresPorSlug(palabras, { grupos: ["especie"], prefijos: prefijosDe(mercado).especie, mercado, mes });
  return valores.size ? (e) => valores.get(String(e.id).replace(/_/g, "-")) ?? 0 : null;
}

// Orden de los spots de una zona: primero los más buscados (mareas o spot).
// Las páginas de región de NZ (/en/spots/region/…) no cuentan como spot.
export function ordenarSpots(spots, palabras, mes, mercado = "es") {
  if (!palabras) return spots;
  const valores = valoresPorSlug(palabras, { grupos: ["spot", "region", "marea", "descubierto"], prefijos: prefijosDe(mercado).spot, mercado, mes });
  if (!valores.size) return spots;
  return [...spots].sort((a, b) => (valores.get(b) ?? 0) - (valores.get(a) ?? 0));
}

// Zona de NZ con más demanda entre las que aún no han salido en el ciclo
// (páginas /en/spots/region/<slug> y /en/tides/region/<slug>), o null.
export function valoresZonas(palabras, mes, mercado = "nz") {
  if (!palabras || !prefijosDe(mercado).zona.length) return new Map();
  return valoresPorSlug(palabras, { grupos: ["region", "marea", "spot"], prefijos: prefijosDe(mercado).zona, mercado, mes });
}

// Hashtags de los términos con demanda (técnicas y temas), sin repetir los
// fijos. Solo términos cortos (1-2 palabras) y de la semana.
const VACIAS = ["de", "del", "la", "el", "en", "a", "al", "para", "con", "the", "to", "for", "in", "of", "at", "best", "time"];
export function hashtagsDemanda(palabras, base = "", { max = 4, mes, grupos = ["tecnica", "prevision", "marea"], mercado = "es" } = {}) {
  if (!palabras) return [];
  const ya = new Set(String(base).toLowerCase().split(/\s+/).filter(Boolean));
  const out = [];
  const lista = (palabras.terminos || []).filter((t) => t.mercado === mercado && grupos.includes(t.grupo) && t.puntuacion > 0)
    .sort((a, b) => valorRedes(b, mes) - valorRedes(a, mes));
  for (const t of lista) {
    const palabrasT = t.termino.split(/\s+/).filter((x) => !VACIAS.includes(x));
    if (!palabrasT.length || palabrasT.length > 2) continue;
    const h = `#${palabrasT.join("").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "")}`;
    if (h.length < 4 || ya.has(h)) continue;
    ya.add(h);
    out.push(h);
    if (out.length >= max) break;
  }
  return out;
}
