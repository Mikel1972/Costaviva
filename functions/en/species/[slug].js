// functions/en/species/[slug].js — ficha de una especie, en inglés: de Nueva
// Zelanda (paginas-en.js) o de España y Portugal (paginas-ib.js, 2026-11-20).
import { conCache, html404 } from "../../_lib/seo/base.js";
import { paginaEspecieNZ } from "../../_lib/seo/paginas-en.js";
import { idDeSlugEspecie } from "../../_lib/seo/datos.js";
import { SPOTS, cargarEspeciesNZ, mesNZ } from "../../_lib/seo/carga-en.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  return conCache(context, async () => {
    const datos = await cargarEspeciesNZ(context);
    const nz = datos.especies.find((x) => x.id === slug || x.id === idDeSlugEspecie(slug));
    if (nz) return { html: paginaEspecieNZ(nz, datos, SPOTS, mesNZ()).html };
    const todos = await cargarEspecies(context);
    const e = todos.especies.find((x) => !String(x.id).startsWith("nz-") && x.id === idDeSlugEspecie(slug));
    if (!e) return html404({ que: "especie", volver: "/en/species", volverTexto: "See all species" });
    return { html: IB.en.paginaEspecie(e, todos, SPOTS, mesMadrid()).html };
  });
}
