// functions/en/tides/[slug].js — mareas de LINZ de un spot de NZ, en inglés
// (/en/tides/<slug>). Ver functions/_lib/seo/paginas-en.js.
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../../_lib/seo/base.js";
import { paginaMareaNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS, spotNZ, datosMareaNZ } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  const spot = spotNZ(String(context.params.slug || ""));
  if (!spot) return pagina404({ que: "página de mareas", volver: "/en/tides", volverTexto: "See all New Zealand tides" });
  return conCache(context, async () => {
    const d = await datosMareaNZ(context, spot);
    return { html: paginaMareaNZ(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
