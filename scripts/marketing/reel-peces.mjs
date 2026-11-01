// scripts/marketing/reel-peces.mjs
// Reel "banco de peces + datos" (2026-10-18, pedido de Mikel). Sin IA y a
// coste 0: un clip de peces de clips/stock/ (desde el 2026-11-01 solo pexels-jureles-azules-roca;
// el de arrecife está retirado,
// licencia en su .licencia.json; --clip elige otro) va de fondo todo el vídeo, ralentizado, y
// encima aparecen datos REALES de un spot a la hora de publicación (marea del
// día, corriente, caudal del río, ola, agua e índice de pesca con la misma
// cuenta que la app). Cierra con el mensaje de la app y la llamada a la acción.
//
// Uso:  node reel-peces.mjs [--spot ribadesella] [--fecha AAAA-MM-DD] [--hora HH:MM] [--clip fichero.mp4]
// Deja assets/marketing/reels/<fecha>-peces-<spot>.mp4 y reel-pendiente.json
// (el mismo que lee publicar-borrador-instagram.mjs). Solo con datos reales:
// si falta un dato, falla en vez de inventarlo.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync, appendFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { BASE_URL, resumenDeSpot, leerEspecies, fechaLegible, nombreSpot } from "./obtener-datos.mjs";
// render.mjs (Playwright) se importa solo al montar: los tests no lo tienen instalado.
import { mejorTramo } from "./pieza-datos.mjs";
import * as VA from "../../assets/js/ventana-actividad.js";
import { instanteMadrid, campanaDePieza, MARCA_ENLACE, piezaAPreparar, apuntarGenerada } from "./calendario.mjs";

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

// Especie del reel (Mikel, 2026-10-18: "no pongas lisa, sino lubina"). Su
// índice es el real de la ficha para esa especie (misma cuenta que la ventana
// de actividad), no el de la mejor especie; si no está de temporada o en
// veda en ese spot, el reel no se monta.
const ESPECIE = "lubina";
export function indiceDeEspecie(datos, horas, spot, horaISO, id) {
  const i = horas.findIndex((h) => h.hora.slice(0, 13) === horaISO.slice(0, 13));
  if (i < 0) return null;
  const region = VA.regionPorCoordenadas(spot.lat, spot.lon);
  const mes = Number(horaISO.slice(5, 7));
  const especie = VA.especiesDeTemporada(datos, region, mes, "costa").find((e) => e.id === id);
  if (!especie) throw new Error(`${id} no está de temporada (o está en veda) en ${spot.slug} en el mes ${mes}`);
  const ventana = VA.calcularVentana(especie, datos.reglas_por_defecto, horas, {
    lat: spot.lat, lon: spot.lon, modalidad: "costa", region, horaActual: horaISO,
    reglasModalidad: datos.reglas_por_modalidad, reglasExpertas: datos.reglas_expertas, b0: datos.indice?.b0_logodds ?? 0,
  });
  const puntuacion = Math.round(ventana[i].puntuacion);
  const barras = [];
  horas.forEach((h, j) => { if (h.hora.startsWith(horaISO.slice(0, 10))) barras.push(Math.round(ventana[j].puntuacion)); });
  return { puntuacion, nivel: globalThis.NivelIndice.nivelPesca(puntuacion), especie: especie.nombres.es, mejorTramo: mejorTramo(barras) };
}

export function textoCaudal(c) {
  if (!c || typeof c.caudal !== "number") return null;
  const nivel = c.umbralAlto && c.caudal >= c.umbralAlto ? "crecido" : c.umbralBajo && c.caudal < c.umbralBajo ? "caudal bajo" : "caudal normal";
  return { val: `${num(c.caudal)} m³/s`, sub: nivel };
}

async function datosDeSpot(slug, fecha, hora, prevision, especiesDatos) {
  const horaISO = `${fecha}T${hora.slice(0, 2)}:00`;
  const rio = RIO_SPOT[slug];
  if (!rio) throw new Error(`${slug} no tiene río con caudal real; elige uno de: ${Object.keys(RIO_SPOT).join(", ")}`);

  const spot = prevision.spots.find((s) => s.slug === slug);
  if (!spot) throw new Error(`No está ${slug} en /prevision`);
  const bloque = [...spot.bloques].sort((a, b) => Math.abs(new Date(a.horaISO) - new Date(horaISO)) - Math.abs(new Date(b.horaISO) - new Date(horaISO)))[0];
  const caudal = textoCaudal(prevision.caudales?.[rio[0]]);
  const { horas } = await resumenDeSpot(slug, especiesDatos, horaISO);
  const resumen = indiceDeEspecie(especiesDatos, horas, spot, horaISO, ESPECIE);
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

  return { spot, bloque, caudal, resumen, dia, iAhora, sube, extremo, rio };
}

// Vídeos de peces: los .mp4 de clips/stock cuya ficha lleva "tema": "peces".
export function clipsDePeces(dir = join(__dirname, "clips", "stock")) {
  return readdirSync(dir).filter((f) => f.endsWith(".mp4")).filter((f) => {
    try { return JSON.parse(readFileSync(join(dir, f.replace(/\.mp4$/, ".licencia.json")), "utf8")).tema === "peces"; } catch { return false; }
  }).sort();
}
// El siguiente de una lista tras `ultimo` (rotación).
export function siguienteDe(lista, ultimo) {
  const i = lista.indexOf(ultimo);
  return [...lista.slice(i + 1), ...lista.slice(0, i + 1)];
}

const RUTA_ESTADO = join(__dirname, "calendario-estado.json");
const RUTA_ROTACION = join(__dirname, "rotacion-reels-peces.json");
const leerJson = (ruta) => { try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return {}; } };

async function main() {
  // Calendario (2026-10-18, Mikel: "a partir de ahora prepararemos vídeos de
  // este tipo"): es el reel de los sábados de España. Se prepara la víspera
  // y no se repite (calendario-estado.json); con --fecha (o FECHA_PIEZA) o
  // TIPO_REEL=peces se fuerza cualquier día.
  const estado = leerJson(RUTA_ESTADO);
  const objetivo = piezaAPreparar({ formato: "reel", fechaForzada: arg("fecha", ""), tipoForzado: process.env.TIPO_REEL || (arg("fecha", "") ? "peces" : ""), estado, mercado: "es" });
  if (!objetivo) {
    console.log("Mañana no toca reel (o ya está preparado). Nada que hacer.");
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n");
    return;
  }
  const { fecha } = objetivo;
  const hora = arg("hora", objetivo.hora);
  const rotacion = leerJson(RUTA_ROTACION);
  const clips = clipsDePeces();
  if (!clips.length) throw new Error("No hay vídeos de peces en clips/stock (ficha con \"tema\": \"peces\").");
  const ficheroClip = arg("clip", "") || siguienteDe(clips, rotacion.ultimoClip)[0];
  const CLIP = join(__dirname, "clips", "stock", ficheroClip);
  const licencia = JSON.parse(readFileSync(CLIP.replace(/\.mp4$/, ".licencia.json"), "utf8"));
  const creditoVideo = `Vídeo: ${new URL(licencia.origen).hostname.replace(/^www\./, "")}`;

  // Spot: el forzado o el siguiente de la rotación en el que haya todos los
  // datos y la lubina esté de temporada.
  const prevision = await (await fetch(`${BASE_URL}/prevision`)).json();
  const especiesDatos = leerEspecies();
  const forzado = arg("spot", "");
  const candidatos = forzado ? [forzado] : siguienteDe(Object.keys(RIO_SPOT), rotacion.ultimoSpot);
  let slug = null, d = null;
  for (const s of candidatos) {
    try { d = await datosDeSpot(s, fecha, hora, prevision, especiesDatos); slug = s; break; } catch (e) { console.warn(`${s}: ${e.message}`); }
  }
  if (!slug) throw new Error("Ningún spot con río tiene hoy todos los datos reales: no se monta el reel.");
  const { spot, bloque, caudal, resumen, dia, iAhora, sube, extremo, rio } = d;
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
    const { abrirNavegador } = await import("./render.mjs");
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
    "Mareas, corrientes, ríos, oleaje, clorofila, cámaras en directo y muchos más datos. En tiempo real, en una sola app.",
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
  writeFileSync(RUTA_ROTACION, JSON.stringify({ ultimoSpot: slug, ultimoClip: ficheroClip, fecha: new Date().toISOString() }, null, 2) + "\n");
  writeFileSync(RUTA_ESTADO, JSON.stringify(apuntarGenerada(estado, objetivo.clave, { tipo: "reel-peces", campana }), null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=true\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel de peces:", e); process.exit(1); });
}
