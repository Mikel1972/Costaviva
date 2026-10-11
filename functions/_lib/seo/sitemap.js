// functions/_lib/seo/sitemap.js
// URLs públicas e indexables del sitio, para sitemap.xml (lo escribe
// scripts/seo/generar-sitemap.mjs; lógica pura con test).
import { DOMINIO } from "./base.js";
import { REGIONES_MAREAS, slugEspecie, fechaDatos } from "./datos.js";
import { especiesDePais } from "../regiones-activas.js";
import { urlsEn } from "./paginas-en.js";

// Fecha de la última revisión de la portada, privacidad y las páginas de
// mareas (su contenido de datos cambia cada hora, la plantilla no).
export const FECHA_PAGINAS_FIJAS = "2026-10-08";
// Última revisión de la plantilla de /spots/<spot> (tabla única de especies,
// spots cercanos con distancia) y de /mareas/region/<región> (tabla de
// pleamar, bajamar, ola y viento por spot): 2026-10-11. Cambiarla solo
// cuando cambie el contenido de esas páginas, no su aspecto.
export const FECHA_PLANTILLA_SPOT = "2026-10-11";
export const FECHA_MAREAS_REGION = "2026-10-11";
// Lanzamiento de las páginas de Nueva Zelanda en inglés.
export const FECHA_EN = "2026-10-11";

export function urlsSitemap({ spots, especies, tipoFondo, profundidad }) {
  const fEsp = fechaDatos(especies?.version) || FECHA_PAGINAS_FIJAS;
  const fIndices = fechaDatos(especies?.version, tipoFondo?.generado, profundidad?.generado, FECHA_PAGINAS_FIJAS);
  const fSpot = fechaDatos(fIndices, FECHA_PLANTILLA_SPOT);
  const u = (ruta, lastmod, changefreq, priority) => ({ loc: `${DOMINIO}${ruta}`, lastmod, changefreq, priority });
  // Las páginas en español son solo de España y Portugal; las de Nueva
  // Zelanda van en inglés bajo /en/ (urlsEn, al final).
  const ordenados = spots.filter((s) => s.pais !== "nz").sort((a, b) => a.slug.localeCompare(b.slug));
  return [
    u("/", FECHA_PAGINAS_FIJAS, "weekly", "1.0"),
    u("/spots", fIndices, "daily", "0.9"),
    u("/especies", fEsp, "weekly", "0.9"),
    u("/mareas", FECHA_PAGINAS_FIJAS, "daily", "0.8"),
    ...REGIONES_MAREAS.map((r) => u(`/spots/region/${r.slug}`, fIndices, "daily", "0.8")),
    ...REGIONES_MAREAS.map((r) => u(`/mareas/region/${r.slug}`, FECHA_MAREAS_REGION, "daily", "0.75")),
    ...ordenados.map((s) => u(`/spots/${s.slug}`, fSpot, "daily", "0.7")),
    ...ordenados.map((s) => u(`/mareas/${s.slug}`, FECHA_PAGINAS_FIJAS, "hourly", "0.7")),
    ...[...especiesDePais(especies.especies, "es")].sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(`/especies/${slugEspecie(e.id)}`, fEsp, "monthly", "0.7")),
    u("/privacidad", FECHA_PAGINAS_FIJAS, "yearly", "0.2"),
    ...urlsEn({ spots, especies, fecha: fechaDatos(especies?.version, FECHA_EN) || FECHA_EN }),
  ];
}

export function xmlSitemap(urls) {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((x) => `  <url>
    <loc>${esc(x.loc)}</loc>
    <lastmod>${x.lastmod}</lastmod>
    <changefreq>${x.changefreq}</changefreq>
    <priority>${x.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
}
