// functions/_lib/nz/reservas-doc.js
// Reservas marinas del DOC cerca de un spot de Nueva Zelanda (lanzamiento de
// NZ, 2026-10-11). Lógica pura sobre datos/nz/reservas-marinas-doc.geojson
// (CC BY 4.0, atribución obligatoria: ATRIBUCION_DOC).
//
// La geometría está simplificada a 0,0005° (~50 m): sirve para AVISAR de que
// hay una reserva cerca ("no fishing"), nunca para decir al metro si un punto
// está dentro o fuera. Por eso el texto siempre manda a comprobar el límite
// en el DOC y no se dice "estás fuera".

// Desde el 2026-10-12 el fichero lleva también las zonas del golfo de Hauraki
// (ley de 2025): `tipo` "reserva" (sin pesca), "hpa" (alta protección: sin
// pesca recreativa ni marisqueo) o "spa" (protección del fondo: caña sí,
// arrastre, dragas y cerco danés no). Su reconocimiento va en la atribución.
export const ATRIBUCION_DOC = "Marine reserves: Department of Conservation (DOC), Crown copyright, CC BY 4.0. Hauraki Gulf / Tīkapa Moana protection areas: Crown Copyright: Department of Conservation Te Papa Atawhai 2025";
// Zonas donde no se pesca nada (reservas y alta protección).
export const sinPesca = (r) => r.tipo !== "spa";
export const URL_DOC_RESERVAS = "https://www.doc.govt.nz/";
// Distancia a partir de la que ya no se avisa: 3 km desde la costa y 10 km en
// los spots de barco (2026-10-12: desde una rampa, una zona sin pesca a 6 km
// está al alcance, p. ej. Slipper Island desde Tairua).
export const RADIO_AVISO_KM = 3;
export const RADIO_AVISO_BARCO_KM = 10;
export const radioAvisoKm = (spot) => (spot?.modalidades?.includes("embarcacion") ? RADIO_AVISO_BARCO_KM : RADIO_AVISO_KM);

const RAD = Math.PI / 180;

// Distancia (km) de p a un segmento ab, en plano local (vale para pocos km).
function distSegmentoKm(p, a, b) {
  const k = Math.cos(p[1] * RAD);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111.32;
}

function dentroAnillo(p, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function poligonos(geometria) {
  if (!geometria) return [];
  if (geometria.type === "Polygon") return [geometria.coordinates];
  if (geometria.type === "MultiPolygon") return geometria.coordinates;
  return [];
}

// { dentro, km } de un punto [lon, lat] a una geometría.
export function distanciaReserva(punto, geometria) {
  let km = Infinity;
  let dentro = false;
  for (const poli of poligonos(geometria)) {
    const [exterior, ...huecos] = poli;
    if (dentroAnillo(punto, exterior) && !huecos.some((h) => dentroAnillo(punto, h))) dentro = true;
    for (const anillo of poli) for (let i = 1; i < anillo.length; i++) km = Math.min(km, distSegmentoKm(punto, anillo[i - 1], anillo[i]));
  }
  return { dentro, km: dentro ? 0 : km };
}

// Reservas y zonas a menos de `radioKm` del spot, de la más cercana a la más
// lejana: [{ nombre, km, tipo }] (km redondeado a 0,1; 0 = el punto cae en la
// geometría simplificada; tipo "reserva" si el fichero es de antes de tipos).
export function reservasCercanas(spot, geojson, radioKm = radioAvisoKm(spot)) {
  if (!geojson?.features || !Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lon)) return [];
  const p = [spot.lon, spot.lat];
  return geojson.features
    .map((f) => ({ nombre: f.properties?.nombre || "Marine reserve", tipo: f.properties?.tipo || "reserva", ...distanciaReserva(p, f.geometry) }))
    .filter((r) => r.km <= radioKm)
    .sort((a, b) => a.km - b.km)
    .map((r) => ({ nombre: r.nombre, km: Math.round(r.km * 10) / 10, tipo: r.tipo }));
}
