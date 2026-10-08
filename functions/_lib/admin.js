// functions/_lib/admin.js
// ¿Quien llama es administrador? Comprobado EN EL SERVIDOR (2026-10-08).
//
// Se llama a la RPC es_admin() de Supabase con el JWT del propio usuario y
// la anon key (nunca con service_role): PostgREST valida la firma del token
// (uno falso o caducado -> 401) y es_admin() decide con la regla de siempre
// (tabla public.administradores o, si esa migración aún no está aplicada, el
// email del dueño), así que no hay una segunda copia de la regla que pueda
// divergir. es_admin() no devuelve NULL (comun auth.md A5) y no la puede
// ejecutar anon (20261007160000_revocar_execute_definer.sql).
//
// Devuelve true SOLO si la respuesta es exactamente `true`. Sin cabecera,
// token mal formado, red caída o cualquier otra cosa -> false.

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
// Clave pública (anon): la misma que va en las páginas.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

const RE_BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export async function esAdminServidor(request, { fetchImpl = fetch } = {}) {
  const m = RE_BEARER.exec(request.headers.get("Authorization") || "");
  if (!m) return false;
  try {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/es_admin`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${m[1]}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch (e) {
    return false;
  }
}
