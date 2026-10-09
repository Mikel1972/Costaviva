// assets/js/plegar-tarjeta.js
// Tarjetas de capa del dock que se pueden minimizar (2026-10-09, Mikel, con
// una captura del iPhone: la tarjeta de 〰 Frentes ocupaba casi media
// pantalla y tapaba los spots de la costa; "Debe poder minimizarse para
// tener más visión").
//
// Sirve para las tarjetas de capa del dock (#tarjetasMapa): la de las capas
// de mar (🌿 clorofila, 🌡 temperatura, 〰 frentes, 🌊 corriente, que
// comparten #capaMarPanel) y la del viento. Rayos ya es una línea; la
// lluvia la monta lluvia-animada.js con sus botones de reproducir.
//
// Cabecera con un botón chevron (44x44 px, aria-expanded, aria-controls).
// Minimizada = una línea: icono + nombre corto + la escala de colores sin
// texto. Los créditos de Copernicus siguen en la vista expandida y, siempre,
// en los créditos del mapa (ⓒ Fuentes).
//
// Estado inicial (decisión de Claude, explicada en CLAUDE.md):
//   - si el usuario la minimizó o la abrió a mano, se respeta (localStorage,
//     por tarjeta, solo comodidad: sin almacenamiento todo funciona igual);
//   - si no, en el móvil (< 600 px) la primera vez sale entera (con la
//     explicación plegada) para que se entienda la leyenda, y a partir de la
//     segunda vez, minimizada; en escritorio, entera.
//
// Script clásico: deja window.PlegarTarjeta. Lo puro (estadoInicial) se
// prueba en test/plegar-tarjeta.test.js. Sin on*= (CSP).
(function (raiz) {
  var PREFIJO = "cv_tarjeta_";
  var ANCHO_MOVIL = 600;

  function leer(almacen, clave) {
    try { return almacen ? almacen.getItem(clave) : null; } catch (e) { return null; }
  }
  function escribir(almacen, clave, valor) {
    try { if (almacen) almacen.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ }
  }

  // guardado: "1" (la minimizó), "0" (la abrió) o null; vista: ya se había
  // enseñado antes; movil: pantalla estrecha. Devuelve true = minimizada.
  function estadoInicial(o) {
    if (o.guardado === "1") return true;
    if (o.guardado === "0") return false;
    return !!(o.movil && o.vista);
  }

  // opciones: { tarjeta, boton, id, almacen?, movil?: () => bool,
  //             alCambiar?: (plegada) => void }
  function montar(o) {
    var tarjeta = o.tarjeta, boton = o.boton;
    if (!tarjeta || !boton) return null;
    var ventana = tarjeta.ownerDocument.defaultView || raiz;
    var almacen = o.almacen !== undefined ? o.almacen : (function () {
      try { return ventana.localStorage; } catch (e) { return null; }
    })();
    var movil = o.movil || function () {
      return !!(ventana.matchMedia && ventana.matchMedia("(max-width: " + (ANCHO_MOVIL - 1) + "px)").matches);
    };
    var clavePlegada = PREFIJO + "plegada_" + o.id, claveVista = PREFIJO + "vista_" + o.id;

    function poner(plegada) {
      tarjeta.classList.toggle("plegada", plegada);
      boton.setAttribute("aria-expanded", plegada ? "false" : "true");
      boton.setAttribute("aria-label", plegada ? "Expandir la leyenda" : "Minimizar la leyenda");
      boton.title = plegada ? "Expandir" : "Minimizar";
      boton.textContent = plegada ? "▴" : "▾";
      if (o.alCambiar) o.alCambiar(plegada);
    }
    boton.addEventListener("click", function () {
      var plegada = !tarjeta.classList.contains("plegada");
      escribir(almacen, clavePlegada, plegada ? "1" : "0");
      poner(plegada);
    });
    // Llamar cada vez que la tarjeta se enseña (al encender la capa).
    function alAbrir() {
      var plegada = estadoInicial({ guardado: leer(almacen, clavePlegada), vista: leer(almacen, claveVista) === "1", movil: movil() });
      escribir(almacen, claveVista, "1");
      poner(plegada);
      return plegada;
    }
    return { alAbrir: alAbrir, poner: poner, plegada: function () { return tarjeta.classList.contains("plegada"); } };
  }

  raiz.PlegarTarjeta = { estadoInicial: estadoInicial, montar: montar, PREFIJO: PREFIJO, ANCHO_MOVIL: ANCHO_MOVIL };
})(typeof window !== "undefined" ? window : globalThis);
