// scripts/marketing/reel-galicia.mjs — reel «Peces de Galicia: qué se pesca
// ahora» (2026-11-22, Mikel: «un reel del concepto que más estén
// preguntando» → «b»). Search Console: «peces de galicia» y «pescados de
// galicia», 58 impresiones en 28 días, posición ~70. Enlaza a
// /spots/region/galicia, que tiene la lista completa con sus meses (es/en/pt).
// Mismo montaje que las series (reel-comun.mjs). Solo datos de
// assets/datos/especies.json, con el mismo cálculo que la página de la región
// (unión de las regiones de especies de sus spots). El vídeo es de stock y NO
// se rotula como Galicia.
//
// Uso:  node reel-galicia.mjs [--fecha AAAA-MM-DD] [--hora HH:MM]
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BASE_URL } from "./obtener-datos.mjs";
import { campanaDePieza, MARCA_ENLACE, hoyMadrid } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO, LEMA } from "./reel-comun.mjs";
import { campanaDe } from "./campana-temporal.mjs";
import { REGIONES } from "../../functions/mareas/_regiones.js";
import { SPOTS } from "../../functions/_lib/seo/carga.js";
import { regionEspeciesDeSpot } from "../../functions/_lib/seo/datos.js";

export const CLIP_GALICIA = "coverr-pescador-costa-rocosa.mp4";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// { total, spots, ahora: [nombres de temporada este mes], todoElAno: n }
export function pecesDeGalicia(especiesDatos, mes, spots = SPOTS) {
  const reg = REGIONES.find((r) => r.slug === "galicia");
  const del = spots.filter((s) => reg.spots.has(s.slug));
  const regiones = [...new Set(del.map(regionEspeciesDeSpot))];
  const lista = especiesDatos.especies
    .map((e) => ({ nombre: e.nombres?.es || e.id, meses: [...new Set(regiones.flatMap((r) => e.presencia?.[r]?.meses || []))] }))
    .filter((e) => e.meses.length);
  const orden = (a, b) => a.localeCompare(b, "es");
  const ahora = lista.filter((e) => e.meses.includes(mes)).map((e) => e.nombre).sort(orden);
  // Las que son de temporada AHORA y no todo el año: lo que distingue al mes.
  const deEstaEpoca = lista.filter((e) => e.meses.includes(mes) && e.meses.length < 12).map((e) => e.nombre).sort(orden);
  return { total: lista.length, spots: del.length, ahora, deEstaEpoca, todoElAno: lista.filter((e) => e.meses.length === 12).length };
}

export function piezaGalicia(fecha, datos) {
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  const muestra = (datos.deEstaEpoca.length ? datos.deEstaEpoca : datos.ahora).slice(0, 5).join(", ");
  return {
    spot: "Peces de Galicia",
    gancho: `¿Qué se pesca en Galicia en ${mes}?`,
    cinta: campanaDe(fecha)?.cinta || "",
    tarjetas: [
      { etq: `De temporada en ${mes}`, val: `${datos.ahora.length} especies`, sub: datos.deEstaEpoca.length ? `Las propias de ${mes}: ${muestra}` : muestra },
      { etq: "En total", val: `${datos.total} especies`, sub: `${datos.todoElAno} se pescan todo el año` },
      { etq: "Dónde", val: `${datos.spots} spots`, sub: "Rías Baixas, Costa da Morte y A Coruña" },
    ],
    lema: LEMA,
  };
}

async function main() {
  const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : "");
  const fecha = arg("fecha") || process.env.FECHA_PIEZA || hoyMadrid();
  const hora = arg("hora") || "13:00";
  const estado = leerJson(RUTA_ESTADO);
  const clave = `${fecha}-reel-galicia`;
  if (estado?.generadas?.[clave] && !arg("fecha")) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const especiesDatos = JSON.parse(readFileSync(new URL("../../assets/datos/especies.json", import.meta.url), "utf8"));
  const datos = pecesDeGalicia(especiesDatos, Number(fecha.slice(5, 7)));
  const clip = elegirClip(process.env.CLIP_REEL || CLIP_GALICIA);
  const pieza = { ...piezaGalicia(fecha, datos), credito: clip.credito };
  const rutaRelativa = `assets/marketing/reels/${fecha}-galicia.mp4`;
  await montarVideo({ datos: pieza, clip, rutaRelativa });
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  const caption = [
    `🐟 ¿Qué se pesca en Galicia en ${mes}?`,
    "",
    `De temporada ahora: ${datos.ahora.length} especies.${datos.deEstaEpoca.length ? ` Las propias de ${mes}, que no están todo el año: ${datos.deEstaEpoca.join(", ")}.` : ""}`,
    `Y todo el año: ${datos.ahora.filter((n) => !datos.deEstaEpoca.includes(n)).slice(0, 8).join(", ")}…`,
    "",
    `En total, ${datos.total} especies se pescan en Galicia; ${datos.todoElAno} de ellas, todo el año.`,
    "",
    "👇 ¿Cuál es tu favorita en las rías?",
    "📖 Todos los peces de Galicia, mes a mes, y sus spots: costaviva.org/spots/region/galicia",
    `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`,
    "",
    `${clip.credito}`,
    "",
    "#pescagalicia #galicia #riasbaixas #pesca #costaviva",
  ].join("\n");
  const campana = campanaDePieza(fecha, "reel-galicia");
  apuntarReel({ tipo: "reel-galicia", caption, rutaRelativa, baseUrl: BASE_URL, fecha, hora, campana, clip, estado, clave, sinRotacionPeces: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel de Galicia:", e); process.exit(1); });
}
