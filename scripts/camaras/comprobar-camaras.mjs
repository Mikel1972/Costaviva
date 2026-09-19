// scripts/camaras/comprobar-camaras.mjs
// Corrido cada 30 min por .github/workflows/camaras-salud.yml. Pedido
// explícito del usuario (2026-09-18): un punto rojo automático cuando una
// webcam no está devolviendo imagen real. Decisión explícita suya, ya
// documentada en supabase/migrations/20260918120000_camara_estado.sql: NO
// se intenta distinguir "de noche, oscuro de verdad" de "cámara caída" —
// si el frame no tiene variación real de brillo (plano de verdad, típico
// de un frame de error del proveedor, un "sin señal", o un objetivo
// tapado/roto), cuenta como sin señal sea cual sea la causa.
//
// Tres comprobaciones independientes, todas cuentan como "sin señal":
// 1. Frame PLANO — sin variación de brillo real (ver UMBRAL_DESVIACION).
// 2. Frame CONGELADO — con contenido real, pero IDÉNTICO al de la
//    comprobación anterior durante más de UMBRAL_CONGELADA_MS seguidas.
//    Añadido el mismo día tras encontrar el caso real en preview: Mundaka
//    y Sopelana no estaban planas (tienen luces/olas/nubes de sobra) pero
//    sí llevaban ~13h congeladas — la de Mundaka con su propia fecha
//    grabada en la imagen ("2026-09-17 20:50"), la de Sopelana un
//    atardecer de la noche anterior — y la cabecera Last-Modified del
//    proveedor no servía para detectarlo (decía "hace 24 min" en la de
//    Mundaka, sin relación con cuándo cambió el contenido de verdad). Por
//    eso esto compara el CONTENIDO decodificado (hash), nunca cabeceras
//    HTTP del proveedor. 3h de margen es tiempo de sobra para que
//    cualquier cámara de mar en directo muestre algo distinto por las
//    olas/la luz, incluso de noche.
// 3. Fallo de descarga/decodificación (http_xxx, sin_respuesta,
//    sin_pixeles) o frame plano, pero solo si se repite en la
//    comprobación INMEDIATAMENTE SIGUIENTE (ver UMBRAL_FALLOS_SEGUIDOS).
//    Bug real reportado por el usuario el mismo día: castrourdiales salió
//    "sin señal" por un único 502 pasajero del servidor de Cantabria (las
//    6 cámaras de ese proveedor fallaron juntas esa vez) — comprobó la
//    cámara a mano y la imagen real tenía solo 15 min. Con
//    comprobaciones cada 30 min, exigir 2 fallos seguidos significa que
//    el problema tiene que durar más de media hora para llegar a
//    mostrarse — un simple bache de red ya no pinta un punto rojo.
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
import { createHash } from "node:crypto";
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

// Umbrales de diseño, no calibrados en laboratorio (mismo criterio que
// otros umbrales del repo, ej. indiceMar()) — revisar si dan falsos
// positivos/negativos en real.
const UMBRAL_DESVIACION = 3; // desviación típica de brillo (0-255) mínima para no ser "plano"
const UMBRAL_CONGELADA_MS = 3 * 60 * 60 * 1000; // 3h con el mismo frame -> "congelado"
const UMBRAL_FALLOS_SEGUIDOS = 2; // fallos/frame plano seguidos antes de mostrarlo (evita baches de red de una sola pasada)

// Mismas URLs que WEBCAMS_HLS en index.html — mantener sincronizado a
// mano, igual que ya hace SPOTS_VIDEO en scripts/turbidez/medir-turbidez.mjs.
const WEBCAMS_VIDEO = {
  // Sopela (ayuntamiento, IPCamLive) — ver el comentario igual en
  // index.html (WEBCAMS_HLS). Mismo motivo para excluirla del bucle de
  // imagen fija más abajo (skipPorVideo): lo que se comprueba tiene que
  // ser lo que de verdad se pinta en pantalla, no la imagen de reserva
  // que ya no se muestra mientras esta entrada de vídeo exista.
  sopelana: "https://s61.ipcamlive.com/streams/3d0d8zpvutondjmwg/stream.m3u8",
  hondarribia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_hondarribia_169.stream/playlist.m3u8",
  donostia: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zurriola_169.stream/playlist.m3u8",
  orio: "https://58f14c0895a20.streamlock.net/camaramar/GIP_orio_169.stream/playlist.m3u8",
  zarautz: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zarautz_169.stream/playlist.m3u8",
  deba: "https://58f14c0895a20.streamlock.net/camaramar/GIP_deba_169.stream/playlist.m3u8",
  mutriku: "https://58f14c0895a20.streamlock.net/camaramar/GIP_mutrikukaia_169.stream/playlist.m3u8",
};

// Decodifica el buffer (JPEG/WebP/PNG, o un frame ya extraído del vídeo) a
// una versión pequeña en escala de grises — de ahí saca la desviación
// típica de brillo (detecta "plano") y un hash del contenido (detecta
// "congelado"). Reducir a 80px de ancho, además de más rápido, hace el
// hash tolerante al ruido de recompresión que un mismo proveedor a veces
// introduce entre una petición y otra sin que la imagen real haya
// cambiado.
async function analizarBuffer(buffer) {
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
  const desviacion = Math.sqrt(sumaCuadrados / n);
  const hash = createHash("sha256").update(data).digest("hex");
  return { desviacion, hash };
}

async function comprobarImagen(slug) {
  const resp = await fetch(`${BASE_URL}/webcam/${slug}`, { headers: { "User-Agent": "CostaVivaCamarasBot/1.0" } });
  if (!resp.ok) return { ok: false, motivo: `http_${resp.status}` };
  // Índice de la fuente que sirvió de verdad (ver functions/webcam/[slug].js)
  // — >0 significa que la principal falló y el proxy recurrió sola a una de
  // reserva sin que el usuario lo note; aquí sí interesa saberlo para
  // reportarlo, aunque la app siga funcionando con normalidad.
  const fuenteUsada = Number(resp.headers.get("x-webcam-fuente-indice") ?? 0) || 0;
  const buffer = Buffer.from(await resp.arrayBuffer());
  const r = await analizarBuffer(buffer);
  if (!r) return { ok: false, motivo: "sin_pixeles", fuenteUsada };
  return { ok: true, ...r, fuenteUsada };
}

async function comprobarVideo(url) {
  const dir = mkdtempSync(join(tmpdir(), "camaras-"));
  const salida = join(dir, "frame.jpg");
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", url, "-frames:v", "1", "-q:v", "2", salida],
      { timeout: 30000 }
    );
    const buffer = readFileSync(salida);
    const r = await analizarBuffer(buffer);
    if (!r) return { ok: false, motivo: "sin_pixeles" };
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, motivo: "sin_respuesta" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A partir del resultado bruto de esta pasada y el estado guardado la
// pasada anterior, decide sinSenal/motivo/hashFrame/hashDesde/fallosSeguidos.
// Vive aparte de comprobarImagen/comprobarVideo porque necesita el estado
// previo (que esas funciones no conocen) para poder comparar el hash y
// contar fallos consecutivos.
function decidirEstado(bruto, previo, ahoraISO) {
  if (!bruto.ok) {
    // No se pudo ni descargar/decodificar — se conserva el hash previo tal
    // cual (no se puede comparar nada esta vez), nunca se inventa uno.
    const fallosSeguidos = (previo?.fallosSeguidos ?? 0) + 1;
    return {
      sinSenal: fallosSeguidos >= UMBRAL_FALLOS_SEGUIDOS,
      motivo: bruto.motivo,
      fallosSeguidos,
      hashFrame: previo?.hashFrame ?? null,
      hashDesde: previo?.hashDesde ?? null,
    };
  }
  const mismoHash = !!previo?.hashFrame && previo.hashFrame === bruto.hash;
  const hashDesde = mismoHash ? (previo.hashDesde ?? ahoraISO) : ahoraISO;

  if (bruto.desviacion < UMBRAL_DESVIACION) {
    const fallosSeguidos = (previo?.fallosSeguidos ?? 0) + 1;
    return { sinSenal: fallosSeguidos >= UMBRAL_FALLOS_SEGUIDOS, motivo: "frame_plano", fallosSeguidos, hashFrame: bruto.hash, hashDesde };
  }
  // Lectura buena de verdad -> se resetea el contador de fallos seguidos,
  // aunque acabe marcándose congelada por el motivo independiente del hash.
  const congelada = mismoHash && Date.now() - new Date(hashDesde).getTime() > UMBRAL_CONGELADA_MS;
  return { sinSenal: congelada, motivo: congelada ? "frame_congelado" : "ok", fallosSeguidos: 0, hashFrame: bruto.hash, hashDesde };
}

// Lee el estado guardado la pasada anterior de cada cámara — hace falta
// para decidir "ultima_senal_en" (ver el comentario largo en
// functions/registrar-estado-camaras.js), si el hash de esta pasada es el
// mismo que el de la anterior (frame congelado), y cuántos fallos seguidos
// lleva (debounce de fallos/frame plano).
async function estadoPrevioPorSlug() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/camara_estado?select=spot_slug,ultima_senal_en,hash_frame,hash_desde,fallos_seguidos`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!resp.ok) return {};
  const filas = await resp.json();
  return Object.fromEntries(
    filas.map((f) => [
      f.spot_slug,
      { ultimaSenalEn: f.ultima_senal_en, hashFrame: f.hash_frame, hashDesde: f.hash_desde, fallosSeguidos: f.fallos_seguidos ?? 0 },
    ])
  );
}

function construirLectura(slug, bruto, previo, ahora) {
  const estado = decidirEstado(bruto, previo, ahora);
  // "ultima_senal_en" se basa en si ESTA lectura fue buena de verdad (no en
  // si el debounce ya lo enseña como sin señal) — así "sin señal desde hace
  // X" cuenta desde el último frame realmente bueno, no desde que empezó a
  // mostrarse en pantalla.
  const lecturaBuena = bruto.ok && bruto.desviacion >= UMBRAL_DESVIACION;
  return {
    spot: slug,
    sinSenal: estado.sinSenal,
    motivo: estado.motivo,
    ultimaSenalEn: lecturaBuena ? ahora : (previo?.ultimaSenalEn ?? null),
    fallosSeguidos: estado.fallosSeguidos,
    hashFrame: estado.hashFrame,
    hashDesde: estado.hashDesde,
    // 0 = sirvió la fuente principal; >0 = el proxy tuvo que recurrir a una
    // de reserva (ver functions/webcam/[slug].js) — la app sigue mostrando
    // imagen real, pero interesa saber que la principal está fallando.
    fuenteUsada: bruto.fuenteUsada ?? 0,
  };
}

async function main() {
  const previo = await estadoPrevioPorSlug().catch((e) => {
    console.log("No se pudo leer el estado previo, se asumirá vacío:", e.message);
    return {};
  });
  const ahora = new Date().toISOString();
  const lecturas = [];

  // Spots que ya se comprueban como vídeo (WEBCAMS_VIDEO, más abajo) se
  // saltan aquí aunque también tengan una entrada de imagen fija de
  // reserva en WEBCAMS (functions/webcam/[slug].js) -- lo que hay que
  // vigilar es lo que de verdad se pinta en pantalla (ver index.html,
  // pintarWebcam(): WEBCAMS_HLS gana siempre a la imagen fija).
  for (const slug of Object.keys(WEBCAMS)) {
    if (WEBCAMS_VIDEO[slug]) continue;
    let bruto;
    try {
      bruto = await comprobarImagen(slug);
    } catch (e) {
      bruto = { ok: false, motivo: "error_descarga" };
    }
    const lectura = construirLectura(slug, bruto, previo[slug], ahora);
    lecturas.push(lectura);
    const avisoReserva = lectura.fuenteUsada > 0 ? ` [usando fuente de reserva #${lectura.fuenteUsada}]` : "";
    console.log(`${lectura.sinSenal ? "✗" : "✓"} ${slug}: ${lectura.motivo}${avisoReserva}`);
  }
  for (const [slug, url] of Object.entries(WEBCAMS_VIDEO)) {
    const bruto = await comprobarVideo(url);
    const lectura = construirLectura(slug, bruto, previo[slug], ahora);
    lecturas.push(lectura);
    console.log(`${lectura.sinSenal ? "✗" : "✓"} ${slug} (vídeo): ${lectura.motivo}`);
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
