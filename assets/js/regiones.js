// assets/js/regiones.js
// Regiones de la app y su zona horaria (2026-10-09, fase 0 de Nueva Zelanda).
//
// Antes, "Europe/Madrid" iba fijo en unas 60 líneas: toda la app etiquetaba y
// leía las horas en hora de Madrid, también en Canarias y Portugal. Ahora cada
// punto (spot fijo, ubicación del usuario, salida del diario, boya) saca su
// zona de su región, y las funciones de hora local reciben la zona.
//
// Módulo ES puro, sin dependencias: lo importan los módulos del navegador
// (ventana-actividad.js, diario.html...), las Functions, los scripts y los
// tests. El <script> clásico de index.html lo usa vía window.Regiones.
//
// Decisiones (no cambiar sin Mikel):
//   - Canarias: Atlantic/Canary. Hasta hoy salía en hora de Madrid (una hora
//     de más en mareas, "hora actual" del índice y diario): era un fallo.
//   - Portugal, Azores y Madeira: SIGUEN en hora de Madrid a propósito (fase 0
//     = ningún cambio visible en la península ni en Portugal). Su zona real va
//     en `zonaOficial`; pasarlos a ella es una decisión aparte de Mikel.
//   - ZONA_NEGOCIO: lo que es del negocio en España (crons, informes, emails
//     de suscripción, cupos mensuales, marketing) va en hora de Madrid sea
//     cual sea la región del usuario.
//   - Hemisferio: los datos "general" de especies.json (freza, vedas sin
//     región) son de la Península y solo valen en el hemisferio norte. En el
//     sur cada región tendrá los suyos; nunca se desplazan 6 meses.

export const ZONA_NEGOCIO = "Europe/Madrid";
export const ZONA_POR_DEFECTO = "Europe/Madrid";

// bbox: [latMin, latMax, lonMin, lonMax] cuando la región es una caja; null
// cuando se decide por reglas (ver regionPorCoordenadas, que es la que manda).
const R = (id, nombre, pais, zona, extra = {}) => ({
  id, nombre, pais, zona, zonaOficial: extra.zonaOficial || zona,
  hemisferio: extra.hemisferio || "norte",
  moneda: extra.moneda || "EUR",
  idioma: extra.idioma || "es",
  bbox: extra.bbox || null,
});

export const REGIONES = {
  cantabrico: R("cantabrico", "Cantábrico", "ES", "Europe/Madrid"),
  atlantico_norte: R("atlantico_norte", "Galicia", "ES", "Europe/Madrid"),
  golfo_cadiz: R("golfo_cadiz", "Golfo de Cádiz", "ES", "Europe/Madrid", { bbox: [35.9, 37.5, -7.4, -5.6] }),
  mediterraneo: R("mediterraneo", "Mediterráneo", "ES", "Europe/Madrid"),
  baleares: R("baleares", "Baleares", "ES", "Europe/Madrid", { bbox: [38.5, 40.3, 1.0, 4.6] }),
  canarias: R("canarias", "Canarias", "ES", "Atlantic/Canary", { bbox: [27, 29.6, -18.5, -13] }),
  // Hora de Madrid a propósito (ver cabecera): su zona real es zonaOficial.
  portugal: R("portugal", "Portugal", "PT", "Europe/Madrid", { zonaOficial: "Europe/Lisbon" }),
  azores: R("azores", "Azores", "PT", "Europe/Madrid", { zonaOficial: "Atlantic/Azores", bbox: [36.8, 39.8, -31.5, -24.5] }),
  madeira: R("madeira", "Madeira", "PT", "Europe/Madrid", { zonaOficial: "Atlantic/Madeira", bbox: [32.3, 33.2, -17.4, -16.1] }),
  // Nueva Zelanda continental (Norte, Sur y Stewart). Chatham (-176,5°, otra
  // zona: Pacific/Chatham) y Kermadec quedan fuera de la primera fase. Las
  // regiones de pesca de MPI (nz_auckland_kermadec...) llegan en la fase 3.
  nueva_zelanda: R("nueva_zelanda", "Nueva Zelanda", "NZ", "Pacific/Auckland", {
    hemisferio: "sur", moneda: "NZD", idioma: "en", bbox: [-47.6, -34.0, 166.0, 179.0],
  }),
};

const enCaja = (lat, lon, [a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d;

// Región de un punto. Cajas aproximadas, no límites oficiales (igual que
// zonaPorCoordenadas() de index.html). Las de Iberia son las de siempre
// (antes en ventana-actividad.js, que la reexporta).
export function regionPorCoordenadas(lat, lon) {
  if (enCaja(lat, lon, REGIONES.nueva_zelanda.bbox)) return "nueva_zelanda";
  if (enCaja(lat, lon, REGIONES.azores.bbox)) return "azores";
  if (enCaja(lat, lon, REGIONES.madeira.bbox)) return "madeira";
  if (enCaja(lat, lon, REGIONES.canarias.bbox)) return "canarias";
  if (enCaja(lat, lon, REGIONES.baleares.bbox)) return "baleares";
  // Golfo de Cádiz español: del Guadiana (-7.4) a Tarifa (-5.6).
  if (enCaja(lat, lon, REGIONES.golfo_cadiz.bbox)) return "golfo_cadiz";
  // Portugal continental: al sur del Miño (41.87) y al oeste del Guadiana.
  if (lat < 41.87 && lon < -7.4) return "portugal";
  // Cantábrico: de Ribadeo (-7.05) a la frontera francesa (y Baiona).
  if (lat >= 43.0 && lon >= -7.05 && lon <= -1.3) return "cantabrico";
  // Galicia (Rías Altas y Baixas).
  if (lat >= 41.87 && lon < -7.05) return "atlantico_norte";
  if (lon > -5.6 && lat < 43.0) return "mediterraneo";
  return "cantabrico";
}

export function zonaDeRegion(id) {
  return REGIONES[id]?.zona || ZONA_POR_DEFECTO;
}

export function hemisferioDeRegion(id) {
  return REGIONES[id]?.hemisferio || "norte";
}

// ¿Valen en esta región los datos "general" de especies.json (freza, vedas
// sin lista de regiones)? Son de la Península: solo en el hemisferio norte.
export function usaDatosGenerales(id) {
  return hemisferioDeRegion(id) === "norte";
}

export function zonaPorCoordenadas(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (lat === null || lat === undefined || lon === null || lon === undefined || !Number.isFinite(la) || !Number.isFinite(lo)) {
    return ZONA_POR_DEFECTO;
  }
  return zonaDeRegion(regionPorCoordenadas(la, lo));
}

// Zona de un spot (fijo o del usuario), una boya o una salida: la que traiga
// (p. ej. /prevision manda `zona`) o la de sus coordenadas.
export function zonaDeSpot(s) {
  if (s?.zona && ZONAS_HORARIAS.has(s.zona)) return s.zona;
  return zonaPorCoordenadas(s?.lat, s?.lon);
}

// Zonas que admiten el proxy /meteo/ y los adaptadores (lista cerrada).
export const ZONAS_HORARIAS = new Set([
  ...Object.values(REGIONES).flatMap((r) => [r.zona, r.zonaOficial]), "UTC", "GMT",
]);

// ---------------------------------------------------------------------------
// Hora local en una zona
// ---------------------------------------------------------------------------
const formateadores = new Map();
function partes(ms, zona) {
  const z = zona || ZONA_POR_DEFECTO;
  let f = formateadores.get(z);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: z, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    formateadores.set(z, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  if (p.hour === "24") p.hour = "00";
  return p;
}

// "AAAA-MM-DDTHH" (sin minutos, como comparaba horaActualMadridISO()).
export function horaLocalISO(zona, fecha = new Date()) {
  const p = partes(+fecha, zona);
  return `${p.year}-${p.month}-${p.day}T${p.hour}`;
}

// "AAAA-MM-DD" local.
export function fechaLocalISO(zona, fecha = new Date()) {
  return horaLocalISO(zona, fecha).slice(0, 10);
}

// "AAAA-MM-DDTHH:MM" local (formato de las horas del modelo con minutos).
export function isoLocal(ms, zona) {
  const p = partes(ms, zona);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Minutos desde la medianoche local del instante `ms`.
export function minutosLocales(ms, zona) {
  const p = partes(ms, zona);
  return Number(p.hour) * 60 + Number(p.minute);
}

// Minutos que la zona va por delante de UTC en el instante `ms`.
export function desfaseMinutos(ms, zona) {
  const p = partes(ms, zona);
  const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((comoUTC - Math.floor(ms / 60000) * 60000) / 60000);
}

// Desfase de la hora estándar (la de invierno de cada hemisferio): el menor
// de enero y julio. Madrid +60, Canarias 0, Auckland +720.
export function desfaseEstandarMinutos(zona) {
  return Math.min(desfaseMinutos(Date.UTC(2026, 0, 15, 12), zona), desfaseMinutos(Date.UTC(2026, 6, 15, 12), zona));
}

// Instante UTC APROXIMADO de una etiqueta local "AAAA-MM-DDTHH:00": se resta
// el desfase estándar, sin horario de verano (error de 1 h como mucho). Es la
// misma aproximación de siempre ("hora de Madrid - 1 h"), que sobra para la
// fase de la luna y el coeficiente astronómico; en Madrid da lo mismo que antes.
export function msAproxDeEtiqueta(etiqueta, zona) {
  return Date.parse(`${etiqueta.slice(0, 16)}:00Z`) - desfaseEstandarMinutos(zona) * 60000;
}

// Parte una lista (spots...) por zona horaria, para pedir a Open-Meteo una
// consulta por zona (sus horas van etiquetadas con UNA zona por consulta).
// Devuelve [{ zona, items, indices }] en orden de primera aparición.
export function agruparPorZona(lista, zonaDe = zonaDeSpot) {
  const grupos = new Map();
  lista.forEach((x, i) => {
    const z = zonaDe(x);
    if (!grupos.has(z)) grupos.set(z, { zona: z, items: [], indices: [] });
    const g = grupos.get(z);
    g.items.push(x);
    g.indices.push(i);
  });
  return [...grupos.values()];
}

// Parámetro timezone=... para Open-Meteo / el proxy /meteo/.
export function paramZona(zona) {
  return `timezone=${encodeURIComponent(zona || ZONA_POR_DEFECTO)}`;
}
