// functions/en/species/index.js — especies de Nueva Zelanda (/en/species).
import { conCache, sinBarraFinal } from "../../_lib/seo/base.js";
import { paginaIndiceEspeciesNZ } from "../../_lib/seo/paginas-en.js";
import { cargarEspeciesNZ, mesNZ } from "../../_lib/seo/carga-en.js";
import { cargarEspecies, mesMadrid } from "../../_lib/seo/carga.js";
import { slugEspecie } from "../../_lib/seo/datos.js";
import { IB } from "../../_lib/seo/paginas-ib.js";
import { esc } from "../../_lib/seo/base.js";

// Con las especies de España y Portugal también (2026-11-20, espejo de idiomas).
async function seccionIberia(context) {
  const d = await cargarEspecies(context);
  const ls = d.especies.filter((e) => !String(e.id).startsWith("nz-")).map((e) => ({ slug: slugEspecie(e.id), nombre: IB.en.nombreEsp(e) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "en"));
  return `<section aria-labelledby="t-iberia"><h2 id="t-iberia">Spain and Portugal</h2><ul class="chips">${ls.map((e) => `<li><a href="/en/species/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>`;
}

export async function onRequestGet(context) {
  return sinBarraFinal(context.request) || conCache(context, async () => ({ html: paginaIndiceEspeciesNZ(await cargarEspeciesNZ(context), mesNZ()).html.replace('<section class="cta"', `${await seccionIberia(context)}\n<section class="cta"`) }));
}
