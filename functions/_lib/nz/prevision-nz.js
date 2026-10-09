// functions/_lib/nz/prevision-nz.js
// Piezas de /prevision?region=nz (fase 2 de NZ, 2026-10-09).
//
// Oleaje, viento, temperatura del agua y corriente salen de Open-Meteo igual
// que en España (modelos globales); la marea NO: GLO no la trae y LINZ da
// las predicciones oficiales (mareas-linz.js). Aquí se cargan los datos de
// LINZ y se completa cada spot con su marea, su atribución y el enlace a la
// normativa de su área (solo enlace, nunca cifras).
//
// Los datos de LINZ viven en datos/nz/, que NO se sirve en público (lista
// blanca de rutas). La Function los lee con env.ASSETS.fetch(), que va
// directo a los estáticos sin pasar por _middleware.js. Sin ASSETS (tests,
// scripts) o si falla, la marea sale null y el resto del spot sigue.

import { mareaSpotNZ, ATRIBUCION_LINZ, AVISO_LINZ } from "./mareas-linz.js";
import { normativaArea } from "../../../assets/js/normativa-nz.js";

export { ATRIBUCION_LINZ, AVISO_LINZ };

// Años de tablas que hacen falta para "ahora": el actual y el siguiente
// (las próximas pleamares de fin de año caen en el siguiente).
export function aniosNecesarios(ahora = Date.now()) {
  const y = new Date(ahora).getUTCFullYear();
  return [y, y + 1];
}

async function leerJSON(env, origen, ruta) {
  if (!env?.ASSETS) return null;
  try {
    const r = await env.ASSETS.fetch(new URL(ruta, origen));
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error(`prevision-nz: no se pudo leer ${ruta}:`, e);
    return null;
  }
}

// { catalogo, anios } o { catalogo: null, anios: [] } si falta algo.
export async function cargarDatosLinz(env, origen, ahora = Date.now()) {
  const [catalogo, ...anios] = await Promise.all([
    leerJSON(env, origen, "/datos/nz/linz-puertos.json"),
    ...aniosNecesarios(ahora).map((y) => leerJSON(env, origen, `/datos/nz/linz-mareas-${y}.json`)),
  ]);
  return { catalogo, anios: anios.filter(Boolean) };
}

// Completa el resultado de procesarSpot() de un spot NZ: marea LINZ (en vez
// de la de Open-Meteo), región MPI, zona geográfica, modalidades, enlace de
// normativa y si su punto aún está por revisar.
export function completarSpotNZ(resultado, spot, linz, ahora = Date.now()) {
  let marea = null;
  try {
    marea = linz?.catalogo ? mareaSpotNZ(spot, linz.catalogo, linz.anios, ahora) : null;
  } catch (e) {
    console.error(`prevision-nz: marea de ${spot.slug}:`, e);
  }
  return {
    ...resultado,
    pais: "nz",
    region: spot.region,
    zonaGeografica: spot.zona,
    modalidades: spot.modalidades,
    revisarUbicacion: Boolean(spot.revisar_ubicacion),
    marea,
    normativa: normativaArea(spot.region),
  };
}
