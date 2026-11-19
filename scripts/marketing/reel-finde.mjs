// scripts/marketing/reel-finde.mjs — serie "Este finde: dónde, a qué hora y qué pez"
// (2026-11-19, aprobada por Mikel). Sin IA. El viernes, para una región que
// va rotando: los 3 spots con mejor índice de pesca el sábado por la mañana
// (la misma cuenta que la app, con la previsión real), con su mejor especie,
// sus mejores horas y la marea del sábado. Si faltan datos, no se monta.
//
// Uso:  node reel-finde.mjs [--fecha AAAA-MM-DD (la del viernes)] [--region cantabrico]
import { appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { BASE_URL, leerEspecies, resumenDeSpot, nombreSpot } from "./obtener-datos.mjs";
import { mareaDelDia } from "./pieza-datos.mjs";
import { piezaAPreparar, campanaDePieza, MARCA_ENLACE, sumarDias } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO, LEMA } from "./reel-comun.mjs";
import { SPOTS } from "../../functions/prevision.js";
import { regionPorCoordenadas, REGIONES } from "../../assets/js/regiones.js";
import { hashtagsDe } from "./reel-peces.mjs";
import "../../assets/js/nivel-indice.js";
const VA_nivel = (n) => globalThis.NivelIndice.nivelPesca(n);

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUTA_ROTACION = join(__dirname, "rotacion-reels-finde.json");
export const ROTACION_REGIONES = ["cantabrico", "mediterraneo", "atlantico_norte", "golfo_cadiz", "canarias", "baleares"];
const HORA_SABADO = "08:00";
// "Este finde en el Cantábrico" (frase de Mikel).
export const CON_ARTICULO = { cantabrico: "el Cantábrico", mediterraneo: "el Mediterráneo", atlantico_norte: "Galicia", golfo_cadiz: "el golfo de Cádiz", canarias: "Canarias", baleares: "Baleares" };
const MAX_SPOTS = 24;

export function siguienteRegion(ultima) {
  const i = ROTACION_REGIONES.indexOf(ultima);
  return ROTACION_REGIONES[(i + 1) % ROTACION_REGIONES.length];
}
export function spotsDeRegion(region, spots = SPOTS) {
  return spots.filter((s) => !/\(PT\)/.test(s.nombre) && regionPorCoordenadas(s.lat, s.lon) === region).map((s) => s.slug);
}
const nombreCorto = (n) => String(n).replace(/\s*\(.*\)\s*$/, "");

// Mejor tramo de 3 horas de DÍA (06-21 h) del sábado en la tira horaria del
// índice (barras: 0-23 h): la media del tramo es la nota del spot.
export function mejorTramoDeDia(barras, desde = 6, hasta = 21, ancho = 3) {
  let mejor = null;
  for (let h = desde; h + ancho <= hasta + 1 && h + ancho <= barras.length; h++) {
    const media = barras.slice(h, h + ancho).reduce((a, b) => a + b, 0) / ancho;
    if (!mejor || media > mejor.media) mejor = { desde: h, media };
  }
  if (!mejor) return null;
  const hh = (x) => String(x).padStart(2, "0");
  return { nota: Math.round(mejor.media), texto: `${hh(mejor.desde)}–${hh(mejor.desde + ancho)} h` };
}
// Distancia aproximada en km entre dos spots.
export function km(a, b) {
  const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return 6371 * Math.hypot(x, y);
}
// Los 3 mejores de { slug, lat, lon, nota, ... }, separados al menos
// `separacion` km para que no salgan tres playas vecinas con el mismo dato.
export function mejores(lista, n = 3, separacion = 30) {
  const orden = lista.filter((x) => Number.isFinite(x.nota)).sort((a, b) => b.nota - a.nota || a.slug.localeCompare(b.slug));
  const out = [];
  for (const x of orden) {
    if (out.every((y) => !Number.isFinite(x.lat) || km(x, y) >= separacion)) out.push(x);
    if (out.length === n) break;
  }
  return out;
}
export function textoMarea(extremos) {
  const m = extremos.filter((e) => e.hora >= "06:00" && e.hora <= "21:00").slice(0, 2);
  return m.map((e) => `${e.tipo} ${e.hora}`).join(" · ");
}

async function main() {
  const estado = leerJson(RUTA_ESTADO);
  const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : "");
  const objetivo = piezaAPreparar({ formato: "reel", fechaForzada: arg("fecha") || process.env.FECHA_PIEZA || "", tipoForzado: "finde", estado, mercado: "es" });
  if (!objetivo) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const { fecha, hora, clave } = objetivo;
  const sabado = sumarDias(fecha, (6 - new Date(`${fecha}T12:00:00Z`).getUTCDay() + 7) % 7);
  const rotacion = leerJson(RUTA_ROTACION);
  const region = arg("region") || siguienteRegion(rotacion.ultima);
  const nombreRegion = CON_ARTICULO[region] || REGIONES[region]?.nombre || region;
  const especiesDatos = leerEspecies();
  const ahoraISO = `${sabado}T${HORA_SABADO}`;
  const lista = [];
  for (const slug of spotsDeRegion(region).slice(0, MAX_SPOTS)) {
    try {
      const { resumen, horas } = await resumenDeSpot(slug, especiesDatos, ahoraISO, null, 4);
      const tramo = resumen?.barras?.length === 24 ? mejorTramoDeDia(resumen.barras) : null;
      if (!tramo) continue;
      const s = SPOTS.find((x) => x.slug === slug);
      lista.push({ slug, lat: s.lat, lon: s.lon, resumen, nota: tramo.nota, nivel: VA_nivel(tramo.nota), tramo: tramo.texto, marea: textoMarea(mareaDelDia(horas, sabado)) });
    } catch (e) { console.warn(`${slug}: ${e.message}`); }
  }
  const top = mejores(lista);
  if (top.length < 3) throw new Error(`${region}: solo ${top.length} spots con índice para el sábado; no se monta el reel.`);
  console.log(JSON.stringify(top.map((x) => [x.slug, x.nota, x.resumen.especie, x.tramo, x.marea])));
  const clip = elegirClip(process.env.CLIP_REEL || "");
  const datos = {
    spot: `Sábado<br>${Number(sabado.slice(8))}/${Number(sabado.slice(5, 7))}`,
    // Frase de Mikel (2026-11-19): dónde, a qué hora y qué pez.
    gancho: `Este finde en ${nombreRegion}: dónde, a qué hora y qué pez`,
    tarjetas: top.map((x) => ({
      num: x.nota, nivel: x.nivel,
      etq: nombreCorto(nombreSpot(x.slug)),
      val: `${x.resumen.especie} · ${x.tramo}`,
      sub: x.marea,
    })),
    lema: LEMA,
    credito: `${clip.credito} · Datos: Open-Meteo (CC BY 4.0) · Índice de Costaviva`,
  };
  const rutaRelativa = `assets/marketing/reels/${fecha}-finde-${region}.mp4`;
  await montarVideo({ datos, clip, rutaRelativa });
  const caption = [
    `${datos.gancho} 🎣`,
    "",
    `Los 3 spots con mejor índice de pesca el sábado ${Number(sabado.slice(8))} de día, con la previsión de hoy:`,
    ...top.map((x, i) => `${["🥇", "🥈", "🥉"][i]} ${nombreCorto(nombreSpot(x.slug))}: ${x.nota}/100, ${x.resumen.especie.toLowerCase()}, de ${x.tramo.replace("–", " a ").replace(" h", " h")}${x.marea ? ` · ${x.marea}` : ""}`),
    "",
    "¿Con quién vas? 👇 Etiquétalo y guárdalo para el sábado.",
    `🔗 El índice de tu spot hora a hora, mareas, olas y cámaras, 14 días gratis y sin tarjeta: ${MARCA_ENLACE}`,
    "",
    "El índice es una orientación con reglas públicas, no una garantía. Antes de salir, mira el estado del mar.",
    `${clip.credito} · Datos: Open-Meteo (CC BY 4.0)`,
    "",
    `#pesca #pescafindesemana ${hashtagsDe(SPOTS.find((s) => s.slug === top[0].slug).lat, SPOTS.find((s) => s.slug === top[0].slug).lon).split(" ")[0] || ""} #surfcasting #costaviva`.replace(/\s+/g, " ").trim(),
  ].join("\n");
  const campana = campanaDePieza(fecha, `reel-finde-${region}`);
  apuntarReel({ tipo: "reel-finde", caption, rutaRelativa, baseUrl: BASE_URL, fecha, hora, campana, clip, estado, clave,
    rotacionPropia: { ruta: RUTA_ROTACION, datos: { ultima: region, fecha: new Date().toISOString() } } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel del finde:", e); process.exit(1); });
}
