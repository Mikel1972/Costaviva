// functions/_lib/seo/indexacion.js
// Qué deben ver los buscadores en cada host y ruta (2026-10-08, auditoría de
// "Google solo indexa 4 páginas"). Lo usa functions/_middleware.js; lógica
// pura, test en test/seo-paginas.test.js.
//
// - Un solo dominio canónico: https://costaviva.org. El alias de producción
//   de Cloudflare Pages (fishnow-59u.pages.dev) servía el sitio entero
//   duplicado con 200: ahora sus páginas redirigen con 301 al dominio.
//   Solo GET/HEAD de páginas: los endpoints (POST de Stripe, crons, la app
//   abierta en ese host) siguen funcionando igual, pero con noindex.
// - Previews (<rama>.fishnow-59u.pages.dev y <hash>.fishnow-59u.pages.dev):
//   no redirigen (Mikel revisa ahí las PR), pero llevan noindex.
// - http:// -> https:// con 301 (Cloudflare ya lo hace hoy, comprobado el
//   2026-10-08; esto es la red por si se desactiva "Always Use HTTPS").
// - Páginas privadas de la app (tras login): X-Robots-Tag noindex. NUNCA
//   /login ni /: Google renderiza / -> JS lleva a /login (canonical /), y un
//   noindex ahí podría sacar la portada del índice (CLAUDE.md).

export const HOST_CANONICO = "costaviva.org";
export const HOST_PAGES_PRODUCCION = "fishnow-59u.pages.dev";

export const PAGINAS_PRIVADAS = new Set([
  "/diario", "/diario.html", "/alarma", "/alarma.html", "/grupos", "/grupos.html",
  "/suscripcion", "/suscripcion.html", "/admin", "/admin.html", "/etiquetar-olas", "/etiquetar-olas.html",
]);

// Rutas que son páginas (se redirigen desde el alias de pages.dev).
const PAGINAS_EXACTAS = new Set(["/", "/index.html", "/login", "/login.html", "/privacidad", "/privacidad.html", "/empieza", "/empieza.html", "/robots.txt", "/sitemap.xml", "/mareas", "/spots", "/especies"]);
const PREFIJOS_PAGINAS = ["/mareas/", "/spots/", "/especies/"];
export function esPagina(pathname) {
  return PAGINAS_EXACTAS.has(pathname) || PAGINAS_PRIVADAS.has(pathname) || PREFIJOS_PAGINAS.some((p) => pathname.startsWith(p));
}

// Devuelve { redirigir: url | null, noindex: boolean }.
export function decisionIndexacion(urlTexto, metodo = "GET") {
  const url = new URL(urlTexto);
  const host = url.hostname.toLowerCase();
  const lectura = metodo === "GET" || metodo === "HEAD";
  if (host === HOST_CANONICO && url.protocol === "http:" && lectura) {
    url.protocol = "https:";
    return { redirigir: url.toString(), noindex: false };
  }
  if (host === HOST_PAGES_PRODUCCION && lectura && esPagina(url.pathname)) {
    return { redirigir: `https://${HOST_CANONICO}${url.pathname}${url.search}`, noindex: false };
  }
  if (host.endsWith(".pages.dev")) return { redirigir: null, noindex: true };
  return { redirigir: null, noindex: PAGINAS_PRIVADAS.has(url.pathname) };
}
