// functions/_lib/seo/idiomas.js
// Mecanismo de idiomas de las páginas públicas (2026-10-09, base para Nueva
// Zelanda en inglés). PREPARADO PERO APAGADO: con PUBLICAR_EN = false no se
// publica ninguna ruta /en/..., no se añade ningún hreflang y documento()
// (base.js) genera exactamente el mismo HTML que antes. Ni el sitemap ni las
// canónicas cambian.
//
// Cómo se activará (cuando haya datos y textos de NZ):
//   1. Rutas: functions/en/[[ruta]].js que llame a idiomaDeRuta(pathname) y
//      pinte la misma página con idioma "en" (los textos fijos de las páginas
//      públicas, a assets/i18n con I18n.t(clave, vars, "en"); los datos por
//      idioma con I18n.dato / I18n.nombre). Añadir "/en/" a
//      PREFIJOS_PUBLICOS de functions/_lib/rutas-publicas.js.
//   2. documento({ ..., idioma: "en", alternos: ["es", "en"] }): <html
//      lang="en">, og:locale en_NZ, canónica /en/... y los hreflang es, en y
//      x-default (español) en las DOS versiones.
//   3. PUBLICAR_EN = true y el sitemap (functions/_lib/seo/sitemap.js) con las
//      URL /en/ y sus xhtml:link alternate.
//   4. Comprobar en Search Console que Google ve las dos versiones.
export const PUBLICAR_EN = false;

export const IDIOMAS_SEO = {
  es: { prefijo: "", lang: "es", hreflang: "es", ogLocale: "es_ES" },
  en: { prefijo: "/en", lang: "en", hreflang: "en", ogLocale: "en_NZ" },
};

// "/spots/bakio" -> "/en/spots/bakio" (y "/" -> "/en/").
export function rutaIdioma(ruta, idioma = "es") {
  const p = IDIOMAS_SEO[idioma]?.prefijo ?? "";
  if (!p) return ruta;
  return ruta === "/" ? `${p}/` : `${p}${ruta}`;
}

// "/en/spots/bakio" -> { idioma: "en", ruta: "/spots/bakio" }.
export function idiomaDeRuta(pathname) {
  const m = /^\/en(\/.*)?$/.exec(pathname || "");
  if (m) return { idioma: "en", ruta: m[1] || "/" };
  return { idioma: "es", ruta: pathname || "/" };
}

// <link rel="alternate" hreflang> de una ruta canónica (sin idioma). Vacío
// mientras solo haya español (o PUBLICAR_EN sea false): sin cambios en el HTML.
export function enlacesHreflang(ruta, dominio, alternos = ["es"], { forzar = false } = {}) {
  const lista = (PUBLICAR_EN || forzar) ? alternos.filter((i) => IDIOMAS_SEO[i]) : ["es"];
  if (lista.length < 2) return "";
  const lineas = lista.map((i) => `<link rel="alternate" hreflang="${IDIOMAS_SEO[i].hreflang}" href="${dominio}${rutaIdioma(ruta, i)}">`);
  lineas.push(`<link rel="alternate" hreflang="x-default" href="${dominio}${ruta}">`);
  return lineas.join("\n");
}
