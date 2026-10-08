// functions/_lib/era5.js
// Tiempo PASADO (reanálisis ERA5) con la forma de Open-Meteo Forecast
// (2026-10-08, fase 2 de fuentes gratuitas). Es la pata "pasado" de
// fuentes.js: MET Norway solo tiene previsión, así que cuando la atmósfera va
// por MET y la consulta es entera del pasado (el diario de un día anterior),
// los datos salen de aquí.
//
// Fuente: ERA5 (ECMWF / Copernicus Climate Change Service), licencia CC BY 4.0
// en el Climate Data Store (DOI 10.24381/cds.adbb2d47), leído de la copia
// pública ARCO-ERA5 de Google Cloud sin cuenta por
// scripts/fuentes/descargar-era5.py (workflow fuentes-gratuitas.yml), que
// deja un fichero por día UTC y caja de 1° en el bucket:
//   pasado/<AAAA-MM-DD>/<floor(lat)_floor(lon)>.json
//   { fecha, inicio, horas: 24, puntos: [{ lat, lon, ws, wd, p, t, c, pr }] }
// Rejilla de 0,25° (~25 km): se usa la celda más cercana, sin interpolar.
// ERA5T llega con ~6 días de retraso: los días que aún no están salen null y
// con `aviso`, nunca rellenados con otra cosa.

import { ejeHorario, ventanaDeConsulta, horaUTC, HORA_MS } from "./eje-horario.js";
import { leerInstantanea } from "./instantaneas.js";
import { serieAOpenMeteo, COLUMNAS_MET } from "./met-norway.js";

export const DOI_ERA5 = "10.24381/cds.adbb2d47";
export const ATRIBUCION_ERA5 =
  "Tiempo pasado: ERA5, contiene información modificada del Servicio de Cambio Climático de Copernicus (C3S) (CC BY 4.0)";
export const ATRIBUCION_ERA5_HTML =
  'Tiempo pasado: <a href="https://doi.org/10.24381/cds.adbb2d47" target="_blank" rel="noopener">ERA5</a>, ' +
  "contiene información modificada del Servicio de Cambio Climático de Copernicus (C3S) " +
  '(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)';

// Pages Functions: 50 subrequests por invocación. Un día local de Madrid son
// dos días UTC; el diario pide uno. Con este tope cabe una semana.
export const MAX_FICHEROS_ERA5 = 16;
const MAX_PUNTOS = 5;

export function claveCajaEra5(lat, lon) {
  return `${Math.floor(lat)}_${Math.floor(lon)}`;
}

// Celda de la rejilla de 0,25° más cercana.
export function celdaEra5(lat, lon) {
  return { lat: Math.round(lat * 4) / 4, lon: Math.round(lon * 4) / 4 };
}

// ¿Toda la ventana de la consulta es pasado? (última hora < ahora)
export function ventanaPasada(sp, ahora = Date.now()) {
  const eje = ejeHorario(ventanaDeConsulta(sp), ahora);
  const ultima = eje.horas[eje.horas.length - 1];
  return Boolean(ultima) && ultima.ms < horaUTC(ahora);
}

function diaUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Días UTC que hacen falta para cubrir el eje (un día local de Madrid toca
// dos días UTC).
export function diasNecesarios(eje) {
  const s = new Set();
  for (const h of eje.horas) s.add(diaUTC(h.ms));
  return [...s].sort();
}

// Ficheros diarios -> serie compacta de met-norway.js (mismas columnas), para
// reutilizar serieAOpenMeteo. `pr` de la serie es la lluvia de la hora QUE
// EMPIEZA en i; en ERA5 es la de la hora que TERMINA en i: se desplaza una.
export function serieDesdeEra5(dias, celda) {
  const validos = dias.filter((d) => d && d.fichero);
  if (!validos.length) return null;
  const inicio = Math.min(...validos.map((d) => Date.parse(d.fichero.inicio)));
  const fin = Math.max(...validos.map((d) => Date.parse(d.fichero.inicio) + d.fichero.horas * HORA_MS));
  const horas = Math.round((fin - inicio) / HORA_MS);
  const serie = { inicio, horas, ...Object.fromEntries(COLUMNAS_MET.map((k) => [k, new Array(horas).fill(null)])) };
  let encontrada = false;
  for (const { fichero } of validos) {
    const p = (fichero.puntos || []).find((x) => Math.abs(x.lat - celda.lat) < 1e-6 && Math.abs(x.lon - celda.lon) < 1e-6);
    if (!p) continue;
    encontrada = true;
    const desde = Math.round((Date.parse(fichero.inicio) - inicio) / HORA_MS);
    for (let h = 0; h < fichero.horas; h++) {
      const i = desde + h;
      for (const k of ["p", "t", "c", "ws", "wd"]) serie[k][i] = p[k]?.[h] ?? null;
      if (i - 1 >= 0) serie.pr[i - 1] = p.pr?.[h] ?? null;
    }
  }
  return encontrada ? serie : null;
}

// Punto de entrada del dispatcher (fuentes.js): misma forma que Open-Meteo,
// una salida por coordenada.
export async function pedirEra5(coords, sp, { hourly = [], current = [], ahora = Date.now(), ...opciones } = {}) {
  const eje = ejeHorario(ventanaDeConsulta(sp), ahora);
  const dias = diasNecesarios(eje);
  const puntos = coords.slice(0, MAX_PUNTOS).map((c) => celdaEra5(c.lat, c.lon));
  const rutas = new Map();
  for (const celda of puntos) for (const dia of dias) rutas.set(`pasado/${dia}/${claveCajaEra5(celda.lat, celda.lon)}.json`, null);
  if (rutas.size > MAX_FICHEROS_ERA5) {
    const e = new Error(`ERA5: ventana demasiado larga (${rutas.size} ficheros, máximo ${MAX_FICHEROS_ERA5})`);
    e.status = 400;
    throw e;
  }
  const lectura = { ...opciones, ahora, maxEdadHoras: Infinity, cacheTtl: 86400 };
  await Promise.all([...rutas.keys()].map(async (r) => rutas.set(r, await leerInstantanea(r, lectura))));

  return coords.map((c, i) => {
    const celda = puntos[i];
    const ficheros = celda ? dias.map((dia) => ({ dia, fichero: rutas.get(`pasado/${dia}/${claveCajaEra5(celda.lat, celda.lon)}.json`) })) : [];
    const serie = celda ? serieDesdeEra5(ficheros, celda) : null;
    const o = serieAOpenMeteo(serie, sp, { lat: c.lat, lon: c.lon, hourly, current, ahora });
    const faltan = ficheros.filter((f) => !f.fichero).map((f) => f.dia);
    if (!celda) o.aviso = "ERA5: demasiados puntos en una petición";
    else if (!serie) o.aviso = "ERA5: sin datos para este punto o estas fechas (ERA5 llega con ~6 días de retraso)";
    else if (faltan.length) o.aviso = `ERA5: aún sin publicar ${faltan.join(", ")} (llega con ~6 días de retraso)`;
    return o;
  });
}
