// assets/js/temp-agua-sonda.js
// Temperatura del agua medida con sonda en el diario (2026-10-10, pedido de
// Mikel tras medir 19,55 °C con su Furuno frente a Armintza cuando la app
// decía 20,3 °C con Open-Meteo y la capa IBI no tenía dato en ese punto).
//
// Puro, sin DOM ni red: lo usan diario.html (leer el campo y montar el
// registro), admin.html (el sesgo de las salidas propias, solo en el
// navegador del dueño) y scripts/aprendizaje/sesgo-temp-agua.mjs (el sesgo
// por zona del aprendizaje semanal). Tests: test/temp-agua-sonda.test.js.
//
// Dónde se guarda: salidas_pesca.indice_factores.temp_agua_sonda (jsonb que
// ya existe; sin migración). Forma (v 1):
//   { v: 1, medida_c, hora_serie, open_meteo_c, fuente_serie,
//     ibi: { c, km, fecha, hora_utc } | null, boya: { nombre, c } | null }
// open_meteo_c es el valor de la serie de mar de la salida a su hora ANTES de
// cambiarlo por la boya (fuente_serie dice si esa serie venía de Open-Meteo o
// de Copernicus, según FUENTE_TEMP_AGUA). ibi sale de la capa 🌡 del día
// (12:00 UTC, celda de mar más cercana a ≤ 5 km) y solo si la capa es de la
// fecha de la salida.

import { valorCercano } from "./capas-mar.js";

export const VERSION = 1;
export const MIN_C = 0;
export const MAX_C = 35;
export const MODELOS = ["open_meteo", "ibi", "boya"];

const r2 = (x) => Math.round(x * 100) / 100;
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);

// Campo del formulario: vacío = sin medida (opcional); coma o punto decimal.
// { ok: true, valor: número | null } o { ok: false }.
export function leerTempSonda(texto) {
  const t = String(texto ?? "").trim().replace(/\s*°\s*c?$/i, "").replace(",", ".");
  if (!t) return { ok: true, valor: null };
  if (!/^-?\d{1,2}(\.\d{1,3})?$/.test(t)) return { ok: false };
  const v = Number(t);
  if (!Number.isFinite(v) || v < MIN_C || v > MAX_C) return { ok: false };
  return { ok: true, valor: r2(v) };
}

// "19,55" para volver a rellenar el campo al editar.
export function textoCampo(v, coma = true) {
  if (!Number.isFinite(v)) return "";
  const s = String(r2(v));
  return coma ? s.replace(".", ",") : s;
}

// Valor de la capa IBI (capas/temperatura-agua.json) para la salida: solo si
// la capa es de la misma fecha; celda vacía junto a la costa → la de mar más
// cercana a ≤ 5 km.
export function ibiParaSalida(capa, bytes, lat, lon, fecha) {
  if (!capa || !bytes || !fecha || capa.fecha !== fecha) return null;
  const r = valorCercano(capa, bytes, lat, lon);
  if (!r) return null;
  return { c: r2(r.v), km: Math.round(r.km * 10) / 10, fecha: capa.fecha, hora_utc: "12:00" };
}

// Registro que se guarda junto a la salida (null si no hay medida).
export function registroSonda({ medida, horaSerie = null, openMeteo = null, fuenteSerie = null, ibi = null, boya = null }) {
  if (!Number.isFinite(medida)) return null;
  return {
    v: VERSION,
    medida_c: r2(medida),
    hora_serie: horaSerie || null,
    open_meteo_c: num(openMeteo) === null ? null : r2(openMeteo),
    fuente_serie: Array.isArray(fuenteSerie) && fuenteSerie.length ? fuenteSerie : null,
    ibi: ibi && num(ibi.c) !== null ? ibi : null,
    boya: boya && num(boya.c) !== null ? { nombre: String(boya.nombre || ""), c: r2(boya.c) } : null,
  };
}

// Medida − modelo, por modelo (null si ese modelo no tenía dato).
export function diferencias(reg) {
  if (!reg || num(reg.medida_c) === null) return null;
  const d = (m) => (num(m) === null ? null : r2(reg.medida_c - m));
  return { open_meteo: d(reg.open_meteo_c), ibi: d(reg.ibi?.c), boya: d(reg.boya?.c) };
}

// Una muestra para el sesgo a partir de una fila de salidas_pesca (o null).
// `zona` la pone quien llama (el script usa la región de pesca).
export function muestraDeSalida(s, { propios = new Set(), excluir = new Set(), zonaDe = () => null } = {}) {
  const reg = s?.indice_factores?.temp_agua_sonda;
  if (!reg || excluir.has(s.user_id)) return null;
  const dif = diferencias(reg);
  if (!dif || MODELOS.every((m) => dif[m] === null)) return null;
  return {
    usuario: propios.has(s.user_id) ? "dueño" : s.user_id, propio: propios.has(s.user_id),
    zona: zonaDe(Number(s.lat), Number(s.lon)), fecha: s.fecha, dif,
  };
}

// Una muestra a partir de una línea de datos-robots/calibracion-temp-agua.jsonl
// (puntos aportados por el dueño, siempre "propio").
export function muestraDeCalibracion(l, { zonaDe = () => null } = {}) {
  if (!l || num(l.medida_c) === null) return null;
  const dif = diferencias({ medida_c: l.medida_c, open_meteo_c: l.open_meteo_c, ibi: l.ibi?.mas_cercana_5km || null, boya: l.boya || null });
  return { usuario: "dueño", propio: true, zona: zonaDe(l.lat, l.lon), fecha: l.fecha, dif };
}

// Media, desviación y error típico de una lista de números.
export function estadistica(xs) {
  const n = xs.length;
  if (!n) return { n: 0, media: null, sd: null, se: null };
  const media = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : null;
  return { n, media: r2(media), sd: sd === null ? null : r2(sd), se: sd === null ? null : Math.round((sd / Math.sqrt(n)) * 1000) / 1000 };
}

// Sesgo (medida − modelo) por zona y modelo: n, personas distintas, media.
export function sesgoPorZona(muestras) {
  const grupos = new Map();
  for (const m of muestras) {
    for (const modelo of MODELOS) {
      if (m.dif[modelo] === null || m.dif[modelo] === undefined) continue;
      const k = `${m.zona ?? "sin_zona"}|${modelo}`;
      if (!grupos.has(k)) grupos.set(k, { zona: m.zona ?? "sin_zona", modelo, filas: [] });
      grupos.get(k).filas.push({ x: m.dif[modelo], usuario: m.usuario, propio: m.propio, fecha: m.fecha });
    }
  }
  return [...grupos.values()].map((g) => ({
    zona: g.zona, modelo: g.modelo, ...estadistica(g.filas.map((f) => f.x)),
    personas: new Set(g.filas.map((f) => f.usuario)).size, solo_dueño: g.filas.every((f) => f.propio), filas: g.filas,
  })).sort((a, b) => a.zona.localeCompare(b.zona) || MODELOS.indexOf(a.modelo) - MODELOS.indexOf(b.modelo));
}
