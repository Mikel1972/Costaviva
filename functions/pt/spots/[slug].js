// functions/pt/spots/[slug].js — pesca en un spot de Portugal, en portugués
// (/pt/spots/<slug>; paginas-pt.js). Solo los spots de la región Portugal.
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaSpotPt, esSpotPT } from "../../_lib/seo/paginas-pt.js";
import { SPOTS, datosPaginaSpot } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const spot = esSpotPT(slug) ? SPOTS.find((s) => s.slug === slug) : null;
  if (!spot) return pagina404({ que: "página", volver: "/pt/spots/region/portugal", volverTexto: "Ver os pesqueiros de Portugal" });
  return conCache(context, async () => {
    const d = await datosPaginaSpot(context, spot);
    return { html: paginaSpotPt(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
