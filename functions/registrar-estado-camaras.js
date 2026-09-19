// functions/registrar-estado-camaras.js
// Guarda el estado actual ("sin señal" sí/no) de cada webcam (ver
// supabase/migrations/20260918120000_camara_estado.sql para el
// razonamiento completo). Mismo patrón que registrar-turbidez.js: el
// cálculo pesado (decodificar imagen/frame) no puede vivir en Cloudflare
// Pages Functions (sin API de imagen/canvas) — corre aparte en
// scripts/camaras/comprobar-camaras.mjs sobre un runner de GitHub Actions
// (.github/workflows/camaras-salud.yml, cada 30 min), y este endpoint solo
// guarda el resultado ya calculado.
//
// Protegido con el mismo secreto compartido que registrar-presion.js /
// registrar-turbidez.js (cabecera X-Cron-Secret, variable de entorno
// CRON_SECRET).

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

  const ahora = new Date().toISOString();
  const filas = lecturas
    .filter((l) => l && typeof l.spot === "string" && typeof l.sinSenal === "boolean")
    .map((l) => ({
      spot_slug: l.spot,
      sin_senal: l.sinSenal,
      motivo: typeof l.motivo === "string" ? l.motivo : "desconocido",
      comprobado_en: ahora,
      // El script ya decide este valor mirando el estado previo (lee
      // camara_estado antes de comprobar) — aquí solo se guarda tal cual:
      // si sinSenal es true, el script manda la marca de tiempo que ya
      // hubiera (o null si nunca hubo señal), nunca la de "ahora" — así
      // "sin señal desde hace X" sigue siendo real tras varias pasadas
      // seguidas caída. Se hace en el script y no aquí porque un upsert
      // en bloque necesita que todas las filas tengan las mismas columnas.
      ultima_senal_en: typeof l.ultimaSenalEn === "string" ? l.ultimaSenalEn : null,
      // hash_frame/hash_desde: detección de frame congelado (ver el
      // comentario largo en scripts/camaras/comprobar-camaras.mjs) — el
      // script ya compara contra el hash previo, aquí solo se guarda.
      hash_frame: typeof l.hashFrame === "string" ? l.hashFrame : null,
      hash_desde: typeof l.hashDesde === "string" ? l.hashDesde : null,
      // fallos_seguidos: debounce de fallos/frame plano (ver el comentario
      // largo en scripts/camaras/comprobar-camaras.mjs) — un fallo aislado
      // no debe mostrarse como sin señal, solo si se repite en la
      // comprobación siguiente.
      fallos_seguidos: Number.isInteger(l.fallosSeguidos) ? l.fallosSeguidos : 0,
      // fuente_usada: 0 = sirvió la fuente principal, >0 = el proxy
      // (functions/webcam/[slug].js) recurrió a una de reserva — la app
      // sigue enseñando imagen real, pero es la señal de que la principal
      // está fallando y merece revisión aunque no haya ningún punto rojo.
      fuente_usada: Number.isInteger(l.fuenteUsada) ? l.fuenteUsada : 0,
    }));
  if (!filas.length) {
    return new Response(JSON.stringify({ error: "ninguna lectura válida en el array recibido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/camara_estado?on_conflict=spot_slug`, {
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
