// scripts/precios/informe-zonas-tarjeta.mjs
// Línea "Tarjetas de otra zona" del informe diario (daily-report.yml,
// 2026-11-25; CLAUDE.md "Zona de precio por el país de la tarjeta"). Sin IA:
// lee de suscripciones solo las columnas de zona (nunca emails, nombres,
// países por día ni ids) con SUPABASE_SERVICE_ROLE_KEY y saca recuentos por
// zona con lineasInforme() de functions/_lib/pais-tarjeta.js. El repo y los
// logs son públicos: solo recuentos y zonas.
import { lineasInforme } from "../../functions/_lib/pais-tarjeta.js";

const URL_SUPABASE = "https://imncbmizxkorotpeisic.supabase.co";
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COLUMNAS = "zona_precio,zona_tarjeta,zona_correccion,zona_correccion_origen,zona_corregir_a";

async function main() {
  if (!clave) {
    console.log("  - N/D (falta el secret SUPABASE_SERVICE_ROLE_KEY)");
    return;
  }
  const r = await fetch(`${URL_SUPABASE}/rest/v1/suscripciones?select=${COLUMNAS}&or=(zona_tarjeta.not.is.null,zona_correccion.not.is.null)`, {
    headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    // 400 = columnas aún sin crear (migración 20261125220000 sin aplicar).
    console.log(r.status === 400
      ? "  - N/D (migración 20261125220000_pais_tarjeta.sql sin aplicar)"
      : `  - N/D (suscripciones respondió ${r.status})`);
    process.exitCode = r.status === 400 ? 0 : 1;
    return;
  }
  console.log(lineasInforme(await r.json()).join("\n"));
}

main().catch((e) => {
  console.log(`  - N/D (fallo leyendo suscripciones: ${e.message})`);
  process.exitCode = 1;
});
