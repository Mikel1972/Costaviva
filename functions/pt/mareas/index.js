// functions/pt/mareas/index.js — marés de hoje em Portugal e Espanha por zonas (/pt/mareas).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { SPOTS } from "../../_lib/seo/carga.js";

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: IB.pt.paginaIndice("mareas", SPOTS).html }));
}
