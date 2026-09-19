// functions/informe-diario-email.js
// Manda el informe diario también por EMAIL, no solo como comentario en el
// Issue de GitHub (ver .github/workflows/daily-report.yml).
//
// Motivo (2026-09-19, hallazgo real comparando con Pólizas.ai): el usuario
// esperaba recibir este informe sin tener que hacer nada, como le pasa en
// Pólizas.ai — pero ahí el informe se manda por email de verdad (vía
// avisar.js/Resend, ver la rutina en la nube "Pólizas.ai - Informe diario").
// Aquí en Costaviva solo se posteaba como comentario en un Issue de GitHub,
// que solo llega por email si el usuario está "Watching" ese repo/Issue —
// nada garantiza eso por defecto, así que el informe podía llevar días
// publicándose sin que nadie lo viera nunca. Esto no sustituye el Issue
// (se queda como histórico buscable), lo complementa con la vía que sí
// garantiza que llegue.
//
// Mismo patrón que notificar-altas.js: protegido con el secreto compartido
// (cabecera X-Cron-Secret, variable CRON_SECRET) y reutiliza
// RESEND_API_KEY/ADMIN_EMAIL, ya configurados en Cloudflare Pages — no
// hace falta ningún secreto nuevo.

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
  const adminEmail = env.ADMIN_EMAIL;
  if (!resendKey || !adminEmail) {
    return new Response(JSON.stringify({ error: "email de informe diario no configurado todavía" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  let cuerpo;
  try {
    const datos = await context.request.json();
    cuerpo = typeof datos.texto === "string" ? datos.texto : null;
  } catch {
    cuerpo = null;
  }
  if (!cuerpo) {
    return new Response(JSON.stringify({ error: "se esperaba { texto: string } en el cuerpo" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "Costaviva <avisos@costaviva.org>",
      to: [adminEmail],
      subject: `Costaviva: informe diario — ${hoy}`,
      text: cuerpo,
    }),
  });
  if (!envio.ok) {
    const detalle = await envio.text();
    return new Response(JSON.stringify({ error: `Resend respondió ${envio.status}: ${detalle}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
}
