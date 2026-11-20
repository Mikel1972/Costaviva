// functions/en/tides/index.js — mareas de Nueva Zelanda (/en/tides).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceMareasNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS } from "../../_lib/seo/carga-en.js";
import { IB } from "../../_lib/seo/paginas-ib.js";

// Con España y Portugal también (2026-11-20, espejo de idiomas).
const conIberia = (html, tipo) => html.replace('<section class="cta"', `${IB.en.seccionIberia(tipo, SPOTS)}\n<section class="cta"`);

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: conIberia(paginaIndiceMareasNZ(SPOTS).html, "mareas") }));
}
