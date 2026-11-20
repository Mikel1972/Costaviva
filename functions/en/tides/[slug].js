// functions/en/tides/[slug].js — mareas de hoy de un spot, en inglés
// (/en/tides/<slug>): Nueva Zelanda (LINZ, paginas-en.js) o España y Portugal
// (/prevision, paginas-ib.js, desde el 2026-11-20).
import { conCache, pagina404, pedirConLimite, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaMareaNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS, spotNZ, datosMareaNZ } from "../../_lib/seo/carga-en.js";
import { IB, esSpotIberia } from "../../_lib/seo/paginas-ib.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const nz = spotNZ(slug);
  if (nz) {
    return conCache(context, async () => {
      const d = await datosMareaNZ(context, nz);
      return { html: paginaMareaNZ(nz, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
    });
  }
  if (!esSpotIberia(slug)) return pagina404({ que: "página de mareas", volver: "/en/tides", volverTexto: "See all tides" });
  return conCache(context, async () => {
    const datos = await pedirConLimite(new URL("/prevision", context.request.url).toString(), 8000, context);
    const sp = datos?.spots?.find((s) => s.slug === slug && !s.error);
    if (!sp) return { html: IB.en.paginaMarea({ ...((datos?.spots || []).find((s) => s.slug === slug) || { slug, nombre: slug }), bloques: [], marea: null }, datos?.spots || []).html, ttl: TTL_SIN_DATOS_S };
    return { html: IB.en.paginaMarea(sp, datos.spots).html, ttl: TTL_CON_DATOS_S };
  });
}
