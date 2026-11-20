// functions/en/spots/index.js — spots de Nueva Zelanda (/en/spots).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceSpotsNZ } from "../../_lib/seo/paginas-en.js";
import { SPOTS } from "../../_lib/seo/carga-en.js";
import { IB } from "../../_lib/seo/paginas-ib.js";

// Con España y Portugal también (2026-11-20, espejo de idiomas).
const conIberia = (html, tipo) => html.replace('<section class="cta"', `${IB.en.seccionIberia(tipo, SPOTS)}\n<section class="cta"`);

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: conIberia(paginaIndiceSpotsNZ(SPOTS).html, "spots") }));
}
