// functions/pt/mareas/[slug].js — maré de hoje de um pesqueiro de Portugal ou
// Espanha, em português (/pt/mareas/<slug>; datos de /prevision).
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { IB, esSpotIberia } from "../../_lib/seo/paginas-ib.js";
import { mareaNZRespuesta } from "../../_lib/seo/rutas-nz.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const nz = mareaNZRespuesta(context, "pt", slug);
  if (nz) return nz;
  if (!esSpotIberia(slug)) return pagina404({ que: "página", volver: "/pt/mareas", volverTexto: "Ver as marés" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    const sp = datos?.spots?.find((s) => s.slug === slug && !s.error);
    if (!sp) return { html: IB.pt.paginaMarea({ ...((datos?.spots || []).find((s) => s.slug === slug) || { slug, nombre: slug }), bloques: [], marea: null }, datos?.spots || []).html, ttl: TTL_SIN_DATOS_S };
    return { html: IB.pt.paginaMarea(sp, datos.spots).html, ttl: TTL_CON_DATOS_S };
  });
}
