// scripts/marketing/reel-comun.mjs — montaje compartido de los reels de lista
// (2026-11-19: series "Normas que nadie te cuenta" y "Dónde pescar este
// finde"). Mismo proceso que reel-peces.mjs: un clip de peces de clips/stock
// de fondo, ralentizado, y encima la plantilla pintada fotograma a fotograma
// con Playwright; ffmpeg monta el MP4 (1080x1920, H.264, audio mudo).
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { clipsDePeces, siguienteDe } from "./reel-peces.mjs";
import { apuntarGenerada } from "./calendario.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = join(__dirname, "..", "..");
export const PLANTILLA_LISTA = pathToFileURL(join(__dirname, "plantillas", "reel-lista.html")).href;
export const RUTA_ESTADO = join(__dirname, "calendario-estado.json");
export const RUTA_ROTACION_PECES = join(__dirname, "rotacion-reels-peces.json");
const DURACION = 13, FPS = 30;

export const leerJson = (ruta) => { try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return {}; } };

// Lema del cierre, común a las series.
export const LEMA = "Mareas, olas, normas y el índice de pesca de tu zona. <em>En tiempo real, en una sola app.</em>";

// Clip de fondo: el siguiente de la rotación de peces (o el forzado).
export function elegirClip(forzado = "") {
  const rotacion = leerJson(RUTA_ROTACION_PECES);
  const clips = clipsDePeces();
  if (!clips.length) throw new Error("No hay vídeos de peces en clips/stock.");
  const fichero = forzado || siguienteDe(clips, rotacion.ultimoClip)[0];
  const ruta = join(__dirname, "clips", "stock", fichero);
  const licencia = JSON.parse(readFileSync(ruta.replace(/\.mp4$/, ".licencia.json"), "utf8"));
  return { fichero, ruta, licencia, credito: `Vídeo: ${new URL(licencia.origen).hostname.replace(/^www\./, "")}` };
}

export async function montarVideo({ datos, clip, rutaRelativa }) {
  const salida = join(RAIZ_REPO, rutaRelativa);
  mkdirSync(dirname(salida), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "reel-lista-"));
  try {
    const durClip = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip.ruta]).toString());
    const lento = (DURACION / durClip).toFixed(4);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", clip.ruta, "-vf", `setpts=${lento}*PTS,${lento > 2 ? `minterpolate=fps=${FPS}:mi_mode=blend` : `fps=${FPS}`},eq=contrast=1.08:saturation=1.15`, "-t", String(DURACION), "-q:v", "3", join(dir, "c%04d.jpg")]);
    const { abrirNavegador } = await import("./render.mjs");
    const navegador = await abrirNavegador();
    try {
      const ctx = await navegador.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await ctx.route(/^https?:\/\//, (r) => r.abort());
      const page = await ctx.newPage();
      await page.goto(PLANTILLA_LISTA);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((d) => window.preparar(d), datos);
      for (let n = 0; n < DURACION * FPS; n++) {
        const fondo = pathToFileURL(join(dir, `c${String(n + 1).padStart(4, "0")}.jpg`)).href;
        await page.evaluate((f) => window.fotograma(f), { t: n / FPS, fondo });
        await page.waitForFunction(() => document.getElementById("fondo").complete);
        await page.screenshot({ path: join(dir, `f${String(n).padStart(4, "0")}.png`) });
      }
      await ctx.close();
    } finally {
      await navegador.close();
    }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"),
      "-f", "lavfi", "-t", String(DURACION), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", salida]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`✓ ${rutaRelativa} (${(statSync(salida).size / 1e6).toFixed(1)} MB)`);
}

// Deja reel-pendiente.json (lo lee publicar-borrador-instagram.mjs), avanza
// la rotación del clip y apunta la pieza en el calendario.
export function apuntarReel({ tipo, caption, rutaRelativa, baseUrl, fecha, hora, campana, clip, estado, clave, rotacionPropia }) {
  writeFileSync(join(__dirname, "reel-pendiente.json"), JSON.stringify({
    tipo, esReel: true, caption, rutaRelativa, publicUrl: `${baseUrl}/${rutaRelativa}`,
    fecha, hora, dia: new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" }).format(new Date(`${fecha}T12:00:00Z`)),
    campana, mercado: "es", idioma: "es", clip: { carpeta: "stock", fichero: clip.fichero, personaIdentificable: clip.licencia.persona_identificable === false ? false : true },
  }, null, 2));
  const rot = leerJson(RUTA_ROTACION_PECES);
  writeFileSync(RUTA_ROTACION_PECES, JSON.stringify({ ...rot, ultimoClip: clip.fichero }, null, 2) + "\n");
  if (rotacionPropia) writeFileSync(rotacionPropia.ruta, JSON.stringify(rotacionPropia.datos, null, 2) + "\n");
  writeFileSync(RUTA_ESTADO, JSON.stringify(apuntarGenerada(estado, clave, { tipo, campana }), null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=true\n");
}
