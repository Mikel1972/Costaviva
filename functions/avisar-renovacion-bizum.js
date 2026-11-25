// functions/avisar-renovacion-bizum.js
// Aviso de renovación del año pagado con Bizum (2026-11-25, CLAUDE.md
// "Pagar 1 año con Bizum"). Sin IA. Bizum en Stripe no admite cobros
// recurrentes: el año no se renueva solo, así que avisamos por email
// 7 días antes y otra vez el último día, con el enlace para renovar.
//
// Mismo patrón que avisar-fin-prueba.js: protegido con X-Cron-Secret
// (CRON_SECRET en Cloudflare), llamado una vez al día por
// .github/workflows/aviso-renovacion-bizum.yml, con SUPABASE_SERVICE_ROLE_KEY
// y RESEND_API_KEY.
//
// ESTO ESCRIBE A USUARIOS REALES. Por eso:
//   - Qué aviso toca lo decide avisoQueToca() (_lib/bizum.js, con test).
//   - Cada aviso se apunta SOLO tras confirmar Resend el envío, guardando el
//     periodo_actual_fin avisado (renovacion_avisada_fin /
//     renovacion_ultimo_dia_fin): nunca dos veces para el mismo periodo. El
//     PATCH filtra por ese mismo fin: si renovó entre medias, no marca nada.
//   - Guarda de volumen: más de LIMITE_POR_PASADA avisos de golpe = no se
//     envía ninguno y la ejecución sale en rojo.
//   - Sin la migración 20261125200000 aplicada (columnas que no existen),
//     responde 200 "migracion_pendiente" sin hacer nada.

import { secretoValido } from "./_lib/secreto.js";
import { enviarEmail } from "./_lib/email.js";
import { avisoQueToca, columnaAviso, idiomaAviso, emailAvisoBizum } from "./_lib/bizum.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const LIMITE_POR_PASADA = 50;
const DIA_MS = 24 * 60 * 60 * 1000;

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!secretoValido(request.headers.get("X-Cron-Secret"), env.CRON_SECRET)) {
    return json({ error: "no autorizado" }, 401);
  }
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !env.RESEND_API_KEY) return json({ error: "no configurado todavía" }, 501);
  const cab = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" };

  const ahora = Date.now();
  const desde = new Date(ahora).toISOString();
  const hasta = new Date(ahora + 7 * DIA_MS).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/suscripciones?select=user_id,estado,metodo_pago,periodo_actual_fin,renovacion_avisada_fin,renovacion_ultimo_dia_fin`
    + `&metodo_pago=eq.bizum&estado=eq.active&periodo_actual_fin=gt.${encodeURIComponent(desde)}&periodo_actual_fin=lte.${encodeURIComponent(hasta)}`;
  const r = await fetch(url, { headers: cab });
  if (!r.ok) {
    const detalle = await r.text();
    if (/42703|does not exist/.test(detalle)) return json({ omitido: "migracion_pendiente" });
    console.error(`avisar-renovacion-bizum: suscripciones HTTP ${r.status}: ${detalle}`);
    return json({ error: "no se pudo leer suscripciones" }, 502);
  }
  const pendientes = (await r.json())
    .map((f) => ({ fila: f, tipo: avisoQueToca(f, ahora) }))
    .filter((x) => x.tipo);
  if (pendientes.length > LIMITE_POR_PASADA) {
    console.error(`avisar-renovacion-bizum: ${pendientes.length} avisos, por encima del límite; no se envía ninguno`);
    return json({ error: "por encima del límite", pendientes: pendientes.length }, 502);
  }

  const resultado = { siete_dias: 0, ultimo_dia: 0, fallos: 0 };
  for (const { fila, tipo } of pendientes) {
    try {
      const u = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${fila.user_id}`, { headers: cab });
      if (!u.ok) throw new Error(`auth admin HTTP ${u.status}`);
      const usuario = await u.json();
      if (!usuario.email) continue;
      const { asunto, cuerpo } = emailAvisoBizum(tipo, fila.periodo_actual_fin, idiomaAviso(usuario.user_metadata));
      const envio = await enviarEmail(env, { to: usuario.email, subject: asunto, text: cuerpo });
      // El detalle de Resend se queda en el log (puede llevar el email).
      if (!envio.ok) throw new Error(envio.error);
      const m = await fetch(
        `${SUPABASE_URL}/rest/v1/suscripciones?user_id=eq.${fila.user_id}&periodo_actual_fin=eq.${encodeURIComponent(fila.periodo_actual_fin)}`,
        { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" }, body: JSON.stringify({ [columnaAviso(tipo)]: fila.periodo_actual_fin }) },
      );
      if (!m.ok) throw new Error(`marcar aviso HTTP ${m.status}`);
      resultado[tipo === "ultimo_dia" ? "ultimo_dia" : "siete_dias"]++;
    } catch (e) {
      console.error(`avisar-renovacion-bizum: ${fila.user_id}: ${String(e)}`);
      resultado.fallos++;
    }
  }
  return json(resultado, resultado.fallos ? 502 : 200);
}
