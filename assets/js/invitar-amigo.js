// assets/js/invitar-amigo.js
// "Invita a un amigo" (2026-10-09): enlace para compartir y textos de la
// tarjeta de suscripcion.html. Lógica pura (test/captacion.test.js). Las
// reglas de verdad (quién cuenta, topes, misma tarjeta) están en Postgres,
// migración 20261009110000_invita_a_un_amigo.sql.

export function enlaceAmigo(codigo, base = "https://costaviva.org") {
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(String(codigo || ""))) return null;
  return `${base}/empieza?ref=${codigo}&utm_source=referido&utm_medium=referido&utm_campaign=amigo`;
}

export function mensajeParaCompartir(enlace) {
  return `Mira Costaviva: índice de pesca, ola, viento y marea de tu spot hora a hora. Pruébala 7 días gratis con mi enlace: ${enlace}`;
}

export function enlaceWhatsapp(enlace) {
  return `https://wa.me/?text=${encodeURIComponent(mensajeParaCompartir(enlace))}`;
}

export function textoResumen(d) {
  if (!d || !d.activo) return "";
  const partes = [];
  partes.push(d.apuntados === 1 ? "1 amigo se ha apuntado con tu enlace" : `${d.apuntados || 0} amigos se han apuntado con tu enlace`);
  if (d.meses_ganados) partes.push(d.meses_ganados === 1 ? "has ganado 1 mes gratis" : `has ganado ${d.meses_ganados} meses gratis`);
  if (d.meses_pendientes) partes.push(d.meses_pendientes === 1 ? "tienes 1 mes esperando a que te suscribas" : `tienes ${d.meses_pendientes} meses esperando a que te suscribas`);
  return partes.join(" · ") + ".";
}

export const REGLAS = [
  "Por cada amigo que se apunte con tu enlace y pague su suscripción tras la prueba, ganas 1 mes gratis.",
  "Si ya estás suscrito, se descuenta de tu próximo cobro (3,99 €). Si aún no, se suma a tu prueba cuando te suscribas (hasta 3 meses).",
  "Cada amigo cuenta una sola vez, no vale invitarse a uno mismo ni pagar con la misma tarjeta, y hay un máximo de 12 meses al año.",
];
