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
// Mejoras del 2026-11-08 (Mikel: "no puede ser que no encuentre ninguna"):
// - Huecos bien contados: faltaban las cámaras HLS de index.html
//   (WEBCAMS_HLS: Hondarribia, Deba, Orio, Mutriku...), que salían como
//   spots sin cámara y gastaban búsquedas.
// - YouTube: búsqueda sesgada al país del spot (regionCode y idioma),
//   25 resultados por búsqueda (mismo coste) y con "en directo/ao vivo/live";
//   se descartan los canales de otro país (channels.list, 1 unidad).
// - Fuentes nuevas sin IA: OpenStreetMap (etiquetas webcam=* y
//   contact:webcam=* cerca del spot, Overpass, sin clave) y, si hay
//   WINDY_WEBCAMS_KEY (gratis en api.windy.com/keys), las webcams públicas de
//   Windy a menos de RADIO_BUSQUEDA_KM.
// - Memoria: lo que ya salió en un Issue anterior sin marcar no se repite
//   (va a un desplegable), para que cada semana solo aparezca lo nuevo.
//
// Cuota de YouTube: search.list cuesta 100 unidades y videos.list y
// channels.list 1; con MAX_BUSQUEDAS = 80 son ~8.200 de las 10.000 diarias.
//
// Uso: [YOUTUBE_API_KEY=...] [WINDY_WEBCAMS_KEY=...] node scripts/camaras/buscar-camaras.mjs
//        [--salida fichero.md] [--anteriores issues-anteriores.txt]
// Lo puro se prueba en test/buscar-camaras.test.js.

import { readFileSync, writeFileSync } from "node:fs";

export const RADIO_KM = 5;
export const MAX_BUSQUEDAS = 80;
// Radio para OSM y Windy: algo más que RADIO_KM (una cámara a 8 km que ve
// la misma costa sirve; Mikel decide en el Issue).
export const RADIO_BUSQUEDA_KM = 8;
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
// Directos que no son cámaras (2026-11-08: «Motril vs Almeria B 🔴 En
// Directo || Tercera RFEF» en Almería): deporte, misas, plenos, noticias.
export const NO_ES_CAMARA = ["vs", "futbol", "football", "partido", "rfef", "liga", "match", "misa", "pleno", "noticias", "news", "radio", "concierto", "procesion"];
const paisesDelSpot = (spot) => (spot.slug.startsWith("nz-") ? ["new zealand", "nz"] : ["espana", "spain", "portugal"]);

// País del spot: NZ por el slug, Portugal por el "(PT)" del nombre, si no España.
export const paisSpot = (spot) => (spot.slug.startsWith("nz-") ? "NZ" : /\(PT\)/.test(spot.nombre) ? "PT" : "ES");
const IDIOMA = { ES: "es", PT: "pt", NZ: "en" };
const EN_DIRECTO = { ES: '"en directo"|"en vivo"|webcam', PT: '"ao vivo"|webcam|"em direto"', NZ: "webcam|live cam|livestream" };

// Consulta de YouTube para un spot: nombre + palabras de directo del idioma.
export function consultaYoutube(spot) {
  const p = paisSpot(spot);
  return `${nombreBusqueda(spot.nombre)}${p === "NZ" ? " New Zealand" : ""} ${EN_DIRECTO[p]}`;
}

// Canal de otro país (channels.list snippet.country): fuera. Sin país, se queda.
export function canalDeFuera(paisCanal, spot) {
  if (!paisCanal) return false;
  const p = paisSpot(spot);
  const validos = p === "NZ" ? ["NZ"] : ["ES", "PT"];
  return !validos.includes(String(paisCanal).toUpperCase());
}
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
  if (NO_ES_CAMARA.some((p) => contienePalabra(titulo, p))) return null;
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
    fuente: "YouTube",
  };
}

// --- OpenStreetMap (Overpass, sin clave) ---
// Objetos con webcam=URL o contact:webcam=URL a menos de RADIO_BUSQUEDA_KM
// de cada spot. Por lotes de LOTE_OSM spots: con los 65 de golpe Overpass
// pasaba de 150 s (primera pasada del 2026-11-08).
export const LOTE_OSM = 8;
export function consultaOverpass(spots, radioKm = RADIO_BUSQUEDA_KM) {
  const m = Math.round(radioKm * 1000);
  const partes = spots.map((s) => `nwr[~"^(contact:)?webcam$"~"."](around:${m},${s.lat},${s.lon});`);
  return `[out:json][timeout:60];(${partes.join("")});out center tags;`;
}

const esUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || "").trim());

// Elementos de Overpass -> candidatas (cada una asignada a su spot más cercano).
export function candidatasDeOsm(elementos, spots, yaEnApp, radioKm = RADIO_BUSQUEDA_KM) {
  const out = [];
  for (const e of elementos || []) {
    const t = e.tags || {};
    const url = String(t.webcam || t["contact:webcam"] || "").split(";")[0].trim();
    if (!esUrl(url) || yaEnApp.urls?.has(url)) continue;
    // Cámaras de tráfico (2026-11-08: «SH1 South Eastern Hwy», trafficnz.info).
    if (/traffic|tr[aá]fico|highway|motorway|autopista|carretera|\bsh\d/i.test(`${url} ${t.name || ""} ${t.operator || ""}`)) continue;
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let mejor = null;
    for (const s of spots) {
      const km = distanciaKm(s.lat, s.lon, lat, lon);
      if (km <= radioKm && (!mejor || km < mejor.km)) mejor = { s, km };
    }
    if (!mejor) continue;
    const nombre = t.name || t.operator || t.tourism || t.amenity || "webcam";
    out.push({
      spot: mejor.s.slug, spot_nombre: mejor.s.nombre, titulo: `${nombre} (OpenStreetMap)`, canal: t.operator || "—",
      video_id: `osm-${e.type}-${e.id}`, url, motivo: `a ${mejor.km.toFixed(1)} km del spot`, fuente: "OpenStreetMap",
    });
  }
  return out;
}

// --- Windy Webcams (opcional, WINDY_WEBCAMS_KEY) ---
// Categorías de Windy (include=categories): fuera las que no miran al mar
// si no tienen además una de mar (2026-11-08, Mikel: "exprime Windy").
export const CATEGORIAS_MAR = ["beach", "coast", "harbor", "harbour", "bay", "sea", "island", "water", "marina", "port"];
export const CATEGORIAS_FUERA = ["traffic", "indoor", "airport", "mountain", "city", "building", "square", "forest", "sportarea", "camping", "pool"];
export function categoriaValida(categorias) {
  const ids = (categorias || []).map((c) => String(c?.id ?? c).toLowerCase());
  if (!ids.length) return true;
  if (ids.some((c) => CATEGORIAS_MAR.includes(c))) return true;
  return !ids.some((c) => CATEGORIAS_FUERA.includes(c));
}

export function candidatasDeWindy(webcams, spot, yaEnApp) {
  const out = [];
  for (const w of webcams || []) {
    if (w.status && w.status !== "active") continue;
    if (!categoriaValida(w.categories)) continue;
    const loc = w.location || {};
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
    const km = distanciaKm(spot.lat, spot.lon, loc.latitude, loc.longitude);
    if (km > RADIO_BUSQUEDA_KM) continue;
    const url = w.urls?.detail || `https://www.windy.com/webcams/${w.webcamId}`;
    if (yaEnApp.urls?.has(url)) continue;
    out.push({
      spot: spot.slug, spot_nombre: spot.nombre, titulo: `${w.title || "Webcam"} (Windy)`, canal: loc.city || "—",
      video_id: `windy-${w.webcamId}`, url, motivo: `a ${km.toFixed(1)} km del spot`, fuente: "Windy",
    });
  }
  return out;
}

// --- Memoria entre semanas ---
// Marcas <!-- cand:spot:id --> de Issues anteriores: lo ya propuesto.
export const yaPropuestas = (texto) => new Set([...String(texto || "").matchAll(/<!-- cand:([^:\s]+):([^\s]+) -->/g)].map((m) => `${m[1]}:${m[2]}`));

// Claves de WEBCAMS_HLS en index.html (cámaras HLS propias de la app).
export function slugsHls(html) {
  const m = String(html).match(/^const WEBCAMS_HLS = \{([\s\S]*?)^\};/m);
  return m ? [...m[1].matchAll(/^\s+([a-z0-9]+):/gm)].map((x) => x[1]) : [];
}

export function cuerpoIssue({ fecha, totalSpots, listaHuecos, candidatas, sinClave, sinWindy = true, repetidas = [], fuentes = {} }) {
  const l = [
    `Búsqueda semanal de cámaras (${fecha}). Sin IA: \`scripts/camaras/buscar-camaras.mjs\`.`,
    "",
    `- Spots: ${totalSpots}; **sin ninguna cámara a menos de ${RADIO_KM} km: ${listaHuecos.length}**.`,
  ];
  if (sinClave) {
    l.push("- ⚠️ Sin `YOUTUBE_API_KEY`: no se ha buscado en YouTube. Mikel la saca una vez en console.cloud.google.com (YouTube Data API v3) y la guarda como secret de GitHub.");
  }
  if (sinWindy) {
    l.push("- ℹ️ Sin `WINDY_WEBCAMS_KEY`: no se ha mirado el directorio de webcams de Windy (gratis en https://api.windy.com/keys, secret de GitHub).");
  }
  const porFuente = Object.entries(fuentes).map(([f, n]) => `${f} ${n}`).join(", ");
  l.push(`- **Candidatas nuevas: ${candidatas.length}**${porFuente ? ` (${porFuente})` : ""}; ya propuestas otras semanas: ${repetidas.length}.`);
  if (candidatas.length) {
    l.push("", "## Candidatas nuevas", "", "Marca las que quieras en la app. Las de YouTube entran como **enlace** (nunca insertado: Costaviva tiene paywall); las demás, como enlace hasta tener permiso escrito del dueño.", "");
    for (const c of candidatas) {
      l.push(`- [ ] **${c.spot_nombre}** — [${c.titulo}](${c.url}) · ${c.fuente || "YouTube"} · ${c.canal} · ${c.motivo} <!-- cand:${c.spot}:${c.video_id} -->`);
    }
  }
  if (repetidas.length) {
    l.push("", "<details><summary>Ya propuestas otras semanas (siguen ahí)</summary>", "");
    for (const c of repetidas) l.push(`- [ ] **${c.spot_nombre}** — [${c.titulo}](${c.url}) · ${c.fuente || "YouTube"} <!-- cand:${c.spot}:${c.video_id} -->`);
    l.push("", "</details>");
  }
  l.push("", "<details><summary>Spots sin cámara</summary>", "", listaHuecos.map((s) => s.nombre).join(", ") || "Ninguno.", "", "</details>");
  return l.join("\n");
}

async function json(url, opciones = {}, quien = "YouTube") {
  const r = await fetch(url, { signal: AbortSignal.timeout(opciones.timeout || 20000), ...opciones });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${quien} ${r.status}: ${d?.error?.message || d?.message || "sin detalle"}`);
  return d;
}

async function buscarEnYoutube(spot, clave, yaEnApp) {
  const p = paisSpot(spot);
  const q = consultaYoutube(spot);
  const busq = await json(`${YT}/search?part=snippet&type=video&eventType=live&maxResults=25&regionCode=${p}&relevanceLanguage=${IDIOMA[p]}&q=${encodeURIComponent(q)}&key=${clave}`);
  const ids = (busq.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const vids = await json(`${YT}/videos?part=snippet,status,recordingDetails&id=${ids.join(",")}&key=${clave}`);
  const cands = (vids.items || []).map((v) => candidataDeVideo(v, spot, yaEnApp)).filter(Boolean);
  if (!cands.length) return [];
  const canales = [...new Set(cands.map((c) => c.canal_id))];
  const ch = await json(`${YT}/channels?part=snippet&id=${canales.join(",")}&key=${clave}`);
  const pais = new Map((ch.items || []).map((c) => [c.id, c.snippet?.country]));
  return cands.filter((c) => !canalDeFuera(pais.get(c.canal_id), spot));
}

// Servidor principal y una réplica pública por si el primero está saturado.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

async function loteOsm(lote, yaEnApp) {
  let ultimo;
  for (const url of OVERPASS) {
    try {
      const d = await json(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Costaviva-buscar-camaras/1.0 (+https://costaviva.org)" },
        body: "data=" + encodeURIComponent(consultaOverpass(lote)),
        timeout: 70000,
      }, "Overpass");
      return candidatasDeOsm(d.elements, lote, yaEnApp);
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo;
}

async function buscarEnOsm(spots, yaEnApp) {
  const out = [];
  for (let i = 0; i < spots.length; i += LOTE_OSM) {
    const lote = spots.slice(i, i + LOTE_OSM);
    try {
      out.push(...await loteOsm(lote, yaEnApp));
    } catch (e) {
      console.error(`✗ OpenStreetMap (${lote.map((s) => s.slug).join(", ")}): ${e.message}`);
    }
  }
  return out;
}

async function buscarEnWindy(spot, clave, yaEnApp) {
  const d = await json(`https://api.windy.com/webcams/api/v3/webcams?nearby=${spot.lat},${spot.lon},${RADIO_BUSQUEDA_KM}&limit=30&include=location,urls,categories`, { headers: { "x-windy-api-key": clave } }, "Windy");
  return candidatasDeWindy(d.webcams, spot, yaEnApp);
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
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const conCamara = new Set([...Object.keys(WEBCAMS), ...slugsHls(html), ...CAMARAS_EXTERNAS.map((c) => c.spot)]);
  const canalesPorSpot = new Map();
  for (const c of CAMARAS_EXTERNAS) {
    if (!c.canal_id) continue;
    if (!canalesPorSpot.has(c.spot)) canalesPorSpot.set(c.spot, new Set());
    canalesPorSpot.get(c.spot).add(c.canal_id);
  }
  const videos = new Set(CAMARAS_EXTERNAS.map((c) => c.youtube_id).filter(Boolean));
  const urls = new Set(CAMARAS_EXTERNAS.flatMap((c) => [c.url, c.imagen]).filter(Boolean));
  return { spots, conCamara, yaEnApp: { videos, canalesPorSpot, urls } };
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
  const salida = arg("--salida");
  const anteriores = arg("--anteriores");
  const clave = (process.env.YOUTUBE_API_KEY || "").trim();
  const claveWindy = (process.env.WINDY_WEBCAMS_KEY || "").trim();
  const { spots, conCamara, yaEnApp } = await cargar();
  const listaHuecos = huecos(spots, conCamara);
  const candidatas = [];
  try {
    candidatas.push(...await buscarEnOsm(listaHuecos, yaEnApp));
  } catch (e) {
    console.error(`✗ OpenStreetMap: ${e.message}`);
  }
  if (claveWindy) {
    for (const spot of listaHuecos) {
      try {
        candidatas.push(...await buscarEnWindy(spot, claveWindy, yaEnApp));
      } catch (e) {
        console.error(`✗ Windy ${spot.slug}: ${e.message}`);
        if (/40[13]/.test(e.message)) break;
      }
    }
  }
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
  // Un mismo directo o URL puede salir para dos spots: se queda el primero.
  const unicas = candidatas.filter((c, k) => candidatas.findIndex((x) => x.video_id === c.video_id || x.url === c.url) === k);
  const vistas = anteriores ? yaPropuestas(readFileSync(anteriores, "utf8")) : new Set();
  const nuevas = unicas.filter((c) => !vistas.has(`${c.spot}:${c.video_id}`));
  const repetidas = unicas.filter((c) => vistas.has(`${c.spot}:${c.video_id}`));
  const fuentes = {};
  for (const c of nuevas) fuentes[c.fuente] = (fuentes[c.fuente] || 0) + 1;
  const cuerpo = cuerpoIssue({ fecha: new Date().toISOString().slice(0, 10), totalSpots: spots.length, listaHuecos, candidatas: nuevas, sinClave: !clave, sinWindy: !claveWindy, repetidas, fuentes });
  console.log(`Spots ${spots.length}, sin cámara ${listaHuecos.length}, candidatas nuevas ${nuevas.length}, repetidas ${repetidas.length}${clave ? "" : " (sin YOUTUBE_API_KEY)"}${claveWindy ? "" : " (sin WINDY_WEBCAMS_KEY)"}.`);
  if (salida) writeFileSync(salida, cuerpo + "\n");
  else console.log(cuerpo);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
