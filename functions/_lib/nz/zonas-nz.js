// functions/_lib/nz/zonas-nz.js
// Zonas geográficas de los spots de Nueva Zelanda (las 14 del plan de NZ,
// `zona` de spots-nz.js) con su nombre en inglés y su slug de URL, para las
// páginas públicas /en/spots/region/<slug> y /en/tides/region/<slug>
// (lanzamiento de NZ, 2026-10-11). Lógica pura.

export const ZONAS_NZ = Object.freeze([
  { zona: "Northland", slug: "northland", nombre: "Northland" },
  { zona: "Auckland / Hauraki Gulf", slug: "auckland-hauraki-gulf", nombre: "Auckland & Hauraki Gulf" },
  { zona: "Coromandel", slug: "coromandel", nombre: "Coromandel" },
  { zona: "Bay of Plenty", slug: "bay-of-plenty", nombre: "Bay of Plenty" },
  { zona: "Gisborne / Hawke's Bay", slug: "gisborne-hawkes-bay", nombre: "Gisborne & Hawke's Bay" },
  { zona: "Waikato oeste", slug: "waikato-west-coast", nombre: "Waikato west coast" },
  { zona: "Taranaki", slug: "taranaki", nombre: "Taranaki" },
  { zona: "Wellington", slug: "wellington", nombre: "Wellington & Wairarapa" },
  { zona: "Nelson / Marlborough", slug: "nelson-marlborough", nombre: "Nelson & Marlborough" },
  { zona: "Canterbury", slug: "canterbury", nombre: "Canterbury" },
  { zona: "Otago", slug: "otago", nombre: "Otago" },
  { zona: "Southland", slug: "southland", nombre: "Southland & Stewart Island" },
  { zona: "Fiordland", slug: "fiordland", nombre: "Fiordland" },
  { zona: "West Coast", slug: "west-coast", nombre: "West Coast" },
]);

export const zonaDeSpotNZ = (spot) => ZONAS_NZ.find((z) => z.zona === spot.zona) || null;
export const zonaPorSlug = (slug) => ZONAS_NZ.find((z) => z.slug === slug) || null;
