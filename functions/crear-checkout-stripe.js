// functions/crear-checkout-stripe.js
// Crea una Stripe Checkout Session (modo suscripción) para el usuario
// que llama, con 7 días de prueba. Alcanzable en /crear-checkout-stripe.
//
// Mismo patrón de auth que sos-alerta.js: valida el token del propio
// usuario contra Supabase Auth, nunca acepta datos sensibles crudos del
// cliente (aquí, el price id de Stripe — solo se acepta "monthly" o
// "annual" y se traduce server-side, ver PRECIOS).
//
// Variable de entorno necesaria en Cloudflare Pages (Settings >
// Environment variables, como "Secret", nunca en el repo):
// STRIPE_SECRET_KEY.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

// Producto real en Stripe, modo LIVE (2026-09-15, tras verificar la
// cuenta): "Costaviva Premium". Los IDs de test (prod_VGVio7rbJPK1Oh y
// sus precios) quedan en el historial de git, ya no son válidos aquí
// — test y live son espacios de objetos completamente separados en
// Stripe, un STRIPE_SECRET_KEY live no puede usar precios de test.
const PRECIOS = {
  monthly: "price_1UG0hPGVID60u22aXMcBJNF3", // 3,99€/mes
  annual: "price_1UG0hPGVID60u22a3GO1Cflj", // 39,99€/año
};

async function usuarioDesdeToken(token) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("token de sesión inválido o caducado");
  return resp.json();
}

async function clienteStripeExistente(token, userId) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/suscripciones?select=stripe_customer_id&user_id=eq.${userId}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const filas = await resp.json();
  return filas[0]?.stripe_customer_id || null;
}

// Días de prueba restantes en la app (desde perfiles.creado_en, 7 días
// totales) — evita regalar otros 7 días de prueba de Stripe encima de
// una prueba de la app ya parcialmente consumida.
function diasDePruebaRestantes(fechaAltaISO) {
  const creado = new Date(fechaAltaISO).getTime();
  const transcurridos = (Date.now() - creado) / (1000 * 60 * 60 * 24);
  const restantes = Math.ceil(7 - transcurridos);
  return Math.max(1, Math.min(7, restantes));
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

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "cuerpo inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const plan = body?.plan;
  if (plan !== "monthly" && plan !== "annual") {
    return new Response(JSON.stringify({ error: "plan inválido (usa 'monthly' o 'annual')" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const usuario = await usuarioDesdeToken(token);
    const clienteExistente = await clienteStripeExistente(token, usuario.id);
    const origen = new URL(request.url).origin;

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", PRECIOS[plan]);
    params.append("line_items[0][quantity]", "1");
    params.append(
      "subscription_data[trial_period_days]",
      String(diasDePruebaRestantes(usuario.created_at))
    );
    // Imprescindible para que el user_id llegue a los eventos
    // customer.subscription.* del webhook — el objeto Subscription no
    // hereda el metadata/client_reference_id de nivel superior de la
    // Checkout Session.
    params.append("subscription_data[metadata][supabase_user_id]", usuario.id);
    params.append("success_url", `${origen}/suscripcion.html?exito=1`);
    params.append("cancel_url", `${origen}/suscripcion.html?cancelado=1`);
    params.append("client_reference_id", usuario.id);
    params.append("metadata[supabase_user_id]", usuario.id);
    // Permite introducir un código de cupón/promoción en la propia
    // pantalla de Checkout de Stripe — los cupones (% o importe fijo,
    // con caducidad o límite de usos) se crean y gestionan desde el
    // Dashboard de Stripe (Products → Coupons), no hace falta código
    // nuevo aquí para cada cupón.
    params.append("allow_promotion_codes", "true");
    // "Managed Payments" (activado por defecto en cuentas nuevas de
    // Stripe) exige un tax_code por producto si está activo — no
    // configuramos Stripe Tax a propósito (ver login.html/suscripcion.html,
    // decisión explícita de no activarlo por ahora), así que se
    // desactiva para esta sesión en vez de rellenar un código fiscal.
    params.append("managed_payments[enabled]", "false");
    if (clienteExistente) {
      params.append("customer", clienteExistente);
    } else {
      params.append("customer_email", usuario.email);
    }

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
