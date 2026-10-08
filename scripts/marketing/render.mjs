// scripts/marketing/render.mjs
// Renderiza las piezas de Instagram con Playwright (Chromium) a partir de
// plantillas/pieza.html, y monta el reel con ffmpeg (2026-10-08). Sin IA.
//
// Reel: la plantilla pinta cada fotograma (30 fps) en PNG, con los
// fotogramas del clip de fondo en el gancho (el Chromium de Playwright no
// reproduce H.264, por eso los saca ffmpeg antes). Salida MP4 H.264 + AAC en
// silencio (Instagram pide pista de audio), 1080x1920, yuv420p.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escenaEn, contar, fotogramas, DURACION_REEL, GUION_REEL } from "./pieza-datos.mjs";

const PLANTILLA = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "plantillas", "pieza.html")).href;

export function abrirNavegador() {
  // En local se puede apuntar a un Chromium ya instalado; en Actions,
  // `npx playwright install chromium` deja el suyo.
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

async function paginaPlantilla(navegador, alto) {
  const ctx = await navegador.newContext({ viewport: { width: 1080, height: alto }, deviceScaleFactor: 1 });
  // La plantilla no necesita red: fuentes locales e imágenes en data: URL.
  await ctx.route(/^https?:\/\//, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(PLANTILLA);
  return { ctx, page };
}

// Post (1080x1350) o story (1080x1920) a PNG. Devuelve false si algo se sale
// del lienzo, para que el script avise en vez de publicar una pieza cortada.
export async function renderImagen(navegador, datos, ruta) {
  const alto = datos.formato === "post" ? 1350 : 1920;
  const { ctx, page } = await paginaPlantilla(navegador, alto);
  const cabe = await page.evaluate((d) => window.pintar(d), datos);
  if (!cabe) console.warn("Se sale del lienzo:", await page.evaluate(() => window.__desbordan.slice(0, 8).join(", ")));
  await page.screenshot({ path: ruta });
  await ctx.close();
  return cabe;
}

// Reel de DURACION_REEL segundos. `clip` es un vídeo propio o de stock con
// licencia (ver generar-reel-instagram.mjs); sin clip, el gancho va sobre el
// fondo de mar de la marca. ffmpeg saca primero los fotogramas del clip
// (recorte vertical del centro a 1080x1920, con un pelín más de contraste y
// color: los clips de stock suelen venir lavados) y la plantilla los pone de fondo
// del gancho: así ffmpeg solo tiene que codificar una secuencia de imágenes
// (componer con overlay en ffmpeg se quedaba bloqueado).
export async function renderReel(navegador, datos, { salida, clip = null, fps = 30, crf = 26 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "reel-"));
  try {
    const gancho = GUION_REEL[0].dura;
    if (clip) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-t", String(gancho), "-i", clip,
        "-vf", `scale=-2:1920,crop=1080:1920,fps=${fps},eq=contrast=1.06:saturation=1.12`, "-q:v", "3", join(dir, "c%04d.jpg")]);
    }
    const { ctx, page } = await paginaPlantilla(navegador, 1920);
    await page.evaluate((d) => window.prepararReel(d), datos);
    const total = fotogramas(fps);
    for (let n = 0; n < total; n++) {
      const t = n / fps;
      const { escena, progreso } = escenaEn(t);
      const nota = escena === "datos" && datos.resumen ? contar(datos.resumen.puntuacion, Math.min(1, progreso / 0.55)) : null;
      const fondo = escena === "gancho" && clip ? pathToFileURL(join(dir, `c${String(Math.min(n, Math.round(gancho * fps) - 1) + 1).padStart(4, "0")}.jpg`)).href : null;
      await page.evaluate((f) => window.fotograma(f), { escena, progreso, nota, fondo });
      await page.screenshot({ path: join(dir, `f${String(n).padStart(4, "0")}.png`) });
    }
    await ctx.close();
    execFileSync("ffmpeg", [
      "-v", "error", "-y", "-framerate", String(fps), "-i", join(dir, "f%04d.png"),
      "-f", "lavfi", "-t", String(DURACION_REEL), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", salida,
    ]);
    return statSync(salida).size;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function guardarJson(ruta, objeto) {
  writeFileSync(ruta, JSON.stringify(objeto, null, 2) + "\n");
}
