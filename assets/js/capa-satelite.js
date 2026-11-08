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

// Donde el IGN no tiene foto (mar abierto) pinta un morado oscuro liso, en
// bloques (Mikel, 2026-11-08: "ese corte no queda bien"). Esos píxeles se
// vuelven transparentes y, debajo, el mar del mapa base se pinta del azul
// del mar en la foto (media de una tesela frente a Bakio), así no se nota.
export const COLOR_SIN_FOTO = [32, 26, 38];
export const TOLERANCIA_SIN_FOTO = 6;
export const COLOR_MAR_SATELITE = "#2F4260";
export function esSinFoto(r, g, b) {
  return Math.abs(r - COLOR_SIN_FOTO[0]) <= TOLERANCIA_SIN_FOTO && Math.abs(g - COLOR_SIN_FOTO[1]) <= TOLERANCIA_SIN_FOTO && Math.abs(b - COLOR_SIN_FOTO[2]) <= TOLERANCIA_SIN_FOTO;
}
// De lejos (zoom ≤ ZOOM_MAR_GRIS) el IGN da Sentinel-2 y el mar sale gris
// oscuro, cortado en bloques donde acaba la foto: también se quita (gris =
// poca diferencia entre canales y oscuro; el monte, verde, no entra). De
// cerca se deja el mar de la ortofoto, que es justo lo que interesa.
export const ZOOM_MAR_GRIS = 13;
export function esMarGris(r, g, b) {
  return Math.max(r, g, b) <= 80 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}
// Pasa a transparentes, en un RGBA, los píxeles "sin foto" (y el mar gris
// de lejos). Devuelve cuántos.
export function quitarSinFoto(rgba, zoom = 99) {
  const gris = zoom <= ZOOM_MAR_GRIS;
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (esSinFoto(r, g, b) || (gris && esMarGris(r, g, b))) { rgba[i + 3] = 0; n++; }
  }
  return n;
}

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
  // Teselas del IGN pasadas por un canvas para quitar el "sin foto" (el IGN
  // manda Access-Control-Allow-Origin: *). Si el canvas no se puede leer, la
  // tesela se queda tal cual.
  const TeselaPNOA = L.GridLayer.extend({
    createTile(coords, hecho) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 256, 256);
        try {
          const datos = ctx.getImageData(0, 0, 256, 256);
          if (quitarSinFoto(datos.data, coords.z)) ctx.putImageData(datos, 0, 0);
        } catch {}
        hecho(null, canvas);
      };
      img.onerror = () => hecho(null, canvas);
      img.src = L.Util.template(URL_PNOA, coords);
      return canvas;
    },
  });
  const grupo = L.layerGroup(
    RECTANGULOS_ESPANA.map((r) => new TeselaPNOA({
      pane: "satelite", bounds: L.latLngBounds(r), maxZoom: ZOOM_MAX_SATELITE, maxNativeZoom: ZOOM_MAX_SATELITE,
    })),
  );
  const colorMar = (v) => { try { (globalThis.MapaBase || window.MapaBase)?.ponerColorMar?.(v ? COLOR_MAR_SATELITE : null); } catch {} };
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
        colorMar(true);
        map.attributionControl.addAttribution(ATRIBUCION_PNOA);
      } else {
        map.removeLayer(grupo);
        colorMar(false);
        map.attributionControl.removeAttribution(ATRIBUCION_PNOA);
        if (zoom !== map.getZoom()) map.setZoom(zoom);
        map.setMaxZoom(max);
      }
    },
  };
  if (satelitePorDefecto(leerPreferencia())) capa.ponerVisible(true, { guardar: false });
  return capa;
}
