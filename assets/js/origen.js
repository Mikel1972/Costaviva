// assets/js/origen.js
// De dónde llega cada persona que se da de alta (primer contacto) y el
// código de "Invita a un amigo" (2026-10-09, fase de captación).
//
// Privacidad (ver privacidad.html, "Cómo nos conociste"):
//   - Solo se guarda una FUENTE de una lista cerrada (instagram, google...),
//     un medio de otra lista cerrada y un nombre de campaña con un formato
//     fijo (minúsculas, cifras y guiones). Cualquier otra cosa se descarta:
//     un utm_campaign con un email dentro, por ejemplo, no pasa el filtro.
//   - Del "referrer" solo se mira el dominio para clasificarlo; la URL de
//     origen no se guarda nunca.
//   - Se recuerda en este navegador (localStorage, 90 días) hasta que la
//     persona crea la cuenta; entonces viaja como metadato del alta y la
//     base de datos lo copia a public.origen_altas. Sin cookies ni
//     rastreadores de terceros.
//
// Misma lista de fuentes que functions/_lib/visitas.js y que las
// restricciones de la migración 20261009100000 (test/captacion.test.js
// comprueba que coinciden).

export const FUENTES = [
  "instagram", "facebook", "google", "bing", "duckduckgo", "ecosia", "yahoo",
  "whatsapp", "telegram", "x", "email", "referido", "invitacion", "directo", "otro",
];
export const MEDIOS = ["social", "organico", "email", "referido", "directo", "otro"];
export const PAGINAS = ["empieza", "mareas", "spots", "especies", "login", "otra"];

const CLAVE_ORIGEN = "costaviva_origen";
const CLAVE_REF = "costaviva_ref";
const DIAS_VALIDEZ = 90;

// Alias habituales de utm_source -> fuente de la lista.
const ALIAS = {
  ig: "instagram", insta: "instagram", "instagram.com": "instagram",
  fb: "facebook", "facebook.com": "facebook", meta: "facebook",
  wa: "whatsapp", "whatsapp.com": "whatsapp",
  tg: "telegram", twitter: "x", "t.co": "x",
  newsletter: "email", correo: "email", mail: "email",
  amigo: "referido", ref: "referido",
};

export function normalizarFuente(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return null;
  const f = ALIAS[t] || t;
  return FUENTES.includes(f) ? f : "otro";
}

export function normalizarMedio(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "organic" || t === "seo") return "organico";
  if (t === "social-media" || t === "rrss" || t === "redes") return "social";
  return MEDIOS.includes(t) ? t : "otro";
}

// Campaña: minúsculas, cifras, guion y guion bajo; hasta 60. Nada de "@",
// puntos ni espacios: así no puede colarse un email ni un nombre propio.
export function normalizarCampana(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(t) ? t : null;
}

// Dominio del referrer -> fuente (y medio). Mismo dominio o vacío = null.
export function fuenteDeReferrer(referrer, hostPropio = "costaviva.org") {
  let host;
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return null; }
  if (!host || host === hostPropio || host.endsWith(`.${hostPropio}`) || host.endsWith(".pages.dev")) return null;
  const es = (d) => host === d || host.endsWith(`.${d}`);
  if (es("instagram.com")) return { fuente: "instagram", medio: "social" };
  if (es("facebook.com") || es("fb.com") || es("messenger.com")) return { fuente: "facebook", medio: "social" };
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return { fuente: "google", medio: "organico" };
  if (es("bing.com")) return { fuente: "bing", medio: "organico" };
  if (es("duckduckgo.com")) return { fuente: "duckduckgo", medio: "organico" };
  if (es("ecosia.org")) return { fuente: "ecosia", medio: "organico" };
  if (es("yahoo.com") || /(^|\.)yahoo\.[a-z.]+$/.test(host)) return { fuente: "yahoo", medio: "organico" };
  if (es("whatsapp.com") || es("wa.me")) return { fuente: "whatsapp", medio: "social" };
  if (es("t.me") || es("telegram.org")) return { fuente: "telegram", medio: "social" };
  if (es("t.co") || es("x.com") || es("twitter.com")) return { fuente: "x", medio: "social" };
  return { fuente: "otro", medio: "otro" };
}

// Página pública -> tipo de la lista (para saber por dónde entró).
export function tipoDePagina(pathname) {
  const p = String(pathname || "");
  if (p === "/empieza" || p === "/empieza.html") return "empieza";
  if (p === "/login" || p === "/login.html") return "login";
  for (const t of ["mareas", "spots", "especies"]) if (p === `/${t}` || p.startsWith(`/${t}/`)) return t;
  return "otra";
}

// Código de "Invita a un amigo": 8 caracteres sin I, O, 0 ni 1.
export function normalizarRef(texto) {
  const t = String(texto ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{8}$/.test(t) ? t : null;
}

// Origen de ESTA visita: UTM si hay; si no, el referrer; si no, null
// (entrada directa: no pisa nada). Con ?ref= válido, la fuente es "referido".
export function origenDeVisita({ search = "", referrer = "", pathname = "/", hostPropio = "costaviva.org" } = {}) {
  const q = new URLSearchParams(search);
  const pagina = tipoDePagina(pathname);
  if (normalizarRef(q.get("ref"))) {
    return { fuente: "referido", medio: "referido", campana: normalizarCampana(q.get("utm_campaign")) || "amigo", pagina };
  }
  const fuente = normalizarFuente(q.get("utm_source"));
  if (fuente) {
    return { fuente, medio: normalizarMedio(q.get("utm_medium")), campana: normalizarCampana(q.get("utm_campaign")), pagina };
  }
  const r = fuenteDeReferrer(referrer, hostPropio);
  return r ? { ...r, campana: null, pagina } : null;
}

// Limpia un objeto de origen (lo que se guarda o se manda): solo claves y
// valores de las listas. Devuelve null si no queda una fuente válida.
export function limpiarOrigen(o) {
  if (!o || typeof o !== "object") return null;
  const fuente = FUENTES.includes(o.fuente) ? o.fuente : null;
  if (!fuente) return null;
  return {
    fuente,
    medio: MEDIOS.includes(o.medio) ? o.medio : null,
    campana: normalizarCampana(o.campana),
    pagina: PAGINAS.includes(o.pagina) ? o.pagina : null,
  };
}

// ---------------------------------------------------------------------------
// Almacenamiento: localStorage puede faltar o lanzar (modo privado); nunca
// rompe nada. Primer contacto: si ya hay uno vigente, no se pisa.
function almacen() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function guardarPrimerContacto(origen, ahora = Date.now(), ls = almacen()) {
  const limpio = limpiarOrigen(origen);
  if (!limpio || !ls) return false;
  try {
    const previo = JSON.parse(ls.getItem(CLAVE_ORIGEN) || "null");
    if (previo && ahora - Number(previo.t) < DIAS_VALIDEZ * 86400000) return false;
    ls.setItem(CLAVE_ORIGEN, JSON.stringify({ ...limpio, t: ahora }));
    return true;
  } catch { return false; }
}

export function leerPrimerContacto(ahora = Date.now(), ls = almacen()) {
  if (!ls) return null;
  try {
    const o = JSON.parse(ls.getItem(CLAVE_ORIGEN) || "null");
    if (!o || ahora - Number(o.t) >= DIAS_VALIDEZ * 86400000) return null;
    return limpiarOrigen(o);
  } catch { return null; }
}

export function guardarRef(codigo, ls = almacen()) {
  const c = normalizarRef(codigo);
  if (!c || !ls) return;
  try { ls.setItem(CLAVE_REF, JSON.stringify({ c, t: Date.now() })); } catch { /* sin almacenamiento */ }
}

export function leerRef(ahora = Date.now(), ls = almacen()) {
  if (!ls) return null;
  try {
    const o = JSON.parse(ls.getItem(CLAVE_REF) || "null");
    if (!o || ahora - Number(o.t) >= DIAS_VALIDEZ * 86400000) return null;
    return normalizarRef(o.c);
  } catch { return null; }
}

// Para llamar al cargar una página pública: apunta el primer contacto y el
// código de amigo si vienen en la URL.
export function capturarOrigen(loc = globalThis.location, doc = globalThis.document) {
  try {
    const q = new URLSearchParams(loc.search);
    const ref = normalizarRef(q.get("ref"));
    if (ref) guardarRef(ref);
    const o = origenDeVisita({ search: loc.search, referrer: doc?.referrer || "", pathname: loc.pathname, hostPropio: loc.hostname });
    if (o) guardarPrimerContacto(o);
  } catch { /* nunca rompe la página */ }
}
