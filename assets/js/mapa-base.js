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

  // Color del mar del mapa base, cambiable en vivo (2026-11-08): con el
  // satélite puesto, el mar donde el IGN no tiene foto se pinta del mismo azul
  // oscuro que el mar de la foto (capa-satelite.js), para que no se note el
  // corte. null = el color normal.
  var capaVector = null;
  var satelitePedido = null;
  var modoVector = false;
  var colorMarPedido = null;
  function ponerColorMar(color) {
    colorMarPedido = color;
    var m = capaVector && capaVector.getMaplibreMap && capaVector.getMaplibreMap();
    if (!m) return;
    var aplicar = function () {
      (m.getStyle().layers || []).forEach(function (capa) {
        if (capa.id === "water" && capa.type === "fill") m.setPaintProperty(capa.id, "fill-color", color || COLORES.mar);
      });
    };
    if (m.isStyleLoaded()) aplicar();
    else m.once("load", aplicar);
  }

  // Satélite DENTRO del mapa vectorial (2026-11-08, Mikel: "quedan estos
  // restos" en Santoña). La foto va como capa raster ENTRE dos copias del
  // agua: la de abajo (opaca, azul oscuro) rellena donde no hay foto; la de
  // arriba tapa el mar de la foto de lejos (bloques grises y verdosos de
  // Sentinel-2) con el contorno exacto de la costa, y se desvanece al acercar
  // para que se vea el mar real junto a las rocas. cfg: { rectangulos,
  // urlTesela(z, x, y), procesar(rgba, z, lado), colorMar, zoomDesde,
  // zoomHasta, maxzoom }. Devuelve false si no hay mapa vectorial (entonces
  // capa-satelite.js usa su capa de Leaflet).
  var protocoloListo = false;
  var CAPAS_SAT = [];
  function ponerSatelite(activo, cfg) {
    var m = capaVector && capaVector.getMaplibreMap && capaVector.getMaplibreMap();
    var gl = raiz.maplibregl;
    if (!m || !gl) return false;
    var hacer = function () {
      var capas = m.getStyle().layers || [];
      var iAgua = capas.findIndex(function (c) { return c.id === "water" && c.type === "fill"; });
      if (iAgua < 0) return;
      var siguiente = capas[iAgua + 1] && capas[iAgua + 1].id;
      CAPAS_SAT.forEach(function (id) { if (m.getLayer(id)) m.removeLayer(id); if (m.getSource(id)) m.removeSource(id); });
      CAPAS_SAT = [];
      // Lo que pinta el mapa por encima del agua (arena, carreteras, edificios,
      // nombres) se esconde con el satélite: se ve la foto limpia.
      var encima = capas.slice(iAgua + 1).map(function (c) { return c.id; })
        .filter(function (id) { return id.indexOf("satelite-") !== 0; });
      encima.forEach(function (id) { m.setLayoutProperty(id, "visibility", activo ? "none" : "visible"); });
      if (!activo) {
        m.setPaintProperty("water", "fill-color", COLORES.mar);
        return;
      }
      if (!protocoloListo) {
        gl.addProtocol("pnoa", function (params, abort) {
          var p = params.url.replace("pnoa://", "").split("/").map(Number);
          return fetch(cfg.urlTesela(p[0], p[1], p[2]), { signal: abort && abort.signal, mode: "cors" })
            .then(function (r) { if (!r.ok) throw new Error("PNOA " + r.status); return r.blob(); })
            .then(function (b) { return createImageBitmap(b); })
            .then(function (img) {
              var lado = img.width;
              var c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(lado, lado) : Object.assign(document.createElement("canvas"), { width: lado, height: lado });
              var ctx = c.getContext("2d");
              ctx.drawImage(img, 0, 0);
              var datos = ctx.getImageData(0, 0, lado, lado);
              cfg.procesar(datos.data, p[0], lado);
              ctx.putImageData(datos, 0, 0);
              return c.convertToBlob ? c.convertToBlob({ type: "image/png" }) : new Promise(function (ok) { c.toBlob(ok, "image/png"); });
            })
            .then(function (b) { return b.arrayBuffer(); })
            .then(function (data) { return { data: data }; });
        });
        protocoloListo = true;
      }
      m.setPaintProperty("water", "fill-color", cfg.colorMar);
      cfg.rectangulos.forEach(function (r, i) {
        var id = "satelite-" + i;
        m.addSource(id, { type: "raster", tiles: ["pnoa://{z}/{x}/{y}"], tileSize: 256, maxzoom: cfg.maxzoom, bounds: [r[0][1], r[0][0], r[1][1], r[1][0]] });
        m.addLayer({ id: id, type: "raster", source: id }, siguiente);
        CAPAS_SAT.push(id);
      });
      var tapa = capas[iAgua];
      m.addLayer({
        id: "satelite-mar", type: "fill", source: tapa.source, "source-layer": tapa["source-layer"], filter: tapa.filter,
        paint: { "fill-color": cfg.colorMar, "fill-antialias": false,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], cfg.zoomDesde, 1, cfg.zoomHasta, 0] },
      }, siguiente);
      CAPAS_SAT.push("satelite-mar");
    };
    if (m.isStyleLoaded()) hacer();
    else m.once("load", hacer);
    return true;
  }
  function vectorListo() { return !!(capaVector && capaVector.getMaplibreMap && capaVector.getMaplibreMap()); }

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
    modoVector = !!conVector;
    var relieve = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
      layers: "emodnet:mean_atlas_land",
      format: "image/png",
      transparent: true,
      pane: "relieveFondo",
      className: conVector ? "relieve-emodnet" : "",
      opacity: conVector ? 0.45 : 1,
      attribution: ATRIBUCION_RELIEVE,
      // EMODnet solo cubre Europa: con el mapa que llega al mundo entero
      // (Nueva Zelanda, 2026-10-11) no se piden teselas fuera de su zona.
      bounds: L.latLngBounds([[15, -45], [90, 70]]),
    });

    if (conVector) {
      fetch(URL_ESTILO)
        .then(function (r) {
          if (!r.ok) throw new Error("estilo " + r.status);
          return r.json();
        })
        .then(function (estilo) {
          capaVector = L.maplibreGL({ style: retocarEstilo(estilo), pane: "mapaBase", attributionControl: false, interactive: false }).addTo(map);
          if (colorMarPedido) ponerColorMar(colorMarPedido);
          if (satelitePedido) ponerSatelite(true, satelitePedido);
          (raiz.__alVectorListo || []).forEach(function (f) { try { f(); } catch (e) {} });
          map.attributionControl.addAttribution(ATRIBUCION);
        })
        .catch(function (e) {
          // Sin estilo (red caída, OpenFreeMap fuera de servicio): el relieve
          // pasa a ser el mapa base, opaco y en todos los zooms.
          console.warn("Mapa base vectorial no disponible, se usa el relieve de EMODnet:", e.message);
          relieve.setOpacity(1);
          // Como mapa base tiene que cubrir también fuera de Europa (NZ).
          relieve.options.bounds = null;
          if (relieve.redraw) relieve.redraw();
          relieve.getContainer && relieve.getContainer() && relieve.getContainer().classList.remove("relieve-emodnet");
          conVector = false;
          modoVector = false;
          (raiz.__alVectorFallido || []).forEach(function (f) { try { f(); } catch (e) {} });
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
    ZOOM_MAX_RELIEVE: ZOOM_MAX_RELIEVE, COLORES: COLORES, retocarEstilo: retocarEstilo, montar: montar, ponerColorMar: ponerColorMar,
    ponerSatelite: function (activo, cfg) { satelitePedido = activo ? cfg : null; return ponerSatelite(activo, cfg); },
    vectorListo: vectorListo, usaVector: function () { return modoVector; },
  };
})(typeof window !== "undefined" ? window : globalThis);
