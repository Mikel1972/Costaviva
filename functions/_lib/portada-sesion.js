// functions/_lib/portada-sesion.js
// Portada sin sesión → /login desde el SERVIDOR (2026-11-23, Mikel: «si somos
// capaces de hacerlo bien, adelante»). PageSpeed medía la portada en 62 en
// móvil porque el navegador recibía index.html (446 KB) y luego saltaba.
//
// La sesión de Supabase vive en localStorage, que el servidor no ve. Por eso
// las páginas dejan una cookie-marca `cv_sesion=1` mientras hay token
// guardado (index.html y login.html, al cargar; ver MARCA_SESION_JS) y la
// borran si no lo hay. Sin la marca, la portada redirige aquí.
//
// Para que nunca haya un bucle portada ↔ login:
// - login.html pone la marca al cargar si hay token, ANTES de mandar a «/».
// - Si la petición viene del propio /login (Referer), no se redirige: la
//   portada decide en el navegador, como antes.
// - Los robots de buscadores ven la portada (no se redirigen).
// - Cualquier fallo → sin redirección (como hasta hoy).

export const COOKIE_SESION = "cv_sesion";
const ROBOT = /bot|crawl|spider|slurp/i;

export function tieneMarcaSesion(cookies) {
  return new RegExp(`(?:^|;\\s*)${COOKIE_SESION}=1(?:;|$)`).test(String(cookies || ""));
}

// URL de destino (relativa) o null si la portada se sirve tal cual.
export function redireccionPortada(request) {
  try {
    if (request.method !== "GET") return null;
    const url = new URL(request.url);
    if (url.pathname !== "/" && url.pathname !== "/index.html") return null;
    if (ROBOT.test(request.headers.get("user-agent") || "")) return null;
    if (tieneMarcaSesion(request.headers.get("cookie"))) return null;
    const referer = request.headers.get("referer");
    if (referer) {
      const r = new URL(referer);
      if (r.host === url.host && (r.pathname === "/login" || r.pathname === "/login.html")) return null;
    }
    return `/login${url.search}`;
  } catch {
    return null;
  }
}

// Script en línea que sincroniza la marca con el token guardado (lo usan
// index.html y login.html; test/portada-sesion.test.js comprueba que es el mismo).
export const CLAVE_TOKEN = "sb-imncbmizxkorotpeisic-auth-token";
