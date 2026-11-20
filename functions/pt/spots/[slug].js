// functions/pt/spots/[slug].js — pesca en un spot de España o Portugal, en
// portugués (/pt/spots/<slug>; paginas-ib.js). Desde el 2026-11-20 todos los
// spots ibéricos (espejo de idiomas).
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { IB, esSpotIberia } from "../../_lib/seo/paginas-ib.js";
import { SPOTS, datosPaginaSpot } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const spot = esSpotIberia(slug) ? SPOTS.find((s) => s.slug === slug) : null;
  if (!spot) return pagina404({ que: "página", volver: "/pt/spots", volverTexto: "Ver os pesqueiros" });
  return conCache(context, async () => {
    const d = await datosPaginaSpot(context, spot);
    return { html: IB.pt.paginaSpot(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
