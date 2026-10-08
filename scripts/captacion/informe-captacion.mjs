// scripts/captacion/informe-captacion.mjs
// Bloque "Captación (semanal)" del informe diario de los lunes
// (daily-report.yml, 2026-10-09). Sin IA: llama a metricas_captacion() con
// SUPABASE_SERVICE_ROLE_KEY y lo formatea con assets/js/metricas-captacion.js.
// Escribe el texto en stdout; si algo falla lo dice (nunca un cero mudo).
import { lineasInforme } from "../../assets/js/metricas-captacion.js";

const URL_SUPABASE = "https://imncbmizxkorotpeisic.supabase.co";
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!clave) {
    console.log("  - N/D (falta el secret SUPABASE_SERVICE_ROLE_KEY)");
    return;
  }
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/metricas_captacion`, {
    method: "POST",
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, "content-type": "application/json" },
    body: JSON.stringify({ p_semanas: 8 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    console.log(`  - N/D (metricas_captacion respondió ${r.status}; ¿migraciones de captación sin aplicar?)`);
    process.exitCode = r.status === 404 ? 0 : 1;
    return;
  }
  console.log(lineasInforme(await r.json()).join("\n"));
}

main().catch((e) => {
  console.log(`  - N/D (fallo pidiendo las métricas: ${e.message})`);
  process.exitCode = 1;
});
