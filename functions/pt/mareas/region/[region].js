// functions/pt/mareas/region/[region].js — marés de hoje de uma zona
// (/pt/mareas/region/<região>; paginas-ib.js).
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../../_lib/seo/base.js";
import { IB, regionIb } from "../../../_lib/seo/paginas-ib.js";
import { zonaMareasNZRespuesta } from "../../../_lib/seo/rutas-nz.js";

export async function onRequestGet(context) {
  const region = String(context.params.region || "");
  const nz = zonaMareasNZRespuesta(context, "pt", region);
  if (nz) return nz;
  if (!regionIb(region)) return pagina404({ que: "página", volver: "/pt/mareas", volverTexto: "Ver as marés" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    return { html: IB.pt.paginaRegionMareas(region, datos?.spots || []).html, ttl: datos ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
