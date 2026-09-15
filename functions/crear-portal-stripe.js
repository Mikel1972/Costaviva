// functions/crear-portal-stripe.js
// Crea una sesión del Billing Portal de Stripe para que el usuario
// gestione/cancele su propia suscripción (tarjeta, factura, cancelar).
// Alcanzable en /crear-portal-stripe. Mismo patrón de auth que
// crear-checkout-stripe.js.
//
// Pedido explícito del usuario: al cancelar (mensual o anual), el
// acceso debe seguir activo hasta el final del periodo ya pagado, no
// cortarse al momento. Esto es el comportamiento natural de Stripe
// cuando la cancelación es "al final del periodo" (no inmediata) — el
// estado de la suscripción sigue "active" (con cancel_at_period_end)
// hasta que el periodo termina de verdad, y solo entonces pasa a
// "canceled" — mi_estado_suscripcion() ya lo respeta sin cambios,
// porque solo mira el estado, no si hay una cancelación programada.
//
// *** PENDIENTE DE CONFIGURAR EN EL DASHBOARD DE STRIPE (no se puede
// hacer desde aquí sin la API de configuración del portal): ***
// Settings → Billing → Customer portal → Cancellations → elegir
// "Cancel at end of billing period", no "Cancel immediately". Sin este
// ajuste, el portal cancelaría al momento y el usuario perdería el
// acceso antes de lo prometido.
//
// Variable de entorno necesaria en Cloudflare Pages (Settings >
// Environment variables, como "Secret", nunca en el repo):
// STRIPE_SECRET_KEY (la misma que ya usa crear-checkout-stripe.js).

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

async function clienteStripeDelUsuario(token, userId) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/suscripciones?select=stripe_customer_id&user_id=eq.${userId}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const filas = await resp.json();
  return filas[0]?.stripe_customer_id || null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Pagos no configurados todavía (falta STRIPE_SECRET_KEY)" }), {
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

  try {
    const usuario = await usuarioDesdeToken(token);
    const clienteId = await clienteStripeDelUsuario(token, usuario.id);
    if (!clienteId) {
      return new Response(JSON.stringify({ error: "todavía no tienes una suscripción de pago que gestionar" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const origen = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.append("customer", clienteId);
    params.append("return_url", `${origen}/suscripcion.html`);

    const resp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      return new Response(JSON.stringify({ error: `Stripe respondió ${resp.status}: ${detalle}` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const sesion = await resp.json();
    return new Response(JSON.stringify({ url: sesion.url }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
