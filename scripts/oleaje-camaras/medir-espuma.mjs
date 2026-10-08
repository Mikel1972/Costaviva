// scripts/oleaje-camaras/medir-espuma.mjs
// Registro de la métrica de espuma de las webcams junto al oleaje de mar
// abierto del mismo momento (2026-10-08). Lo corre
// .github/workflows/espuma-camaras.yml varias veces al día con luz. SIN IA y
// sin tocar producción: lee los streams HLS públicos de la Diputación Foral
// de Gipuzkoa, Open-Meteo Marine (con OPEN_METEO_API_KEY si existe) y la boya
// Pasaia II de Puertos del Estado, y AÑADE una línea por cámara a
// datos-robots/oleaje-camaras/espuma.jsonl.
//
// Para qué: dentro de unas semanas, con mar abierto de tamaños y direcciones
// variados, calcular el coeficiente de exposición de cada spot con cámara
// (umbralRotura/coeficienteRelativo en espuma.mjs) y sustituir con él los
// coeficientes estimados a mano de functions/_lib/oleaje-costero.js. Nada de
// esto se enseña en la app ni cambia ningún número por sí solo: la propuesta
// de coeficientes se le enseña a Mikel antes de aplicarla.
//
// Nunca inventa un dato: una cámara que no responde o no se puede decodificar
// no escribe línea (se avisa en el log); un dato externo que falla va a null.
//
// Uso: node scripts/oleaje-camaras/medir-espuma.mjs [--salida fichero.jsonl] [--seco]
//   --seco: imprime las líneas sin escribir el fichero.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROI_CAMARAS, medirEspuma, huella, similitud, SIMILITUD_MINIMA } from "./espuma.mjs";
import { SPOTS, factorOleaje } from "../../functions/prevision.js";
import { pedirDatosMeteo, fuenteDeVariable } from "../../functions/_lib/fuentes.js";
import { coeficienteAbrigo } from "../../functions/_lib/oleaje-costero.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const SECO = args.includes("--seco");
const iSalida = args.indexOf("--salida");
const SALIDA = iSalida >= 0 ? args[iSalida + 1] : join(RAIZ, "datos-robots", "oleaje-camaras", "espuma.jsonl");

const ANCHO = 320; // se reduce el frame: la métrica es una fracción, no necesita resolución
const FRAMES = 5; // 5 frames repartidos en un segmento de ~10 s; se guarda la mediana
const UA = { "User-Agent": "CostaVivaEspumaBot/1.0 (+https://costaviva.org)" };

function mediana(v) {
  const o = v.filter(Number.isFinite).sort((a, b) => a - b);
  if (!o.length) return null;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

async function texto(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return r.text();
}

// Último segmento .ts de un HLS (playlist maestra -> chunklist -> segmento).
async function ultimoSegmento(url) {
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  const lineas = (t) => t.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  let lista = await texto(url);
  let urlLista = url;
  const primera = lineas(lista)[0];
  if (primera && primera.includes(".m3u8")) {
    urlLista = new URL(primera, base).href;
    lista = await texto(urlLista);
  }
  const seg = lineas(lista).pop();
  if (!seg) throw new Error("playlist sin segmentos");
  const r = await fetch(new URL(seg, urlLista).href, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`segmento HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const ALTO = 180; // todas las cámaras de la Diputación son 16:9
const INTENTOS = 15; // hasta 15 segmentos (~5 min) separados INTERVALO_MS buscando el encuadre de referencia
const INTERVALO_MS = 20000;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function rgbDesdeFichero(fichero, filtros = "", maxFrames = 1) {
  const crudo = execFileSync(
    "ffmpeg",
    ["-loglevel", "error", "-i", fichero, "-vf", `${filtros}scale=${ANCHO}:${ALTO}`, "-frames:v", String(maxFrames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { timeout: 60000, maxBuffer: 64 * 1024 * 1024 }
  );
  const tam = ANCHO * ALTO * 3;
  const frames = [];
  for (let o = 0; o + tam <= crudo.length; o += tam) frames.push(crudo.subarray(o, o + tam));
  return frames;
}

// Huella del encuadre de referencia de cada cámara (el frame en el que se
// dibujó su ROI, guardado en referencias/<spot>.jpg).
function huellaReferencia(slug) {
  const f = join(RAIZ, "scripts", "oleaje-camaras", "referencias", `${slug}.jpg`);
  const [rgb] = rgbDesdeFichero(f);
  return rgb ? huella(rgb, ANCHO, ALTO) : null;
}

async function segmentoConReintento(url) {
  try {
    return await ultimoSegmento(url);
  } catch (e) {
    // Wowza da a veces 404 en la chunklist de sesión recién creada (visto el
    // 2026-10-08 con Orio): un segundo intento suele bastar.
    await espera(3000);
    return ultimoSegmento(url);
  }
}

// Las cámaras hacen una ronda de encuadres: se piden hasta INTENTOS
// segmentos y solo se miden los frames que coinciden con el de referencia.
async function medirCamara(slug, roi) {
  const ref = huellaReferencia(slug);
  if (!ref) throw new Error("sin imagen de referencia");
  const dir = mkdtempSync(join(tmpdir(), "espuma-"));
  let mejorSimilitud = -1;
  try {
    for (let intento = 1; intento <= INTENTOS; intento++) {
      const ts = join(dir, `seg${intento}.ts`);
      writeFileSync(ts, await segmentoConReintento(roi.url));
      const frames = rgbDesdeFichero(ts, "fps=0.5,", FRAMES);
      const validos = [];
      for (const f of frames) {
        const sim = similitud(ref, huella(f, ANCHO, ALTO));
        if (sim !== null && sim > mejorSimilitud) mejorSimilitud = sim;
        if (sim !== null && sim >= SIMILITUD_MINIMA) validos.push(f);
      }
      if (validos.length) {
        const medidas = validos.map((f) => medirEspuma(f, ANCHO, ALTO, roi));
        const ok = medidas.filter((m) => m.estado === "ok");
        const estado = ok.length ? "ok" : medidas.some((m) => m.estado === "sin_luz") ? "sin_luz" : "dudosa";
        const usar = ok.length ? ok : medidas;
        return {
          espuma: mediana(usar.map((m) => m.espuma)),
          // Máximo de los frames: con series de olas de ~10 s, la mediana
          // puede caer entre series; el máximo dice si llega a romper algo.
          espumaMax: Math.max(...usar.map((m) => m.espuma ?? 0)),
          espumaFrames: medidas.map((m) => m.espuma),
          brilloMedio: mediana(usar.map((m) => m.brilloMedio)),
          similitud: mejorSimilitud,
          intentos: intento,
          estado,
        };
      }
      if (intento < INTENTOS) await espera(INTERVALO_MS);
    }
    // Nunca pasó por el encuadre de referencia: se registra igual (sirve para
    // conocer la ronda de la cámara), sin espuma.
    return { espuma: null, espumaMax: null, espumaFrames: [], brilloMedio: null, similitud: mejorSimilitud, intentos: INTENTOS, estado: "otro_encuadre" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Mar abierto del modelo en la hora actual para los spots con cámara.
async function marAbiertoPorSpot(slugs) {
  const spots = slugs.map((s) => SPOTS.find((x) => x.slug === s)).filter(Boolean);
  if (!spots.length) return {};
  const datos = await pedirDatosMeteo(
    "marine",
    `latitude=${spots.map((s) => s.lat).join(",")}&longitude=${spots.map((s) => s.lon).join(",")}` +
      "&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,sea_level_height_msl&timezone=UTC&forecast_days=1",
    { env: process.env }
  );
  const lista = Array.isArray(datos) ? datos : [datos];
  const horaUTC = new Date().toISOString().slice(0, 13);
  const fuente = fuenteDeVariable("marine", "wave_height", process.env);
  const res = {};
  spots.forEach((s, i) => {
    const h = lista[i]?.hourly;
    const idx = h?.time?.findIndex((t) => t.startsWith(horaUTC)) ?? -1;
    if (!h || idx < 0) return;
    const hs = h.wave_height?.[idx] ?? null;
    const dir = h.wave_direction?.[idx] ?? null;
    const factor = factorOleaje(s.lat, s.lon, fuente);
    res[s.slug] = {
      fuente,
      celda: [lista[i].latitude ?? null, lista[i].longitude ?? null],
      hs,
      hsCorregida: hs === null ? null : +(hs * factor).toFixed(2),
      dir,
      periodo: h.wave_period?.[idx] ?? null,
      hsFondo: h.swell_wave_height?.[idx] ?? null,
      dirFondo: h.swell_wave_direction?.[idx] ?? null,
      nivelMar: h.sea_level_height_msl?.[idx] ?? null,
      coefAbrigoActual: coeficienteAbrigo(s.slug, dir),
    };
  });
  return res;
}

// Boya Pasaia II (1101), última medida de las 3 últimas horas.
async function boyaPasaia() {
  const p2 = (n) => String(n).padStart(2, "0");
  const f = (d) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}@${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
  const ahora = new Date();
  const url = `https://poem.puertos.es/portus/StationData?code=1101&params=Hm0,Tp,MeanDir&from=${f(new Date(ahora - 3 * 3600e3))}&to=${f(ahora)}`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`boya HTTP ${r.status}`);
  const [cab, filas] = await r.json();
  const ult = filas?.[filas.length - 1];
  if (!ult) return null;
  const val = (pref) => {
    const i = cab.findIndex((c) => c.startsWith(pref));
    const n = i < 0 ? NaN : Number(ult[i]?.[0]);
    return Number.isFinite(n) ? n : null;
  };
  return { hora: new Date(ult[0] * 1000).toISOString(), hm0: val("Hm0"), tp: val("Tp"), dir: val("MeanDir") };
}

async function main() {
  const slugs = Object.keys(ROI_CAMARAS);
  const [mar, boya] = await Promise.all([
    marAbiertoPorSpot(slugs).catch((e) => (console.log("Mar abierto no disponible:", e.message), {})),
    boyaPasaia().catch((e) => (console.log("Boya Pasaia II no disponible:", e.message), null)),
  ]);
  const fecha = new Date().toISOString();
  const lineas = [];
  // Las 6 cámaras en paralelo: cada una puede tardar hasta ~2,5 min
  // esperando su encuadre de referencia.
  const resultados = await Promise.all(
    slugs.map((slug) => medirCamara(slug, ROI_CAMARAS[slug]).then((m) => ({ slug, m }), (e) => ({ slug, e })))
  );
  for (const { slug, m, e } of resultados) {
    if (e) {
      console.log(`✗ ${slug}: ${e.message}`);
      continue;
    }
    lineas.push({ fecha, spot: slug, ...m, marAbierto: mar[slug] ?? null, boyaPasaia: boya });
    console.log(`✓ ${slug}: espuma ${m.espuma} (${m.estado}, similitud ${m.similitud}, ${m.intentos} intentos), mar abierto ${mar[slug]?.hsCorregida ?? "?"} m`);
  }
  if (!lineas.length) {
    console.error("Ninguna cámara se pudo medir.");
    process.exit(1);
  }
  const txt = lineas.map((l) => JSON.stringify(l)).join("\n") + "\n";
  if (SECO) {
    process.stdout.write(txt);
    return;
  }
  mkdirSync(dirname(SALIDA), { recursive: true });
  appendFileSync(SALIDA, txt);
  console.log(`${lineas.length} líneas añadidas a ${SALIDA}`);
}

main().catch((e) => {
  console.error("Fallo general:", e);
  process.exit(1);
});
