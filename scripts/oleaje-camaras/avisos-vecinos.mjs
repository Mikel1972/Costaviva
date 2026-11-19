// scripts/oleaje-camaras/avisos-vecinos.mjs — alarma de la regla de vecinos
// (2026-11-19, Mikel: "en todas las cámaras, crear una especie de regla
// que, con un margen, nos salte la alarma de que algún dato puede estar mal
// y, por lo tanto, automáticamente, revisarlo").
//
// /prevision ya aplica la regla (functions/_lib/coherencia-vecinos.js): un
// spot con la ola en la orilla muy por encima de todos sus vecinos se
// recorta; uno muy por debajo solo avisa. Aquí, sin IA, en cada pasada del
// robot de las cámaras (espuma-camaras.yml):
//   1. se leen los avisos de /prevision (España y NZ);
//   2. se acumulan 7 días en datos-robots/oleaje-camaras/avisos-vecinos.json
//      (spot, cámara de la que sale su ola, tipo, hora; sin datos de nadie);
//   3. las cámaras con REPETIDOS avisos (≥ MIN_REPETIDOS en 24 h) salen en
//      ::warning:: del robot y, en el aprendizaje semanal, suben en la lista
//      de fotos a etiquetar (senales.mjs, etiquetarCamaras): más etiquetas
//      de esa cámara corrigen lo aprendido.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTE_POR_SPOT } from "../../functions/_lib/oleaje-camaras.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FICHERO_AVISOS = join(RAIZ, "datos-robots", "oleaje-camaras", "avisos-vecinos.json");
export const DIAS = 7, MIN_REPETIDOS = 3;
const URLS = ["https://costaviva.org/prevision", "https://costaviva.org/prevision?region=nz"];

// Un aviso por spot, tipo y franja (la regla avisa por bloque de 3 h).
export function acumular(previos, nuevos, ahora = Date.now()) {
  const limite = ahora - DIAS * 86400e3;
  const clave = (a) => `${a.slug}|${a.tipo}|${a.horaISO}`;
  const vistos = new Set();
  const out = [];
  for (const a of [...(previos || []), ...(nuevos || [])]) {
    if (!a?.slug || !a.tipo || !a.horaISO || Date.parse(a.visto) < limite) continue;
    const k = clave(a);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(a);
  }
  return out;
}

// Avisos de /prevision -> registros compactos.
export function registros(avisos, ahora = Date.now()) {
  return (avisos || []).map((a) => ({
    slug: a.slug, camara: FUENTE_POR_SPOT[a.slug]?.camara || null, tipo: a.tipo, horaISO: a.horaISO,
    antes: Array.isArray(a.antes) ? a.antes[1] : null, referencia: a.tope ?? a.mediana ?? null,
    visto: new Date(ahora).toISOString(),
  }));
}

// Cámaras (o spots sin cámara) con avisos repetidos en las últimas 24 h.
export function repetidos(lista, ahora = Date.now(), min = MIN_REPETIDOS) {
  const desde = ahora - 86400e3;
  const cuenta = {};
  for (const a of lista) {
    if (Date.parse(a.visto) < desde) continue;
    const k = a.camara || `spot:${a.slug}`;
    const c = (cuenta[k] ||= { clave: k, alto: 0, bajo: 0, spots: new Set() });
    c[a.tipo] = (c[a.tipo] || 0) + 1;
    c.spots.add(a.slug);
  }
  return Object.values(cuenta).filter((c) => c.alto + c.bajo >= min).map((c) => ({ ...c, spots: [...c.spots] }));
}

async function main() {
  const ahora = Date.now();
  const nuevos = [];
  for (const url of URLS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60e3) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      nuevos.push(...registros(d.avisosVecinos, ahora));
    } catch (e) {
      console.log(`::warning::Regla de vecinos: no se pudo leer ${url}: ${e.message}`);
    }
  }
  const previos = existsSync(FICHERO_AVISOS) ? JSON.parse(readFileSync(FICHERO_AVISOS, "utf8")).avisos : [];
  const lista = acumular(previos, nuevos, ahora);
  const rep = repetidos(lista, ahora);
  writeFileSync(FICHERO_AVISOS, JSON.stringify({ actualizado: new Date(ahora).toISOString(), dias: DIAS, repetidos: rep, avisos: lista }, null, 1) + "\n");
  console.log(`Regla de vecinos: ${nuevos.length} avisos ahora, ${lista.length} en ${DIAS} días.`);
  for (const c of rep) {
    console.log(`::warning::Regla de vecinos: ${c.clave} (${c.spots.join(", ")}) no cuadra con sus vecinos: ${c.alto} veces por encima (recortado) y ${c.bajo} por debajo en 24 h. Conviene etiquetar fotos de esa cámara.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
