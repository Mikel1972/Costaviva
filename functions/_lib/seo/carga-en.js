// functions/_lib/seo/carga-en.js
// Datos de las páginas públicas de Nueva Zelanda en inglés (/en/...,
// lanzamiento de NZ 2026-10-11). Red separada de la lógica (paginas-en.js).
// Coste: /prevision?region=nz ya tiene su propia caché en el edge (30 min, y
// solo pide los spots de NZ a Open-Meteo); los datos de LINZ y del DOC salen
// de env.ASSETS (estáticos, sin cuota) y la página entera se guarda 30-60
// min con conCache().
import { leerAssetJson } from "../assets-memo.js";
import { SPOTS } from "../../prevision.js";
import { cargarJson, pedirConLimite } from "./base.js";
import { datosEspeciesDePais } from "../regiones-activas.js";
import { cargarDatosLinz } from "../nz/prevision-nz.js";
import { eventosDePuerto } from "../nz/mareas-linz.js";
import { reservasCercanas } from "../nz/reservas-doc.js";
import { spotsNZ, mareasDiasNZ, mesNZ } from "./paginas-en.js";

// Todos los spots (las páginas /en/ solo enseñan los de NZ: spotsNZ).
export { SPOTS };
export const SPOTS_NZ_PUBLICOS = spotsNZ(SPOTS);
export const spotNZ = (slug) => SPOTS_NZ_PUBLICOS.find((s) => s.slug === slug) || null;
export { mesNZ };

export const cargarEspeciesNZ = (context) => cargarJson(context, "/assets/datos/especies.json").then((d) => datosEspeciesDePais(d, "nz"));

function leerPrivado(context, ruta) {
  // datos/nz no es público (lista blanca de rutas): solo por env.ASSETS.
  // Memorizado por isolate (assets-memo.js).
  return leerAssetJson(context.env, new URL(ruta, context.request.url).toString());
}

export const previsionNZ = (context) => pedirConLimite(new URL("/prevision?region=nz", context.request.url).toString(), undefined, context);
const delSpot = (prev, spot) => prev?.spots?.find((s) => s.slug === spot.slug && !s.error) || null;

export async function datosSpotNZ(context, spot) {
  const [especiesDatos, prev, reservas, profundidad] = await Promise.all([
    cargarEspeciesNZ(context),
    previsionNZ(context),
    leerPrivado(context, "/datos/nz/reservas-marinas-doc.geojson"),
    // Profundidad GEBCO (2026-11-26, extra-nz.js).
    cargarJson(context, "/assets/datos/profundidad-spots.json").catch(() => null),
  ]);
  const spotPrev = delSpot(prev, spot);
  return { especiesDatos, spotPrev, reservas: reservasCercanas(spot, reservas), profundidad, mes: mesNZ(), completa: Boolean(spotPrev) };
}

export async function datosMareaNZ(context, spot, ahora = Date.now()) {
  const [prev, linz] = await Promise.all([previsionNZ(context), cargarDatosLinz(context.env, context.request.url, ahora)]);
  let dias = [];
  try {
    if (linz.catalogo) dias = mareasDiasNZ(eventosDePuerto(spot.puerto_linz, linz.catalogo, linz.anios), ahora);
  } catch (e) {
    dias = [];
  }
  const spotPrev = delSpot(prev, spot);
  return { spotPrev, dias, completa: Boolean(spotPrev && dias.length) };
}
