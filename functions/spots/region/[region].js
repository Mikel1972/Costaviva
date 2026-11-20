// functions/spots/region/[region].js — spots de una región (/spots/region/<region>),
// las mismas regiones que /mareas/region/<region>.
import { conCache, pagina404 } from "../../_lib/seo/base.js";
import { paginaRegionSpots } from "../../_lib/seo/paginas.js";
import { REGIONES_MAREAS } from "../../_lib/seo/datos.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";
import { zonaSpotsNZRespuesta } from "../../_lib/seo/rutas-nz.js";

export async function onRequestGet(context) {
  // Zonas de Nueva Zelanda, en español (espejo de idiomas, 2026-11-20).
  const nz = zonaSpotsNZRespuesta(context, "es", String(context.params.region || ""));
  if (nz) return nz;
  const region = REGIONES_MAREAS.find((r) => r.slug === context.params.region);
  if (!region) return pagina404({ que: "región", volver: "/spots", volverTexto: "Ver todos los spots" });
  return conCache(context, async () => {
    const especiesDatos = await cargarEspecies(context);
    return { html: paginaRegionSpots(region, SPOTS, especiesDatos, mesMadrid()).html };
  });
}
