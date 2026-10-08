// scripts/fuentes/comparar-boyas.mjs
// Comparativa SIN IA de las fuentes de previsión contra las boyas reales de
// Puertos del Estado (2026-10-08). Para que Mikel decida, variable a
// variable, si se pasa de Open-Meteo a MET Norway / Copernicus Marine.
//
// Dos pasos (fuentes-gratuitas.yml los corre a diario):
//   archivar  guarda lo que cada fuente PREVÉ ahora para las próximas 24 h en
//             cada boya: datos-robots/fuentes/pronosticos/AAAA-MM-DD.json
//             (lo pasado no vale: MET Norway no tiene histórico y el pasado
//             de Copernicus es análisis, no previsión; así todas compiten igual)
//   comparar  cruza los pronósticos archivados de los últimos N días con lo que
//             midieron las boyas y escribe datos-robots/fuentes/COMPARATIVA.md
//
// Boyas: misma lista BOYAS que /prevision. Solo se usan medidas con la marca
// de calidad 1 de Puertos del Estado (el resto, p. ej. presión 950 con marca
// 4, se descarta). Es un uso interno de validación, no se redistribuye nada:
// su manual de descarga prohíbe pasar los datos a terceros.
//
// Uso: node comparar-boyas.mjs archivar|comparar|ambos [--dias 14]
// Variables: METNO_CONTACTO (User-Agent de MET), OPEN_METEO_API_KEY (opcional),
// FUENTES_GRATUITAS_URL (opcional).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BOYAS } from "../../functions/prevision.js";
import { pedirOpenMeteo, claveOpenMeteo } from "../../functions/_lib/open-meteo.js";
import { pedirMetNorway, serieDesdeMet } from "../../functions/_lib/met-norway.js";
import { leerInstantanea } from "../../functions/_lib/instantaneas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(RAIZ, "datos-robots", "fuentes");
const DIR_PRON = join(DIR, "pronosticos");
const HORA = 3600e3;
const HORAS_ARCHIVO = 24;
const DIAS_GUARDADOS = 45;

// Variable propia -> parámetro de la boya.
export const VARIABLES = {
  wh: { boya: "Hm0", nombre: "Altura de ola (m)", dec: 2 },
  wpp: { boya: "Tp", nombre: "Periodo de pico (s)", dec: 1 },
  sst: { boya: "WaterTemp", nombre: "Temperatura del agua (°C)", dec: 2 },
  ws: { boya: "WindSpeed", nombre: "Viento (m/s)", dec: 2 },
  wd: { boya: "WindDir", nombre: "Dirección del viento (°)", dec: 0, circular: true },
  p: { boya: "AirPressure", nombre: "Presión (hPa)", dec: 1 },
  t: { boya: "AirTemp", nombre: "Temperatura del aire (°C)", dec: 2 },
};
const FUENTES = ["openmeteo", "metno", "copernicus"];
const NOMBRE_FUENTE = { openmeteo: "Open-Meteo", metno: "MET Norway", copernicus: "Copernicus IBI" };

const p2 = (n) => String(n).padStart(2, "0");
const horaUTC = (ms) => Math.floor(ms / HORA) * HORA;
const fechaPortus = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}@${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
};

function serieVacia() {
  return Object.fromEntries(Object.keys(VARIABLES).map((k) => [k, new Array(HORAS_ARCHIVO).fill(null)]));
}

// --- Pronósticos por fuente --------------------------------------------------

async function pronosticoOpenMeteo(desde, env) {
  const lats = BOYAS.map((b) => b.lat).join(",");
  const lons = BOYAS.map((b) => b.lon).join(",");
  const base = `latitude=${lats}&longitude=${lons}&timezone=GMT&forecast_days=3`;
  const apiKey = claveOpenMeteo(env);
  const [atm, mar] = await Promise.all([
    pedirOpenMeteo("forecast", `${base}&hourly=wind_speed_10m,wind_direction_10m,pressure_msl,temperature_2m&wind_speed_unit=ms`, { apiKey }),
    pedirOpenMeteo("marine", `${base}&hourly=wave_height,wave_peak_period,sea_surface_temperature`, { apiKey }),
  ]);
  const la = Array.isArray(atm) ? atm : [atm];
  const lm = Array.isArray(mar) ? mar : [mar];
  const salida = {};
  BOYAS.forEach((b, i) => {
    const s = serieVacia();
    const colocar = (resp, mapa) => {
      (resp?.hourly?.time || []).forEach((t, j) => {
        const k = Math.round((Date.parse(t + ":00Z") - desde) / HORA);
        if (k < 0 || k >= HORAS_ARCHIVO) return;
        for (const [nuestra, suya] of Object.entries(mapa)) s[nuestra][k] = resp.hourly[suya]?.[j] ?? null;
      });
    };
    colocar(la[i], { ws: "wind_speed_10m", wd: "wind_direction_10m", p: "pressure_msl", t: "temperature_2m" });
    colocar(lm[i], { wh: "wave_height", wpp: "wave_peak_period", sst: "sea_surface_temperature" });
    salida[b.codigo] = s;
  });
  return salida;
}

async function pronosticoMetNorway(desde, env) {
  const salida = {};
  for (const b of BOYAS) {
    const json = await pedirMetNorway(b.lat, b.lon, { env });
    const serie = serieDesdeMet(json);
    const s = serieVacia();
    for (let k = 0; k < HORAS_ARCHIVO; k++) {
      const i = Math.round((desde + k * HORA - serie.inicio) / HORA);
      if (i < 0 || i >= serie.horas) continue;
      s.ws[k] = serie.ws[i];
      s.wd[k] = serie.wd[i];
      s.p[k] = serie.p[i];
      s.t[k] = serie.t[i];
    }
    salida[b.codigo] = s;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  return salida;
}

async function pronosticoCopernicus(desde, env) {
  const inst = await leerInstantanea("mar/spots.json", { env });
  if (!inst) return null;
  const inicio = Date.parse(inst.inicio);
  const salida = {};
  for (const b of BOYAS) {
    const p = (inst.puntos || []).find((x) => x.id === `boya-${b.codigo}`);
    if (!p) continue;
    const s = serieVacia();
    for (let k = 0; k < HORAS_ARCHIVO; k++) {
      const i = Math.round((desde + k * HORA - inicio) / HORA);
      s.wh[k] = p.wh?.[i] ?? null;
      s.wpp[k] = p.wpp?.[i] ?? null;
      s.sst[k] = p.sst?.[i] ?? null;
    }
    salida[b.codigo] = s;
  }
  return { generado_en: inst.generado_en, boyas: salida };
}

export async function archivar({ env = process.env, ahora = Date.now(), horasAtras = 0 } = {}) {
  // horasAtras: empezar unas horas antes de ahora (solo para la primera
  // pasada, para tener horas ya medidas por las boyas con las que comparar).
  const desde = horaUTC(ahora) - horasAtras * HORA;
  const fuentes = {};
  const errores = {};
  const tareas = {
    openmeteo: () => pronosticoOpenMeteo(desde, env),
    metno: () => pronosticoMetNorway(desde, env),
    copernicus: async () => {
      const r = await pronosticoCopernicus(desde, env);
      if (!r) throw new Error("sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)");
      return r.boyas;
    },
  };
  for (const [f, t] of Object.entries(tareas)) {
    try {
      fuentes[f] = await t();
    } catch (e) {
      errores[f] = String(e?.message || e);
      console.log(`::warning::${NOMBRE_FUENTE[f]}: ${errores[f]}`);
    }
  }
  mkdirSync(DIR_PRON, { recursive: true });
  const fichero = join(DIR_PRON, `${new Date(desde).toISOString().slice(0, 10)}.json`);
  // Si ya hay uno de hoy, se queda el primero (el pronóstico más antiguo es
  // el que se compara: es lo que la app habría enseñado).
  if (!existsSync(fichero)) {
    writeFileSync(fichero, JSON.stringify({ generado_en: new Date(ahora).toISOString(), desde: new Date(desde).toISOString(), horas: HORAS_ARCHIVO, errores, fuentes }) + "\n");
  }
  // Limpieza: solo los últimos DIAS_GUARDADOS días.
  const limite = new Date(ahora - DIAS_GUARDADOS * 86400e3).toISOString().slice(0, 10);
  for (const n of readdirSync(DIR_PRON)) if (n.endsWith(".json") && n.slice(0, 10) < limite) unlinkSync(join(DIR_PRON, n));
  return { fichero, errores };
}

// --- Boyas ------------------------------------------------------------------

export function parsearBoya(datos) {
  const cab = datos?.[0] || [];
  const filas = datos?.[1] || [];
  const col = Object.fromEntries(Object.values(VARIABLES).map((v) => [v.boya, cab.findIndex((c) => String(c).startsWith(v.boya + " "))]));
  const porHora = new Map();
  for (const f of filas) {
    const ms = Number(f[0]) * 1000;
    if (!Number.isFinite(ms) || ms % HORA !== 0) continue;
    const obs = {};
    for (const [nuestra, def] of Object.entries(VARIABLES)) {
      const i = col[def.boya];
      const celda = i > 0 ? f[i] : null;
      // [valor, marca]: solo marca 1 (dato bueno).
      if (Array.isArray(celda) && Number(celda[1]) === 1 && Number.isFinite(Number(celda[0]))) obs[nuestra] = Number(celda[0]);
    }
    porHora.set(ms, obs);
  }
  return porHora;
}

async function observaciones(boya, desde, hasta) {
  const params = Object.values(VARIABLES).map((v) => v.boya).join(",");
  const url = `https://poem.puertos.es/portus/StationData?code=${boya.codigo}&params=${params}&from=${fechaPortus(desde)}&to=${fechaPortus(hasta)}`;
  const r = await fetch(url, { headers: { "User-Agent": "Costaviva/1.0 comparativa de fuentes (sin IA)" } });
  if (!r.ok) throw new Error(`boya ${boya.codigo} HTTP ${r.status}`);
  return parsearBoya(await r.json());
}

// --- Estadística ------------------------------------------------------------

function diferencia(prev, obs, circular) {
  if (!circular) return prev - obs;
  return ((prev - obs + 540) % 360) - 180;
}

export function estadisticas(pares, circular = false) {
  if (!pares.length) return { n: 0, sesgo: null, mae: null, rmse: null };
  const d = pares.map(([p, o]) => diferencia(p, o, circular));
  const n = d.length;
  const sesgo = d.reduce((a, x) => a + x, 0) / n;
  const mae = d.reduce((a, x) => a + Math.abs(x), 0) / n;
  const rmse = Math.sqrt(d.reduce((a, x) => a + x * x, 0) / n);
  return { n, sesgo, mae, rmse };
}

// Solo cuenta las horas-boya en que TODAS las fuentes que dan esa variable
// tienen previsión: si no, una fuente con más horas (p. ej. de noche, o de
// días en que otra falló) no sería comparable.
export function cruzar(archivos, obsPorBoya, ahora = Date.now()) {
  const pares = Object.fromEntries(FUENTES.map((f) => [f, Object.fromEntries(Object.keys(VARIABLES).map((v) => [v, []]))]));
  const olaPorBoya = {};
  const fuentesConVariable = Object.fromEntries(Object.keys(VARIABLES).map((v) => [v, new Set()]));
  const candidatos = Object.fromEntries(Object.keys(VARIABLES).map((v) => [v, new Map()]));
  for (const [ia, a] of archivos.entries()) {
    const desde = Date.parse(a.desde);
    for (const f of FUENTES) {
      const porBoya = a.fuentes?.[f];
      if (!porBoya) continue;
      for (const [codigo, serie] of Object.entries(porBoya)) {
        const obs = obsPorBoya[codigo];
        for (let k = 0; k < (a.horas || HORAS_ARCHIVO); k++) {
          const ms = desde + k * HORA;
          if (ms > ahora) break;
          const o = obs?.get(ms);
          for (const v of Object.keys(VARIABLES)) {
            const p = serie[v]?.[k];
            if (p === null || p === undefined) continue;
            fuentesConVariable[v].add(f);
            if (!o || o[v] === undefined) continue;
            const clave = `${ia}|${codigo}|${k}`;
            if (!candidatos[v].has(clave)) candidatos[v].set(clave, { codigo, obs: o[v], prev: {} });
            candidatos[v].get(clave).prev[f] = p;
          }
        }
      }
    }
  }
  for (const v of Object.keys(VARIABLES)) {
    const necesarias = [...fuentesConVariable[v]];
    for (const c of candidatos[v].values()) {
      if (!necesarias.every((f) => c.prev[f] !== undefined)) continue;
      for (const f of necesarias) {
        pares[f][v].push([c.prev[f], c.obs]);
        if (v === "wh") ((olaPorBoya[c.codigo] ||= {})[f] ||= []).push([c.prev[f], c.obs]);
      }
    }
  }
  return { pares, olaPorBoya };
}

const fmt = (x, dec) => (x === null || x === undefined ? "—" : (x >= 0 ? "+" : "") + x.toFixed(dec));
const fmtAbs = (x, dec) => (x === null || x === undefined ? "—" : x.toFixed(dec));

export function informe({ pares, olaPorBoya }, { dias, archivos, ahora = Date.now(), notas = [] }) {
  const l = [];
  l.push("# Comparativa de fuentes contra boyas de Puertos del Estado");
  l.push("");
  l.push(`Generado sin IA por \`scripts/fuentes/comparar-boyas.mjs\` el ${new Date(ahora).toISOString().slice(0, 16)}Z.`);
  l.push(`Ventana: últimos ${dias} días, ${archivos.length} pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).`);
  l.push("");
  l.push("Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;");
  l.push("**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.");
  l.push("La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).");
  l.push("El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.");
  l.push("");
  for (const [v, def] of Object.entries(VARIABLES)) {
    const filas = FUENTES.map((f) => ({ f, e: estadisticas(pares[f][v], def.circular) })).filter((x) => x.e.n > 0);
    if (!filas.length) continue;
    l.push(`## ${def.nombre}`);
    l.push("");
    l.push("| Fuente | n | Sesgo | MAE | RMSE |");
    l.push("|---|---:|---:|---:|---:|");
    for (const { f, e } of filas) l.push(`| ${NOMBRE_FUENTE[f]} | ${e.n} | ${fmt(e.sesgo, def.dec)} | ${fmtAbs(e.mae, def.dec)} | ${fmtAbs(e.rmse, def.dec)} |`);
    l.push("");
  }
  const codigos = Object.keys(olaPorBoya).sort((a, b) => Number(a) - Number(b));
  if (codigos.length) {
    l.push("## Altura de ola por boya (MAE en m, n entre paréntesis)");
    l.push("");
    l.push(`| Boya | ${FUENTES.map((f) => NOMBRE_FUENTE[f]).join(" | ")} |`);
    l.push(`|---|${FUENTES.map(() => "---:").join("|")}|`);
    for (const c of codigos) {
      const b = BOYAS.find((x) => String(x.codigo) === c);
      const celdas = FUENTES.map((f) => {
        const e = estadisticas(olaPorBoya[c][f] || []);
        return e.n ? `${e.mae.toFixed(2)} (${e.n})` : "—";
      });
      l.push(`| ${c} ${b ? b.nombre : ""} | ${celdas.join(" | ")} |`);
    }
    l.push("");
  }
  if (notas.length) {
    l.push("## Avisos de esta pasada");
    l.push("");
    for (const n of notas) l.push(`- ${n}`);
    l.push("");
  }
  l.push("Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).");
  return l.join("\n") + "\n";
}

export async function comparar({ dias = 14, ahora = Date.now() } = {}) {
  if (!existsSync(DIR_PRON)) mkdirSync(DIR_PRON, { recursive: true });
  const limite = new Date(ahora - dias * 86400e3).toISOString().slice(0, 10);
  const archivos = readdirSync(DIR_PRON)
    .filter((n) => n.endsWith(".json") && n.slice(0, 10) >= limite)
    .sort()
    .map((n) => JSON.parse(readFileSync(join(DIR_PRON, n), "utf8")));
  const notas = [];
  for (const a of archivos) for (const [f, e] of Object.entries(a.errores || {})) notas.push(`${a.desde.slice(0, 10)} ${NOMBRE_FUENTE[f]}: ${e}`);
  const desde = archivos.length ? Math.min(...archivos.map((a) => Date.parse(a.desde))) : ahora - HORA;
  const obsPorBoya = {};
  for (const b of BOYAS) {
    try {
      obsPorBoya[b.codigo] = await observaciones(b, desde, ahora);
    } catch (e) {
      notas.push(`Boya ${b.codigo} ${b.nombre}: ${e.message}`);
    }
  }
  const cruce = cruzar(archivos, obsPorBoya, ahora);
  const md = informe(cruce, { dias, archivos, ahora, notas });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, "COMPARATIVA.md"), md);
  return { md, cruce };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const modo = process.argv[2] || "ambos";
  const i = process.argv.indexOf("--dias");
  const dias = i > 0 ? Number(process.argv[i + 1]) || 14 : 14;
  if (modo === "archivar" || modo === "ambos") {
    const j = process.argv.indexOf("--atras");
    const r = await archivar({ horasAtras: j > 0 ? Number(process.argv[j + 1]) || 0 : 0 });
    console.log(`Archivado ${r.fichero}`, r.errores);
    if (r.errores.openmeteo && r.errores.metno) {
      console.log("::error::Ni Open-Meteo ni MET Norway respondieron");
      process.exit(1);
    }
  }
  if (modo === "comparar" || modo === "ambos") {
    const { md } = await comparar({ dias });
    console.log(md);
  }
}
