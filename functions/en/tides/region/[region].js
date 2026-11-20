// functions/en/tides/region/[region].js — mareas de una zona, en inglés: zonas
// de Nueva Zelanda (paginas-en.js) o regiones de España y Portugal (paginas-ib.js).
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../../_lib/seo/base.js";
import { paginaZonaMareasNZ } from "../../../_lib/seo/paginas-en.js";
import { zonaPorSlug } from "../../../_lib/nz/zonas-nz.js";
import { SPOTS } from "../../../_lib/seo/carga-en.js";
import { IB, regionIb } from "../../../_lib/seo/paginas-ib.js";

export async function onRequestGet(context) {
  const slug = String(context.params.region || "");
  const zona = zonaPorSlug(slug);
  if (zona) return conCache(context, async () => ({ html: paginaZonaMareasNZ(zona, SPOTS).html }));
  if (!regionIb(slug)) return pagina404({ que: "región", volver: "/en/tides", volverTexto: "See all tides" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    return { html: IB.en.paginaRegionMareas(slug, datos?.spots || []).html, ttl: datos ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
