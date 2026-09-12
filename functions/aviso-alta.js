// functions/aviso-alta.js
// Avisa al admin (por email) cuando alguien completa un alta real en
// Costa Viva. Alcanzable en /aviso-alta, llamado por login.html justo
// después de un signUp() con éxito.
//
// Variables de entorno necesarias en Cloudflare Pages (Settings >
// Environment variables, ambas como "Secret", nunca en el repo):
//   RESEND_API_KEY          (la misma que ya usa sos-alerta.js)
//   SUPABASE_SERVICE_ROLE_KEY
//   ADMIN_EMAIL              (a quién avisar)
//
// Por qué hace falta la service_role key aquí y en ningún otro sitio del
// repo: en el momento del alta (signUp) todavía no existe una sesión de
// usuario real que verificar — "Confirm email" está activo, así que no
// hay token hasta que el usuario confirma. El cliente solo puede mandar
// un user_id, y CUALQUIERA podría mandar un user_id inventado o el de
// otra persona para intentar generar avisos falsos. La única forma de
// verificar sin session que ese alta es real es preguntarle a Supabase
// Auth directamente (API admin, requiere service_role) si existe de
// verdad un usuario con ese id creado hace menos de 5 minutos — solo un
// signUp() real puede producir esa combinación, así que no es
// falsificable con un id inventado o uno viejo reutilizado. Este es el
// ÚNICO uso de service_role en todo el repo, y solo para leer
// auth.users por id — nunca para leer/escribir tablas de usuario
// (contactos_emergencia, alertas_sos, etc.), que siguen pasando siempre
// por el token del propio usuario.
//
// Fallo silencioso a propósito: si algo aquí falla (falta configurar,
// Resend caído, lo que sea), el alta del usuario en sí NO debe verse
// afectada — login.html llama a este endpoint sin esperar ni bloquear
// el flujo de alta por su resultado.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const VENTANA_MAX_MS = 5 * 60 * 1000; // 5 minutos

export async function onRequestPost(context) {
  const { request, env } = context;
  const resendKey = env.RESEND_API_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = env.ADMIN_EMAIL;
  if (!resendKey || !serviceRoleKey || !adminEmail) {
    return new Response(JSON.stringify({ error: "aviso de alta no configurado todavía" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "cuerpo inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { user_id } = body;
  if (!user_id || typeof user_id !== "string") {
    return new Response(JSON.stringify({ error: "falta user_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Consulta con service_role, SOLO a auth.users por id — nunca a
    // ninguna tabla de public.* con esta key.
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "usuario no encontrado" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const usuario = await resp.json();
    const creadoHaceMs = Date.now() - new Date(usuario.created_at).getTime();
    if (!(creadoHaceMs >= 0 && creadoHaceMs < VENTANA_MAX_MS)) {
      // No es falsificable con un id inventado (404 arriba), pero sí es
      // reproducible reenviando el id de un alta real ya antigua — esto
      // lo descarta.
      return new Response(JSON.stringify({ error: "alta no reciente, no se avisa" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const asunto = `Nueva alta en Costa Viva: ${usuario.email}`;
    const cuerpo = `
      <p>Alta nueva registrada en Costa Viva.</p>
      <p><b>Email:</b> ${usuario.email}</p>
      <p><b>Fecha:</b> ${usuario.created_at}</p>
      <p style="color:#888; font-size:12px;">Pendiente de aprobación manual en el Table Editor de Supabase (tabla perfiles, campo aprobado).</p>
    `;
    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Costa Viva <avisos@costaviva.app>",
        to: [adminEmail],
        subject: asunto,
        html: cuerpo,
      }),
    });
    if (!envio.ok) {
      const detalle = await envio.text();
      throw new Error(`Resend respondió ${envio.status}: ${detalle}`);
    }

    return new Response(JSON.stringify({ avisado: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
