// scripts/gfw/esfuerzo-gfw.mjs
// Actividad pesquera comercial de Global Fishing Watch (2026-11-02). Sin IA.
// GFW (Leah Buckley, 2026-11-02) no pide licencia comercial mientras la capa
// vaya en la parte GRATIS de Costaviva (permisos/registro.json de comun).
//
// Pide a la API 4Wings el esfuerzo pesquero APARENTE (horas, inferido del
// AIS) de los 7 días que acaban hace 4 (los datos llegan con 96 h de
// retraso) y, desde el 2026-11-02, lo HABITUAL en esta época (el mismo mes
// de los 3 años anteriores, media por año), en celdas de 0,1° (resolución
// LOW), para las cajas de REGIONES, en total y por grupo de arte. La API devuelve filas por barco (nombre, MMSI...): aquí solo se
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

// Artes de GFW (geartype) agrupadas para el pescador (2026-11-02, Mikel:
// "lo que más interesa es dónde arrastra la flota"). Lo que no está aquí
// (nasas, curricán, cebo vivo, "fishing" sin arte conocido...) va a "otras".
export const ARTES = {
  arrastre: ["trawlers", "dredge_fishing"],
  cerco: ["purse_seines", "tuna_purse_seines", "other_purse_seines", "seiners", "other_seines"],
  palangre: ["drifting_longlines", "set_longlines"],
  enmalle: ["set_gillnets"],
};
export const LISTA_ARTES = ["todas", ...Object.keys(ARTES), "otras"];
export function grupoArte(geartype) {
  const g = String(geartype || "").toLowerCase();
  for (const [grupo, lista] of Object.entries(ARTES)) if (lista.includes(g)) return grupo;
  return "otras";
}

// Respuesta de 4Wings -> [{ arte, celda_lat, celda_lon, horas }]: suma por
// celda en "todas" y en el grupo de su arte, sea cual sea la agrupación
// (día, bandera, barco). Solo celdas con horas > 0. Nunca devuelve barcos.
// `escala` divide las horas (lo habitual: media de varios años).
export function celdasDeRespuesta(json, escala = 1) {
  const suma = new Map();
  const sumar = (k, h) => suma.set(k, (suma.get(k) || 0) + h);
  for (const entrada of json?.entries || []) {
    for (const filas of Object.values(entrada || {})) {
      for (const f of Array.isArray(filas) ? filas : []) {
        const lat = Number(f.lat), lon = Number(f.lon), h = Number(f.hours ?? f.value ?? 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(h > 0)) continue;
        const c = `${celda(lat)},${celda(lon)}`;
        sumar(`todas|${c}`, h);
        sumar(`${grupoArte(f.geartype)}|${c}`, h);
      }
    }
  }
  // Con menos de 0,05 h la celda redondea a 0,0 y la tabla exige horas > 0
  // (caso real del 2026-11-02): fuera.
  return [...suma].map(([k, h]) => {
    const [arte, c] = k.split("|");
    const [la, lo] = c.split(",").map(Number);
    return { arte, celda_lat: la, celda_lon: lo, horas: +(h / escala).toFixed(1) };
  }).filter((c) => c.horas > 0)
    .sort((a, b) => LISTA_ARTES.indexOf(a.arte) - LISTA_ARTES.indexOf(b.arte) || a.celda_lat - b.celda_lat || a.celda_lon - b.celda_lon);
}

// Lo habitual en esta época: el mismo mes de los AÑOS_HABITUAL años
// anteriores (GFW tiene datos desde 2012), media por año.
export const AÑOS_HABITUAL = 3;
export function ventanasHabituales(ahora = new Date()) {
  const a = ahora.getUTCFullYear(), m = ahora.getUTCMonth();
  return Array.from({ length: AÑOS_HABITUAL }, (_, i) => {
    const y = a - 1 - i;
    return { desde: isoDia(Date.UTC(y, m, 1)), hasta: isoDia(Date.UTC(y, m + 1, 0)) };
  });
}

// Junta varias respuestas (una por año) en una sola para sumarlas juntas.
export const juntarRespuestas = (lista) => ({ entries: lista.flatMap((j) => j?.entries || []) });

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
  const habituales = ventanasHabituales();
  const todas = [];
  for (const [region, caja] of Object.entries(REGIONES)) {
    const json = await pedir(region, caja, v, token);
    if (seco) {
      const primera = Object.values(json?.entries?.[0] || {})[0]?.[0];
      console.log(`${region}: ${json.entries.length} bloques, total ${json.total}; campos de fila: ${JSON.stringify(Object.keys(primera || {}))}`);
    }
    const recientes = celdasDeRespuesta(json).map((c) => ({ ...c, region, periodo: "reciente", desde: v.desde, hasta: v.hasta }));
    const anos = [];
    for (const vh of habituales) anos.push(await pedir(region, caja, vh, token));
    const desdeH = habituales.at(-1).desde, hastaH = habituales[0].hasta;
    const habitual = celdasDeRespuesta(juntarRespuestas(anos), habituales.length).map((c) => ({ ...c, region, periodo: "habitual", desde: desdeH, hasta: hastaH }));
    const resumen = (xs) => `${xs.filter((c) => c.arte === "todas").length} celdas (arrastre ${xs.filter((c) => c.arte === "arrastre").length})`;
    console.log(`${region}: reciente ${v.desde} a ${v.hasta}: ${resumen(recientes)}; habitual (mismo mes, ${habituales.length} años): ${resumen(habitual)}.`);
    todas.push(...recientes, ...habitual);
  }
  if (seco) return;
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  const URL_SB = "https://imncbmizxkorotpeisic.supabase.co/rest/v1/gfw_esfuerzo";
  const h = { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" };
  const calculado = new Date().toISOString();
  const filas = todas.map((c) => ({ ...c, calculado }));
  for (let i = 0; i < filas.length; i += 1000) {
    const r = await fetch(`${URL_SB}?on_conflict=region,periodo,arte,celda_lat,celda_lon`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas.slice(i, i + 1000)) });
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
