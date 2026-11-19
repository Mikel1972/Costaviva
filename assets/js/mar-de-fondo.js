// assets/js/mar-de-fondo.js — mar de fondo y resaca en la orilla (2026-11-19).
//
// Mikel: "cuando ves mucha espuma en la costa es porque hay mar de fondo,
// independientemente de la altura de la ola [...] la mar 'tira' mucho hacia
// adentro. Es un factor importante a la hora de pescar [...] se puede dar el
// caso de que hay una mar sin olas en embarcación y que en costa embista con
// fuerza por el mar de fondo".
//
// Física (sin IA, sin red; lo usan /prevision y la ventana de actividad):
//   - Open-Meteo Marine separa la mar de fondo (swell_wave_height y
//     swell_wave_period, de los modelos ECMWF WAM / Météo-France MFWAM) de la
//     mar de viento. Ningún satélite mide esto en la orilla: los altímetros
//     (Sentinel-3/6, Jason-3) dan la altura total en mar abierto y el SAR de
//     Sentinel-1 y CFOSAT la mar de fondo lejos de costa; esos datos ya
//     alimentan los modelos.
//   - Lo que sube por la roca y "tira" al retirarse es el run-up: la cota
//     que alcanza el agua sobre el nivel del mar. Fórmula de Stockdon et al.
//     (2006, Coastal Engineering 53: 573-588) con una pendiente genérica de
//     costa β = 0,1 (roca y playa media): R2 ≈ 1,1·(0,35·β·√(H·L) +
//     √(H·L·(0,563·β² + 0,004))/2), L = 1,56·T². Crece con √H pero con T
//     (L ∝ T²): con la misma altura, 14 s suben más del doble que 6 s. Por
//     eso una mar de viento de 1,2 m y 6 s apenas tira y una mar de fondo
//     de 1,2 m y 14 s barre las rocas (el caso de Mikel).
//   - H es la mar de fondo QUE LLEGA A LA ORILLA: la de mar abierto por el
//     mismo coeficiente que la ola del spot (coef-costa.js, aprendido de las
//     cámaras, o el abrigo de oleaje-costero.js); sin coeficiente, 1 (se
//     sobrestima antes que subestimar).
//   - También se da la energía (P ≈ 0,49·H²·T kW por metro de costa), solo
//     como información.
//
// Umbrales de subida (m): criterio de diseño de Costaviva, SIN umbral
// oficial; se calibrarán con la etiqueta "la mar tira: poco / medio / mucho"
// de las cámaras (paso 5 del plan acordado con Mikel el 2026-11-19).
export const PENDIENTE_COSTA = 0.1;
export const UMBRALES_RESACA = { moderada: 0.8, fuerte: 1.3, muy_fuerte: 1.9 };
export const PERIODO_LARGO_S = 11;

export function energiaOla(h, t) {
  if (!Number.isFinite(h) || !Number.isFinite(t) || h <= 0 || t <= 0) return null;
  return 0.49 * h * h * t;
}

// Run-up R2 de Stockdon (2006) en metros.
export function subidaAgua(h, t, beta = PENDIENTE_COSTA) {
  if (!Number.isFinite(h) || !Number.isFinite(t) || h <= 0 || t <= 0) return null;
  const hl = Math.sqrt(h * 1.56 * t * t);
  return 1.1 * (0.35 * beta * hl + (hl * Math.sqrt(0.563 * beta * beta + 0.004)) / 2);
}

export function nivelResaca(subida) {
  if (!Number.isFinite(subida)) return null;
  const u = UMBRALES_RESACA;
  return subida >= u.muy_fuerte ? "muy_fuerte" : subida >= u.fuerte ? "fuerte" : subida >= u.moderada ? "moderada" : "suave";
}

// hsFondo, periodoFondo: mar de fondo en mar abierto; coefOrilla: el mismo
// coeficiente que la ola del spot (null = 1).
export function marDeFondo(hsFondo, periodoFondo, coefOrilla = null) {
  if (!Number.isFinite(hsFondo) || !Number.isFinite(periodoFondo) || hsFondo <= 0 || periodoFondo <= 0) return null;
  const c = Number.isFinite(coefOrilla) && coefOrilla > 0 ? coefOrilla : 1;
  const enOrilla = hsFondo * c;
  const subida = subidaAgua(enOrilla, periodoFondo);
  const energia = energiaOla(enOrilla, periodoFondo);
  return {
    altura: +hsFondo.toFixed(1),
    alturaOrilla: +enOrilla.toFixed(1),
    periodo: Math.round(periodoFondo),
    subida: +subida.toFixed(1),
    energia: +energia.toFixed(1),
    nivel: nivelResaca(subida),
    periodoLargo: periodoFondo >= PERIODO_LARGO_S,
  };
}

// Valor del factor "resaca" del índice de pesca (∈ [-1, 0]): no suma nunca,
// solo resta cuando la mar tira.
export const VALOR_RESACA = { suave: 0, moderada: -0.3, fuerte: -0.7, muy_fuerte: -1 };

// ---------------------------------------------------------------------------
// Periodo de la mar de fondo calibrado con las boyas (2026-11-19, paso 2 del
// plan acordado con Mikel). La fórmula de la subida del agua usa el periodo
// de PICO (Tp, el que miden las boyas). Con 30 días de las 26 boyas de
// Puertos del Estado (19/10-18/11/2026):
//   swell_wave_period (periodo MEDIO de la mar de fondo de Open-Meteo) se
//     queda corto: Tp de la boya / modelo = 1,29 de mediana en el Cantábrico
//     y Galicia (2,3 s menos de media; 2,8 s con temporal);
//   swell_wave_peak_period (periodo de PICO) casi clava la boya: 0,98
//     (MAE 1,2 s).
// Se usa el de pico; donde el modelo no lo da (Canarias), el medio por el
// cociente aprendido. El cociente lo reaprende cada día
// scripts/fuentes/periodo-boyas.mjs (functions/_lib/periodo-boyas-datos.js)
// y vale el de la boya más cercana a menos de MAX_KM_BOYA_PERIODO; si no,
// la mediana de todas.
export const MAX_KM_BOYA_PERIODO = 300;

function kmEntre(lat1, lon1, lat2, lon2) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)) * 111.32;
  const y = (lat2 - lat1) * 110.57;
  return Math.hypot(x, y);
}

// tabla: { global: { pico, medio }, boyas: [{ codigo, nombre, lat, lon, n, pico, medio }] }
export function factoresPeriodo(tabla, lat, lon, maxKm = MAX_KM_BOYA_PERIODO) {
  const g = tabla?.global || {};
  let mejor = null, dMin = Infinity;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    for (const b of tabla?.boyas || []) {
      const d = kmEntre(lat, lon, b.lat, b.lon);
      if (d < dMin) { dMin = d; mejor = b; }
    }
  }
  const cerca = mejor && dMin <= maxKm ? mejor : null;
  const val = (k) => (cerca && Number.isFinite(cerca[k]) ? cerca[k] : Number.isFinite(g[k]) ? g[k] : 1);
  return { pico: val("pico"), medio: val("medio"), boya: cerca ? cerca.codigo : null };
}

// Periodo de pico de la mar de fondo (s) para la fórmula: el de pico del
// modelo por su cociente o, sin él, el medio por el suyo.
export function periodoFondoPico(pico, medio, f = null) {
  const fp = Number.isFinite(f?.pico) ? f.pico : 1, fm = Number.isFinite(f?.medio) ? f.medio : 1;
  if (Number.isFinite(pico) && pico > 0) return pico * fp;
  if (Number.isFinite(medio) && medio > 0) return medio * fm;
  return null;
}
