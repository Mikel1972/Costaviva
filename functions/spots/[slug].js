// functions/spots/[slug].js — página pública de pesca de un spot
// (/spots/<slug>), HTML generado en el servidor. Ver functions/_lib/seo/.
import { conCache, pagina404, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "../_lib/seo/base.js";
import { paginaSpot } from "../_lib/seo/paginas.js";
import { SPOTS, datosPaginaSpot } from "../_lib/seo/carga.js";

export async function onRequestGet(context) {
  const slug = String(context.params.slug || "");
  const spot = SPOTS.find((s) => s.slug === slug);
  if (!spot) return pagina404({ que: "página de spot", volver: "/spots", volverTexto: "Ver todos los spots" });
  return conCache(context, async () => {
    const d = await datosPaginaSpot(context, spot);
    const { html } = paginaSpot(spot, SPOTS, d);
    // Sin las condiciones de hoy, se guarda poco: que la siguiente visita
    // vuelva a intentarlo.
    return { html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}
