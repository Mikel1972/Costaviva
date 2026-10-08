// functions/admin-invitaciones.js
// Invitaciones con descuento desde admin.html ("Invitar / dar descuento",
// aprobado por Mikel el 2026-10-08). Alcanzable en /admin-invitaciones.
//
//   GET                         lista (con el estado deducido de las fechas)
//   POST {accion:"crear", ...}  crea la invitación (y el cupón de Stripe si
//                               el descuento está entre 1 y 99) y manda el email
//   POST {accion:"reenviar",id} vuelve a mandar el email (solo si sigue "enviada")
//   POST {accion:"anular", id}  la anula (y borra el cupón si no se ha usado)
//
// Solo admin, comprobado en el servidor ANTES de tocar service_role
// (_lib/admin.js: token válido + es_admin() con ese token; comun auth.md A1,
// supabase.md D12). La tabla public.invitaciones no tiene policies: solo se
// llega a ella con service_role desde aquí, canjear-invitacion.js y el webhook.
//
// Emails: helper único (_lib/email.js), remitente ASCII (trampa 13), se marca
// email_enviado_en SOLO tras el 2xx de Resend (E8) y el detalle de Resend o de
// Stripe nunca vuelve al navegador (trampa 3): al admin le llega un código.
//
// Secrets (Cloudflare Pages, Production Y Preview, y redeploy tras
// cambiarlos — trampa 1): SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
// STRIPE_SECRET_KEY (solo para descuentos entre 1 y 99 %), ADMIN_EMAIL
// (opcional: responder-a del email).

import { requireAdmin, SUPABASE_URL } from "./_lib/admin.js";
import { enviarEmail } from "./_lib/email.js";
import {
  generarCodigo,
  validarNuevaInvitacion,
  estadoInvitacion,
  necesitaCupon,
  parametrosCupon,
  emailInvitacion,
  uuidValido,
} from "./_lib/invitaciones.js";

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function supabase(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  return async function rest(ruta, { method = "GET", body, prefer } = {}) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      method,
      headers: prefer ? { ...cab, Prefer: prefer } : cab,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await resp.text();
    if (!resp.ok) {
      const e = new Error(`Supabase ${method} ${ruta.split("?")[0]} HTTP ${resp.status}: ${texto}`);
      e.status = resp.status;
      e.cuerpo = texto;
      throw e;
    }
    return texto ? JSON.parse(texto) : null;
  };
}

async function stripe(env, metodo, ruta, params, idempotencia) {
  const cab = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (params) cab["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencia) cab["Idempotency-Key"] = idempotencia;
  const resp = await fetch(`https://api.stripe.com/v1/${ruta}`, {
    method: metodo,
    headers: cab,
    body: params ? params.toString() : undefined,
  });
  const texto = await resp.text();
  if (!resp.ok) {
    // Solo al log del Worker (trampa 3).
    console.error(`admin-invitaciones: Stripe ${metodo} ${ruta} HTTP ${resp.status}: ${texto}`);
    return { ok: false, status: resp.status };
  }
  return { ok: true, datos: texto ? JSON.parse(texto) : null };
}

const conEstado = (inv, ahora = new Date()) => ({ ...inv, estado: estadoInvitacion(inv, ahora) });

async function mandarEmail(env, inv) {
  const { asunto, texto, html } = emailInvitacion(inv, { contacto: env.ADMIN_EMAIL || null });
  return enviarEmail(env, { to: inv.email, subject: asunto, text: texto, html, replyTo: env.ADMIN_EMAIL || undefined });
}

// E8: se marca solo si Resend respondió 2xx.
async function marcarEnviado(rest, id) {
  const filas = await rest(`invitaciones?id=eq.${id}`, {
    method: "PATCH",
    body: { email_enviado_en: new Date().toISOString() },
    prefer: "return=representation",
  });
  return filas?.[0] || null;
}

async function cargar(rest, id) {
  const filas = await rest(`invitaciones?id=eq.${id}&select=*`);
  return filas?.[0] || null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request);
  if (!admin.ok) return json({ error: admin.error }, admin.status);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Invitaciones no configuradas (falta SUPABASE_SERVICE_ROLE_KEY).", codigo: "sin_configurar" }, 501);
  try {
    const filas = await supabase(env)("invitaciones?select=*&order=creada_en.desc&limit=200");
    const ahora = new Date();
    return json({ invitaciones: (filas || []).map((f) => conEstado(f, ahora)) });
  } catch (e) {
    console.error("admin-invitaciones: listar:", e);
    return json({ error: "No se han podido cargar las invitaciones.", codigo: "fallo_bd" }, 502);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request);
  if (!admin.ok) return json({ error: admin.error }, admin.status);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Invitaciones no configuradas (falta SUPABASE_SERVICE_ROLE_KEY).", codigo: "sin_configurar" }, 501);

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }
  const rest = supabase(env);

  try {
    if (cuerpo?.accion === "crear") return await crear(env, rest, cuerpo, admin.user);
    if (cuerpo?.accion === "reenviar" || cuerpo?.accion === "anular") {
      if (!uuidValido(cuerpo.id)) return json({ error: "Invitación no válida." }, 400);
      const inv = await cargar(rest, cuerpo.id);
      if (!inv) return json({ error: "Esa invitación no existe." }, 404);
      return cuerpo.accion === "reenviar" ? await reenviar(env, rest, inv) : await anular(env, rest, inv);
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    console.error("admin-invitaciones: fallo inesperado:", e);
    return json({ error: "Algo ha fallado guardando la invitación. Inténtalo de nuevo.", codigo: "fallo_bd" }, 500);
  }
}

async function crear(env, rest, cuerpo, adminUser) {
  const ahora = new Date();
  const v = validarNuevaInvitacion(cuerpo, ahora);
  if (!v.ok) return json({ error: v.errores.join(" "), errores: v.errores }, 400);
  const datos = v.datos;
  const id = crypto.randomUUID();

  let stripe_coupon_id = null;
  if (necesitaCupon(datos)) {
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Para un descuento entre 1 y 99 % hace falta Stripe, y falta STRIPE_SECRET_KEY.", codigo: "sin_stripe" }, 501);
    }
    const cupon = await stripe(env, "POST", "coupons", parametrosCupon(datos, { id, ahora }), `invitacion-${id}`);
    if (!cupon.ok) return json({ error: "Stripe no ha creado el descuento. No se ha guardado ni enviado nada.", codigo: "fallo_stripe" }, 502);
    stripe_coupon_id = cupon.datos.id;
  }

  let inv = null;
  // Un choque de código (60 bits) es casi imposible; se reintenta una vez.
  for (let intento = 0; intento < 2 && !inv; intento++) {
    try {
      const filas = await rest("invitaciones", {
        method: "POST",
        body: { id, codigo: generarCodigo(), ...datos, creada_por: adminUser.id, stripe_coupon_id },
        prefer: "return=representation",
      });
      inv = filas?.[0] || null;
    } catch (e) {
      if (intento === 0 && e.status === 409 && /codigo/.test(e.cuerpo || "")) continue;
      if (stripe_coupon_id) await stripe(env, "DELETE", `coupons/${encodeURIComponent(stripe_coupon_id)}`);
      throw e;
    }
  }
  if (!inv) throw new Error("insert sin fila devuelta");

  const envio = await mandarEmail(env, inv);
  if (envio.ok) inv = (await marcarEnviado(rest, inv.id)) || inv;
  return json({
    invitacion: conEstado(inv),
    email_enviado: envio.ok,
    email_error: envio.ok ? null : envio.error === "sin_configurar" ? "sin_configurar" : "fallo_envio",
  }, 201);
}

async function reenviar(env, rest, inv) {
  const estado = estadoInvitacion(inv);
  if (estado !== "enviada") {
    return json({ error: `No se puede reenviar: la invitación está ${estado}.`, codigo: `estado_${estado}` }, 409);
  }
  const envio = await mandarEmail(env, inv);
  if (!envio.ok) return json({ error: "El email no ha salido. Inténtalo de nuevo en unos minutos.", codigo: envio.error === "sin_configurar" ? "sin_configurar" : "fallo_envio" }, 502);
  const actual = (await marcarEnviado(rest, inv.id)) || inv;
  return json({ invitacion: conEstado(actual), email_enviado: true });
}

async function anular(env, rest, inv) {
  if (inv.anulada_en) return json({ invitacion: conEstado(inv) });
  // El cupón se borra para que no se pueda aplicar; si ya está en una
  // suscripción, Stripe lo mantiene allí (borrarlo no quita un descuento ya
  // aplicado). Si Stripe falla, se anula igual: crear-checkout-stripe solo
  // aplica cupones de invitaciones sin anular.
  let cupon_borrado = null;
  if (inv.stripe_coupon_id && !inv.descuento_aplicado_en && env.STRIPE_SECRET_KEY) {
    const r = await stripe(env, "DELETE", `coupons/${encodeURIComponent(inv.stripe_coupon_id)}`);
    cupon_borrado = r.ok || r.status === 404;
  }
  const filas = await rest(`invitaciones?id=eq.${inv.id}&anulada_en=is.null`, {
    method: "PATCH",
    body: { anulada_en: new Date().toISOString() },
    prefer: "return=representation",
  });
  const actual = filas?.[0] || (await cargar(rest, inv.id)) || inv;
  return json({ invitacion: conEstado(actual), cupon_borrado });
}
