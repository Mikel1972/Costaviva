// scripts/fuentes/periodo-boyas.mjs
// Aprende, SIN IA, cuánto se desvía el periodo de la mar de fondo de
// Open-Meteo del periodo de pico (Tp) que miden las boyas de Puertos del
// Estado (2026-11-19). Lo usa la subida del agua / resaca de la app
// (assets/js/mar-de-fondo.js, factoresPeriodo).
//
// Cada día (fuentes-gratuitas.yml, tras la comparativa): baja de cada boya
// el Tp de los últimos DIAS días (solo marca de calidad 1) y de Open-Meteo,
// para el mismo punto y las mismas horas, swell_wave_peak_period y
// swell_wave_period (past_days: análisis y previsión a muy corto plazo, que
// es lo que se calibra aquí, no el acierto a varios días). Por boya, la
// mediana de Tp / modelo con al menos MIN_HORAS horas; global, la mediana de
// las boyas. Escribe functions/_lib/periodo-boyas-datos.js solo si algún
// cociente cambia más de un 3 % (cada cambio despliega la web).
//
// Uso interno de validación: no se publica ningún dato de las boyas, solo el
// cociente agregado.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BOYAS } from "../../functions/prevision.js";
import { pedirOpenMeteo, claveOpenMeteo } from "../../functions/_lib/open-meteo.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FICHERO = join(RAIZ, "functions", "_lib", "periodo-boyas-datos.js");
export const DIAS = 30;
export const MIN_HORAS = 48;
const CABECERA = "// Generado por scripts/fuentes/periodo-boyas.mjs. No editar a mano.\nexport default ";

const mediana = (a) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r3 = (x) => (x === null ? null : +x.toFixed(3));

// obs: Map(ms -> Tp); modelo: { time: [...], swell_wave_peak_period, swell_wave_period }
export function cocientesBoya(obs, modelo) {
  const pico = [], medio = [];
  (modelo?.time || []).forEach((t, i) => {
    const tp = obs.get(Date.parse(`${t}:00Z`));
    if (!Number.isFinite(tp) || tp <= 0) return;
    const p = modelo.swell_wave_peak_period?.[i], m = modelo.swell_wave_period?.[i];
    if (Number.isFinite(p) && p > 0) pico.push(tp / p);
    if (Number.isFinite(m) && m > 0) medio.push(tp / m);
  });
  return {
    n: Math.max(pico.length, medio.length),
    pico: pico.length >= MIN_HORAS ? r3(mediana(pico)) : null,
    medio: medio.length >= MIN_HORAS ? r3(mediana(medio)) : null,
  };
}

export function tablaPeriodo(porBoya, ahora = new Date()) {
  const boyas = porBoya.filter((b) => b.pico !== null || b.medio !== null);
  return {
    generado: ahora.toISOString(),
    dias: DIAS,
    global: { pico: r3(mediana(boyas.map((b) => b.pico))), medio: r3(mediana(boyas.map((b) => b.medio))) },
    boyas,
  };
}

export function cambioMaterial(viejo, nuevo, umbral = 0.03) {
  if (!viejo?.boyas) return true;
  const clave = (b) => String(b.codigo);
  const v = new Map(viejo.boyas.map((b) => [clave(b), b]));
  if (viejo.boyas.length !== nuevo.boyas.length) return true;
  const pares = [[viejo.global?.pico, nuevo.global?.pico], [viejo.global?.medio, nuevo.global?.medio]];
  for (const b of nuevo.boyas) {
    const a = v.get(clave(b));
    if (!a) return true;
    pares.push([a.pico, b.pico], [a.medio, b.medio]);
  }
  return pares.some(([x, y]) => (x == null) !== (y == null) || (x != null && Math.abs(y / x - 1) > umbral));
}

export const textoDatos = (t) => CABECERA + JSON.stringify(t, null, 1) + ";\n";
export function leerDatos(texto) {
  const i = texto.indexOf("export default ");
  return i < 0 ? null : JSON.parse(texto.slice(i + 15).trim().replace(/;$/, ""));
}

const p2 = (n) => String(n).padStart(2, "0");
const fechaPortus = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}@${p2(d.getUTCHours())}00`;
};

async function tpBoya(boya, desde, hasta) {
  const url = `https://poem.puertos.es/portus/StationData?code=${boya.codigo}&params=Tp&from=${fechaPortus(desde)}&to=${fechaPortus(hasta)}`;
  const r = await fetch(url, { headers: { "User-Agent": "Costaviva/1.0 comparativa de fuentes (sin IA)" } });
  if (!r.ok) throw new Error(`boya ${boya.codigo} HTTP ${r.status}`);
  const d = await r.json();
  const i = (d?.[0] || []).findIndex((c) => String(c).startsWith("Tp "));
  const obs = new Map();
  for (const f of d?.[1] || []) {
    const c = i > 0 ? f[i] : null;
    if (Array.isArray(c) && Number(c[1]) === 1 && Number.isFinite(Number(c[0]))) obs.set(Number(f[0]) * 1000, Number(c[0]));
  }
  return obs;
}

export async function aprender({ env = process.env, ahora = Date.now() } = {}) {
  const hasta = Math.floor(ahora / 3600e3) * 3600e3, desde = hasta - DIAS * 86400e3;
  const lats = BOYAS.map((b) => b.lat).join(","), lons = BOYAS.map((b) => b.lon).join(",");
  const mar = await pedirOpenMeteo("marine", `latitude=${lats}&longitude=${lons}&timezone=GMT&past_days=${DIAS}&forecast_days=1&hourly=swell_wave_peak_period,swell_wave_period`, { apiKey: claveOpenMeteo(env) });
  const lista = Array.isArray(mar) ? mar : [mar];
  const porBoya = [], avisos = [];
  for (const [i, b] of BOYAS.entries()) {
    try {
      const c = cocientesBoya(await tpBoya(b, desde, hasta), lista[i]?.hourly);
      porBoya.push({ codigo: b.codigo, nombre: b.nombre, lat: b.lat, lon: b.lon, ...c });
    } catch (e) {
      avisos.push(e.message);
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return { tabla: tablaPeriodo(porBoya, new Date(ahora)), avisos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tabla, avisos } = await aprender();
  for (const a of avisos) console.log(`::warning::${a}`);
  const viejo = existsSync(FICHERO) ? leerDatos(readFileSync(FICHERO, "utf8")) : null;
  console.log(`Periodo: ${tabla.boyas.length} boyas, global pico ${tabla.global.pico}, medio ${tabla.global.medio}`);
  if (tabla.boyas.length < 5) { console.log("::warning::Menos de 5 boyas con datos: no se cambia nada"); process.exit(0); }
  if (cambioMaterial(viejo, tabla)) { writeFileSync(FICHERO, textoDatos(tabla)); console.log("Reescrito", FICHERO); }
  else console.log("Sin cambios de más de un 3 %.");
}
