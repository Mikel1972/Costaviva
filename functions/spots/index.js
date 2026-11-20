// functions/spots/index.js — índice público de spots (/spots).
import { conCache, sinBarraFinal } from "../_lib/seo/base.js";
import { paginaIndiceSpots } from "../_lib/seo/paginas.js";
import { SPOTS } from "../_lib/seo/carga.js";
import { NZ } from "../_lib/seo/paginas-nz.js";

// Con Nueva Zelanda también (2026-11-20, espejo de idiomas).
const conNZ = (html) => html.replace('<section class="cta"', `${NZ.es.seccionNZ("spots", SPOTS)}\n<section class="cta"`);

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: conNZ(paginaIndiceSpots(SPOTS).html) }));
}
