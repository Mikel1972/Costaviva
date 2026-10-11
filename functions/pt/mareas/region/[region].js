// functions/pt/mareas/region/[region].js — marés de hoje em Portugal
// (/pt/mareas/region/portugal). Las demás regiones no tienen versión en pt.
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../../_lib/seo/base.js";
import { paginaRegionMareasPt } from "../../../_lib/seo/paginas-pt.js";

export async function onRequestGet(context) {
  if (context.params.region !== "portugal") return pagina404({ que: "página", volver: "/pt/mareas/region/portugal", volverTexto: "Ver as marés de Portugal" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    return { html: paginaRegionMareasPt(datos?.spots || []).html, ttl: datos ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
