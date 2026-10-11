// functions/en/species/index.js — especies de Nueva Zelanda (/en/species).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceEspeciesNZ } from "../../_lib/seo/paginas-en.js";
import { cargarEspeciesNZ, mesNZ } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceEspeciesNZ(await cargarEspeciesNZ(context), mesNZ()).html }));
}
