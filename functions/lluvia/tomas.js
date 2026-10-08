// functions/lluvia/tomas.js
// GET /lluvia/tomas -> { tomas: ["2026-10-08T10:35:00Z", ...], ultima }
// Tomas de radar EUMETNET OPERA de las últimas 3 h (una cada 5 min), leídas
// del listado del bucket público de 24 h. Ver functions/_lib/radar-opera.js.
// Caché del edge de 60 s: como mucho una consulta al bucket por minuto y
// por zona de Cloudflare, y una toma nueva tarda <= 1 min en aparecer.
import { S3_BASE, prefijosDia, parsearListado, tomasVentana } from "../_lib/radar-opera.js";

const json = (cuerpo, status, extra = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json; charset=utf-8", ...extra } });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const clave = new Request(`${url.origin}/lluvia/tomas`, { method: "GET" });
  if (cache) {
    const c = await cache.match(clave);
    if (c) return c;
  }
  let horas = [];
  try {
    for (const prefijo of prefijosDia(Date.now())) {
      const r = await fetch(`${S3_BASE}?list-type=2&prefix=${encodeURIComponent(prefijo)}`);
      if (!r.ok) throw new Error(`listado ${r.status}`);
      horas.push(...parsearListado(await r.text()));
    }
  } catch (e) {
    return json({ error: true, reason: "Radar no disponible ahora mismo" }, 502, { "cache-control": "no-store" });
  }
  horas = [...new Set(horas)].sort((a, b) => a - b);
  const tomas = tomasVentana(horas).map((t) => new Date(t).toISOString().replace(".000Z", "Z"));
  const respuesta = json(
    { fuente: "EUMETNET OPERA", licencia: "CC BY 4.0", tomas, ultima: tomas[tomas.length - 1] || null },
    200,
    { "cache-control": "public, max-age=30" }
  );
  if (cache && tomas.length) {
    const guardar = new Response(respuesta.clone().body, respuesta);
    guardar.headers.set("cache-control", "public, max-age=60");
    context.waitUntil(cache.put(clave, guardar));
  }
  return respuesta;
}

export function onRequest() {
  return json({ error: true, reason: "solo GET" }, 405, { allow: "GET" });
}
