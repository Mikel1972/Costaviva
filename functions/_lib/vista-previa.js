// functions/_lib/vista-previa.js
// Vista previa de una región OCULTA (fase 2 de NZ, 2026-10-09).
//
// Mientras "nz" no esté en REGIONES_ACTIVAS, /prevision?region=nz solo
// responde a:
//   1) un administrador: cabecera Authorization con su JWT de Supabase, que
//      requireAdmin() valida en el servidor (es_admin(), fail-closed); o
//   2) quien traiga ?clave=<VISTA_PREVIA_CLAVE>, un secret de Cloudflare
//      Pages (opcional: sin él, esta vía siempre rechaza). Sirve para enseñar
//      la región desde un móvil sin sesión de admin. Comparación en tiempo
//      constante (secretoValido).
// A cualquier otro se le responde 404, como si la región no existiera.
//
// La autorización se comprueba ANTES de mirar la caché: así una respuesta
// guardada de la vista previa nunca se sirve a quien no está autorizado.

import { requireAdmin, tokenDe } from "./admin.js";
import { secretoValido } from "./secreto.js";
import { regionActiva, REGIONES_ACTIVAS, REGIONES_CONOCIDAS } from "./regiones-activas.js";

// Región pedida en la URL: "es" (por defecto), una conocida, o null (no existe).
export function regionDeUrl(url) {
  const r = (url.searchParams.get("region") || "es").toLowerCase();
  return r === "es" || REGIONES_CONOCIDAS.includes(r) ? r : null;
}

// { ok, publica } — publica = la región está activa para todo el mundo.
export async function autorizarRegion(request, env, region, opciones = {}) {
  const activas = opciones.activas || REGIONES_ACTIVAS;
  const comprobarAdmin = opciones.comprobarAdmin || requireAdmin;
  if (regionActiva(region, activas)) return { ok: true, publica: true };
  const clave = new URL(request.url).searchParams.get("clave");
  if (clave && secretoValido(clave, env?.VISTA_PREVIA_CLAVE)) return { ok: true, publica: false, via: "clave" };
  if (tokenDe(request)) {
    const r = await comprobarAdmin(request);
    if (r.ok) return { ok: true, publica: false, via: "admin" };
  }
  return { ok: false, publica: false };
}

export function noEncontrado() {
  return new Response(JSON.stringify({ error: "No encontrado" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
