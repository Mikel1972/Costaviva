// functions/especies/index.js — índice público de especies (/especies).
import { conCache, sinBarraFinal } from "../_lib/seo/base.js";
import { paginaIndiceEspecies } from "../_lib/seo/paginas.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../_lib/seo/carga.js";
import { cargarEspeciesNZ } from "../_lib/seo/carga-en.js";
import { NZ } from "../_lib/seo/paginas-nz.js";

// Con Nueva Zelanda también (2026-11-20, espejo de idiomas).
const conNZ = (html, nz) => html.replace('<section class="cta"', `${NZ.es.seccionNZ("especies", SPOTS, nz)}\n<section class="cta"`);

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: conNZ(paginaIndiceEspecies(await cargarEspecies(context), mesMadrid()).html, await cargarEspeciesNZ(context)) }));
}
