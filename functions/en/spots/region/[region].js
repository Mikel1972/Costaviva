// functions/en/spots/region/[region].js — spots de una zona de NZ
// (/en/spots/region/<zona>, zonas de functions/_lib/nz/zonas-nz.js).
import { conCache, pagina404 } from "../../../_lib/seo/base.js";
import { paginaZonaSpotsNZ } from "../../../_lib/seo/paginas-en.js";
import { zonaPorSlug } from "../../../_lib/nz/zonas-nz.js";
import { SPOTS, cargarEspeciesNZ, mesNZ } from "../../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  const zona = zonaPorSlug(String(context.params.region || ""));
  if (!zona) return pagina404({ que: "región", volver: "/en/spots", volverTexto: "See all New Zealand spots" });
  return conCache(context, async () => ({ html: paginaZonaSpotsNZ(zona, SPOTS, await cargarEspeciesNZ(context), mesNZ()).html }));
}
