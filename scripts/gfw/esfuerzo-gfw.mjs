// scripts/gfw/esfuerzo-gfw.mjs
// Actividad pesquera comercial de Global Fishing Watch (2026-11-02). Sin IA.
// GFW (Leah Buckley, 2026-11-02) no pide licencia comercial mientras la capa
// vaya en la parte GRATIS de Costaviva (permisos/registro.json de comun).
//
// Pide a la API 4Wings el esfuerzo pesquero APARENTE (horas, inferido del
// AIS) de los 7 días que acaban hace 4 (los datos llegan con 96 h de
// retraso), en celdas de 0,1° (resolución LOW), para las cajas de
// REGIONES. La API devuelve filas por barco (nombre, MMSI...): aquí solo se
// suman las horas por celda y lo demás se tira; nunca se guardan barcos,
// banderas ni rutas. Con --seco solo enseña totales y la forma de la respuesta.
//
// Uso: GFW_API_TOKEN=... [SUPABASE_SERVICE_ROLE_KEY=...] node scripts/gfw/esfuerzo-gfw.mjs [--seco]
// Lo puro se prueba en test/esfuerzo-gfw.test.js.

export const API = "https://gateway.api.globalfishingwatch.org/v3/4wings/report";
export const DATASET = "public-global-fishing-effort:latest";
export const DIAS_VENTANA = 7;
export const DIAS_RETRASO = 4;
export const PASO = 0.1;
// [oeste, sur, este, norte]
export const REGIONES = {
  iberia: [-10.5, 35.8, -1.2, 45.0],   // Cantábrico, Galicia y costa atlántica de la península
  nz: [165.5, -47.8, 179.5, -34.0],    // Nueva Zelanda
};
const DIA = 864e5;

export const isoDia = (t) => new Date(t).toISOString().slice(0, 10);
// Ventana de 7 días que acaba hace 4: [desde, hasta] (hasta incluido).
export function ventana(ahora = new Date()) {
  const hoy = Date.parse(isoDia(ahora));
  const hasta = hoy - DIAS_RETRASO * DIA;
  return { desde: isoDia(hasta - (DIAS_VENTANA - 1) * DIA), hasta: isoDia(hasta) };
}

export function poligono([o, s, e, n]) {
  return { type: "Polygon", coordinates: [[[o, s], [e, s], [e, n], [o, n], [o, s]]] };
}

const celda = (v) => +(Math.floor(v / PASO + 1e-9) * PASO).toFixed(1);

// Respuesta de 4Wings -> [{ celda_lat, celda_lon, horas }] sumando por celda,
// sea cual sea la agrupación (día, bandera, arte). Solo celdas con horas > 0.
export function celdasDeRespuesta(json) {
  const suma = new Map();
  for (const entrada of json?.entries || []) {
    for (const filas of Object.values(entrada || {})) {
      for (const f of Array.isArray(filas) ? filas : []) {
        const lat = Number(f.lat), lon = Number(f.lon), h = Number(f.hours ?? f.value ?? 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(h > 0)) continue;
        const k = `${celda(lat)},${celda(lon)}`;
        suma.set(k, (suma.get(k) || 0) + h);
      }
    }
  }
  return [...suma].map(([k, h]) => {
    const [la, lo] = k.split(",").map(Number);
    return { celda_lat: la, celda_lon: lo, horas: +h.toFixed(1) };
  }).sort((a, b) => a.celda_lat - b.celda_lat || a.celda_lon - b.celda_lon);
}

// La respuesta viene paginada (limit/offset/nextOffset): se piden todas las
// páginas y se juntan sus entries.
async function pedir(region, caja, v, token) {
  const entries = [];
  let offset = 0;
  for (let pagina = 0; pagina < 200; pagina++) {
    const json = await pedirPagina(region, caja, v, token, offset);
    entries.push(...(json.entries || []));
    if (json.nextOffset == null || json.nextOffset === offset) return { ...json, entries };
    offset = json.nextOffset;
  }
  throw new Error(`GFW (${region}): más de 200 páginas`);
}

async function pedirPagina(region, caja, v, token, offset) {
  const q = new URLSearchParams({ "spatial-resolution": "LOW", "temporal-resolution": "ENTIRE", "datasets[0]": DATASET, "date-range": `${v.desde},${v.hasta}`, format: "JSON", ...(offset ? { offset: String(offset) } : {}) });
  const r = await fetch(`${API}?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ geojson: poligono(caja) }),
    signal: AbortSignal.timeout(120000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`GFW ${r.status} (${region}): ${texto.slice(0, 300)}`);
  return JSON.parse(texto);
}

async function main() {
  const token = (process.env.GFW_API_TOKEN || "").trim();
  if (!token) throw new Error("Falta el secret GFW_API_TOKEN.");
  const seco = process.argv.includes("--seco");
  const v = ventana();
  const todas = [];
  for (const [region, caja] of Object.entries(REGIONES)) {
    const json = await pedir(region, caja, v, token);
    if (seco) {
      const primera = Object.values(json?.entries?.[0] || {})[0]?.[0];
      console.log(`${region}: ${json.entries.length} bloques, total ${json.total}; campos de fila: ${JSON.stringify(Object.keys(primera || {}))}`);
    }
    const celdas = celdasDeRespuesta(json).map((c) => ({ ...c, region }));
    console.log(`${region} (${v.desde} a ${v.hasta}): ${celdas.length} celdas con actividad, ${Math.round(celdas.reduce((s, c) => s + c.horas, 0))} horas de pesca aparente.`);
    todas.push(...celdas);
  }
  if (seco) return;
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  const URL_SB = "https://imncbmizxkorotpeisic.supabase.co/rest/v1/gfw_esfuerzo";
  const h = { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" };
  const calculado = new Date().toISOString();
  const filas = todas.map((c) => ({ ...c, desde: v.desde, hasta: v.hasta, calculado }));
  for (let i = 0; i < filas.length; i += 1000) {
    const r = await fetch(`${URL_SB}?on_conflict=region,celda_lat,celda_lon`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas.slice(i, i + 1000)) });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  // Primero lo nuevo, luego se borra lo de cálculos anteriores.
  const r = await fetch(`${URL_SB}?calculado=lt.${encodeURIComponent(calculado)}`, { method: "DELETE", headers: { ...h, Prefer: "return=minimal" } });
  if (!r.ok) throw new Error(`Supabase ${r.status} al borrar: ${(await r.text()).slice(0, 200)}`);
  console.log(`Guardadas ${filas.length} celdas.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
