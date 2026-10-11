// functions/_lib/regiones-activas.js
// Interruptor de regiones (fase 1 de Nueva Zelanda, 2026-10-09).
//
// España/Portugal es la región "es" y siempre está. Una región nueva entra
// en el código y en los datos ANTES de verse: sus spots solo se suman a
// SPOTS (functions/prevision.js), y con ellos a /prevision, /spots, el
// sitemap, /registrar-presion y los scripts que leen SPOTS, cuando su clave
// está en REGIONES_ACTIVAS.
//
// Vista previa (fase 2 de NZ): con la región apagada, un admin (o quien
// tenga VISTA_PREVIA_CLAVE) la ve igualmente con /?region=nz; ver
// functions/_lib/vista-previa.js.
//
// Nueva Zelanda ACTIVA desde el 2026-10-11 ("lanza ya", Mikel): sus spots
// están en SPOTS, /prevision?region=nz es pública (cada región se pide sola,
// por la cuota de Open-Meteo) y sus páginas públicas van en inglés bajo /en/.
// Las páginas públicas de España (/spots, /mareas, /especies, en español)
// siguen solo con España (SPOTS_ES, especiesDePais "es").
// test/nz-region.test.js comprueba dónde sale NZ y que España no cambia.

import { SPOTS_NZ } from "./nz/spots-nz.js";

export const REGIONES_ACTIVAS = Object.freeze(["es", "nz"]);

const SPOTS_POR_REGION = { nz: SPOTS_NZ };

// Regiones nuevas que existen en el código (activas o no).
export const REGIONES_CONOCIDAS = Object.freeze(Object.keys(SPOTS_POR_REGION));

// Spots de UNA región nueva, activa o no (fase 2 de NZ, 2026-10-09):
// /prevision?region=nz los pide solos, con su caché, para no gastar cuota de
// Open-Meteo pidiendo los de España en otro centro de datos. Si la región
// no está activa, quien llama tiene que haber comprobado la vista previa
// (functions/_lib/vista-previa.js).
export function spotsDeRegion(region) {
  return SPOTS_POR_REGION[region] || [];
}

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

// Especies de UN país (especies.json `pais`, "es" por defecto): las páginas
// públicas en español solo enseñan las de España/Portugal y las de /en/ solo
// las de Nueva Zelanda.
export function especiesDePais(especies, pais) {
  return (especies || []).filter((e) => (e.pais || "es") === pais);
}

export function datosEspeciesDePais(datos, pais) {
  return datos ? { ...datos, especies: especiesDePais(datos.especies, pais) } : datos;
}
