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

// Relieve fino de EMODnet (DTM, ~115 m, CC BY 4.0) en teselas propias, que
// prepara relieve-emodnet.yml (scripts/relieve/emodnet_teselas.py, mismas
// zonas). Dentro de una zona se usa ese; fuera, el de AWS.
export const URL_EMODNET = "https://imncbmizxkorotpeisic.supabase.co/storage/v1/object/public/fuentes-gratuitas/relieve-emodnet/{z}/{x}/{y}.png";
export const ATRIBUCION_EMODNET =
  'Relieve y fondo: <a href="https://emodnet.ec.europa.eu/en/bathymetry" target="_blank" rel="noopener">EMODnet Bathymetry Consortium (DTM)</a>, ' +
  '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
// [sur, oeste, norte, este]
export const ZONAS_EMODNET = {
  iberia: [35.0, -10.5, 46.5, 5.0],
  canarias: [27.4, -18.5, 29.6, -13.2],
  madeira: [32.3, -17.4, 33.2, -16.2],
  azores: [36.8, -31.5, 39.8, -24.8],
};
export function zonaEmodnet(lat, lon) {
  return Object.values(ZONAS_EMODNET).find(([s, o, n, e]) => lat >= s && lat <= n && lon >= o && lon <= e) || null;
}
// Fuente del relieve (fondo y forma 3D) para una vista que empieza en lat/lon.
export function fuenteRelieve(lat, lon) {
  const z = zonaEmodnet(lat, lon);
  return z
    ? { tiles: [URL_EMODNET], attribution: ATRIBUCION_EMODNET, bounds: [z[1], z[0], z[3], z[2]] }
    : { tiles: [URL_DEM], attribution: ATRIBUCION_DEM };
}

// Inclinación mínima (Mikel: "cuando lo inclino, pasa a 2D"): nunca plana.
export const INCLINACION_MINIMA = 25;

export const EXAGERACION = 1.5;
export const ZOOM_MAX_BATIMETRIA = 10;
// Más pantalla para el mapa (Mikel: "minimizar las franjas que no sean
// mapa"): inclinación de 50° al abrir y 70° como máximo, para que el cielo
// no se coma la parte de arriba; los créditos, plegados en un ⓘ.
export const INCLINACION = 50;
export const INCLINACION_MAXIMA = 70;

// Colores del fondo por profundidad (m); por encima de 0, transparente.
export const COLORES_PROFUNDIDAD = [
  [-4000, "#06182e"], [-2000, "#0a2a4f"], [-1000, "#0f3d6e"], [-200, "#1b5f99"],
  [-100, "#2a7bb8"], [-50, "#3f97cf"], [-20, "#63b3e0"], [-1, "#93cdea"],
];

// ¿Están ya las teselas de EMODnet? (si relieve-emodnet.yml no ha corrido,
// darían 404 y el 3D se quedaría en blanco): una tesela de zoom 5 de la zona.
export function teselaPrueba(zona) {
  const [s, o, n, e] = zona;
  const lat = (s + n) / 2, lon = (o + e) / 2, k = 32;
  const x = Math.floor(((lon + 180) / 360) * k);
  const y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * k);
  return URL_EMODNET.replace("{z}", "5").replace("{x}", x).replace("{y}", y);
}

export function estilo3D(centro = null, conEmodnet = true) {
  const relieve = ["interpolate", ["linear"], ["elevation"]];
  for (const [m, c] of COLORES_PROFUNDIDAD) relieve.push(m, c);
  relieve.push(0, "rgba(0,0,0,0)");
  // Las Terrain Tiles solo traen la batimetría hasta zoom 10: desde el 11 el
  // mar vale 0 (SRTM). Por eso el fondo (color y forma 3D) sale de las de
  // zoom ≤ ZOOM_MAX_BATIMETRIA, ampliadas, y solo el sombreado de tierra de
  // las de detalle.
  const rel = centro && conEmodnet ? fuenteRelieve(centro.lat, centro.lng) : { tiles: [URL_DEM], attribution: ATRIBUCION_DEM };
  const sources = {
    dem: { type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: ZOOM_MAX_BATIMETRIA, ...rel },
    demTerreno: { type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: ZOOM_MAX_BATIMETRIA, tiles: rel.tiles, ...(rel.bounds ? { bounds: rel.bounds } : {}) },
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
  const c = mapLeaflet.getCenter();
  const zona = zonaEmodnet(c.lat, c.lng);
  const comprobar = zona
    ? fetch(teselaPrueba(zona), { method: "HEAD" }).then((r) => r.ok).catch(() => false)
    : Promise.resolve(false);
  const control = { mapa: null, cerrar: () => {} };
  comprobar.then((conEmodnet) => {
    if (!capa.isConnected) return;
    const m = crearMapa(gl, cont, estilo3D(c, conEmodnet), v);
    control.mapa = m;
    m.addControl(new gl.NavigationControl({ visualizePitch: true }), "top-left");
  });
  const fuera = () => { try { control.mapa?.remove(); } catch {} capa.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") fuera(); };
  cerrar.addEventListener("click", fuera);
  document.addEventListener("keydown", esc);
  setTimeout(() => ayuda.classList.add("oculta"), 4000);
  control.cerrar = fuera;
  return control;
}

function crearMapa(gl, cont, estilo, v) {
  const m = new gl.Map({
    container: cont, style: estilo, ...v,
    minPitch: INCLINACION_MINIMA, maxPitch: INCLINACION_MAXIMA, attributionControl: false,
  });
  // Créditos plegados (ⓘ): se abren al tocarlos.
  const creditos = new gl.AttributionControl({ compact: true });
  m.addControl(creditos, "bottom-right");
  const plegar = () => creditos._container?.classList.remove("maplibregl-compact-show");
  m.once("load", plegar);
  setTimeout(plegar, 0);
  return m;
}
