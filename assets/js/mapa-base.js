// assets/js/mapa-base.js
// Mapa base de la app (2026-10-08, decisión de Mikel: "sí, cambiar el mapa
// base"). Sustituye a las teselas de Esri (World Ocean Base / World Street
// Map), cuya licencia no cubre el uso comercial sin suscripción de ArcGIS
// (ver CLAUDE.md, "Aspecto Amanecer").
//
//   - Base: OpenFreeMap, estilo "Liberty" (teselas vectoriales de
//     OpenMapTiles con datos de OpenStreetMap), pintado con MapLibre GL dentro
//     de Leaflet con el plugin oficial @maplibre/maplibre-gl-leaflet.
//     Condiciones comprobadas en https://openfreemap.org/ el 2026-10-08: "Is
//     commercial usage allowed? Yes" y "Attribution is required ... OpenFreeMap
//     © OpenMapTiles Data from OpenStreetMap". Sin clave y sin SLA.
//   - Colores retocados EN EL ESTILO (no con filtros CSS): tierra arena y mar
//     más vivo, a juego con el aspecto "Amanecer".
//   - Encima, a zoom bajo y medio, el relieve del fondo y de la costa de
//     EMODnet Bathymetry (WMS, CC BY 4.0) semitransparente.
//   - Si el navegador no tiene WebGL, el relieve de EMODnet hace de mapa base
//     opaco: la app nunca se queda sin mapa.
//
// Script clásico: deja window.MapaBase. La parte pura (retocarEstilo) se
// prueba en test/mapa-base.test.js.
(function (raiz) {
  // Idiomas (2026-10-09): en inglés, el texto de assets/i18n/en.js; en
  // español (o en páginas sin I18n, como admin.html) el de aquí, que es el
  // mismo que es.js (test/i18n.test.js lo comprueba).
  function tr(clave, es) {
    var I = (typeof window !== "undefined" ? window : globalThis).I18n;
    return I && I.idioma() !== "es" && I.existe(clave) ? I.t(clave) : es;
  }

  var URL_ESTILO = "https://tiles.openfreemap.org/styles/liberty";
  var ATRIBUCION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Data from © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
  var ATRIBUCION_RELIEVE = tr("mapa_base.relieve_prefijo", "Relieve:") +
    ' <a href="https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1" target="_blank" rel="noopener">EMODnet Bathymetry Consortium (DTM 2024)</a>, ' +
    '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  // Hasta este zoom se ve el relieve de EMODnet (su rejilla es de ~115 m:
  // más cerca se vería borroso y ya manda el detalle de OpenStreetMap).
  var ZOOM_MAX_RELIEVE = 11;

  // Colores del estilo (tokens de assets/css/costaviva.css, en hexadecimal
  // porque MapLibre no entiende var()).
  var COLORES = { tierra: "#FFF6EE", mar: "#7CC3EA", rio: "#7CC3EA", rotuloMar: "#13305E" };

  // Devuelve el estilo con la tierra arena y el mar vivo. No toca nada más:
  // capas, fuentes y atribuciones del estilo original se quedan tal cual.
  function retocarEstilo(estilo) {
    (estilo.layers || []).forEach(function (capa) {
      var p = (capa.paint = capa.paint || {});
      if (capa.id === "background") p["background-color"] = COLORES.tierra;
      else if (capa.id === "water" && capa.type === "fill") p["fill-color"] = COLORES.mar;
      else if (/^waterway/.test(capa.id) && capa.type === "line") p["line-color"] = COLORES.rio;
      else if (/^water_name/.test(capa.id) && capa.type === "symbol") p["text-color"] = COLORES.rotuloMar;
    });
    return estilo;
  }

  function hayWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  // Monta base + relieve en el mapa de Leaflet. Paneles propios por debajo de
  // tilePane (z-index 200), para que lluvia, rayos, batimetría, isóbatas,
  // viento, cámaras y spots queden SIEMPRE encima, se añadan cuando se añadan.
  function montar(map, L) {
    map.createPane("mapaBase").style.zIndex = 150;
    map.createPane("relieveFondo").style.zIndex = 160;
    map.getPane("mapaBase").style.pointerEvents = "none";
    map.getPane("relieveFondo").style.pointerEvents = "none";

    var conVector = hayWebGL() && L.maplibreGL && raiz.maplibregl;
    var relieve = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
      layers: "emodnet:mean_atlas_land",
      format: "image/png",
      transparent: true,
      pane: "relieveFondo",
      className: conVector ? "relieve-emodnet" : "",
      opacity: conVector ? 0.45 : 1,
      attribution: ATRIBUCION_RELIEVE,
    });

    if (conVector) {
      fetch(URL_ESTILO)
        .then(function (r) {
          if (!r.ok) throw new Error("estilo " + r.status);
          return r.json();
        })
        .then(function (estilo) {
          L.maplibreGL({ style: retocarEstilo(estilo), pane: "mapaBase", attributionControl: false, interactive: false }).addTo(map);
          map.attributionControl.addAttribution(ATRIBUCION);
        })
        .catch(function (e) {
          // Sin estilo (red caída, OpenFreeMap fuera de servicio): el relieve
          // pasa a ser el mapa base, opaco y en todos los zooms.
          console.warn("Mapa base vectorial no disponible, se usa el relieve de EMODnet:", e.message);
          relieve.setOpacity(1);
          relieve.getContainer && relieve.getContainer() && relieve.getContainer().classList.remove("relieve-emodnet");
          conVector = false;
          actualizar();
        });
    }

    // Leaflet con la animación de zoom desactivada no siempre "despierta" una
    // capa al cruzar su rango de zoom: se pone y se quita a mano.
    function actualizar() {
      var debe = !conVector || map.getZoom() <= ZOOM_MAX_RELIEVE;
      if (debe && !map.hasLayer(relieve)) relieve.addTo(map);
      if (!debe && map.hasLayer(relieve)) map.removeLayer(relieve);
    }
    actualizar();
    map.on("zoomend", actualizar);
  }

  raiz.MapaBase = {
    URL_ESTILO: URL_ESTILO, ATRIBUCION: ATRIBUCION, ATRIBUCION_RELIEVE: ATRIBUCION_RELIEVE,
    ZOOM_MAX_RELIEVE: ZOOM_MAX_RELIEVE, COLORES: COLORES, retocarEstilo: retocarEstilo, montar: montar,
  };
})(typeof window !== "undefined" ? window : globalThis);
