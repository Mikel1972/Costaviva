// functions/_lib/met-norway.js
// Adaptador de MET Norway Locationforecast 2.0 a la forma de Open-Meteo
// Forecast (2026-10-08). Fuente gratuita y válida para uso comercial: datos
// con licencia NLOD 2.0 y CC BY 4.0 (api.met.no/doc/License). Ver la sección
// "Fuentes gratuitas" de CLAUDE.md para las condiciones citadas.
//
// CONDICIONES DE USO QUE ESTE MÓDULO CUMPLE (api.met.no/doc/TermsOfService):
//   - User-Agent identificativo con contacto: "Costaviva/1.0 <contacto>",
//     con el contacto en la variable de entorno METNO_CONTACTO (una web o un
//     email de empresa, NUNCA un email personal escrito en el código). Sin
//     ella no se llama a MET Norway: "If we cannot contact you in case of
//     problems, you risk being blocked without warning".
//   - Coordenadas con 4 decimales como mucho (5+ -> 403). Aquí van a 2,
//     igual que el proxy, para compartir caché.
//   - No repetir antes de `Expires` y usar If-Modified-Since: pedirMetNorway
//     guarda la respuesta en la Cache API con su Expires y Last-Modified.
//   - Más de 20 peticiones/s en total exige acuerdo: por eso las peticiones
//     de muchos puntos (prevision.js, viento-campo.js...) NO llaman aquí punto
//     a punto, leen la instantánea que deja el workflow fuentes-gratuitas.yml.
//
// Variables (inventario de lo que usa la app, PROXY_PERMITIDO de
// open-meteo.js y las llamadas de servidor):
//   windspeed_10m / wind_speed_10m   <- wind_speed (m/s, se pasa a la unidad pedida)
//   winddirection_10m / wind_direction_10m <- wind_from_direction (°)
//   pressure_msl                     <- air_pressure_at_sea_level (hPa)
//   cloudcover / cloud_cover         <- cloud_area_fraction (%)
//   temperature_2m                   <- air_temperature (°C)
//   precipitation                    <- next_1_hours.precipitation_amount de la
//        hora ANTERIOR: en Open-Meteo `precipitation` es la suma de la hora
//        precedente; en MET, next_1_hours es la hora siguiente.
// Las horas que MET no da (más allá de ~60 h solo da cada 6 h, y nada del
// pasado) salen como null: nunca se interpola ni se inventa.

import { ejeHorario, ventanaDeConsulta, etiquetaConDesfase, horaUTC, HORA_MS } from "./eje-horario.js";

export const ATRIBUCION_MET_NORWAY = "Datos meteorológicos: MET Norway (CC BY 4.0)";
export const ATRIBUCION_MET_NORWAY_HTML =
  'Datos meteorológicos: <a href="https://www.met.no/en" target="_blank" rel="noopener">MET Norway</a> ' +
  '(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, adaptados)';

export const URL_MET_NORWAY = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

// Columnas internas de la serie compacta (también es el formato de la
// instantánea atmosfera/todos.json).
export const COLUMNAS_MET = ["p", "t", "c", "ws", "wd", "pr"];

const VARIABLES = {
  windspeed_10m: "ws", wind_speed_10m: "ws",
  winddirection_10m: "wd", wind_direction_10m: "wd",
  pressure_msl: "p",
  cloudcover: "c", cloud_cover: "c",
  temperature_2m: "t",
  precipitation: "pr1",
};
export const VARIABLES_MET_NORWAY = new Set(Object.keys(VARIABLES));

// Contacto del proyecto (Mikel, 2026-10-08): dirección de Costaviva, no
// personal; llega al buzón del proyecto por Cloudflare Email Routing.
// METNO_CONTACTO lo sustituye si se define.
export const CONTACTO_METNO_POR_DEFECTO = "datos@costaviva.org";

export function contactoMetNorway(env) {
  const v = env && typeof env.METNO_CONTACTO === "string" ? env.METNO_CONTACTO.trim() : "";
  return v || CONTACTO_METNO_POR_DEFECTO;
}

export function userAgentMetNorway(env) {
  const c = contactoMetNorway(env);
  if (!c) {
    const e = new Error("MET Norway sin configurar: falta METNO_CONTACTO (contacto del User-Agent)");
    e.codigo = "sin_configurar";
    throw e;
  }
  return `Costaviva/1.0 ${c}`;
}

// Redondeo a 0,01° (dentro del máximo de 4 decimales de MET).
const r2 = (v) => (Math.round(Number(v) * 100) / 100).toFixed(2);

export function urlMetNorway(lat, lon) {
  return `${URL_MET_NORWAY}?lat=${r2(lat)}&lon=${r2(lon)}`;
}

// JSON de Locationforecast -> serie compacta horaria en UTC:
// { inicio: ms, horas: n, p: [], t: [], c: [], ws: [], wd: [], pr: [] }
// `pr[i]` es la precipitación de la hora QUE EMPIEZA en i (next_1_hours).
export function serieDesdeMet(json) {
  const ts = json?.properties?.timeseries || [];
  const filas = [];
  for (const e of ts) {
    const ms = Date.parse(e.time);
    if (!Number.isFinite(ms)) continue;
    const d = e.data?.instant?.details || {};
    filas.push({
      ms: horaUTC(ms),
      p: d.air_pressure_at_sea_level ?? null,
      t: d.air_temperature ?? null,
      c: d.cloud_area_fraction ?? null,
      ws: d.wind_speed ?? null,
      wd: d.wind_from_direction ?? null,
      pr: e.data?.next_1_hours?.details?.precipitation_amount ?? null,
    });
  }
  if (!filas.length) return { inicio: null, horas: 0, ...Object.fromEntries(COLUMNAS_MET.map((k) => [k, []])) };
  const inicio = filas[0].ms;
  const horas = Math.round((filas[filas.length - 1].ms - inicio) / HORA_MS) + 1;
  const serie = { inicio, horas, ...Object.fromEntries(COLUMNAS_MET.map((k) => [k, new Array(horas).fill(null)])) };
  for (const f of filas) {
    const i = Math.round((f.ms - inicio) / HORA_MS);
    if (i < 0 || i >= horas) continue;
    for (const k of COLUMNAS_MET) serie[k][i] = f[k];
  }
  return serie;
}

function valorEn(serie, col, ms) {
  if (!serie || serie.inicio === null || serie.inicio === undefined) return null;
  const i = Math.round((ms - serie.inicio) / HORA_MS);
  if (i < 0 || i >= serie.horas) return null;
  const v = serie[col]?.[i];
  return v === undefined ? null : v;
}

const FACTOR_VIENTO = { kmh: 3.6, ms: 1, kn: 1.943844, mph: 2.236936 };
const UNIDAD_VIENTO = { kmh: "km/h", ms: "m/s", kn: "kn", mph: "mp/h" };
const UNIDADES = { p: "hPa", t: "°C", c: "%", wd: "°", pr1: "mm" };

const red1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

function valorVariable(serie, variable, ms, unidadViento) {
  const col = VARIABLES[variable];
  if (!col) return null;
  if (col === "pr1") return red1(valorEn(serie, "pr", ms - HORA_MS));
  const v = valorEn(serie, col, ms);
  if (v === null) return null;
  if (col === "ws") return red1(v * FACTOR_VIENTO[unidadViento]);
  if (col === "wd") return Math.round(v);
  return red1(v);
}

function unidadDe(variable, unidadViento) {
  const col = VARIABLES[variable];
  return col === "ws" ? UNIDAD_VIENTO[unidadViento] : UNIDADES[col] ?? "";
}

// Serie compacta + consulta (URLSearchParams) -> objeto con la forma de
// Open-Meteo Forecast para UNA coordenada. `hourly`/`current`: listas de
// variables a devolver (las de la consulta, o un subconjunto si otras
// variables vienen de otra fuente).
export function serieAOpenMeteo(serie, sp, { lat, lon, elevacion = null, hourly = [], current = [], ahora = Date.now() } = {}) {
  const ventana = ventanaDeConsulta(sp);
  const eje = ejeHorario(ventana, ahora);
  const unidadViento = sp.get("wind_speed_unit") || sp.get("windspeed_unit") || "kmh";
  const uv = FACTOR_VIENTO[unidadViento] ? unidadViento : "kmh";
  const salida = {
    latitude: lat === undefined ? null : Number(lat),
    longitude: lon === undefined ? null : Number(lon),
    generationtime_ms: 0,
    utc_offset_seconds: eje.utc_offset_seconds,
    timezone: eje.timezone,
    timezone_abbreviation: eje.timezone_abbreviation,
    elevation: elevacion,
  };
  if (hourly.length) {
    salida.hourly_units = { time: "iso8601" };
    salida.hourly = { time: eje.horas.map((h) => h.etiqueta) };
    for (const v of hourly) {
      salida.hourly_units[v] = unidadDe(v, uv);
      salida.hourly[v] = eje.horas.map((h) => valorVariable(serie, v, h.ms, uv));
    }
  }
  if (current.length) {
    const ms = horaUTC(ahora);
    salida.current_units = { time: "iso8601", interval: "seconds" };
    salida.current = { time: etiquetaConDesfase(ms, eje.utc_offset_seconds), interval: 3600 };
    for (const v of current) {
      salida.current_units[v] = unidadDe(v, uv);
      salida.current[v] = valorVariable(serie, v, ms, uv);
    }
  }
  return salida;
}

// Una coordenada, con caché que respeta Expires/If-Modified-Since.
// `cache`: Cache API (caches.default) o un doble en los tests; `origen`: el
// origen propio de la petición (la Cache API de Cloudflare solo guarda
// claves de su propio dominio). Sin cache/origen, pide siempre.
// Devuelve el JSON de MET tal cual.
export async function pedirMetNorway(lat, lon, { env = {}, fetchImpl = fetch, cache = null, origen = "", ahora = Date.now() } = {}) {
  const url = urlMetNorway(lat, lon);
  const ua = userAgentMetNorway(env);
  const clave = cache && origen ? new Request(`${origen}/_cache/metno?lat=${r2(lat)}&lon=${r2(lon)}`) : null;

  let guardada = null;
  if (clave) {
    const r = await cache.match(clave);
    if (r) {
      guardada = { cuerpo: await r.text(), expira: Number(r.headers.get("x-metno-expira")) || 0, lastModified: r.headers.get("x-metno-last-modified") || "" };
      if (ahora < guardada.expira) return JSON.parse(guardada.cuerpo);
    }
  }

  const headers = { "User-Agent": ua, Accept: "application/json" };
  if (guardada?.lastModified) headers["If-Modified-Since"] = guardada.lastModified;
  let resp;
  try {
    resp = await fetchImpl(url, { headers });
  } catch (e) {
    throw new Error(`MET Norway sin respuesta: ${String(e?.message || e)}`);
  }
  const expiraCabecera = Date.parse(resp.headers.get("expires") || "");
  const expira = Number.isFinite(expiraCabecera) ? expiraCabecera : ahora + 30 * 60 * 1000;

  let cuerpo;
  let lastModified = resp.headers.get("last-modified") || guardada?.lastModified || "";
  if (resp.status === 304 && guardada) {
    cuerpo = guardada.cuerpo;
  } else if (resp.ok) {
    // 203 = producto obsoleto o en beta: sigue valiendo, pero se avisa.
    if (resp.status === 203) console.warn("MET Norway devolvió 203: Locationforecast 2.0 marcado como obsoleto o beta");
    cuerpo = await resp.text();
  } else {
    const err = new Error(`MET Norway HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }

  if (clave) {
    const guardar = new Response(cuerpo, {
      headers: {
        "content-type": "application/json",
        // La frescura la decide x-metno-expira; se guarda un día para poder
        // hacer la petición condicional (If-Modified-Since) al caducar.
        "cache-control": "public, max-age=86400",
        "x-metno-expira": String(expira),
        "x-metno-last-modified": lastModified,
      },
    });
    await cache.put(clave, guardar);
  }
  return JSON.parse(cuerpo);
}

// Bilineal sobre una rejilla regular de puntos de la instantánea, para
// puntos que no son un spot (viento-campo.js pide una rejilla de 16x16). El
// viento se interpola por componentes u/v, no velocidad y dirección por
// separado. Si falta alguna esquina, se usa la más cercana disponible.
export function interpolarSerie(esquinas, pesos) {
  const validas = esquinas.map((s, i) => ({ s, w: pesos[i] })).filter((x) => x.s && x.s.inicio !== null && x.s.inicio !== undefined);
  if (!validas.length) return null;
  if (validas.length < esquinas.length) {
    validas.sort((a, b) => b.w - a.w);
    return validas[0].s;
  }
  const base = validas[0].s;
  const salida = { inicio: base.inicio, horas: base.horas, ...Object.fromEntries(COLUMNAS_MET.map((k) => [k, new Array(base.horas).fill(null)])) };
  for (let i = 0; i < base.horas; i++) {
    const ms = base.inicio + i * HORA_MS;
    let ok = true;
    const acc = { p: 0, t: 0, c: 0, pr: 0, u: 0, v: 0 };
    for (const { s, w } of validas) {
      const ws = valorEn(s, "ws", ms);
      const wd = valorEn(s, "wd", ms);
      const p = valorEn(s, "p", ms);
      if (ws === null || wd === null || p === null) { ok = false; break; }
      const rad = (wd * Math.PI) / 180;
      acc.u += w * -ws * Math.sin(rad);
      acc.v += w * -ws * Math.cos(rad);
      acc.p += w * p;
      acc.t += w * (valorEn(s, "t", ms) ?? NaN);
      acc.c += w * (valorEn(s, "c", ms) ?? NaN);
      acc.pr += w * (valorEn(s, "pr", ms) ?? NaN);
    }
    if (!ok) continue;
    salida.p[i] = acc.p;
    salida.t[i] = Number.isFinite(acc.t) ? acc.t : null;
    salida.c[i] = Number.isFinite(acc.c) ? acc.c : null;
    salida.pr[i] = Number.isFinite(acc.pr) ? acc.pr : null;
    salida.ws[i] = Math.hypot(acc.u, acc.v);
    salida.wd[i] = ((Math.atan2(-acc.u, -acc.v) * 180) / Math.PI + 360) % 360;
  }
  return salida;
}
