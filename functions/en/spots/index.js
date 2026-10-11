// functions/en/spots/index.js — spots de Nueva Zelanda (/en/spots).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceSpotsNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS } from "../../_lib/seo/carga-en.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceSpotsNZ(SPOTS).html }));
}
