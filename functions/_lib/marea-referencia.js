// functions/_lib/marea-referencia.js
// Mareógrafo de Puertos del Estado de referencia para un spot (2026-11-21,
// Mikel: alturas de marea como las de la tabla del puerto). Ver
// marea-referencias-datos.js.
import REFERENCIAS from "./marea-referencias-datos.js";
import { distanciaKm } from "./instantaneas.js";

export const MAX_KM_REFERENCIA = 60;
export const FUENTE_REFERENCIA = { nombre: "Puertos del Estado", url: "https://portus.puertos.es/" };

// El mareógrafo más cercano a menos de MAX_KM_REFERENCIA, o null.
export function referenciaMarea(lat, lon, refs = REFERENCIAS) {
  let mejor = null;
  for (const r of refs) {
    const km = distanciaKm(lat, lon, r.lat, r.lon);
    if (km <= MAX_KM_REFERENCIA && (!mejor || km < mejor.km)) mejor = { ...r, km };
  }
  return mejor ? { puerto: mejor.nombre, km: Math.round(mejor.km), nmm: mejor.nmm, cero: mejor.cero } : null;
}

// Desplazamiento a sumar a la serie del modelo: la serie se centra en su
// media (≈ nivel medio en 2 días de mareas) y se sube al nivel medio del
// puerto sobre el cero de la tabla. Sin datos válidos, null.
export function desplazamientoReferencia(alturas, ref) {
  const v = (alturas || []).filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  if (!ref || v.length < 12) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return ref.nmm - media;
}
