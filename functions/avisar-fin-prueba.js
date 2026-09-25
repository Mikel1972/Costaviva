// functions/avisar-fin-prueba.js
// Avisa por email al usuario cuando su prueba de 7 días ha terminado y no
// tiene suscripción (pedido explícito del usuario, 2026-09-25).
//
// Mismo patrón que notificar-altas.js: protegido con el secreto compartido
// X-Cron-Secret, llamado por .github/workflows/notificar-altas.yml, y
// reutiliza RESEND_API_KEY y SUPABASE_SERVICE_ROLE_KEY. No hace falta
// ningún secreto nuevo.
//
// DIFERENCIA IMPORTANTE CON notificar-altas.js: aquel escribe al admin
// (una persona, que ya sabe qué es esto). Este escribe a USUARIOS REALES.
// Por eso:
//   - La lista de a quién avisar la decide Postgres, no este código: la
//     función usuarios_fin_prueba_pendiente_aviso() ya filtra por prueba
//     vencida, sin suscripción viva, email confirmado y no avisado antes
//     (ver la migración 20260925180000). Aquí no se recalcula nada: menos
//     sitios donde equivocarse y escribirle a quien no toca.
//   - Se marca como avisado SOLO después de que Resend confirme el envío.
//     Al revés, un fallo de envío dejaría a ese usuario sin aviso para
//     siempre y en silencio.
//   - Si falla el envío a una persona, se sigue con las demás. Un email
//     rebotado no debe impedir el resto.
//
// El tono del email importa: alguien que probó la app y no siguió no ha
// hecho nada malo. Se le dice qué pasa con sus datos (se guardan), se le
// da el enlace para suscribirse si quiere, y se acabó. Nada de urgencia
// fabricada ni cuentas atrás.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

function plantilla(nombreApp = "Costaviva") {
  const asunto = `Tu prueba de ${nombreApp} ha terminado`;
  const cuerpo = [
    `Hola,`,
    ``,
    `Tus 7 días de prueba de ${nombreApp} han terminado, así que de momento no puedes seguir consultando las condiciones del mar ni tu cuaderno de pesca.`,
    ``,
    `Tus datos siguen guardados: tus salidas, tus capturas, tus fotos y tus ubicaciones están tal y como los dejaste. Si en algún momento te suscribes, los tendrás todos ahí.`,
    ``,
    `Si quieres seguir:  https://costaviva.org/suscripcion`,
    ``,
    `3,99 €/mes o 39,99 €/año. Se puede cancelar cuando quieras.`,
    ``,
    `Y si no es para ti, no pasa nada — gracias por haberla probado.`,
    ``,
    `— ${nombreApp}`,
    `https://costaviva.org`,
  ].join("\n");
  return { asunto, cuerpo };
}

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
  if (!resendKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "aviso de fin de prueba no configurado todavía" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  const cabeceras = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/usuarios_fin_prueba_pendiente_aviso`, {
      method: "POST",
      headers: cabeceras,
      body: "{}",
    });
    if (!resp.ok) {
      const detalle = await resp.text();
      console.error(`avisar-fin-prueba: Supabase ${resp.status}: ${detalle}`);
      return new Response(JSON.stringify({ error: "no se pudo consultar la lista" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    const pendientes = await resp.json();
    if (!Array.isArray(pendientes) || !pendientes.length) {
      return new Response(JSON.stringify({ avisados: 0, mensaje: "nadie pendiente" }), {
        headers: { "content-type": "application/json" },
      });
    }

    const { asunto, cuerpo } = plantilla();
    let avisados = 0;
    const fallos = [];

    for (const usuario of pendientes) {
      if (!usuario.email) continue;
      try {
        const envio = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: "Costaviva <avisos@costaviva.org>",
            to: [usuario.email],
            subject: asunto,
            text: cuerpo,
          }),
        });
        if (!envio.ok) {
          const detalle = await envio.text();
          // El detalle de Resend al log, nunca a la respuesta: puede traer
          // el email del destinatario y no hace falta exponerlo.
          console.error(`avisar-fin-prueba: Resend ${envio.status}: ${detalle}`);
          fallos.push(usuario.user_id);
          continue;
        }
        // Marcar SOLO tras un envío confirmado (ver cabecera).
        const marcado = await fetch(`${SUPABASE_URL}/rest/v1/rpc/marcar_fin_prueba_avisado`, {
          method: "POST",
          headers: cabeceras,
          body: JSON.stringify({ p_user_id: usuario.user_id }),
        });
        if (!marcado.ok) {
          // Enviado pero sin marcar: se repetiría en la pasada siguiente.
          // Es mejor un email duplicado que uno perdido, pero conviene
          // verlo en los logs si pasa a menudo.
          console.error(`avisar-fin-prueba: enviado pero no se pudo marcar ${usuario.user_id}: ${marcado.status}`);
        }
        avisados++;
      } catch (e) {
        console.error(`avisar-fin-prueba: fallo con un usuario: ${String(e)}`);
        fallos.push(usuario.user_id);
      }
    }

    return new Response(JSON.stringify({ avisados, fallos: fallos.length, pendientes: pendientes.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error(`avisar-fin-prueba: fallo inesperado: ${String(e)}`);
    return new Response(JSON.stringify({ error: "fallo inesperado" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
