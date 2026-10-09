// functions/_lib/regiones-activas.js
// Interruptor de regiones (fase 1 de Nueva Zelanda, 2026-10-09).
//
// España/Portugal es la región "es" y siempre está. Una región nueva entra
// en el código y en los datos ANTES de verse: sus spots solo se suman a
// SPOTS (functions/prevision.js), y con ellos a /prevision, /spots, el
// sitemap, /registrar-presion y los scripts que leen SPOTS, cuando su clave
// está en REGIONES_ACTIVAS.
//
// Cómo se activa NZ: añadir "nz" aquí, en un commit que pase los tests y con
// el sí de Mikel. Antes tienen que estar hechas las partes que el plan de NZ
// pone en la fase 1 (zona horaria por spot en /prevision y en el proxy, textos
// en inglés, spots en el mapa de index.html y en diario.html, que tienen su
// propia copia de la lista) y revisados los spots con `revisar_ubicacion`.
// test/nz-region.test.js comprueba que con "nz" fuera nada de NZ se ve.

import { SPOTS_NZ } from "./nz/spots-nz.js";

export const REGIONES_ACTIVAS = Object.freeze(["es"]);

const SPOTS_POR_REGION = { nz: SPOTS_NZ };

export function regionActiva(region, activas = REGIONES_ACTIVAS) {
  return region === "es" || activas.includes(region);
}

// Spots de las regiones nuevas que están activas (vacío mientras solo esté "es").
export function spotsRegionesActivas(activas = REGIONES_ACTIVAS) {
  return Object.entries(SPOTS_POR_REGION).flatMap(([region, spots]) => (regionActiva(region, activas) ? spots : []));
}

// Especies que se pueden enseñar en público (fase 2c de NZ, 2026-10-09):
// las de España/Portugal siempre; las de otra región (especies.json `pais`)
// solo con su región activa. Lo usan /especies, /especies/<slug> y el
// sitemap. El índice de la app no lo necesita: cada región solo mira las
// especies de su país (ventana-actividad.js).
export function especiesVisibles(especies, activas = REGIONES_ACTIVAS) {
  return (especies || []).filter((e) => regionActiva(e.pais || "es", activas));
}

// El JSON entero de especies.json con solo las especies visibles.
export function datosEspeciesVisibles(datos, activas = REGIONES_ACTIVAS) {
  return datos ? { ...datos, especies: especiesVisibles(datos.especies, activas) } : datos;
}
