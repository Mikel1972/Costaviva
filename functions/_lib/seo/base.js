// functions/_lib/seo/base.js
// Piezas comunes de las páginas públicas e indexables (2026-10-08, pedido
// de Mikel: "Costaviva no tiene visibilidad en buscadores; empieza el SEO").
// HTML generado en el servidor, sin JavaScript, sin IA y sin coste: lo que
// cambia cada hora (condiciones de hoy) sale de /prevision y /meteo/*, que
// ya tienen caché en el edge, y la página entera se guarda 30 min en la
// Cache API (`conCache`).
//
// Lo usan functions/spots/** y functions/especies/**. Las páginas de
// functions/mareas/** (2026-09-19) siguen con su propio HTML: las toca el
// robot de SEO y no hay que romperle el terreno.

import { CSS_PUBLICO } from "./estilos.js";
import { IDIOMAS_SEO, rutaIdioma, enlacesHreflang } from "./idiomas.js";

export const DOMINIO = "https://costaviva.org";
// Rendimiento (2026-10-08, PageSpeed móvil de /spots/bakio: 87, "solicitudes
// que bloquean el renderizado, 1,9 s"): nada bloquea el pintado. El CSS
// (costaviva.css + publico.css) va en línea (estilos.js, generado por
// scripts/seo/generar-estilos.mjs) y las letras son propias (/assets/fonts,
// sin Google Fonts). Se precargan los dos ficheros "latin", los que usa
// cualquier página en español; latin-ext solo se baja si hace falta.
export const FUENTES_PRECARGA = ["/assets/fonts/Manrope-latin.woff2", "/assets/fonts/Unbounded-latin.woff2"];
// Imágenes para compartir (1200x630, sin IA): una por sección y una por
// región, hechas con scripts/seo/generar-imagenes.py (assets/og/*.jpg).
export const IMAGEN_OG = `${DOMINIO}/assets/og/costaviva.jpg`;
export const imagenOg = (nombre) => `${DOMINIO}/assets/og/${nombre}.jpg`;
export const imagenOgRegion = (region) => imagenOg(region ? `region-${region.slug}` : "spots");
// Caché de las páginas con datos de hoy (spot) y de las fijas (especies,
// índices). /prevision se refresca cada 30 min: no tiene sentido ir más fresco.
export const TTL_CON_DATOS_S = 1800;
export const TTL_FIJA_S = 3600;
// Si /prevision tarda más que esto (sin caché tarda ~9 s), la página sale sin
// "condiciones de hoy" y se guarda poco tiempo: mejor una página rápida que
// un rastreador esperando.
export const ESPERA_MAX_DATOS_MS = 4000;
export const TTL_SIN_DATOS_S = 300;

export function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// JSON-LD seguro dentro de <script>: sin "</script>" posible.
export function jsonLd(datos) {
  return `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>`;
}

export function migasJsonLd(migas) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nombre, item: `${DOMINIO}${m.ruta}` })),
  };
}

export function migasHtml(migas) {
  return `<nav class="migas" aria-label="Migas de pan"><ol>${migas
    .map((m, i) => (i === migas.length - 1 ? `<li aria-current="page">${esc(m.nombre)}</li>` : `<li><a href="${esc(m.ruta)}">${esc(m.nombre)}</a></li>`))
    .join("")}</ol></nav>`;
}

const LOGO = `<svg class="marca-logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle class="marca-fondo" cx="20" cy="20" r="19"/><path class="marca-pez" d="M9 17c4-6.5 14-6.5 19 0-5 6.5-15 6.5-19 0z"/><path class="marca-pez" d="M27.5 17l6-4.5v9z"/><circle class="marca-ojo" cx="13.5" cy="16" r="1.4"/><path class="marca-ola" d="M5 28c3.5-3.2 6.5-3.2 10 0s6.5 3.2 10 0 6.5-3.2 10 0"/></svg>`;

// Llamada a la app: siempre a /login?alta=1 (mismo destino que /mareas).
export function cta(titulo = "Prueba Costaviva 7 días gratis") {
  return `<section class="cta" aria-label="Prueba Costaviva">
  <p class="cta-titulo">${esc(titulo)}</p>
  <ul class="cta-lista">
    <li>Índice de pesca hora a hora y la mejor ventana del día</li>
    <li>Alarmas de condiciones y SOS con tu ubicación</li>
    <li>Diario de pesca con los datos del momento de cada captura</li>
    <li>Grupos privados para compartir spots y salidas</li>
  </ul>
  <a class="cta-boton" href="/login?alta=1">Empieza gratis →</a>
  <p class="cta-sub">Sin tarjeta. Después, 3,99 €/mes o 39,99 €/año.</p>
</section>`;
}

// Documento completo. `ruta` es la canónica (sin dominio).
// idioma/alternos: mecanismo de /en/ (idiomas.js), apagado: con los valores
// por defecto el HTML es el de siempre.
export function documento({ titulo, descripcion, ruta, cuerpo, ld = [], ogTipo = "website", noindex = false, imagen = IMAGEN_OG, imagenAlt = "Costaviva: condiciones de pesca en tiempo real", idioma = "es", alternos = ["es"] }) {
  const cfg = IDIOMAS_SEO[idioma] || IDIOMAS_SEO.es;
  const url = `${DOMINIO}${rutaIdioma(ruta, idioma)}`;
  const hreflang = noindex ? "" : enlacesHreflang(ruta, DOMINIO, alternos);
  return `<!doctype html>
<html lang="${cfg.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
${hreflang ? `${hreflang}\n` : ""}<meta property="og:type" content="${ogTipo}">
<meta property="og:site_name" content="Costaviva">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:image" content="${esc(imagen)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imagenAlt)}">
<meta property="og:locale" content="${cfg.ogLocale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descripcion)}">
<meta name="twitter:image" content="${esc(imagen)}">
<meta name="twitter:image:alt" content="${esc(imagenAlt)}">
<meta name="theme-color" content="#0B1E3F">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/iconos/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
${FUENTES_PRECARGA.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join("\n")}
<style>${CSS_PUBLICO}</style>
${ld.map(jsonLd).join("\n")}
</head>
<body class="publica">
<header class="cabecera-publica">
  <a class="enlace-marca" href="/" aria-label="Costaviva, inicio">${LOGO}<span class="logotipo">Costaviva</span></a>
  <nav class="nav-publica" aria-label="Secciones">
    <a href="/spots">Spots</a><a href="/especies">Especies</a><a href="/mareas">Mareas</a>
  </nav>
</header>
<main class="contenido">
${cuerpo}
</main>
<footer class="pie-publico">
  <p><a href="/spots">Spots de pesca</a> · <a href="/especies">Especies</a> · <a href="/mareas">Mareas hoy</a> · <a href="/privacidad">Privacidad</a> · <a href="/login">Entrar</a></p>
  <p class="nota">Datos de mar y tiempo: Open-Meteo (CC BY 4.0). Profundidad: EMODnet Bathymetry (CC BY 4.0). Tipo de fondo: EMODnet Seabed Habitats (CC BY 4.0) y © colaboradores de OpenStreetMap (ODbL). Orientativo: no sirve para navegar. Tallas y vedas orientativas: manda la norma vigente publicada en el boletín oficial.</p>
</footer>
</body>
</html>`;
}

export function respuestaHtml(html, { status = 200, ttl = TTL_FIJA_S, noindex = false } = {}) {
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${ttl}` };
  if (noindex) headers["x-robots-tag"] = "noindex";
  return new Response(html, { status, headers });
}

// Página 404 de verdad (status 404 y noindex), con enlaces útiles.
export function html404({ que = "página", volver = "/spots", volverTexto = "Ver todos los spots" } = {}) {
  const html = documento({
    titulo: `No encontrada | Costaviva`,
    descripcion: `Esta ${que} no existe en Costaviva.`,
    ruta: volver,
    noindex: true,
    cuerpo: `<h1>No encontramos esta ${esc(que)}</h1>
<p class="intro">Puede que el enlace esté mal escrito o que la ${esc(que)} ya no exista.</p>
<p><a class="cta-boton" href="${esc(volver)}">${esc(volverTexto)}</a></p>`,
  });
  return { html, status: 404, ttl: TTL_SIN_DATOS_S, noindex: true };
}
// 404 general del sitio (2026-10-08): la usa el middleware para las rutas
// fuera de la lista blanca y está copiada en /404.html, que Cloudflare Pages
// sirve con status 404 para cualquier fichero que no exista. Sin 404.html,
// Pages trataba el sitio como una SPA y devolvía la portada con 200 (un
// "soft 404" para Google: /assets/no-existe.png daba la app entera).
// scripts/seo/generar-sitemap.mjs reescribe 404.html con esto.
export function htmlNoEncontradaGeneral() {
  return documento({
    titulo: "Página no encontrada | Costaviva",
    descripcion: "Esta página no existe en Costaviva. Mira los spots de pesca, las especies o las mareas de hoy.",
    ruta: "/",
    noindex: true,
    cuerpo: `<h1>No encontramos esta página</h1>
<p class="intro">Puede que el enlace esté mal escrito o que la página ya no exista. Quizá buscabas:</p>
<ul class="chips"><li><a href="/spots">Spots de pesca</a></li><li><a href="/especies">Especies, tallas y vedas</a></li><li><a href="/mareas">Mareas hoy</a></li><li><a href="/">La app de Costaviva</a></li></ul>
${cta()}`,
  });
}

export function pagina404(opciones) {
  const { html, status, ttl, noindex } = html404(opciones);
  return respuestaHtml(html, { status, ttl, noindex });
}

// Redirección 301 de "/spots/" a "/spots" (una sola URL por página).
export function sinBarraFinal(request) {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

// JSON estático del propio sitio (assets/datos/...). En Pages, env.ASSETS
// lo sirve sin pasar por las Functions; si no existe (tests), fetch normal.
export async function cargarJson(context, ruta) {
  const url = new URL(ruta, context.request.url);
  const r = context.env?.ASSETS ? await context.env.ASSETS.fetch(url) : await fetch(url);
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status}`);
  return r.json();
}

// Una petición con tiempo máximo; null si falla o tarda. No se aborta: si
// tarda, la página sale sin ese dato pero la petición sigue (waitUntil) y
// deja caliente la caché de /prevision para la siguiente visita.
export async function pedirConLimite(url, ms = ESPERA_MAX_DATOS_MS, context = null) {
  const peticion = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  context?.waitUntil?.(peticion);
  let t;
  const limite = new Promise((resolve) => { t = setTimeout(() => resolve(null), ms); });
  try {
    return await Promise.race([peticion, limite]);
  } finally {
    clearTimeout(t);
  }
}

// Caché real en el edge (la cabecera cache-control sola no cachea una
// Function, ver functions/prevision.js). `generar` devuelve { html, status,
// ttl }. La clave es la URL sin query: ?utm=... no crea copias.
export async function conCache(context, generar) {
  const url = new URL(context.request.url);
  url.search = "";
  const clave = new Request(url.toString(), { method: "GET" });
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    const hit = await cache.match(clave);
    if (hit) return hit;
  }
  const { html, status = 200, ttl = TTL_FIJA_S, noindex = false } = await generar();
  const resp = respuestaHtml(html, { status, ttl, noindex });
  if (cache && status === 200) context.waitUntil?.(cache.put(clave, resp.clone()));
  return resp;
}

// Hora actual de Madrid como "AAAA-MM-DDTHH:00" (formato de Open-Meteo).
export function ahoraMadridISO(fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(fecha).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}

export const fmt1 = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
