// functions/spots/index.js — índice público de spots (/spots).
import { conCache, sinBarraFinal } from "../_lib/seo/base.js";
import { paginaIndiceSpots } from "../_lib/seo/paginas.js";
import { SPOTS } from "../_lib/seo/carga.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceSpots(SPOTS).html }));
}
