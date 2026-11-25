// functions/_lib/corregir-zona.js
// Parte con red de "Zona de precio por el país de la tarjeta" (2026-11-25,
// CLAUDE.md). Las reglas están en _lib/pais-tarjeta.js (puro, con tests);
// aquí solo se lee/escribe Stripe y Supabase (service_role) y se manda el
// email. Lo usan stripe-webhook.js (pagos con tarjeta) y dispositivos.js
// (uso continuado desde otra zona).
//
// Orden e idempotencia (reintentos del webhook):
//   1. Se "reserva" la corrección en suscripciones con un PATCH condicional
//      (zona_correccion_sub distinto de esta suscripción): si otro reintento
//      ya la reservó, no se hace nada.
//   2. Stripe: mismo plan con el precio de la zona nueva,
//      proration_behavior=none, con Idempotency-Key. Si falla, se suelta la
//      reserva y se lanza (Stripe reintenta el evento).
//   3. Email. Si falla, se lanza: en el reintento, la suscripción ya está
//      corregida y sin zona_aviso_enviado_en, así que solo se reintenta el
//      email (nunca se cambia sin avisar ni se avisa dos veces).

import CONFIG_PRECIOS from "./precios-zonas.json";
import STRIPE_IDS from "./stripe-ids.json";
import { zonaPorId, precioParaZona, datosDePrecio } from "./precios.js";
import { enviarEmail } from "./email.js";
import { uuidValido } from "./invitaciones.js";
import {
  paisDeTarjeta, zonaDePaisId, planDePrecio, decidirCorreccion, estadoCorreccion, paramsCambioZona,
  emailCambioZona, yaCorregida, apuntarPaisUso, zonaPorUso,
} from "./pais-tarjeta.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

function form(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) p.append(k, String(v));
  return p.toString();
}

async function stripe(clave, metodo, ruta, params, idempotencia) {
  const r = await fetch(`https://api.stripe.com/v1${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${clave}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencia ? { "Idempotency-Key": idempotencia } : {}),
    },
    body: params ? form(params) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Stripe ${metodo} ${ruta.split("?")[0]} HTTP ${r.status}: ${j?.error?.message || "?"}`);
  return j;
}

// Id del precio por lookup_key (como cambiar-plan.js): primero los ids
// guardados por precios-stripe.yml, si no, se busca en Stripe. Nunca a mano.
async function idDePrecio(clave, lookupKey) {
  const modo = /^(sk|rk)_live_/.test(clave) ? "live" : "test";
  const guardado = STRIPE_IDS?.[modo]?.precios?.[lookupKey];
  if (guardado) return guardado;
  const j = await stripe(clave, "GET", `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
  return j.data?.[0]?.id || null;
}

// Suscripción con la tarjeta por defecto (la suya o la del cliente) expandida:
// de ahí sale card.country sin ningún producto de pago de Stripe.
export async function suscripcionConTarjeta(clave, subId) {
  return stripe(clave, "GET", `/subscriptions/${encodeURIComponent(subId)}?expand[]=default_payment_method&expand[]=customer.invoice_settings.default_payment_method`);
}

function cab(serviceRoleKey, extra = {}) {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", ...extra };
}

export async function leerFila(serviceRoleKey, userId) {
  if (!uuidValido(userId)) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/suscripciones?select=*&user_id=eq.${userId}`, { headers: cab(serviceRoleKey) });
  if (!r.ok) throw new Error(`suscripciones HTTP ${r.status}: ${await r.text()}`);
  return (await r.json())[0] || null;
}

async function patch(serviceRoleKey, filtro, cuerpo, representacion = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/suscripciones?${filtro}`, {
    method: "PATCH",
    headers: cab(serviceRoleKey, { Prefer: representacion ? "return=representation" : "return=minimal" }),
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`suscripciones PATCH HTTP ${r.status}: ${await r.text()}`);
  return representacion ? r.json() : null;
}

// Aplica la decisión para una suscripción de Stripe ya leída.
//   origen: "tarjeta" | "uso"; zonaReal: id de zona; pais: ISO (para el email);
//   para / idioma: destinatario del email.
// Devuelve la decisión (para el log y los tests de integración).
export async function corregirZona({ env, serviceRoleKey, stripeKey, userId, fila, sub, zonaReal, pais, origen, para, idioma, config = CONFIG_PRECIOS }) {
  const item = sub?.items?.data?.[0];
  const precioActual = datosDePrecio(item?.price);
  const plan = planDePrecio(precioActual);
  const md = sub?.metadata || {};

  // Reintento de un email que no salió. Solo si Stripe ya tiene el cambio
  // (metadata.zona_corregida_por): así, si dos eventos del mismo pago llegan
  // a la vez (checkout.session.completed e invoice.paid), el que no hizo la
  // reserva no manda un segundo email mientras el otro aún está cambiando.
  if (yaCorregida(fila, sub?.id) && fila.zona_correccion === "cambiada" && !fila.zona_aviso_enviado_en && md.zona_corregida_por) {
    if (!para) return { accion: "nada", motivo: "sin_email" };
    const precio = precioParaZona(config, fila.zona_corregir_a, precioActual.ambito, plan);
    const envio = await enviarEmail(env, { to: para, ...emailCambioZona({
      idioma: idioma || md.aceptacion_idioma || md.idioma,
      pais: fila.zona_correccion_origen === "tarjeta" ? fila.pais_tarjeta || pais : pais,
      precio, finPeriodo: item?.current_period_end, periodo: precioActual.periodo, origen: fila.zona_correccion_origen || origen,
    }) });
    if (!envio.ok) throw new Error(`aviso de cambio de zona (reintento): ${envio.error}`);
    await patch(serviceRoleKey, `user_id=eq.${userId}`, { zona_aviso_enviado_en: new Date().toISOString() });
    return { accion: "aviso_reenviado" };
  }

  const d = decidirCorreccion({
    config: config, fila, subId: sub?.id,
    zonaCobrada: zonaPorId(config, md.zona) ? md.zona : fila?.zona_precio,
    zonaReal, ambito: precioActual.ambito, plan, moneda: sub?.currency,
    programado: !!sub?.schedule,
    lookupActual: precioActual.lookup_key,
    renueva: ["active", "trialing", "past_due"].includes(sub?.status) && !sub?.cancel_at_period_end && !sub?.cancel_at,
  });
  if (d.accion === "nada") return d;
  if (d.accion === "cambiar" && !env?.RESEND_API_KEY) {
    // Nunca cambiar el precio sin poder avisar antes.
    console.error(`corregir-zona: ${sub.id} pide pasar a ${d.zona} pero no hay RESEND_API_KEY; no se toca`);
    return { accion: "nada", motivo: "sin_email_configurado" };
  }

  // 1. Reserva (una vez por suscripción).
  const reservadas = await patch(serviceRoleKey,
    `user_id=eq.${userId}&or=(zona_correccion_sub.is.null,zona_correccion_sub.neq.${encodeURIComponent(sub.id)})`,
    { zona_corregir_a: d.zona, zona_correccion: estadoCorreccion(d), zona_correccion_origen: origen, zona_correccion_sub: sub.id, zona_aviso_enviado_en: null },
    true);
  if (!reservadas?.length) return { accion: "nada", motivo: "ya_corregida" };

  if (d.accion === "revisar") {
    console.warn(`corregir-zona: ${sub.id} para revisar a mano (${d.motivo}): cobrada ${md.zona || fila?.zona_precio}, real ${d.zona} (${origen})`);
    return d;
  }

  // 2. Stripe, desde la próxima factura.
  try {
    const priceId = await idDePrecio(stripeKey, d.precio.lookup_key);
    if (!priceId) throw new Error(`no existe en Stripe el precio ${d.precio.lookup_key}`);
    await stripe(stripeKey, "POST", `/subscriptions/${encodeURIComponent(sub.id)}`, paramsCambioZona({
      itemId: item.id, priceId, zona: d.zona, lookupKey: d.precio.lookup_key, origen,
      regionContenido: precioActual.ambito === "mundial" ? "todas" : zonaPorId(config, d.zona)?.region_contenido,
    }), `cv-zona-${sub.id}-${d.zona}`);
  } catch (e) {
    await patch(serviceRoleKey, `user_id=eq.${userId}&zona_correccion_sub=eq.${encodeURIComponent(sub.id)}`,
      { zona_corregir_a: null, zona_correccion: null, zona_correccion_origen: null, zona_correccion_sub: null }).catch(() => {});
    throw e;
  }

  // 3. Email (antes de que se aplique: la próxima factura).
  if (!para) {
    console.error(`corregir-zona: ${sub.id} cambiada a ${d.zona} sin email al que avisar`);
    return d;
  }
  const envio = await enviarEmail(env, { to: para, ...emailCambioZona({ idioma: idioma || md.aceptacion_idioma || md.idioma, pais, precio: d.precio, finPeriodo: item?.current_period_end, periodo: precioActual.periodo, origen }) });
  if (!envio.ok) throw new Error(`aviso de cambio de zona: ${envio.error}`);
  await patch(serviceRoleKey, `user_id=eq.${userId}`, { zona_aviso_enviado_en: new Date().toISOString() });
  console.log(`corregir-zona: ${sub.id} pasa a la zona ${d.zona} desde la próxima factura (${origen})`);
  return d;
}

// Tras un pago con tarjeta (webhook). Lee la tarjeta, guarda pais_tarjeta y
// zona_tarjeta y corrige si hace falta. Sin la migración aplicada (la fila no
// tiene pais_tarjeta) no hace nada.
export async function zonaTrasPagoConTarjeta({ env, serviceRoleKey, userId, subId, para, idioma, config = CONFIG_PRECIOS }) {
  const stripeKey = env?.STRIPE_SECRET_KEY;
  if (!stripeKey || !subId || !uuidValido(userId)) return { accion: "nada", motivo: "sin_datos" };
  const fila = await leerFila(serviceRoleKey, userId);
  if (!fila || !("pais_tarjeta" in fila)) return { accion: "nada", motivo: "sin_migracion" };
  if (fila.metodo_pago === "bizum") return { accion: "nada", motivo: "bizum" };
  const sub = await suscripcionConTarjeta(stripeKey, subId);
  const pais = paisDeTarjeta(sub);
  if (!pais) return { accion: "nada", motivo: "sin_pais" };
  const zona = zonaDePaisId(config, pais);
  if (fila.pais_tarjeta !== pais || fila.zona_tarjeta !== zona) {
    await patch(serviceRoleKey, `user_id=eq.${userId}`, { pais_tarjeta: pais, zona_tarjeta: zona });
  }
  return corregirZona({ env, serviceRoleKey, stripeKey, userId, fila, sub, zonaReal: zona, pais, origen: "tarjeta", para, idioma, config });
}

// Al abrir la app (dispositivos.js, después de responder): apunta el país de
// la conexión de hoy (solo el código de 2 letras, nunca la IP) en
// suscripciones.paises_uso, y solo para suscripciones de tarjeta vivas. Si
// se cumple el umbral de uso desde otra zona, corrige igual que con la
// tarjeta. Sin la migración aplicada, nada.
export async function apuntarUsoYCorregir({ env, serviceRoleKey, userId, pais, para, idioma, ahora = Date.now(), config = CONFIG_PRECIOS }) {
  const fila = await leerFila(serviceRoleKey, userId);
  if (!fila || !("paises_uso" in fila)) return { accion: "nada", motivo: "sin_migracion" };
  if (!fila.stripe_subscription_id || fila.metodo_pago === "bizum" || !["active", "trialing", "past_due"].includes(fila.estado)) {
    return { accion: "nada", motivo: "sin_suscripcion_tarjeta" };
  }
  const nuevo = apuntarPaisUso(fila.paises_uso, pais, ahora);
  if (nuevo) await patch(serviceRoleKey, `user_id=eq.${userId}`, { paises_uso: nuevo });
  const uso = zonaPorUso(config, nuevo || fila.paises_uso, fila.zona_precio, ahora);
  if (!uso) return { accion: "nada", motivo: "sin_uso_otra_zona" };
  // Primero con los datos de la fila (sin llamar a Stripe en cada apertura).
  const previa = decidirCorreccion({
    config: config, fila, subId: fila.stripe_subscription_id, zonaCobrada: fila.zona_precio,
    zonaReal: uso.zona, ambito: fila.ambito, plan: planDePrecio(fila), moneda: fila.moneda,
  });
  const avisoPendiente = yaCorregida(fila, fila.stripe_subscription_id) && fila.zona_correccion === "cambiada" && !fila.zona_aviso_enviado_en;
  if (previa.accion === "nada" && !avisoPendiente) return previa;
  const stripeKey = env?.STRIPE_SECRET_KEY;
  if (!stripeKey) return { accion: "nada", motivo: "sin_stripe" };
  const sub = await suscripcionConTarjeta(stripeKey, fila.stripe_subscription_id);
  return corregirZona({ env, serviceRoleKey, stripeKey, userId, fila, sub, zonaReal: uso.zona, pais: uso.pais, origen: "uso", para, idioma, config });
}
