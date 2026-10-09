// functions/_lib/seo/sitemap.js
// URLs públicas e indexables del sitio, para sitemap.xml (lo escribe
// scripts/seo/generar-sitemap.mjs; lógica pura con test).
import { DOMINIO } from "./base.js";
import { REGIONES_MAREAS, slugEspecie, fechaDatos } from "./datos.js";
import { especiesVisibles } from "../regiones-activas.js";

// Fecha de la última revisión de la portada, privacidad y las páginas de
// mareas (su contenido de datos cambia cada hora, la plantilla no).
export const FECHA_PAGINAS_FIJAS = "2026-10-08";

export function urlsSitemap({ spots, especies, tipoFondo, profundidad }) {
  const fEsp = fechaDatos(especies?.version) || FECHA_PAGINAS_FIJAS;
  const fSpot = fechaDatos(especies?.version, tipoFondo?.generado, profundidad?.generado, FECHA_PAGINAS_FIJAS);
  const u = (ruta, lastmod, changefreq, priority) => ({ loc: `${DOMINIO}${ruta}`, lastmod, changefreq, priority });
  const ordenados = [...spots].sort((a, b) => a.slug.localeCompare(b.slug));
  return [
    u("/", FECHA_PAGINAS_FIJAS, "weekly", "1.0"),
    u("/spots", fSpot, "daily", "0.9"),
    u("/especies", fEsp, "weekly", "0.9"),
    u("/mareas", FECHA_PAGINAS_FIJAS, "daily", "0.8"),
    ...REGIONES_MAREAS.map((r) => u(`/spots/region/${r.slug}`, fSpot, "daily", "0.8")),
    ...REGIONES_MAREAS.map((r) => u(`/mareas/region/${r.slug}`, FECHA_PAGINAS_FIJAS, "daily", "0.75")),
    ...ordenados.map((s) => u(`/spots/${s.slug}`, fSpot, "daily", "0.7")),
    ...ordenados.map((s) => u(`/mareas/${s.slug}`, FECHA_PAGINAS_FIJAS, "hourly", "0.7")),
    ...[...especiesVisibles(especies.especies)].sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(`/especies/${slugEspecie(e.id)}`, fEsp, "monthly", "0.7")),
    u("/privacidad", FECHA_PAGINAS_FIJAS, "yearly", "0.2"),
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
