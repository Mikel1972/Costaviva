// scripts/precios/informe-zonas-tarjeta.mjs
// Línea "Tarjetas de otra zona" del informe diario (daily-report.yml,
// 2026-11-25; CLAUDE.md "Zona de precio por el país de la tarjeta" y "País de
// residencia obligatorio antes de pagar"). Sin IA: lee de suscripciones solo
// las columnas de zona y de país (nunca emails, nombres ni ids) con
// SUPABASE_SERVICE_ROLE_KEY y saca recuentos con lineasInforme() de
// functions/_lib/pais-tarjeta.js. Los países (residencia, tarjeta, uso) solo
// se leen para contar: nunca se imprimen. El repo y los logs son públicos:
// solo recuentos y zonas.
import { readFileSync } from "node:fs";
import { lineasInforme } from "../../functions/_lib/pais-tarjeta.js";

const URL_SUPABASE = "https://imncbmizxkorotpeisic.supabase.co";
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const config = JSON.parse(readFileSync(new URL("../../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));
const COLUMNAS = "zona_precio,zona_tarjeta,zona_correccion,zona_correccion_origen,zona_corregir_a";
// Con la migración 20261126090000 (pais_residencia) aplicada.
const COLUMNAS_RESIDENCIA = `${COLUMNAS},pais_residencia,pais_tarjeta,paises_uso`;

async function leer(columnas, filtro) {
  return fetch(`${URL_SUPABASE}/rest/v1/suscripciones?select=${columnas}&or=(${filtro})`, {
    headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    signal: AbortSignal.timeout(20000),
  });
}

async function main() {
  if (!clave) {
    console.log("  - N/D (falta el secret SUPABASE_SERVICE_ROLE_KEY)");
    return;
  }
  let r = await leer(COLUMNAS_RESIDENCIA, "zona_tarjeta.not.is.null,zona_correccion.not.is.null,pais_residencia.not.is.null");
  let conResidencia = true;
  if (r.status === 400) {
    // Sin pais_residencia todavía: como antes del 2026-11-25.
    conResidencia = false;
    r = await leer(COLUMNAS, "zona_tarjeta.not.is.null,zona_correccion.not.is.null");
  }
  if (!r.ok) {
    // 400 = columnas aún sin crear (migración 20261125220000 sin aplicar).
    console.log(r.status === 400
      ? "  - N/D (migración 20261125220000_pais_tarjeta.sql sin aplicar)"
      : `  - N/D (suscripciones respondió ${r.status})`);
    process.exitCode = r.status === 400 ? 0 : 1;
    return;
  }
  const lineas = lineasInforme(await r.json(), config);
  if (!conResidencia) lineas.push("  - Residencia declarada: N/D (migración 20261126090000_pais_residencia.sql sin aplicar)");
  console.log(lineas.join("\n"));
}

main().catch((e) => {
  console.log(`  - N/D (fallo leyendo suscripciones: ${e.message})`);
  process.exitCode = 1;
});
