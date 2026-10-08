// functions/meteo/[api].js
// Proxy público de Open-Meteo para el navegador: /meteo/forecast?... y
// /meteo/marine?... (2026-10-08).
//
// Por qué: Costaviva es comercial (suscripciones) y Open-Meteo de pago da una
// API key que NO puede llegar al navegador. index.html y diario.html piden
// aquí lo mismo que antes pedían directamente a Open-Meteo; este endpoint
// valida, redondea, cachea y reenvía con la key (si existe el secret
// OPEN_METEO_API_KEY) o al host gratuito (si no). Ver functions/_lib/open-meteo.js.
//
// No es un proxy abierto: solo las APIs, parámetros y variables de
// PROXY_PERMITIDO, una sola coordenada, ventanas de fechas acotadas. El resto
// -> 400 sin llamar a nadie.
//
// Caché: la Cache API del edge (caches.default), no solo la cabecera
// cache-control — en una Pages Function la cabecera sola NO cachea en
// Cloudflare (descubierto en real con /prevision, 2026-09-14). La clave es la
// consulta canónica con coordenadas a 0,01°, así que usuarios cercanos
// comparten una única llamada a Open-Meteo durante 30 min (forecast) o 60 min
// (marine); 24 h si la consulta es entera de días pasados. Los errores no se
// cachean, para no congelar un 429 de Open-Meteo.
//
// Fuentes gratuitas (2026-10-08): con FUENTE_ATMOSFERA/FUENTE_MAR (o por
// grupo, ver functions/_lib/fuentes.js) algunas variables salen de MET Norway
// o de Copernicus Marine con la misma forma. La firma de fuentes entra en la
// clave de caché (vacía si todo va por Open-Meteo: la clave no cambia).
import { validarConsultaProxy, claveCacheProxy } from "../_lib/open-meteo.js";
import { pedirDatosMeteo, firmaFuentes } from "../_lib/fuentes.js";

function json(cuerpo, status, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const api = String(params.api || "");
  const url = new URL(request.url);

  const v = validarConsultaProxy(api, url.searchParams);
  if (!v.ok) return json({ error: true, reason: v.error }, 400, { "cache-control": "no-store" });

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const firma = firmaFuentes(api, env);
  const consultaCache = firma ? `${v.consulta}&fuentes=${encodeURIComponent(firma)}` : v.consulta;
  const cacheKey = new Request(claveCacheProxy(url.origin, api, consultaCache), { method: "GET" });
  if (cache) {
    const cacheada = await cache.match(cacheKey);
    if (cacheada) return cacheada;
  }

  let datos;
  try {
    datos = await pedirDatosMeteo(api, v.consulta, { env, cache, origen: url.origin });
  } catch (e) {
    // El mensaje ya viene sin la key (pedirOpenMeteo), pero al navegador solo
    // le llega el código: no necesita la URL de arriba.
    const status = e.status === 429 ? 503 : 502;
    return json({ error: true, reason: `Datos meteorológicos no disponibles (${e.status || e.codigo || "red"})` }, status, {
      "cache-control": "no-store",
      ...(status === 503 ? { "retry-after": "300" } : {}),
    });
  }

  const respuesta = json(datos, 200, { "cache-control": `public, max-age=${v.ttlSeg}` });
  if (cache) context.waitUntil(cache.put(cacheKey, respuesta.clone()));
  return respuesta;
}

export function onRequest() {
  return json({ error: true, reason: "solo GET" }, 405, { allow: "GET" });
}
