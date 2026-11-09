// functions/dispositivos.js
// Límite de dispositivos por cuenta (2026-11-09). Ver assets/js/dispositivos.js.
//
// POST { accion: "listar" }                → estado
// POST { accion: "cerrar", sesion: uuid }  → cierra esa sesión (de ESE usuario) y devuelve el estado
// estado = { limite, dispositivos: [{ id, nombre, ultima, actual }], exceso, actual_cerrada }
//
// Seguridad (comun auth.md A1, supabase.md D12/D14): primero se valida el
// token contra Supabase Auth (requireSesion); el usuario y la sesión salen de
// ESE token, nunca del cuerpo. Solo entonces se usa service_role para las
// funciones sesiones_usuario / cerrar_sesion_usuario (migración
// 20261109120000, sin EXECUTE para nadie más). Los administradores no tienen
// límite. Nunca se devuelve la IP.

import { requireSesion, SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/admin.js";
import { decidir, LIMITE_DISPOSITIVOS } from "../assets/js/dispositivos.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// session_id del token ya validado por Supabase Auth.
export function sesionDelToken(token) {
  try {
    const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const id = JSON.parse(atob(parte + "=".repeat((4 - (parte.length % 4)) % 4))).session_id;
    return UUID.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

async function rpc(env, nombre, cuerpo) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
  return r.json();
}

async function esAdmin(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/es_admin`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

async function estado(env, userId, actual, limite) {
  const sesiones = await rpc(env, "sesiones_usuario", { p_user: userId });
  const d = decidir(sesiones, actual, limite);
  // La misma app o navegador que volvió a entrar: se cierran las viejas solas.
  for (const id of d.cerrarSolas) await rpc(env, "cerrar_sesion_usuario", { p_user: userId, p_sesion: id }).catch(() => {});
  return { limite, dispositivos: d.dispositivos, exceso: d.exceso && !d.actualCerrada, actual_cerrada: d.actualCerrada };
}

export async function onRequestPost({ request, env }) {
  const sesion = await requireSesion(request);
  if (!sesion.ok) return json(sesion.status, { error: sesion.error });
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json(503, { error: "sin_configurar" });
  const actual = sesionDelToken(sesion.token);
  if (!actual) return json(400, { error: "sesión sin identificador" });
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* listar */ }
  const limite = (await esAdmin(sesion.token)) ? null : LIMITE_DISPOSITIVOS;
  try {
    if (cuerpo.accion === "cerrar") {
      if (!UUID.test(cuerpo.sesion || "") || cuerpo.sesion === actual) return json(400, { error: "sesión no válida" });
      await rpc(env, "cerrar_sesion_usuario", { p_user: sesion.user.id, p_sesion: cuerpo.sesion });
    }
    return json(200, await estado(env, sesion.user.id, actual, limite));
  } catch (e) {
    console.error("dispositivos:", e?.message);
    return json(503, { error: "no disponible" });
  }
}
