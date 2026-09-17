// functions/notificar-altas.js
// Sustituye a aviso-alta.js (eliminado): desde 2026-09-17 las altas ya no
// esperan aprobación manual (ver migración 20260917080000), así que ya no
// tiene sentido avisar al admin justo al registrarse ni bloquear el
// acceso. En su lugar, este endpoint (llamado por
// .github/workflows/notificar-altas.yml cada 30 min) avisa de dos cosas,
// cada una una sola vez por alta:
//   1) "activada": el usuario confirmó su email de verdad y ya tiene
//      acceso — informativo, no requiere ninguna acción del admin.
//   2) "sin confirmar": pasadas 48h sigue sin confirmar el email — señal
//      de que algo puede haber ido mal (entrega del email, etc.).
//
// Protegido con el mismo secreto compartido que ya usa
// registrar-presion.js (cabecera X-Cron-Secret, variable CRON_SECRET) —
// no hace falta ningún secreto nuevo en Cloudflare Pages, reutiliza
// RESEND_API_KEY/ADMIN_EMAIL/SUPABASE_SERVICE_ROLE_KEY que ya estaban
// configurados para aviso-alta.js.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

export async function onRequestPost(context) {
  const { env } = context;
  const secretoEsperado = env.CRON_SECRET;
  const secretoRecibido = context.request.headers.get("X-Cron-Secret");
  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
    return new Response(JSON.stringify({ error: "no autorizado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const resendKey = env.RESEND_API_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = env.ADMIN_EMAIL;
  if (!resendKey || !serviceRoleKey || !adminEmail) {
    return new Response(JSON.stringify({ error: "aviso de altas no configurado todavía" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  const cabecerasSupabase = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };

  async function enviarEmail(asunto, cuerpo) {
    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Costa Viva <avisos@costaviva.org>",
        to: [adminEmail],
        subject: asunto,
        html: cuerpo,
      }),
    });
    if (!envio.ok) throw new Error(`Resend respondió ${envio.status}: ${await envio.text()}`);
  }

  const resultado = { activadas: 0, sinConfirmar: 0, errores: [] };

  // 1) Altas activadas de verdad, todavía sin avisar.
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/altas_activadas_pendientes_aviso`, {
      method: "POST",
      headers: cabecerasSupabase,
      body: "{}",
    });
    if (!resp.ok) throw new Error(`rpc altas_activadas_pendientes_aviso HTTP ${resp.status}: ${await resp.text()}`);
    const filas = await resp.json();
    for (const fila of filas) {
      await enviarEmail(
        `Costa Viva: alta activada — ${fila.email}`,
        `<p>${fila.email} confirmó su email y ya tiene acceso a Costa Viva.</p><p>No hace falta ninguna acción por tu parte.</p>`
      );
      const marcar = await fetch(`${SUPABASE_URL}/rest/v1/rpc/marcar_alta_activada_avisada`, {
        method: "POST",
        headers: cabecerasSupabase,
        body: JSON.stringify({ p_user_id: fila.id }),
      });
      if (!marcar.ok) throw new Error(`rpc marcar_alta_activada_avisada HTTP ${marcar.status}: ${await marcar.text()}`);
      resultado.activadas++;
    }
  } catch (e) {
    resultado.errores.push(`activadas: ${String(e)}`);
  }

  // 2) Altas que llevan más de 48h sin confirmar el email.
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/altas_sin_confirmar_pendiente_aviso`, {
      method: "POST",
      headers: cabecerasSupabase,
      body: JSON.stringify({ p_horas: 48 }),
    });
    if (!resp.ok) throw new Error(`rpc altas_sin_confirmar_pendiente_aviso HTTP ${resp.status}: ${await resp.text()}`);
    const filas = await resp.json();
    for (const fila of filas) {
      await enviarEmail(
        `Costa Viva: alta sin confirmar — ${fila.email}`,
        `<p>${fila.email} se registró el ${fila.creado_en} y sigue sin confirmar su email 48h después.</p><p>Puede ser un problema de entrega del email de confirmación — merece un vistazo.</p>`
      );
      const marcar = await fetch(`${SUPABASE_URL}/rest/v1/rpc/marcar_alta_fallida_avisada`, {
        method: "POST",
        headers: cabecerasSupabase,
        body: JSON.stringify({ p_user_id: fila.id }),
      });
      if (!marcar.ok) throw new Error(`rpc marcar_alta_fallida_avisada HTTP ${marcar.status}: ${await marcar.text()}`);
      resultado.sinConfirmar++;
    }
  } catch (e) {
    resultado.errores.push(`sinConfirmar: ${String(e)}`);
  }

  const status = resultado.errores.length ? 502 : 200;
  return new Response(JSON.stringify(resultado), { status, headers: { "content-type": "application/json" } });
}
