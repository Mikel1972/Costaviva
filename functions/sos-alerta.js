// functions/sos-alerta.js
// Recibe el aviso SOS del cliente (alarma.html), busca los contactos de
// emergencia del usuario que llama (respetando RLS, con su propio token —
// nunca con la service_role key) y les manda un email vía Resend.
// Alcanzable en /sos-alerta.
//
// Variable de entorno necesaria en Cloudflare Pages (Settings > Environment
// variables, como "Secret", nunca en el repo): RESEND_API_KEY.
//
// *** LIMITACIÓN CRÍTICA CONOCIDA (encontrada 2026-09-12, sin resolver) ***
// El dominio "costaviva.app" NO está verificado en Resend (no hay dominio
// propio todavía). Sin verificar un dominio, Resend RECHAZA cualquier
// email a un destinatario que no sea el dueño de la cuenta de Resend
// (confirmado en real: 403 "domain is not verified" al mandar desde
// avisos@costaviva.app). Como los contactos de emergencia son personas
// reales distintas del dueño de la cuenta de Resend, **este endpoint
// probablemente no está entregando el email de socorro a nadie en
// producción ahora mismo**, aunque el resto del flujo (RLS, auth, la
// respuesta al cliente) funcione bien. Arreglo real pendiente: verificar
// un dominio propio en Resend (resend.com/domains) y usarlo aquí en
// "from". Ver CLAUDE.md.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

async function usuarioDesdeToken(token) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("token de sesión inválido o caducado");
  return resp.json();
}

async function contactosDelUsuario(token) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/contactos_emergencia?select=nombre,email`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error("no se pudieron leer los contactos de emergencia");
  return resp.json();
}

async function enviarEmail(resendKey, destinatario, nombreUsuario, lat, lon, tipo, horaLocal) {
  const enlaceMapa = `https://maps.google.com/?q=${lat},${lon}`;
  const motivo = tipo === "caida_detectada" ? "una posible caída detectada por su teléfono" : "un aviso manual";
  const asunto = `🆘 Aviso SOS de ${nombreUsuario} — Costa Viva`;
  const cuerpo = `
    <p><b>${nombreUsuario}</b> ha activado una alarma en Costa Viva (${motivo}) a las ${horaLocal}.</p>
    <p>Última ubicación conocida:</p>
    <p><a href="${enlaceMapa}">${enlaceMapa}</a></p>
    <p style="color:#888; font-size:12px;">Este es un aviso automático. Si no puedes contactar con ${nombreUsuario}, considera llamar al 112.</p>
  `;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "Costa Viva SOS <sos@costaviva.app>",
      to: [destinatario],
      subject: asunto,
      html: cuerpo,
    }),
  });
  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`Resend respondió ${resp.status}: ${detalle}`);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "SOS por email no configurado todavía (falta RESEND_API_KEY)" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "falta el token de sesión" }), {
      status: 401,
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
  const { lat, lon, tipo } = body;
  if (typeof lat !== "number" || typeof lon !== "number") {
    return new Response(JSON.stringify({ error: "faltan coordenadas" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const usuario = await usuarioDesdeToken(token);
    const contactos = await contactosDelUsuario(token);
    if (!contactos.length) {
      return new Response(JSON.stringify({ error: "no tienes ningún contacto de emergencia registrado", enviados: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const horaLocal = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
    const nombreUsuario = usuario.email || "un usuario de Costa Viva";

    const resultados = await Promise.allSettled(
      contactos.map((c) => enviarEmail(resendKey, c.email, nombreUsuario, lat, lon, tipo, horaLocal))
    );
    const enviados = resultados.filter((r) => r.status === "fulfilled").length;
    const fallidos = resultados.filter((r) => r.status === "rejected");
    if (fallidos.length) fallidos.forEach((f) => console.error("Fallo enviando SOS:", f.reason));

    return new Response(JSON.stringify({ enviados, total: contactos.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
