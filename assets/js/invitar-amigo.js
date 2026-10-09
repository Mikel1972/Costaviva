// assets/js/invitar-amigo.js
// "Invita a un amigo" (2026-10-09): enlace para compartir y textos de la
// tarjeta de suscripcion.html. Lógica pura (test/captacion.test.js). Las
// reglas de verdad (quién cuenta, topes, misma tarjeta) están en Postgres,
// migración 20261009110000_invita_a_un_amigo.sql.

import { I18n } from "./i18n-modulo.js";

export function enlaceAmigo(codigo, base = "https://costaviva.org") {
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(String(codigo || ""))) return null;
  return `${base}/empieza?ref=${codigo}&utm_source=referido&utm_medium=referido&utm_campaign=amigo`;
}

export function mensajeParaCompartir(enlace) {
  return I18n.t("amigo.mensaje", { enlace });
}

export function enlaceWhatsapp(enlace) {
  return `https://wa.me/?text=${encodeURIComponent(mensajeParaCompartir(enlace))}`;
}

export function textoResumen(d) {
  if (!d || !d.activo) return "";
  const partes = [];
  partes.push(I18n.t("amigo.apuntados", { n: d.apuntados || 0 }));
  if (d.meses_ganados) partes.push(I18n.t("amigo.ganados", { n: d.meses_ganados }));
  if (d.meses_pendientes) partes.push(I18n.t("amigo.pendientes", { n: d.meses_pendientes }));
  return partes.join(" · ") + ".";
}

export const REGLAS = [
  I18n.t("amigo.regla1"),
  I18n.t("amigo.regla2"),
  I18n.t("amigo.regla3"),
];
