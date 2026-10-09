// functions/_lib/nz/mareas-linz.js
// Mareas de Nueva Zelanda con las predicciones oficiales de LINZ
// (Toitū Te Whenua Land Information New Zealand), fase 1 de NZ (2026-10-09).
//
// En España la marea sale de Open-Meteo (`sea_level_height_msl`) y el
// coeficiente se normaliza con la ventana del propio spot (prevision.js).
// En NZ no hace falta modelo: LINZ publica las pleamares y bajamares de 87
// puertos (CSV, 2025-2029) y las diferencias de 314 puertos secundarios
// respecto a su puerto estándar. Aquí solo hay lógica pura (sin red): el
// script scripts/fuentes/linz-mareas.mjs descarga y deja los datos en
// datos/nz/, y este módulo los lee. Lo importan las Functions, el script y
// los tests.
//
// Cómo se calcula (método que explica LINZ en "how to calculate tide times
// and heights"):
//   - Puerto con tabla propia: sus pleamares y bajamares tal cual.
//   - Puerto secundario: hora = hora del puerto estándar + diferencia media
//     (de pleamar o de bajamar); altura = (altura estándar - NMM estándar)
//     × razón de rangos + NMM del secundario.
//   - Entre dos extremos, interpolación con coseno (curva de media onda).
//   - Las alturas son sobre el cero hidrográfico de la carta (como en una
//     tabla de mareas normal), no anomalías.
//
// Licencia: LINZ declara CC BY 4.0 para su contenido salvo indicación en
// contra (https://www.linz.govt.nz/copyright); la página de mareas solo
// dice "Crown copyright". Pendiente de confirmación escrita de LINZ (ver
// CLAUDE.md, "Nueva Zelanda"). Atribución y aviso obligatorios abajo.

export const ZONA_NZ = "Pacific/Auckland";
export const ATRIBUCION_LINZ =
  "Sourced from Land Information New Zealand data (CC BY 4.0)";
export const AVISO_LINZ =
  "Not official tide tables as specified in Maritime Rules Part 25. Times and heights are predictions.";
export const FUENTE_LINZ = "LINZ tide predictions";

const MIN_MS = 60000;

// ---------------------------------------------------------------------------
// Zona horaria (sin depender de eje-horario.js, que solo conoce Madrid/UTC)
// ---------------------------------------------------------------------------
const formateadores = new Map();
function partesLocales(ms, tz) {
  let f = formateadores.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    formateadores.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute };
}

// Minutos que `tz` va por delante de UTC en el instante `ms`.
export function desfaseZona(ms, tz = ZONA_NZ) {
  const p = partesLocales(ms, tz);
  return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / MIN_MS) * MIN_MS) / MIN_MS);
}

// Hora local (la de las tablas de LINZ: "Local Std or Daylight Time") a
// instante UTC en ms. En la hora repetida del cambio de abril se queda con
// la primera (horario de verano); LINZ no da horas inexistentes.
export function localAUtc(y, mo, d, h, mi, tz = ZONA_NZ) {
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi);
  const off1 = desfaseZona(comoUtc - 13 * 60 * MIN_MS, tz);
  const t1 = comoUtc - off1 * MIN_MS;
  const off2 = desfaseZona(t1, tz);
  if (off2 === off1) return t1;
  const t2 = comoUtc - off2 * MIN_MS;
  return desfaseZona(t2, tz) === off2 ? t2 : t1;
}

const p2 = (n) => String(n).padStart(2, "0");
// "2026-10-09T14:05" en hora local de `tz`.
export function etiquetaLocal(ms, tz = ZONA_NZ) {
  const p = partesLocales(ms, tz);
  return `${p.y}-${p2(p.mo)}-${p2(p.d)}T${p2(p.h)}:${p2(p.mi)}`;
}

// ---------------------------------------------------------------------------
// Parseo de los CSV de LINZ
// ---------------------------------------------------------------------------

// "36°51'S" -> -36.85 ; "174°46'E" -> 174.7667
function gradosMinutos(texto) {
  const m = /(\d+)\D+(\d+(?:\.\d+)?)\D*([NSEW])/.exec(texto || "");
  if (!m) return null;
  const v = +m[1] + +m[2] / 60;
  return m[3] === "S" || m[3] === "W" ? -v : v;
}

// Tabla anual de un puerto ("Auckland 2026.csv"):
//   070,Auckland,36°51'S,174°46'E
//   Based on constituent set with reference date:,31-Dec-2014
//   Local Std or Daylight Time,Tidal heights in metres.
//   1,Th,1,2026,05:47,3.1,11:51,0.9,18:06,3.1,,
// Devuelve los extremos en UTC (ms) con su altura y su tipo.
export function parsearTablaLinz(texto, tz = ZONA_NZ) {
  const lineas = String(texto).replace(/^﻿/, "").split(/\r?\n/);
  const cab = (lineas[0] || "").split(",").map((s) => s.trim());
  if (cab.length < 4 || !/^\d+$/.test(cab[0])) throw new Error("cabecera de tabla LINZ no reconocida");
  const eventos = [];
  for (const linea of lineas.slice(1)) {
    const c = linea.split(",").map((s) => s.trim());
    if (c.length < 6 || !/^\d+$/.test(c[0]) || !/^\d{4}$/.test(c[3])) continue;
    const [d, , mo, y] = [+c[0], c[1], +c[2], +c[3]];
    for (let i = 4; i + 1 < c.length; i += 2) {
      const hm = /^(\d{1,2}):(\d{2})$/.exec(c[i]);
      if (!hm || c[i + 1] === "" || !Number.isFinite(+c[i + 1])) continue;
      eventos.push({ t: localAUtc(y, mo, d, +hm[1], +hm[2], tz), h: +c[i + 1] });
    }
  }
  eventos.sort((a, b) => a.t - b.t);
  return {
    estacion: cab[0],
    nombre: cab[1],
    lat: gradosMinutos(cab[2]),
    lon: gradosMinutos(cab[3]),
    eventos: conTipo(eventos),
  };
}

// Pleamar si está por encima de sus vecinos; bajamar si por debajo. Los
// extremos de la lista se deciden con el único vecino que tienen.
export function conTipo(eventos) {
  return eventos.map((e, i) => {
    const vecino = eventos[i + 1] || eventos[i - 1];
    const tipo = vecino && e.h < vecino.h ? "bajamar" : "pleamar";
    return { ...e, tipo };
  });
}

// "+0012" -> 12 ; "-0134" -> -94 ; "0000" -> 0 ; "-" -> null
function minutosDif(texto) {
  const m = /^([+-]?)(\d{2})(\d{2})$/.exec(String(texto || "").trim());
  if (!m) return null;
  const v = +m[2] * 60 + +m[3];
  return m[1] === "-" ? -v : v;
}
const num = (s) => (s !== undefined && s !== "" && s !== "-" && Number.isFinite(+s) ? +s : null);

// Tabla de puertos secundarios (NZNA_Secondary-ports-AAAA-AA.csv). Cada
// bloque empieza por su puerto estándar (con "hhmm" en las diferencias) y
// los puertos siguientes se refieren a él hasta el siguiente estándar.
export function parsearSecundariosLinz(texto) {
  const filas = String(texto).replace(/^﻿/, "").split(/\r?\n/).map((l) => l.split(",").map((s) => s.trim()));
  const puertos = {};
  let estandar = null;
  for (const c of filas) {
    if (!c[0] || !c[1] || !/^\d{4}[a-z]?$/.test(c[0])) continue;
    const esEstandar = c[6] === "hhmm";
    if (esEstandar) estandar = c[0];
    const lat = num(c[2]) !== null && num(c[3]) !== null ? -(+c[2] + +c[3] / 60) : null;
    const lon = num(c[4]) !== null && num(c[5]) !== null ? +c[4] + +c[5] / 60 : null;
    puertos[c[0]] = {
      id: c[0],
      nombre: c[1],
      lat: lat === null ? null : +lat.toFixed(4),
      lon: lon === null ? null : +lon.toFixed(4),
      estandar: esEstandar ? null : estandar,
      dif_pleamar_min: esEstandar ? 0 : minutosDif(c[6]),
      dif_bajamar_min: esEstandar ? 0 : minutosDif(c[8]),
      mhws: num(c[10]), mhwn: num(c[11]), mlwn: num(c[12]), mlws: num(c[13]), msl: num(c[14]),
      razon: esEstandar ? 1 : num(c[15]),
      aproximado: c[16] === "*",
    };
  }
  return puertos;
}

// ---------------------------------------------------------------------------
// Formato compacto en disco: { t0 (min UTC), d: [dt_min, h_cm, dt_min, h_cm...] }
// ---------------------------------------------------------------------------
export function comprimirEventos(eventos) {
  if (!eventos.length) return { t0: null, d: [] };
  const t0 = Math.round(eventos[0].t / MIN_MS);
  const d = [];
  let prev = t0;
  for (const e of eventos) {
    const m = Math.round(e.t / MIN_MS);
    d.push(m - prev, Math.round(e.h * 100));
    prev = m;
  }
  return { t0, d };
}

export function descomprimirEventos(c) {
  if (!c || c.t0 === null || c.t0 === undefined) return [];
  const eventos = [];
  let m = c.t0;
  for (let i = 0; i + 1 < c.d.length; i += 2) {
    m += c.d[i];
    eventos.push({ t: m * MIN_MS, h: c.d[i + 1] / 100 });
  }
  return conTipo(eventos);
}

// Junta los años (cada uno: { puertos: { nombreTabla: compacto } }) en una
// sola serie ordenada para la tabla `nombre`.
export function eventosTabla(anios, nombre) {
  const todos = [];
  for (const a of anios || []) {
    const c = a?.puertos?.[nombre];
    if (c) todos.push(...descomprimirEventos(c).map(({ t, h }) => ({ t, h })));
  }
  todos.sort((a, b) => a.t - b.t);
  const unicos = todos.filter((e, i) => i === 0 || e.t !== todos[i - 1].t);
  return conTipo(unicos);
}

// ---------------------------------------------------------------------------
// Puertos secundarios y elección del puerto de cada spot
// ---------------------------------------------------------------------------

// Aplica las diferencias de un secundario a los extremos de su estándar.
export function derivarSecundario(eventosEstandar, sec, est) {
  if (!sec || !est) return [];
  const { dif_pleamar_min: dP, dif_bajamar_min: dB, razon, msl } = sec;
  if (dP === null || dB === null || razon === null || msl === null || est.msl === null) return [];
  return eventosEstandar
    .map((e) => ({
      t: e.t + (e.tipo === "pleamar" ? dP : dB) * MIN_MS,
      h: +((e.h - est.msl) * razon + msl).toFixed(2),
      tipo: e.tipo,
    }))
    .sort((a, b) => a.t - b.t);
}

// Distancia en km (haversine).
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Margen a favor de un puerto con tabla propia: si está como mucho así de
// más lejos que el secundario más cercano, se usa la tabla (es la
// predicción completa de LINZ, sin la aproximación de las diferencias
// medias).
export const MARGEN_TABLA_KM = 1;

// Elige el puerto LINZ de un spot dentro del catálogo
// (datos/nz/linz-puertos.json): el más cercano con datos utilizables.
// Devuelve { id, nombre, km, tabla } donde `tabla` es el nombre del CSV
// propio, o null si se calcula como secundario de su puerto estándar.
export function asignarPuerto(spot, catalogo) {
  const { secundarios = {}, tablas = {} } = catalogo || {};
  let mejor = null;
  const proponer = (cand, km, efectivo) => {
    if (!mejor || efectivo < mejor.efectivo) mejor = { ...cand, km: +km.toFixed(1), efectivo };
  };
  for (const [nombre, t] of Object.entries(tablas)) {
    if (t.lat === null || t.lon === null) continue;
    const km = distanciaKm(spot.lat, spot.lon, t.lat, t.lon);
    proponer({ id: t.secundario || null, nombre, tabla: nombre }, km, km - MARGEN_TABLA_KM);
  }
  for (const p of Object.values(secundarios)) {
    if (p.tabla || p.lat === null || p.lon === null) continue;
    const est = p.estandar ? secundarios[p.estandar] : null;
    const usable = p.dif_pleamar_min !== null && p.dif_bajamar_min !== null && p.razon !== null &&
      p.msl !== null && est?.tabla && est.msl !== null;
    if (!usable) continue;
    const km = distanciaKm(spot.lat, spot.lon, p.lat, p.lon);
    proponer({ id: p.id, nombre: p.nombre, tabla: null }, km, km);
  }
  if (!mejor) return null;
  const { efectivo, ...puerto } = mejor;
  return puerto;
}

// Extremos (UTC) del puerto de un spot. `anios`: los JSON anuales.
export function eventosDePuerto(puerto, catalogo, anios) {
  if (!puerto) return [];
  if (puerto.tabla) return eventosTabla(anios, puerto.tabla);
  const sec = catalogo?.secundarios?.[puerto.id];
  const est = sec?.estandar ? catalogo.secundarios[sec.estandar] : null;
  if (!est?.tabla) return [];
  return derivarSecundario(eventosTabla(anios, est.tabla), sec, est);
}

// Constantes (MHWS, MLWS...) del puerto: las del secundario por id o, para
// una tabla sin id, las del secundario que tenga esa tabla.
export function constantesDePuerto(puerto, catalogo) {
  const sec = catalogo?.secundarios || {};
  if (puerto?.id && sec[puerto.id]) return sec[puerto.id];
  if (puerto?.tabla) return Object.values(sec).find((p) => p.tabla === puerto.tabla) || null;
  return null;
}

// ---------------------------------------------------------------------------
// Altura, tendencia y coeficiente
// ---------------------------------------------------------------------------

// Altura en el instante t, con interpolación coseno entre los dos extremos
// que lo rodean. null fuera de la serie.
export function alturaEn(eventos, t) {
  let i = eventos.findIndex((e) => e.t > t);
  if (i <= 0) return eventos.length && eventos[0].t === t ? eventos[0].h : null;
  const a = eventos[i - 1];
  const b = eventos[i];
  const f = (t - a.t) / (b.t - a.t);
  return a.h + (b.h - a.h) * (1 - Math.cos(Math.PI * f)) / 2;
}

// Coeficiente propio, análogo al español (escala 20-120 donde 100 es la
// marea viva media): rango de la pleamar (pleamar menos la media de las
// bajamares que la rodean) frente al rango medio de mareas vivas del
// puerto (MHWS - MLWS) de LINZ. La marea muerta media sale en torno a
// 100 × (MHWN - MLWN)/(MHWS - MLWS): ~65 en Auckland, distinto en cada
// puerto, como pasa de verdad (en NZ las muertas son menos muertas que en
// Brest). No es un dato oficial de LINZ, es cuenta nuestra sobre sus datos.
export function coeficientePleamar(eventos, i, constantes) {
  const e = eventos[i];
  if (!e || e.tipo !== "pleamar") return null;
  const vivas = constantes && constantes.mhws !== null && constantes.mlws !== null ? constantes.mhws - constantes.mlws : null;
  if (!vivas || vivas <= 0) return null;
  const bajas = [eventos[i - 1], eventos[i + 1]].filter((x) => x && x.tipo === "bajamar");
  if (!bajas.length) return null;
  const rango = e.h - bajas.reduce((s, x) => s + x.h, 0) / bajas.length;
  return Math.max(20, Math.min(120, Math.round((100 * rango) / vivas)));
}

// Coeficiente del día local (el mayor de sus pleamares, como en las tablas
// españolas que dan uno por pleamar y se lee el del día).
export function coeficienteDia(eventos, diaLocal, constantes, tz = ZONA_NZ) {
  let max = null;
  eventos.forEach((e, i) => {
    if (e.tipo !== "pleamar" || etiquetaLocal(e.t, tz).slice(0, 10) !== diaLocal) return;
    const c = coeficientePleamar(eventos, i, constantes);
    if (c !== null && (max === null || c > max)) max = c;
  });
  return max;
}

// Marea de un spot NZ en el instante `ahora`, con la misma forma que
// calcularMarea() de prevision.js: { altura, tendencia, proximas[2],
// coeficiente } más el puerto, la fuente, la atribución y el aviso.
export function mareaSpotNZ(spot, catalogo, anios, ahora = Date.now()) {
  const puerto = spot?.puerto_linz || null;
  const eventos = eventosDePuerto(puerto, catalogo, anios);
  if (!eventos.length) return null;
  const tz = spot.tz || ZONA_NZ;
  const actual = alturaEn(eventos, ahora);
  if (actual === null) return null;
  const sig = eventos.find((e) => e.t > ahora);
  const hoy = etiquetaLocal(ahora, tz).slice(0, 10);
  const proximas = eventos
    .filter((e) => e.t > ahora)
    .slice(0, 2)
    .map((e) => {
      const et = etiquetaLocal(e.t, tz);
      return { tipo: e.tipo, hora: et.slice(11, 16), fecha: et.slice(0, 10), manana: et.slice(0, 10) !== hoy, altura: +e.h.toFixed(2) };
    });
  return {
    altura: +actual.toFixed(2),
    tendencia: sig ? (sig.tipo === "pleamar" ? "subiendo" : "bajando") : null,
    proximas,
    coeficiente: coeficienteDia(eventos, hoy, constantesDePuerto(puerto, catalogo), tz),
    referencia: "cero hidrográfico (chart datum)",
    puerto: { id: puerto.id, nombre: puerto.nombre, km: puerto.km, metodo: puerto.tabla ? "tabla" : "secundario" },
    fuente: FUENTE_LINZ,
    atribucion: ATRIBUCION_LINZ,
    aviso: AVISO_LINZ,
  };
}
