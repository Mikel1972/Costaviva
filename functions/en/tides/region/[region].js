// functions/en/tides/region/[region].js — mareas de una zona de NZ.
import { conCache, pagina404 } from "../../../_lib/seo/base.js";
import { paginaZonaMareasNZ } from "../../../_lib/seo/paginas-en.js";
import { zonaPorSlug } from "../../../_lib/nz/zonas-nz.js";
import { SPOTS } from "../../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  const zona = zonaPorSlug(String(context.params.region || ""));
  if (!zona) return pagina404({ que: "región", volver: "/en/tides", volverTexto: "See all New Zealand tides" });
  return conCache(context, async () => ({ html: paginaZonaMareasNZ(zona, SPOTS).html }));
}
