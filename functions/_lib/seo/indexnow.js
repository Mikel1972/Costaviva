// functions/_lib/seo/indexnow.js
// IndexNow (2026-10-08, pedido de Mikel: "móntalo"). Avisa a Bing, Yandex,
// Seznam, Naver y Yep (los buscadores que comparten IndexNow; Google no lo
// usa) de qué URLs públicas han cambiado, para que las rastreen antes.
// Protocolo: https://www.indexnow.org/documentation. Gratis, sin cuenta y sin
// IA: un POST con la lista de URLs a https://api.indexnow.org/indexnow.
//
// La "clave" no es secreta: el buscador comprueba que el dominio es nuestro
// leyendo https://costaviva.org/<clave>.txt, que debe contener la clave.
// El fichero está en la raíz del repo y en la lista blanca
// (functions/_lib/rutas-publicas.js). Si se cambia la clave, cambiar a la vez
// el nombre y el contenido del fichero (lo comprueba test/indexnow.test.js).
//
// Lógica pura (sin red ni git): la usa scripts/seo/indexnow.mjs, que corre en
// .github/workflows/indexnow.yml.

export const CLAVE_INDEXNOW = "3ccc16ba30250113574d628e32e874b1";
export const FICHERO_CLAVE = `/${CLAVE_INDEXNOW}.txt`;
export const HOST = "costaviva.org";
export const ORIGEN = `https://${HOST}`;
export const API_INDEXNOW = "https://api.indexnow.org/indexnow";
// Máximo de URLs por petición según el protocolo.
export const MAX_URLS_POR_PETICION = 10000;

// { loc, lastmod } de cada <url> de un sitemap.xml.
export function entradasSitemap(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1]?.trim();
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1]?.trim() || null;
    if (loc) out.push({ loc: loc.replace(/&amp;/g, "&"), lastmod });
  }
  return out;
}

// URLs nuevas o con lastmod distinto entre dos versiones del sitemap.
export function cambiosSitemap(xmlAntes, xmlDespues) {
  const antes = new Map(entradasSitemap(xmlAntes).map((e) => [e.loc, e.lastmod]));
  return entradasSitemap(xmlDespues)
    .filter((e) => !antes.has(e.loc) || antes.get(e.loc) !== e.lastmod)
    .map((e) => e.loc);
}

// Qué páginas públicas cambian cuando cambia cada fichero del repo. Devuelve
// funciones que, de todas las URLs del sitemap, eligen las afectadas.
const ruta = (u) => new URL(u).pathname;
const esSpot = (u) => /^\/spots\/(?!region\/)[^/]+$/.test(ruta(u));
const esMareaSpot = (u) => /^\/mareas\/(?!region\/)[^/]+$/.test(ruta(u));
const empieza = (prefijo) => (u) => ruta(u) === prefijo || ruta(u).startsWith(`${prefijo}/`);
const exacta = (r) => (u) => ruta(u) === r;
const todas = () => true;

const REGLAS = [
  // La clave nueva (primera vez) o la plantilla común: todas las URLs. Los
  // CSS no: un cambio de aspecto no es contenido nuevo para un buscador.
  [(f) => f === FICHERO_CLAVE.slice(1), todas],
  [(f) => f === "functions/_lib/seo/base.js", todas],
  // Lógica y datos de las páginas de pesca.
  [(f) => f.startsWith("functions/spots/") || ["functions/_lib/seo/indice-hoy.js", "functions/_lib/seo/carga.js"].includes(f), empieza("/spots")],
  [(f) => f.startsWith("functions/especies/"), empieza("/especies")],
  [(f) => ["functions/_lib/seo/paginas.js", "functions/_lib/seo/datos.js", "assets/datos/especies.json"].includes(f),
    (u) => empieza("/spots")(u) || empieza("/especies")(u)],
  [(f) => ["assets/datos/tipo-fondo.json", "assets/datos/profundidad-spots.json"].includes(f), empieza("/spots")],
  [(f) => f.startsWith("functions/mareas/"), empieza("/mareas")],
  [(f) => f === "index.html" || f === "login.html", exacta("/")],
  [(f) => f === "privacidad.html", exacta("/privacidad")],
];

// URLs a avisar tras un push: las que el sitemap marca como nuevas o
// cambiadas, más las afectadas por los ficheros tocados. Solo URLs que están
// en el sitemap de después (nunca algo privado o borrado).
export function urlsDeCambios({ ficheros = [], xmlAntes = "", xmlDespues }) {
  const todasUrls = entradasSitemap(xmlDespues).map((e) => e.loc);
  const elegidas = new Set(xmlAntes ? cambiosSitemap(xmlAntes, xmlDespues) : todasUrls);
  for (const f of ficheros) {
    for (const [aplica, filtro] of REGLAS) {
      if (aplica(f)) for (const u of todasUrls) if (filtro(u)) elegidas.add(u);
    }
  }
  return todasUrls.filter((u) => elegidas.has(u));
}

// Una vez al día: las páginas cuyo contenido cambia cada día de verdad, las
// de cada spot (condiciones e índice de hoy) y las de marea de cada spot
// (horas de pleamar y bajamar del día). Ni índices ni especies.
export function urlsCondicionesHoy(xmlSitemap) {
  return entradasSitemap(xmlSitemap).map((e) => e.loc).filter((u) => esSpot(u) || esMareaSpot(u));
}

export function todasLasUrls(xmlSitemap) {
  return entradasSitemap(xmlSitemap).map((e) => e.loc);
}

// Cuerpos JSON para la API (como mucho 10.000 URLs cada uno), solo del host
// propio: IndexNow rechaza (422) una lista con URLs de otro host.
export function peticionesIndexNow(urls) {
  const propias = [...new Set(urls)].filter((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && x.hostname === HOST;
    } catch {
      return false;
    }
  });
  const lotes = [];
  for (let i = 0; i < propias.length; i += MAX_URLS_POR_PETICION) {
    lotes.push({ host: HOST, key: CLAVE_INDEXNOW, keyLocation: `${ORIGEN}${FICHERO_CLAVE}`, urlList: propias.slice(i, i + MAX_URLS_POR_PETICION) });
  }
  return lotes;
}

// Qué significa cada respuesta de la API (tabla de la documentación).
export function interpretarRespuesta(status) {
  const tabla = {
    200: [true, "OK: URLs recibidas"],
    202: [true, "Aceptado: URLs recibidas; la clave se comprobará después"],
    400: [false, "Petición mal formada"],
    403: [false, "Clave no válida: el buscador no encuentra o no reconoce el fichero de la clave"],
    422: [false, "URLs de otro host o clave que no cumple el formato"],
    429: [false, "Demasiadas peticiones (posible spam): bajar la frecuencia"],
  };
  const [ok, texto] = tabla[status] || [status >= 200 && status < 300, `Respuesta inesperada ${status}`];
  return { ok, texto };
}
