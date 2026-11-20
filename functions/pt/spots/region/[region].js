// functions/pt/spots/region/[region].js — pesqueiros de uma zona de Portugal
// ou Espanha (/pt/spots/region/<região>; paginas-ib.js).
import { conCache, pagina404 } from "../../../_lib/seo/base.js";
import { IB, regionIb } from "../../../_lib/seo/paginas-ib.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../../../_lib/seo/carga.js";
import { zonaSpotsNZRespuesta } from "../../../_lib/seo/rutas-nz.js";

export async function onRequestGet(context) {
  const region = String(context.params.region || "");
  const nz = zonaSpotsNZRespuesta(context, "pt", region);
  if (nz) return nz;
  if (!regionIb(region)) return pagina404({ que: "página", volver: "/pt/spots", volverTexto: "Ver os pesqueiros" });
  return conCache(context, async () => {
    const especiesDatos = await cargarEspecies(context);
    return { html: IB.pt.paginaRegionSpots(region, SPOTS, especiesDatos, mesMadrid()).html };
  });
}
