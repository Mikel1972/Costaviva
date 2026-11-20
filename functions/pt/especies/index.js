// functions/pt/especies/index.js — índice de especies en portugués (/pt/especies).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const barra = sinBarraFinal(context.request);
  if (barra) return barra;
  return conCache(context, async () => ({ html: IB.pt.paginaIndiceEspecies(await cargarEspecies(context), mesMadrid()).html }));
}
