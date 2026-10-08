// scripts/marketing/obtener-datos.mjs
// Datos REALES de un spot para las piezas de Instagram (2026-10-08): los
// mismos endpoints públicos que usa la app, sin sesión. Todo lo que no llegue
// se deja fuera de la pieza en vez de inventarlo.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTS } from "../../functions/prevision.js";
import { serieHoraria } from "../../assets/js/condiciones-salida.js";
import { resumenDelDia, tarjetasCondiciones, bboxMercator } from "./pieza-datos.mjs";

const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BASE_URL = "https://costaviva.org";

export function leerEspecies() {
  return JSON.parse(readFileSync(join(RAIZ_REPO, "assets/datos/especies.json"), "utf8"));
}

// Hora actual de Madrid como "AAAA-MM-DDTHH:00", el formato de Open-Meteo.
export function ahoraMadridISO(fecha = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}
export function fechaLegible(fecha = new Date()) {
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "short" }).format(fecha);
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(fecha);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1).replace(".", "")}<br>${hora}`;
}

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
}

export async function previsionDeSpot(slug) {
  const datos = await json(`${BASE_URL}/prevision`);
  const spot = datos.spots.find((s) => s.slug === slug);
  if (!spot || spot.error || !spot.bloques?.length) throw new Error(`/prevision no trae datos de "${slug}"`);
  return { spot, fuentes: datos.fuentesDatos || ["openmeteo"] };
}

// Mismo cálculo que la ficha de la app: serie horaria de /meteo + índice.
export async function resumenDeSpot(slug, especiesDatos, ahoraISO = ahoraMadridISO()) {
  const s = SPOTS.find((x) => x.slug === slug);
  const coord = `latitude=${s.lat}&longitude=${s.lon}&timezone=Europe%2FMadrid`;
  const [marino, tiempo] = await Promise.all([
    json(`${BASE_URL}/meteo/marine?${coord}&past_days=1&forecast_days=2&hourly=wave_height,wave_direction,sea_surface_temperature,sea_level_height_msl`),
    json(`${BASE_URL}/meteo/forecast?${coord}&past_days=5&forecast_days=2&hourly=windspeed_10m,winddirection_10m,pressure_msl,precipitation&windspeed_unit=kmh`),
  ]);
  const horas = serieHoraria(marino, tiempo);
  return { resumen: resumenDelDia(especiesDatos, horas, { lat: s.lat, lon: s.lon, ahoraISO }), horas };
}

// Recorte de batimetría EMODnet (WMS público: Fees None, AccessConstraints
// None en su GetCapabilities) alrededor del spot, como data: URL.
export async function mapaDeSpot(slug, ancho = 1080, alto = 670) {
  const s = SPOTS.find((x) => x.slug === slug);
  const b = bboxMercator(s.lat, s.lon, 60, alto / ancho);
  const url = "https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=emodnet:mean_atlas_land&styles=&format=image/png"
    + `&srs=EPSG:3857&bbox=${b.minx},${b.miny},${b.maxx},${b.maxy}&width=${ancho}&height=${alto}`;
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    return { imagen: `data:image/png;base64,${buf.toString("base64")}`, ancho, alto, bbox: b, fx: (b.x - b.minx) / (b.maxx - b.minx), fy: (b.maxy - b.y) / (b.maxy - b.miny) };
  } catch (e) {
    console.warn(`Sin minimapa de EMODnet (${e.message}); la pieza sale sin él.`);
    return null;
  }
}

// Viento de la hora actual en rejilla (bandas U/V), para las partículas.
export async function vientoDeSpot(slug) {
  const s = SPOTS.find((x) => x.slug === slug);
  try {
    const d = await json(`${BASE_URL}/viento-campo?bbox=${s.lat - 1},${s.lon - 1},${s.lat + 1},${s.lon + 1}`);
    // { bbox, snapshots: [{ hora, data: [U, V] }] }, la primera es "ahora".
    const [u, v] = d.snapshots?.[0]?.data || [];
    if (!u?.header || !v?.data) throw new Error("formato inesperado");
    return { u: { header: u.header, data: u.data }, v: { header: v.header, data: v.data } };
  } catch (e) {
    console.warn(`Sin viento animado (${e.message}).`);
    return null;
  }
}

export function nombreSpot(slug) {
  return SPOTS.find((x) => x.slug === slug)?.nombre || slug;
}
export function datosTarjetas(spot) {
  return tarjetasCondiciones(spot.bloques[0], spot.marea);
}
export const FUENTES_TEXTO = "Datos: Open-Meteo (CC BY 4.0)<br>Batimetría: EMODnet Bathymetry";
