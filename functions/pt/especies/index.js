// functions/pt/especies/index.js — índice de especies en portugués (/pt/especies).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceEspeciesPt } from "../../_lib/seo/paginas-pt.js";
import { cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const barra = sinBarraFinal(context.request);
  if (barra) return barra;
  return conCache(context, async () => ({ html: paginaIndiceEspeciesPt(await cargarEspecies(context), mesMadrid()).html }));
}
