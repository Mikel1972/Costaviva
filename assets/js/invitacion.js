// assets/js/invitacion.js
// Lado cliente del canje de invitaciones (login.html). La validación de
// verdad está en functions/canjear-invitacion.js; esto solo lee el código de
// la URL, lo recuerda mientras la persona confirma su email (puede abrir el
// enlace de confirmación en otra pestaña) y traduce la respuesta a un mensaje.
// Mismo formato de código que functions/_lib/invitaciones.js (lo comprueba
// test/invitaciones.test.js).

const CLAVE = "costaviva_invitacion";

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
  return {
    ok: null,
    ya_canjeada: null,
    no_existe: "Ese código de invitación no existe. Revisa que esté bien copiado.",
    otro_email: "Ese código de invitación es para otro email. Entra con el email en el que recibiste la invitación.",
    usada: "Ese código de invitación ya se ha usado.",
    caducada: "Esa invitación ha caducado. Pide una nueva a quien te invitó.",
    anulada: "Esa invitación ya no es válida (se ha anulado).",
    email_sin_confirmar: "Confirma primero tu email con el enlace que te hemos enviado.",
    sin_sesion: "Entra en tu cuenta para usar la invitación.",
  }[codigo] ?? "No hemos podido aplicar la invitación ahora mismo. Vuelve a intentarlo en unos minutos.";
}

// Errores definitivos: no tiene sentido volver a intentarlo con ese código.
export function esDefinitivo(codigo) {
  return ["ok", "ya_canjeada", "no_existe", "otro_email", "usada", "caducada", "anulada"].includes(codigo);
}

export function mensajeExito(r) {
  if (r.descuento === 100) {
    return r.acceso_hasta
      // Hora de Madrid a propósito (ZONA_NEGOCIO): las invitaciones caducan a las 00:00 de Madrid (invitaciones.js).
      ? `Invitación aplicada: tienes Costaviva gratis hasta el ${new Date(new Date(r.acceso_hasta).getTime() - 1).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" })}.`
      : "Invitación aplicada: tienes Costaviva gratis para siempre.";
  }
  if (r.descuento > 0) return `Invitación aplicada: tu ${r.descuento} % de descuento se aplicará al suscribirte.`;
  return "Invitación aplicada.";
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
