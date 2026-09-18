// scripts/camaras/comprobar-camaras.mjs
// Corrido cada 30 min por .github/workflows/camaras-salud.yml. Pedido
// explícito del usuario (2026-09-18): un punto rojo automático cuando una
// webcam no está devolviendo imagen real. Decisión explícita suya, ya
// documentada en supabase/migrations/20260918120000_camara_estado.sql: NO
// se intenta distinguir "de noche, oscuro de verdad" de "cámara caída" —
// si el frame no tiene variación real de brillo (plano de verdad, típico
// de un frame de error del proveedor, un "sin señal", o un objetivo
// tapado/roto), cuenta como sin señal sea cual sea la causa. Un frame de
// noche real casi siempre conserva algo de variación (luces, ruido de
// sensor, silueta del horizonte) — no es infalible, pero es la misma
// asunción explícita que ya se aceptó para simplificar esto.
//
// Mismo motivo que scripts/turbidez/medir-turbidez.mjs para vivir aquí y
// no en Cloudflare Pages: Workers no tiene ninguna API de imagen/canvas
// para decodificar JPG/WebP/PNG ni para sacar un frame de un stream HLS —
// hace falta un runner real de Node con `sharp` + `ffmpeg` del sistema.
//
// Nunca inventa un dato: un spot cuya imagen no se puede descargar o
// decodificar se manda igualmente como "sin señal" (motivo distinto,
// para poder diferenciarlo en el histórico si hiciera falta depurar) — a
// diferencia de turbidez, aquí "no se pudo comprobar" SÍ es información
// útil en sí misma (si el proxy no responde, probablemente el usuario
// tampoco vería nada al abrir el panel de esa webcam).

import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WEBCAMS } from "../../functions/webcam/[slug].js";

const BASE_URL = "https://costaviva.org";
const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error("Falta la variable de entorno CRON_SECRET");
  process.exit(1);
}

// Un frame con toda su variación de brillo por debajo de esto se trata
// como "plano" (sin señal real). Umbral de diseño, no calibrado en
// laboratorio (mismo criterio que otros umbrales del repo, ej.
// indiceMar()) — revisar si da falsos positivos/negativos en real.
const UMBRAL_DESVIACION = 3;

// Mismas URLs que WEBCAMS_HLS en index.html — mantener sincronizado a
// mano, igual que ya hace SPOTS_VIDEO en scripts/turbidez/medir-turbidez.mjs.
const WEBCAMS_VIDEO = {
  hondarribia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_hondarribia_169.stream/playlist.m3u8",
  donostia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zurriola_169.stream/playlist.m3u8",
  orio: "https://58f14c0895a20.streamlock.net/camaramar/GIP_orio_169.stream/playlist.m3u8",
  zarautz: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zarautz_169.stream/playlist.m3u8",
  deba: "https://58f14c0895a20.streamlock.net/camaramar/GIP_deba_169.stream/playlist.m3u8",
  mutriku: "https://58f14c0895a20.streamlock.net/camaramar/GIP_mutrikukaia_169.stream/playlist.m3u8",
};

// Desviación típica de brillo (escala grises, 0-255) de un buffer de
// imagen ya descargado — sea cual sea el formato de origen (JPEG/WebP/
// PNG), sharp lo decodifica igual.
async function desviacionBrillo(buffer) {
  const { data } = await sharp(buffer)
    .resize(80, null, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = data.length;
  if (!n) return null;
  let suma = 0;
  for (let i = 0; i < n; i++) suma += data[i];
  const media = suma / n;
  let sumaCuadrados = 0;
  for (let i = 0; i < n; i++) sumaCuadrados += (data[i] - media) ** 2;
  return Math.sqrt(sumaCuadrados / n);
}

async function comprobarImagen(slug) {
  const resp = await fetch(`${BASE_URL}/webcam/${slug}`, { headers: { "User-Agent": "CostaVivaCamarasBot/1.0" } });
  if (!resp.ok) return { sinSenal: true, motivo: `http_${resp.status}` };
  const buffer = Buffer.from(await resp.arrayBuffer());
  const desviacion = await desviacionBrillo(buffer);
  if (desviacion == null) return { sinSenal: true, motivo: "sin_pixeles" };
  return desviacion < UMBRAL_DESVIACION
    ? { sinSenal: true, motivo: "frame_plano" }
    : { sinSenal: false, motivo: "ok" };
}

async function comprobarVideo(slug, url) {
  const dir = mkdtempSync(join(tmpdir(), "camaras-"));
  const salida = join(dir, "frame.jpg");
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", url, "-frames:v", "1", "-q:v", "2", salida],
      { timeout: 30000 }
    );
    const buffer = readFileSync(salida);
    const desviacion = await desviacionBrillo(buffer);
    if (desviacion == null) return { sinSenal: true, motivo: "sin_pixeles" };
    return desviacion < UMBRAL_DESVIACION
      ? { sinSenal: true, motivo: "frame_plano" }
      : { sinSenal: false, motivo: "ok" };
  } catch (e) {
    return { sinSenal: true, motivo: "sin_respuesta" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Lee el estado guardado la pasada anterior — solo hace falta
// ultima_senal_en, para no pisarlo con "ahora" cuando la cámara sigue
// caída (ver el comentario largo en functions/registrar-estado-camaras.js
// sobre por qué esto se decide aquí y no en el propio endpoint).
async function ultimaSenalPrevia() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/camara_estado?select=spot_slug,ultima_senal_en`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!resp.ok) return {};
  const filas = await resp.json();
  return Object.fromEntries(filas.map((f) => [f.spot_slug, f.ultima_senal_en]));
}

async function main() {
  const previo = await ultimaSenalPrevia().catch((e) => {
    console.log("No se pudo leer el estado previo, se asumirá vacío:", e.message);
    return {};
  });
  const ahora = new Date().toISOString();
  const lecturas = [];

  for (const slug of Object.keys(WEBCAMS)) {
    try {
      const r = await comprobarImagen(slug);
      lecturas.push({ spot: slug, sinSenal: r.sinSenal, motivo: r.motivo, ultimaSenalEn: r.sinSenal ? (previo[slug] ?? null) : ahora });
      console.log(`${r.sinSenal ? "✗" : "✓"} ${slug}: ${r.motivo}`);
    } catch (e) {
      lecturas.push({ spot: slug, sinSenal: true, motivo: "error_descarga", ultimaSenalEn: previo[slug] ?? null });
      console.log(`✗ ${slug}: error_descarga (${e.message})`);
    }
  }
  for (const [slug, url] of Object.entries(WEBCAMS_VIDEO)) {
    const r = await comprobarVideo(slug, url);
    lecturas.push({ spot: slug, sinSenal: r.sinSenal, motivo: r.motivo, ultimaSenalEn: r.sinSenal ? (previo[slug] ?? null) : ahora });
    console.log(`${r.sinSenal ? "✗" : "✓"} ${slug} (vídeo): ${r.motivo}`);
  }

  if (!lecturas.length) {
    console.error("Ninguna cámara se pudo comprobar — no se llama a /registrar-estado-camaras");
    process.exit(1);
  }

  const resp = await fetch(`${BASE_URL}/registrar-estado-camaras`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Cron-Secret": CRON_SECRET },
    body: JSON.stringify(lecturas),
  });
  const texto = await resp.text();
  console.log(`/registrar-estado-camaras -> HTTP ${resp.status}: ${texto}`);
  if (!resp.ok) process.exit(1);
}

main().catch((e) => {
  console.error("Fallo general del script:", e);
  process.exit(1);
});
