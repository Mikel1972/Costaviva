// functions/_lib/referidos.js
// "Invita a un amigo" (2026-10-09, aprobado por Mikel). Lo usan
// stripe-webhook.js (premio cuando el amigo paga) y crear-checkout-stripe.js
// (meses ganados antes de suscribirse = días de prueba extra).
//
// Las decisiones (quién cuenta, topes, misma tarjeta repetida...) las toma
// Postgres (migración 20261009110000_invita_a_un_amigo.sql). Aquí solo:
//   - la huella de la tarjeta que da Stripe, convertida en hash;
//   - el saldo a favor en Stripe (1 mes = 3,99 €) con clave de idempotencia,
//     para que un reintento del webhook no regale dos meses.

import { uuidValido } from "./invitaciones.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

// 1 mes del plan mensual (3,99 €), en céntimos. Saldo negativo = a favor
// del cliente: Stripe lo descuenta de sus próximas facturas (mensual o anual).
export const CREDITO_MES_CENTIMOS = 399;
export const DIAS_POR_MES = 30;
export const MAX_MESES_EN_CHECKOUT = 3;

export function diasExtraPorReferidos(n) {
  const meses = Math.max(0, Math.min(MAX_MESES_EN_CHECKOUT, Number.isInteger(n) ? n : 0));
  return meses * DIAS_POR_MES;
}

// "id1,id2" del metadata del checkout -> ids válidos, como mucho 3.
export function idsDeMetadata(texto) {
  return String(texto || "").split(",").map((s) => s.trim()).filter(uuidValido).slice(0, MAX_MESES_EN_CHECKOUT);
}

export async function hashHex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(texto)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ¿Comparten alguna tarjeta? (huellas de Stripe en claro, solo en memoria)
export function compartenTarjeta(huellasA, huellasB) {
  const a = new Set(huellasA.filter(Boolean));
  return huellasB.some((h) => h && a.has(h));
}

async function huellasDeCliente(stripeKey, customerId, fetchImpl = fetch) {
  if (!customerId || !/^cus_[A-Za-z0-9]+$/.test(customerId)) return [];
  const r = await fetchImpl(`https://api.stripe.com/v1/customers/${customerId}/payment_methods?type=card&limit=10`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!r.ok) {
    console.warn(`referidos: Stripe payment_methods HTTP ${r.status}`);
    return [];
  }
  const d = await r.json();
  return (d.data || []).map((pm) => pm.card?.fingerprint).filter(Boolean);
}

async function rpc(serviceRoleKey, nombre, cuerpo, fetchImpl = fetch) {
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${nombre} HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

// Llamado cuando la suscripción de `userId` pasa a "active" (primer cobro
// real). Si vino invitado y está pendiente, decide y da el premio. Lanza si
// falla algo que merezca reintento (Stripe responde 500 y reintenta).
export async function premiarReferido({ serviceRoleKey, stripeKey, userId, customerAmigo, fetchImpl = fetch }) {
  if (!uuidValido(userId)) return { resultado: "nada" };
  const pendiente = await rpc(serviceRoleKey, "referido_pendiente_de", { p_referido: userId }, fetchImpl);
  if (!pendiente || !pendiente.id) return { resultado: "nada" };

  let huellasAmigo = [], huellasReferidor = [];
  if (stripeKey) {
    huellasAmigo = await huellasDeCliente(stripeKey, customerAmigo, fetchImpl);
    huellasReferidor = await huellasDeCliente(stripeKey, pendiente.referidor_customer, fetchImpl);
  }
  const huella = huellasAmigo[0] ? await hashHex(huellasAmigo[0]) : null;
  const decision = await rpc(serviceRoleKey, "referido_resolver_pago", {
    p_id: pendiente.id, p_huella: huella, p_misma_tarjeta: compartenTarjeta(huellasReferidor, huellasAmigo),
  }, fetchImpl);

  if (decision?.resultado !== "saldo") {
    console.log(`referidos: amigo ${pendiente.id} -> ${decision?.resultado}${decision?.motivo ? ` (${decision.motivo})` : ""}`);
    return decision || { resultado: "nada" };
  }
  if (!stripeKey) throw new Error("referidos: falta STRIPE_SECRET_KEY para dar el saldo");

  const params = new URLSearchParams({
    amount: String(-CREDITO_MES_CENTIMOS),
    currency: "eur",
    description: "Costaviva: 1 mes gratis por invitar a un amigo",
    "metadata[referido_id]": pendiente.id,
  });
  const r = await fetchImpl(`https://api.stripe.com/v1/customers/${decision.referidor_customer}/balance_transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Un reintento del webhook nunca da dos meses por el mismo amigo.
      "Idempotency-Key": `costaviva-referido-${pendiente.id}`,
    },
    body: params.toString(),
  });
  if (!r.ok) throw new Error(`referidos: Stripe balance_transactions HTTP ${r.status}: ${await r.text()}`);
  const tx = await r.json();
  await rpc(serviceRoleKey, "referido_marcar_recompensa", {
    p_id: pendiente.id, p_tipo: "saldo_stripe", p_ref: tx.id || "saldo", p_referidor: null, p_huella: huella,
  }, fetchImpl);
  console.log(`referidos: amigo ${pendiente.id} -> 1 mes de saldo a favor (${tx.id})`);
  return { resultado: "saldo", tx: tx.id };
}

// checkout.session.completed con metadata referidos_dias: marca esos meses
// como usados (solo si son de quien ha pagado).
export async function marcarDiasUsados({ serviceRoleKey, userId, ids, sesionId, fetchImpl = fetch }) {
  if (!uuidValido(userId)) return 0;
  let n = 0;
  for (const id of idsDeMetadata(ids)) {
    const ok = await rpc(serviceRoleKey, "referido_marcar_recompensa", {
      p_id: id, p_tipo: "dias_prueba", p_ref: String(sesionId || "checkout").slice(0, 120), p_referidor: userId, p_huella: null,
    }, fetchImpl);
    if (ok === true) n++;
  }
  return n;
}
