// functions/_lib/copernicus-mar.js
// Adaptador del modelo IBI de Copernicus Marine a la forma de Open-Meteo
// Marine (2026-10-08). Fuente gratuita y válida para uso comercial (licencia
// de Copernicus Marine, cláusula 2.2: "for any purpose", sin coste), con
// atribución obligatoria y visible (cláusula 2.4). Ver CLAUDE.md, "Fuentes
// gratuitas".
//
// Los datos NO se piden en vivo: scripts/fuentes/descargar-ibi.py (workflow
// fuentes-gratuitas.yml, con la cuenta de Copernicus) los descarga una o dos
// veces al día y deja en Supabase Storage:
//   mar/spots.json            todos los SPOTS (y las boyas, para la comparativa)
//   mar/celdas/<k>.json       celdas de mar alrededor de los spots, por cajas
//                             de 0,5° (k = floor(lat*2)_floor(lon*2)), para
//                             las ubicaciones personalizadas
// Formato de cada fichero:
//   { v: 1, fuente: "copernicus-ibi", generado_en, inicio (ISO UTC), horas,
//     puntos: [{ id, tipo, lat, lon, wh, wd, wp, wpp, sst, sl, cv, cd }] }
// Columnas por hora desde `inicio` (UTC), ya en las unidades de Open-Meteo:
//   wh  wave_height              VHM0 (m)
//   wd  wave_direction           VMDR (° de donde viene)
//   wp  wave_period              VTM10 (s, periodo medio)
//   wpp wave_peak_period         VTPK (s, periodo de pico; el que dan las boyas, Tp)
//   sst sea_surface_temperature  thetao de superficie (°C)
//   sl  sea_level_height_msl     zos (m, sobre el geoide, CON marea)
//   cv  ocean_current_velocity   |uo,vo| (km/h, como Open-Meteo)
//   cd  ocean_current_direction  hacia donde va (°, como Open-Meteo)
// La forma de la respuesta y las etiquetas de hora salen de eje-horario.js,
// idénticas a Open-Meteo. Las horas fuera de lo descargado salen null.

import { ejeHorario, ventanaDeConsulta, etiquetaConDesfase, horaUTC, HORA_MS } from "./eje-horario.js";
import { leerInstantanea, distanciaKm, mismoPunto } from "./instantaneas.js";

export const ATRIBUCION_COPERNICUS = "Generated using E.U. Copernicus Marine Service Information";
export const DOIS_COPERNICUS = ["10.48670/moi-00025", "10.48670/moi-00027"];
export const ATRIBUCION_COPERNICUS_HTML =
  'Datos de mar: <a href="https://marine.copernicus.eu/" target="_blank" rel="noopener">Generated using E.U. Copernicus Marine Service Information</a>; ' +
  DOIS_COPERNICUS.map((d) => `<a href="https://doi.org/${d}" target="_blank" rel="noopener">${d}</a>`).join(", ");

const VARIABLES = {
  wave_height: { col: "wh", unidad: "m" },
  wave_direction: { col: "wd", unidad: "°" },
  wave_period: { col: "wp", unidad: "s" },
  wave_peak_period: { col: "wpp", unidad: "s" },
  sea_surface_temperature: { col: "sst", unidad: "°C" },
  sea_level_height_msl: { col: "sl", unidad: "m" },
  ocean_current_velocity: { col: "cv", unidad: "km/h" },
  ocean_current_direction: { col: "cd", unidad: "°" },
};
export const VARIABLES_COPERNICUS = new Set(Object.keys(VARIABLES));

// Distancia máxima a una celda de mar para dar dato a un punto suelto.
export const MAX_KM_CELDA = 15;

export function claveCaja(lat, lon) {
  return `${Math.floor(lat * 2)}_${Math.floor(lon * 2)}`;
}

// Cajas de 0,5° a menos de ~0,15° del punto (como mucho 4).
export function cajasCercanas(lat, lon) {
  const m = 0.15;
  const claves = new Set();
  for (const dl of [-m, 0, m]) for (const dn of [-m, 0, m]) claves.add(claveCaja(lat + dl, lon + dn));
  return [...claves];
}

function valor(punto, inicio, col, ms) {
  const i = Math.round((ms - inicio) / HORA_MS);
  const arr = punto?.[col];
  if (!arr || i < 0 || i >= arr.length) return null;
  const v = arr[i];
  return v === undefined ? null : v;
}

// Un punto de la instantánea + consulta -> forma de Open-Meteo Marine.
export function puntoAOpenMeteo(punto, inicio, sp, { lat, lon, hourly = [], current = [], ahora = Date.now() } = {}) {
  const eje = ejeHorario(ventanaDeConsulta(sp), ahora);
  const salida = {
    latitude: Number(punto?.lat ?? lat),
    longitude: Number(punto?.lon ?? lon),
    generationtime_ms: 0,
    utc_offset_seconds: eje.utc_offset_seconds,
    timezone: eje.timezone,
    timezone_abbreviation: eje.timezone_abbreviation,
    elevation: 0,
  };
  if (hourly.length) {
    salida.hourly_units = { time: "iso8601" };
    salida.hourly = { time: eje.horas.map((h) => h.etiqueta) };
    for (const v of hourly) {
      const def = VARIABLES[v];
      salida.hourly_units[v] = def ? def.unidad : "";
      salida.hourly[v] = eje.horas.map((h) => (def && punto ? valor(punto, inicio, def.col, h.ms) : null));
    }
  }
  if (current.length) {
    const ms = horaUTC(ahora);
    salida.current_units = { time: "iso8601", interval: "seconds" };
    salida.current = { time: etiquetaConDesfase(ms, eje.utc_offset_seconds), interval: 3600 };
    for (const v of current) {
      const def = VARIABLES[v];
      salida.current_units[v] = def ? def.unidad : "";
      salida.current[v] = def && punto ? valor(punto, inicio, def.col, ms) : null;
    }
  }
  return salida;
}

// Celda de mar más cercana en las cajas de alrededor del punto.
async function celdaCercana(lat, lon, opciones) {
  const ficheros = await Promise.all(
    cajasCercanas(lat, lon).map((k) => leerInstantanea(`mar/celdas/${k}.json`, opciones))
  );
  let mejor = null;
  for (const f of ficheros) {
    if (!f) continue;
    for (const p of f.puntos || []) {
      const d = distanciaKm(lat, lon, p.lat, p.lon);
      if (d <= MAX_KM_CELDA && (!mejor || d < mejor.d)) mejor = { d, punto: p, inicio: Date.parse(f.inicio) };
    }
  }
  return mejor;
}

// Resuelve cada coordenada pedida a un punto de la instantánea.
// coords: [{ lat, lon }]. Devuelve [{ punto, inicio } | null].
export async function resolverPuntosMar(coords, opciones = {}) {
  if (coords.length === 1) {
    const c = await celdaCercana(coords[0].lat, coords[0].lon, opciones);
    if (c) return [c];
  }
  const spots = await leerInstantanea("mar/spots.json", opciones);
  const inicioSpots = spots ? Date.parse(spots.inicio) : null;
  const salida = [];
  let sueltos = 0;
  for (const c of coords) {
    const p = spots?.puntos?.find((x) => mismoPunto(x, c));
    if (p) { salida.push({ punto: p, inicio: inicioSpots }); continue; }
    // Coordenada que no es un spot: celdas, con tope para no disparar
    // subrequests (límite de 50 por invocación en Pages Functions).
    if (sueltos < 5) {
      sueltos++;
      salida.push(await celdaCercana(c.lat, c.lon, opciones));
    } else {
      salida.push(null);
    }
  }
  return salida;
}

// Punto de entrada del dispatcher (fuentes.js): mismas coordenadas, mismo
// orden y misma forma (objeto o array) que devolvería Open-Meteo.
export async function pedirCopernicusMar(coords, sp, { hourly = [], current = [], ahora = Date.now(), ...opciones } = {}) {
  const resueltos = await resolverPuntosMar(coords, { ...opciones, ahora });
  return coords.map((c, i) => {
    const r = resueltos[i];
    const o = puntoAOpenMeteo(r?.punto || null, r?.inicio ?? 0, sp, { lat: c.lat, lon: c.lon, hourly, current, ahora });
    if (!r) o.aviso = "sin celda de mar de Copernicus a menos de 15 km";
    return o;
  });
}
