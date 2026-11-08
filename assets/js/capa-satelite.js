// assets/js/capa-satelite.js
//
// Foto aérea ("satélite") como fondo del mapa (2026-11-08, Mikel: "¿podemos
// dar la opción de imagen satelital? ... es interesante poder ver cómo son
// las rocas"). Una opción más del botón "Fondo" (selector-fondo.js).
// ENCENDIDA POR DEFECTO (Mikel, mismo día, al ver las capturas: "que salga
// así por defecto"): es la excepción a "al entrar, solo los spots". Si el
// usuario la quita, se recuerda en su navegador y ya no vuelve a salir.
//
// Fuente: ortofoto PNOA de máxima actualidad del Instituto Geográfico
// Nacional (WMTS pnoa-ma, 25 cm/píxel o mejor; se distinguen rocas, bajos,
// escolleras y, con agua clara, el fondo). Licencia CC BY 4.0 (Orden
// FOM/2807/2015, datos del IGN de uso libre con atribución): "PNOA cedido
// por © Instituto Geográfico Nacional". Sin clave.
//
// Solo España: fuera de España el servicio devuelve teselas vacías, así que
// se pide únicamente dentro de rectángulos que no tocan Portugal (si no, el
// mapa de Portugal saldría en blanco). Nueva Zelanda (LINZ Basemaps, CC BY
// 4.0) necesita una clave de desarrollador fija: pedida a LINZ; entrará
// cuando llegue. Esri World Imagery no se usa: su licencia no cubre el uso
// comercial sin suscripción (CLAUDE.md, "mapa base").
//
// Con el satélite puesto se puede acercar hasta ZOOM_MAX_SATELITE (el mapa
// normal se queda en ZOOM_MAX_NORMAL). Lo puro se prueba en
// test/capa-satelite.test.js.

export const URL_PNOA =
  "https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&Format=image/jpeg" +
  "&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}";

export const ATRIBUCION_PNOA =
  'PNOA cedido por © <a href="https://www.ign.es" target="_blank" rel="noopener">Instituto Geográfico Nacional</a> ' +
  '(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)';

// [[sur, oeste], [norte, este]]. Juntos cubren la costa de España sin
// pisar Portugal: el norte por encima del Miño, el este y sur por el este
// de la raya, la costa de Huelva y Cádiz, y Canarias. Baleares, Ceuta y
// Melilla caen dentro.
export const RECTANGULOS_ESPANA = [
  [[42.15, -9.4], [43.9, 3.4]],   // Galicia, Cantábrico, Pirineo
  [[41.89, -9.4], [42.15, -8.78]], // Rías Baixas hasta A Guarda (al norte del Miño)
  [[35.2, -6.2], [42.15, 4.5]],   // Mediterráneo, Baleares, Andalucía oriental, Ceuta y Melilla
  [[36.0, -7.42], [37.65, -6.2]], // Huelva y Cádiz atlántico
  [[27.5, -18.3], [29.5, -13.3]], // Canarias
];

export const ZOOM_MAX_SATELITE = 19;
export const ZOOM_MAX_NORMAL = 17;

export function dentroDeEspana(lat, lon) {
  return RECTANGULOS_ESPANA.some(([[s, o], [n, e]]) => lat >= s && lat <= n && lon >= o && lon <= e);
}

// Zoom máximo del mapa según el satélite, y el zoom al que hay que bajar al
// quitarlo si se estaba más cerca de lo que permite el mapa normal.
export function zoomAlCambiar(satelite, zoomActual) {
  const max = satelite ? ZOOM_MAX_SATELITE : ZOOM_MAX_NORMAL;
  return { max, zoom: Math.min(zoomActual, max) };
}

// Preferencia guardada en el navegador: "no" si el usuario la quitó.
export const CLAVE_PREFERENCIA = "costaviva.fondo_satelite";
export function satelitePorDefecto(guardado) {
  return guardado !== "no";
}

function leerPreferencia() {
  try { return localStorage.getItem(CLAVE_PREFERENCIA); } catch { return null; }
}
function guardarPreferencia(v) {
  try { localStorage.setItem(CLAVE_PREFERENCIA, v ? "si" : "no"); } catch {}
}

// ---------------------------------------------------------------------------
// Navegador: { visible(), ponerVisible(v) }, la interfaz que espera el
// selector del botón "Fondo".
export function montarCapa(map, L) {
  map.createPane("satelite").style.zIndex = 170; // encima del mapa base y el relieve, debajo de todo lo demás
  map.getPane("satelite").style.pointerEvents = "none";
  const grupo = L.layerGroup(
    RECTANGULOS_ESPANA.map((r) => L.tileLayer(URL_PNOA, {
      pane: "satelite", bounds: L.latLngBounds(r), maxZoom: ZOOM_MAX_SATELITE, maxNativeZoom: ZOOM_MAX_SATELITE, crossOrigin: true,
    })),
  );
  let visible = false;
  const capa = {
    visible: () => visible,
    ponerVisible(v, { guardar = true } = {}) {
      visible = !!v;
      if (guardar) guardarPreferencia(visible);
      const { max, zoom } = zoomAlCambiar(visible, map.getZoom());
      if (visible) {
        map.setMaxZoom(max);
        grupo.addTo(map);
        map.attributionControl.addAttribution(ATRIBUCION_PNOA);
      } else {
        map.removeLayer(grupo);
        map.attributionControl.removeAttribution(ATRIBUCION_PNOA);
        if (zoom !== map.getZoom()) map.setZoom(zoom);
        map.setMaxZoom(max);
      }
    },
  };
  if (satelitePorDefecto(leerPreferencia())) capa.ponerVisible(true, { guardar: false });
  return capa;
}
