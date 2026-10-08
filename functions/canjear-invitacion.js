// functions/canjear-invitacion.js
// El invitado canjea su código (login.html, tras crear la contraseña o al
// entrar). Alcanzable en /canjear-invitacion. POST {codigo}.
//
// Reglas (estándar de Mikel, 2026-10-08): el código solo vale para el email
// invitado y una sola vez; caducado o anulado se rechaza con un mensaje claro.
//   * El email sale del token de sesión validado contra Supabase Auth, nunca
//     del cuerpo. Una sesión solo existe con el email confirmado (alta por
//     enlace), así que el invitado ha demostrado que el buzón es suyo.
//   * Un solo uso: el UPDATE va condicionado a user_id=is.null y
//     anulada_en=is.null. Si dos peticiones llegan a la vez, solo una
//     actualiza la fila; la otra ve 0 filas y responde "usada".
//   * service_role SOLO después de validar la sesión (comun supabase.md D12),
//     y el código se valida con su formato exacto antes de ir en la URL (D14).
//
// Respuesta: { ok, codigo, descuento?, acceso_hasta? } con un `codigo` estable
// que assets/js/invitacion.js traduce a un mensaje. Nunca detalle interno.

import { requireSesion, SUPABASE_URL } from "./_lib/admin.js";
import { normalizarCodigo, validarCanje, camposCanje } from "./_lib/invitaciones.js";

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const sesion = await requireSesion(request);
  if (!sesion.ok) return json({ ok: false, codigo: "sin_sesion", error: sesion.error }, sesion.status);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return json({ ok: false, codigo: "sin_configurar" }, 501);

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, codigo: "no_existe" }, 400);
  }
  const codigo = normalizarCodigo(cuerpo?.codigo);
  if (!codigo) return json({ ok: false, codigo: "no_existe" }, 404);

  const { user } = sesion;
  if (!user.email || !(user.email_confirmed_at || user.confirmed_at)) {
    return json({ ok: false, codigo: "email_sin_confirmar" }, 403);
  }

  const cab = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invitaciones?codigo=eq.${codigo}&select=*`, { headers: cab });
    if (!r.ok) throw new Error(`leer invitación HTTP ${r.status}: ${await r.text()}`);
    const inv = (await r.json())[0] || null;

    const ahora = new Date();
    const veredicto = validarCanje(inv, { userId: user.id, email: user.email, ahora });
    if (veredicto === "ya_canjeada") {
      return json({ ok: true, codigo: "ya_canjeada", descuento: inv.descuento, acceso_hasta: inv.acceso_hasta });
    }
    if (veredicto !== "ok") {
      const status = { no_existe: 404, otro_email: 403, usada: 409, caducada: 410, anulada: 410 }[veredicto] || 400;
      return json({ ok: false, codigo: veredicto }, status);
    }

    const campos = camposCanje(inv, { userId: user.id, ahora });
    const u = await fetch(
      `${SUPABASE_URL}/rest/v1/invitaciones?id=eq.${inv.id}&user_id=is.null&anulada_en=is.null`,
      { method: "PATCH", headers: { ...cab, Prefer: "return=representation" }, body: JSON.stringify(campos) }
    );
    if (!u.ok) throw new Error(`canjear HTTP ${u.status}: ${await u.text()}`);
    const filas = await u.json();
    if (!filas.length) return json({ ok: false, codigo: "usada" }, 409);

    // 100 %: si su prueba ya había vencido y la cuenta quedó desactivada por
    // fin de prueba, se quita esa marca (el acceso lo da mi_estado_suscripcion()).
    if (inv.descuento === 100) {
      const p = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${user.id}&desactivado_en=not.is.null`, {
        method: "PATCH",
        headers: cab,
        body: JSON.stringify({ desactivado_en: null }),
      });
      if (!p.ok) console.error(`canjear-invitacion: no se pudo limpiar desactivado_en: HTTP ${p.status}`);
    }
    return json({ ok: true, codigo: "ok", descuento: inv.descuento, acceso_hasta: campos.acceso_hasta });
  } catch (e) {
    console.error("canjear-invitacion:", e);
    return json({ ok: false, codigo: "fallo" }, 502);
  }
}
