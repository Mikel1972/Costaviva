// functions/regalo-black-friday.js — "Regala un año a tu compañero de pesca"
// (Black Friday 2x1, 2026-11-19, Mikel). Alcanzable en /regalo-black-friday.
//
//   GET          { puede, regalado: { email, estado } | null, hasta }
//   POST {email} crea la invitación de regalo (100 %, 12 meses, canjeable
//                hasta el 31/12) y manda el email al amigo. Una por comprador.
//
// Seguridad (comun auth.md A1, supabase.md D12): la sesión se valida contra
// Supabase Auth ANTES de usar service_role; el derecho a regalar se lee de
// public.suscripciones del propio usuario (codigo_promocional = BLACKFRIDAY,
// que solo pone el webhook de Stripe tras un pago anual con el código dentro
// de plazo). El email del amigo no puede ser el del propio comprador.
import { requireSesion, SUPABASE_URL } from "./_lib/admin.js";
import { enviarEmail } from "./_lib/email.js";
import { generarCodigo, normalizarEmail, emailInvitacion, estadoInvitacion } from "./_lib/invitaciones.js";
import { puedeRegalar, invitacionRegalo, MARCA_BF, REGALO_HASTA } from "./_lib/black-friday.js";

const QUIEN = "Un compañero de pesca";

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
function rest(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  return async (ruta, { method = "GET", body, prefer } = {}) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { method, headers: prefer ? { ...cab, Prefer: prefer } : cab, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) { const e = new Error(`Supabase ${method} ${ruta.split("?")[0]} HTTP ${r.status}: ${t}`); e.status = r.status; e.cuerpo = t; throw e; }
    return t ? JSON.parse(t) : null;
  };
}
async function contexto(request, env) {
  const sesion = await requireSesion(request);
  if (!sesion.ok) return { error: json({ ok: false, codigo: "sin_sesion" }, sesion.status) };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { error: json({ ok: false, codigo: "sin_configurar" }, 501) };
  const db = rest(env);
  const id = encodeURIComponent(sesion.user.id);
  const sub = (await db(`suscripciones?user_id=eq.${id}&select=codigo_promocional,periodo,estado`))?.[0] || null;
  const regalo = (await db(`invitaciones?creada_por=eq.${id}&nota=eq.${MARCA_BF}&select=email,codigo,descuento,user_id,inscrito_en,acceso_hasta,anulada_en,caduca_en`))?.[0] || null;
  return { user: sesion.user, db, sub, regalo };
}

export async function onRequestGet({ request, env }) {
  try {
    const c = await contexto(request, env);
    if (c.error) return c.error;
    return json({
      ok: true,
      puede: puedeRegalar(c.sub) && !c.regalo,
      regalado: c.regalo ? { email: c.regalo.email, estado: estadoInvitacion(c.regalo) } : null,
      hasta: REGALO_HASTA.toISOString(),
    });
  } catch (e) {
    console.error("regalo-black-friday GET:", e);
    return json({ ok: false, codigo: "fallo" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const c = await contexto(request, env);
    if (c.error) return c.error;
    if (!puedeRegalar(c.sub)) return json({ ok: false, codigo: "sin_derecho" }, 403);
    if (c.regalo) return json({ ok: false, codigo: "ya_regalado", email: c.regalo.email }, 409);
    let cuerpo;
    try { cuerpo = await request.json(); } catch { return json({ ok: false, codigo: "email_no_valido" }, 400); }
    const email = normalizarEmail(cuerpo?.email);
    if (!email) return json({ ok: false, codigo: "email_no_valido" }, 400);
    if (email === String(c.user.email || "").toLowerCase()) return json({ ok: false, codigo: "email_propio" }, 400);
    let inv = null;
    for (let intento = 0; intento < 2 && !inv; intento++) {
      try {
        const filas = await c.db("invitaciones", { method: "POST", body: { codigo: generarCodigo(), ...invitacionRegalo(email), creada_por: c.user.id }, prefer: "return=representation" });
        inv = filas?.[0] || null;
      } catch (e) {
        if (intento === 0 && e.status === 409 && /codigo/.test(e.cuerpo || "")) continue;
        throw e;
      }
    }
    if (!inv) throw new Error("insert sin fila");
    const e = emailInvitacion(inv, { quienInvita: QUIEN });
    const minus = (t) => t.replace(/porque Un compañero/g, "porque un compañero");
    const [asunto, texto, html] = [e.asunto, minus(e.texto), minus(e.html)];
    const envio = await enviarEmail(env, { to: email, subject: `🎁 ${asunto.replace(/\(gratis\)$/, "(1 año gratis)")}`, text: texto, html });
    // Solo se marca enviado tras el 2xx de Resend (comun emails.md E8).
    if (envio.ok) await c.db(`invitaciones?id=eq.${inv.id}`, { method: "PATCH", body: { email_enviado_en: new Date().toISOString() } });
    return json({ ok: true, email, email_enviado: envio.ok }, 201);
  } catch (e) {
    console.error("regalo-black-friday POST:", e);
    return json({ ok: false, codigo: "fallo" }, 500);
  }
}
