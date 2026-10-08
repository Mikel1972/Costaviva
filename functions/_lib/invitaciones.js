// functions/_lib/invitaciones.js
// Lógica pura de las invitaciones con descuento (admin.html → "Invitar / dar
// descuento", aprobado por Mikel el 2026-10-08). Sin red ni secretos: lo usan
// functions/admin-invitaciones.js, canjear-invitacion.js, stripe-webhook.js,
// crear-checkout-stripe.js y avisar-fin-prueba.js, y lo prueba
// test/invitaciones.test.js. Tabla: supabase/migrations/20261008170000_invitaciones.sql.

import { esc } from "./email.js";

export const URL_APP = "https://costaviva.org";
export const QUIEN_INVITA = "Mikel";
export const DURACIONES_MESES = [1, 3, 6, 12];
export const CADUCIDAD_POR_DEFECTO_DIAS = 30;
export const AVISO_FIN_DIAS_ANTES = 7;

// Sin I, O, 0 ni 1 (se confunden al copiarlo a mano). 32 símbolos x 12 = 60 bits.
export const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LARGO_CODIGO = 12;

export function generarCodigo(aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = aleatorio(LARGO_CODIGO);
  let codigo = "";
  // 256 es múltiplo de 32: el módulo no sesga.
  for (let i = 0; i < LARGO_CODIGO; i++) codigo += ALFABETO_CODIGO[bytes[i] % 32];
  return codigo;
}

// Acepta lo que pegue la persona: minúsculas, espacios y guiones.
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? "").toUpperCase().replace(/[\s-]/g, "");
  return codigoValido(limpio) ? limpio : null;
}

export function codigoValido(codigo) {
  return typeof codigo === "string" && /^[A-HJ-NP-Z2-9]{12}$/.test(codigo);
}

// XXXX-XXXX-XXXX, solo para enseñarlo.
export function formatearCodigo(codigo) {
  return String(codigo).match(/.{1,4}/g).join("-");
}

export function normalizarEmail(texto) {
  const e = String(texto ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidValido(id) {
  return typeof id === "string" && UUID.test(id);
}

// ---------------------------------------------------------------------------
// Fechas. Todo se cuenta desde un instante (el canje para el 100 %, el pago
// para < 100 %). "Hasta una fecha" termina al acabar ese día en España.
// ---------------------------------------------------------------------------

function desfaseMadridMs(instante) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(instante).map((p) => [p.type, p.value])
  );
  const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

// 00:00 hora de Madrid del día siguiente a "AAAA-MM-DD".
export function finDelDiaMadrid(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const ingenuo = Date.UTC(a, m - 1, d + 1);
  // Dos pasadas por si el cambio de hora cae justo en medio.
  let t = ingenuo - desfaseMadridMs(new Date(ingenuo));
  t = ingenuo - desfaseMadridMs(new Date(t));
  return new Date(t);
}

// Suma meses como Postgres (timestamptz + interval 'N months'): si el día no
// existe en el mes de destino, el último día de ese mes.
export function sumarMeses(fecha, meses) {
  const d = new Date(fecha.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

// Fin del beneficio contado desde `desde`. null = para siempre.
export function calcularFin(inv, desde) {
  if (inv.duracion_tipo === "siempre") return null;
  if (inv.duracion_tipo === "meses") return sumarMeses(desde, inv.duracion_meses);
  if (inv.duracion_tipo === "hasta_fecha") return finDelDiaMadrid(inv.duracion_hasta);
  throw new Error(`duración desconocida: ${inv.duracion_tipo}`);
}

// Meses de cupón de Stripe para "hasta una fecha": los meses (redondeando
// hacia arriba) entre hoy y esa fecha, mínimo 1. Stripe cuenta los meses
// desde que se aplica el cupón, así que es una aproximación por exceso.
export function mesesHasta(fechaISO, desde) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  let meses = (a - desde.getUTCFullYear()) * 12 + (m - 1 - desde.getUTCMonth());
  if (d > desde.getUTCDate()) meses += 1;
  return Math.max(1, meses);
}

export function mesesDeDescuento(inv, desde) {
  if (inv.duracion_tipo === "siempre") return null;
  if (inv.duracion_tipo === "meses") return inv.duracion_meses;
  return mesesHasta(inv.duracion_hasta, desde);
}

// ---------------------------------------------------------------------------
// Entrada del modal de admin.html. Nunca se confía en el cliente: todo se
// valida aquí y lo que sale es lo único que se guarda.
// ---------------------------------------------------------------------------

export function validarNuevaInvitacion(cuerpo, ahora = new Date()) {
  const errores = [];
  const email = normalizarEmail(cuerpo?.email);
  if (!email) errores.push("El email no es válido.");

  const descuento = Number(cuerpo?.descuento);
  if (!Number.isInteger(descuento) || descuento < 0 || descuento > 100) {
    errores.push("El descuento tiene que ser un número entero entre 0 y 100.");
  }

  const tipo = cuerpo?.duracion_tipo;
  let duracion_meses = null;
  let duracion_hasta = null;
  if (tipo === "meses") {
    duracion_meses = Number(cuerpo?.duracion_meses);
    if (!DURACIONES_MESES.includes(duracion_meses)) errores.push("La duración tiene que ser 1, 3, 6 o 12 meses.");
  } else if (tipo === "hasta_fecha") {
    duracion_hasta = String(cuerpo?.duracion_hasta ?? "");
    const hoy = ahora.toISOString().slice(0, 10);
    const limite = new Date(ahora.getTime() + 5 * 366 * 864e5).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(duracion_hasta) || Number.isNaN(Date.parse(duracion_hasta))) {
      errores.push("La fecha de fin no es válida.");
    } else if (duracion_hasta <= hoy) {
      errores.push("La fecha de fin tiene que ser posterior a hoy.");
    } else if (duracion_hasta > limite) {
      errores.push("La fecha de fin está a más de 5 años: revisa el año.");
    }
  } else if (tipo !== "siempre") {
    errores.push("Elige la duración del descuento.");
  }

  const dias = cuerpo?.caducidad_dias === undefined || cuerpo?.caducidad_dias === ""
    ? CADUCIDAD_POR_DEFECTO_DIAS
    : Number(cuerpo.caducidad_dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) errores.push("La caducidad tiene que estar entre 1 y 365 días.");

  const nota = String(cuerpo?.nota ?? "").trim().slice(0, 500) || null;

  if (errores.length) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      email,
      descuento,
      duracion_tipo: tipo,
      duracion_meses,
      duracion_hasta,
      caduca_en: new Date(ahora.getTime() + dias * 864e5).toISOString(),
      nota,
    },
  };
}

// ---------------------------------------------------------------------------
// Estado: se deduce de las fechas, no se guarda (no puede desfasarse).
//   anulada   la anuló el admin (gana a todo)
//   terminada canjeada y su beneficio ya acabó
//   inscrito  canjeada y en vigor
//   caducada  sin canjear y pasada la caducidad
//   enviada   sin canjear y a tiempo
// ---------------------------------------------------------------------------

export function estadoInvitacion(inv, ahora = new Date()) {
  if (inv.anulada_en) return "anulada";
  if (inv.inscrito_en) {
    const fin = inv.descuento === 100 ? inv.acceso_hasta : inv.descuento_hasta;
    if (fin && new Date(fin) <= ahora) return "terminada";
    // < 100 % canjeada pero sin pagar a tiempo: el cupón ya no vale.
    if (inv.descuento < 100 && inv.descuento > 0 && !inv.descuento_aplicado_en && new Date(inv.caduca_en) <= ahora) return "caducada";
    return "inscrito";
  }
  if (new Date(inv.caduca_en) <= ahora) return "caducada";
  return "enviada";
}

// Canje por el invitado (canjear-invitacion.js). Devuelve un código estable
// que el cliente traduce a un mensaje (assets/js/invitacion.js).
export function validarCanje(inv, { userId, email, ahora = new Date() }) {
  if (!inv) return "no_existe";
  if (inv.anulada_en) return "anulada";
  if (inv.user_id) return inv.user_id === userId ? "ya_canjeada" : "usada";
  if (new Date(inv.caduca_en) <= ahora) return "caducada";
  if (String(email || "").toLowerCase() !== inv.email) return "otro_email";
  return "ok";
}

// Campos que se escriben al canjear.
export function camposCanje(inv, { userId, ahora = new Date() }) {
  const fin = inv.descuento === 100 ? calcularFin(inv, ahora) : null;
  return {
    user_id: userId,
    inscrito_en: ahora.toISOString(),
    acceso_hasta: fin ? fin.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Stripe (< 100 %). Un cupón por invitación, de un solo uso y que caduca con
// ella. No se crea código de promoción: nadie tiene que teclear nada en
// Stripe, el servidor aplica el cupón solo tras comprobar que la invitación
// es de quien paga (mi_invitacion_descuento()). Así no hay ningún código que
// se pueda filtrar y usar en otra cuenta desde el campo de Checkout.
// ---------------------------------------------------------------------------

export function necesitaCupon(inv) {
  return inv.descuento > 0 && inv.descuento < 100;
}

export function parametrosCupon(inv, { id, ahora = new Date() }) {
  const p = new URLSearchParams();
  p.append("percent_off", String(inv.descuento));
  const meses = mesesDeDescuento(inv, ahora);
  if (meses === null) {
    p.append("duration", "forever");
  } else {
    p.append("duration", "repeating");
    p.append("duration_in_months", String(meses));
  }
  p.append("max_redemptions", "1");
  p.append("redeem_by", String(Math.floor(new Date(inv.caduca_en).getTime() / 1000)));
  p.append("name", `Invitacion ${inv.descuento}% ${meses === null ? "siempre" : `${meses} mes${meses === 1 ? "" : "es"}`}`.slice(0, 40));
  p.append("metadata[invitacion_id]", id);
  return p;
}

// El plan anual se cobra de una vez: un descuento de "3 meses" en anual
// rebajaría el año entero. Por eso, salvo "para siempre" o 12 meses o más,
// el descuento solo se aplica al plan mensual.
export function descuentoAplicaAPlan(inv, plan, ahora = new Date()) {
  if (plan === "monthly") return true;
  if (plan !== "annual") return false;
  const meses = mesesDeDescuento(inv, ahora);
  return meses === null || meses >= 12;
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export function fechaLarga(valor) {
  return new Date(valor).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid",
  });
}

export function textoDuracion(inv) {
  if (inv.duracion_tipo === "siempre") return "para siempre";
  if (inv.duracion_tipo === "meses") return inv.duracion_meses === 1 ? "durante 1 mes" : `durante ${inv.duracion_meses} meses`;
  return `hasta el ${fechaLarga(finDelDiaMadrid(inv.duracion_hasta).getTime() - 1)}`;
}

export function textoBeneficio(inv) {
  if (inv.descuento === 100) return `Costaviva gratis ${textoDuracion(inv)}, sin tarjeta`;
  if (inv.descuento === 0) return "acceso a Costaviva con 7 días de prueba gratis";
  return `un ${inv.descuento} % de descuento en tu suscripción ${textoDuracion(inv)}`;
}

export function enlaceInvitacion(codigo, base = URL_APP) {
  return `${base}/login?alta=1&invitacion=${encodeURIComponent(codigo)}`;
}

export function emailInvitacion(inv, { base = URL_APP, quienInvita = QUIEN_INVITA, contacto = null } = {}) {
  const enlace = enlaceInvitacion(inv.codigo, base);
  const codigo = formatearCodigo(inv.codigo);
  const beneficio = textoBeneficio(inv);
  const caduca = fechaLarga(inv.caduca_en);
  const pasos = [
    "Pulsa el botón (o abre el enlace) y escribe este mismo email.",
    "Te llegará un enlace para confirmar tu email; ábrelo y crea tu contraseña.",
    inv.descuento === 100
      ? "Listo: entras directamente, sin tarjeta."
      : inv.descuento > 0
        ? "Al suscribirte, el descuento se aplica solo en el pago (sin teclear nada)."
        : "Empieza tu prueba gratis.",
  ];
  const despues = inv.descuento === 100
    ? (inv.duracion_tipo === "siempre" ? "" : "Antes de que termine te avisaremos por email; si no te suscribes, no se te cobra nada.")
    : inv.descuento > 0 && inv.duracion_tipo !== "siempre"
      ? "Después se cobra el precio normal (3,99 €/mes); puedes cancelar cuando quieras."
      : "";
  const contactoTexto = contacto
    ? "Si tienes dudas, responde a este email."
    : "Si tienes dudas, escríbenos desde https://costaviva.org.";
  const pie = `Has recibido este email porque ${quienInvita} te ha invitado a Costaviva. Es un único mensaje: si no te interesa, ignóralo y no te escribiremos más. ${contactoTexto}`;

  const asunto = inv.descuento === 100
    ? `${quienInvita} te invita a Costaviva (gratis)`
    : inv.descuento > 0
      ? `${quienInvita} te invita a Costaviva con un ${inv.descuento} % de descuento`
      : `${quienInvita} te invita a Costaviva`;

  const texto = [
    "Hola,",
    "",
    `${quienInvita} te invita a Costaviva, la app de condiciones del mar y cuaderno de pesca. Tienes ${beneficio}.`,
    "",
    `Tu código: ${codigo} (válido hasta el ${caduca}, de un solo uso y solo para este email)`,
    "",
    "Cómo empezar:",
    ...pasos.map((p, i) => `  ${i + 1}. ${p}`),
    "",
    `Crear mi cuenta: ${enlace}`,
    ...(despues ? ["", despues] : []),
    "",
    "¡Buena pesca!",
    "— Costaviva",
    "",
    pie,
  ].join("\n");

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F7F3E8;font-family:Arial,Helvetica,sans-serif;color:#0B2532;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <p style="font-size:20px;font-weight:bold;margin:0 0 16px;">Costaviva</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 12px;">Hola,</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px;"><strong>${esc(quienInvita)}</strong> te invita a Costaviva, la app de condiciones del mar y cuaderno de pesca. Tienes <strong>${esc(beneficio)}</strong>.</p>
  <div style="background:#FFFFFF;border:1px solid #DDE2DC;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
    <p style="font-size:12px;color:#5C7680;margin:0 0 4px;">Tu código</p>
    <p style="font-family:'Courier New',monospace;font-size:20px;letter-spacing:2px;font-weight:bold;margin:0 0 6px;">${esc(codigo)}</p>
    <p style="font-size:12px;color:#5C7680;margin:0;">Válido hasta el ${esc(caduca)}. De un solo uso y solo para este email.</p>
  </div>
  <p style="text-align:center;margin:0 0 20px;"><a href="${esc(enlace)}" style="display:inline-block;background:#1F6F8B;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">Crear mi cuenta</a></p>
  <p style="font-size:14px;font-weight:bold;margin:0 0 6px;">Cómo empezar</p>
  <ol style="font-size:14px;line-height:1.5;margin:0 0 16px;padding-left:20px;">${pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
  ${despues ? `<p style="font-size:13px;line-height:1.5;color:#42585F;margin:0 0 16px;">${esc(despues)}</p>` : ""}
  <p style="font-size:14px;margin:0 0 24px;">¡Buena pesca!</p>
  <p style="font-size:11.5px;line-height:1.5;color:#5C7680;border-top:1px solid #DDE2DC;padding-top:12px;margin:0;">${esc(pie)}<br>Si el botón no funciona, copia este enlace: ${esc(enlace)}</p>
</div></body></html>`;

  return { asunto, texto, html };
}

// Aviso de fin del acceso gratis (100 %), 7 días antes o, si el cron llega
// tarde, justo después. Mismo tono que avisar-fin-prueba.js: fechas claras,
// el enlace, y nada de urgencia fabricada.
export function emailFinInvitacion({ acceso_hasta }, ahora = new Date(), base = URL_APP) {
  const fecha = fechaLarga(new Date(acceso_hasta).getTime() - 1);
  const yaTermino = new Date(acceso_hasta) <= ahora;
  return {
    asunto: yaTermino ? "Tu acceso gratis a Costaviva ha terminado" : `Tu acceso gratis a Costaviva termina el ${fecha}`,
    texto: [
      "Hola,",
      "",
      yaTermino
        ? `Tu acceso gratis a Costaviva por invitación terminó el ${fecha}.`
        : `Tu acceso gratis a Costaviva por invitación termina el ${fecha}.`,
      "",
      "Si quieres seguir consultando las condiciones del mar y tu cuaderno de pesca, puedes suscribirte:",
      `Planes: ${base}/suscripcion  (3,99 €/mes o 39,99 €/año, se cancela cuando quieras)`,
      "",
      "Tus salidas, capturas y ubicaciones siguen guardadas. Si no te suscribes, no se te cobra nada.",
      "",
      "Gracias por haber probado Costaviva.",
      "— Costaviva",
      base,
    ].join("\n"),
  };
}
