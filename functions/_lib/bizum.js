// functions/_lib/bizum.js
// "Pagar 1 año con Bizum" (2026-11-25, aprobado por Mikel). Lógica pura, sin
// red: la usan crear-checkout-bizum.js, stripe-webhook.js,
// avisar-renovacion-bizum.js, precios-zona.js y test/bizum.test.js.
//
// Bizum en Stripe solo admite pagos únicos (sin suscripciones, sin
// setup_future_usage), solo EUR, entre 0,50 y 5.000 €, y solo clientes de
// España. Por eso "anual con Bizum" = un pago único que da 12 meses de
// Premium, más un email de aviso antes de que acabe (no se renueva solo).
// Detalle en CLAUDE.md, "Pagar 1 año con Bizum".

import { zonaDePais, precioParaZona, AMBITOS } from "./precios.js";

// Zona de precios en la que se ofrece (la UE/EEE, en EUR).
export const ZONA_BIZUM = "ue_eee";
// País en el que se enseña el botón (Bizum es un sistema español).
export const PAIS_BIZUM = "ES";
// Límites de Stripe para Bizum, en céntimos.
export const MIN_CENT = 50;
export const MAX_CENT = 500000;
export const MESES = 12;
const DIA_MS = 24 * 60 * 60 * 1000;

// Interruptor BIZUM_ACTIVO (variable de Cloudflare Pages): solo el texto
// "true" lo enciende. Por defecto, apagado.
export function bizumActivo(env) {
  return env?.BIZUM_ACTIVO === "true";
}

// ¿Se enseña el botón? Interruptor encendido, cobro abierto y conexión
// desde España (el servidor exige además la zona en EUR).
export function bizumDisponible(env, pais, cobroAbierto) {
  return bizumActivo(env) && cobroAbierto === true && String(pais || "").toUpperCase() === PAIS_BIZUM;
}

// Importe del año con Bizum: EXACTAMENTE el anual de la zona (nunca otro
// número). Devuelve { lookup_key, moneda, importe } o { error }.
//   - solo el plan "anual" (el fundador va ligado a seguir suscrito con
//     tarjeta; el mensual no tiene sentido como pago único de un año);
//   - solo la zona UE/EEE en EUR;
//   - dentro de los límites de Stripe.
export function precioBizum(config, pais, ambito, plan) {
  if (plan !== "anual") return { error: "bizum_solo_anual" };
  if (!AMBITOS.includes(ambito)) return { error: "plan_invalido" };
  const zona = zonaDePais(config, pais);
  if (!zona || zona.id !== ZONA_BIZUM || zona.moneda !== "EUR") return { error: "bizum_solo_espana" };
  const p = precioParaZona(config, zona.id, ambito, "anual");
  if (p.moneda !== "EUR" || !(p.importe >= MIN_CENT && p.importe <= MAX_CENT)) return { error: "bizum_importe" };
  return { ...p, zona: zona.id, region_contenido: ambito === "mundial" ? "todas" : zona.region_contenido };
}

// Suma meses en UTC sin desbordar: 29/02 + 12 meses = 28/02 (no 01/03).
export function sumarMeses(fecha, meses) {
  const d = new Date(fecha);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

// Nuevo fin del periodo tras pagar un año: desde hoy o, si aún le queda
// Premium pagado, desde ese fin (renovar antes alarga, no se pierde nada).
// Solo cuenta un fin anterior si era de Bizum: un fin de tarjeta lo cobra
// (o lo devuelve) Stripe por su cuenta.
export function nuevoFinBizum(filaActual, ahora = Date.now()) {
  const finActual = filaActual?.metodo_pago === "bizum" && filaActual?.periodo_actual_fin
    ? Date.parse(filaActual.periodo_actual_fin)
    : NaN;
  const desde = Number.isFinite(finActual) && finActual > ahora ? finActual : ahora;
  return sumarMeses(desde, MESES);
}

// ¿Tiene una suscripción de tarjeta en marcha? Entonces no se cobra Bizum
// (sería pagar dos veces el mismo periodo).
export function tieneSuscripcionTarjeta(fila) {
  if (!fila) return false;
  if (fila.metodo_pago === "bizum") return false;
  return !!fila.stripe_subscription_id && ["trialing", "active", "past_due", "unpaid"].includes(fila.estado);
}

// ¿Es un pago de Bizum ya cobrado? (checkout.session.completed con
// payment_status "paid", o checkout.session.async_payment_succeeded).
export function esPagoBizum(evento) {
  const s = evento?.data?.object || {};
  if (s.mode !== "payment" || s.metadata?.metodo !== "bizum") return false;
  if (evento.type === "checkout.session.async_payment_succeeded") return true;
  return evento.type === "checkout.session.completed" && s.payment_status === "paid";
}

// Fila de public.suscripciones para un pago de Bizum, o null si ese pago ya
// se aplicó (idempotencia: Stripe reintenta los eventos).
export function filaPagoBizum(sesion, filaActual, ahora = Date.now()) {
  if (filaActual?.bizum_sesion_id && filaActual.bizum_sesion_id === sesion.id) return null;
  const md = sesion.metadata || {};
  const ambito = md.ambito === "mundial" ? "mundial" : "regional";
  const fila = {
    user_id: sesion.client_reference_id || md.supabase_user_id,
    estado: "active",
    periodo: "anual",
    ambito,
    region_contenido: ambito === "mundial" ? null : (/^[a-z]{2,12}$/.test(md.region_contenido || "") && md.region_contenido !== "todas" ? md.region_contenido : "es"),
    zona_precio: md.zona || ZONA_BIZUM,
    moneda: String(sesion.currency || "eur").toUpperCase(),
    fundador: false,
    precio_lookup_key: md.lookup_key || null,
    stripe_subscription_id: null,
    metodo_pago: "bizum",
    bizum_sesion_id: sesion.id,
    periodo_actual_fin: nuevoFinBizum(filaActual, ahora).toISOString(),
    actualizado_en: new Date(ahora).toISOString(),
  };
  if (sesion.customer) fila.stripe_customer_id = sesion.customer;
  const pais = sesion.customer_details?.address?.country;
  if (pais) fila.pais_facturacion = pais;
  return fila;
}

// Qué aviso de renovación toca hoy a una fila (o null):
//   "7_dias"     — le quedan 7 días o menos (y más de 1), una vez por periodo;
//   "ultimo_dia" — le queda 1 día o menos (y aún no ha acabado), una vez.
// Un periodo se identifica por su periodo_actual_fin: renovar lo cambia y los
// avisos vuelven a tocar solos.
export function avisoQueToca(fila, ahora = Date.now()) {
  if (!fila || fila.metodo_pago !== "bizum" || fila.estado !== "active") return null;
  const fin = Date.parse(fila.periodo_actual_fin);
  if (!Number.isFinite(fin)) return null;
  const queda = fin - ahora;
  if (queda <= 0) return null;
  const mismoFin = (v) => !!v && Date.parse(v) === fin;
  if (queda <= DIA_MS) return mismoFin(fila.renovacion_ultimo_dia_fin) ? null : "ultimo_dia";
  if (queda <= 7 * DIA_MS) return mismoFin(fila.renovacion_avisada_fin) ? null : "7_dias";
  return null;
}

// Columna en la que se apunta cada aviso.
export function columnaAviso(tipo) {
  return tipo === "ultimo_dia" ? "renovacion_ultimo_dia_fin" : "renovacion_avisada_fin";
}

// Idioma del email: el de la app (user_metadata.idioma), es/en/pt.
export function idiomaAviso(metadata) {
  const i = metadata?.idioma;
  return i === "en" || i === "pt" ? i : "es";
}

const LOCALE = { es: "es-ES", en: "en-NZ", pt: "pt-PT" };
function fechaLarga(iso, idioma) {
  return new Date(iso).toLocaleDateString(LOCALE[idioma], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }); // a propósito (ZONA_NEGOCIO)
}

const ENLACE = "https://costaviva.org/suscripcion";

// Email de aviso: fecha clara, enlace para renovar y nada de urgencia
// fabricada (mismo tono que avisar-fin-prueba.js).
export function emailAvisoBizum(tipo, finIso, idioma = "es") {
  const fecha = fechaLarga(finIso, idioma);
  const T = {
    es: {
      asunto7: `Tu año de Costaviva Premium termina el ${fecha}`,
      asunto1: `Tu año de Costaviva Premium termina mañana`,
      intro7: `Tu año de Premium pagado con Bizum termina el ${fecha}.`,
      intro1: `Tu año de Premium pagado con Bizum termina mañana, ${fecha}.`,
      cta: `Para seguir con Premium otro año, renuévalo con Bizum en un momento:`,
      extra: `Si renuevas antes, el año nuevo empieza cuando acabe el actual: no pierdes ningún día. El pago con Bizum no se renueva solo, así que no se te cobrará nada sin que lo decidas tú.`,
      despues: `Si no renuevas, pasas al plan gratuito y tus datos se quedan guardados.`,
      gracias: `¡Gracias por pescar con nosotros!`,
    },
    en: {
      asunto7: `Your Costaviva Premium year ends on ${fecha}`,
      asunto1: `Your Costaviva Premium year ends tomorrow`,
      intro7: `Your year of Premium paid with Bizum ends on ${fecha}.`,
      intro1: `Your year of Premium paid with Bizum ends tomorrow, ${fecha}.`,
      cta: `To keep Premium for another year, renew it with Bizum in a moment:`,
      extra: `If you renew early, the new year starts when the current one ends: you don't lose a single day. Bizum payments don't renew automatically, so nothing is charged unless you choose to.`,
      despues: `If you don't renew, you move to the free plan and your data stays saved.`,
      gracias: `Thanks for fishing with us!`,
    },
    pt: {
      asunto7: `O teu ano de Costaviva Premium termina a ${fecha}`,
      asunto1: `O teu ano de Costaviva Premium termina amanhã`,
      intro7: `O teu ano de Premium pago com Bizum termina a ${fecha}.`,
      intro1: `O teu ano de Premium pago com Bizum termina amanhã, ${fecha}.`,
      cta: `Para continuares com o Premium mais um ano, renova-o com Bizum num instante:`,
      extra: `Se renovares antes, o novo ano começa quando acabar o atual: não perdes nenhum dia. O pagamento com Bizum não se renova sozinho, por isso nada é cobrado sem que tu decidas.`,
      despues: `Se não renovares, passas para o plano gratuito e os teus dados ficam guardados.`,
      gracias: `Obrigado por pescares connosco!`,
    },
  }[LOCALE[idioma] ? idioma : "es"];
  const hola = { es: "Hola,", en: "Hi,", pt: "Olá," }[LOCALE[idioma] ? idioma : "es"];
  return {
    asunto: tipo === "ultimo_dia" ? T.asunto1 : T.asunto7,
    cuerpo: [
      hola, "",
      tipo === "ultimo_dia" ? T.intro1 : T.intro7, "",
      T.cta, ENLACE, "",
      T.extra, "",
      T.despues, "",
      T.gracias, "",
      "— Costaviva",
    ].join("\n"),
  };
}
