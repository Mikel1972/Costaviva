// assets/js/invitacion.js
// Lado cliente del canje de invitaciones (login.html). La validación de
// verdad está en functions/canjear-invitacion.js; esto solo lee el código de
// la URL, lo recuerda mientras la persona confirma su email (puede abrir el
// enlace de confirmación en otra pestaña) y traduce la respuesta a un mensaje.
// Mismo formato de código que functions/_lib/invitaciones.js (lo comprueba
// test/invitaciones.test.js).

const CLAVE = "costaviva_invitacion";

import { I18n } from "./i18n-modulo.js";

export function normalizarCodigo(texto) {
  const limpio = String(texto ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{12}$/.test(limpio) ? limpio : null;
}

export function formatearCodigo(codigo) {
  return String(codigo).match(/.{1,4}/g).join("-");
}

// localStorage puede no existir o lanzar (modo privado): nunca rompe el alta.
export function guardarCodigo(codigo) {
  try { localStorage.setItem(CLAVE, codigo); } catch { /* sin almacenamiento */ }
}
export function leerCodigoGuardado() {
  try { return normalizarCodigo(localStorage.getItem(CLAVE)); } catch { return null; }
}
export function olvidarCodigo() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

// Mensaje para cada `codigo` de /canjear-invitacion. `null` = no hay nada
// que decir (éxito, que se cuenta aparte).
export function mensajeCanje(codigo) {
  if (codigo === "ok" || codigo === "ya_canjeada") return null;
  const CONOCIDOS = ["no_existe", "otro_email", "usada", "caducada", "anulada", "email_sin_confirmar", "sin_sesion"];
  return I18n.t(CONOCIDOS.includes(codigo) ? `inv.${codigo}` : "inv.generico");
}

// Errores definitivos: no tiene sentido volver a intentarlo con ese código.
export function esDefinitivo(codigo) {
  return ["ok", "ya_canjeada", "no_existe", "otro_email", "usada", "caducada", "anulada"].includes(codigo);
}

export function mensajeExito(r) {
  if (r.descuento === 100) {
    return r.acceso_hasta
      ? I18n.t("inv.exito_hasta", { fecha: new Date(new Date(r.acceso_hasta).getTime() - 1).toLocaleDateString(I18n.locale(), { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }) })
      : I18n.t("inv.exito_siempre");
  }
  if (r.descuento > 0) return I18n.t("inv.exito_descuento", { pct: r.descuento });
  return I18n.t("inv.exito");
}

export async function canjear(token, codigo, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl("/canjear-invitacion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ codigo }),
    });
    const r = await resp.json().catch(() => ({}));
    return { ok: !!r.ok, codigo: r.codigo || "fallo", descuento: r.descuento, acceso_hasta: r.acceso_hasta };
  } catch {
    return { ok: false, codigo: "fallo" };
  }
}
