// scripts/prevision/precalcular.mjs
// Previsión de España precalculada (2026-11-22, aprobado por Mikel: "si").
// La calcula prevision-precalculada.yml cada 30 min, fuera de Cloudflare,
// con el MISMO código que la Function (calcularPrevisionEs de
// functions/prevision.js), y la deja en Supabase Storage
// fuentes-gratuitas/prevision/es.json. /prevision la sirve tal cual (CPU casi
// nula); si falta o tiene más de 75 min, la calcula como antes. Sin IA.
//
// Uso: node scripts/prevision/precalcular.mjs <salida.json>
//   generado_en va la PRIMERA clave (la Function lee la edad sin parsear).
//   Sin estacionesAemet: la clave de AEMET solo está en Cloudflare y las
//   estaciones se añaden al servir.
//   Sale en rojo si más de la mitad de los spots vienen con error (no se
//   sube una previsión rota: la Function seguirá calculando la suya).

import { writeFileSync } from "node:fs";
import { calcularPrevisionEs } from "../../functions/prevision.js";

export const MAX_FRACCION_ERROR = 0.5;

export function armarJson(datos, ahora = new Date()) {
  const { estacionesAemet, ...resto } = datos;
  return JSON.stringify({ generado_en: ahora.toISOString(), ...resto });
}

export function demasiadosErrores(spots, max = MAX_FRACCION_ERROR) {
  if (!Array.isArray(spots) || !spots.length) return true;
  return spots.filter((s) => s && s.error).length > spots.length * max;
}

async function principal() {
  const salida = process.argv[2];
  if (!salida) {
    console.log("::error::Uso: node scripts/prevision/precalcular.mjs <salida.json>");
    process.exit(1);
  }
  const t0 = Date.now();
  const datos = await calcularPrevisionEs(process.env, { conAemet: false });
  const conError = datos.spots.filter((s) => s.error);
  console.log(`Spots: ${datos.spots.length}, con error: ${conError.length}, fuentes: ${(datos.fuentesDatos || []).join(", ")}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const s of conError.slice(0, 5)) console.log(`  ${s.slug}: ${String(s.error).slice(0, 160)}`);
  if (demasiadosErrores(datos.spots)) {
    console.log(`::error::${conError.length} de ${datos.spots.length} spots con error: no se sube la previsión`);
    process.exit(1);
  }
  const json = armarJson(datos);
  writeFileSync(salida, json);
  console.log(`Escrito ${salida} (${(json.length / 1e6).toFixed(2)} MB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await principal();
