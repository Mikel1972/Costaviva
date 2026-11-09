// functions/_lib/nz/kiwis-waikato.js
// Caudal de ríos y nivel medido en mareógrafos de Waikato Regional Council
// (Nueva Zelanda), desde su servicio KiWIS (base WISKI de KISTERS).
// 2026-11-09.
//
// PERMISO ESCRITO (registro en Mikel1972/comun, permisos/registro.json,
// entidad `waikato-rc`, ticket REQ235947): email de Debbie Eastwood
// (2026-11-08) — "Once complied with the Creative Commons Attribution 4.0
// International Licence, this email is written consent for the use of the
// data from our Envirohub website pages". Condiciones obligatorias:
//   1. Citar a "Waikato Regional Council" como origen, con enlace a
//      https://www.waikatoregion.govt.nz y a la licencia CC BY 4.0.
//   2. Avisar de que el dato es provisional.
//   3. Pocas consultas al día: aquí, como mucho UNA petición por estación
//      cada CACHE_WAIKATO_S (2 h) y centro de datos de Cloudflare (Cache
//      API; un fallo también se guarda, 1 h, para no reintentar en bucle).
// El acceso KiWIS y los ts_path los dio Ross Jones (WRC) el 2026-11-09;
// el de Kawhia (1869/17/TideLVL/Cmd.P) llegó después, el mismo día.
//
// El servidor es http y puerto 8080. Las sesiones de Claude en la nube no
// llegan (proxy), pero Cloudflare Workers sí permite fetch a :8080. El
// parser se escribió con ejemplos del formato documentado de KiWIS
// (test/fixtures/kiwis/): FALTA COMPROBARLO EN VIVO con la primera
// respuesta real (unidades y forma exacta de `dajson`).
//
// Lógica pura + una función de red con caché inyectable (tests sin red).

import { distanciaKm, localAUtc, ZONA_NZ } from "./mareas-linz.js";

export const KIWIS_WAIKATO = "http://envdata.waikatoregion.govt.nz:8080/KiWIS/KiWIS";
export const URL_WAIKATO = "https://www.waikatoregion.govt.nz";
export const URL_LICENCIA_WAIKATO = "https://creativecommons.org/licenses/by/4.0/";
export const NOMBRE_WAIKATO = "Waikato Regional Council";
// Cita (en inglés, como la de LINZ; en la UI va traducida con enlaces).
export const ATRIBUCION_WAIKATO = "Source: Waikato Regional Council, licensed under CC BY 4.0";
export const AVISO_WAIKATO = "Provisional data: not yet quality-checked and may change.";
export const FUENTE_WAIKATO = "Waikato Regional Council (KiWIS)";

export const CACHE_WAIKATO_S = 2 * 3600;
export const CACHE_WAIKATO_FALLO_S = 3600;
// Un dato más viejo que esto no se enseña (estación parada).
export const MAX_ANTIGUEDAD_MS = 24 * 3600e3;
// Mareógrafo -> spots a esta distancia o menos llevan su nivel medido.
export const KM_MAREOGRAFO_SPOT = 20;

// Umbrales de caudal para el índice de pesca (2026-11-09, Mikel: "empieza
// por el río en el índice"). Waikato no publica umbrales oficiales como las
// confederaciones españolas, así que salen de la propia estación: la mediana
// de los últimos 30 días es "lo normal"; por debajo de la mitad, "bajo"; a
// partir del triple (una avenida tras lluvia), "alto". Heurística propia,
// documentada en la ficha del río; con 14 días de dato o más.
export const PERIODO_CAUDAL = "P30D";
export const FACTOR_BAJO = 0.5;
export const FACTOR_ALTO = 3;
export const DIAS_MIN_UMBRALES = 14;

// Coordenadas: APROXIMADAS (el mapa de Envirohub no se pudo leer y KiWIS no
// se alcanza desde la sesión). Se pueden afinar con getStationList
// (returnfields=station_latitude,station_longitude) en la primera prueba en
// vivo. `envirohub` = número de la estación en las páginas de Envirohub.
export const ESTACIONES_WAIKATO = [
  {
    clave: "waiwawa", tipo: "caudal", nombre: "Waiwawa River", estacion: "Waiwawa (WRC)",
    tsPath: "1257/2/S/Cmd.P", siteNo: "1257", stationNo: "2", envirohub: "44401",
    lat: -36.935, lon: 175.640, coordAprox: true, spotCosta: "nz-whitianga",
  },
  {
    clave: "tairua", tipo: "caudal", nombre: "Tairua River", estacion: "Tairua (WRC)",
    tsPath: "940/2/S/Cmd.P", siteNo: "940", stationNo: "2", envirohub: "42331",
    lat: -37.112, lon: 175.730, coordAprox: true, spotCosta: "nz-tairua",
  },
  {
    clave: "raglan", tipo: "marea", nombre: "Raglan", estacion: "Raglan Harbour (WRC)",
    tsPath: "857/23/TideLVL/Cmd.P", siteNo: "857", stationNo: "23", envirohub: "41959",
    lat: -37.800, lon: 174.869, coordAprox: true,
  },
  {
    clave: "whitianga", tipo: "marea", nombre: "Whitianga", estacion: "Whitianga Harbour (WRC)",
    tsPath: "1328/20/TideLVL/Cmd.P", siteNo: "1328", stationNo: "20", envirohub: "44896",
    lat: -36.831, lon: 175.709, coordAprox: true,
  },
  {
    // Muelle de Kawhia (coordenadas aproximadas, como las demás).
    clave: "kawhia", tipo: "marea", nombre: "Kawhia", estacion: "Kawhia Harbour (WRC)",
    tsPath: "1869/17/TideLVL/Cmd.P", siteNo: "1869", stationNo: "17",
    lat: -38.066, lon: 174.818, coordAprox: true,
  },
];

// URL de valores de una serie (últimas 24 h bastan: valor, tendencia y máximo).
export function urlValoresKiwis(tsPath, periodo = "P1D") {
  const p = new URLSearchParams({
    service: "kisters", type: "queryServices", request: "getTimeseriesValues",
    datasource: "0", format: "dajson", ts_path: tsPath, period: periodo,
    metadata: "true", md_returnfields: "ts_unitsymbol,station_name",
  });
  return `${KIWIS_WAIKATO}?${p}`;
}

// Hora de KiWIS -> ms UTC. Lo normal es ISO con desfase
// ("2026-11-09T10:15:00.000+13:00"). Sin desfase ("2026-11-09 10:15:00", si
// se pidiera con dateformat), se toma como hora de Auckland.
export function horaKiwis(texto) {
  const s = String(texto ?? "").trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s.replace(" ", "T"));
    return Number.isFinite(ms) ? ms : null;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return localAUtc(+m[1], +m[2], +m[3], +m[4], +m[5], ZONA_NZ) + (+(m[6] || 0)) * 1000;
}

function numero(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Respuesta de getTimeseriesValues (dajson/json o csv) ->
// { unidad, puntos: [{ t, v }] } ordenados por hora, sin huecos.
export function parsearKiwis(texto) {
  const s = String(texto ?? "").trim();
  let unidad = null;
  let filas = [];
  if (s.startsWith("[") || s.startsWith("{")) {
    let d;
    try { d = JSON.parse(s); } catch (e) { throw new Error("KiWIS: JSON ilegible"); }
    const serie = Array.isArray(d) ? d[0] : d;
    if (!serie || typeof serie !== "object") throw new Error("KiWIS: respuesta vacía");
    if (serie.type === "error" || serie.code) throw new Error(`KiWIS: ${serie.message || serie.code}`);
    unidad = serie.ts_unitsymbol || null;
    const cols = String(serie.columns || "Timestamp,Value").split(",").map((c) => c.trim());
    const iT = Math.max(0, cols.indexOf("Timestamp"));
    const iV = cols.indexOf("Value") >= 0 ? cols.indexOf("Value") : 1;
    filas = (serie.data || []).map((f) => [f[iT], f[iV]]);
  } else {
    // CSV de KiWIS: metadatos y cabecera con "#", separador ";".
    for (const linea of s.split(/\r?\n/)) {
      const l = linea.trim();
      if (!l) continue;
      if (l.startsWith("#")) {
        const [k, ...resto] = l.slice(1).split(";");
        if (k.trim() === "ts_unitsymbol") unidad = resto.join(";").trim() || null;
        continue;
      }
      const partes = l.includes(";") ? l.split(";") : l.split(",");
      filas.push([partes[0], partes[1]]);
    }
  }
  const puntos = filas
    .map(([t, v]) => ({ t: horaKiwis(t), v: numero(v) }))
    .filter((p) => p.t !== null && p.v !== null)
    .sort((a, b) => a.t - b.t);
  return { unidad, puntos };
}

// Lleva el valor a m³/s (caudal) o a metros (nivel). Si la serie no trae
// unidad, caudal en m³/s; un nivel de marea de más de 30 se toma por mm.
export function normalizarUnidad(valor, unidad, tipo) {
  const u = String(unidad || "").toLowerCase().replace(/\s/g, "");
  if (tipo === "caudal") {
    if (u === "l/s") return valor / 1000;
    return valor;
  }
  if (u === "mm") return valor / 1000;
  if (u === "cm") return valor / 100;
  if (!u && Math.abs(valor) > 30) return valor / 1000;
  return valor;
}

// Serie -> lo que se enseña: último valor, su hora, tendencia de la última
// hora y, en ríos, el máximo de 24 h. null si no hay dato reciente.
export function resumenSerie(serie, tipo, ahora = Date.now()) {
  const puntos = (serie?.puntos || []).filter((p) => p.t <= ahora + 15 * 60e3);
  if (!puntos.length) return null;
  const ult = puntos[puntos.length - 1];
  if (ahora - ult.t > MAX_ANTIGUEDAD_MS) return null;
  const val = (p) => normalizarUnidad(p.v, serie.unidad, tipo);
  const valor = val(ult);
  // Punto de referencia: el más reciente con al menos 45 min de antigüedad.
  const ref = [...puntos].reverse().find((p) => ult.t - p.t >= 45 * 60e3 && ult.t - p.t <= 3 * 3600e3);
  let tendencia = null;
  if (ref) {
    const dif = valor - val(ref);
    const umbral = tipo === "caudal" ? Math.max(0.05 * Math.abs(val(ref)), 0.01) : 0.02;
    tendencia = dif > umbral ? "sube" : dif < -umbral ? "baja" : "estable";
  }
  const decimales = tipo === "caudal" ? (valor < 10 ? 2 : 1) : 2;
  const redondear = (x) => +x.toFixed(decimales);
  const out = {
    valor: redondear(valor),
    unidad: tipo === "caudal" ? "m³/s" : "m",
    hora: new Date(ult.t).toISOString(),
    tendencia,
    provisional: true,
  };
  if (tipo === "caudal") {
    const dia = puntos.filter((p) => ult.t - p.t <= 24 * 3600e3).map(val);
    out.max24h = redondear(Math.max(...dia));
    Object.assign(out, umbralesCaudal(puntos.map((p) => ({ t: p.t, v: val(p) })), redondear));
  }
  return out;
}

// Mediana de los últimos 30 días -> { mediana30d, umbralBajo, umbralAlto,
// umbralesFuente } o {} si hay menos de DIAS_MIN_UMBRALES días de dato.
export function umbralesCaudal(puntos, redondear = (x) => +x.toFixed(2)) {
  if (puntos.length < 2) return {};
  const dias = (puntos[puntos.length - 1].t - puntos[0].t) / 864e5;
  if (dias < DIAS_MIN_UMBRALES) return {};
  const v = puntos.map((p) => p.v).filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (!v.length) return {};
  const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  if (!(m > 0)) return {};
  return {
    mediana30d: redondear(m),
    umbralBajo: redondear(m * FACTOR_BAJO),
    umbralAlto: redondear(m * FACTOR_ALTO),
    umbralesFuente: "mediana_30d",
  };
}

// Ficha pública de una estación (sin ts_path ni URL del servidor).
function fichaEstacion(e) {
  const f = { nombre: e.nombre, estacion: e.estacion, lat: e.lat, lon: e.lon, tipo: e.tipo, zona: ZONA_NZ, coordAprox: Boolean(e.coordAprox) };
  // Spot de la desembocadura (el mapa no lleva slugs de NZ escritos a mano).
  if (e.spotCosta) f.spotCosta = e.spotCosta;
  return f;
}

// Una estación, con caché: como mucho una petición cada CACHE_WAIKATO_S.
async function datosEstacion(e, { fetchFn, cache, origen, ahora }) {
  const clave = cache && origen ? new Request(`${origen}/__cache/kiwis-waikato/${e.clave}`) : null;
  if (clave) {
    const guardada = await cache.match(clave).catch(() => undefined);
    if (guardada) return guardada.json();
  }
  let resultado, maxAge;
  try {
    const opciones = { headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" } };
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opciones.signal = AbortSignal.timeout(8000);
    const resp = await fetchFn(urlValoresKiwis(e.tsPath, e.tipo === "caudal" ? PERIODO_CAUDAL : "P1D"), opciones);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const resumen = resumenSerie(parsearKiwis(await resp.text()), e.tipo, ahora);
    resultado = resumen ? { ...fichaEstacion(e), ...resumen } : { ...fichaEstacion(e), error: "sin dato reciente" };
    maxAge = CACHE_WAIKATO_S;
  } catch (err) {
    resultado = { ...fichaEstacion(e), error: String(err?.message || err) };
    maxAge = CACHE_WAIKATO_FALLO_S;
  }
  if (clave) {
    const r = new Response(JSON.stringify(resultado), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
    });
    await cache.put(clave, r).catch(() => {});
  }
  return resultado;
}

// Las 5 estaciones: { caudales: { waiwawa, tairua }, nivelesMarea: { raglan,
// whitianga, kawhia } }. Nunca lanza: una estación caída sale con `error`.
export async function datosWaikato({
  fetchFn = globalThis.fetch, cache = globalThis.caches?.default, origen = null, ahora = Date.now(),
  estaciones = ESTACIONES_WAIKATO,
} = {}) {
  const res = await Promise.all(estaciones.map((e) =>
    datosEstacion(e, { fetchFn, cache, origen, ahora }).catch((err) => ({ ...fichaEstacion(e), error: String(err) }))
  ));
  const caudales = {}, nivelesMarea = {};
  estaciones.forEach((e, i) => { (e.tipo === "caudal" ? caudales : nivelesMarea)[e.clave] = res[i]; });
  return { caudales, nivelesMarea };
}

// Mareógrafo con dato más cercano a un spot (≤ KM_MAREOGRAFO_SPOT), o null.
export function mareografoDeSpot(spot, nivelesMarea, estaciones = ESTACIONES_WAIKATO) {
  let mejor = null;
  for (const e of estaciones) {
    if (e.tipo !== "marea") continue;
    const d = nivelesMarea?.[e.clave];
    if (!d || d.error || !Number.isFinite(d.valor)) continue;
    const km = distanciaKm(spot.lat, spot.lon, e.lat, e.lon);
    if (km <= KM_MAREOGRAFO_SPOT && (!mejor || km < mejor.km)) mejor = { ...d, clave: e.clave, km: +km.toFixed(1) };
  }
  return mejor;
}

// Bloque de atribución que manda /prevision?region=nz.
export const ATRIBUCION_WAIKATO_DATOS = {
  nombre: NOMBRE_WAIKATO, url: URL_WAIKATO, licencia: URL_LICENCIA_WAIKATO,
  texto: ATRIBUCION_WAIKATO, aviso: AVISO_WAIKATO,
};
