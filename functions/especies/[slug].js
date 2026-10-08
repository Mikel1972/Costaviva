// functions/especies/[slug].js — ficha pública de una especie (/especies/<slug>,
// p. ej. /especies/bonito-norte). Solo texto para el usuario: nada de notas
// internas del JSON (ver functions/_lib/seo/datos.js).
import { conCache, html404 } from "../_lib/seo/base.js";
import { paginaEspecie } from "../_lib/seo/paginas.js";
import { idDeSlugEspecie } from "../_lib/seo/datos.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  // Las URLs van con guion; un id con guion bajo redirige a la buena.
  if (slug.includes("_")) {
    const url = new URL(context.request.url);
    url.pathname = `/especies/${slug.replace(/_/g, "-")}`;
    return Response.redirect(url.toString(), 301);
  }
  return conCache(context, async () => {
    const especiesDatos = await cargarEspecies(context);
    const e = especiesDatos.especies.find((x) => x.id === idDeSlugEspecie(slug));
    if (!e) return html404({ que: "especie", volver: "/especies", volverTexto: "Ver todas las especies" });
    return { html: paginaEspecie(e, especiesDatos, SPOTS, mesMadrid()).html };
  });
}
