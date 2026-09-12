// functions/registrar-presion.js
// Guarda, una vez por hora:
//   1) una lectura real de presión atmosférica por spot (Fase 4 del plan
//      de mejoras) — para que la tendencia de presión se pueda calcular
//      contra historia real, no solo comparando dentro del mismo
//      forecast de Open-Meteo (calcularPresion() en prevision.js).
//   2) el coeficiente de marea real por spot (coeficientePorSpot() en
//      prevision.js) — MOVIDO AQUÍ el 2026-09-13 tras dos intentos
//      fallidos de calcularlo dentro de /prevision en cada petición: la
//      ventana de datos ancha que necesita (~24 días, para cubrir un
//      ciclo vivas-muertas completo) daba primero 503 (payload
//      demasiado grande) y, tras reducirlo a una sola variable, seguía
//      dando "error 1102" (límite de recursos) de forma intermitente
//      con los 95 spots a la vez. Calculándolo aquí, una vez por hora,
//      un fallo puntual solo deja el valor cacheado sin actualizar esa
//      hora (se reintenta la siguiente) — /prevision nunca falla por
//      esto, solo sirve un valor con hasta 1h de antigüedad.
//
// Llamado por .github/workflows/presion-historico.yml.
//
// Protegido con un secreto compartido (cabecera X-Cron-Secret, variable
// de entorno CRON_SECRET en Cloudflare Pages) para que no sea un
// endpoint de escritura abierto al público — ver la nota de seguridad en
// supabase/migrations/20260912220000_presion_historico.sql sobre el
// riesgo residual aceptado (la anon key es pública por diseño).

import { SPOTS, coeficientePorSpot } from "./prevision.js";

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

  // Las dos partes son independientes (fuentes y tablas distintas) — un
  // fallo en una no debe impedir que la otra se guarde, así que cada una
  // reporta su propio resultado en vez de que un throw corte a la otra.
  const resultado = { presion: null, coeficientes: null };

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
    resultado.presion = { ok: true, filas: filas.length };
  } catch (e) {
    resultado.presion = { ok: false, error: String(e) };
  }

  try {
    // Ventana ancha (~24 días, cubre un ciclo vivas-muertas completo),
    // una sola variable — igual que se probó en real antes de mover esto
    // aquí (~1.37MB con los 95 spots). Al correr en un cron y no en la
    // petición de cada usuario, un fallo puntual (o que esto tarde más
    // de lo normal) no afecta a nadie visitando la web esa hora.
    const lats = SPOTS.map((s) => s.lat).join(",");
    const lons = SPOTS.map((s) => s.lon).join(",");
    const resp = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&timezone=Europe%2FMadrid&past_days=8&forecast_days=16&hourly=sea_level_height_msl`
    );
    if (!resp.ok) throw new Error(`Open-Meteo (marine) HTTP ${resp.status}`);
    const datos = await resp.json();
    const lista = Array.isArray(datos) ? datos : [datos];
    const filas = SPOTS.map((spot, i) => ({
      spot_slug: spot.slug,
      valor: coeficientePorSpot(lista[i]?.hourly?.time || [], lista[i]?.hourly?.sea_level_height_msl || []),
    })).filter((f) => Number.isFinite(f.valor));

    if (!filas.length) throw new Error("no se pudo calcular ningún coeficiente");

    const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/coeficiente_marea_actual?on_conflict=spot_slug`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(filas.map((f) => ({ ...f, actualizado_en: new Date().toISOString() }))),
    });
    if (!upsertResp.ok) throw new Error(`Supabase upsert HTTP ${upsertResp.status}: ${await upsertResp.text()}`);
    resultado.coeficientes = { ok: true, filas: filas.length };
  } catch (e) {
    resultado.coeficientes = { ok: false, error: String(e) };
  }

  const status = resultado.presion?.ok || resultado.coeficientes?.ok ? 200 : 502;
  return new Response(JSON.stringify(resultado), { status, headers: { "content-type": "application/json" } });
}
