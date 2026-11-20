// functions/pt/spots/index.js — pesqueiros de Portugal e Espanha por zonas (/pt/spots).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { SPOTS } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: IB.pt.paginaIndice("spots", SPOTS).html }));
}
