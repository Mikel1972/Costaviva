// functions/_lib/black-friday.js — Black Friday 2x1 (2026-11-19, Mikel).
// Lógica pura, sin red: la usan crear-checkout-stripe.js, stripe-webhook.js
// y regalo-black-friday.js, y la prueba test/black-friday.test.js.
//
// Reglas de Mikel:
//   - Código BLACKFRIDAY, SOLO del viernes 27/11/2026 00:00 al lunes
//     30/11/2026 23:59:59, hora de España. Fuera de esas fechas el servidor
//     lo rechaza.
//   - Solo con el plan anual (34,99 €). Quien lo paga con el código regala
//     un año de Premium a un amigo (una invitación al 100 % de 12 meses, el
//     mismo sistema que las invitaciones del admin).
//   - El amigo puede darse de alta y canjearlo hasta el 31/12/2026; su año
//     empieza a contar el día que lo canjea.
import { finDelDiaMadrid } from "./invitaciones.js";

export const CODIGO_BF = "BLACKFRIDAY";
export const MARCA_BF = "black-friday-2026";
// 00:00 del 27/11 en Madrid = fin del día 26/11.
export const BF_DESDE = finDelDiaMadrid("2026-11-26");
export const BF_HASTA = finDelDiaMadrid("2026-11-30"); // exclusivo: 01/12 00:00
export const REGALO_HASTA = finDelDiaMadrid("2026-12-31"); // exclusivo: 01/01/2027 00:00

export function normalizarCodigoBf(texto) {
  return String(texto ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
}
export function enVentanaBf(ahora = new Date()) {
  return ahora >= BF_DESDE && ahora < BF_HASTA;
}
// null si vale; si no, el motivo ("no_existe" | "fuera_de_plazo" | "solo_anual").
export function motivoCodigoBf(texto, plan, ahora = new Date()) {
  if (normalizarCodigoBf(texto) !== CODIGO_BF) return "no_existe";
  if (!enVentanaBf(ahora)) return "fuera_de_plazo";
  if (plan !== "anual") return "solo_anual";
  return null;
}
// ¿Esta suscripción da derecho a regalar? (fila de public.suscripciones)
export function puedeRegalar(sub, ahora = new Date()) {
  if (!sub || sub.codigo_promocional !== CODIGO_BF) return false;
  if (sub.periodo !== "anual") return false;
  if (!["active", "trialing"].includes(sub.estado)) return false;
  return ahora < REGALO_HASTA;
}
// Datos de la invitación de regalo (descuento 100 %, 12 meses, caduca el 31/12).
export function invitacionRegalo(email) {
  return {
    email, descuento: 100, duracion_tipo: "meses", duracion_meses: 12, duracion_hasta: null,
    // 31/12 a las 23:59:59 (así el email dice "hasta el 31 de diciembre").
    caduca_en: new Date(REGALO_HASTA.getTime() - 1000).toISOString(), nota: MARCA_BF,
  };
}
