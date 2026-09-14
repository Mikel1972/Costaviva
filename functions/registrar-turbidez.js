// functions/registrar-turbidez.js
// Guarda una lectura diaria de turbidez del agua por spot (ver
// supabase/migrations/20260914100000_turbidez_historico.sql para el
// razonamiento completo de por qué es un valor crudo comparado contra el
// propio histórico del spot, no una medida física real).
//
// A diferencia de registrar-presion.js, el propio cálculo de la lectura
// (decodificar la imagen/frame y sacar saturación/tono en HSV) NO puede
// pasar por aquí: Cloudflare Pages Functions no tiene ninguna API de
// imagen/canvas disponible en runtime. Por eso el cálculo se hace fuera,
// en un script Node con `sharp` + `ffmpeg` corriendo en el runner real de
// GitHub Actions (ver .github/workflows/turbidez.yml) — este endpoint solo
// recibe el resultado ya calculado y lo guarda.
//
// Llamado por .github/workflows/turbidez.yml, una vez al día. Protegido
// con el mismo secreto compartido que registrar-presion.js (cabecera
// X-Cron-Secret, variable de entorno CRON_SECRET).

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

  let lecturas;
  try {
    lecturas = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "cuerpo no es JSON válido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!Array.isArray(lecturas) || !lecturas.length) {
    return new Response(JSON.stringify({ error: "se esperaba un array no vacío de lecturas" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // YYYY-MM-DD
  const filas = lecturas
    .filter((l) => l && typeof l.spot === "string" && Number.isFinite(l.saturacion))
    .map((l) => ({
      spot_slug: l.spot,
      fecha: hoy,
      saturacion_media: l.saturacion,
      tono_medio: Number.isFinite(l.tono) ? l.tono : null,
      nubosidad: Number.isFinite(l.nubosidad) ? Math.round(l.nubosidad) : null,
    }));
  if (!filas.length) {
    return new Response(JSON.stringify({ error: "ninguna lectura válida en el array recibido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/turbidez_historico?on_conflict=spot_slug,fecha`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(filas),
  });
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Supabase upsert HTTP ${resp.status}: ${await resp.text()}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, filas: filas.length }), {
    headers: { "content-type": "application/json" },
  });
}
