// assets/js/vista-3d.js
//
// Vista 3D del relieve de la costa y del FONDO DEL MAR (2026-11-08, Mikel:
// "¿y con posibilidad de 3D?" -> "sí"). El mapa de la app (Leaflet) no se
// puede inclinar, así que el botón "3D" abre encima un mapa MapLibre propio,
// en el mismo sitio y zoom, inclinado: se gira con dos dedos (o con el botón
// derecho) y se inclina arrastrando con dos dedos hacia arriba.
//
// Sin coste ni clave:
//   - Relieve: Terrain Tiles de AWS Open Data (formato terrarium), que
//     incluyen la batimetría (ETOPO1/GEBCO y otras) bajo el mar: frente a
//     Bizkaia marcan el cañón a -1.000 m. Uso libre con atribución.
//   - Mar: coloreado por profundidad (capa color-relief) con sombreado.
//   - Tierra: ortofoto PNOA del IGN en España (como el fondo satélite) y
//     arena fuera.
//   - El agua de OpenFreeMap tapa la foto del IGN en el mar para que se vea
//     el fondo.
// Lo puro (estilo y vista inicial) se prueba en test/vista-3d.test.js.

import { URL_PNOA, ATRIBUCION_PNOA, RECTANGULOS_ESPANA } from "./capa-satelite.js";

export const URL_DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const URL_TESELAS_OFM = "https://tiles.openfreemap.org/planet";
export const ATRIBUCION_DEM =
  'Relieve: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> ' +
  "(Mapzen/Tilezen: SRTM, GMTED, ETOPO1, GEBCO y otras)";
export const ATRIBUCION_OFM =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © OpenMapTiles, ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const EXAGERACION = 1.5;
export const ZOOM_MAX_BATIMETRIA = 10;
export const INCLINACION = 60;

// Colores del fondo por profundidad (m); por encima de 0, transparente.
export const COLORES_PROFUNDIDAD = [
  [-4000, "#06182e"], [-2000, "#0a2a4f"], [-1000, "#0f3d6e"], [-200, "#1b5f99"],
  [-100, "#2a7bb8"], [-50, "#3f97cf"], [-20, "#63b3e0"], [-1, "#93cdea"],
];

export function estilo3D() {
  const relieve = ["interpolate", ["linear"], ["elevation"]];
  for (const [m, c] of COLORES_PROFUNDIDAD) relieve.push(m, c);
  relieve.push(0, "rgba(0,0,0,0)");
  // Las Terrain Tiles solo traen la batimetría hasta zoom 10: desde el 11 el
  // mar vale 0 (SRTM). Por eso el fondo (color y forma 3D) sale de las de
  // zoom ≤ ZOOM_MAX_BATIMETRIA, ampliadas, y solo el sombreado de tierra de
  // las de detalle.
  const sources = {
    dem: { type: "raster-dem", tiles: [URL_DEM], encoding: "terrarium", tileSize: 256, maxzoom: ZOOM_MAX_BATIMETRIA, attribution: ATRIBUCION_DEM },
    demTerreno: { type: "raster-dem", tiles: [URL_DEM], encoding: "terrarium", tileSize: 256, maxzoom: ZOOM_MAX_BATIMETRIA },
    demSombra: { type: "raster-dem", tiles: [URL_DEM], encoding: "terrarium", tileSize: 256, maxzoom: 15 },
    ofm: { type: "vector", url: URL_TESELAS_OFM, attribution: ATRIBUCION_OFM },
  };
  const layers = [{ id: "fondo", type: "background", paint: { "background-color": "#E9DFCC" } }];
  RECTANGULOS_ESPANA.forEach(([[s, o], [n, e]], i) => {
    sources[`pnoa${i}`] = { type: "raster", tiles: [URL_PNOA], tileSize: 256, maxzoom: 19, bounds: [o, s, e, n], ...(i === 0 ? { attribution: ATRIBUCION_PNOA } : {}) };
    layers.push({ id: `pnoa${i}`, type: "raster", source: `pnoa${i}` });
  });
  layers.push(
    // Donde el relieve da 0 m junto a la costa (sin batimetría fina), el agua
    // sale del color de poca profundidad, no de un azul oscuro a manchas.
    { id: "agua", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": "#93cdea" } },
    { id: "profundidad", type: "color-relief", source: "dem", paint: { "color-relief-color": relieve } },
    { id: "sombreado", type: "hillshade", source: "demSombra", paint: { "hillshade-exaggeration": 0.5, "hillshade-shadow-color": "#04101f" } },
  );
  return { version: 8, sources, layers, terrain: { source: "demTerreno", exaggeration: EXAGERACION } };
}

// Vista inicial a partir de la de Leaflet (teselas de 256 px; MapLibre usa
// 512, de ahí el -1).
export function vistaInicial(centro, zoomLeaflet) {
  return { center: [centro.lng, centro.lat], zoom: Math.max(1, zoomLeaflet - 1), pitch: INCLINACION, bearing: 0 };
}

// ---------------------------------------------------------------------------
// Navegador
export function abrir(mapLeaflet, textos = {}) {
  const gl = globalThis.maplibregl;
  if (!gl) return null;
  const capa = document.createElement("div");
  capa.className = "vista-3d";
  capa.setAttribute("role", "dialog");
  capa.setAttribute("aria-label", textos.titulo || "Vista 3D");
  const cont = document.createElement("div");
  cont.className = "vista-3d-mapa";
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "vista-3d-cerrar";
  cerrar.textContent = "✕";
  cerrar.setAttribute("aria-label", textos.cerrar || "Cerrar");
  const ayuda = document.createElement("div");
  ayuda.className = "vista-3d-ayuda";
  ayuda.textContent = textos.ayuda || "";
  capa.append(cont, cerrar, ayuda);
  document.body.appendChild(capa);
  const v = vistaInicial(mapLeaflet.getCenter(), mapLeaflet.getZoom());
  const m = new gl.Map({ container: cont, style: estilo3D(), ...v, maxPitch: 85, attributionControl: { compact: true } });
  m.addControl(new gl.NavigationControl({ visualizePitch: true }), "top-left");
  const fuera = () => { try { m.remove(); } catch {} capa.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") fuera(); };
  cerrar.addEventListener("click", fuera);
  document.addEventListener("keydown", esc);
  setTimeout(() => ayuda.classList.add("oculta"), 4000);
  return { mapa: m, cerrar: fuera };
}
