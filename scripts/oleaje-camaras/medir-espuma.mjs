// scripts/oleaje-camaras/medir-espuma.mjs
// Mide la espuma de TODAS las cámaras que sirven (scripts/oleaje-camaras/
// camaras.mjs), la convierte en metros de ola en el spot con la calibración
// (calibracion.mjs) y la guarda (2026-10-08, "Si hay cámara, utiliza
// nuestro cálculo"). Lo corre .github/workflows/espuma-camaras.yml cada 30
// min con luz. SIN IA y sin API de pago: streams y fotos públicas, Open-Meteo
// (con OPEN_METEO_API_KEY si existe) y las boyas de Copernicus Marine In Situ
// (boyas-copernicus.py, fichero --boyas).
//
// Qué deja:
//   1. datos-robots/oleaje-camaras/espuma.jsonl: una línea por cámara y
//      encuadre medido (histórico completo: de aquí sale la calibración).
//   2. datos-robots/oleaje-camaras/calibracion.json: la calibración usada.
//   3. Con SUPABASE_SERVICE_ROLE_KEY: una fila por lectura en
//      public.oleaje_camara_lecturas (la lee /prevision) y la miniatura del
//      fotograma medido en el bucket "oleaje-camaras" (la usa
//      etiquetar-olas.html). Si la migración aún no está aplicada, avisa y
//      sigue (nada de eso es imprescindible para el histórico).
//
// Calibración SIN la lectura actual (se calibra con el histórico anterior
// y las etiquetas): así una lectura nunca se "explica" a sí misma.
//
// Nunca inventa un dato: una cámara que no responde, sin el encuadre de
// referencia, con la orilla dentro o sin calibrar no da altura.
//
// Uso: node scripts/oleaje-camaras/medir-espuma.mjs [--boyas boyas.json]
//        [--salida fichero.jsonl] [--seco] [--forzar-luz] [--miniaturas dir]
//   --miniaturas: guarda también en local las miniaturas (para revisar ROIs)

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { medirEspuma, medirEspumaDinamica, huella, similitud, SIMILITUD_MINIMA } from "./espuma.mjs";
import { CAMARAS } from "./camaras.mjs";
import {
  calibrarTodo, estimarAltura, claveCalibracion, emparejarEtiquetaSpot, elevacionSolar, ELEVACION_MINIMA, ERROR_MINIMO_POCOS_DATOS,
} from "./calibracion.mjs";
import { CAMARAS_OLEAJE, BANDAS_OLA, FUENTE_POR_SPOT } from "../../functions/_lib/oleaje-camaras.js";
import { SPOTS, factorOleaje } from "../../functions/prevision.js";
import { pedirDatosMeteo, fuenteDeVariable } from "../../functions/_lib/fuentes.js";
import { coeficienteAbrigo } from "../../functions/_lib/oleaje-costero.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const arg = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : null);
const SECO = args.includes("--seco");
const FORZAR_LUZ = args.includes("--forzar-luz");
const DIR_DATOS = join(RAIZ, "datos-robots", "oleaje-camaras");
const SALIDA = arg("--salida") || join(DIR_DATOS, "espuma.jsonl");
const FICHERO_BOYAS = arg("--boyas");
const DIR_MINIATURAS = arg("--miniaturas");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const CLAVE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BUCKET = "oleaje-camaras";
const DIAS_MINIATURAS = 30; // miniaturas sin etiquetar más viejas se borran

const ANCHO = 320, ALTO = 180; // todo se reduce a 320x180 (la métrica es una fracción)
// Segmentos HLS por cámara buscando sus encuadres: 6 × 15 s ≈ 1,5 min de
// espera como mucho (las 13 cámaras van en paralelo). Es lo que cabe en
// ~3 min por ejecución (cuenta de minutos de Actions en el workflow).
const INTENTOS = 6;
const INTERVALO_MS = 15000;
const MIN_FRAMES_ENCUADRE = 2;
const MARGEN_SIMILITUD = 0.05; // el mejor encuadre debe ganar al segundo por esto
const SIMILITUD_IMAGEN_FIJA = 0.6; // fijas: solo detecta que el proveedor movió la cámara
const EDAD_MAX_IMAGEN_MIN = 90; // una foto fija más vieja no vale
const UA = { "User-Agent": "CostavivaOlaBot/1.0 (+https://costaviva.org)" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function mediana(v) {
  const o = v.filter(Number.isFinite).sort((a, b) => a - b);
  if (!o.length) return null;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

async function pedir(url, ms = 20000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url.slice(0, 90)})`);
  return r;
}

async function ultimoSegmento(url) {
  const lineas = (t) => t.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  let urlLista = url;
  let lista = await (await pedir(url)).text();
  const primera = lineas(lista)[0];
  if (primera && primera.includes(".m3u8")) {
    urlLista = new URL(primera, url).href;
    lista = await (await pedir(urlLista)).text();
  }
  const seg = lineas(lista).pop();
  if (!seg) throw new Error("playlist sin segmentos");
  return Buffer.from(await (await pedir(new URL(seg, urlLista).href, 30000)).arrayBuffer());
}

function framesDeFichero(fichero, filtros = "", maxFrames = 1) {
  const crudo = execFileSync(
    FFMPEG,
    ["-loglevel", "error", "-i", fichero, "-vf", `${filtros}scale=${ANCHO}:${ALTO}`, "-frames:v", String(maxFrames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { timeout: 60000, maxBuffer: 64 * 1024 * 1024 }
  );
  const tam = ANCHO * ALTO * 3;
  const frames = [];
  for (let o = 0; o + tam <= crudo.length; o += tam) frames.push(Buffer.from(crudo.subarray(o, o + tam)));
  return frames;
}

function jpegDeFrame(rgb) {
  return execFileSync(
    FFMPEG,
    ["-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${ANCHO}x${ALTO}`, "-i", "-", "-q:v", "6", "-f", "mjpeg", "-"],
    { input: rgb, timeout: 20000, maxBuffer: 8 * 1024 * 1024 }
  );
}

const huellasRef = new Map();
function huellaReferencia(ref) {
  if (!huellasRef.has(ref)) {
    const [rgb] = framesDeFichero(join(RAIZ, "scripts", "oleaje-camaras", "referencias", `${ref}.jpg`));
    huellasRef.set(ref, rgb ? huella(rgb, ANCHO, ALTO) : null);
  }
  return huellasRef.get(ref);
}

// Encuadre al que pertenece un fotograma: el de mayor similitud, si pasa el
// umbral y gana al segundo por MARGEN_SIMILITUD.
function encuadreDeFrame(rgb, cam, umbral) {
  if (!cam.encuadres.length) return { encuadre: null, similitud: -1 };
  const h = huella(rgb, ANCHO, ALTO);
  const sims = cam.encuadres
    .map((e) => ({ e, s: similitud(huellaReferencia(e.ref), h) ?? -1 }))
    .sort((a, b) => b.s - a.s);
  const [mejor, segundo] = sims;
  const ok = mejor.s >= umbral && (!segundo || mejor.s - segundo.s >= MARGEN_SIMILITUD);
  return { encuadre: ok ? mejor.e : null, similitud: +mejor.s.toFixed(3) };
}

function resumir(porEncuadre, extra = {}) {
  return Object.entries(porEncuadre).map(([id, d]) => {
    const ok = d.medidas.filter((m) => m.estado === "ok");
    const usar = ok.length ? ok : d.medidas;
    const estado = ok.length
      ? "ok"
      : ["orilla", "sin_luz", "otro_encuadre", "dudosa"].find((e) => d.medidas.some((m) => m.estado === e)) || "dudosa";
    // Fotograma para la miniatura: el de espuma mediana entre los usados.
    const orden = usar.map((m) => ({ m, i: d.medidas.indexOf(m) })).sort((a, b) => (a.m.espuma ?? 0) - (b.m.espuma ?? 0));
    const elegido = orden[Math.floor(orden.length / 2)];
    return {
      encuadre: id,
      espuma: mediana(usar.map((m) => m.espuma)),
      espumaMax: Math.max(...usar.map((m) => m.espuma ?? 0)),
      frames: d.medidas.length,
      arena: mediana(usar.map((m) => m.arena)),
      brilloMedio: mediana(usar.map((m) => m.brilloMedio)),
      similitud: d.similitud,
      estado,
      frameMiniatura: elegido ? d.frames[elegido.i] : null,
      ...extra,
    };
  });
}

async function medirHls(id, cam) {
  const dir = mkdtempSync(join(tmpdir(), `ola-${id}-`));
  const porEncuadre = {};
  const dinamicas = { medidas: [], frames: [], similitud: null };
  let mejorSim = -1;
  let ultimoError = null;
  try {
    for (let intento = 1; intento <= INTENTOS; intento++) {
      let frames = [];
      try {
        const ts = join(dir, `s${intento}.ts`);
        writeFileSync(ts, await ultimoSegmento(cam.url));
        frames = framesDeFichero(ts, "fps=0.5,", 5);
      } catch (e) {
        // Wowza da a veces 404 en la chunklist de sesión recién creada: se
        // reintenta en la vuelta siguiente.
        ultimoError = e;
      }
      for (const f of frames) {
        const { encuadre, similitud: s } = encuadreDeFrame(f, cam, SIMILITUD_MINIMA);
        mejorSim = Math.max(mejorSim, s);
        if (encuadre) {
          const d = (porEncuadre[encuadre.id] ||= { medidas: [], frames: [], similitud: s });
          d.medidas.push(medirEspuma(f, ANCHO, ALTO, encuadre.roi));
          d.frames.push(f);
          d.similitud = Math.max(d.similitud, s);
        } else if (cam.dinamico) {
          const m = medirEspumaDinamica(f, ANCHO, ALTO);
          if (m.estado !== "otro_encuadre") {
            dinamicas.medidas.push(m);
            dinamicas.frames.push(f);
          }
        }
      }
      const completos = cam.encuadres.length > 0 && cam.encuadres.every((e) => (porEncuadre[e.id]?.medidas.length || 0) >= MIN_FRAMES_ENCUADRE);
      if (completos) break;
      if (intento < INTENTOS) await espera(INTERVALO_MS);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const res = resumir(porEncuadre);
  if (cam.dinamico && dinamicas.medidas.length >= MIN_FRAMES_ENCUADRE) res.push(...resumir({ dinamico: dinamicas }));
  if (!res.length) {
    if (mejorSim < 0 && ultimoError) throw ultimoError;
    return [{ encuadre: null, espuma: null, estado: "otro_encuadre", similitud: +mejorSim.toFixed(3), frames: 0 }];
  }
  return res;
}

async function urlImagen(cam) {
  if (cam.tipo !== "ipcamlive") return cam.url;
  // Mismo método que functions/webcam/hls/[slug].js (el alias es lo estable).
  const html = await (await pedir(`https://ipcamlive.com/player/player.php?alias=${encodeURIComponent(cam.alias)}`)).text();
  const address = /\baddress\s*=\s*['"](https?:\/\/[a-z0-9.-]+\.ipcamlive\.com\/?)['"]/i.exec(html)?.[1];
  const streamid = /\bstreamid\s*=\s*['"]([a-z0-9]+)['"]/i.exec(html)?.[1];
  if (!address || !streamid) throw new Error("IPCamLive: alias sin stream");
  return `${address.replace(/^http:/i, "https:").replace(/\/?$/, "/")}streams/${streamid}/snapshot.jpg`;
}

async function medirImagen(id, cam) {
  const r = await pedir(await urlImagen(cam), 30000);
  const lm = Date.parse(r.headers.get("last-modified") || "");
  const fechaFoto = Number.isFinite(lm) ? new Date(lm).toISOString() : null;
  if (Number.isFinite(lm) && Date.now() - lm > EDAD_MAX_IMAGEN_MIN * 60e3) {
    return [{ encuadre: cam.encuadres[0].id, espuma: null, estado: "imagen_vieja", fechaFoto, frames: 0 }];
  }
  const dir = mkdtempSync(join(tmpdir(), `ola-${id}-`));
  try {
    const f = join(dir, "foto");
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    const [rgb] = framesDeFichero(f);
    if (!rgb) throw new Error("no se pudo decodificar la foto");
    if (!cam.encuadres.length && cam.dinamico) {
      const m = medirEspumaDinamica(rgb, ANCHO, ALTO);
      return resumir({ dinamico: { medidas: [m], frames: [rgb], similitud: null } }, { fechaFoto });
    }
    const { encuadre, similitud: s } = encuadreDeFrame(rgb, cam, SIMILITUD_IMAGEN_FIJA);
    if (!encuadre) return [{ encuadre: cam.encuadres[0].id, espuma: null, estado: "otro_encuadre", similitud: s, fechaFoto, frames: 1 }];
    return resumir({ [encuadre.id]: { medidas: [medirEspuma(rgb, ANCHO, ALTO, encuadre.roi)], frames: [rgb], similitud: s } }, { fechaFoto });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Mar abierto del modelo en la hora actual en los spots de las cámaras.
async function marAbiertoPorCamara() {
  const ids = Object.keys(CAMARAS);
  const spots = ids.map((id) => SPOTS.find((s) => s.slug === CAMARAS_OLEAJE[id].spot));
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
  ids.forEach((id, i) => {
    const s = spots[i];
    const h = lista[i]?.hourly;
    const idx = h?.time?.findIndex((t) => t.startsWith(horaUTC)) ?? -1;
    if (!h || idx < 0) return;
    const hs = h.wave_height?.[idx] ?? null;
    const dir = h.wave_direction?.[idx] ?? null;
    const hsCorregida = hs === null ? null : +(hs * factorOleaje(s.lat, s.lon, fuente)).toFixed(2);
    // Coeficiente PREVIO del sitio que ve la cámara: 1 si la zona medida es
    // expuesta (Berria aunque el spot sea la bahía de Santoña); si no, el
    // de oleaje-costero.js (1 si el spot no está en la tabla).
    const coefPrior = CAMARAS_OLEAJE[id].expuesta ? 1 : coeficienteAbrigo(s.slug, dir);
    res[id] = {
      fuente,
      celda: [lista[i].latitude ?? null, lista[i].longitude ?? null],
      hs, hsCorregida, dir,
      periodo: h.wave_period?.[idx] ?? null,
      hsFondo: h.swell_wave_height?.[idx] ?? null,
      dirFondo: h.swell_wave_direction?.[idx] ?? null,
      nivelMar: h.sea_level_height_msl?.[idx] ?? null,
      coefPrior,
      modeloCamara: hsCorregida === null ? null : +(hsCorregida * coefPrior).toFixed(2),
    };
  });
  return res;
}

function boyaDeCamara(cam, boyas) {
  for (const id of cam.boyas || []) {
    const b = boyas?.[id];
    if (b?.ultima && Number.isFinite(b.ultima.hs)) return { id, nombre: b.nombre, ...b.ultima };
  }
  return null;
}

function leerHistorial() {
  if (!existsSync(SALIDA)) return [];
  return readFileSync(SALIDA, "utf8").split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

async function supabase(ruta, opciones = {}) {
  const r = await fetch(`${SUPABASE_URL}${ruta}`, {
    ...opciones,
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, ...(opciones.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status} ${ruta.slice(0, 60)}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

// Etiquetas (fotos de Mikel y "ola real que veo"), ya listas para calibrar.
async function leerEtiquetas(historial) {
  if (!CLAVE) return [];
  const r = await supabase(
    "/rest/v1/oleaje_etiquetas?select=origen,banda,spot_slug,observado_en,lectura:oleaje_camara_lecturas(camara,encuadre,espuma,fecha)&limit=10000"
  );
  const filas = await r.json();
  const out = [];
  for (const f of filas) {
    if (f.origen === "foto" && f.lectura) {
      out.push({ origen: "foto", banda: f.banda, camara: f.lectura.camara, encuadre: f.lectura.encuadre, espuma: Number(f.lectura.espuma), fecha: f.lectura.fecha });
    } else if (f.origen === "spot") {
      const fuente = FUENTE_POR_SPOT[f.spot_slug];
      const e = fuente?.propia ? emparejarEtiquetaSpot(f, historial, fuente.camara) : null;
      if (e) out.push(e);
    }
  }
  return out;
}

const centroBanda = (id) => BANDAS_OLA.find((b) => b.id === id)?.centro ?? null;

// Estimación por cámara combinando sus encuadres: media geométrica
// ponderada por 1/error² (el encuadre mejor calibrado manda).
export function combinar(lecturas) {
  const v = lecturas.filter((l) => l.estado === "ok" && Number.isFinite(l.estimacion));
  if (!v.length) return null;
  let sw = 0, sl = 0, se = 0;
  for (const l of v) {
    const e = Math.max(0.05, l.errorRel ?? ERROR_MINIMO_POCOS_DATOS);
    const w = 1 / (e * e);
    sw += w; sl += w * Math.log(Math.max(0.05, l.estimacion)); se += w * e;
  }
  const h = Math.exp(sl / sw), e = se / sw;
  return { estimacion: +h.toFixed(2), rangoMin: +(h / (1 + e)).toFixed(2), rangoMax: +(h * (1 + e)).toFixed(2), errorRel: +e.toFixed(3) };
}

async function subirMiniatura(ruta, jpeg) {
  await supabase(`/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: { "content-type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000" },
    body: jpeg,
  });
}

// Borra miniaturas de más de DIAS_MINIATURAS días que nadie ha etiquetado
// (las etiquetadas se quedan: son la verdad de terreno).
async function limpiarMiniaturas() {
  const limite = new Date(Date.now() - DIAS_MINIATURAS * 864e5).toISOString();
  const r = await supabase(
    `/rest/v1/oleaje_camara_lecturas?select=id,miniatura&miniatura=not.is.null&fecha=lt.${encodeURIComponent(limite)}&limit=500`
  );
  const viejas = await r.json();
  if (!viejas.length) return 0;
  const er = await supabase(`/rest/v1/oleaje_etiquetas?select=lectura_id&lectura_id=in.(${viejas.map((v) => Number(v.id)).join(",")})`);
  const etiquetadas = new Set((await er.json()).map((e) => e.lectura_id));
  const borrar = viejas.filter((v) => !etiquetadas.has(v.id));
  if (!borrar.length) return 0;
  await supabase(`/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefixes: borrar.map((v) => v.miniatura) }),
  });
  await supabase(`/rest/v1/oleaje_camara_lecturas?id=in.(${borrar.map((v) => Number(v.id)).join(",")})`, {
    method: "PATCH",
    headers: { "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ miniatura: null }),
  });
  return borrar.length;
}

async function main() {
  const ahora = Date.now();
  const sol = elevacionSolar(ahora, 43.35, -2.5);
  if (sol < ELEVACION_MINIMA && !FORZAR_LUZ) {
    console.log(`Sol a ${sol}° (< ${ELEVACION_MINIMA}°): sin luz para medir. Nada que hacer.`);
    return;
  }
  const boyas = FICHERO_BOYAS && existsSync(FICHERO_BOYAS) ? JSON.parse(readFileSync(FICHERO_BOYAS, "utf8")) : null;
  if (!boyas) console.log("::warning::Sin fichero de boyas: la calibración usará el modelo (con menos peso).");
  const historial = leerHistorial();
  const etiquetas = await leerEtiquetas(historial).catch((e) => (console.log("::warning::Etiquetas no disponibles:", e.message), []));
  const calibracion = calibrarTodo(historial, etiquetas, centroBanda);

  const ids = Object.keys(CAMARAS);
  const [mar, resultados] = await Promise.all([
    marAbiertoPorCamara().catch((e) => (console.log("Mar abierto no disponible:", e.message), {})),
    Promise.all(ids.map((id) => {
      const cam = CAMARAS[id];
      const medir = cam.tipo === "hls" ? medirHls : medirImagen;
      return medir(id, cam).then((m) => ({ id, m }), (e) => ({ id, e }));
    })),
  ]);

  const fecha = new Date(ahora).toISOString();
  const lineas = [];
  const filas = [];
  for (const { id, m, e } of resultados) {
    if (e) {
      console.log(`✗ ${id}: ${e.message}`);
      continue;
    }
    const cam = CAMARAS[id];
    // Foto fija que no ha cambiado desde la medida anterior (el proveedor la
    // refresca cada 10-30 min): no aporta nada y, si se guardara otra vez,
    // la calibración contaría dos veces la misma imagen.
    const fechaFoto = m.find((r) => r.fechaFoto)?.fechaFoto;
    if (cam.tipo !== "hls" && fechaFoto && historial.some((h) => (h.camara || h.spot) === id && h.fecha === fechaFoto)) {
      console.log(`= ${id}: la foto (${fechaFoto}) es la misma que en la medida anterior`);
      continue;
    }
    const boya = boyaDeCamara(cam, boyas);
    const porEncuadre = m.map((r) => {
      const cal = r.encuadre ? calibracion[claveCalibracion(id, r.encuadre)] : null;
      const est = r.estado === "ok" ? estimarAltura(r.espuma, cal) : null;
      return { ...r, cal, estimacion: est?.altura ?? null, errorRel: cal?.errorRel ?? null };
    });
    const combinada = combinar(porEncuadre);
    for (const r of porEncuadre) {
      const { frameMiniatura, cal, ...resto } = r;
      const linea = {
        fecha: r.fechaFoto && cam.tipo !== "hls" ? r.fechaFoto : fecha,
        camara: id,
        spot: CAMARAS_OLEAJE[id].spot,
        ...resto,
        calibracion: cal ? { n: cal.n, nEtiquetas: cal.nEtiquetas, errorRel: cal.errorRel, pocosDatos: cal.pocosDatos } : null,
        estimacionCamara: combinada,
        marAbierto: mar[id] ?? null,
        coefPrior: mar[id]?.coefPrior ?? null,
        modeloCamara: mar[id]?.modeloCamara ?? null,
        boya,
      };
      lineas.push(linea);
      filas.push({ linea, frameMiniatura });
    }
    const resumen = m.map((r) => `${r.encuadre ?? "-"}:${r.espuma ?? "-"}(${r.estado})`).join(" ");
    console.log(`✓ ${id}: ${resumen} → ${combinada ? `${combinada.estimacion} m (${combinada.rangoMin}-${combinada.rangoMax})` : "sin estimación"}; modelo ${mar[id]?.modeloCamara ?? "?"} m; boya ${boya ? `${boya.nombre} ${boya.hs} m` : "-"}`);
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
  if (DIR_MINIATURAS) {
    mkdirSync(DIR_MINIATURAS, { recursive: true });
    for (const { linea: l, frameMiniatura } of filas) {
      if (frameMiniatura) writeFileSync(join(DIR_MINIATURAS, `${l.camara}-${l.encuadre}-${fecha.slice(11, 16).replace(":", "")}.jpg`), jpegDeFrame(frameMiniatura));
    }
  }
  writeFileSync(join(dirname(SALIDA), "calibracion.json"), JSON.stringify({ fecha, lineasHistorial: historial.length, etiquetas: etiquetas.length, calibracion }, null, 1) + "\n");
  console.log(`${lineas.length} líneas añadidas a ${SALIDA}`);

  if (!CLAVE) {
    console.log("::warning::Sin SUPABASE_SERVICE_ROLE_KEY: no se publican las lecturas para la app.");
    return;
  }
  try {
    const dia = fecha.slice(0, 10), hhmm = fecha.slice(11, 16).replace(":", "");
    const registros = [];
    for (const { linea: l, frameMiniatura } of filas) {
      let miniatura = null;
      if (frameMiniatura && l.estado === "ok") {
        miniatura = `${dia}/${l.camara}-${l.encuadre}-${hhmm}.jpg`;
        try { await subirMiniatura(miniatura, jpegDeFrame(frameMiniatura)); } catch (e) { console.log(`::warning::Miniatura ${miniatura}: ${e.message}`); miniatura = null; }
      }
      registros.push({
        fecha: l.fecha, camara: l.camara, spot_slug: l.spot, encuadre: l.encuadre ?? "ninguno", estado: l.estado,
        espuma: l.espuma, estimacion_m: l.estimacion, estimacion_camara_m: l.estimacionCamara?.estimacion ?? null,
        rango_min_m: l.estimacionCamara?.rangoMin ?? null, rango_max_m: l.estimacionCamara?.rangoMax ?? null,
        error_rel: l.estimacionCamara?.errorRel ?? null,
        modelo_camara_m: l.modeloCamara, mar_abierto_m: l.marAbierto?.hsCorregida ?? null, dir_ola: l.marAbierto?.dir ?? null,
        boya: l.boya?.nombre ?? null, boya_hs_m: l.boya?.hs ?? null, miniatura,
      });
    }
    await supabase("/rest/v1/oleaje_camara_lecturas?on_conflict=camara,encuadre,fecha", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(registros),
    });
    console.log(`${registros.length} lecturas publicadas en Supabase.`);
    const borradas = await limpiarMiniaturas();
    if (borradas) console.log(`${borradas} miniaturas viejas sin etiquetar borradas.`);
  } catch (e) {
    // Migración sin aplicar o Supabase caído: el histórico ya está guardado.
    console.log(`::warning::No se pudieron publicar las lecturas en Supabase (¿migración 20261008160000 sin aplicar?): ${e.message}`);
  }
}

// Solo se ejecuta como script (los tests importan combinar()).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("Fallo general:", e);
    process.exit(1);
  });
}
