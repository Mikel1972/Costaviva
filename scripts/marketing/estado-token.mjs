// scripts/marketing/estado-token.mjs
// Lo mismo que comprueba comprobar-token-instagram.yml, para que la
// publicación automática (publicar-con-veto.mjs) no publique con un token
// inválido o sin permisos (2026-10-11). Nunca imprime el token.
// Lógica pura en evaluarToken (test/publicacion-veto.test.js).

// Los mismos permisos que exige comprobar-token-instagram.yml (el test
// comprueba que siguen coincidiendo).
export const PERMISOS_INSTAGRAM = [
  "instagram_basic", "instagram_content_publish", "instagram_manage_insights", "pages_show_list", "pages_read_engagement",
];
export const PERMISO_FACEBOOK = "pages_manage_posts";

// debug: respuesta de /debug_token; cuenta: de /{ig-id}; pagina: de
// /{page-id}?fields=name,access_token; pageId: variable META_PAGE_ID.
export function evaluarToken({ debug, cuenta, pagina, pageId }) {
  const mal = (motivo) => ({ ok: false, motivo });
  if (!debug || debug.error) return { instagram: mal(`token no válido: ${debug?.error?.message || "sin respuesta"}`), facebook: mal("token no válido") };
  const d = debug.data || {};
  if (!d.is_valid) return { instagram: mal("Meta dice que el token no es válido (caducado o revocado)"), facebook: mal("token no válido") };
  const scopes = d.scopes || [];
  const faltan = PERMISOS_INSTAGRAM.filter((p) => !scopes.includes(p));
  let instagram = { ok: true };
  if (faltan.length) instagram = mal(`faltan permisos: ${faltan.join(", ")}`);
  else if (!cuenta || cuenta.error) instagram = mal(`el token no llega a la cuenta de Instagram: ${cuenta?.error?.message || "sin respuesta"}`);
  let facebook = { ok: true };
  if (!instagram.ok) facebook = mal(instagram.motivo);
  else if (!scopes.includes(PERMISO_FACEBOOK)) facebook = mal(`al token le falta ${PERMISO_FACEBOOK}`);
  else if (!pageId) facebook = mal("falta la variable META_PAGE_ID");
  else if (!pagina || pagina.error || !pagina.access_token) facebook = mal("el token no da el Page token de la Página");
  return { instagram, facebook };
}

export async function consultarToken({ token, igId, pageId, fetchImpl = fetch }) {
  const API = "https://graph.facebook.com/v21.0";
  const leer = async (url) => {
    try {
      const r = await fetchImpl(url);
      return await r.json();
    } catch (e) {
      return { error: { message: `sin conexión con Meta (${e.message})` } };
    }
  };
  if (!token) return evaluarToken({ debug: { error: { message: "no hay token en META_PAGE_ACCESS_TOKEN" } } });
  const t = encodeURIComponent(token);
  const debug = await leer(`${API}/debug_token?input_token=${t}&access_token=${t}`);
  const cuenta = igId ? await leer(`${API}/${igId}?fields=username&access_token=${t}`) : { error: { message: "falta META_IG_BUSINESS_ACCOUNT_ID" } };
  const pagina = pageId ? await leer(`${API}/${pageId}?fields=name,access_token&access_token=${t}`) : null;
  return evaluarToken({ debug, cuenta, pagina, pageId });
}
