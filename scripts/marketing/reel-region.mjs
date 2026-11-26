// scripts/marketing/reel-region.mjs — serie «¿Qué se pesca en <región> en
// <mes>?» (2026-11-26, Mikel: «lo de las preguntas es lo que mejor
// funciona» → «sí, cámbialo»). Métricas reales de Instagram (alcance a 48 h):
// normas-lubina 146, calamar 134, galicia 126, frente a una media de 75 en los
// 13 reels de peces de un spot. Es el reel de Galicia (reel-galicia.mjs)
// generalizado a las 8 regiones de /spots/region/<slug>, una por semana
// (rotacion-reels-region.json). Va los jueves, en lugar del de peces.
//
// Solo datos de assets/datos/especies.json, con el mismo cálculo que la
// página de la región (unión de las regiones de especies de sus spots). El
// vídeo es de stock y NO se rotula con la región.
//
// Uso:  node reel-region.mjs [--fecha AAAA-MM-DD] [--hora HH:MM] [--region slug]
import { appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BASE_URL } from "./obtener-datos.mjs";
import { campanaDePieza, MARCA_ENLACE, piezaAPreparar } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO, LEMA } from "./reel-comun.mjs";
import { campanaDe } from "./campana-temporal.mjs";
import { REGIONES } from "../../functions/mareas/_regiones.js";
import { SPOTS } from "../../functions/_lib/seo/carga.js";
import { regionEspeciesDeSpot } from "../../functions/_lib/seo/datos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RUTA_ROTACION_REGION = join(__dirname, "rotacion-reels-region.json");
export const CLIP_REGION = "coverr-pescador-costa-rocosa.mp4";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Orden de la serie (Galicia, la última: ya tuvo su reel el 22/11). `en` es
// cómo se dice en la frase («en el Mediterráneo»); `pregunta`, la del final.
export const ROTACION_REGIONES = [
  { slug: "cantabria", en: "Cantabria", pregunta: "¿Cuál es tu favorita en Cantabria?", hashtags: "#pescacantabria #cantabria" },
  { slug: "mediterraneo", en: "el Mediterráneo", pregunta: "¿Cuál es tu favorita en el Mediterráneo?", hashtags: "#pescamediterraneo #mediterraneo" },
  { slug: "asturias", en: "Asturias", pregunta: "¿Cuál es tu favorita en Asturias?", hashtags: "#pescaasturias #asturias" },
  { slug: "canarias", en: "Canarias", pregunta: "¿Cuál es tu favorita en las islas?", hashtags: "#pescacanarias #canarias" },
  { slug: "pais-vasco", en: "Euskadi", pregunta: "¿Cuál es tu favorita en Euskadi?", hashtags: "#pescaeuskadi #euskadi" },
  { slug: "golfo-de-cadiz", en: "el golfo de Cádiz", pregunta: "¿Cuál es tu favorita en Cádiz y Huelva?", hashtags: "#pescacadiz #pescahuelva" },
  { slug: "portugal", en: "el norte de Portugal", pregunta: "¿Cuál es tu favorita en Portugal?", hashtags: "#pescaportugal #portugal" },
  { slug: "galicia", en: "Galicia", pregunta: "¿Cuál es tu favorita en las rías?", hashtags: "#pescagalicia #galicia #riasbaixas" },
];

export function siguienteRegion(ultima) {
  const i = ROTACION_REGIONES.findIndex((r) => r.slug === ultima);
  return ROTACION_REGIONES[(i + 1) % ROTACION_REGIONES.length];
}

const nombreCorto = (n) => String(n).replace(/\s*\(.*\)\s*$/, "");

// { total, spots, nombresSpots, ahora, deEstaEpoca, todoElAno }
export function pecesDeRegion(especiesDatos, slug, mes, spots = SPOTS) {
  const reg = REGIONES.find((r) => r.slug === slug);
  if (!reg) throw new Error(`Región desconocida: ${slug}`);
  const del = spots.filter((s) => reg.spots.has(s.slug));
  const regiones = [...new Set(del.map(regionEspeciesDeSpot))];
  const lista = especiesDatos.especies
    .map((e) => ({ nombre: e.nombres?.es || e.id, meses: [...new Set(regiones.flatMap((r) => e.presencia?.[r]?.meses || []))] }))
    .filter((e) => e.meses.length);
  const orden = (a, b) => a.localeCompare(b, "es");
  const ahora = lista.filter((e) => e.meses.includes(mes)).map((e) => e.nombre).sort(orden);
  const deEstaEpoca = lista.filter((e) => e.meses.includes(mes) && e.meses.length < 12).map((e) => e.nombre).sort(orden);
  return {
    total: lista.length, spots: del.length, nombresSpots: del.map((s) => nombreCorto(s.nombre)),
    ahora, deEstaEpoca, todoElAno: lista.filter((e) => e.meses.length === 12).length,
  };
}

export function piezaRegion(fecha, region, datos) {
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  const muestra = (datos.deEstaEpoca.length ? datos.deEstaEpoca : datos.ahora).slice(0, 5).join(", ");
  return {
    spot: `Peces de ${region.en}`,
    gancho: `¿Qué se pesca en ${region.en} en ${mes}?`,
    cinta: campanaDe(fecha)?.cinta || "",
    tarjetas: [
      { etq: `De temporada en ${mes}`, val: `${datos.ahora.length} especies`, sub: datos.deEstaEpoca.length ? `Las propias de ${mes}: ${muestra}` : muestra },
      { etq: "En total", val: `${datos.total} especies`, sub: `${datos.todoElAno} se pescan todo el año` },
      { etq: "Dónde", val: `${datos.spots} spots`, sub: datos.nombresSpots.slice(0, 3).join(", ") },
    ],
    lema: LEMA,
  };
}

export function captionRegion(fecha, region, datos, credito) {
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  const resto = datos.ahora.filter((n) => !datos.deEstaEpoca.includes(n)).slice(0, 8);
  return [
    `🐟 ¿Qué se pesca en ${region.en} en ${mes}?`,
    "",
    `De temporada ahora: ${datos.ahora.length} especies.${datos.deEstaEpoca.length ? ` Las propias de ${mes}, que no están todo el año: ${datos.deEstaEpoca.join(", ")}.` : ""}`,
    ...(resto.length ? [`Y todo el año: ${resto.join(", ")}…`] : []),
    "",
    `En total, ${datos.total} especies en nuestros ${datos.spots} spots de ${region.en}; ${datos.todoElAno} de ellas, todo el año.`,
    "",
    `👇 ${region.pregunta}`,
    `📖 Todos sus peces, mes a mes, y sus spots: costaviva.org/spots/region/${region.slug}`,
    `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`,
    "",
    `${credito}`,
    "",
    `${region.hashtags} #pesca #costaviva`,
  ].join("\n");
}

async function main() {
  const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : "");
  const estado = leerJson(RUTA_ESTADO);
  const objetivo = piezaAPreparar({ formato: "reel", fechaForzada: arg("fecha") || process.env.FECHA_PIEZA || "", tipoForzado: "region", estado, mercado: "es" });
  if (!objetivo) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const { fecha, clave } = objetivo;
  const hora = arg("hora") || objetivo.hora;
  const rot = leerJson(RUTA_ROTACION_REGION) || {};
  const forzada = ROTACION_REGIONES.find((r) => r.slug === (arg("region") || process.env.REGION_REEL));
  const region = forzada || siguienteRegion(rot.ultima);
  const especiesDatos = JSON.parse(readFileSync(new URL("../../assets/datos/especies.json", import.meta.url), "utf8"));
  const datos = pecesDeRegion(especiesDatos, region.slug, Number(fecha.slice(5, 7)));
  const clip = elegirClip(process.env.CLIP_REEL || CLIP_REGION);
  const pieza = { ...piezaRegion(fecha, region, datos), credito: clip.credito };
  const rutaRelativa = `assets/marketing/reels/${fecha}-region-${region.slug}.mp4`;
  await montarVideo({ datos: pieza, clip, rutaRelativa });
  const campana = campanaDePieza(fecha, `reel-region-${region.slug}`);
  apuntarReel({
    tipo: `reel-region-${region.slug}`, caption: captionRegion(fecha, region, datos, clip.credito), rutaRelativa, baseUrl: BASE_URL,
    fecha, hora, campana, clip, estado, clave, sinRotacionPeces: true,
    rotacionPropia: forzada ? null : { ruta: RUTA_ROTACION_REGION, datos: { ultima: region.slug, fecha: new Date().toISOString() } },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel de región:", e); process.exit(1); });
}
