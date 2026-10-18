// scripts/marketing/reel-peces.mjs
// Reel "banco de peces + datos" (2026-10-18, pedido de Mikel). Sin IA y a
// coste 0: un clip de peces de clips/stock/ (por defecto pexels-peces-arrecife,
// licencia en su .licencia.json; --clip elige otro) va de fondo todo el vídeo, ralentizado, y
// encima aparecen datos REALES de un spot a la hora de publicación (marea del
// día, corriente, caudal del río, ola, agua e índice de pesca con la misma
// cuenta que la app). Cierra con el mensaje de la app y la llamada a la acción.
//
// Uso:  node reel-peces.mjs [--spot ribadesella] [--fecha AAAA-MM-DD] [--hora HH:MM] [--clip fichero.mp4]
// Deja assets/marketing/reels/<fecha>-peces-<spot>.mp4 y reel-pendiente.json
// (el mismo que lee publicar-borrador-instagram.mjs). Solo con datos reales:
// si falta un dato, falla en vez de inventarlo.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { BASE_URL, resumenDeSpot, leerEspecies, fechaLegible, nombreSpot } from "./obtener-datos.mjs";
import { abrirNavegador } from "./render.mjs";
import { instanteMadrid, campanaDePieza, MARCA_ENLACE } from "./calendario.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const PLANTILLA = pathToFileURL(join(__dirname, "plantillas", "reel-peces.html")).href;
const DURACION = 13; // segundos
const FPS = 30;
// Río de cada spot (copia de RIOS[].spotCosta de index.html para los que tienen caudal real).
const RIO_SPOT = { ribadesella: ["sella", "Sella"], suances: ["besaya", "Besaya"], santander: ["pas", "Pas"], santona: ["ason", "Asón"], ribadeo: ["eo", "Eo"], cullera: ["jucar", "Júcar"], valencia: ["turia", "Turia"], burriana: ["mijares", "Mijares"] };

// Argumentos --nombre valor; en el workflow llegan por variables de entorno.
const ENTORNO = { spot: "SPOT_REEL", fecha: "FECHA_PIEZA", clip: "CLIP_REEL" };
function arg(nombre, def) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i > 0) return process.argv[i + 1];
  return process.env[ENTORNO[nombre]] || def;
}
const num = (x, d = 1) => x.toFixed(d).replace(".", ",");

export function textoCaudal(c) {
  if (!c || typeof c.caudal !== "number") return null;
  const nivel = c.umbralAlto && c.caudal >= c.umbralAlto ? "crecido" : c.umbralBajo && c.caudal < c.umbralBajo ? "caudal bajo" : "caudal normal";
  return { val: `${num(c.caudal)} m³/s`, sub: nivel };
}

async function main() {
  const slug = arg("spot", "ribadesella");
  const ficheroClip = arg("clip", "pexels-peces-arrecife.mp4");
  const CLIP = join(__dirname, "clips", "stock", ficheroClip);
  const licencia = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, ".licencia.json"), "utf8"));
  const creditoVideo = `Vídeo: ${new URL(licencia.origen).hostname.replace(/^www\./, "")}`;
  const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const fecha = arg("fecha", manana);
  const hora = arg("hora", "08:00");
  const horaISO = `${fecha}T${hora.slice(0, 2)}:00`;
  const rio = RIO_SPOT[slug];
  if (!rio) throw new Error(`${slug} no tiene río con caudal real; elige uno de: ${Object.keys(RIO_SPOT).join(", ")}`);

  const prevision = await (await fetch(`${BASE_URL}/prevision`)).json();
  const spot = prevision.spots.find((s) => s.slug === slug);
  if (!spot) throw new Error(`No está ${slug} en /prevision`);
  const bloque = [...spot.bloques].sort((a, b) => Math.abs(new Date(a.horaISO) - new Date(horaISO)) - Math.abs(new Date(b.horaISO) - new Date(horaISO)))[0];
  const caudal = textoCaudal(prevision.caudales?.[rio[0]]);
  const { resumen, horas } = await resumenDeSpot(slug, leerEspecies(), horaISO);
  const dia = horas.filter((h) => h.hora.startsWith(fecha) && typeof h.nivelMar === "number");
  if (!resumen || dia.length < 20 || !caudal || bloque?.corriente == null) throw new Error("Faltan datos reales (índice, marea, caudal o corriente): no se monta el reel.");
  const iAhora = Math.max(0, dia.findIndex((h) => h.hora === horaISO));
  const sube = dia[Math.min(iAhora + 1, dia.length - 1)].nivelMar > dia[iAhora].nivelMar;
  // Próximo extremo desde la hora de publicación.
  let extremo = null;
  for (let i = Math.max(1, iAhora); i < dia.length - 1; i++) {
    const [a, b, c] = [dia[i - 1].nivelMar, dia[i].nivelMar, dia[i + 1].nivelMar];
    if ((b > a && b >= c) || (b < a && b <= c)) { extremo = { tipo: b > a ? "pleamar" : "bajamar", hora: dia[i].hora.slice(11, 16) }; break; }
  }

  const datos = {
    spot: nombreSpot(slug),
    fecha: fechaLegible(instanteMadrid(fecha, hora)),
    marea: { serie: dia.map((h) => h.nivelMar), indiceAhora: iAhora, texto: `${sube ? "Subiendo" : "Bajando"}${extremo ? ` · ${extremo.tipo} a las ${extremo.hora}` : ""}` },
    corriente: { val: `${num(bloque.corriente)} km/h`, sub: `hacia el ${bloque.dirCorriente} · ${num(bloque.corriente / 1.852)} nudos` },
    rio: { etq: `Río ${rio[1]}`, ...caudal },
    ola: { val: `${num(bloque.altura[0])}–${num(bloque.altura[1])} m`, sub: `periodo ${bloque.periodo} s · ${bloque.dirOla.split(" ")[0]}` },
    agua: { val: `${num(bloque.tempAgua)} °C`, sub: `viento ${bloque.viento} km/h ${bloque.dirViento}` },
    indice: { puntuacion: resumen.puntuacion, nivel: resumen.nivel, especie: resumen.especie, tramo: resumen.mejorTramo ? `Mejores horas: ${resumen.mejorTramo.texto}` : "" },
    credito: `${creditoVideo} · Datos: Open-Meteo (CC BY 4.0) · Confederación Hidrográfica`,
  };
  console.log(JSON.stringify({ ...datos, marea: { ...datos.marea, serie: `${dia.length} horas` } }, null, 1));

  const dir = mkdtempSync(join(tmpdir(), "reel-peces-"));
  const nombre = `peces-${slug}`;
  const rutaRelativa = `assets/marketing/reels/${fecha}-${nombre}.mp4`;
  const salida = join(RAIZ_REPO, rutaRelativa);
  mkdirSync(dirname(salida), { recursive: true });
  try {
    // Fondo: el clip ralentizado hasta cubrir todo el reel, un pelín más de contraste.
    const durClip = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", CLIP]).toString());
    const lento = (DURACION / durClip).toFixed(4);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", CLIP, "-vf", `setpts=${lento}*PTS,fps=${FPS},eq=contrast=1.08:saturation=1.15`, "-t", String(DURACION), "-q:v", "3", join(dir, "c%04d.jpg")]);
    const navegador = await abrirNavegador();
    try {
      const ctx = await navegador.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await ctx.route(/^https?:\/\//, (r) => r.abort());
      const page = await ctx.newPage();
      await page.goto(PLANTILLA);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((d) => window.preparar(d), datos);
      const total = DURACION * FPS;
      for (let n = 0; n < total; n++) {
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

  const caption = [
    "¿Sabes lo que te espera hoy en el agua? 🌊",
    "",
    "Mareas, corrientes, ríos, oleaje y cámaras en directo. En tiempo real, en una sola app.",
    "Desde costa, en barco o en pesca submarina: para que sepas lo que te vas a encontrar antes de ir, y qué especies buscar en ese momento.",
    "",
    `Datos del vídeo: ${datos.spot}, ${fecha.split("-").reverse().join("/")} a las ${hora}.`,
    "El índice es una orientación con reglas públicas, no una garantía.",
    `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`,
    "",
    `${creditoVideo} · Datos: Open-Meteo (CC BY 4.0)`,
    "",
    "#pesca #fishing #pescadesdecosta #pescaembarcado #pescasubmarina #spearfishing #costaviva #mareas",
  ].join("\n");
  const campana = campanaDePieza(fecha, `reel-${nombre}`);
  writeFileSync(join(__dirname, "reel-pendiente.json"), JSON.stringify({
    tipo: "reel-peces", esReel: true, caption, rutaRelativa, publicUrl: `${BASE_URL}/${rutaRelativa}`,
    fecha, hora, dia: new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" }).format(new Date(`${fecha}T12:00:00Z`)),
    campana, mercado: "es", idioma: "es", clip: { carpeta: "stock", fichero: ficheroClip, personaIdentificable: licencia.persona_identificable === false ? false : true },
  }, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=true\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel de peces:", e); process.exit(1); });
}
