// assets/js/creditos-mapa.js
// Créditos del mapa plegables en el móvil (2026-10-08, bug aprobado por
// Mikel: en el móvil, y en escritorio cuando la atribución ocupaba dos
// líneas, los créditos tapaban el botón ⓘ de la leyenda abajo a la izquierda).
//
// Los créditos son obligatorios (OpenFreeMap / OpenMapTiles / OpenStreetMap,
// EMODnet, Copernicus, Open-Meteo, EUMETSAT...), así que no se quitan ni se
// esconden sin más: se hace lo mismo que el control de atribución "compacto"
// de MapLibre / Mapbox.
//   - Móvil (<= 720 px): al cargar se ven enteros; en cuanto el usuario toca o
//     arrastra el mapa (o a los 6 s) se pliegan en una píldora "ⓒ Fuentes"
//     abajo a la derecha, siempre visible. Tocarla los vuelve a abrir.
//     Abiertos, nunca llegan al ⓘ (CSS: max-width deja libre su columna).
//   - Escritorio: siempre abiertos; la esquina de abajo a la derecha empieza
//     a la derecha del ⓘ (CSS), así que por largos que sean nunca lo tapan.
//
// Script clásico: deja window.CreditosMapa. Lo puro (debePlegar, textoBoton)
// se prueba en test/creditos-mapa.test.js. Sin on*= (CSP): addEventListener.
(function (raiz) {
  var ANCHO_MOVIL = 720;   // mismo corte que el @media del móvil en index.html
  var PLEGAR_A_LOS_MS = 6000;

  // ¿Se pueden plegar los créditos con este ancho de ventana?
  function debePlegar(ancho) {
    return typeof ancho === "number" && ancho > 0 && ancho <= ANCHO_MOVIL;
  }

  // Texto y etiqueta accesible del botón según el estado.
  function textoBoton(abiertos) {
    return abiertos
      ? { texto: "✕", etiqueta: "Ocultar las fuentes y créditos del mapa" }
      : { texto: "ⓒ Fuentes", etiqueta: "Ver las fuentes y créditos del mapa" };
  }

  function montar(map, opciones) {
    opciones = opciones || {};
    var ctl = map && map.attributionControl;
    if (!ctl || !ctl._container || typeof ctl._update !== "function") return null;
    var doc = ctl._container.ownerDocument;
    var ventana = doc.defaultView || raiz;
    var caja = ctl._container;
    caja.classList.add("creditos-mapa");
    caja.id = caja.id || "creditosMapa";

    var boton = doc.createElement("button");
    boton.type = "button";
    boton.className = "creditos-boton";
    boton.setAttribute("aria-controls", "creditosTexto");
    var texto = doc.createElement("span");
    texto.className = "creditos-texto";
    texto.id = "creditosTexto";

    var plegados = false;
    function pintarBoton() {
      var t = textoBoton(!plegados);
      boton.textContent = t.texto;
      boton.setAttribute("aria-label", t.etiqueta);
      boton.setAttribute("aria-expanded", plegados ? "false" : "true");
      caja.classList.toggle("creditos-plegados", plegados);
    }
    function ponerPlegados(v) {
      plegados = !!v && debePlegar(ventana.innerWidth);
      pintarBoton();
    }

    // Leaflet reescribe el innerHTML del control en cada add/removeAttribution
    // (lluvia, rayos, isóbatas, Copernicus...): se vuelve a montar botón +
    // texto después. Leaflet va fijado a 1.9.4 (cdnjs con versión exacta).
    var original = ctl._update;
    ctl._update = function () {
      original.apply(this, arguments);
      texto.innerHTML = caja.innerHTML;
      caja.innerHTML = "";
      caja.appendChild(boton);
      caja.appendChild(texto);
    };
    ctl._update();
    pintarBoton();

    L.DomEvent.disableClickPropagation(boton);
    boton.addEventListener("click", function () {
      ponerPlegados(!plegados);
      if (!plegados && debePlegar(ventana.innerWidth) && opciones.alAbrir) opciones.alAbrir();
    });

    // Primera interacción con el mapa (o a los 6 s): se pliegan, solo una vez.
    var hecho = false;
    function plegarUnaVez() {
      if (hecho) return;
      hecho = true;
      ventana.clearTimeout(temporizador);
      map.off("dragstart click", plegarUnaVez);
      if (debePlegar(ventana.innerWidth)) ponerPlegados(true);
    }
    var temporizador = ventana.setTimeout(plegarUnaVez, opciones.plegarALosMs || PLEGAR_A_LOS_MS);
    map.on("dragstart click", plegarUnaVez);
    // Al pasar a escritorio (girar la tableta, ventana más ancha) se abren.
    ventana.addEventListener("resize", function () {
      if (plegados && !debePlegar(ventana.innerWidth)) ponerPlegados(false);
    });

    return {
      plegar: function () { ponerPlegados(true); },
      abrir: function () { ponerPlegados(false); },
      plegados: function () { return plegados; },
    };
  }

  raiz.CreditosMapa = {
    ANCHO_MOVIL: ANCHO_MOVIL, PLEGAR_A_LOS_MS: PLEGAR_A_LOS_MS,
    debePlegar: debePlegar, textoBoton: textoBoton, montar: montar,
  };
})(typeof window !== "undefined" ? window : globalThis);
