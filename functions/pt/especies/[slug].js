// functions/pt/especies/[slug].js — ficha de una especie en portugués
// (/pt/especies/<slug>; paginas-pt.js).
import { conCache, html404 } from "../../_lib/seo/base.js";
import { paginaEspeciePt } from "../../_lib/seo/paginas-pt.js";
import { idDeSlugEspecie } from "../../_lib/seo/datos.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  if (slug.includes("_")) {
    const url = new URL(context.request.url);
    url.pathname = `/pt/especies/${slug.replace(/_/g, "-")}`;
    return Response.redirect(url.toString(), 301);
  }
  return conCache(context, async () => {
    const especiesDatos = await cargarEspecies(context);
    const e = especiesDatos.especies.find((x) => x.id === idDeSlugEspecie(slug));
    if (!e) return html404({ que: "página", volver: "/pt/especies", volverTexto: "Ver todas as espécies" });
    return { html: paginaEspeciePt(e, especiesDatos, SPOTS, mesMadrid()).html };
  });
}
