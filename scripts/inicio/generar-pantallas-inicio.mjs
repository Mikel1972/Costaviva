// scripts/inicio/generar-pantallas-inicio.mjs
// Pantalla de inicio de la app (2026-10-09, pedido de Mikel con captura del
// iPhone): genera, sin IA y sin tocar nada a mano,
//   1. la foto de fondo de #comprobandoAcceso (assets/css/pantalla-inicio.css)
//      en WebP + JPG de reserva, ≤ 80 kB cada una:
//        assets/inicio/rompiente-movil.{webp,jpg}  720x1280 (vertical)
//        assets/inicio/rompiente-ancha.{webp,jpg} 1280x720 (horizontal)
//   2. las imágenes de arranque de iOS (apple-touch-startup-image) para los
//      iPhone habituales, que son esa misma pantalla pintada con Chromium a
//      partir del bloque de index.html (sin el indicador de carga), y
//   3. el bloque de <link> que las declara en index.html y login.html (entre
//      <!-- arranque-ios --> y <!-- /arranque-ios -->).
//
// Origen de la foto: fotograma (0,4 s) del clip de Coverr "A young man fishing
// on a rocky beach", guardado en scripts/inicio/coverr-rocas-oleaje-6277-0.4s.jpg.
// Licencia en scripts/inicio/LICENCIA.json (uso comercial, sin atribución
// obligatoria). Si cambias la foto, cambia también los nombres de los ficheros
// (_headers les da una semana de caché).
//
//   node scripts/inicio/generar-pantallas-inicio.mjs
//
// Necesita ffmpeg (con libwebp) y Playwright: usa el de scripts/marketing
// (`npm ci` allí) o CHROMIUM_PATH apuntando a un Chromium ya instalado.
// test/pantalla-inicio.test.js comprueba el resultado (sin red ni navegador).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FOTOGRAMA = "scripts/inicio/coverr-rocas-oleaje-6277-0.4s.jpg"; // 1920x1080
export const MAX_BYTES = 80 * 1024;

// Recortes del fotograma (1920x1080). El vertical, de 608x1080, deja la ola
// rompiendo a la izquierda y al pescador en el centro.
export const FOTOS = [
  { nombre: "rompiente-movil", ancho: 720, alto: 1280, filtro: "crop=608:1080:330:0" },
  { nombre: "rompiente-ancha", ancho: 1280, alto: 720, filtro: "crop=1920:1080:0:0" },
];

// iPhone en vertical (el manifest fija "orientation": "portrait"): ancho y
// alto en puntos CSS y densidad. La imagen mide ancho*dpr x alto*dpr.
export const DISPOSITIVOS = [
  { w: 440, h: 956, dpr: 3, modelos: "16 Pro Max, 17 Pro Max" },
  { w: 402, h: 874, dpr: 3, modelos: "16 Pro, 17, 17 Pro" },
  { w: 430, h: 932, dpr: 3, modelos: "14 Pro Max, 15 Plus/Pro Max, 16 Plus" },
  { w: 393, h: 852, dpr: 3, modelos: "14 Pro, 15, 15 Pro, 16" },
  { w: 428, h: 926, dpr: 3, modelos: "12/13 Pro Max, 14 Plus" },
  { w: 390, h: 844, dpr: 3, modelos: "12, 13, 14, 12/13 Pro" },
  { w: 375, h: 812, dpr: 3, modelos: "X, XS, 11 Pro, 12/13 mini" },
  { w: 414, h: 896, dpr: 3, modelos: "XS Max, 11 Pro Max" },
  { w: 414, h: 896, dpr: 2, modelos: "XR, 11" },
  { w: 414, h: 736, dpr: 3, modelos: "6/7/8 Plus" },
  { w: 375, h: 667, dpr: 2, modelos: "SE 2.ª/3.ª, 6/7/8" },
];

export const rutaArranque = (d) => `/assets/inicio/arranque/arranque-${d.w * d.dpr}x${d.h * d.dpr}.jpg`;

export const PAGINAS_ARRANQUE = ["index.html", "login.html"];
const INICIO = "<!-- arranque-ios -->";
const FIN = "<!-- /arranque-ios -->";

export function bloqueArranque() {
  const lineas = DISPOSITIVOS.map((d) =>
    `<link rel="apple-touch-startup-image" media="screen and (device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)" href="${rutaArranque(d)}">`);
  return `${INICIO}\n<!-- Pantallas de arranque de la app instalada en iPhone: la foto y la marca de
     la pantalla de inicio. GENERADO por scripts/inicio/generar-pantallas-inicio.mjs. -->\n${lineas.join("\n")}\n${FIN}`;
}

// Mete (o sustituye) el bloque en la página, justo detrás del theme-color.
export function conBloqueArranque(html) {
  const i = html.indexOf(INICIO);
  if (i >= 0) return html.slice(0, i) + bloqueArranque() + html.slice(html.indexOf(FIN) + FIN.length);
  const ancla = html.match(/<meta name="theme-color"[^>]*>\n/);
  if (!ancla) throw new Error("sin <meta name=\"theme-color\"> donde colgar el bloque");
  const j = ancla.index + ancla[0].length;
  return html.slice(0, j) + bloqueArranque() + "\n" + html.slice(j);
}

// El bloque de la pantalla de inicio tal cual está en index.html.
export function bloquePantalla(html) {
  const m = html.match(/<div id="comprobandoAcceso" class="pantalla-inicio">[\s\S]*?\n<\/div>\n<!-- \/pantalla-inicio -->/);
  if (!m) throw new Error("index.html sin el bloque de la pantalla de inicio");
  return m[0];
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
}

// Baja la calidad hasta que la foto quepa en MAX_BYTES.
function fotoOptimizada(foto) {
  const entrada = join(RAIZ, FOTOGRAMA);
  // Un pelín más de contraste y color: los clips de stock vienen lavados.
  const vf = `${foto.filtro},scale=${foto.ancho}:${foto.alto}:flags=lanczos,eq=contrast=1.05:saturation=1.1`;
  const salidas = [
    { ext: ".webp", calidades: [78, 72, 66, 60, 55, 50, 45], args: (q) => ["-c:v", "libwebp", "-quality", String(q), "-compression_level", "6"] },
    { ext: ".jpg", calidades: [5, 6, 7, 8, 9, 10, 12], args: (q) => ["-q:v", String(q)] },
  ];
  for (const s of salidas) {
    const ruta = join(RAIZ, "assets/inicio", foto.nombre + s.ext);
    for (const q of s.calidades) {
      ffmpeg(["-i", entrada, "-vf", vf, "-frames:v", "1", ...s.args(q), ruta]);
      if (statSync(ruta).size <= MAX_BYTES) break;
    }
    const kb = (statSync(ruta).size / 1024).toFixed(1);
    if (statSync(ruta).size > MAX_BYTES) throw new Error(`${ruta}: ${kb} kB, no baja de 80 kB`);
    console.log(`assets/inicio/${foto.nombre}${s.ext}: ${kb} kB`);
  }
}

async function abrirChromium() {
  let pw;
  try { pw = await import("playwright"); } catch {
    try { pw = createRequire(join(RAIZ, "scripts/marketing/package.json"))("playwright"); } catch {
      throw new Error("Falta Playwright: `npm ci` en scripts/marketing");
    }
  }
  const chromium = pw.chromium || pw.default.chromium;
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

const TIPOS = { ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg", ".html": "text/html" };

async function pantallasArranque() {
  const bloque = bloquePantalla(readFileSync(join(RAIZ, "index.html"), "utf8"))
    .replace('class="pantalla-inicio"', 'class="pantalla-inicio es-arranque"');
  const pagina = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="/assets/css/costaviva.css"><link rel="stylesheet" href="/assets/css/pantalla-inicio.css">
</head><body>${bloque}</body></html>`;
  const dir = join(RAIZ, "assets/inicio/arranque");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const navegador = await abrirChromium();
  try {
    for (const d of DISPOSITIVOS) {
      const ctx = await navegador.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr });
      // Sin red: la página y sus ficheros salen del repo.
      await ctx.route("**/*", (r) => {
        const url = new URL(r.request().url());
        if (url.host !== "costaviva.local") return r.abort();
        if (url.pathname === "/") return r.fulfill({ body: pagina, contentType: "text/html" });
        try {
          return r.fulfill({ body: readFileSync(join(RAIZ, url.pathname)), contentType: TIPOS[extname(url.pathname)] || "application/octet-stream" });
        } catch { return r.abort(); }
      });
      const page = await ctx.newPage();
      await page.goto("http://costaviva.local/", { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const ruta = join(RAIZ, rutaArranque(d));
      await page.screenshot({ path: ruta, type: "jpeg", quality: 72 });
      console.log(`${rutaArranque(d)}: ${(statSync(ruta).size / 1024).toFixed(0)} kB (${d.modelos})`);
      await ctx.close();
    }
  } finally {
    await navegador.close();
  }
}

async function main() {
  mkdirSync(join(RAIZ, "assets/inicio"), { recursive: true });
  for (const f of FOTOS) fotoOptimizada(f);
  await pantallasArranque();
  for (const p of PAGINAS_ARRANQUE) {
    const ruta = join(RAIZ, p);
    writeFileSync(ruta, conBloqueArranque(readFileSync(ruta, "utf8")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
