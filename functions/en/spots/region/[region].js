// functions/en/spots/region/[region].js — spots de una zona, en inglés: zonas
// de Nueva Zelanda (paginas-en.js) o regiones de España y Portugal (paginas-ib.js).
import { conCache, pagina404 } from "../../../_lib/seo/base.js";
import { paginaZonaSpotsNZ } from "../../../_lib/seo/paginas-en.js";
import { zonaPorSlug } from "../../../_lib/nz/zonas-nz.js";
import { SPOTS, cargarEspeciesNZ, mesNZ } from "../../../_lib/seo/carga-en.js";
import { IB, regionIb } from "../../../_lib/seo/paginas-ib.js";
import { cargarEspecies, mesMadrid } from "../../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.region || "");
  const zona = zonaPorSlug(slug);
  if (zona) return conCache(context, async () => ({ html: paginaZonaSpotsNZ(zona, SPOTS, await cargarEspeciesNZ(context), mesNZ()).html }));
  if (!regionIb(slug)) return pagina404({ que: "región", volver: "/en/spots", volverTexto: "See all fishing spots" });
  return conCache(context, async () => ({ html: IB.en.paginaRegionSpots(slug, SPOTS, await cargarEspecies(context), mesMadrid()).html }));
}
