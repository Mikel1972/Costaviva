// functions/aprende/[slug].js — ficha del centro de formación (/aprende/<ficha>).
import { conCache, html404, cargarJson } from "../_lib/seo/base.js";
import { paginaFicha } from "../_lib/seo/paginas-formacion.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  return conCache(context, async () => {
    const datos = await cargarJson(context, "/assets/datos/formacion.json");
    const f = datos.fichas.find((x) => x.id === slug);
    if (!f) return html404({ que: "ficha", volver: "/aprende", volverTexto: "Ver el centro de formación" });
    return { html: paginaFicha(datos, f).html };
  });
}
