// functions/en/aprende/index.js — centro de formación en inglés (/en/aprende), 2026-11-20.
import { conCache, sinBarraFinal, cargarJson, huella } from "../../_lib/seo/base.js";
import { paginaIndiceFormacion } from "../../_lib/seo/paginas-formacion.js";
import { CSS_PUBLICO as ESTILOS } from "../../_lib/seo/estilos.js";

export async function onRequestGet(context) {
  const r = sinBarraFinal(context.request);
  if (r) return r;
  const datos = await cargarJson(context, "/assets/datos/formacion.en.json");
  return conCache(context, async () => ({ html: paginaIndiceFormacion(datos, "en").html }), huella([datos, ESTILOS]));
}
