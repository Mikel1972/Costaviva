// functions/_middleware.js
// Cloudflare Pages sirve TODO lo que hay en el árbol de git, incluidos los
// directorios que empiezan por punto. Este middleware decide qué se sirve.
//
// Desde el 2026-09-25 usa una lista BLANCA (ver functions/_lib/rutas-publicas.js
// para la lista y el razonamiento completo). Antes era una lista negra, y
// falló tres veces: CLAUDE.md y functions/ (2026-09-13), scripts/
// (2026-09-18) y .github/workflows/ (2026-09-25). Siempre el mismo patrón —
// se añade un fichero nuevo y nadie se acuerda de bloquearlo.
//
// La diferencia real no es cuánto bloquea cada enfoque, sino CÓMO FALLA
// cada uno cuando se te olvida algo: con lista negra, el olvido expone
// información en silencio y puede tardar meses en descubrirse; con lista
// blanca, el olvido rompe una página y se nota en la siguiente prueba.
//
// Patrón tomado de Pólizas.ai, que migró a esto el 2026-09-10 tras haber
// servido sin querer un JSON con datos reales de usuarios.
//
// SI AÑADES UNA PÁGINA, UN ENDPOINT O UNA CARPETA DE ASSETS: tiene que
// entrar en rutas-publicas.js o devolverá 404. Es deliberado.
//
// Además, a toda respuesta HTML le pone la CSP con nonce (abajo, conformidad
// W6, 2026-10-07). Fail-closed: si falla, 500, nunca HTML sin CSP.
import { esRutaPermitida } from "./_lib/rutas-publicas.js";
import { decisionIndexacion } from "./_lib/seo/indexacion.js";
import { htmlNoEncontradaGeneral } from "./_lib/seo/base.js";
import { visitaAContar, contarVisita, conOrigenEnCta } from "./_lib/visitas.js";

export async function onRequest(context) {
  const { request, next } = context;
  const { pathname } = new URL(request.url);
  if (!esRutaPermitida(pathname)) return respuestaNoEncontrada(HTMLRewriter);
  // Un solo dominio para los buscadores (2026-10-08): http -> https y el
  // alias fishnow-59u.pages.dev -> costaviva.org con 301; previews y
  // páginas privadas con X-Robots-Tag: noindex. Ver _lib/seo/indexacion.js.
  const seo = decisionIndexacion(request.url, request.method);
  if (seo.redirigir) return Response.redirect(seo.redirigir, 301);
  let original = await next();
  // Contador propio de visitas a páginas públicas (2026-10-09): un recuento
  // agregado por día/página/fuente, en segundo plano y sin datos de la
  // persona (ver _lib/visitas.js). Nunca retrasa ni rompe la respuesta.
  try {
    const visita = visitaAContar(request, original);
    if (visita && context.waitUntil) context.waitUntil(contarVisita(visita, { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }));
    if (visita) original = conOrigenEnCta(original, visita, HTMLRewriter);
  } catch { /* el contador nunca rompe la página */ }
  const respuesta = aplicarCsp(original, HTMLRewriter);
  return seo.noindex ? conNoindex(respuesta) : respuesta;
}

// 404 con enlaces útiles (2026-10-08), noindex y con la CSP de siempre.
export function respuestaNoEncontrada(Rewriter) {
  const respuesta = new Response(htmlNoEncontradaGeneral(), {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
  return aplicarCsp(respuesta, Rewriter);
}

export function conNoindex(respuesta) {
  const headers = new Headers(respuesta.headers);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers });
}

// ---------------------------------------------------------------------------
// Content-Security-Policy con nonce por petición (Mikel1972/comun,
// estandares/web-y-despliegue.md W6). Adaptado de Pólizas.ai
// (su functions/_middleware.js), con tres diferencias deliberadas:
//
// 1. El nonce va en TODOS los <script>, no solo en los inline. Usamos
//    'strict-dynamic', y con él los navegadores modernos ignoran la lista de
//    hosts y 'self': un <script src> sin nonce no cargaría. A cambio, lo que
//    carga un script con nonce (Turnstile, los módulos de esm.sh que importa
//    el <script type="module">, el worker de hls.js) hereda la confianza sin
//    tener que listar cada origen.
// 2. Fail-closed: si preparar la reescritura falla, 500 en vez de servir el
//    HTML sin CSP. La cabecera se fija ANTES de que salga el primer byte, así
//    que un error a mitad del streaming corta la respuesta, pero lo que haya
//    llegado al navegador ya lleva la CSP.
// 3. connect-src, img-src y media-src admiten https: entero. Las webcams
//    (HLS y JPG) vienen de hosts muy variados y el robot de webcams añade
//    hosts nuevos sin tocar este fichero (streamlock.net, sXXX.ipcamlive.com,
//    que además cambia de servidor sin aviso). Una lista cerrada rompería una
//    cámara cada vez que cambie un host. Lo que protege de verdad frente a un
//    XSS es script-src, que sí es estricto.
//
// SI AÑADES UN <script>: no hace falta nada, el middleware le pone el nonce.
// Lo que NO funciona con esta CSP: atributos on*="..." en el HTML (ni en
// cadenas que se metan con innerHTML), URLs javascript: y eval(). Usa
// addEventListener.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
// Clave anon: pública por diseño (va en todas las páginas). Solo puede
// llamar a contar_visita_publica(), que suma 1 a un recuento agregado.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

export function generarNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function construirCsp(nonce) {
  return [
    "default-src 'self'",
    // https: solo lo usan navegadores sin soporte de 'strict-dynamic' (los
    // que sí lo soportan lo ignoran). Nunca 'unsafe-inline' (W6).
    `script-src 'nonce-${nonce}' 'strict-dynamic' https:`,
    // Los estilos inline (atributos style= y <style>) sí pueden quedarse:
    // el estándar solo prohíbe 'unsafe-inline' en scripts.
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    // Letras propias en /assets/fonts (2026-10-08): ya no se usa Google
    // Fonts en ninguna página, así que fuera fonts.googleapis.com y
    // fonts.gstatic.com.
    "font-src 'self'",
    // Teselas raster (EMODnet, EUMETSAT, natural_earth de OpenFreeMap), iconos
    // de Leaflet, fotos firmadas de Supabase Storage, snapshots de webcams.
    "img-src 'self' data: blob: https:",
    // Vídeo de portada (self) y HLS de webcams: hls.js usa MediaSource
    // (blob:); Safari reproduce el .m3u8 directamente desde el host remoto.
    "media-src 'self' blob: https:",
    // fetch/XHR: Supabase (REST, auth, storage y realtime por wss), el mapa
    // base vectorial (estilo, teselas, letras y sprites de
    // tiles.openfreemap.org, pedidos desde el worker de MapLibre),
    // RainViewer, EUMETSAT, playlists y segmentos HLS, beacon de Cloudflare.
    // Open-Meteo YA NO (2026-10-08): el navegador pide a /meteo/<api> ('self'),
    // que guarda la API key comercial en el servidor (functions/meteo/[api].js).
    `connect-src 'self' https: ${SUPABASE_URL.replace("https://", "wss://")}`,
    // hls.js y MapLibre GL (mapa base, 2026-10-08) arrancan su worker desde
    // un blob:.
    "worker-src 'self' blob:",
    // Turnstile (login.html).
    "frame-src https://challenges.cloudflare.com",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Devuelve la respuesta con CSP y nonce en cada <script>, o la misma
// respuesta si no es HTML. `Rewriter` es el HTMLRewriter de Cloudflare; se
// pasa como parámetro para poder probarlo en Node (test/csp.test.js). Pages
// solo usa los exports onRequest*; los demás exports son para el test.
export function aplicarCsp(response, Rewriter) {
  const tipo = response.headers.get("content-type") || "";
  if (!tipo.toLowerCase().includes("text/html")) return response;

  try {
    const nonce = generarNonce();
    const reescrita = new Rewriter()
      .on("script", {
        element(el) {
          el.setAttribute("nonce", nonce);
        },
      })
      .transform(response);

    const headers = new Headers(reescrita.headers);
    headers.set("Content-Security-Policy", construirCsp(nonce));
    // Sin ETag: con él, el navegador revalida, recibe un 304 y reutiliza la
    // página de antes con el nonce de antes. Cada carga, nonce nuevo.
    headers.delete("etag");
    headers.delete("content-length");
    return new Response(reescrita.body, {
      status: reescrita.status,
      statusText: reescrita.statusText,
      headers,
    });
  } catch (err) {
    console.error("CSP: no se pudo reescribir el HTML, se devuelve 500", err);
    return new Response("Error interno", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
