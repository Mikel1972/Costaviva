// scripts/oleaje-camaras/preparar-lote-etiquetado.mjs
// Prepara un LOTE de fotogramas para que Claude los etiquete mirándolos
// (2026-10-08, Mikel: "puedes calibrar tú la cámara. Debes, de hecho").
// Este script NO usa IA ni ninguna API de pago: solo baja fotogramas y
// calcula la espuma con el mismo código que el robot (espuma.mjs). Quien
// mira las imágenes es Claude en una sesión o rutina del plan de Claude
// (nunca `claude -p` ni la API), siguiendo RUTINA_ETIQUETADO.md.
//
// Dos fuentes de fotogramas:
//   --origen camaras (por defecto): captura AHORA un fotograma de cada
//     encuadre de las 13 cámaras (medirHls/medirImagen de medir-espuma.mjs,
//     con sus referencias y ROI). Cada fotograma lleva su espuma medida, así
//     que la etiqueta se puede calibrar sin depender de Supabase.
//   --origen bucket: lista las lecturas `ok` de las últimas --horas horas en
//     public.oleaje_camara_lecturas (lectura pública con la clave anon) que
//     tengan miniatura en el bucket público oleaje-camaras y que aún no
//     estén en etiquetas-claude.jsonl, y baja esas miniaturas. Necesita la
//     migración 20261008180000 aplicada; si no, lo dice y no hace nada.
//
// Deja en --dir (por defecto ./lote-etiquetado, FUERA del repo si puede ser):
//   <id>.jpg            fotograma 320x180 (y <id>-grande.jpg si hay original)
//   lote.json           [{ id, camara, encuadre, fecha, espuma, estado,
//                          hash, imagen, modeloCamara, boya, ... }]
// Las imágenes NO se suben al repo: en etiquetas-claude.jsonl solo va el
// hash (sha256 de los píxeles 320x180, 16 hex) o la ruta de la miniatura.
//
// Uso: node scripts/oleaje-camaras/preparar-lote-etiquetado.mjs
//        [--dir carpeta] [--origen camaras|bucket] [--horas 24]
//        [--max 40] [--boyas boyas.json] [--sin-modelo]
//
// Y para ANOTAR una etiqueta de un fotograma del lote (añade una línea a
// datos-robots/oleaje-camaras/etiquetas-claude.jsonl con todo lo que hace
// falta para calibrar; así no se escribe el JSON a mano):
//      node scripts/oleaje-camaras/preparar-lote-etiquetado.mjs --anotar
//        --dir carpeta --id <id del lote> --banda "<0.5"|0.5-1|1-2|2-3|">3"|no_se_sabe
//        --confianza alta|media|baja --motivo "texto corto" [--verificado]
//   --verificado: el fotograma salió "otro_encuadre" pero se ha MIRADO y es
//     el encuadre de la referencia (lo que falló fue la huella por marea o
//     luz) y el ROI cae en agua sin brillos: entonces cuenta para calibrar.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMARAS } from "./camaras.mjs";
import { medirHls, medirImagen, jpegDeFrame, marAbiertoPorCamara, boyaDeCamara, framesDeFichero, leerJsonl, FICHERO_ETIQUETAS_CLAUDE } from "./medir-espuma.mjs";
import { medirEspuma } from "./espuma.mjs";
import { CAMARAS_OLEAJE } from "../../functions/_lib/oleaje-camaras.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
// Clave anon PÚBLICA (la misma de index.html): solo lectura de
// oleaje_camara_lecturas (policy "anon-ok" de la migración).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

const RAIZ_REFS = join(dirname(fileURLToPath(import.meta.url)), "referencias");

export const hashFrame = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

// Lecturas del bucket aún sin etiquetar por Claude (puro, para los tests).
export function sinEtiquetar(lecturas, etiquetas) {
  const hechas = new Set(etiquetas.flatMap((e) => [e.miniatura, e.hash].filter(Boolean)));
  return lecturas.filter((l) => l.miniatura && l.estado === "ok" && !hechas.has(l.miniatura));
}

// Cámaras de FOTO FIJA (un solo encuadre) cuyo fotograma no se parece lo
// bastante a la referencia (en el robot salen `otro_encuadre`): a veces es
// solo la luz (Mundaka a contraluz, 2026-10-08) y otras la cámara sí ha
// cambiado de plano (Sopela el mismo día, aunque parecía la marea). Se guarda igualmente, medido con
// el ROI de su único encuadre y con estado "otro_encuadre": quien etiqueta
// MIRA si el encuadre es el de la referencia y, si lo es, lo marca con
// `encuadreVerificado: true` (solo entonces cuenta para calibrar).
async function fotoFijaForzada(id, cam) {
  const r = await fetch(cam.url, { headers: { "User-Agent": "CostavivaOlaBot/1.0 (+https://costaviva.org)" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const lm = Date.parse(r.headers.get("last-modified") || "");
  const dir = mkdtempSync(join(tmpdir(), `lote-${id}-`));
  try {
    const f = join(dir, "foto");
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    const [rgb] = framesDeFichero(f);
    if (!rgb) throw new Error("no se pudo decodificar");
    const enc = cam.encuadres[0];
    return { encuadre: enc.id, ...medirEspuma(rgb, 320, 180, enc.roi), estado: "otro_encuadre", frameMiniatura: rgb, fechaFoto: Number.isFinite(lm) ? new Date(lm).toISOString() : null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Comprobación del encuadre para quien etiqueta: el fotograma (arriba) y la
// referencia (abajo), los dos a 640x360 con el ROI en rojo. Sin esto no se
// puede marcar `--verificado` (Sopela el 2026-10-08: parecía la marea y era
// la cámara con otro zoom; el ROI caía en mar abierto, detrás de la rompiente).
export const filtroRoi = (roi, w = 640, h = 360) =>
  `scale=${w}:${h},drawbox=x=${Math.round(roi.x0 * w)}:y=${Math.round(roi.y0 * h)}:w=${Math.round((roi.x1 - roi.x0) * w)}:h=${Math.round((roi.y1 - roi.y0) * h)}:color=red:t=2`;
function imagenRoi(frameJpg, encuadre, destino) {
  try {
    const ref = join(RAIZ_REFS, `${encuadre.ref}.jpg`);
    const f = filtroRoi(encuadre.roi);
    execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", frameJpg, "-i", ref, "-filter_complex", `[0]${f}[a];[1]${f}[b];[a][b]vstack`, "-q:v", "4", destino], { timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

// Foto fija en su tamaño original (para MIRARLA mejor que a 320x180), solo
// si es la misma foto que se midió (misma Last-Modified).
async function original(cam, fechaFoto, destino) {
  try {
    const r = await fetch(cam.url, { headers: { "User-Agent": "CostavivaOlaBot/1.0 (+https://costaviva.org)" }, signal: AbortSignal.timeout(30000) });
    const lm = Date.parse(r.headers.get("last-modified") || "");
    if (!r.ok || !fechaFoto || !Number.isFinite(lm) || new Date(lm).toISOString() !== fechaFoto) return false;
    const d = mkdtempSync(join(tmpdir(), "lote-g-"));
    try {
      const f = join(d, "foto");
      writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", f, "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", destino], { timeout: 30000 });
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
}

const arg = (args, n, def = null) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : def);

async function desdeCamaras(dir, { boyas, conModelo }) {
  const ids = Object.keys(CAMARAS);
  const [mar, resultados] = await Promise.all([
    conModelo ? marAbiertoPorCamara().catch((e) => (console.log("Mar abierto no disponible:", e.message), {})) : {},
    Promise.all(ids.map((id) => {
      const cam = CAMARAS[id];
      return (cam.tipo === "hls" ? medirHls : medirImagen)(id, cam).then((m) => ({ id, m }), (e) => ({ id, e }));
    })),
  ]);
  const ahora = new Date().toISOString();
  const lote = [];
  for (const { id, m, e } of resultados) {
    if (e) { console.log(`✗ ${id}: ${e.message}`); continue; }
    const cam = CAMARAS[id];
    if (cam.tipo !== "hls" && cam.encuadres.length === 1 && !m.some((r) => r.frameMiniatura) && m.some((r) => r.estado === "otro_encuadre")) {
      const sim = m.find((r) => r.estado === "otro_encuadre")?.similitud ?? null;
      try { m.splice(0, m.length, { ...(await fotoFijaForzada(id, cam)), similitud: sim }); } catch (e2) { console.log(`✗ ${id} (forzada): ${e2.message}`); }
    }
    for (const r of m) {
      if (!r.frameMiniatura) { console.log(`- ${id}/${r.encuadre ?? "-"}: ${r.estado}, sin fotograma`); continue; }
      const hash = hashFrame(r.frameMiniatura);
      const fecha = r.fechaFoto || ahora;
      const idLote = `${id}-${r.encuadre}-${fecha.slice(11, 16).replace(":", "")}-${hash.slice(0, 6)}`;
      writeFileSync(join(dir, `${idLote}.jpg`), jpegDeFrame(r.frameMiniatura));
      const enc = cam.encuadres.find((e) => e.id === r.encuadre);
      const roi = enc ? imagenRoi(join(dir, `${idLote}.jpg`), enc, join(dir, `${idLote}-roi.jpg`)) : false;
      const grande = cam.tipo === "imagen" ? await original(cam, r.fechaFoto, join(dir, `${idLote}-grande.jpg`)) : false;
      lote.push({
        id: idLote, camara: id, spot: CAMARAS_OLEAJE[id].spot, encuadre: r.encuadre, fecha, estado: r.estado,
        espuma: r.espuma, similitud: r.similitud ?? null, hash, imagen: `${idLote}.jpg`,
        ...(grande ? { imagenGrande: `${idLote}-grande.jpg` } : {}),
        ...(roi ? { imagenRoi: `${idLote}-roi.jpg` } : {}),
        modeloCamara: mar[id]?.modeloCamara ?? null, marAbierto: mar[id]?.hsCorregida ?? null, dir: mar[id]?.dir ?? null,
        boya: boyaDeCamara(CAMARAS[id], boyas),
      });
      console.log(`✓ ${idLote}: espuma ${r.espuma} (${r.estado})`);
    }
  }
  return lote;
}

async function desdeBucket(dir, { horas, max }) {
  const desde = new Date(Date.now() - horas * 3600e3).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/oleaje_camara_lecturas?select=fecha,camara,encuadre,estado,espuma,miniatura,modelo_camara_m,mar_abierto_m,dir_ola,boya,boya_hs_m` +
      `&estado=eq.ok&miniatura=not.is.null&fecha=gte.${encodeURIComponent(desde)}&order=fecha.desc&limit=1000`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: AbortSignal.timeout(30000) }
  );
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}: ${(await r.text()).slice(0, 200)} (¿migración 20261008180000 sin aplicar?)`);
  const pendientes = sinEtiquetar(await r.json(), leerJsonl(FICHERO_ETIQUETAS_CLAUDE)).slice(0, max);
  const lote = [];
  for (const l of pendientes) {
    const img = await fetch(`${SUPABASE_URL}/storage/v1/object/public/oleaje-camaras/${l.miniatura}`, { signal: AbortSignal.timeout(30000) });
    if (!img.ok) { console.log(`✗ ${l.miniatura}: HTTP ${img.status}`); continue; }
    const buf = Buffer.from(await img.arrayBuffer());
    const idLote = l.miniatura.replace(/[/.]/g, "_").replace(/_jpg$/, "");
    writeFileSync(join(dir, `${idLote}.jpg`), buf);
    lote.push({
      id: idLote, camara: l.camara, spot: CAMARAS_OLEAJE[l.camara]?.spot ?? null, encuadre: l.encuadre, fecha: l.fecha, estado: l.estado,
      espuma: Number(l.espuma), miniatura: l.miniatura, hash: null, imagen: `${idLote}.jpg`,
      modeloCamara: l.modelo_camara_m, marAbierto: l.mar_abierto_m, dir: l.dir_ola,
      boya: l.boya ? { nombre: l.boya, hs: l.boya_hs_m } : null,
    });
  }
  return lote;
}

export const BANDAS_CLAUDE = ["<0.5", "0.5-1", "1-2", "2-3", ">3", "no_se_sabe"];

// Línea de etiquetas-claude.jsonl a partir de una entrada del lote (pura).
export function lineaEtiqueta(entrada, { banda, confianza, motivo, verificado = false }, ahora = new Date()) {
  if (!BANDAS_CLAUDE.includes(banda)) throw new Error(`banda no válida: ${banda}`);
  if (!["alta", "media", "baja"].includes(confianza)) throw new Error(`confianza no válida: ${confianza}`);
  if (!motivo) throw new Error("falta el motivo");
  return {
    fecha: entrada.fecha, camara: entrada.camara, encuadre: entrada.encuadre, banda, confianza, motivo,
    espuma: entrada.espuma, estado: entrada.estado, similitud: entrada.similitud ?? null,
    ...(verificado ? { encuadreVerificado: true } : {}),
    hash: entrada.hash ?? null, ...(entrada.miniatura ? { miniatura: entrada.miniatura } : {}),
    referencia: { boya: entrada.boya ? { nombre: entrada.boya.nombre, hs: entrada.boya.hs, hora: entrada.boya.hora } : null, modeloCamara: entrada.modeloCamara ?? null },
    por: "claude", etiquetadoEn: ahora.toISOString(),
  };
}

function anotar(args) {
  const dir = resolve(arg(args, "--dir", "lote-etiquetado"));
  const id = arg(args, "--id");
  const lote = JSON.parse(readFileSync(join(dir, "lote.json"), "utf8"));
  const entrada = lote.find((x) => x.id === id);
  if (!entrada) throw new Error(`no hay ${id} en ${dir}/lote.json`);
  const l = lineaEtiqueta(entrada, { banda: arg(args, "--banda"), confianza: arg(args, "--confianza"), motivo: arg(args, "--motivo"), verificado: args.includes("--verificado") });
  appendFileSync(FICHERO_ETIQUETAS_CLAUDE, JSON.stringify(l) + "\n");
  console.log(`+ ${id}: ${l.banda} (${l.confianza})`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--anotar")) return anotar(args);
  const dir = resolve(arg(args, "--dir", "lote-etiquetado"));
  const origen = arg(args, "--origen", "camaras");
  const horas = Number(arg(args, "--horas", 24));
  const max = Number(arg(args, "--max", 40));
  const fBoyas = arg(args, "--boyas");
  const boyas = fBoyas && existsSync(fBoyas) ? JSON.parse(readFileSync(fBoyas, "utf8")) : null;
  mkdirSync(dir, { recursive: true });
  const nuevos = origen === "bucket"
    ? await desdeBucket(dir, { horas, max })
    : await desdeCamaras(dir, { boyas, conModelo: !args.includes("--sin-modelo") });
  // Se ACUMULA en lote.json (varias capturas a lo largo del día en el mismo lote).
  const fLote = join(dir, "lote.json");
  const previo = existsSync(fLote) ? JSON.parse(readFileSync(fLote, "utf8")) : [];
  const vistos = new Set(previo.map((x) => x.hash || x.miniatura));
  const lote = [...previo, ...nuevos.filter((x) => !vistos.has(x.hash || x.miniatura))];
  writeFileSync(fLote, JSON.stringify(lote, null, 1) + "\n");
  console.log(`${nuevos.length} fotogramas nuevos; lote con ${lote.length} en ${dir}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("Fallo:", e.message);
    process.exit(1);
  });
}
