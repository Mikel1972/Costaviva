// functions/rayos-cerca.js
// Rayos en TIEMPO REAL alrededor de un punto, vía Vaisala Xweather
// (2026-10-03, pedido del usuario: "con tanto retraso no vale, necesitamos
// tiempo real"). GET /rayos-cerca?lat=..&lon=..
//
// Por qué Xweather: Blitzortung/LightningMaps prohíben el uso comercial
// (Costaviva es de pago) y la capa gratuita de EUMETSAT llega con ~15 min de
// retraso. Xweather da cada rayo de los últimos 5 min con segundos de retraso.
//
// Coste: cada consulta de rayos cuesta 0,006 $ y solo las primeras 1.500 del
// mes son gratis. El usuario eligió no pasar de lo gratuito, así que:
//   - Se consulta solo cuando alguien mira una zona (el mapa lo pide al
//     acercarse, nunca en segundo plano ni para toda la costa).
//   - Celda de 0,5° compartida y guardada 60 s en rayos_xweather_cache: el
//     punto consultado es el centro de la celda, con 100 km de radio, así que
//     la cubre de sobra.
//   - Antes de llamar se reserva la consulta en rayos_xweather_uso
//     (reservar_consulta_rayos, atómico). Al llegar a LIMITE_MENSUAL responde
//     {fuente:"limite"} y el mapa vuelve a EUMETSAT.
//   - Solo para usuarios con sesión: nadie de fuera puede gastar el cupo.
//
// Necesita XWEATHER_CLIENT_ID y XWEATHER_CLIENT_SECRET (Cloudflare Pages) y
// SUPABASE_SERVICE_ROLE_KEY. Sin ellas responde {fuente:"no_configurado"} y
// la app sigue con EUMETSAT: nunca rompe el mapa.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";
// 1.500 gratis al mes; se deja margen por si alguna llamada se reintenta.
export const LIMITE_MENSUAL = 1400;
const VIGENCIA_CACHE_MS = 60 * 1000;
const TAM_CELDA = 0.5;

function json(status, cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Centro de la celda de 0,5° que contiene el punto. Exportada para el test.
export function celdaDe(lat, lon) {
  const c = (v) => (Math.floor(v / TAM_CELDA) * TAM_CELDA + TAM_CELDA / 2).toFixed(2);
  return { lat: c(lat), lon: c(lon), clave: `${c(lat)},${c(lon)}` };
}

// Respuesta de Xweather -> lista mínima para el mapa. Exportada para el test.
// "warn_no_data" no es un error: significa que no hay rayos en la zona.
export function rayosDesdeXweather(cuerpo) {
  if (!cuerpo?.success && cuerpo?.error?.code !== "warn_no_data") {
    throw new Error(`Xweather: ${cuerpo?.error?.code || "respuesta no válida"}`);
  }
  return (cuerpo.response || [])
    .filter((r) => r?.loc && Number.isFinite(r.loc.lat) && Number.isFinite(r.loc.long))
    .map((r) => ({
      lat: r.loc.lat,
      lon: r.loc.long,
      ts: r.ob?.timestamp ?? null,
      tipo: r.ob?.pulse?.type || null, // "cg" nube-tierra, "ic" dentro de la nube
    }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json(400, { error: "lat/lon no válidos" });
  }

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "falta sesión" });
  const verif = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!verif.ok) return json(401, { error: "sesión no válida" });

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.XWEATHER_CLIENT_ID || !env.XWEATHER_CLIENT_SECRET || !serviceKey) {
    return json(200, { fuente: "no_configurado", rayos: [] });
  }
  const cab = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const celda = celdaDe(lat, lon);

  try {
    const enCache = await fetch(
      `${SUPABASE_URL}/rest/v1/rayos_xweather_cache?celda=eq.${encodeURIComponent(celda.clave)}&select=datos,consultado_en`,
      { headers: cab }
    );
    const fila = enCache.ok ? (await enCache.json())[0] : null;
    if (fila && Date.now() - new Date(fila.consultado_en).getTime() < VIGENCIA_CACHE_MS) {
      return json(200, { fuente: "xweather", consultado_en: fila.consultado_en, centro: celda, rayos: fila.datos });
    }

    const reserva = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reservar_consulta_rayos`, {
      method: "POST",
      headers: cab,
      body: JSON.stringify({ p_limite: LIMITE_MENSUAL }),
    });
    if (!reserva.ok) throw new Error(`reserva HTTP ${reserva.status}`);
    if ((await reserva.json()) !== true) return json(200, { fuente: "limite", rayos: [] });

    const xw = await fetch(
      `https://data.api.xweather.com/lightning/closest?p=${celda.lat},${celda.lon}&radius=100km&limit=500` +
        `&client_id=${encodeURIComponent(env.XWEATHER_CLIENT_ID)}&client_secret=${encodeURIComponent(env.XWEATHER_CLIENT_SECRET)}`
    );
    const rayos = rayosDesdeXweather(await xw.json());
    const ahora = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/rayos_xweather_cache?on_conflict=celda`, {
      method: "POST",
      headers: { ...cab, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ celda: celda.clave, datos: rayos, consultado_en: ahora }),
    });
    return json(200, { fuente: "xweather", consultado_en: ahora, centro: celda, rayos });
  } catch (e) {
    // El detalle va al log, nunca a la respuesta: la URL lleva las claves.
    console.error(`rayos-cerca: ${String(e).replace(/client_secret=[^&\s]+/g, "client_secret=***")}`);
    return json(200, { fuente: "error", rayos: [] });
  }
}
