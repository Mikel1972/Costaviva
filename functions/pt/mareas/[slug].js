// functions/pt/mareas/[slug].js — marea de hoy de un spot de Portugal, en
// portugués (/pt/mareas/<slug>; datos de /prevision, como /mareas/<slug>).
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaMareaPt, esSpotPT } from "../../_lib/seo/paginas-pt.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  if (!esSpotPT(slug)) return pagina404({ que: "página", volver: "/pt/mareas/region/portugal", volverTexto: "Ver as marés de Portugal" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    const sp = datos?.spots?.find((s) => s.slug === slug && !s.error);
    if (!sp) {
      return { html: paginaMareaPt({ ...((datos?.spots || []).find((s) => s.slug === slug) || { slug, nombre: slug }), bloques: [], marea: null }, datos?.spots || []).html, ttl: TTL_SIN_DATOS_S };
    }
    return { html: paginaMareaPt(sp, datos.spots).html, ttl: TTL_CON_DATOS_S };
  });
}
