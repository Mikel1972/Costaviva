// scripts/aprendizaje/metricas.mjs
//
// Métricas del banco de pruebas del índice de pesca (2026-10-09). Puras, sin
// red ni dependencias: las usan semanal.mjs, la rutina "Investigador
// semanal" y test/aprendizaje.test.js.
//
//   - Brier: error cuadrático medio de la probabilidad (0 perfecto; con la
//     tasa media constante sale el "Brier de referencia").
//   - Log-loss: penaliza mucho decir 90 % cuando no se pescó nada.
//   - AUC: ¿las salidas con pesca tenían un índice más alto que las sin
//     pesca? 0,5 = al azar, 1 = ordena perfecto.
//   - Calibración por tramos: con el índice en 60-80, ¿se pescó de verdad
//     ~70 % de las veces?
//
// `p` siempre en 0-1 (índice / 100) e `y` en 0/1.

export const EPS = 1e-6;
const clip = (p) => Math.min(1 - EPS, Math.max(EPS, p));

export function brier(ps, ys) {
  if (!ps.length) return null;
  let s = 0;
  for (let i = 0; i < ps.length; i++) s += (ps[i] - ys[i]) ** 2;
  return s / ps.length;
}

export function logLoss(ps, ys) {
  if (!ps.length) return null;
  let s = 0;
  for (let i = 0; i < ps.length; i++) s -= ys[i] ? Math.log(clip(ps[i])) : Math.log(1 - clip(ps[i]));
  return s / ps.length;
}

// AUC por rangos (Mann-Whitney), con empates a medias. null si falta una clase.
export function auc(ps, ys) {
  const pos = ys.filter(Boolean).length, neg = ys.length - pos;
  if (!pos || !neg) return null;
  const orden = ps.map((p, i) => ({ p, y: ys[i] })).sort((a, b) => a.p - b.p);
  let suma = 0;
  for (let i = 0; i < orden.length;) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1].p === orden[i].p) j++;
    const rango = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (orden[k].y) suma += rango;
    i = j + 1;
  }
  return (suma - (pos * (pos + 1)) / 2) / (pos * neg);
}

export const BANDAS = [0, 0.2, 0.4, 0.6, 0.8, 1];
export function calibracion(ps, ys, bandas = BANDAS) {
  const t = [];
  for (let b = 0; b < bandas.length - 1; b++) {
    const ult = b === bandas.length - 2;
    const idx = ps.map((p, i) => i).filter((i) => ps[i] >= bandas[b] && (ult ? ps[i] <= bandas[b + 1] : ps[i] < bandas[b + 1]));
    const n = idx.length;
    t.push({
      desde: Math.round(bandas[b] * 100), hasta: Math.round(bandas[b + 1] * 100), n,
      indice_medio: n ? +(100 * idx.reduce((s, i) => s + ps[i], 0) / n).toFixed(1) : null,
      tasa_real: n ? +(100 * idx.reduce((s, i) => s + ys[i], 0) / n).toFixed(1) : null,
    });
  }
  return t;
}

// Error de calibración esperado (ECE), en puntos de índice.
export function ece(ps, ys, bandas = BANDAS) {
  if (!ps.length) return null;
  return +calibracion(ps, ys, bandas).reduce((s, b) => s + (b.n ? (b.n / ps.length) * Math.abs(b.indice_medio - b.tasa_real) : 0), 0).toFixed(2);
}

export function resumen(ps, ys) {
  const n = ps.length;
  if (!n) return { n: 0 };
  const positivos = ys.filter(Boolean).length;
  const tasa = positivos / n;
  const b = brier(ps, ys);
  const bRef = tasa * (1 - tasa);
  const r6 = (x) => (x === null ? null : +x.toFixed(4));
  return {
    n, positivos, tasa: r6(tasa), brier: r6(b), brier_referencia: r6(bRef),
    // Habilidad frente a decir siempre la tasa media: > 0 = el índice aporta.
    habilidad_brier: bRef > 0 ? r6(1 - b / bRef) : null,
    logloss: r6(logLoss(ps, ys)), auc: r6(auc(ps, ys)), ece_puntos: ece(ps, ys),
    calibracion: calibracion(ps, ys),
  };
}

// Generador pseudoaleatorio con semilla (mulberry32): resultados repetibles.
export function rng(semilla = 1) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bootstrap emparejado: ¿el modelo B mejora al A en `metrica` (menor es
// mejor)? Devuelve la mejora media (A - B), su intervalo del 90 % y la
// fracción de remuestras en que B gana.
export function bootstrapMejora(ys, pa, pb, metrica = logLoss, { B = 400, semilla = 7 } = {}) {
  const n = ys.length;
  if (n < 2) return null;
  const azar = rng(semilla);
  const d = [];
  for (let b = 0; b < B; b++) {
    const y = [], a = [], c = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(azar() * n);
      y.push(ys[k]); a.push(pa[k]); c.push(pb[k]);
    }
    d.push(metrica(a, y) - metrica(c, y));
  }
  d.sort((x, z) => x - z);
  const q = (f) => d[Math.min(d.length - 1, Math.max(0, Math.round(f * (d.length - 1))))];
  return {
    mejora_media: +(d.reduce((s, x) => s + x, 0) / d.length).toFixed(5),
    ic90: [+q(0.05).toFixed(5), +q(0.95).toFixed(5)],
    prob_mejora: +(d.filter((x) => x > 0).length / d.length).toFixed(3),
  };
}

// Índice de estabilidad de población (PSI) entre dos histogramas con las
// mismas bandas. < 0,1 estable; 0,1-0,25 cambio moderado; > 0,25 cambio fuerte.
export function psi(a, b) {
  const ta = a.reduce((s, x) => s + x, 0), tb = b.reduce((s, x) => s + x, 0);
  if (!ta || !tb) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const pa = Math.max(1e-4, a[i] / ta), pb = Math.max(1e-4, b[i] / tb);
    s += (pb - pa) * Math.log(pb / pa);
  }
  return +s.toFixed(4);
}

// Histograma de puntuaciones 0-100 en bandas de 10 puntos.
export function histograma(puntuaciones) {
  const h = new Array(10).fill(0);
  for (const p of puntuaciones) if (Number.isFinite(p)) h[Math.min(9, Math.max(0, Math.floor(p / 10)))]++;
  return h;
}
