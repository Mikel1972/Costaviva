// functions/en/spots/[slug].js — pesca en un spot de Nueva Zelanda, en inglés
// (/en/spots/<slug>). Ver functions/_lib/seo/paginas-en.js.
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaSpotNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS, spotNZ, datosSpotNZ } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  const spot = spotNZ(String(context.params.slug || ""));
  if (!spot) return pagina404({ que: "página de spot", volver: "/en/spots", volverTexto: "See all New Zealand spots" });
  return conCache(context, async () => {
    const d = await datosSpotNZ(context, spot);
    return { html: paginaSpotNZ(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
