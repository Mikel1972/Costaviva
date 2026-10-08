// functions/lluvia/toma.js
// GET /lluvia/toma?t=YYYYMMDDHHMM -> paquete binario con las teselas
// comprimidas (sin tocar) de la toma de radar OPERA que cubren España y
// Portugal, para que el navegador las descomprima y pinte
// (assets/js/lluvia-animada.js). Ver functions/_lib/radar-opera.js.
//
// No es un proxy abierto: solo tomas DBZH de OPERA, de las últimas 24 h,
// y solo las teselas de VENTANA. Cada toma es inmutable: se guarda en la
// caché del edge 24 h (lo que dura en el bucket), así que el bucket recibe
// como mucho 3 peticiones por toma y zona de Cloudflare, no por usuario.
import { S3_BASE, CABECERA_BYTES, VENTANA, desdeSello, claveToma, parsearIfds, teselasVentana, empaquetar } from "../_lib/radar-opera.js";

const error = (status, reason) =>
  new Response(JSON.stringify({ error: true, reason }), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function rango(url, desde, hasta) {
  const r = await fetch(url, { headers: { range: `bytes=${desde}-${hasta}` } });
  if (r.status !== 206 && r.status !== 200) throw Object.assign(new Error(`bucket ${r.status}`), { status: r.status });
  const b = new Uint8Array(await r.arrayBuffer());
  // Si el servidor ignora el Range (200), se recorta aquí.
  return r.status === 200 ? b.subarray(desde, hasta + 1) : b;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const t = url.searchParams.get("t") || "";
  const ms = desdeSello(t);
  if (!Number.isFinite(ms) || ms > Date.now() + 5 * 60000 || ms < Date.now() - 24 * 3600000) {
    return error(400, "toma no válida");
  }
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const clave = new Request(`${url.origin}/lluvia/toma?t=${t}`, { method: "GET" });
  if (cache) {
    const c = await cache.match(clave);
    if (c) return c;
  }
  const origen = S3_BASE + claveToma(ms);
  let paquete;
  try {
    const cab = await rango(origen, 0, CABECERA_BYTES - 1);
    const info = teselasVentana(parsearIfds(cab));
    const trozos = [];
    for (const tes of info.teselas) trozos.push(tes.len ? await rango(origen, tes.off, tes.off + tes.len - 1) : new Uint8Array(0));
    paquete = empaquetar({
      t: new Date(ms).toISOString().replace(".000Z", "Z"),
      ancho: info.ancho, alto: info.alto, tw: info.tw, th: info.th, bandas: info.bandas, factor: VENTANA.factor,
      teselas: info.teselas.map(({ col, fila, len }) => ({ col, fila, len })),
    }, trozos);
  } catch (e) {
    return error(e.status === 404 || e.status === 403 ? 404 : 502, "toma de radar no disponible");
  }
  const respuesta = new Response(paquete, {
    headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=86400, immutable" },
  });
  if (cache) context.waitUntil(cache.put(clave, respuesta.clone()));
  return respuesta;
}

export function onRequest() {
  return error(405, "solo GET");
}
