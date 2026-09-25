// scripts/turbidez/medir-turbidez.mjs
// Corrido una vez al día por .github/workflows/turbidez.yml, NUNCA por
// Cloudflare Pages (Workers no tiene API de imagen/canvas para decodificar
// JPG o vídeo — por eso esto vive en un runner de GitHub Actions con Node
// real, `sharp` para decodificar imágenes y `ffmpeg` del sistema para sacar
// un frame de los streams HLS).
//
// Para cada spot con webcam analizable: descarga una imagen (proxy propio
// /webcam/<slug> para las de imagen fija, o un frame vía ffmpeg para las de
// vídeo de Gipuzkoa), calcula saturación/tono medios del agua en HSV (se
// salta el 35% superior del encuadre — cielo/tierra/marca de fecha), pide
// la nubosidad real de Open-Meteo para ese spot a esta misma hora, y manda
// todo junto a /registrar-turbidez.
//
// Nunca inventa un dato: un spot cuya imagen no se puede descargar o
// decodificar simplemente no manda fila ese día (mejor sin lectura que una
// inventada) — el resto de spots no se ven afectados por el fallo de uno.

import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SPOTS } from "../../functions/prevision.js";

const BASE_URL = "https://costaviva.org";
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error("Falta la variable de entorno CRON_SECRET");
  process.exit(1);
}

// Spots de imagen fija con cámara verificada de mar abierto — mantener
// sincronizado a mano con SPOTS_CON_WEBCAM en index.html si cambia allí.
const SPOTS_IMAGEN = [
  "mundaka", "bakio", "sopelana",
  "baiona", "acoruna", "camarinas", "cangas", "ribadeo", "cies",
  "suances", "castrourdiales", "laredo", "sanvicente", "comillas", "santona",
  "calpe", "peniscola", "gandia", "alicante", "altea",
  "benidorm", "guardamardelsegura", "vilajoiosa",
  "pilardelahoradada", "santapola", "javea", "alcossebre", "benicassim",
  "xilxes", "oropesa", "torreblanca", "vinaros", "alboraya", "pobladefarnals",
  "oliva", "piles",
  "calamillor", "sonbou", "muro",
  // Águilas, añadida 2026-09-25 junto con su cámara. Empieza a acumular
  // histórico desde hoy: necesita 14 lecturas (TURBIDEZ_MIN_LECTURAS) antes
  // de poder clasificar nada, así que hasta ~2026-10-09 mostrará S/D.
  "aguilas",
];

// Mismas URLs que WEBCAMS_HLS en index.html — mantener sincronizado a mano.
const SPOTS_VIDEO = {
  hondarribia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_hondarribia_169.stream/playlist.m3u8",
  donostia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zurriola_169.stream/playlist.m3u8",
  orio: "https://58f14c0895a20.streamlock.net/camaramar/GIP_orio_169.stream/playlist.m3u8",
  zarautz: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zarautz_169.stream/playlist.m3u8",
  deba: "https://58f14c0895a20.streamlock.net/camaramar/GIP_deba_169.stream/playlist.m3u8",
  mutriku: "https://58f14c0895a20.streamlock.net/camaramar/GIP_mutrikukaia_169.stream/playlist.m3u8",
};

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s];
}

// Analiza los píxeles ya decodificados (RGB planos, sin alfa) y devuelve
// saturación media (0-100) y tono medio circular (0-360) de la zona de agua
// (se salta el 35% superior del frame — cielo/tierra/marca de fecha).
function analizarPixeles(data, width, height) {
  const y0 = Math.round(height * 0.35);
  const alto = height - y0;
  let sumaSat = 0, sumaSin = 0, sumaCos = 0, n = 0;
  for (let y = y0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 3;
      const [h, s] = rgbToHsv(data[p], data[p + 1], data[p + 2]);
      sumaSat += s * 100;
      sumaSin += Math.sin((h * Math.PI) / 180);
      sumaCos += Math.cos((h * Math.PI) / 180);
      n++;
    }
  }
  if (!n) return null;
  let tono = (Math.atan2(sumaSin, sumaCos) * 180) / Math.PI;
  if (tono < 0) tono += 360;
  return { saturacion: sumaSat / n, tono, alto };
}

async function bufferAPixeles(buffer) {
  const w = 160;
  const { data, info } = await sharp(buffer)
    .resize(w, null, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return analizarPixeles(data, info.width, info.height);
}

async function medirSpotImagen(slug) {
  const resp = await fetch(`${BASE_URL}/webcam/${slug}`, { headers: { "User-Agent": "CostaVivaTurbidezBot/1.0" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const r = await bufferAPixeles(buffer);
  if (!r) throw new Error("sin píxeles analizables");
  return r;
}

async function medirSpotVideo(slug, url) {
  const dir = mkdtempSync(join(tmpdir(), "turbidez-"));
  const salida = join(dir, "frame.jpg");
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", url, "-frames:v", "1", "-q:v", "2", salida],
      { timeout: 30000 }
    );
    const buffer = readFileSync(salida);
    const r = await bufferAPixeles(buffer);
    if (!r) throw new Error("sin píxeles analizables");
    return r;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function nubosidadPorSpot(slugs) {
  const spotsPorSlug = new Map(SPOTS.map((s) => [s.slug, s]));
  const validos = slugs.filter((s) => spotsPorSlug.has(s));
  if (!validos.length) return {};
  const lats = validos.map((s) => spotsPorSlug.get(s).lat).join(",");
  const lons = validos.map((s) => spotsPorSlug.get(s).lon).join(",");
  const resp = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=cloud_cover&timezone=Europe%2FMadrid`
  );
  if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
  const datos = await resp.json();
  const lista = Array.isArray(datos) ? datos : [datos];
  const resultado = {};
  validos.forEach((slug, i) => { resultado[slug] = lista[i]?.current?.cloud_cover ?? null; });
  return resultado;
}

async function main() {
  const todosLosSlugs = [...SPOTS_IMAGEN, ...Object.keys(SPOTS_VIDEO)];
  const nubosidad = await nubosidadPorSpot(todosLosSlugs).catch((e) => {
    console.log("No se pudo obtener nubosidad, se guardará como null:", e.message);
    return {};
  });

  const lecturas = [];
  for (const slug of SPOTS_IMAGEN) {
    try {
      const r = await medirSpotImagen(slug);
      lecturas.push({ spot: slug, saturacion: r.saturacion, tono: r.tono, nubosidad: nubosidad[slug] ?? null });
      console.log(`✓ ${slug}: saturación ${r.saturacion.toFixed(1)}, tono ${r.tono.toFixed(0)}°`);
    } catch (e) {
      console.log(`✗ ${slug}: ${e.message}`);
    }
  }
  for (const [slug, url] of Object.entries(SPOTS_VIDEO)) {
    try {
      const r = await medirSpotVideo(slug, url);
      lecturas.push({ spot: slug, saturacion: r.saturacion, tono: r.tono, nubosidad: nubosidad[slug] ?? null });
      console.log(`✓ ${slug} (vídeo): saturación ${r.saturacion.toFixed(1)}, tono ${r.tono.toFixed(0)}°`);
    } catch (e) {
      console.log(`✗ ${slug} (vídeo): ${e.message}`);
    }
  }

  if (!lecturas.length) {
    console.error("Ninguna lectura se pudo calcular — no se llama a /registrar-turbidez");
    process.exit(1);
  }

  const resp = await fetch(`${BASE_URL}/registrar-turbidez`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Cron-Secret": CRON_SECRET },
    body: JSON.stringify(lecturas),
  });
  const texto = await resp.text();
  console.log(`/registrar-turbidez -> HTTP ${resp.status}: ${texto}`);
  if (!resp.ok) process.exit(1);
}

main().catch((e) => {
  console.error("Fallo general del script:", e);
  process.exit(1);
});
