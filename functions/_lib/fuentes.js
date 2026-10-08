// functions/_lib/fuentes.js
// Interruptor de fuente POR VARIABLE (2026-10-08) entre Open-Meteo y las
// fuentes gratuitas válidas para uso comercial: MET Norway (atmósfera) y
// Copernicus Marine IBI (mar).
//
// POR QUÉ: Costaviva tiene suscripciones de pago, y la API gratuita de
// Open-Meteo es solo para uso no comercial. Mikel aprobó ("por ahora
// gratis") montar las fuentes gratuitas EN PARALELO, compararlas contra las
// boyas de Puertos del Estado (scripts/fuentes/comparar-boyas.mjs) y cambiar
// variable a variable solo después de ver la comparativa.
//
// POR DEFECTO TODO SIGUE EN OPEN-METEO: sin variables de entorno, la llamada
// es exactamente la de siempre (pedirOpenMeteo con OPEN_METEO_API_KEY).
//
// Variables de entorno (Cloudflare Pages, Production y Preview van por
// separado, y hace falta redeploy; en GitHub Actions, variables del repo):
//   FUENTE_ATMOSFERA = openmeteo | metno         (todas las de /forecast)
//   FUENTE_MAR       = openmeteo | copernicus    (todas las de /marine)
//   y, por encima de esas, por grupo de variables:
//   FUENTE_VIENTO, FUENTE_PRESION, FUENTE_NUBES_LLUVIA, FUENTE_TEMPERATURA
//   FUENTE_OLEAJE, FUENTE_TEMP_AGUA, FUENTE_MAREA, FUENTE_CORRIENTE
// Un valor que no se entiende cuenta como openmeteo (y se avisa en el log).
//
// Cada respuesta lleva `fuentes_datos` (lista de fuentes usadas) para que la
// página muestre la atribución CC BY / Copernicus de lo que de verdad pinta.

import { pedirOpenMeteo, claveOpenMeteo, ATRIBUCION_OPEN_METEO } from "./open-meteo.js";
import {
  pedirMetNorway, serieDesdeMet, serieAOpenMeteo, interpolarSerie,
  VARIABLES_MET_NORWAY, ATRIBUCION_MET_NORWAY, ATRIBUCION_MET_NORWAY_HTML,
} from "./met-norway.js";
import { pedirCopernicusMar, VARIABLES_COPERNICUS, ATRIBUCION_COPERNICUS, ATRIBUCION_COPERNICUS_HTML } from "./copernicus-mar.js";
import { leerInstantanea, mismoPunto } from "./instantaneas.js";

export const GRUPOS = {
  forecast: {
    viento: ["windspeed_10m", "wind_speed_10m", "winddirection_10m", "wind_direction_10m"],
    presion: ["pressure_msl"],
    nubes_lluvia: ["cloudcover", "cloud_cover", "precipitation"],
    temperatura: ["temperature_2m"],
  },
  marine: {
    oleaje: ["wave_height", "wave_direction", "wave_period", "wave_peak_period"],
    temp_agua: ["sea_surface_temperature"],
    marea: ["sea_level_height_msl"],
    corriente: ["ocean_current_velocity", "ocean_current_direction"],
  },
};

const FUENTES_VALIDAS = { forecast: new Set(["openmeteo", "metno"]), marine: new Set(["openmeteo", "copernicus"]) };
const VARIABLE_GENERAL = { forecast: "FUENTE_ATMOSFERA", marine: "FUENTE_MAR" };

export const ATRIBUCIONES = {
  openmeteo: ATRIBUCION_OPEN_METEO,
  metno: ATRIBUCION_MET_NORWAY,
  copernicus: `Datos de mar: ${ATRIBUCION_COPERNICUS}`,
};
export const ATRIBUCIONES_HTML = {
  openmeteo:
    'Datos meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> ' +
    '(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)',
  metno: ATRIBUCION_MET_NORWAY_HTML,
  copernicus: ATRIBUCION_COPERNICUS_HTML,
};

function leerFuente(env, nombre, api) {
  const v = env && typeof env[nombre] === "string" ? env[nombre].trim().toLowerCase() : "";
  if (!v) return null;
  if (FUENTES_VALIDAS[api].has(v)) return v;
  console.warn(`${nombre}=${v} no es una fuente válida para ${api}; se usa openmeteo`);
  return "openmeteo";
}

// Fuente de cada variable según las variables de entorno.
export function fuenteDeVariable(api, variable, env = {}) {
  const grupos = GRUPOS[api];
  if (!grupos) return "openmeteo";
  for (const [grupo, vars] of Object.entries(grupos)) {
    if (vars.includes(variable)) {
      const f = leerFuente(env, `FUENTE_${grupo.toUpperCase()}`, api);
      if (f) return f;
      break;
    }
  }
  return leerFuente(env, VARIABLE_GENERAL[api], api) || "openmeteo";
}

// Firma corta de las fuentes en uso para una API (para la clave de caché del
// proxy). "" si todo va por Open-Meteo, así la clave no cambia en producción.
export function firmaFuentes(api, env = {}) {
  const grupos = GRUPOS[api];
  if (!grupos) return "";
  const partes = Object.keys(grupos).map((g) => `${g}:${fuenteDeVariable(api, grupos[g][0], env)}`);
  return partes.every((p) => p.endsWith(":openmeteo")) ? "" : partes.join(",");
}

function listaVars(sp, tipo) {
  const v = sp.get(tipo);
  return v ? v.split(",").filter(Boolean) : [];
}

function coordenadas(sp) {
  const lats = (sp.get("latitude") || "").split(",");
  const lons = (sp.get("longitude") || "").split(",");
  if (!lats[0] || lats.length !== lons.length) throw new Error("latitude/longitude no cuadran");
  return lats.map((la, i) => ({ lat: Number(la), lon: Number(lons[i]) }));
}

function consultaCon(sp, hourly, current) {
  const copia = new URLSearchParams(sp);
  copia.delete("hourly");
  copia.delete("current");
  if (hourly.length) copia.set("hourly", hourly.join(","));
  if (current.length) copia.set("current", current.join(","));
  // Las comas de latitude=a,b,c tal cual, como hacía la app.
  return copia.toString().replace(/%2C/gi, ",");
}

// --- MET Norway: un punto en vivo, varios desde la instantánea -------------

async function seriesMetNorway(coords, opciones) {
  if (coords.length === 1) {
    const json = await pedirMetNorway(coords[0].lat, coords[0].lon, opciones);
    return [{ serie: serieDesdeMet(json), elevacion: json?.geometry?.coordinates?.[2] ?? null }];
  }
  const inst = await leerInstantanea("atmosfera/todos.json", opciones);
  if (!inst) throw new Error("instantánea de MET Norway no disponible (atmosfera/todos.json)");
  const porId = new Map((inst.puntos || []).map((p) => [p.id, p]));
  const paso = inst.rejilla?.paso || 1;
  return coords.map((c) => {
    const spot = (inst.puntos || []).find((p) => p.tipo === "spot" && mismoPunto(p, c));
    if (spot) return { serie: spot.serie, elevacion: spot.elevacion ?? null };
    const la0 = Math.floor(c.lat / paso) * paso;
    const lo0 = Math.floor(c.lon / paso) * paso;
    const fy = (c.lat - la0) / paso;
    const fx = (c.lon - lo0) / paso;
    const id = (la, lo) => `r${+la.toFixed(3)}_${+lo.toFixed(3)}`;
    const esquinas = [id(la0, lo0), id(la0, lo0 + paso), id(la0 + paso, lo0), id(la0 + paso, lo0 + paso)]
      .map((k) => porId.get(k)?.serie || null);
    const pesos = [(1 - fy) * (1 - fx), (1 - fy) * fx, fy * (1 - fx), fy * fx];
    return { serie: interpolarSerie(esquinas, pesos), elevacion: null };
  });
}

async function pedirAdaptador(api, fuente, coords, sp, hourly, current, opciones) {
  if (api === "forecast" && fuente === "metno") {
    const series = await seriesMetNorway(coords, opciones);
    return coords.map((c, i) =>
      serieAOpenMeteo(series[i].serie, sp, { lat: c.lat, lon: c.lon, elevacion: series[i].elevacion, hourly, current, ahora: opciones.ahora })
    );
  }
  if (api === "marine" && fuente === "copernicus") {
    return pedirCopernicusMar(coords, sp, { ...opciones, hourly, current });
  }
  throw new Error(`fuente ${fuente} no disponible para ${api}`);
}

// Mezcla las variables de `otra` en `base` (misma coordenada). Las horas se
// casan por etiqueta, no por índice.
function mezclar(base, otra, hourly, current) {
  if (hourly.length && otra.hourly) {
    base.hourly ||= { time: otra.hourly.time };
    base.hourly_units ||= { time: "iso8601" };
    const idx = new Map(otra.hourly.time.map((t, i) => [t, i]));
    for (const v of hourly) {
      base.hourly[v] = base.hourly.time.map((t) => (idx.has(t) ? otra.hourly[v][idx.get(t)] : null));
      base.hourly_units[v] = otra.hourly_units?.[v] ?? "";
    }
  }
  if (current.length && otra.current) {
    base.current ||= { time: otra.current.time, interval: otra.current.interval };
    base.current_units ||= { time: "iso8601", interval: "seconds" };
    for (const v of current) {
      base.current[v] = otra.current[v] ?? null;
      base.current_units[v] = otra.current_units?.[v] ?? "";
    }
  }
  if (otra.aviso) base.aviso = otra.aviso;
}

// Sustituto de pedirOpenMeteo(api, consulta, { apiKey }) que respeta los
// interruptores. Opciones: env (obligatorio para leer interruptores y
// claves), fetchImpl, ahora, cache + origen (caché de MET en el proxy).
export async function pedirDatosMeteo(api, consulta, { env = {}, fetchImpl = fetch, ahora = Date.now(), cache = null, origen = "" } = {}) {
  const qs = typeof consulta === "string" ? consulta.replace(/^\?/, "") : new URLSearchParams(consulta).toString();
  const sp = new URLSearchParams(qs);
  const hourly = listaVars(sp, "hourly");
  const current = listaVars(sp, "current");

  // Reparto de variables por fuente.
  const reparto = new Map();
  for (const [tipo, vars] of [["hourly", hourly], ["current", current]]) {
    for (const v of vars) {
      const f = fuenteDeVariable(api, v, env);
      if (!reparto.has(f)) reparto.set(f, { hourly: [], current: [] });
      reparto.get(f)[tipo].push(v);
    }
  }

  const soloOpenMeteo = !GRUPOS[api] || reparto.size === 0 || (reparto.size === 1 && reparto.has("openmeteo"));
  if (soloOpenMeteo) {
    // Exactamente lo de siempre (producción hoy).
    const datos = await pedirOpenMeteo(api, qs, { apiKey: claveOpenMeteo(env), fetchImpl });
    for (const o of Array.isArray(datos) ? datos : [datos]) if (o && typeof o === "object") o.fuentes_datos = ["openmeteo"];
    return datos;
  }

  const coords = coordenadas(sp);
  const opciones = { env, fetchImpl, ahora, cache, origen };
  const partes = await Promise.all(
    [...reparto.entries()].map(async ([fuente, vars]) => {
      if (fuente === "openmeteo") {
        const d = await pedirOpenMeteo(api, consultaCon(sp, vars.hourly, vars.current), { apiKey: claveOpenMeteo(env), fetchImpl });
        return { fuente, vars, lista: Array.isArray(d) ? d : [d] };
      }
      return { fuente, vars, lista: await pedirAdaptador(api, fuente, coords, sp, vars.hourly, vars.current, opciones) };
    })
  );

  // Base: la respuesta de Open-Meteo si la hay (su eje y metadatos), si no la
  // primera fuente.
  partes.sort((a, b) => (a.fuente === "openmeteo" ? -1 : b.fuente === "openmeteo" ? 1 : 0));
  const [primera, ...resto] = partes;
  const salida = primera.lista.map((o) => ({ ...o, fuentes_datos: [primera.fuente] }));
  for (const p of resto) {
    salida.forEach((o, i) => {
      if (p.lista[i]) mezclar(o, p.lista[i], p.vars.hourly, p.vars.current);
      if (!o.fuentes_datos.includes(p.fuente)) o.fuentes_datos.push(p.fuente);
    });
  }
  return coords.length === 1 ? salida[0] : salida;
}

// Fuentes usadas en una respuesta (objeto o array), para la atribución.
export function fuentesUsadas(datos) {
  const s = new Set();
  for (const o of Array.isArray(datos) ? datos : [datos]) for (const f of o?.fuentes_datos || []) s.add(f);
  return [...s];
}
