// functions/stripe-webhook.js
// Recibe los eventos de Stripe (checkout completado, suscripción
// creada/actualizada/cancelada, cobro fallido) y actualiza
// public.suscripciones. Alcanzable en /stripe-webhook. Configurar en el
// Dashboard de Stripe (Developers → Webhooks) contra esta URL, eventos:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted,
//   invoice.payment_failed
//
// Captación (2026-10-09): cuando una suscripción pasa a "active" (primer
// cobro real tras la prueba) se apunta suscripciones.primer_pago_en (métrica
// prueba -> pago) y, si esa persona vino con "Invita a un amigo", se da el
// mes gratis a quien la invitó (_lib/referidos.js). No hace falta ningún
// evento nuevo en Stripe.
//
// Idempotencia (comun, estandares/stripe.md S3, 2026-10-07): cada event.id
// se guarda en public.stripe_eventos antes de procesarlo; un evento repetido
// responde 200 sin hacer nada.
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

import { calcularFin, uuidValido } from "./_lib/invitaciones.js";
import { premiarReferido, marcarDiasUsados } from "./_lib/referidos.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

// Mismo producto/precios que crear-checkout-stripe.js.
// Mismos precios live que crear-checkout-stripe.js (2026-09-15).
const PERIODOS_POR_PRECIO = {
  "price_1UG0hPGVID60u22aXMcBJNF3": "mensual",
  "price_1UG0hPGVID60u22a3GO1Cflj": "anual",
};

async function verificarFirmaStripe(rawBody, header, secret) {
  // La cabecera puede traer varias firmas v1 (rotación del secreto en
  // Stripe, comun stripe.md S1): vale si coincide cualquiera de ellas.
  let t = null;
  const firmasV1 = [];
  for (const parte of header.split(",")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const clave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (clave === "t") t = valor;
    else if (clave === "v1" && valor) firmasV1.push(valor);
  }
  if (!t || !firmasV1.length) throw new Error("cabecera Stripe-Signature mal formada");

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

  const coincide = (v1) => {
    if (firmaCalculadaHex.length !== v1.length) return false;
    let diferencia = 0;
    for (let i = 0; i < firmaCalculadaHex.length; i++) {
      diferencia |= firmaCalculadaHex.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    return diferencia === 0;
  };
  // Se comparan todas (sin cortar en la primera) para no filtrar por tiempo
  // cuál de ellas coincidió.
  let alguna = false;
  for (const v1 of firmasV1) alguna = coincide(v1) || alguna;
  if (!alguna) return false;

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

// Idempotencia por event.id (comun stripe.md S3). Devuelve:
//   "nuevo"       → se ha guardado ahora, hay que procesarlo;
//   "repetido"    → ya estaba, no se vuelve a procesar;
//   "sin_registro"→ no se pudo guardar (p.ej. tabla aún no creada): se
//                   procesa igual, los upserts por user_id son idempotentes.
async function registrarEvento(serviceRoleKey, evento) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/stripe_eventos?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify([{ id: evento.id, tipo: evento.type || "?" }]),
    });
    if (!resp.ok) {
      console.error(`stripe_eventos: Supabase respondió ${resp.status}, se procesa sin idempotencia:`, await resp.text());
      return "sin_registro";
    }
    const filas = await resp.json();
    return Array.isArray(filas) && filas.length ? "nuevo" : "repetido";
  } catch (e) {
    console.error("stripe_eventos: fallo al registrar, se procesa sin idempotencia:", e);
    return "sin_registro";
  }
}

// Invitación con descuento usada en este pago (metadata invitacion_id que pone
// crear-checkout-stripe.js, 2026-10-08). Idempotente: solo marca si aún no
// estaba marcada. descuento_hasta es aproximado (Stripe cuenta los meses del
// cupón desde la creación de la suscripción) y solo sirve para el panel.
async function marcarInvitacionAplicada(serviceRoleKey, invitacionId) {
  if (!uuidValido(invitacionId)) return;
  const cab = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invitaciones?id=eq.${invitacionId}&select=*`, { headers: cab });
  if (!r.ok) throw new Error(`invitaciones HTTP ${r.status}: ${await r.text()}`);
  const inv = (await r.json())[0];
  if (!inv || inv.descuento_aplicado_en) return;
  const ahora = new Date();
  const fin = calcularFin(inv, ahora);
  const u = await fetch(`${SUPABASE_URL}/rest/v1/invitaciones?id=eq.${invitacionId}&descuento_aplicado_en=is.null`, {
    method: "PATCH",
    headers: cab,
    body: JSON.stringify({ descuento_aplicado_en: ahora.toISOString(), descuento_hasta: fin ? fin.toISOString() : null }),
  });
  if (!u.ok) throw new Error(`marcar invitación HTTP ${u.status}: ${await u.text()}`);
}

// Primer cobro real (2026-10-09, métricas de captación): la primera vez que
// la suscripción está "active" se apunta primer_pago_en. El filtro
// primer_pago_en=is.null hace que solo cuente la primera vez.
async function apuntarPrimerPago(serviceRoleKey, userId) {
  if (!uuidValido(userId)) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/suscripciones?user_id=eq.${userId}&primer_pago_en=is.null`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify({ primer_pago_en: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`primer_pago_en HTTP ${r.status}: ${await r.text()}`);
}

// Si el procesado falla, se borra el registro para que el reintento de
// Stripe no se tome por repetido.
async function olvidarEvento(serviceRoleKey, eventoId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/stripe_eventos?id=eq.${encodeURIComponent(eventoId)}`, {
      method: "DELETE",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
  } catch (e) {
    console.error("stripe_eventos: no se pudo borrar el evento fallido", eventoId, e);
  }
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

  if (!evento?.id) return new Response("evento sin id", { status: 400 });

  const registro = await registrarEvento(serviceRoleKey, evento);
  if (registro === "repetido") {
    return new Response(JSON.stringify({ received: true, repetido: true }), {
      headers: { "content-type": "application/json" },
    });
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
      if (obj.metadata?.invitacion_id) {
        await marcarInvitacionAplicada(serviceRoleKey, obj.metadata.invitacion_id);
      }
      // Meses de "Invita a un amigo" usados como días de prueba extra
      // (crear-checkout-stripe.js los pone en metadata.referidos_dias).
      if (obj.metadata?.referidos_dias && uuidValido(userId)) {
        await marcarDiasUsados({ serviceRoleKey, userId, ids: obj.metadata.referidos_dias, sesionId: obj.id });
      }
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
      // Primer cobro real y premio de "Invita a un amigo" (2026-10-09).
      // "active" = la prueba terminó y Stripe cobró. Si el premio falla en
      // Stripe se lanza: 500, Stripe reintenta y el amigo sigue "pendiente"
      // (la clave de idempotencia evita dar dos meses).
      if (estado === "active" && uuidValido(userId)) {
        await apuntarPrimerPago(serviceRoleKey, userId);
        await premiarReferido({ serviceRoleKey, stripeKey: env.STRIPE_SECRET_KEY, userId, customerAmigo: obj.customer });
      }
    } else if (evento.type === "invoice.payment_failed") {
      // Cobro fallido (comun stripe.md S4). No se toca el estado aquí: Stripe
      // pasa la suscripción a past_due/unpaid y lo comunica con
      // customer.subscription.updated, que es la fuente de verdad (y el
      // acceso solo se da con trialing/active). Aquí se deja rastro en el
      // log para poder ver en Cloudflare quién falló y cuántas veces.
      console.warn(
        "Stripe invoice.payment_failed:",
        JSON.stringify({
          evento: evento.id,
          customer: obj.customer,
          subscription: obj.subscription || obj.parent?.subscription_details?.subscription || null,
          intento: obj.attempt_count,
          proximo_intento: obj.next_payment_attempt,
        })
      );
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
    if (registro === "nuevo") await olvidarEvento(serviceRoleKey, evento.id);
    // Sin el detalle del error en la respuesta: ya está en el log.
    return new Response("error interno", { status: 500 });
  }
}
