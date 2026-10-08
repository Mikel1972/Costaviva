// assets/js/tarjetas-mapa.js
// Tarjetas del mapa apiladas en un "dock" (2026-10-08, bug aprobado por Mikel:
// en el móvil la tarjeta de rayos, abajo a la derecha, tapaba el panel de la
// lluvia animada, abajo a la izquierda, y la leyenda del ⓘ abierta).
//
// Todas las tarjetas que se abren sobre la parte de abajo del mapa viven en
// un único contenedor, #tarjetasMapa (index.html), que las apila en vertical
// y en un orden fijo (CSS `order`), de arriba a abajo:
//   rayos > lluvia > clorofila / temperatura del agua > viento > leyenda ⓘ.
// Así dos tarjetas no pueden pisarse nunca: el navegador las coloca una
// encima de otra. Este script solo decide DÓNDE empieza el dock y cuánto
// puede crecer:
//   - abajo: por encima de lo que haya debajo en su misma columna (botón ⓘ,
//     créditos del mapa abiertos, leyendas de Leaflet de abajo a la izquierda
//     en escritorio: profundidad y tipo de fondo);
//   - arriba: hasta lo que haya en la esquina superior izquierda (zoom y, en
//     el móvil, las leyendas del fondo). Si no cabe, el dock hace scroll.
// Las columnas de botones de capas quedan fuera: el dock acaba a su
// izquierda (CSS `right`).
//
// Script clásico: deja window.TarjetasMapa. Lo puro (solapan, fondoDock,
// techoDock, altoMaxDock) se prueba en test/tarjetas-mapa.test.js.
// Sin on*= (CSP).
(function (raiz) {
  var HUECO = 8;        // separación entre el dock y lo que tiene encima/debajo
  var ALTO_MINIMO = 120; // por pequeña que sea la pantalla, al menos esto (con scroll)

  // Rectángulos en px relativos al contenedor del mapa:
  // { izq, der, arriba, abajo } (como getBoundingClientRect, sin ancho/alto).
  function solapan(a, b) {
    return !!a && !!b && a.izq < b.der && b.izq < a.der;
  }

  function visible(r) {
    return !!r && r.der > r.izq && r.abajo > r.arriba;
  }

  // Distancia (px) desde el borde inferior del contenedor a la que empieza el
  // dock: justo por encima del obstáculo más alto de su columna.
  function fondoDock(o) {
    var alto = o.alto, base = o.base == null ? HUECO : o.base, hueco = o.hueco == null ? HUECO : o.hueco;
    var fondo = base;
    (o.obstaculos || []).forEach(function (r) {
      if (!visible(r) || !solapan(r, o.dock)) return;
      fondo = Math.max(fondo, Math.ceil(alto - r.arriba + hueco));
    });
    return fondo;
  }

  // Hasta dónde (px desde arriba) puede subir el dock sin tapar lo de arriba.
  function techoDock(o) {
    var hueco = o.hueco == null ? HUECO : o.hueco;
    var techo = hueco;
    (o.obstaculos || []).forEach(function (r) {
      if (!visible(r) || !solapan(r, o.dock)) return;
      techo = Math.max(techo, Math.ceil(r.abajo + hueco));
    });
    return techo;
  }

  function altoMaxDock(o) {
    return Math.max(o.minimo == null ? ALTO_MINIMO : o.minimo, Math.floor(o.alto - o.fondo - o.techo));
  }

  function rectRelativo(el, rc) {
    var b = el.getBoundingClientRect();
    return { izq: b.left - rc.left, der: b.right - rc.left, arriba: b.top - rc.top, abajo: b.bottom - rc.top };
  }

  // opciones: { dock, contenedor, abajo: () => Element[], arriba: () => Element[],
  //            cambiantes: Element[] (donde entran y salen obstáculos) }
  function montar(opciones) {
    var dock = opciones.dock, contenedor = opciones.contenedor;
    if (!dock || !contenedor) return null;
    var ventana = dock.ownerDocument.defaultView || raiz;
    var pendiente = false;

    function medir() {
      pendiente = false;
      var rc = contenedor.getBoundingClientRect();
      if (!rc.height) return;
      var rd = dock.getBoundingClientRect();
      var columna = { izq: rd.left - rc.left, der: rd.right - rc.left };
      var deAbajo = opciones.abajo().map(function (el) { return rectRelativo(el, rc); });
      var deArriba = opciones.arriba().map(function (el) { return rectRelativo(el, rc); });
      var fondo = fondoDock({ alto: rc.height, dock: columna, obstaculos: deAbajo });
      var techo = techoDock({ dock: columna, obstaculos: deArriba });
      dock.style.bottom = fondo + "px";
      dock.style.maxHeight = altoMaxDock({ alto: rc.height, fondo: fondo, techo: techo }) + "px";
      // Solo recoge toques cuando hay que hacer scroll; si no, el mapa de
      // detrás sigue funcionando entre tarjeta y tarjeta.
      dock.classList.toggle("tarjetas-desborda", dock.scrollHeight > dock.clientHeight + 1);
    }
    function pedir() {
      if (pendiente) return;
      pendiente = true;
      (ventana.requestAnimationFrame || ventana.setTimeout)(medir);
    }

    var vigilados = [];
    var ro = typeof ventana.ResizeObserver === "function" ? new ventana.ResizeObserver(pedir) : null;
    function vigilar() {
      if (!ro) return;
      var todos = [contenedor, dock].concat(opciones.abajo(), opciones.arriba());
      todos.forEach(function (el) {
        if (el && vigilados.indexOf(el) < 0) { vigilados.push(el); ro.observe(el); }
      });
    }
    // Las leyendas de Leaflet entran y salen y los créditos se pliegan: se
    // vuelve a mirar qué vigilar cuando cambia algo en las esquinas del mapa
    // (solo ahí: el resto del mapa cambia de clases a cada animación).
    var mo = typeof ventana.MutationObserver === "function"
      ? new ventana.MutationObserver(function () { vigilar(); pedir(); })
      : null;
    (opciones.cambiantes || []).forEach(function (el) {
      if (mo && el) mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    });
    ventana.addEventListener("resize", pedir);
    vigilar();
    medir();
    return { medir: medir };
  }

  raiz.TarjetasMapa = {
    HUECO: HUECO, ALTO_MINIMO: ALTO_MINIMO,
    solapan: solapan, fondoDock: fondoDock, techoDock: techoDock, altoMaxDock: altoMaxDock,
    montar: montar,
  };
})(typeof window !== "undefined" ? window : globalThis);
