// functions/aprende/index.js — centro de formación (/aprende), 2026-11-20.
import { conCache, sinBarraFinal, cargarJson, huella } from "../_lib/seo/base.js";
import { paginaIndiceFormacion } from "../_lib/seo/paginas-formacion.js";
import { CSS_PUBLICO as ESTILOS } from "../_lib/seo/estilos.js";

// La clave de caché lleva la huella de formacion.json y de los estilos: al
// publicar fichas nuevas, el índice cambia al momento.
export async function onRequestGet(context) {
  const r = sinBarraFinal(context.request);
  if (r) return r;
  const datos = await cargarJson(context, "/assets/datos/formacion.json");
  return conCache(context, async () => ({ html: paginaIndiceFormacion(datos).html }), huella([datos, ESTILOS]));
}
