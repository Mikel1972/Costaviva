// assets/js/relleno-datos.js — si falta un dato, se sigue con una media
// (2026-11-19, Mikel: "debemos mostrar siempre algo y el índice, entonces,
// sustituiría el dato o los datos que faltan por una media de los últimos 5
// que tenía"). Bug real que lo motivó: el proxy rechazó el mar de fondo y
// el índice, la ventana y la hoja se quedaron en S/D en todos los spots.
//
// Sin red ni DOM: script clásico que deja window.RellenoDatos (index.html)
// y que los tests cargan con import().
//
// Reglas:
//   - Cada variable horaria vacía se rellena con la media de los últimos
//     N_MEDIA valores que había antes en la serie (reales o ya rellenados).
//   - Si no hay ninguno antes (la petición entera falló), se usa el recuerdo:
//     los últimos N_MEDIA valores reales de la última vez que llegaron datos
//     (lo guarda index.html en localStorage, por spot).
//   - Las direcciones (viento y ola) se promedian como ángulos (media
//     circular): la media de 350° y 10° es 0°, no 180°.
//   - Cada hora rellenada lleva `estimados: [campos]`, para decirlo en la
//     pantalla. Nunca se presenta un relleno como dato medido.
//   - Si no hay ni datos ni recuerdo de una variable, se queda vacía.
(function (raiz) {
  var N_MEDIA = 5;
  var CAMPOS = [
    "nivelMar", "ola", "tempAgua", "olaMarAbierto", "periodo", "dirOla",
    "fondoAltura", "fondoPeriodo", "fondoCoef",
    "viento", "vientoDir", "presion", "lluvia",
  ];
  var ANGULOS = { dirOla: true, vientoDir: true };
  // Ningún recuerdo vale más de 3 días: el mar de hace una semana no dice nada.
  var RECUERDO_MAX_MS = 72 * 3600e3;

  function num(v) { return typeof v === "number" && isFinite(v); }

  function media(valores, angulo) {
    if (!valores.length) return null;
    if (angulo) {
      var sx = 0, sy = 0;
      for (var i = 0; i < valores.length; i++) {
        var r = valores[i] * Math.PI / 180;
        sx += Math.cos(r); sy += Math.sin(r);
      }
      if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return valores[valores.length - 1];
      var g = Math.atan2(sy, sx) * 180 / Math.PI;
      return Math.round(((g % 360) + 360) % 360);
    }
    var s = 0;
    for (var j = 0; j < valores.length; j++) s += valores[j];
    return +(s / valores.length).toFixed(3);
  }

  // Rellena en el sitio y devuelve { horas, estimados: [campos que se han
  // rellenado en alguna hora] }. recuerdo: { campo: [valores] } o null.
  function rellenarHoras(horas, recuerdo) {
    var usados = {};
    for (var c = 0; c < CAMPOS.length; c++) {
      var campo = CAMPOS[c];
      var previos = recuerdo && Array.isArray(recuerdo[campo]) ? recuerdo[campo].filter(num).slice(-N_MEDIA) : [];
      for (var i = 0; i < horas.length; i++) {
        var h = horas[i];
        if (num(h[campo])) { previos.push(h[campo]); if (previos.length > N_MEDIA) previos.shift(); continue; }
        var m = media(previos, !!ANGULOS[campo]);
        if (m === null) continue;
        h[campo] = m;
        (h.estimados || (h.estimados = [])).push(campo);
        usados[campo] = true;
        previos.push(m); if (previos.length > N_MEDIA) previos.shift();
      }
    }
    return { horas: horas, estimados: Object.keys(usados) };
  }

  // Últimos N_MEDIA valores REALES de cada campo hasta la hora actual
  // (incluida). Para guardarlo y usarlo la próxima vez que falle algo.
  function recuerdoDe(horas, horaActual, ahoraMs) {
    var out = { guardado: ahoraMs || Date.now() };
    var hasta = String(horaActual || "").slice(0, 13);
    for (var c = 0; c < CAMPOS.length; c++) {
      var campo = CAMPOS[c], vals = [];
      for (var i = 0; i < horas.length; i++) {
        var h = horas[i];
        if (hasta && String(h.hora).slice(0, 13) > hasta) break;
        if (num(h[campo]) && !(h.estimados && h.estimados.indexOf(campo) >= 0)) vals.push(h[campo]);
      }
      if (vals.length) out[campo] = vals.slice(-N_MEDIA);
    }
    return out;
  }

  function recuerdoVigente(recuerdo, ahoraMs) {
    if (!recuerdo || !num(recuerdo.guardado)) return null;
    return (ahoraMs || Date.now()) - recuerdo.guardado <= RECUERDO_MAX_MS ? recuerdo : null;
  }

  // Si fallaron las dos peticiones: el eje de horas se construye desde la
  // hora local actual ("AAAA-MM-DDTHH:MM"), n horas, sin datos (se rellenan
  // luego con el recuerdo).
  function horasVacias(horaActual, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(String(horaActual || ""));
    if (!m) return [];
    var base = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]);
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = new Date(base + i * 3600e3).toISOString();
      out.push({ hora: d.slice(0, 13) + ":00" });
    }
    return out;
  }

  var api = {
    N_MEDIA: N_MEDIA, CAMPOS: CAMPOS, RECUERDO_MAX_MS: RECUERDO_MAX_MS,
    media: media, rellenarHoras: rellenarHoras, recuerdoDe: recuerdoDe,
    recuerdoVigente: recuerdoVigente, horasVacias: horasVacias,
  };
  raiz.RellenoDatos = api;
})(typeof window !== "undefined" ? window : globalThis);
