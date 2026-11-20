// functions/en/spots/[slug].js — pesca en un spot, en inglés (/en/spots/<slug>):
// Nueva Zelanda (paginas-en.js) o España y Portugal (paginas-ib.js, desde el
// 2026-11-20 por el espejo de idiomas).
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaSpotNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS, spotNZ, datosSpotNZ } from "../../_lib/seo/carga-en.js";
import { IB, esSpotIberia } from "../../_lib/seo/paginas-ib.js";
import { datosPaginaSpot } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const nz = spotNZ(slug);
  if (nz) {
    return conCache(context, async () => {
      const d = await datosSpotNZ(context, nz);
      return { html: paginaSpotNZ(nz, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
    });
  }
  const spot = esSpotIberia(slug) ? SPOTS.find((s) => s.slug === slug) : null;
  if (!spot) return pagina404({ que: "página de spot", volver: "/en/spots", volverTexto: "See all fishing spots" });
  return conCache(context, async () => {
    const d = await datosPaginaSpot(context, spot);
    return { html: IB.en.paginaSpot(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
