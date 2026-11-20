// functions/pt/spots/index.js — pesqueiros de Portugal e Espanha por zonas (/pt/spots).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { SPOTS } from "../../_lib/seo/carga.js";
import { NZ } from "../../_lib/seo/paginas-nz.js";

// Con Nueva Zelanda también (2026-11-20, espejo de idiomas).
const conNZ = (html) => html.replace('<section class="cta"', `${NZ.pt.seccionNZ("spots", SPOTS)}\n<section class="cta"`);

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: conNZ(IB.pt.paginaIndice("spots", SPOTS).html) }));
}
