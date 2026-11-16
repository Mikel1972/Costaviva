// assets/js/nubes.js
// Nubosidad OBSERVADA para "ahora" (2026-11-16, Mikel en Lemoiz de noche:
// la app decía "100 %" y veía estrellas). El modelo (Open-Meteo best_match)
// daba 100 % de nubes medias; AROME, 0 %; y el METAR del aeropuerto de
// Bilbao, a 12 km, CAVOK toda la noche. Para la hora actual manda la
// observación del aeródromo más cercano (METAR, aviationweather.gov, NOAA,
// dominio público); para las horas que vienen, el modelo como siempre.
// Puro, con test en test/nubes.test.js.

// Distancia máxima al aeródromo y edad máxima del parte para usarlo.
export const MAX_KM_METAR = 40;
export const MAX_MIN_METAR = 90;

// Cobertura del METAR -> % (octas: FEW 1-2, SCT 3-4, BKN 5-7, OVC 8).
const PORCENTAJE = { SKC: 0, CLR: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 20, SCT: 45, BKN: 75, OVC: 100, OVX: 100, VV: 100 };

export function porcentajeMetar(m) {
  const capas = (m?.clouds || []).map((c) => PORCENTAJE[c?.cover]).filter((v) => v !== undefined);
  if (capas.length) return Math.max(...capas);
  const general = PORCENTAJE[m?.cover];
  return general === undefined ? null : general;
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Lista de METAR (formato JSON de aviationweather.gov) -> el parte reciente
// del aeródromo más cercano, o null si no hay ninguno que valga.
export function elegirMetar(lista, lat, lon, ahoraMs = Date.now()) {
  let mejor = null;
  for (const m of lista || []) {
    if (!Number.isFinite(m?.lat) || !Number.isFinite(m?.lon) || !Number.isFinite(m?.obsTime)) continue;
    const km = distanciaKm(lat, lon, m.lat, m.lon);
    const edadMin = (ahoraMs - m.obsTime * 1000) / 60000;
    const pct = porcentajeMetar(m);
    if (km > MAX_KM_METAR || edadMin > MAX_MIN_METAR || edadMin < -10 || pct === null) continue;
    if (!mejor || km < mejor.distanciaKm || (km === mejor.distanciaKm && edadMin < mejor.edadMin)) {
      mejor = {
        nubosidad: pct,
        estacion: m.icaoId,
        nombre: String(m.name || m.icaoId).split(",")[0].replace(/\s+Arpt$/i, "").trim(),
        distanciaKm: Math.round(km),
        edadMin: Math.max(0, Math.round(edadMin)),
        hora: new Date(m.obsTime * 1000).toISOString(),
      };
    }
  }
  return mejor;
}
