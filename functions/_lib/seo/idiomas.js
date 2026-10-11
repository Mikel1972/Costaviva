// functions/_lib/seo/idiomas.js
// Mecanismo de idiomas de las páginas públicas (2026-10-09, base para Nueva
// Zelanda en inglés). ENCENDIDO desde el lanzamiento de NZ (2026-10-11):
// las páginas de Nueva Zelanda viven SOLO en inglés bajo /en/ (spots, tides,
// species y sus regiones; functions/en/**, paginas-en.js) con su hreflang
// "en" + x-default. Las de España siguen solo en español, sin hreflang, con
// las mismas canónicas: su HTML no cambia.
//
// Si un día hay versión inglesa de una página de España: documento({ ...,
// idioma: "en", alternos: ["es", "en"] }) pone <html lang="en">, og:locale
// en_NZ, canónica /en/... y los hreflang es, en y x-default (español) en las
// dos versiones; el sitemap tendría que llevar las dos URL.
export const PUBLICAR_EN = true;

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
// Páginas solo en inglés (las de Nueva Zelanda, alternos ["en"]): su propio
// hreflang "en" y x-default a la misma URL /en/. Las de España (solo "es")
// siguen sin ningún hreflang: su HTML no cambia.
export function enlacesHreflang(ruta, dominio, alternos = ["es"], { forzar = false } = {}) {
  const lista = (PUBLICAR_EN || forzar) ? alternos.filter((i) => IDIOMAS_SEO[i]) : ["es"];
  const soloIngles = lista.length === 1 && lista[0] === "en";
  if (lista.length < 2 && !soloIngles) return "";
  const lineas = lista.map((i) => `<link rel="alternate" hreflang="${IDIOMAS_SEO[i].hreflang}" href="${dominio}${rutaIdioma(ruta, i)}">`);
  const porDefecto = lista.includes("es") ? "es" : lista[0];
  lineas.push(`<link rel="alternate" hreflang="x-default" href="${dominio}${rutaIdioma(ruta, porDefecto)}">`);
  return lineas.join("\n");
}
