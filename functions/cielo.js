// functions/cielo.js
// Nubosidad observada ahora junto a un punto: /cielo?lat=<lat>&lon=<lon>.
// Sale del METAR del aeródromo más cercano (aviationweather.gov, NOAA,
// dominio público). Ver assets/js/nubes.js. Sin clave ni datos personales.

import { elegirMetar, MAX_KM_METAR } from "../assets/js/nubes.js";

const json = (cuerpo, status = 200, maxAge = 600) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` },
  });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json({ error: "faltan lat/lon" }, 400, 0);
  }
  // Caja algo mayor que MAX_KM_METAR (1° de latitud ~ 111 km).
  const dLat = MAX_KM_METAR / 111 + 0.05;
  const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(2)).join(",");
  try {
    const r = await fetch(`https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`, {
      headers: { "User-Agent": "Costaviva (costaviva.org)" },
      cf: { cacheTtl: 600, cacheEverything: true },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 204) return json({ observado: null });
    if (!r.ok) throw new Error(`METAR ${r.status}`);
    return json({ observado: elegirMetar(await r.json(), lat, lon) });
  } catch (e) {
    return json({ observado: null, error: String(e?.message || e) }, 200, 60);
  }
}
