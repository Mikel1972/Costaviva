// functions/_lib/nz/pueblos-nz.js
// Páginas de mareas de pueblos de Nueva Zelanda sin spot propio (2026-11-25,
// Mikel: «monta las tres», análisis de Search Console). Solo pueblos que se
// buscan en Google («opotiki tides», «helensville tide times»…) y donde LINZ
// publica un puerto oficial EN el propio pueblo, con alturas (no aproximado).
// Sin datos inventados: la página es la tabla de LINZ de ese puerto, con sus
// coordenadas. No son spots de la app (sin oleaje, especies ni cámaras).
//
// Mirados y NO hechos (2026-11-25): Paraparaumu (LINZ: aproximado y sin
// alturas), Kaiapoi (puerto más cercano a 15 km), Takaka (a 9 km), Ruakaka
// (Marsden Point a 8 km), Kakanui (Oamaru a 12 km). Whangaparaoa, Bay of
// Islands, Bowentown, Mangawhai, Kaipara y Great Barrier ya tienen spot.
// test/pueblos-nz.test.js comprueba cada puerto contra datos/nz/linz-puertos.json.
import { SPOTS_NZ } from "./spots-nz.js";
import { distanciaKm } from "./mareas-linz.js";

const BASE = [
  { slug: "nz-mount-maunganui", nombre: "Mount Maunganui", puerto: { id: "6414d", nombre: "Moturiki Island", tabla: "Moturiki Island" }, lat: -37.6333, lon: 176.1833 },
  { slug: "nz-opotiki", nombre: "Ōpōtiki", puerto: { id: "6418a", nombre: "Ōpōtiki Wharf", tabla: null }, lat: -38, lon: 177.2833 },
  { slug: "nz-otaki", nombre: "Ōtaki Beach", puerto: { id: "6444c", nombre: "Ōtaki Beach", tabla: null }, lat: -40.7333, lon: 175.1 },
  { slug: "nz-helensville", nombre: "Helensville", puerto: { id: "6378a", nombre: "Helensville", tabla: "Helensville" }, lat: -36.6667, lon: 174.45 },
  { slug: "nz-clarks-beach", nombre: "Clarks Beach", puerto: { id: "6374c", nombre: "Clarks Beach", tabla: null }, lat: -37.15, lon: 174.7 },
];

// Zona y región MPI: las del spot más cercano (para migas, enlaces y normas).
function spotMasCercano(p) {
  let mejor = null;
  for (const s of SPOTS_NZ) {
    const km = distanciaKm(p.lat, p.lon, s.lat, s.lon);
    if (!mejor || km < mejor.km) mejor = { s, km };
  }
  return mejor;
}

export const PUEBLOS_NZ = BASE.map((p) => {
  const c = spotMasCercano(p);
  return {
    slug: p.slug,
    nombre: p.nombre,
    lat: p.lat,
    lon: p.lon,
    pais: "nz",
    pueblo: true,
    zona: c.s.zona,
    region: c.s.region,
    spotCercano: { slug: c.s.slug, nombre: c.s.nombre, km: Math.round(c.km) },
    puerto_linz: { id: p.puerto.id, nombre: p.puerto.nombre, km: 0, tabla: p.puerto.tabla },
  };
});

export const puebloNZ = (slug) => PUEBLOS_NZ.find((p) => p.slug === slug) || null;
