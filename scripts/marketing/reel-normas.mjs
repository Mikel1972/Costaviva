// scripts/marketing/reel-normas.mjs — serie "Normas que nadie te cuenta"
// (2026-11-19, aprobada por Mikel). Sin IA. Cada reel, una especie que hay
// que declarar en PescaREC: el gancho, la obligación, su talla mínima por
// zonas (tabla verificada de especies.json, con su norma) y su veda si la
// tiene. Nada que no esté en una norma citada.
//
// Uso:  node reel-normas.mjs [--fecha AAAA-MM-DD] [--especie abadejo]
import { appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { BASE_URL, leerEspecies } from "./obtener-datos.mjs";
import { piezaAPreparar, campanaDePieza, MARCA_ENLACE } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO, LEMA } from "./reel-comun.mjs";
import { campanaDe } from "./campana-temporal.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUTA_ROTACION = join(__dirname, "rotacion-reels-normas.json");

// Rotación: alterna una especie que hay que declarar (anexo II del RD
// 347/2011 tras el RD 214/2026, con talla en especies.json) con una de las
// más buscadas que solo tiene talla mínima. Artículo y pronombre para que la
// frase suene bien.
export const ROTACION_NORMAS = [
  { id: "lubina", un: "una lubina", lo: "la", declarar: true },
  { id: "dorada", un: "una dorada", lo: "la" },
  { id: "abadejo", un: "un abadejo", lo: "lo", declarar: true },
  { id: "gallo", un: "un gallo", lo: "lo" },
  { id: "merluza", un: "una merluza", lo: "la", declarar: true },
  { id: "sargo", un: "un sargo", lo: "lo" },
  { id: "besugo", un: "un besugo", lo: "lo", declarar: true },
  { id: "lisa", un: "una lisa", lo: "la" },
  { id: "caballa", un: "una caballa", lo: "la" },
  { id: "salmonete", un: "un salmonete", lo: "lo" },
  { id: "chopa", un: "una chopa", lo: "la" },
  { id: "congrio", un: "un congrio", lo: "lo" },
];
// Zonas de España para la talla: en cada grupo, la norma más concreta.
// El RD 560/1995 (anexo I) vale para Cantábrico, Galicia y golfo de Cádiz;
// la talla de la pesca recreativa del RD 347/2011 (art. 4 bis), solo para
// Cantábrico y Galicia: si existe, el golfo de Cádiz va aparte.
function gruposTalla(e) {
  const t = (j) => (e.talla_minima || []).find((x) => x.jurisdiccion === j && x.valor_cm != null);
  const g = [];
  if (t("ES-recreativa-CNW")) {
    g.push({ zona: "Cantábrico y Galicia", t: t("ES-recreativa-CNW") });
    if (t("ES-RD560-I")) g.push({ zona: "Golfo de Cádiz", t: t("ES-RD560-I") });
  } else if (t("ES-RD560-I")) g.push({ zona: "Cantábrico, Galicia y golfo de Cádiz", t: t("ES-RD560-I") });
  if (t("ES-RD560-II")) g.push({ zona: "Mediterráneo", t: t("ES-RD560-II") });
  if (t("ES-RD560-III")) g.push({ zona: "Canarias", t: t("ES-RD560-III") });
  return g;
}

export function siguienteNorma(ultimo) {
  const i = ROTACION_NORMAS.findIndex((x) => x.id === ultimo);
  return ROTACION_NORMAS[(i + 1) % ROTACION_NORMAS.length];
}

// Tarjetas y textos de una especie, solo con datos citados.
export function piezaNorma(especiesDatos, norma) {
  const e = especiesDatos.especies.find((x) => x.id === norma.id);
  if (!e) throw new Error(`${norma.id} no está en especies.json`);
  const nombre = e.nombres.es.split(" / ")[0];
  const tallas = [];
  for (const g of gruposTalla(e)) tallas.push({ zona: g.zona, cm: g.t.valor_cm, norma: g.t.ambito_corto || g.t.ambito });
  const veda = (e.vedas || []).find((v) => v.texto && (v.regiones || []).some((r) => ["cantabrico", "atlantico_norte", "mediterraneo", "golfo_cadiz", "baleares", "canarias"].includes(r)));
  const tarjetas = [
    ...(norma.declarar ? [{ etq: `Hay que declarar${norma.lo}`, val: "En PescaREC, en 24 h", sub: `También si ${norma.lo} devuelves al agua · RD 214/2026` }] : []),
    ...tallas.slice(0, norma.declarar ? 2 : 3).map((t) => ({ etq: `Talla mínima · ${t.zona}`, val: `${t.cm} cm`, sub: t.norma })),
    ...(veda?.meses?.length && veda.meses.length < 12 ? [{ etq: "Veda", val: `${nombreMes(veda.meses[0])} a ${nombreMes(veda.meses[veda.meses.length - 1])}`, sub: veda.jurisdiccion === "UE" ? "Reglamento de la UE · se puede pescar y soltar" : "Norma oficial" }] : []),
    ...(!norma.declarar ? [{ etq: "Si mide menos", val: "Al agua, con cuidado", sub: "Quedártel" + norma.lo.slice(-1) + " es sancionable" }] : []),
  ];
  if (tarjetas.length < 2) throw new Error(`${norma.id}: pocos datos verificados para un reel`);
  const gancho = norma.declarar
    ? `¿Sabías que si pescas ${norma.un} tienes que declarar${norma.lo}?`
    : `¿Cuánto tiene que medir ${norma.un} para poder quedárte${norma.lo}?`;
  return { nombre, tallas, veda, tarjetas, gancho };
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m) => MESES[m - 1];

async function main() {
  const estado = leerJson(RUTA_ESTADO);
  const fechaArg = process.argv.includes("--fecha") ? process.argv[process.argv.indexOf("--fecha") + 1] : process.env.FECHA_PIEZA || "";
  const objetivo = piezaAPreparar({ formato: "reel", fechaForzada: fechaArg, tipoForzado: "normas", estado, mercado: "es" });
  if (!objetivo) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const { fecha, hora, clave } = objetivo;
  const rotacion = leerJson(RUTA_ROTACION);
  const forzada = process.argv.includes("--especie") ? process.argv[process.argv.indexOf("--especie") + 1] : "";
  const norma = forzada ? ROTACION_NORMAS.find((x) => x.id === forzada) : siguienteNorma(rotacion.ultima);
  const especiesDatos = leerEspecies();
  const p = piezaNorma(especiesDatos, norma);
  const clip = elegirClip(process.env.CLIP_REEL || "");
  const datos = {
    spot: "Normas que<br>nadie te cuenta",
    gancho: p.gancho,
    cinta: campanaDe(fecha)?.cinta || null,
    tarjetas: p.tarjetas,
    lema: LEMA,
    credito: `${clip.credito} · Normas: BOE${norma.declarar ? " (RD 347/2011, RD 214/2026)" : " (RD 560/1995)"}${p.veda ? " y UE" : ""}`,
  };
  const rutaRelativa = `assets/marketing/reels/${fecha}-normas-${norma.id}.mp4`;
  await montarVideo({ datos, clip, rutaRelativa });
  const caption = [
    `${p.gancho} 📋`,
    "",
    ...(norma.declarar ? [`Desde marzo de 2026, si pescas ${norma.un} en España tienes que declarar${norma.lo} en la app PescaREC del Ministerio en las 24 horas siguientes a acabar de pescar. También si ${norma.lo} devuelves al agua (RD 214/2026).`, ""] : []),
    ...p.tallas.map((t) => `📏 Talla mínima en ${t.zona}: ${t.cm} cm (${t.norma}).`),
    ...(p.veda ? [`⚠️ ${p.veda.texto}`] : []),
    "",
    "Costaviva te avisa en tu diario si una captura no llega a la talla mínima de tu zona o hay que declararla.",
    ...(campanaDe(fecha) ? [campanaDe(fecha).texto, ""] : []),
    "💾 Guárdalo y compártelo con tu compañero de pesca: muchos no lo saben.",
    `🔗 14 días gratis, sin tarjeta: ${MARCA_ENLACE}`,
    "",
    "Información orientativa: manda siempre la norma publicada.",
    "",
    `#pesca #normasdepesca #${p.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")} #pescarecreativa #costaviva`,
  ].join("\n");
  const campana = campanaDePieza(fecha, `reel-normas-${norma.id}`);
  apuntarReel({ tipo: "reel-normas", caption, rutaRelativa, baseUrl: BASE_URL, fecha, hora, campana, clip, estado, clave,
    rotacionPropia: { ruta: RUTA_ROTACION, datos: { ultima: norma.id, fecha: new Date().toISOString() } } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel de normas:", e); process.exit(1); });
}
