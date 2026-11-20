// functions/aprende/index.js — centro de formación (/aprende), 2026-11-20.
import { conCache, sinBarraFinal, cargarJson } from "../_lib/seo/base.js";
import { paginaIndiceFormacion } from "../_lib/seo/paginas-formacion.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceFormacion(await cargarJson(context, "/assets/datos/formacion.json")).html }));
}
