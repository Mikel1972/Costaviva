// scripts/camaras/apis-externas.mjs
// Salud de las cámaras de terceros que solo enlazamos (2026-11-08, Mikel:
// "mejora el robot de cámaras"). Comprobar que la página responde no basta:
//  - un directo de YouTube terminado sigue dando 200 en oembed;
//  - la página de una cámara de Windy da 200 aunque la cámara esté apagada o
//    lleve días con la misma imagen.
// Con las claves que ya existen (YOUTUBE_API_KEY, WINDY_WEBCAMS_KEY) se
// pregunta a su API, UNA llamada por pasada para todas (YouTube: 1 unidad
// por 50 vídeos; Windy: una petición). Sin clave, todo sigue como antes.
// Sin IA. Lo puro, con test en test/apis-externas.test.js.

// Días sin imagen nueva en Windy para darla por congelada.
export const DIAS_WINDY_CONGELADA = 2;

// Respuesta de videos.list -> Map(id -> "live" | "upcoming" | "none").
export function estadoYoutube(respuesta) {
  return new Map((respuesta?.items || []).map((v) => [v.id, v.snippet?.liveBroadcastContent || "none"]));
}

// Respuesta de /webcams?webcamIds=... -> Map(id -> { status, ultima }).
export function estadoWindy(respuesta) {
  return new Map((respuesta?.webcams || []).map((w) => [String(w.webcamId), { status: w.status, ultima: w.lastUpdatedOn || null }]));
}

// Corrige el resultado de la comprobación HTTP con lo que dice la API.
// `bruto` es { ok, motivo?, noVerificable? } de resultadoComprobacionExterna.
export function ajustarConApis(camara, bruto, { youtube, windy } = {}, ahoraMs = Date.now()) {
  if (camara.youtube_id && youtube) {
    const e = youtube.get(camara.youtube_id);
    if (e === undefined) return { ok: false, motivo: "youtube_no_existe" };
    if (e !== "live") return { ok: false, motivo: "youtube_sin_directo" };
    return { ok: true };
  }
  const windyId = camara.windy_id ?? String(camara.url || "").match(/windy\.com\/webcams\/(\d+)/)?.[1];
  if (windyId && windy) {
    const e = windy.get(String(windyId));
    if (!e) return { ok: false, motivo: "windy_no_existe" };
    if (e.status && e.status !== "active") return { ok: false, motivo: "windy_inactiva" };
    const t = Date.parse(e.ultima || "");
    if (Number.isFinite(t) && ahoraMs - t > DIAS_WINDY_CONGELADA * 86400000) return { ok: false, motivo: "windy_congelada" };
    return { ok: true };
  }
  return bruto;
}

const trozos = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// Llamadas reales (no se prueban: red). Devuelven el Map o null si no hay
// clave o la API falla (entonces se queda la comprobación HTTP de siempre).
export async function consultarYoutube(ids, clave) {
  if (!clave || !ids.length) return null;
  try {
    const items = [];
    for (const t of trozos([...new Set(ids)], 50)) {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${t.join(",")}&key=${clave}`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`YouTube ${r.status}`);
      items.push(...((await r.json()).items || []));
    }
    return estadoYoutube({ items });
  } catch (e) {
    console.error(`API de YouTube: ${e.message} (se usa solo la comprobación HTTP)`);
    return null;
  }
}

export async function consultarWindy(ids, clave) {
  if (!clave || !ids.length) return null;
  try {
    const webcams = [];
    for (const t of trozos([...new Set(ids)], 50)) {
      const r = await fetch(`https://api.windy.com/webcams/api/v3/webcams?webcamIds=${t.join(",")}&limit=50`, { headers: { "x-windy-api-key": clave }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`Windy ${r.status}`);
      webcams.push(...((await r.json()).webcams || []));
    }
    return estadoWindy({ webcams });
  } catch (e) {
    console.error(`API de Windy: ${e.message} (se usa solo la comprobación HTTP)`);
    return null;
  }
}
