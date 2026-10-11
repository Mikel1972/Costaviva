// functions/pt/spots/region/[region].js — pesqueros de Portugal en portugués
// (/pt/spots/region/portugal). Las demás regiones no tienen versión en pt.
import { conCache, pagina404 } from "../../../_lib/seo/base.js";
import { paginaRegionSpotsPt } from "../../../_lib/seo/paginas-pt.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  if (context.params.region !== "portugal") return pagina404({ que: "página", volver: "/pt/spots/region/portugal", volverTexto: "Ver os pesqueiros de Portugal" });
  return conCache(context, async () => {
    const especiesDatos = await cargarEspecies(context);
    return { html: paginaRegionSpotsPt(SPOTS, especiesDatos, mesMadrid()).html };
  });
}
