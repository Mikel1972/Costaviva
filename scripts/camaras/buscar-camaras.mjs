// scripts/camaras/buscar-camaras.mjs
// Buscador de cámaras nuevas (2026-10-31, aprobado por Mikel: "hay que
// mejorar la captura de nuevas"). Sin IA. Lo lanza buscar-camaras.yml una
// vez por semana.
//
// 1. Huecos: spots (España y Portugal de functions/prevision.js, NZ de
//    spots-nz.js) sin ninguna cámara: ni propia del proxy /webcam/
//    (functions/webcam/[slug].js) ni de terceros (camaras-externas.js).
// 2. Candidatas en YouTube (si hay YOUTUBE_API_KEY): directos con el nombre
//    del spot y "webcam". Se quedan solo los que nombran el spot en el
//    título o la descripción, o dicen estar a menos de RADIO_KM, y que no
//    estén ya en la app (mismo vídeo o mismo canal en ese spot). Entrarían
//    siempre como `enlace` (regla del paywall, CLAUDE.md "Cámaras de
//    terceros").
// 3. Escribe el cuerpo del Issue semanal (Mikel marca las que quiere).
//
// Cuota de YouTube: search.list cuesta 100 unidades y videos.list 1; con
// MAX_BUSQUEDAS = 60 son ~6.100 de las 10.000 diarias gratis.
//
// Uso: [YOUTUBE_API_KEY=...] node scripts/camaras/buscar-camaras.mjs [--salida fichero.md]
// Lo puro se prueba en test/buscar-camaras.test.js.

import { readFileSync, writeFileSync } from "node:fs";

export const RADIO_KM = 5;
export const MAX_BUSQUEDAS = 60;
const YT = "https://www.googleapis.com/youtube/v3";

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Spots con cámara: los que tienen una propia o de terceros, y los que
// están a menos de RADIO_KM de uno de ellos (la misma cámara les vale).
export function huecos(spots, slugsConCamara) {
  const con = spots.filter((s) => slugsConCamara.has(s.slug));
  return spots.filter((s) => !slugsConCamara.has(s.slug)
    && !con.some((c) => distanciaKm(s.lat, s.lon, c.lat, c.lon) < RADIO_KM));
}

// Nombre corto para buscar y para reconocerlo en el título: "Cape Reinga /
// Te Rerenga Wairua" -> "Cape Reinga"; "Playa de la Concha (Donostia)" -> "Playa de la Concha".
export const nombreBusqueda = (nombre) => String(nombre).split(/[/(,]/)[0].trim();

export const KM_LEJOS = 50;
// Países que, en el título, delatan que el directo es de otro sitio.
export const PAISES_FUERA = ["colombia", "chile", "mexico", "argentina", "peru", "ecuador", "venezuela", "cuba", "brasil", "brazil",
  "usa", "california", "florida", "oregon", "washington", "canada", "alberta", "france", "francia", "normandie", "italia", "italy",
  "philippines", "filipinas", "australia", "africa", "zambezi", "ireland", "england", "uk", "new zealand", "nz", "espana", "spain", "portugal"];
const paisesDelSpot = (spot) => (spot.slug.startsWith("nz-") ? ["new zealand", "nz"] : ["espana", "spain", "portugal"]);
export const contienePalabra = (texto, palabra) => new RegExp(`(^|[^a-z0-9])${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(texto);

// Un vídeo de YouTube (videos.list) -> candidata o null.
export function candidataDeVideo(video, spot, yaEnApp) {
  const sn = video.snippet || {};
  if (sn.liveBroadcastContent !== "live") return null;
  if (yaEnApp.videos.has(video.id)) return null;
  if (yaEnApp.canalesPorSpot.get(spot.slug)?.has(sn.channelId)) return null;
  // Filtro (2026-10-31, tras la primera pasada con 24 candidatas y mucho
  // ruido: Cartagena de Colombia, "Mana" en Manaus, "Leigh" en Leighlin):
  // el nombre del spot como PALABRA en el TÍTULO, ninguna ubicación lejana y
  // ningún país de fuera en el título.
  const titulo = normalizar(sn.title);
  const nombre = normalizar(nombreBusqueda(spot.nombre));
  const loc = video.recordingDetails?.location;
  const conLoc = loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude);
  const km = conLoc ? distanciaKm(spot.lat, spot.lon, loc.latitude, loc.longitude) : null;
  if (km !== null && km > KM_LEJOS) return null;
  const cerca = km !== null && km < RADIO_KM * 3;
  if (!cerca && !contienePalabra(titulo, nombre)) return null;
  if (!cerca && PAISES_FUERA.some((p) => contienePalabra(titulo, p) && !paisesDelSpot(spot).includes(p))) return null;
  return {
    spot: spot.slug,
    spot_nombre: spot.nombre,
    titulo: sn.title,
    canal: sn.channelTitle,
    canal_id: sn.channelId,
    video_id: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    miniatura: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || null,
    insertable: video.status?.embeddable === true,
    motivo: cerca ? "ubicación del vídeo cerca del spot" : "nombra el spot",
  };
}

export function cuerpoIssue({ fecha, totalSpots, listaHuecos, candidatas, sinClave }) {
  const l = [
    `Búsqueda semanal de cámaras (${fecha}). Sin IA: \`scripts/camaras/buscar-camaras.mjs\`.`,
    "",
    `- Spots: ${totalSpots}; **sin ninguna cámara a menos de ${RADIO_KM} km: ${listaHuecos.length}**.`,
  ];
  if (sinClave) {
    l.push("- ⚠️ Sin `YOUTUBE_API_KEY`: no se ha buscado en YouTube. Mikel la saca una vez en console.cloud.google.com (YouTube Data API v3) y la guarda como secret de GitHub.");
  } else {
    l.push(`- Candidatas en YouTube (directos que nombran el spot o están cerca): **${candidatas.length}**.`);
  }
  if (candidatas.length) {
    l.push("", "## Candidatas", "", "Marca las que quieras en la app. Entran como **enlace** (YouTube nunca insertado: Costaviva tiene paywall).", "");
    for (const c of candidatas) {
      l.push(`- [ ] **${c.spot_nombre}** — [${c.titulo}](${c.url}) · canal ${c.canal} · ${c.motivo} <!-- cand:${c.spot}:${c.video_id} -->`);
    }
  }
  l.push("", "<details><summary>Spots sin cámara</summary>", "", listaHuecos.map((s) => s.nombre).join(", ") || "Ninguno.", "", "</details>");
  return l.join("\n");
}

async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${d?.error?.message || "sin detalle"}`);
  return d;
}

async function buscarEnYoutube(spot, clave, yaEnApp) {
  const q = `${nombreBusqueda(spot.nombre)} ${spot.slug.startsWith("nz-") ? "New Zealand " : ""}webcam`;
  const busq = await json(`${YT}/search?part=snippet&type=video&eventType=live&maxResults=10&q=${encodeURIComponent(q)}&key=${clave}`);
  const ids = (busq.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const vids = await json(`${YT}/videos?part=snippet,status,recordingDetails&id=${ids.join(",")}&key=${clave}`);
  return (vids.items || []).map((v) => candidataDeVideo(v, spot, yaEnApp)).filter(Boolean);
}

async function cargar() {
  const prev = readFileSync(new URL("../../functions/prevision.js", import.meta.url), "utf8");
  const es = [...prev.matchAll(/\{ slug: "([a-z0-9]+)", nombre: "([^"]+)", lat: (-?[\d.]+), lon: (-?[\d.]+)/g)]
    .map((m) => ({ slug: m[1], nombre: m[2], lat: Number(m[3]), lon: Number(m[4]) }));
  const { SPOTS_NZ } = await import("../../functions/_lib/nz/spots-nz.js");
  const { WEBCAMS } = await import("../../functions/webcam/[slug].js");
  const { CAMARAS_EXTERNAS } = await import("../../assets/js/camaras-externas.js");
  const vistos = new Set();
  const spots = [...es, ...SPOTS_NZ.map((s) => ({ slug: s.slug, nombre: s.nombre, lat: s.lat, lon: s.lon }))]
    .filter((s) => !vistos.has(s.slug) && vistos.add(s.slug));
  const conCamara = new Set([...Object.keys(WEBCAMS), ...CAMARAS_EXTERNAS.map((c) => c.spot)]);
  const canalesPorSpot = new Map();
  for (const c of CAMARAS_EXTERNAS) {
    if (!c.canal_id) continue;
    if (!canalesPorSpot.has(c.spot)) canalesPorSpot.set(c.spot, new Set());
    canalesPorSpot.get(c.spot).add(c.canal_id);
  }
  const videos = new Set(CAMARAS_EXTERNAS.map((c) => c.youtube_id).filter(Boolean));
  return { spots, conCamara, yaEnApp: { videos, canalesPorSpot } };
}

async function main() {
  const i = process.argv.indexOf("--salida");
  const salida = i > -1 ? process.argv[i + 1] : null;
  const clave = (process.env.YOUTUBE_API_KEY || "").trim();
  const { spots, conCamara, yaEnApp } = await cargar();
  const listaHuecos = huecos(spots, conCamara);
  const candidatas = [];
  if (clave) {
    for (const spot of listaHuecos.slice(0, MAX_BUSQUEDAS)) {
      try {
        candidatas.push(...await buscarEnYoutube(spot, clave, yaEnApp));
      } catch (e) {
        console.error(`✗ ${spot.slug}: ${e.message}`);
        if (/quota/i.test(e.message)) break;
      }
    }
  }
  // Un mismo directo puede salir para dos spots: se queda el primero.
  const unicas = candidatas.filter((c, k) => candidatas.findIndex((x) => x.video_id === c.video_id) === k);
  const cuerpo = cuerpoIssue({ fecha: new Date().toISOString().slice(0, 10), totalSpots: spots.length, listaHuecos, candidatas: unicas, sinClave: !clave });
  console.log(`Spots ${spots.length}, sin cámara ${listaHuecos.length}, candidatas ${unicas.length}${clave ? "" : " (sin YOUTUBE_API_KEY)"}.`);
  if (salida) writeFileSync(salida, cuerpo + "\n");
  else console.log(cuerpo);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
