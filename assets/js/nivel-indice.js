// assets/js/nivel-indice.js
// Nivel (bueno / medio / malo / sd) y color de los dos índices de la app
// (2026-10-08, rediseño "Amanecer"). Script clásico: deja window.NivelIndice
// para index.html y diario.html, y los tests lo cargan con import().
//
// OJO, los dos índices van al revés:
//   - Índice de mar (oleaje + viento + ángulo entre ambos): más alto = mar
//     MÁS MOVIDO, peor para salir. Es lo que dicen la fórmula indiceMar() y la
//     leyenda del mapa (tranquilo / moderado / agitado).
//   - Índice de pesca (0-100, 50 = día normal): más alto = MEJOR.
// Hasta este cambio los dos se pintaban con la misma escala (verde = bajo), y
// un 77 de pesca salía en el color de "malo".
//
// Colores (decisión de Mikel): verde = bueno, amarillo sol = regular,
// coral = malo. Son los --nivel-* de assets/css/costaviva.css; aquí van en
// hexadecimal porque también se usan en SVG/canvas, donde var() no vale.
(function (raiz) {
  var COLORES = { bueno: "#4ADE80", medio: "#FFC24B", malo: "#FF6B6B", sd: "#A9B4D0" };

  function sinDato(v) {
    return v === null || v === undefined || Number.isNaN(Number(v));
  }
  function nivelMar(v) {
    if (sinDato(v)) return "sd";
    return v < 34 ? "bueno" : v < 67 ? "medio" : "malo";
  }
  function nivelPesca(v) {
    if (sinDato(v)) return "sd";
    return v >= 60 ? "bueno" : v >= 40 ? "medio" : "malo";
  }
  function colorNivel(nivel) {
    return COLORES[nivel] || COLORES.sd;
  }

  raiz.NivelIndice = { COLORES: COLORES, nivelMar: nivelMar, nivelPesca: nivelPesca, colorNivel: colorNivel };
})(typeof window !== "undefined" ? window : globalThis);
