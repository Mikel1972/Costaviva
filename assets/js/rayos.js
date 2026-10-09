// assets/js/rayos.js
//
// Lógica pura de la capa de rayos del mapa (2026-10-08, Mikel: "la pestaña
// de rayos es poco ágil de manejar... hay que hacerlo más sencillo de
// manejo"). Sin DOM, sin red y sin Leaflet: distancia y rumbo, el rayo más
// cercano y la frase de una línea que se enseña arriba del todo, con tests en
// test/rayos-resumen.test.js. La parte de pantalla (capas, panel, encuadre)
// está en index.html, buscando "Rayos en directo sobre el propio mapa".
//
// Los datos de tiempo real (functions/rayos-cerca.js, Vaisala Xweather) son
// los rayos de los ÚLTIMOS 5 MINUTOS a menos de 100 km del centro de una
// celda de 0,5°. La frase lo dice tal cual: no promete "la última hora"
// porque no es lo que se consulta.

import { I18n } from "./i18n-modulo.js";

export const RADIO_KM = 100;
export const VENTANA_MIN = 5;
// Por debajo de este zoom no se consulta el tiempo real (cada consulta
// cuesta; con media España a la vista ya está la capa del satélite).
export const ZOOM_MIN_VIVO = 7;
// Umbrales de color de la frase. 15 km: distancia a la que se oye el trueno
// y a la que la regla 30/30 ya pide resguardarse; 40 km: tormenta en la zona.
export const KM_PELIGRO = 15;
export const KM_AVISO = 40;

const RAD = Math.PI / 180;

export function kmEntre(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Rumbo inicial de "a" hacia "b", en grados (0 = norte, 90 = este).
export function rumbo(a, b) {
  const f1 = a.lat * RAD, f2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// Ocho rumbos, en castellano (O de oeste, no W); en inglés, W (2026-10-09).
const CARDINALES = I18n.t("rayos.cardinales").split(",");
export function puntoCardinal(grados) {
  const g = ((Number(grados) % 360) + 360) % 360;
  return CARDINALES[Math.round(g / 45) % 8];
}

// Minutos desde el rayo; sin hora, se supone el extremo de la ventana.
export function edadMinutos(rayo, ahoraSeg) {
  return Number.isFinite(rayo?.ts) ? Math.max(0, (ahoraSeg - rayo.ts) / 60) : VENTANA_MIN;
}

export function textoEdad(min) {
  return min < 1 ? I18n.t("rayos.ahora_mismo") : I18n.t("rayos.hace_min", { n: Math.round(min) });
}

// El más cercano a "ref" (empate: el más reciente). null si no hay ninguno.
export function rayoMasCercano(ref, rayos, ahoraSeg) {
  let mejor = null;
  for (const r of rayos || []) {
    if (!Number.isFinite(r?.lat) || !Number.isFinite(r?.lon)) continue;
    const km = kmEntre(ref, r);
    const edadMin = edadMinutos(r, ahoraSeg);
    if (!mejor || km < mejor.km - 1e-9 || (Math.abs(km - mejor.km) < 1e-9 && edadMin < mejor.edadMin)) {
      const grados = rumbo(ref, r);
      mejor = { rayo: r, km, rumbo: grados, cardinal: puntoCardinal(grados), edadMin };
    }
  }
  return mejor;
}

// Punto desde el que se miden las distancias, por orden: el spot que se
// tiene abierto, la ubicación del usuario (solo si ya dio permiso: abrir los
// rayos no debe disparar una pregunta del navegador) y, si no, el centro del
// mapa. "de" es cómo se nombra en la frase.
export function elegirReferencia({ spot, gps, centro }) {
  if (spot && Number.isFinite(spot.lat) && Number.isFinite(spot.lon)) {
    return {
      lat: spot.lat, lon: spot.lon, origen: "spot",
      de: spot.nombre ? I18n.t("rayos.de_spot", { nombre: spot.nombre }) : I18n.t("rayos.del_spot"),
      lugar: spot.nombre || I18n.t("rayos.lugar_spot"),
    };
  }
  if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon)) {
    return { lat: gps.lat, lon: gps.lon, de: I18n.t("rayos.de_ti"), lugar: I18n.t("rayos.lugar_ti"), origen: "gps" };
  }
  return { lat: centro.lat, lon: centro.lon, de: I18n.t("rayos.del_centro"), lugar: I18n.t("rayos.lugar_centro"), origen: "centro" };
}

// Con el panel abierto, al mover el mapa solo se vuelve a consultar si el
// centro se ha ido lejos del punto de referencia: así el encuadre automático
// (que siempre incluye la referencia) no gasta consultas ni cambia la frase.
export function debeCambiarReferencia(ref, centro, zoom, umbralKm = 40) {
  if (!ref || zoom < ZOOM_MIN_VIVO) return false;
  return kmEntre(ref, centro) > umbralKm;
}

// Frase de una línea y su nivel (para el color):
//   estado "cargando" | "lejos" (zoom bajo) | "no_disponible" | "ok"
export function resumenRayos({ estado, masCercano, total = 0, ref }) {
  if (estado === "cargando") return { nivel: "neutro", texto: I18n.t("mapa.rayos.buscando") };
  if (estado === "lejos") return { nivel: "neutro", texto: I18n.t("rayos.acerca") };
  if (estado !== "ok") {
    return { nivel: "neutro", texto: I18n.t("rayos.no_disponible") };
  }
  if (!masCercano) {
    return { nivel: "ok", texto: I18n.t("rayos.sin_rayos", { km: RADIO_KM, min: VENTANA_MIN }) };
  }
  const km = masCercano.km < 1 ? I18n.t("rayos.menos_de_1") : String(Math.round(masCercano.km));
  const de = ref?.de ? ` ${ref.de}` : "";
  const nivel = masCercano.km <= KM_PELIGRO ? "peligro" : masCercano.km <= KM_AVISO ? "aviso" : "lejos";
  // El total va aparte (en el ⓘ): la frase tiene que caber en el móvil.
  const conteo = I18n.t("rayos.conteo", { n: total, min: VENTANA_MIN, km: RADIO_KM });
  return { nivel, conteo, texto: I18n.t("rayos.mas_cercano", { km, cardinal: masCercano.cardinal, de, edad: textoEdad(masCercano.edadMin) }) };
}

// Rayos que entran en el encuadre automático: el más cercano y los que
// están hasta "margenKm" más lejos que él (la misma tormenta). Con todos los
// de 100 km a la redonda el mapa se alejaría por debajo del zoom en el que
// se consulta el tiempo real.
export function rayosParaEncuadre(ref, rayos, masCercano, margenKm = 25) {
  if (!masCercano) return [];
  return (rayos || []).filter((r) => Number.isFinite(r?.lat) && Number.isFinite(r?.lon) && kmEntre(ref, r) <= masCercano.km + margenKm);
}

// Color del punto según su edad: más oscuro = más reciente. Morado, no rojo:
// la capa del satélite ya usa amarillo→rojo para la intensidad.
export function colorPorEdad(edadMin) {
  return edadMin < 1 ? "#5A189A" : edadMin < 3 ? "#7B2CBF" : "#B07FE0";
}
