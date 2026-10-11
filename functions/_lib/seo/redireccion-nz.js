// functions/_lib/seo/redireccion-nz.js
// Las páginas de Nueva Zelanda viven en inglés bajo /en/ (2026-10-11): si
// alguien pide la ruta española de un spot o una especie de NZ
// (/spots/nz-leigh, /mareas/nz-leigh, /especies/nz-snapper), 301 a la buena.
// Solo slugs "nz-": a una URL de España no le pasa nada.
const DESTINO = { spots: "/en/spots/", mareas: "/en/tides/", especies: "/en/species/" };

export function redireccionNZ(request, seccion, slug) {
  if (!/^nz-[a-z0-9-]+$/.test(String(slug || ""))) return null;
  const url = new URL(request.url);
  url.pathname = `${DESTINO[seccion]}${slug}`;
  url.search = "";
  return Response.redirect(url.toString(), 301);
}
