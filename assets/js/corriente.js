// assets/js/corriente.js
// 🌊 Corriente (2026-10-09, Mikel: "¿La corriente se puede mostrar por
// manchas (con direcciones)?"). Cálculo puro, sin DOM ni red: lo usan
// index.html (window.Corriente: imagen, flechas y toque en el mapa) y
// test/corriente.test.js.
//
// Datos: los mismos de 〰 Frentes (capas/frentes.json, sin fichero nuevo),
// corriente superficial media del día SIN marea del modelo IBI de Copernicus
// (scripts/fuentes/descargar-capas.py):
//   - corriente.velocidad: fuerza (m/s) en la malla de los códigos (1/18°,
//     ~5-6 km), un byte por celda, escala_velocidad_ms por unidad, 255 =
//     tierra o sin dato. Pinta las manchas.
//   - corriente.u / corriente.v: componentes en la malla gruesa de las
//     flechas (1/6°, ~15-18 km). Dan la dirección.
// Si el fichero aún no trae `velocidad` (antes de la primera ejecución del
// job `mar` con este cambio), la fuerza sale de u/v de la malla gruesa: se
// ve igual, con menos detalle.

import { valorEnPunto } from "./capas-mar.js";
import { componenteByte, rumbo } from "./frentes.js";
import { I18n } from "./i18n-modulo.js";

export const NUDO_MS = 1852 / 3600; // 0,5144 m/s
// Tramos en nudos, elegidos mirando el fichero real del 2026-10-09 (IBI sin
// marea, malla de 1/18°): en el Cantábrico y la fachada atlántica la mediana
// es ~0,19 nudos, el percentil 90 ~0,4 y el 99 ~0,6; solo el Estrecho, el
// Mediterráneo y Canarias pasan de 1 nudo. Con <0,2 / 0,2-0,5 / 0,5-1 / >1
// el Cantábrico entero salía en dos colores; así se distinguen sus manchas.
export const TRAMOS_NUDOS = [0.15, 0.3, 0.5, 1];
// Un solo tono (violeta, que no se confunde con el azul del mar del mapa
// base), de claro (casi parada) a oscuro (fuerte).
export const PALETA_CORRIENTE = ["#EADCF8", "#C3A5EC", "#9A6FDA", "#6C3DB8", "#40187F"];

export const nudos = (ms) => ms / NUDO_MS;

// Tramo 0-4 de una velocidad en m/s.
export function tramo(ms) {
  const kn = nudos(ms);
  let i = 0;
  while (i < TRAMOS_NUDOS.length && kn >= TRAMOS_NUDOS[i]) i++;
  return i;
}

const fmt = (x) => I18n.decimal(String(+x.toFixed(x < 1 ? 2 : 1)));
const fmt1 = (x) => I18n.num(x);

// Filas de la leyenda: [color, texto], de menos a más.
export function leyendaTramos() {
  const t = TRAMOS_NUDOS;
  const kmh = (kn) => fmt1(kn * 1.852);
  const filas = [I18n.t("corriente.ley_menos", { kn: fmt(t[0]), kmh: kmh(t[0]) })];
  for (let i = 1; i < t.length; i++) {
    filas.push(I18n.t("corriente.ley_tramo", { a: fmt(t[i - 1]), b: fmt(t[i]), nudos: t[i] === 1 ? I18n.t("corriente.nudo") : I18n.t("corriente.nudos"), kmha: kmh(t[i - 1]), kmhb: kmh(t[i]) }));
  }
  filas.push(I18n.t("corriente.ley_mas", { kn: fmt(t[t.length - 1]), kmh: kmh(t[t.length - 1]) }));
  return filas.map((texto, i) => [PALETA_CORRIENTE[i], texto]);
}

// Malla de fuerza para pintar y para el toque: la fina si el fichero la
// trae; si no, la de las flechas. Mismo formato que las capas de mar
// (capas-mar.js): { norte, sur, oeste, este, paso, filas, columnas, escala,
// bytes, fina }.
export function mallaVelocidad(d, bytesDeBase64) {
  const k = d.corriente;
  if (!k) return null;
  if (k.velocidad) {
    const bytes = bytesDeBase64(k.velocidad);
    if (bytes.length === d.filas * d.columnas) {
      const esc = k.escala_velocidad_ms ?? 0.02;
      return { norte: d.norte, sur: d.sur, oeste: d.oeste, este: d.este, paso: d.paso, filas: d.filas, columnas: d.columnas, escala: { tipo: "lineal", min: 0, paso: esc }, bytes, fina: true };
    }
  }
  const u = bytesDeBase64(k.u), v = bytesDeBase64(k.v);
  const esc = k.escala_ms;
  const bytes = new Uint8Array(k.filas * k.columnas).fill(255);
  for (let i = 0; i < bytes.length; i++) {
    const a = componenteByte(u[i], esc), b = componenteByte(v[i], esc);
    if (a === null || b === null) continue;
    bytes[i] = Math.min(254, Math.round(Math.hypot(a, b) / esc));
  }
  return {
    norte: d.norte, sur: d.norte - k.filas * k.paso, oeste: d.oeste, este: d.oeste + k.columnas * k.paso,
    paso: k.paso, filas: k.filas, columnas: k.columnas, escala: { tipo: "lineal", min: 0, paso: esc }, bytes, fina: false,
  };
}

// Color de cada byte: el del tramo, en escalones (índice / 4 en la paleta de
// 5 paradas de capas-mar.colorPaleta).
export const valorColorCorriente = (ms) => (ms === null ? 0 : tramo(ms) / (PALETA_CORRIENTE.length - 1));

// (u, v) en m/s interpolados (bilineal) de la malla gruesa, ignorando las
// celdas sin dato; null si no hay ninguna alrededor.
export function uvEn(d, uB, vB, lat, lon) {
  const k = d.corriente;
  if (!k || !uB || !vB) return null;
  const y = (d.norte - lat) / k.paso - 0.5, x = (lon - d.oeste) / k.paso - 0.5;
  const f0 = Math.floor(y), c0 = Math.floor(x), fy = y - f0, fx = x - c0;
  let su = 0, sv = 0, sw = 0;
  for (const [f, c, w] of [[f0, c0, (1 - fy) * (1 - fx)], [f0, c0 + 1, (1 - fy) * fx], [f0 + 1, c0, fy * (1 - fx)], [f0 + 1, c0 + 1, fy * fx]]) {
    if (w <= 0 || f < 0 || c < 0 || f >= k.filas || c >= k.columnas) continue;
    const u = componenteByte(uB[f * k.columnas + c], k.escala_ms), v = componenteByte(vB[f * k.columnas + c], k.escala_ms);
    if (u === null || v === null) continue;
    su += w * u; sv += w * v; sw += w;
  }
  return sw > 0 ? { u: su / sw, v: sv / sw } : null;
}

// Corriente en un punto: { ms, u, v } (u, v pueden ser null si no hay
// dirección cerca), o null (tierra, sin dato o fuera de la zona). La fuerza
// es la de la malla de las manchas, para que el número cuadre con el color.
export function corrienteEnPunto(d, malla, uB, vB, lat, lon) {
  if (!malla) return null;
  const ms = valorEnPunto(malla, malla.bytes, lat, lon);
  if (ms === null) return null;
  const uv = uvEn(d, uB, vB, lat, lon);
  return { ms, u: uv ? uv.u : null, v: uv ? uv.v : null };
}

export function dentroDeZona(malla, lat, lon) {
  return !!malla && lat <= malla.norte && lat > malla.sur && lon >= malla.oeste && lon < malla.este;
}

// Frase llana del toque: "Corriente hacia el NE, 0,6 nudos (1,1 km/h)."
export function textoToque(c, dentro = true) {
  if (!dentro) return I18n.t("frentes.fuera_zona") + ".";
  if (!c) return I18n.t("capas.globo.tierra") + ".";
  const kn = nudos(c.ms);
  if (kn < 0.05) return I18n.t("corriente.parada");
  const cifras = `${fmt1(kn)} ${fmt1(kn) === "1" ? I18n.t("corriente.nudo") : I18n.t("corriente.nudos")} (${fmt1(c.ms * 3.6)} km/h)`;
  if (c.u === null || c.v === null || Math.hypot(c.u, c.v) < 1e-6) return I18n.t("corriente.de", { cifras });
  return I18n.t("corriente.hacia", { rumbo: rumbo(c.u, c.v), cifras });
}

// Puntos de una rejilla fija de pantalla (px), como mucho `maxPorLado` en el
// lado largo y nunca a menos de `minPx` (legibles en el móvil).
export function rejillaPantalla(ancho, alto, maxPorLado = 12, minPx = 56) {
  if (!(ancho > 0) || !(alto > 0)) return [];
  const paso = Math.max(minPx, Math.max(ancho, alto) / maxPorLado);
  const nx = Math.max(1, Math.floor(ancho / paso)), ny = Math.max(1, Math.floor(alto / paso));
  const ox = (ancho - (nx - 1) * paso) / 2, oy = (alto - (ny - 1) * paso) / 2;
  const sal = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sal.push({ x: ox + i * paso, y: oy + j * paso });
  return sal;
}

// Flechas para los puntos de pantalla ya pasados a lat/lon ([{x, y, lat,
// lon}]): solo en el mar, con dirección y con algo de corriente. Largo en
// px según la fuerza (de `min` a `max`, tope en 1 nudo).
export function flechasPantalla(d, malla, uB, vB, puntos, { min = 12, max = 34 } = {}) {
  const sal = [];
  for (const p of puntos) {
    const c = corrienteEnPunto(d, malla, uB, vB, p.lat, p.lon);
    if (!c || c.u === null || nudos(c.ms) < 0.05) continue;
    const n = Math.hypot(c.u, c.v);
    if (n < 1e-6) continue;
    const largo = min + (max - min) * Math.min(1, nudos(c.ms) / 1);
    // Pantalla: x al este, y hacia abajo (v al norte => -y).
    sal.push({ x: p.x, y: p.y, dx: c.u / n, dy: -c.v / n, largo, ms: c.ms });
  }
  return sal;
}

// ---------------------------------------------------------------------------
// Manchas suaves: la misma idea que capas-mar.pixelesCapa (imagen
// re-muestreada a Mercator fila a fila, un color por tramo), pero a
// `factor` píxeles por celda y con la fuerza interpolada (bilineal) entre
// celdas de mar, para que los bordes entre tramos salgan como curvas y no
// como escalones de 5 km. Lo que cae en una celda de tierra queda
// transparente (la costa del mapa base manda).
// ---------------------------------------------------------------------------
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;
function hexRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function pixelesCorriente(m, factor = 3, paleta = PALETA_CORRIENTE) {
  const W = m.columnas * factor, H = m.filas * factor;
  const px = new Uint8ClampedArray(W * H * 4);
  const rgb = paleta.map(hexRgb);
  const esc = m.escala.paso;
  const yN = mercY(m.norte), yS = mercY(m.sur);
  const val = (f, c) => {
    if (f < 0 || c < 0 || f >= m.filas || c >= m.columnas) return null;
    const b = m.bytes[f * m.columnas + c];
    return b === 255 ? null : b * esc;
  };
  for (let r = 0; r < H; r++) {
    const lat = mercLat(yN - ((r + 0.5) / H) * (yN - yS));
    const y = (m.norte - lat) / m.paso - 0.5;
    const f0 = Math.floor(y), fy = y - f0;
    const fCerca = Math.round(y);
    for (let k = 0; k < W; k++) {
      const x = (k + 0.5) / factor - 0.5;
      if (val(fCerca, Math.round(x)) === null) continue; // tierra o sin dato
      const c0 = Math.floor(x), fx = x - c0;
      let s = 0, w = 0;
      for (const [f, c, p] of [[f0, c0, (1 - fy) * (1 - fx)], [f0, c0 + 1, (1 - fy) * fx], [f0 + 1, c0, fy * (1 - fx)], [f0 + 1, c0 + 1, fy * fx]]) {
        const v = val(f, c);
        if (v === null || p <= 0) continue;
        s += p * v; w += p;
      }
      if (!w) continue;
      const col = rgb[tramo(s / w)];
      const o = (r * W + k) * 4;
      px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
    }
  }
  return { ancho: W, alto: H, px };
}
