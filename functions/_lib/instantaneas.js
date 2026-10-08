// functions/_lib/instantaneas.js
// Lectura de las instantáneas que deja el workflow fuentes-gratuitas.yml en
// Supabase Storage (bucket público "fuentes-gratuitas"), 2026-10-08.
//
// Por qué instantáneas y no llamadas en vivo:
//   - Copernicus Marine no tiene una API de "un punto, ahora": se descarga el
//     modelo IBI con el toolbox (Python, con cuenta) una o dos veces al día.
//   - MET Norway pide no pasar de 20 peticiones/s en total y prevision.js
//     necesita 105 spots en una sola invocación; además las Pages Functions
//     del plan gratuito cortan a los 50 subrequests. Así que las peticiones
//     de muchos puntos leen una instantánea y solo el proxy del navegador
//     (un punto) llama a MET en vivo.
//
// Son datos públicos de previsión (ningún dato de usuarios), por eso el
// bucket es público de lectura; solo el workflow escribe (service_role).

export const BASE_INSTANTANEAS_DEFECTO =
  "https://imncbmizxkorotpeisic.supabase.co/storage/v1/object/public/fuentes-gratuitas";

// Más vieja que esto, no se sirve: mejor un error visible que una previsión
// de hace días con aspecto de actual.
export const MAX_EDAD_HORAS = 36;

export function baseInstantaneas(env) {
  const v = env && typeof env.FUENTES_GRATUITAS_URL === "string" ? env.FUENTES_GRATUITAS_URL.trim() : "";
  return (v || BASE_INSTANTANEAS_DEFECTO).replace(/\/+$/, "");
}

// Memoria por isolate (5 min): evita volver a bajar y parsear el mismo JSON
// en cada petición. Encima, la caché del edge de Cloudflare (cf.cacheTtl).
const memoria = new Map();
const MEMORIA_MS = 5 * 60 * 1000;

export function vaciarMemoriaInstantaneas() {
  memoria.clear();
}

// Devuelve el JSON, o null si no existe (404). Lanza si está caducada o si
// el almacén falla. `maxEdadHoras`: Infinity para datos del pasado (ERA5),
// que no caducan; `cacheTtl`: segundos en la caché del edge.
export async function leerInstantanea(ruta, { env = {}, fetchImpl = fetch, ahora = Date.now(), maxEdadHoras = MAX_EDAD_HORAS, cacheTtl = 900 } = {}) {
  const url = `${baseInstantaneas(env)}/${ruta}`;
  const m = memoria.get(url);
  if (m && ahora - m.t < MEMORIA_MS) return comprobarEdad(m.datos, ruta, ahora, maxEdadHoras);
  let resp;
  try {
    resp = await fetchImpl(url, { cf: { cacheTtl, cacheEverything: true } });
  } catch (e) {
    throw new Error(`instantánea ${ruta} sin respuesta: ${String(e?.message || e)}`);
  }
  if (resp.status === 404 || resp.status === 400) {
    memoria.set(url, { t: ahora, datos: null });
    return null;
  }
  if (!resp.ok) {
    const err = new Error(`instantánea ${ruta} HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const datos = await resp.json();
  memoria.set(url, { t: ahora, datos });
  return comprobarEdad(datos, ruta, ahora, maxEdadHoras);
}

function comprobarEdad(datos, ruta, ahora, maxEdadHoras = MAX_EDAD_HORAS) {
  if (!datos) return null;
  if (maxEdadHoras === Infinity) return datos;
  const t = Date.parse(datos.generado_en || "");
  if (!Number.isFinite(t) || ahora - t > maxEdadHoras * 3600 * 1000) {
    const err = new Error(`instantánea ${ruta} caducada (generada ${datos.generado_en || "?"})`);
    err.codigo = "caducada";
    throw err;
  }
  return datos;
}

// Distancia en km (haversine).
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Mismo punto (spot) si coincide a ~0,006° (las coordenadas llegan con 3-4
// decimales desde SPOTS, o redondeadas a 0,01 por el proxy).
export function mismoPunto(a, b) {
  return Math.abs(a.lat - b.lat) <= 0.006 && Math.abs(a.lon - b.lon) <= 0.006;
}
