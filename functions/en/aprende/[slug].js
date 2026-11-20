// functions/en/aprende/[slug].js — ficha de formación en inglés (/en/aprende/<ficha>).
import { conCache, html404, cargarJson, huella } from "../../_lib/seo/base.js";
import { paginaFicha } from "../../_lib/seo/paginas-formacion.js";
import { CSS_PUBLICO as ESTILOS } from "../../_lib/seo/estilos.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const datos = await cargarJson(context, "/assets/datos/formacion.en.json");
  return conCache(context, async () => {
    const f = datos.fichas.find((x) => x.id === slug);
    if (!f) return html404({ que: "ficha", volver: "/en/aprende", volverTexto: "See all the guides" });
    return { html: paginaFicha(datos, f, "en").html };
  }, huella([datos, ESTILOS]));
}
