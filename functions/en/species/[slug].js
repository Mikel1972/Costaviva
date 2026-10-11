// functions/en/species/[slug].js — ficha de una especie de NZ en inglés
// (/en/species/<slug>, p. ej. /en/species/nz-snapper).
import { conCache, html404 } from "../../_lib/seo/base.js";
import { paginaEspecieNZ } from "../../_lib/seo/paginas-en.js";
import { idDeSlugEspecie } from "../../_lib/seo/datos.js";
import { SPOTS, cargarEspeciesNZ, mesNZ } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  return conCache(context, async () => {
    const datos = await cargarEspeciesNZ(context);
    const e = datos.especies.find((x) => x.id === slug || x.id === idDeSlugEspecie(slug));
    if (!e) return html404({ que: "especie", volver: "/en/species", volverTexto: "See all New Zealand species" });
    return { html: paginaEspecieNZ(e, datos, SPOTS, mesNZ()).html };
  });
}
