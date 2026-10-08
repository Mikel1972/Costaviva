// functions/especies/index.js — índice público de especies (/especies).
import { conCache, sinBarraFinal } from "../_lib/seo/base.js";
import { paginaIndiceEspecies } from "../_lib/seo/paginas.js";
import { cargarEspecies, mesMadrid } from "../_lib/seo/carga.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceEspecies(await cargarEspecies(context), mesMadrid()).html }));
}
