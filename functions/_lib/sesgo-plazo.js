// functions/_lib/sesgo-plazo.js — corrección aprendida de lo que preveíamos
// frente a lo que pasó, por cámara y plazo (2026-11-19). La aprende
// scripts/oleaje-camaras/sesgo-plazo.mjs y la escribe en
// sesgo-plazo-datos.js. Solo corrige con N_MIN comparaciones o más en esa
// cámara y ese plazo; si no, factor 1 (sin datos no se toca nada).
import { FUENTE_POR_SPOT } from "./oleaje-camaras.js";

export const PLAZOS_APP = [[0, 6], [6, 24], [24, 48], [48, 72]];

export function factorPlazo(modelo, slug, horasAdelante) {
  const fuente = FUENTE_POR_SPOT[slug];
  if (!fuente || !modelo?.camaras || !Number.isFinite(horasAdelante)) return 1;
  const tramo = PLAZOS_APP.find(([a, b]) => horasAdelante >= a && horasAdelante < b);
  if (!tramo) return 1;
  const c = modelo.camaras[fuente.camara]?.[`${tramo[0]}-${tramo[1]}`];
  if (!c || !(c.n >= (modelo.nMin ?? 20)) || !Number.isFinite(c.factor)) return 1;
  // Vecina: la corrección pesa menos (misma regla que el coeficiente de costa).
  const peso = fuente.propia ? 1 : Math.min(1, Math.max(0, fuente.peso ?? 0.5));
  return +Math.pow(Math.min(2, Math.max(0.5, c.factor)), peso).toFixed(3);
}
