// scripts/aprendizaje/datos.mjs
//
// Entrada/salida del aprendizaje semanal: lo único que habla con la red o
// con git. Todo lo demás (casos, métricas, ajuste, deriva) es puro.
//
//   - Supabase con la service_role, SOLO LECTURA: salidas_pesca, capturas,
//     perfiles (para quitar las cuentas de prueba) y administradores (los
//     datos del dueño se pueden publicar agregados aunque sea uno solo).
//   - Open-Meteo con OPEN_METEO_API_KEY (plan comercial): series horarias
//     de la fecha de cada salida para recalcular el índice. Sin la key no se
//     pide nada (el plan gratuito es solo no comercial) y el banco de
//     pruebas se queda con los términos que guardó el diario.
//   - git: fecha del último commit de cada fichero de datos-robots (frescura).

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pedirOpenMeteo } from "../../functions/_lib/open-meteo.js";
import { factorOleaje, SPOTS } from "../../functions/prevision.js";

export function leerJSON(ruta, defecto = null) {
  try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return defecto; }
}

export function leerJSONL(ruta) {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter((l) => l.trim()).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

export function ultimoCommit(raiz, ruta) {
  try {
    const r = execFileSync("git", ["-C", raiz, "log", "-1", "--format=%cI", "--", ruta], { encoding: "utf8" }).trim();
    return r || null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Supabase (service_role, solo GET)
// ---------------------------------------------------------------------------
async function leerTodo(url, key, tabla, select, orden = "creado_en.asc") {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/rest/v1/${tabla}?select=${select}&order=${orden}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${desde}-${desde + 999}` },
    });
    if (!r.ok) {
      const e = new Error(`${tabla}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      e.status = r.status;
      throw e;
    }
    const pagina = await r.json();
    filas.push(...pagina);
    if (pagina.length < 1000) return filas;
  }
}

const COLS_SALIDA = "id,user_id,fecha,hora_inicio,hora_fin,tipo_salida,lat,lon,spot_slug,concluida,creado_en";
const COLS_INDICE = "indice_version,indice_puntuacion,indice_especie,indice_factores,condiciones_estado";

export async function leerDiario({ url, key, emailsPrueba = [] }) {
  const errores = [];
  let salidas;
  try {
    salidas = await leerTodo(url, key, "salidas_pesca", `${COLS_SALIDA},${COLS_INDICE}`);
  } catch (e) {
    // Las columnas indice_* (migración 20261008120000, aplicada): si un día
    // faltaran (trampa 10), se sigue sin ellas y se avisa.
    if (e.status !== 400) throw e;
    errores.push("salidas_pesca sin las columnas indice_* (migración 20261008120000): solo se puede recalcular con series");
    salidas = await leerTodo(url, key, "salidas_pesca", COLS_SALIDA);
  }
  const capturas = await leerTodo(url, key, "capturas", "salida_id,especie,creado_en");
  const perfiles = await leerTodo(url, key, "perfiles", "id,email,creado_en");
  const pruebas = emailsPrueba.map((x) => x.toLowerCase());
  const excluir = new Set(perfiles.filter((p) => pruebas.includes((p.email || "").toLowerCase())).map((p) => p.id));
  let propios = new Set();
  try {
    propios = new Set((await leerTodo(url, key, "administradores", "user_id,creado_en")).map((x) => x.user_id));
  } catch (e) { errores.push(`administradores: ${e.message}`); }
  return { salidas, capturas, excluir, propios, errores };
}

// Agregados k ≥ 5 de "Comparte tu captura" (función de la migración
// 20261008150000; sin aplicar todavía → lista vacía y un aviso).
export async function leerComunidad({ url, key }) {
  const r = await fetch(`${url}/rest/v1/rpc/comunidad_capturas_por_condiciones`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}",
  });
  if (!r.ok) return { filas: [], error: `comunidad_capturas_por_condiciones: HTTP ${r.status}` };
  return { filas: await r.json(), error: null };
}

// Última marca de tiempo de una tabla (frescura de las fuentes en Supabase).
export async function ultimaFila({ url, key }, tabla, columna) {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=${columna}&order=${columna}.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) return { ultima: null, error: `HTTP ${r.status}` };
  const f = await r.json();
  return { ultima: f[0]?.[columna] ?? null, error: null };
}

// ---------------------------------------------------------------------------
// Open-Meteo: serie horaria (hora local de Madrid) de la fecha de un caso
// ---------------------------------------------------------------------------
const sumarDias = (iso, d) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * 86400e3).toISOString().slice(0, 10);

export function serieDesdeOpenMeteo(marino, atm, factorOla = 1) {
  const mar = {}, at = {};
  const hm = marino?.hourly, ha = atm?.hourly;
  (hm?.time || []).forEach((t, i) => {
    const ola = hm.wave_height?.[i];
    mar[t] = { nivelMar: hm.sea_level_height_msl?.[i] ?? null, ola: ola == null ? null : ola * factorOla, tempAgua: hm.sea_surface_temperature?.[i] ?? null };
  });
  (ha?.time || []).forEach((t, i) => {
    at[t] = {
      viento: (ha.wind_speed_10m || ha.windspeed_10m)?.[i] ?? null, vientoDir: (ha.wind_direction_10m || ha.winddirection_10m)?.[i] ?? null,
      presion: ha.pressure_msl?.[i] ?? null, lluvia: ha.precipitation?.[i] ?? null,
    };
  });
  return [...new Set([...Object.keys(mar), ...Object.keys(at)])].sort().map((t) => ({
    hora: t, nivelMar: mar[t]?.nivelMar ?? null, ola: mar[t]?.ola ?? null, tempAgua: mar[t]?.tempAgua ?? null,
    viento: at[t]?.viento ?? null, vientoDir: at[t]?.vientoDir ?? null, presion: at[t]?.presion ?? null, lluvia: at[t]?.lluvia ?? null,
  }));
}

// Agrupa casos por punto (~1 km) y mes: una llamada de mar y otra de
// atmósfera por grupo. Devuelve Map ref -> serie. Tope de llamadas por pasada.
export async function seriesDeCasos(casos, { apiKey, hoy, maxLlamadas = 120, pedir = pedirOpenMeteo, log = console.log } = {}) {
  const series = new Map();
  if (!apiKey) return { series, llamadas: 0, aviso: "sin OPEN_METEO_API_KEY: no se recalcula con series (solo términos guardados)" };
  const grupos = new Map();
  for (const c of casos) {
    const k = `${c.lat.toFixed(2)}|${c.lon.toFixed(2)}|${c.fecha.slice(0, 7)}`;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(c);
  }
  let llamadas = 0;
  for (const [k, lista] of grupos) {
    if (llamadas + 2 > maxLlamadas) { log(`Open-Meteo: tope de ${maxLlamadas} llamadas; el resto, la semana que viene.`); break; }
    const fechas = lista.map((c) => c.fecha).sort();
    const ini = sumarDias(fechas[0], -5), fin = sumarDias(fechas[fechas.length - 1], 1);
    const { lat, lon } = lista[0];
    const comun = { latitude: lat, longitude: lon, start_date: ini, end_date: fin, timezone: "Europe/Madrid" };
    const atmApi = fin < sumarDias(hoy, -7) ? "archive" : "forecast";
    let marino = null, atm = null;
    try { marino = await pedir("marine", { ...comun, hourly: "wave_height,sea_level_height_msl,sea_surface_temperature" }, { apiKey }); } catch (e) { log(`marine ${k}: ${e.message}`); }
    try { atm = await pedir(atmApi, { ...comun, hourly: "wind_speed_10m,wind_direction_10m,pressure_msl,precipitation", wind_speed_unit: "kmh" }, { apiKey }); } catch (e) { log(`${atmApi} ${k}: ${e.message}`); }
    llamadas += 2;
    const serie = marino || atm ? serieDesdeOpenMeteo(marino, atm, factorOleaje(lat, lon)) : null;
    for (const c of lista) series.set(c.ref, serie);
  }
  return { series, llamadas, aviso: null };
}

// Spots fijos para vigilar la distribución del índice en vivo (48 h).
export const SLUGS_VIGIA = ["mundaka", "zarautz", "llanes", "cangas", "cadiz", "valencia", "palma", "laspalmas", "peniche"];
export const SPOTS_VIGIA = SPOTS.filter((s) => SLUGS_VIGIA.includes(s.slug));

export async function seriesVigia({ apiKey, pedir = pedirOpenMeteo }) {
  if (!apiKey) return null;
  const lat = SPOTS_VIGIA.map((s) => s.lat).join(","), lon = SPOTS_VIGIA.map((s) => s.lon).join(",");
  const comun = { latitude: lat, longitude: lon, timezone: "Europe/Madrid", past_days: 5, forecast_days: 2 };
  const [mar, atm] = await Promise.all([
    pedir("marine", { ...comun, hourly: "wave_height,sea_level_height_msl,sea_surface_temperature" }, { apiKey }),
    pedir("forecast", { ...comun, hourly: "wind_speed_10m,wind_direction_10m,pressure_msl,precipitation", wind_speed_unit: "kmh" }, { apiKey }),
  ]);
  const lm = Array.isArray(mar) ? mar : [mar], la = Array.isArray(atm) ? atm : [atm];
  return SPOTS_VIGIA.map((s, i) => ({ ...s, serie: serieDesdeOpenMeteo(lm[i], la[i], factorOleaje(s.lat, s.lon)) }));
}

// Filas de observaciones abiertas con licencia comercial (CC0 / CC BY).
export function leerObservaciones(raiz) {
  const dir = join(raiz, "datos-robots/observaciones/comercial");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f)).flatMap((f) => {
    const d = leerJSON(join(dir, f));
    return Array.isArray(d?.filas) ? d.filas : Array.isArray(d) ? d : [];
  });
}
