// functions/registrar-presion.js
// Guarda una lectura real de presión atmosférica por spot, una vez por
// hora (Fase 4 del plan de mejoras) — para que la tendencia de presión
// se pueda calcular contra historia real, no solo comparando dentro del
// mismo forecast de Open-Meteo (que es lo que hace hoy calcularPresion()
// en prevision.js). Llamado por .github/workflows/presion-historico.yml.
//
// Protegido con un secreto compartido (cabecera X-Cron-Secret, variable
// de entorno CRON_SECRET en Cloudflare Pages) para que no sea un
// endpoint de escritura abierto al público — ver la nota de seguridad en
// supabase/migrations/20260912220000_presion_historico.sql sobre el
// riesgo residual aceptado (la anon key es pública por diseño).

import { SPOTS } from "./prevision.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

export async function onRequestPost(context) {
  const secretoEsperado = context.env.CRON_SECRET;
  const secretoRecibido = context.request.headers.get("X-Cron-Secret");
  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
    return new Response(JSON.stringify({ error: "no autorizado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const lats = SPOTS.map((s) => s.lat).join(",");
    const lons = SPOTS.map((s) => s.lon).join(",");
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=pressure_msl&timezone=Europe%2FMadrid`
    );
    if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
    const datos = await resp.json();
    // Con más de una localización, Open-Meteo devuelve un array (uno por
    // coordenada, mismo orden que se pidió) en vez de un único objeto —
    // mismo criterio que previsionTodosSpots() en prevision.js.
    const lista = Array.isArray(datos) ? datos : [datos];
    const filas = SPOTS.map((spot, i) => ({
      spot_slug: spot.slug,
      valor_hpa: lista[i]?.current?.pressure_msl,
    })).filter((f) => Number.isFinite(f.valor_hpa));

    if (!filas.length) throw new Error("Open-Meteo no devolvió ninguna presión válida");

    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/presion_historico`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(filas),
    });
    if (!insertResp.ok) throw new Error(`Supabase insert HTTP ${insertResp.status}: ${await insertResp.text()}`);

    return new Response(JSON.stringify({ ok: true, filas: filas.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
