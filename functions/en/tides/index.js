// functions/en/tides/index.js — mareas de Nueva Zelanda (/en/tides).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceMareasNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceMareasNZ(SPOTS).html }));
}
