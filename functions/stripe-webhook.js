// functions/stripe-webhook.js
// Recibe los eventos de Stripe (checkout completado, suscripción
// creada/actualizada/cancelada) y actualiza public.suscripciones.
// Alcanzable en /stripe-webhook. Configurar en el Dashboard de Stripe
// (Developers → Webhooks) contra esta URL, eventos:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted
//
// *** SEGUNDA EXCEPCIÓN DEL REPO AL USO DE service_role (la primera es
// aviso-alta.js) ***: aquí no hay sesión de usuario ni secreto
// compartido tipo X-Cron-Secret — la prueba de autenticidad es la
// firma criptográfica que manda Stripe en la cabecera Stripe-Signature
// (HMAC-SHA256 verificado a mano más abajo, sin SDK). Solo una vez
// verificada esa firma se usa SUPABASE_SERVICE_ROLE_KEY para escribir
// en suscripciones, bypassando RLS a propósito — igual razonamiento
// que aviso-alta.js: sin sesión de usuario disponible, se necesita una
// identidad de servidor de confianza en su lugar.
//
// Variables de entorno necesarias en Cloudflare Pages (Settings >
// Environment variables, como "Secret", nunca en el repo):
// STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY (la misma que usa
// aviso-alta.js).

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

// Mismo producto/precios que crear-checkout-stripe.js.
// Mismos precios live que crear-checkout-stripe.js (2026-09-15).
const PERIODOS_POR_PRECIO = {
  "price_1UG0hPGVID60u22aXMcBJNF3": "mensual",
  "price_1UG0hPGVID60u22a3GO1Cflj": "anual",
};

async function verificarFirmaStripe(rawBody, header, secret) {
  const partes = Object.fromEntries(
    header.split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  const t = partes.t;
  const v1 = partes.v1;
  if (!t || !v1) throw new Error("cabecera Stripe-Signature mal formada");

  const payloadFirmado = `${t}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firmaBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadFirmado));
  const firmaCalculadaHex = [...new Uint8Array(firmaBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (firmaCalculadaHex.length !== v1.length) return false;
  let diferencia = 0;
  for (let i = 0; i < firmaCalculadaHex.length; i++) {
    diferencia |= firmaCalculadaHex.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  if (diferencia !== 0) return false;

  // Protección anti-replay recomendada por Stripe: rechazar timestamps
  // de más de 5 minutos de antigüedad.
  const antiguedadSeg = Math.abs(Date.now() / 1000 - Number(t));
  if (antiguedadSeg > 300) throw new Error("timestamp de la firma demasiado antiguo");

  return true;
}

async function upsertSuscripcion(serviceRoleKey, fila) {
  if (!fila.user_id) {
    console.error("Evento de Stripe sin supabase_user_id, ignorado:", fila);
    return;
  }
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/suscripciones?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([fila]),
  });
  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`Supabase respondió ${resp.status} al guardar la suscripción: ${detalle}`);
  }
}

// Fallback si el evento de suscripción no trae supabase_user_id en el
// metadata (no debería pasar si crear-checkout-stripe.js siempre lo
// manda, pero por si Stripe manda un evento de una suscripción creada
// de otra forma) — buscar la fila existente por stripe_customer_id.
async function userIdPorClienteStripe(serviceRoleKey, stripeCustomerId) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/suscripciones?select=user_id&stripe_customer_id=eq.${stripeCustomerId}`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  if (!resp.ok) return null;
  const filas = await resp.json();
  return filas[0]?.user_id || null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !serviceRoleKey) {
    return new Response("no configurado todavía", { status: 501 });
  }

  const rawBody = await request.text();
  const firmaHeader = request.headers.get("Stripe-Signature") || "";

  let valido;
  try {
    valido = await verificarFirmaStripe(rawBody, firmaHeader, webhookSecret);
  } catch (e) {
    return new Response(`firma inválida: ${e}`, { status: 400 });
  }
  if (!valido) return new Response("firma inválida", { status: 400 });

  let evento;
  try {
    evento = JSON.parse(rawBody);
  } catch {
    return new Response("cuerpo inválido", { status: 400 });
  }

  try {
    const obj = evento.data?.object || {};

    if (evento.type === "checkout.session.completed") {
      // Solo vincula cliente/suscripción al user_id — el objeto Session
      // no trae de forma fiable el periodo/estado real de la
      // suscripción, eso llega en customer.subscription.created justo
      // después.
      const userId = obj.client_reference_id || obj.metadata?.supabase_user_id;
      await upsertSuscripcion(serviceRoleKey, {
        user_id: userId,
        stripe_customer_id: obj.customer,
        stripe_subscription_id: obj.subscription,
        actualizado_en: new Date().toISOString(),
      });
    } else if (
      evento.type === "customer.subscription.created" ||
      evento.type === "customer.subscription.updated" ||
      evento.type === "customer.subscription.deleted"
    ) {
      let userId = obj.metadata?.supabase_user_id;
      if (!userId) {
        userId = await userIdPorClienteStripe(serviceRoleKey, obj.customer);
      }
      const item = obj.items?.data?.[0];
      const estado = evento.type === "customer.subscription.deleted" ? "canceled" : obj.status;
      // Verificado en real contra un evento de prueba (2026-09-15): en
      // esta versión de la API de Stripe, current_period_end YA NO vive
      // en el objeto Subscription de nivel superior (venía null) — se
      // movió al subscription_item. trial_end sí sigue en el nivel
      // superior y coincide con el fin del periodo durante el trial.
      const finPeriodoUnix = item?.current_period_end || obj.trial_end || null;
      await upsertSuscripcion(serviceRoleKey, {
        user_id: userId,
        stripe_customer_id: obj.customer,
        stripe_subscription_id: obj.id,
        estado,
        periodo: PERIODOS_POR_PRECIO[item?.price?.id] || null,
        periodo_actual_fin: finPeriodoUnix
          ? new Date(finPeriodoUnix * 1000).toISOString()
          : null,
        actualizado_en: new Date().toISOString(),
      });
    }
    // Cualquier otro tipo de evento: 200 sin acción — Stripe exige
    // confirmación 200 para todo evento entregado, no solo los que nos
    // interesan.

    return new Response(JSON.stringify({ received: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Error procesando webhook de Stripe:", e);
    // 500 a propósito: Stripe reintenta los eventos fallidos con
    // backoff, así que un fallo real (p.ej. Supabase caído un momento)
    // se recupera solo en el siguiente reintento.
    return new Response(String(e), { status: 500 });
  }
}
