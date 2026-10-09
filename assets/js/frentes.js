// assets/js/frentes.js
// 〰 Frentes y corrientes (2026-10-09, pedido de Mikel). Cálculo puro, sin
// DOM ni red: lo usan index.html (window.Frentes: imagen, flechas y toque en
// el mapa), el aprendizaje semanal (scripts/aprendizaje/frentes-sombra.mjs:
// rasgos de cada salida) y test/frentes.test.js.
//
// El fichero lo escribe scripts/fuentes/descargar-capas.py (método, umbrales
// y fuentes allí y en CLAUDE.md, "Capas del mapa"). Un byte por celda, fila
// 0 = norte, 255 = tierra o sin dato:
//   bit 0 frente de clorofila, bit 1 frente térmico, bit 2 convergencia de
//   la corriente, bits 3-4 nivel de clorofila (0 sin dato, 1 baja,
//   2 moderada, 3 alta / posible bloom), bit 5 franja costera (clorofila
//   no fiable), bit 6 nubes (el satélite no vio el agua ese día).
// Corriente (flechas): malla más gruesa, u y v en bytes con signo
// (127 = 0, escala_ms por unidad, 255 = sin dato).

import { filaDeDatos, filaReal } from "./capas-mar.js";

export const BITS = { frente_clorofila: 1, frente_termico: 2, convergencia: 4, costa: 32, nubes: 64 };
export const NIVELES = [null, "baja", "moderada", "alta"];

export function decodificar(b) {
  if (b === 255 || b === undefined) return null;
  return {
    frenteClorofila: !!(b & 1), frenteTermico: !!(b & 2), convergencia: !!(b & 4),
    nivel: (b >> 3) & 3, costa: !!(b & 32), nubes: !!(b & 64),
  };
}

// Clase de color de una celda para el mapa (una por celda, la más útil).
//   "doble": dos señales a la vez (clorofila + térmico, o frente + la
//   corriente junta el agua en esa celda o al lado); "clorofila"; "termico";
//   "convergencia"; "sin_dato" (costa o nubes, sin frente térmico ni
//   convergencia); null = nada que pintar.
export function claseCelda(d, bytes, f, c) {
  const x = decodificar(bytes[f * d.columnas + c]);
  if (!x) return null;
  const frente = x.frenteClorofila || x.frenteTermico;
  if ((x.frenteClorofila && x.frenteTermico) || (frente && convergenciaCerca(d, bytes, f, c))) return "doble";
  if (x.frenteClorofila) return "clorofila";
  if (x.frenteTermico) return "termico";
  if (x.convergencia) return "convergencia";
  if (x.costa || x.nubes) return "sin_dato";
  return null;
}

function convergenciaCerca(d, bytes, f, c) {
  for (let i = f - 1; i <= f + 1; i++) {
    for (let j = c - 1; j <= c + 1; j++) {
      if (i < 0 || j < 0 || i >= d.filas || j >= d.columnas) continue;
      const b = bytes[i * d.columnas + j];
      if (b !== 255 && b & BITS.convergencia) return true;
    }
  }
  return false;
}

// Colores por clase (RGBA). Los decide index.html (paleta del mapa); estos
// son los de por defecto y los de los tests.
export const COLORES_FRENTES = {
  doble: [214, 51, 108, 255],
  clorofila: [70, 176, 74, 255],
  termico: [242, 140, 56, 255],
  convergencia: [79, 183, 201, 150],
  sin_dato: [140, 150, 165, 70],
};

// RGBA (W*H*4) re-muestreado a Mercator fila a fila, como pixelesCapa.
export function pixelesFrentes(d, bytes, colores = COLORES_FRENTES) {
  const W = d.columnas, H = d.filas;
  const px = new Uint8ClampedArray(W * H * 4);
  const cache = new Map();
  for (let r = 0; r < H; r++) {
    const f = filaDeDatos(d, r, H);
    for (let c = 0; c < W; c++) {
      const k = f * W + c;
      let cl = cache.get(k);
      if (cl === undefined) { cl = claseCelda(d, bytes, f, c); cache.set(k, cl); }
      if (!cl) continue;
      const o = (r * W + c) * 4;
      px.set(colores[cl], o);
    }
  }
  return px;
}

// Trazos de 〰 Frentes para combinarse con otra capa (2026-10-09, varias
// capas a la vez): solo los bordes (doble, clorofila, térmico), sin el gris
// de "sin dato" ni el celeste tenue de la convergencia, que taparían el color
// de la capa de fondo; `factor` píxeles por celda y un halo blanco de un
// píxel en el contorno de cada trazo para que se lea sobre cualquier color.
export const CLASES_TRAZO = ["doble", "clorofila", "termico"];
export const HALO_TRAZO = [255, 255, 255, 235];
export function pixelesFrentesTrazo(d, bytes, colores = COLORES_FRENTES, factor = 4, halo = HALO_TRAZO) {
  const W = d.columnas * factor, H = d.filas * factor;
  const px = new Uint8ClampedArray(W * H * 4);
  const clases = new Array(d.filas * d.columnas);
  const clase = (f, c) => {
    if (f < 0 || c < 0 || f >= d.filas || c >= d.columnas) return null;
    const k = f * d.columnas + c;
    if (clases[k] === undefined) {
      const cl = claseCelda(d, bytes, f, c);
      clases[k] = CLASES_TRAZO.includes(cl) ? cl : null;
    }
    return clases[k];
  };
  const borde = 1 / factor;
  for (let r = 0; r < H; r++) {
    const fr = Math.min(d.filas - 1e-9, Math.max(0, filaReal(d, r, H)));
    const f = Math.floor(fr), sub = fr - f;
    for (let x = 0; x < W; x++) {
      const c = Math.floor(x / factor), subc = x - c * factor;
      const cl = clase(f, c);
      if (!cl) continue;
      const enBorde = (subc === 0 && !clase(f, c - 1)) || (subc === factor - 1 && !clase(f, c + 1)) ||
        (sub < borde && !clase(f - 1, c)) || (sub >= 1 - borde && !clase(f + 1, c));
      const o = (r * W + x) * 4;
      px.set(enBorde ? halo : colores[cl], o);
      if (!enBorde) px[o + 3] = 255;
    }
  }
  return { ancho: W, alto: H, px };
}

// ---------------------------------------------------------------------------
// Distancias y rasgos de un punto (km). Celda = la de (lat, lon); distancia
// entre centros con la aproximación equirrectangular (sobra a < 50 km).
// ---------------------------------------------------------------------------
const KM_LAT = 110.57;
function kmEntre(lat1, lon1, lat2, lon2) {
  const x = (lon2 - lon1) * 111.32 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = (lat2 - lat1) * KM_LAT;
  return Math.hypot(x, y);
}
export function celdaDe(d, lat, lon) {
  const f = Math.floor((d.norte - lat) / d.paso);
  const c = Math.floor((lon - d.oeste) / d.paso);
  if (f < 0 || c < 0 || f >= d.filas || c >= d.columnas) return null;
  return { f, c };
}
const centro = (d, f, c) => [d.norte - (f + 0.5) * d.paso, d.oeste + (c + 0.5) * d.paso];

// Recorre las celdas a radioKm o menos del punto: devuelve la distancia
// mínima de las que cumplen `cumple` y si alguna celda era `evaluable`
// (para distinguir "no hay frente" de "no hay dato").
function buscar(d, bytes, lat, lon, radioKm, cumple, evaluable) {
  const ni = Math.ceil(radioKm / (d.paso * KM_LAT)) + 1;
  const nj = Math.ceil(radioKm / (d.paso * 111.32 * Math.cos((lat * Math.PI) / 180))) + 1;
  const f0 = Math.floor((d.norte - lat) / d.paso), c0 = Math.floor((lon - d.oeste) / d.paso);
  let min = null, hayEvaluable = false;
  for (let f = f0 - ni; f <= f0 + ni; f++) {
    if (f < 0 || f >= d.filas) continue;
    for (let c = c0 - nj; c <= c0 + nj; c++) {
      if (c < 0 || c >= d.columnas) continue;
      const b = bytes[f * d.columnas + c];
      if (b === 255) continue;
      const [la, lo] = centro(d, f, c);
      const km = kmEntre(lat, lon, la, lo);
      if (km > radioKm) continue;
      if (evaluable(b)) hayEvaluable = true;
      if (cumple(b, f, c) && (min === null || km < min)) min = km;
    }
  }
  return { min, hayEvaluable };
}
const chlEvaluable = (b) => ((b >> 3) & 3) > 0;
const mar = () => true;

// Velocidad de la corriente (m/s) en la celda de mar más cercana a
// radioKm o menos; `vel` = bytes de velocidad (0,02 m/s por unidad) en la
// misma malla que los códigos (histórico) o null.
export function velocidadEn(d, bytes, vel, lat, lon, radioKm = 10, escala = d.escala_velocidad_ms ?? 0.02) {
  if (!vel) return null;
  let mejor = null;
  const r = buscar(d, bytes, lat, lon, radioKm, (b, f, c) => {
    const v = vel[f * d.columnas + c];
    if (v === 255) return false;
    const [la, lo] = centro(d, f, c);
    const km = kmEntre(lat, lon, la, lo);
    if (!mejor || km < mejor.km) mejor = { km, ms: v * escala };
    return true;
  }, mar);
  return r.min === null ? null : +mejor.ms.toFixed(3);
}

// Rasgos de un punto para el aprendizaje (sin presuponer el signo de nada):
//   frente_clorofila, frente_termico, frente_ambos, convergencia,
//   frente_y_corriente: true/false a radioKm o menos, null sin dato;
//   dist_*_km: la distancia si lo hay; nivel_clorofila: "baja" | "moderada"
//   | "alta" | null (la celda evaluable más cercana a 15 km o menos: pegado
//   a la costa no hay dato fiable); corriente_ms (m/s) o null.
export function rasgosPunto(d, bytes, lat, lon, { radioKm = 10, vel = null, radioNivelKm = 15 } = {}) {
  if (!celdaDe(d, lat, lon)) return null;
  const tiene = (bit) => (b) => !!(b & bit);
  const sal = {};
  const pon = (nombre, r) => {
    sal[nombre] = r.hayEvaluable ? r.min !== null : null;
    sal[`dist_${nombre}_km`] = r.min === null ? null : +r.min.toFixed(1);
  };
  pon("frente_clorofila", buscar(d, bytes, lat, lon, radioKm, tiene(BITS.frente_clorofila), chlEvaluable));
  pon("frente_termico", buscar(d, bytes, lat, lon, radioKm, tiene(BITS.frente_termico), mar));
  pon("frente_ambos", buscar(d, bytes, lat, lon, radioKm, (b) => (b & 3) === 3, chlEvaluable));
  pon("convergencia", buscar(d, bytes, lat, lon, radioKm, tiene(BITS.convergencia), mar));
  pon("frente_y_corriente", buscar(d, bytes, lat, lon, radioKm, (b, f, c) => (b & 3) !== 0 && convergenciaCerca(d, bytes, f, c), mar));
  let nivel = null, kmNivel = null;
  buscar(d, bytes, lat, lon, radioNivelKm, (b, f, c) => {
    if (!chlEvaluable(b)) return false;
    const [la, lo] = centro(d, f, c);
    const km = kmEntre(lat, lon, la, lo);
    if (kmNivel === null || km < kmNivel) { kmNivel = km; nivel = NIVELES[(b >> 3) & 3]; }
    return true;
  }, chlEvaluable);
  sal.nivel_clorofila = nivel;
  sal.corriente_ms = velocidadEn(d, bytes, vel, lat, lon);
  return sal;
}

// ---------------------------------------------------------------------------
// Contexto para las reglas expertas del índice (2026-10-09, "frentes en el
// índice"): variables de contexto de reglas-expertas.js. Mismo cálculo que
// los rasgos del aprendizaje (rasgosPunto), con un radio de búsqueda fijo de
// RADIO_CONTEXTO_KM; cada regla pone su distancia en la condición.
//   frente_km            distancia (km) al frente de clorofila o térmico más
//                        cercano; SIN_FRENTE_KM si no hay ninguno en el radio;
//                        null fuera de la malla
//   frente_clorofila_km  igual, solo bordes de clorofila; null si alrededor no
//                        hay clorofila fiable (nubes o franja costera)
//   clorofila_nivel      "baja" | "moderada" | "alta" | null (sin dato fiable)
//   corriente_ms         fuerza de la corriente media del día sin marea (m/s)
//                        en la celda de mar más cercana a 10 km o menos; null
// Sin dato, null: la regla que lo mira NO aplica (nunca penaliza).
// ---------------------------------------------------------------------------
export const RADIO_CONTEXTO_KM = 30;
export const SIN_FRENTE_KM = 99;
export function contextoFrentes(d, bytes, lat, lon, { vel = null } = {}) {
  const vacio = { frente_km: null, frente_clorofila_km: null, clorofila_nivel: null, corriente_ms: null };
  if (!d || !bytes || !Number.isFinite(lat) || !Number.isFinite(lon)) return vacio;
  const r = rasgosPunto(d, bytes, lat, lon, { radioKm: RADIO_CONTEXTO_KM, vel });
  if (!r) return vacio;
  const dist = (nombre) => (r[nombre] === null ? null : r[nombre] ? r[`dist_${nombre}_km`] : SIN_FRENTE_KM);
  const chl = dist("frente_clorofila"), ter = dist("frente_termico");
  const frente = [chl, ter].filter((x) => x !== null);
  return {
    frente_km: frente.length ? Math.min(...frente) : null,
    frente_clorofila_km: chl,
    clorofila_nivel: r.nivel_clorofila,
    corriente_ms: r.corriente_ms,
  };
}

// Velocidad en la malla de los códigos del fichero del día (frentes.json:
// corriente.velocidad en base64, misma malla) o del histórico (ya decodificada).
export function bytesVelocidadDia(d, deBase64) {
  const k = d?.corriente;
  if (!k?.velocidad || !deBase64) return null;
  const b = deBase64(k.velocidad);
  return b.length === d.filas * d.columnas ? b : null;
}

// ---------------------------------------------------------------------------
// Corriente: flechas para el mapa y texto del toque
// ---------------------------------------------------------------------------
export function componenteByte(b, escala) {
  return b === 255 || b === undefined ? null : (b - 127) * escala;
}
const RUMBOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
// Rumbo HACIA donde va la corriente (u al este, v al norte).
export function rumbo(u, v) {
  const g = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
  return RUMBOS[Math.round(g / 45) % 8];
}

// Flechas de la malla gruesa dentro de `caja` ({ norte, sur, oeste, este }),
// saltando celdas para que salgan como mucho `maxPorLado` por lado (legible
// en el móvil). Devuelve [{ lat, lon, u, v, ms }].
export function flechasVisibles(d, uBytes, vBytes, caja, maxPorLado = 12) {
  const k = d.corriente;
  if (!k) return [];
  const f0 = Math.max(0, Math.floor((d.norte - caja.norte) / k.paso));
  const f1 = Math.min(k.filas - 1, Math.floor((d.norte - caja.sur) / k.paso));
  const c0 = Math.max(0, Math.floor((caja.oeste - d.oeste) / k.paso));
  const c1 = Math.min(k.columnas - 1, Math.floor((caja.este - d.oeste) / k.paso));
  if (f1 < f0 || c1 < c0) return [];
  const salto = Math.max(1, Math.ceil(Math.max(f1 - f0 + 1, c1 - c0 + 1) / maxPorLado));
  const sal = [];
  for (let f = f0 - (f0 % salto); f <= f1; f += salto) {
    if (f < f0) continue;
    for (let c = c0 - (c0 % salto); c <= c1; c += salto) {
      if (c < c0) continue;
      const u = componenteByte(uBytes[f * k.columnas + c], k.escala_ms);
      const v = componenteByte(vBytes[f * k.columnas + c], k.escala_ms);
      if (u === null || v === null) continue;
      sal.push({ lat: d.norte - (f + 0.5) * k.paso, lon: d.oeste + (c + 0.5) * k.paso, u, v, ms: Math.hypot(u, v) });
    }
  }
  return sal;
}

const fmt1 = (x) => String(+x.toFixed(1)).replace(".", ",");
export function textoCorriente(u, v) {
  if (u === null || v === null) return null;
  const ms = Math.hypot(u, v);
  if (ms < 0.03) return "Corriente casi nula";
  return `Corriente hacia el ${rumbo(u, v)}: ${fmt1(ms * 3.6)} km/h (${fmt1(ms * 1.94384)} nudos)`;
}

// Corriente (u, v) de la malla gruesa en un punto, o nulls.
export function corrienteEn(d, uBytes, vBytes, lat, lon) {
  const k = d.corriente;
  if (!k || !uBytes) return { u: null, v: null };
  const f = Math.floor((d.norte - lat) / k.paso), c = Math.floor((lon - d.oeste) / k.paso);
  if (f < 0 || c < 0 || f >= k.filas || c >= k.columnas) return { u: null, v: null };
  return { u: componenteByte(uBytes[f * k.columnas + c], k.escala_ms), v: componenteByte(vBytes[f * k.columnas + c], k.escala_ms) };
}

// Texto del toque en el mapa, en lenguaje llano (sin cifras de umbrales).
export function describirPunto(d, bytes, lat, lon, corr = { u: null, v: null }) {
  const cel = celdaDe(d, lat, lon);
  if (!cel) return "Fuera de la zona con datos";
  const x = decodificar(bytes[cel.f * d.columnas + cel.c]);
  if (!x) return "Tierra o sin dato aquí";
  const r = rasgosPunto(d, bytes, lat, lon, { radioKm: 10 });
  const lineas = [];
  const cerca = (nombre) => (r[`dist_${nombre}_km`] <= 3 ? "aquí mismo" : `a unos ${Math.round(r[`dist_${nombre}_km`])} km`);
  if (r.frente_ambos) lineas.push(`Borde de clorofila y de temperatura ${cerca("frente_ambos")}: lo más prometedor`);
  else if (r.frente_y_corriente) lineas.push(`Frente donde la corriente junta el agua ${cerca("frente_y_corriente")}: muy prometedor`);
  else {
    if (r.frente_clorofila) lineas.push(`Borde de clorofila ${cerca("frente_clorofila")}`);
    if (r.frente_termico) lineas.push(`Cambio de temperatura ${cerca("frente_termico")}`);
  }
  if (!lineas.length && r.convergencia) lineas.push(`La corriente junta el agua ${cerca("convergencia")}`);
  // Sin clorofila fiable alrededor (nubes o costa) no se puede decir "sin frentes".
  if (!lineas.length) lineas.push(r.frente_clorofila === null ? "Sin cambios de temperatura a menos de 10 km; la clorofila hoy no se ve" : "Sin frentes a menos de 10 km");
  if (x.costa) lineas.push("Pegado a la costa la clorofila del satélite no es fiable");
  else if (x.nubes) lineas.push("Hoy había nubes: sin clorofila fiable aquí");
  const tc = textoCorriente(corr.u, corr.v);
  if (tc) lineas.push(tc);
  return lineas.join(". ") + ".";
}
