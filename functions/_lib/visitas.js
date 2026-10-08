// functions/_lib/visitas.js
// Contador propio de visitas a las páginas públicas (2026-10-09, captación).
//
// Lo llama functions/_middleware.js en segundo plano (waitUntil) para cada
// GET de una página pública que responde 200. Guarda SOLO un recuento por
// día, tipo de página, fuente y campaña (public.visitas_publicas, vía la
// función contar_visita_publica). Nada más: ni IP, ni navegador, ni URL de
// origen, ni cookies, ni identificador de la persona. Sin terceros.
//
// La fuente sale del utm_source de la URL o, si no hay, del DOMINIO de la
// cabecera Referer; ambas pasan por la misma lista cerrada que
// assets/js/origen.js (test/captacion.test.js comprueba que coinciden).

export const FUENTES = [
  "instagram", "facebook", "google", "bing", "duckduckgo", "ecosia", "yahoo",
  "whatsapp", "telegram", "x", "email", "referido", "invitacion", "directo", "otro",
];
export const PAGINAS_CONTADAS = ["empieza", "mareas", "spots", "especies", "login"];

const ALIAS = {
  ig: "instagram", insta: "instagram", "instagram.com": "instagram",
  fb: "facebook", "facebook.com": "facebook", meta: "facebook",
  wa: "whatsapp", "whatsapp.com": "whatsapp",
  tg: "telegram", twitter: "x", "t.co": "x",
  newsletter: "email", correo: "email", mail: "email",
  amigo: "referido", ref: "referido",
};

// Robots, previsualizaciones de enlaces y comprobaciones propias no cuentan.
const NO_PERSONA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|node-fetch|undici|headless|lighthouse|pingdom|uptime|monitor|playwright/i;

export function paginaContada(pathname) {
  const p = String(pathname || "");
  if (p === "/empieza" || p === "/empieza.html") return "empieza";
  if (p === "/login" || p === "/login.html") return "login";
  for (const t of ["mareas", "spots", "especies"]) if (p === `/${t}` || p.startsWith(`/${t}/`)) return t;
  return null;
}

function fuenteDeUtm(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return null;
  const f = ALIAS[t] || t;
  return FUENTES.includes(f) ? f : "otro";
}

function fuenteDeReferer(referer, hostPropio) {
  let host;
  try { host = new URL(referer).hostname.toLowerCase(); } catch { return "directo"; }
  if (!host || host === hostPropio || host.endsWith(".pages.dev") || host === "costaviva.org") return "interna";
  const es = (d) => host === d || host.endsWith(`.${d}`);
  if (es("instagram.com")) return "instagram";
  if (es("facebook.com") || es("fb.com") || es("messenger.com")) return "facebook";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
  if (es("bing.com")) return "bing";
  if (es("duckduckgo.com")) return "duckduckgo";
  if (es("ecosia.org")) return "ecosia";
  if (es("yahoo.com") || /(^|\.)yahoo\.[a-z.]+$/.test(host)) return "yahoo";
  if (es("whatsapp.com") || es("wa.me")) return "whatsapp";
  if (es("t.me") || es("telegram.org")) return "telegram";
  if (es("t.co") || es("x.com") || es("twitter.com")) return "x";
  return "otro";
}

function campanaValida(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(t) ? t : null;
}

// Decide si esta petición se cuenta y con qué datos. Devuelve null si no.
// `respuesta` solo necesita status y content-type.
export function visitaAContar(request, respuesta) {
  if (request.method !== "GET") return null;
  if (!respuesta || respuesta.status !== 200) return null;
  if (!(respuesta.headers.get("content-type") || "").includes("text/html")) return null;
  const h = request.headers;
  const ua = h.get("user-agent") || "";
  if (!ua || NO_PERSONA.test(ua)) return null;
  // Precargas del navegador: no son visitas.
  if (/prefetch|prerender/i.test(h.get("sec-purpose") || h.get("purpose") || "")) return null;
  const url = new URL(request.url);
  const pagina = paginaContada(url.pathname);
  if (!pagina) return null;
  const q = url.searchParams;
  let fuente = /^[A-HJ-NP-Z2-9]{8}$/.test(String(q.get("ref") || "").toUpperCase()) ? "referido" : fuenteDeUtm(q.get("utm_source"));
  if (!fuente) {
    fuente = fuenteDeReferer(h.get("referer") || "", url.hostname);
    // Navegar dentro de la propia web no es una visita nueva.
    if (fuente === "interna") return null;
  }
  return { p_pagina: pagina, p_fuente: fuente, p_campana: campanaValida(q.get("utm_campaign")) };
}

// Manda el recuento a Supabase. Nunca lanza: un contador caído no puede
// romper una página.
export async function contarVisita(datos, { url, anonKey, fetchImpl = fetch }) {
  try {
    const r = await fetchImpl(`${url}/rest/v1/rpc/contar_visita_publica`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!r.ok && r.status !== 404) console.warn(`contar_visita_publica HTTP ${r.status}`);
  } catch (e) {
    console.warn("contar_visita_publica falló:", e?.message || e);
  }
}

// Primer contacto de quien llega a una página pública desde fuera
// (2026-10-09): el botón "Empieza gratis" de /mareas, /spots y /especies
// lleva a /login?alta=1; aquí se le añaden la fuente y el tipo de página
// como UTM para que login.html sepa de dónde vino (si no, solo vería que
// llega desde costaviva.org). Solo valores de las listas cerradas. La
// respuesta pasa a "private": la copia con UTM no debe guardarse en una
// caché compartida para otra persona.
const MEDIO_DE = {
  google: "organico", bing: "organico", duckduckgo: "organico", ecosia: "organico", yahoo: "organico",
  instagram: "social", facebook: "social", whatsapp: "social", telegram: "social", x: "social",
  email: "email", referido: "referido", invitacion: "email",
};
export function hrefConOrigen(href, visita) {
  if (!visita || !href || !href.startsWith("/login?alta=1")) return href;
  if (visita.p_fuente === "directo" || !["mareas", "spots", "especies"].includes(visita.p_pagina)) return href;
  if (/[?&]utm_source=/.test(href)) return href;
  const medio = MEDIO_DE[visita.p_fuente] || "otro";
  const campana = visita.p_campana || `web-${visita.p_pagina}`;
  return `${href}&utm_source=${visita.p_fuente}&utm_medium=${medio}&utm_campaign=${campana}`;
}

export function conOrigenEnCta(respuesta, visita, Rewriter) {
  if (!visita || visita.p_fuente === "directo" || !["mareas", "spots", "especies"].includes(visita.p_pagina)) return respuesta;
  const reescrita = new Rewriter()
    .on('a[href^="/login?alta=1"]', {
      element(el) { el.setAttribute("href", hrefConOrigen(el.getAttribute("href"), visita)); },
    })
    .transform(respuesta);
  const headers = new Headers(reescrita.headers);
  const cc = headers.get("cache-control");
  if (cc) headers.set("cache-control", cc.replace(/\bpublic\b/, "private"));
  return new Response(reescrita.body, { status: reescrita.status, statusText: reescrita.statusText, headers });
}
