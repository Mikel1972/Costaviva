// functions/pt/especies/index.js — índice de especies en portugués (/pt/especies).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { SPOTS, cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";
import { cargarEspeciesNZ } from "../../_lib/seo/carga-en.js";
import { NZ } from "../../_lib/seo/paginas-nz.js";

// Con Nueva Zelanda también (2026-11-20, espejo de idiomas).
const conNZ = (html, nz) => html.replace('<section class="cta"', `${NZ.pt.seccionNZ("especies", SPOTS, nz)}\n<section class="cta"`);

export async function onRequestGet(context) {
  const barra = sinBarraFinal(context.request);
  if (barra) return barra;
  return conCache(context, async () => ({ html: conNZ(IB.pt.paginaIndiceEspecies(await cargarEspecies(context), mesMadrid()).html, await cargarEspeciesNZ(context)) }));
}
