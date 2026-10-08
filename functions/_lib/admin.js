// functions/_lib/admin.js
// Comprobación de sesión y de rol admin en el servidor, ANTES de usar
// service_role (comun auth.md A1 y supabase.md D12, 2026-10-08).
//
// Es el mismo criterio que ya usa admin.html: el rol vive en Supabase
// (es_admin(), por user_id en public.administradores desde la migración
// 20261007150000), no en un email fijo en el código. Aquí:
//   1) el token de la cabecera Authorization se valida contra Supabase Auth
//      (/auth/v1/user) — un token caducado o inventado se rechaza;
//   2) con ESE MISMO token se llama a la RPC es_admin(), que se evalúa con
//      auth.uid() del token. Solo un `true` literal cuenta como admin
//      (es_admin() nunca devuelve NULL, A5; aun así, cualquier otra cosa es
//      "no").
// Cualquier fallo de red o respuesta rara = no autorizado (fail-closed).

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

export function tokenDe(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m ? m[1] : "";
}

// { ok: true, user, token } o { ok: false, status, error }
export async function requireSesion(request) {
  const token = tokenDe(request);
  if (!token) return { ok: false, status: 401, error: "Falta la sesión." };
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return { ok: false, status: 401, error: "La sesión no es válida o ha caducado." };
    const user = await resp.json();
    if (!user?.id) return { ok: false, status: 401, error: "La sesión no es válida o ha caducado." };
    return { ok: true, user, token };
  } catch (e) {
    console.error("requireSesion: fallo comprobando el token:", e);
    return { ok: false, status: 503, error: "No se ha podido comprobar la sesión. Inténtalo en un momento." };
  }
}

export async function requireAdmin(request) {
  const sesion = await requireSesion(request);
  if (!sesion.ok) return sesion;
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/es_admin`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sesion.token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (!resp.ok) return { ok: false, status: 403, error: "No autorizado." };
    const esAdmin = await resp.json();
    if (esAdmin !== true) return { ok: false, status: 403, error: "No autorizado." };
    return sesion;
  } catch (e) {
    console.error("requireAdmin: fallo llamando a es_admin():", e);
    return { ok: false, status: 403, error: "No autorizado." };
  }
}
