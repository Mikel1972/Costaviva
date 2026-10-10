// assets/js/capas-mar.js
// Cálculo puro de las capas de mar del mapa (🌿 clorofila y 🌡 temperatura
// del agua, 2026-10-08, fase 2 de fuentes gratuitas). Sin DOM ni red: lo usa
// index.html (window.CapasMar) y test/fuentes-fase2.test.js en node --test.
//
// El formato lo escribe scripts/fuentes/descargar-capas.py:
//   { norte, sur, oeste, este, paso, filas, columnas, escala, datos (base64) }
//   un byte por celda, fila 0 = norte, 255 = sin dato.
//   escala log10:  valor = 10 ** (min + b * (max - min) / 254)
//   escala lineal: valor = min + b * paso

export function bytesDeBase64(b64, atobImpl = globalThis.atob) {
  const bin = atobImpl(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function valorByte(b, escala) {
  if (b === 255 || b === undefined) return null;
  return escala.tipo === "log10" ? 10 ** (escala.min + (b * (escala.max - escala.min)) / 254) : escala.min + b * escala.paso;
}

// Valor de la capa en un punto, o null (fuera de la rejilla, tierra o sin
// observación).
export function valorEnPunto(d, bytes, lat, lon) {
  const f = Math.floor((d.norte - lat) / d.paso);
  const c = Math.floor((lon - d.oeste) / d.paso);
  if (f < 0 || c < 0 || f >= d.filas || c >= d.columnas) return null;
  return valorByte(bytes[f * d.columnas + c], d.escala);
}

// Celda vacía cerca de la costa (2026-10-10, sonda de Mikel en Armintza:
// 19,55 °C medidos y la celda del punto enmascarada por la costa). Si la
// celda del punto no tiene dato, la celda de mar válida más cercana cuyo
// CENTRO esté a maxKm o menos. Devuelve { v, km } (km = 0 si el punto cae en
// una celda con dato) o null. Solo para leer un punto: el pintado del mapa
// no rellena tierra.
export const MAX_KM_CELDA_CERCANA = 5;
const KM_POR_GRADO = 111.2;
export function valorCercano(d, bytes, lat, lon, maxKm = MAX_KM_CELDA_CERCANA) {
  const f0 = Math.floor((d.norte - lat) / d.paso);
  const c0 = Math.floor((lon - d.oeste) / d.paso);
  const dentro = (f, c) => f >= 0 && c >= 0 && f < d.filas && c < d.columnas;
  if (dentro(f0, c0)) {
    const v = valorByte(bytes[f0 * d.columnas + c0], d.escala);
    if (v !== null) return { v, km: 0 };
  }
  if (!(maxKm > 0)) return null;
  const kmLat = d.paso * KM_POR_GRADO;
  const kmLon = kmLat * Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const rf = Math.ceil(maxKm / kmLat) + 1;
  const rc = Math.ceil(maxKm / kmLon) + 1;
  let mejor = null;
  for (let f = f0 - rf; f <= f0 + rf; f++) {
    for (let c = c0 - rc; c <= c0 + rc; c++) {
      if (!dentro(f, c) || (f === f0 && c === c0)) continue;
      const v = valorByte(bytes[f * d.columnas + c], d.escala);
      if (v === null) continue;
      const latC = d.norte - (f + 0.5) * d.paso;
      const lonC = d.oeste + (c + 0.5) * d.paso;
      const km = Math.hypot((latC - lat) * KM_POR_GRADO, (lonC - lon) * KM_POR_GRADO * Math.cos((lat * Math.PI) / 180));
      if (km <= maxKm && (!mejor || km < mejor.km)) mejor = { v, km };
    }
  }
  return mejor;
}

// Leaflet estira una imagen linealmente en Mercator; la rejilla es de lat/lon
// regulares. Para la fila r (de H) de la imagen, la fila de datos que le toca.
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;
export function filaDeDatos(d, r, H = d.filas) {
  return Math.min(d.filas - 1, Math.max(0, Math.floor(filaReal(d, r, H))));
}
// Lo mismo sin redondear (fila 2,7 = 70 % de la celda 2 hacia el sur), para
// las imágenes con varios píxeles por celda (trazos de 〰 Frentes).
export function filaReal(d, r, H = d.filas) {
  const yN = mercY(d.norte);
  const yS = mercY(d.sur);
  const lat = mercLat(yN - ((r + 0.5) / H) * (yN - yS));
  return (d.norte - lat) / d.paso;
}

function hexRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}
// Color de una paleta de paradas para x en [0, 1] (se recorta).
export function colorPaleta(paradas, x) {
  const t = Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)) * (paradas.length - 1);
  const i = Math.min(paradas.length - 2, Math.floor(t));
  const a = hexRgb(paradas[i]);
  const b = hexRgb(paradas[i + 1]);
  const f = t - i;
  return a.map((c, k) => Math.round(c + (b[k] - c) * f));
}

// RGBA (Uint8ClampedArray de W*H*4) listo para un ImageData.
export function pixelesCapa(d, bytes, paradas, valorColor) {
  const lut = new Array(255);
  for (let b = 0; b < 255; b++) lut[b] = colorPaleta(paradas, valorColor(valorByte(b, d.escala)));
  const W = d.columnas;
  const H = d.filas;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let r = 0; r < H; r++) {
    const fila = filaDeDatos(d, r, H);
    for (let c = 0; c < W; c++) {
      const b = bytes[fila * W + c];
      if (b === 255) continue;
      const o = (r * W + c) * 4;
      const rgb = lut[b];
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
    }
  }
  return px;
}
