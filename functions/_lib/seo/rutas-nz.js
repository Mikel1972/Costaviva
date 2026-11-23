// functions/_lib/seo/rutas-nz.js — respuestas de las páginas de Nueva Zelanda
// en español y portugués (espejo de idiomas, 2026-11-20). Las usan los
// handlers de /spots, /mareas, /especies (y /pt/...): si el slug es de NZ,
// devuelven la página; si no, null y el handler sigue con España y Portugal.
// Sustituye a redireccion-nz.js (antes, 301 a la página inglesa).
import { conCache, TTL_CON_DATOS_S, TTL_SIN_DATOS_S } from "./base.js";
import { NZ } from "./paginas-nz.js";
import { SPOTS, spotNZ, datosSpotNZ, datosMareaNZ, cargarEspeciesNZ, mesNZ, previsionNZ } from "./carga-en.js";
import { zonaPorSlug } from "../nz/zonas-nz.js";
import { idDeSlugEspecie } from "./datos.js";

export function spotNZRespuesta(context, idioma, slug) {
  const spot = spotNZ(slug);
  if (!spot) return null;
  return conCache(context, async () => {
    const d = await datosSpotNZ(context, spot);
    return { html: NZ[idioma].paginaSpot(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}

export function mareaNZRespuesta(context, idioma, slug) {
  const spot = spotNZ(slug);
  if (!spot) return null;
  return conCache(context, async () => {
    const d = await datosMareaNZ(context, spot);
    return { html: NZ[idioma].paginaMarea(spot, SPOTS, d).html, ttl: d.completa ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}

export function zonaSpotsNZRespuesta(context, idioma, slug) {
  const zona = zonaPorSlug(slug);
  if (!zona) return null;
  return conCache(context, async () => ({ html: NZ[idioma].paginaZonaSpots(zona, SPOTS, await cargarEspeciesNZ(context), mesNZ()).html }));
}

export function zonaMareasNZRespuesta(context, idioma, slug) {
  const zona = zonaPorSlug(slug);
  if (!zona) return null;
  // Con la previsión de NZ (mareas de LINZ) para las preguntas frecuentes.
  return conCache(context, async () => {
    const prev = await previsionNZ(context);
    return { html: NZ[idioma].paginaZonaMareas(zona, SPOTS, prev?.spots || []).html, ttl: prev ? TTL_CON_DATOS_S : TTL_SIN_DATOS_S };
  });
}

// Especies de NZ: slug «nz-…». Si el slug no es de NZ, null.
export function especieNZRespuesta(context, idioma, slug, noEncontrada) {
  if (!/^nz-[a-z0-9-]+$/.test(String(slug || ""))) return null;
  return conCache(context, async () => {
    const datos = await cargarEspeciesNZ(context);
    const e = datos.especies.find((x) => x.id === slug || x.id === idDeSlugEspecie(slug));
    if (!e) return noEncontrada();
    return { html: NZ[idioma].paginaEspecie(e, datos, SPOTS, mesNZ()).html };
  });
}
