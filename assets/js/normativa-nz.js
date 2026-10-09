// assets/js/normativa-nz.js
// Normativa de pesca recreativa en Nueva Zelanda: SOLO enlaces oficiales
// (fase 2 de NZ, 2026-10-09). Módulo ES puro: lo usan index.html (vía
// window.NormativaNZ), /prevision?region=nz y los tests.
//
// Regla (plan de NZ, §3): ninguna cifra. Las tallas y los cupos cambian
// (blue cod 2023-2025, Notice de 2025) y la capa oficial de límites de MPI es
// "for internal use only", así que la app solo enlaza la página de reglas de
// MPI del área de cada spot o especie, recuerda la app oficial gratuita y
// avisa de los rāhui (cierres tradicionales que no salen en ningún dato).
// Nunca se infiere ni se inventa un rāhui.
//
// Las URLs de cada área se comprobaron el 2026-10-09 por sus títulos en el
// buscador ("Auckland and Kermadec area fishing rules"...): mpi.govt.nz
// bloquea las descargas automáticas (Incapsula). Si MPI cambia una, el robot
// semanal que vigila sus páginas (fase 4 del plan) tendrá que avisar.

const BASE = "https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/";

// Claves = `region` de functions/_lib/nz/spots-nz.js y de especies.json.
export const AREAS_MPI = Object.freeze({
  nz_auckland_kermadec: { nombre: "Auckland / Kermadec", url: `${BASE}auckland-kermadec-fishing-rules` },
  nz_central: { nombre: "Central", url: `${BASE}central-fishing-rules` },
  nz_challenger: { nombre: "Challenger", url: `${BASE}challenger-fishing-rules` },
  nz_south_east: { nombre: "South-East", url: `${BASE}south-east-fishing-rules` },
  nz_kaikoura: { nombre: "Kaikōura Marine Area", url: `${BASE}kaikoura-fishing-rules` },
  nz_southland: { nombre: "Southland", url: `${BASE}southland-fishing-rules` },
  nz_fiordland: { nombre: "Fiordland Marine Area", url: `${BASE}fiordland-marine-area-fishing-rules` },
});

export const URL_REGLAS_MPI = BASE;
export const URL_APP_MPI = "https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/nz-fishing-rules-app/";

// Enlace de normativa de un área (región MPI). null si no es de NZ.
export function normativaArea(region) {
  const a = AREAS_MPI[region];
  if (!a) return null;
  return { region, area: a.nombre, url: a.url, app: URL_APP_MPI };
}

// Enlaces de varias áreas (ficha de especie: las de su `presencia`), sin
// repetir y en el orden de AREAS_MPI.
export function normativaAreas(regiones) {
  const set = new Set(regiones || []);
  return Object.keys(AREAS_MPI).filter((r) => set.has(r)).map(normativaArea);
}
