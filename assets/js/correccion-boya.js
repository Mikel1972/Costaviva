// assets/js/correccion-boya.js — corrección de la previsión con la boya más
// cercana (2026-11-19, fase 2 de la hoja de previsión: "corrección desde la
// boya").
//
// La idea, como la de la cámara (factorCamara en index.html): si la boya mide
// ahora 2,1 m y el modelo decía 3,7 m para esa misma hora, el modelo va
// sobrado en un 43 %, y lo probable es que siga así unas horas. Se corrigen
// las horas cercanas con ese cociente y la corrección se apaga poco a poco
// (DECAIMIENTO_H). Lejos de la medida manda el modelo.
//
// Prudencia:
//   - solo la boya más cercana a MAX_KM o menos; cuanto más lejos, menos peso
//     (a MAX_KM, peso 0);
//   - solo medidas de las últimas MAX_EDAD_H horas (Copernicus publica con
//     1-3 h de retraso);
//   - con olas pequeñas (< MIN_MODELO_M en el modelo) no se corrige: un
//     cociente entre números pequeños es ruido;
//   - el cociente se limita a [COCIENTE_MIN, COCIENTE_MAX];
//   - la cámara propia del spot manda sobre la boya (mide la orilla): si hay
//     corrección de cámara, la de la boya no se aplica (index.html).
//
// Script clásico sin red ni DOM: deja window.CorreccionBoya; los tests lo
// cargan con import().
(function (raiz) {
  var MAX_KM = 40, MAX_EDAD_H = 4, DECAIMIENTO_H = 12, MIN_MODELO_M = 0.3;
  var COCIENTE_MIN = 0.5, COCIENTE_MAX = 2;

  function num(v) { return typeof v === "number" && isFinite(v); }

  function distanciaKm(lat1, lon1, lat2, lon2) {
    var r = Math.PI / 180, R = 6371;
    var a = Math.pow(Math.sin(((lat2 - lat1) * r) / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin(((lon2 - lon1) * r) / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // boyas: [{ nombre, lat, lon, alturaSignificativa, actualizado (ISO) }]
  // modeloEnHora(isoMedida) -> altura del modelo en mar abierto (m) en la hora
  // de la medida, o null. Devuelve null o
  // { nombre, km, medido, modelo, cociente, peso, actualizado }.
  function correccionBoya(opciones) {
    var o = opciones || {};
    if (!num(o.lat) || !num(o.lon) || typeof o.modeloEnHora !== "function") return null;
    var ahora = num(o.ahoraMs) ? o.ahoraMs : Date.now();
    var mejor = null;
    (o.boyas || []).forEach(function (b) {
      if (!b || !num(b.lat) || !num(b.lon) || !num(b.alturaSignificativa)) return;
      var t = Date.parse(b.actualizado);
      if (!isFinite(t) || ahora - t > MAX_EDAD_H * 3600e3 || t - ahora > 15 * 60e3) return;
      var km = distanciaKm(o.lat, o.lon, b.lat, b.lon);
      if (km <= MAX_KM && (!mejor || km < mejor.km)) mejor = { b: b, km: km };
    });
    if (!mejor) return null;
    var modelo = o.modeloEnHora(mejor.b.actualizado);
    if (!num(modelo) || modelo < MIN_MODELO_M) return null;
    var crudo = mejor.b.alturaSignificativa / modelo;
    var cociente = Math.min(COCIENTE_MAX, Math.max(COCIENTE_MIN, crudo));
    return {
      nombre: mejor.b.nombre,
      km: Math.round(mejor.km),
      medido: mejor.b.alturaSignificativa,
      modelo: +modelo.toFixed(2),
      cociente: +cociente.toFixed(3),
      peso: +(1 - mejor.km / MAX_KM).toFixed(3),
      actualizado: mejor.b.actualizado,
    };
  }

  // Factor para una hora a `horas` de la medida (puede ser negativa).
  function factorBoya(corr, horas) {
    if (!corr || !num(corr.cociente) || !num(horas)) return 1;
    var w = Math.max(0, 1 - Math.abs(horas) / DECAIMIENTO_H) * Math.min(1, Math.max(0, corr.peso));
    return +(1 + (corr.cociente - 1) * w).toFixed(4);
  }

  raiz.CorreccionBoya = {
    MAX_KM: MAX_KM, MAX_EDAD_H: MAX_EDAD_H, DECAIMIENTO_H: DECAIMIENTO_H, MIN_MODELO_M: MIN_MODELO_M,
    COCIENTE_MIN: COCIENTE_MIN, COCIENTE_MAX: COCIENTE_MAX,
    distanciaKm: distanciaKm, correccionBoya: correccionBoya, factorBoya: factorBoya,
  };
})(typeof window !== "undefined" ? window : globalThis);
