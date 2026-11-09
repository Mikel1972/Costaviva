// functions/_lib/linz-basemaps.js
// Clave de LINZ Basemaps para el fondo satélite de Nueva Zelanda
// (assets/js/capa-satelite.js), 2026-11-09.
//
// LINZ dio una clave de desarrollador ligada al dominio costaviva.org (uso
// comercial con atribución CC BY 4.0; registro de permisos de comun,
// petición `costaviva-linz-basemaps-aerial`). El repo es público, así que la
// clave NO va en ningún fichero: es la variable LINZ_BASEMAPS_KEY de
// Cloudflare Pages (Production y Preview), y este ayudante la mete en un
// <meta name="linz-basemaps-key"> del <head> de la página del mapa. El
// navegador la lleva igualmente en la URL de cada tesela (así funcionan las
// claves de LINZ: lo que la protege es el dominio, no el secreto).
//
// Sin la variable, o con un valor raro, no se toca la página y el mapa no
// pide nada a LINZ (todo como antes). Cambiar la variable exige un redeploy.

import { META_CLAVE_LINZ, FORMA_CLAVE_LINZ } from "../../assets/js/capa-satelite.js";

// Páginas con el mapa del satélite (las dos formas de index.html).
export const PAGINAS_CON_MAPA = new Set(["/", "/index.html"]);

export function claveLinzValida(valor) {
  const c = String(valor ?? "").trim();
  return FORMA_CLAVE_LINZ.test(c) ? c : null;
}

// Devuelve la respuesta con la <meta> de la clave, o la misma respuesta si
// no toca (otra ruta, no es HTML, sin clave). `Rewriter` = HTMLRewriter.
export function conClaveLinz(response, { clave, pathname, Rewriter }) {
  const c = claveLinzValida(clave);
  if (!c || !PAGINAS_CON_MAPA.has(pathname)) return response;
  const tipo = response.headers.get("content-type") || "";
  if (!tipo.toLowerCase().includes("text/html")) return response;
  const meta = `<meta name="${META_CLAVE_LINZ}" content="${c}">`;
  return new Rewriter()
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .transform(response);
}
