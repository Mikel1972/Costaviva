// assets/js/zonas-sin-pesca.js
// Capa "Zonas sin pesca" (2026-10-12, Mikel: "las zonas de no pesca deben
// aparecer marcadas, en su totalidad, tal vez con una trama de líneas rojas,
// en todo el mundo en el que ofrezcamos servicios").
//
// Siempre encendida (es un aviso legal, no una capa de adorno), desde
// ZOOM_MIN_ZONAS. Cada región se pide una sola vez y solo cuando el mapa la
// enseña (assets/datos/zonas-sin-pesca/<region>.geojson, generados por
// scripts/fuentes/zonas-sin-pesca.mjs a partir de las fuentes oficiales).
//
// Trama: un <pattern> SVG de líneas diagonales rojas dentro del propio SVG de
// la capa (renderer L.svg en su panel), aplicado por CSS (fill: url(#...)),
// porque Leaflet solo admite colores lisos en fillColor.
//   reserva / hpa  -> líneas rojas y borde rojo: no se pesca nada.
//   spa / parcial  -> borde naranja discontinuo y trama naranja suave: se
//                     pesca con limitaciones (protección del fondo en NZ;
//                     resto de una reserva española, con su regla).
// Tocar una zona abre su nombre, lo que no se puede hacer y, si la trae, la
// norma que lo dice (enlace).

export const ZOOM_MIN_ZONAS = 4;
// Cajas [latMin, latMax, lonMin, lonMax] de cada fichero (las del mapa).
export const REGIONES_ZONAS = {
  nz: { url: "/assets/datos/zonas-sin-pesca/nz.geojson", caja: [-54, -28, 162, 186] },
  // España (2026-10-12): reservas marinas y parques nacionales sacados de
  // los textos legales (scripts/fuentes/zonas-sin-pesca.mjs).
  es: { url: "/assets/datos/zonas-sin-pesca/es.geojson", caja: [26, 46, -19, 5] },
  // Portugal continental, Madeira, Selvagens y Azores (2026-10-12).
  pt: { url: "/assets/datos/zonas-sin-pesca/pt.geojson", caja: [29, 43.5, -36, -6] },
};
export const ID_TRAMA = "tramaZonaSinPesca";
export const ID_TRAMA_FONDO = "tramaZonaFondo";

// Estilo de Leaflet por tipo (el relleno lo pone la trama por CSS).
export function estiloZona(tipo) {
  if (tipo === "spa" || tipo === "parcial") {
    return { color: "#E07B00", weight: 1.5, dashArray: "5 4", opacity: 0.95, fillOpacity: 1, className: "zona-fondo" };
  }
  return { color: "#D0021B", weight: 1.8, opacity: 0.95, fillOpacity: 1, className: "zona-sin-pesca" };
}

export const esSinPesca = (tipo) => tipo !== "spa" && tipo !== "parcial";

// ¿Se ve (con margen de una vuelta del mundo a cada lado) la caja de la región?
export function regionVisible(caja, b) {
  const [s, n, o, e] = caja;
  return [-360, 0, 360].some((d) => b.sur <= n && b.norte >= s && b.oeste <= e + d && b.este >= o + d);
}

const SVG = "http://www.w3.org/2000/svg";
function patron(doc, id, color, ancho, separacion) {
  const p = doc.createElementNS(SVG, "pattern");
  p.setAttribute("id", id);
  p.setAttribute("patternUnits", "userSpaceOnUse");
  p.setAttribute("width", String(separacion));
  p.setAttribute("height", String(separacion));
  p.setAttribute("patternTransform", "rotate(45)");
  const l = doc.createElementNS(SVG, "line");
  l.setAttribute("x1", "0"); l.setAttribute("y1", "0");
  l.setAttribute("x2", "0"); l.setAttribute("y2", String(separacion));
  l.setAttribute("stroke", color);
  l.setAttribute("stroke-width", String(ancho));
  p.appendChild(l);
  return p;
}

// Monta la capa en `map`. `textos` (de I18n): { sinPesca, fondo, atribucion(region) }.
export function montarCapa(map, L, textos) {
  map.createPane("zonasSinPesca");
  // Encima de las capas del mar (tilePane, 200) y debajo de los spots (600).
  map.getPane("zonasSinPesca").style.zIndex = 390;
  const renderer = L.svg({ pane: "zonasSinPesca", padding: 0.5 });
  const grupo = L.featureGroup().addTo(map);
  const cargadas = new Map();
  let defsPuestas = false;

  function ponerDefs() {
    if (defsPuestas || !renderer._container) return;
    const doc = renderer._container.ownerDocument;
    const defs = doc.createElementNS(SVG, "defs");
    defs.appendChild(patron(doc, ID_TRAMA, "#D0021B", 2, 9));
    defs.appendChild(patron(doc, ID_TRAMA_FONDO, "#E07B00", 1, 12));
    renderer._container.insertBefore(defs, renderer._container.firstChild);
    defsPuestas = true;
  }

  const limpio = (t) => String(t || "").replace(/[<>&"]/g, "");
  function texto(f) {
    const p = f.properties || {};
    // Con regla propia (España): la regla de su norma; si no, la genérica.
    const regla = p.regla ? limpio(p.regla) : esSinPesca(p.tipo) ? textos.sinPesca : textos.fondo;
    const norma = p.norma && /^https:\/\//.test(p.url || "")
      ? `<br><a href="${limpio(p.url)}" target="_blank" rel="noopener">${limpio(p.norma)}</a>` : "";
    const aviso = p.regla && textos.aproximado ? `<br><small>${textos.aproximado}</small>` : "";
    return `<strong>${limpio(p.nombre)}</strong><br>${regla}${norma}${aviso}`;
  }

  function cargar(id) {
    if (cargadas.has(id)) return cargadas.get(id);
    const r = REGIONES_ZONAS[id];
    const p = fetch(r.url)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((geo) => {
        if (!geo) return;
        // Primero las de protección del fondo, encima las de no pesca.
        const orden = [...geo.features].sort((a, b) => Number(esSinPesca(a.properties?.tipo)) - Number(esSinPesca(b.properties?.tipo)));
        L.geoJSON({ type: "FeatureCollection", features: orden }, {
          renderer,
          style: (f) => estiloZona(f.properties?.tipo),
          onEachFeature: (f, capa) => capa.bindPopup(texto(f), { maxWidth: 260 }),
        }).addTo(grupo);
        ponerDefs();
        if (geo.atribucion) map.attributionControl.addAttribution(textos.atribucion ? textos.atribucion(id, geo.atribucion) : geo.atribucion);
      })
      .catch((e) => console.log(`Zonas sin pesca ${id}:`, e.message));
    cargadas.set(id, p);
    return p;
  }

  function actualizar() {
    const visible = map.getZoom() >= ZOOM_MIN_ZONAS;
    if (visible && !map.hasLayer(grupo)) grupo.addTo(map);
    if (!visible && map.hasLayer(grupo)) map.removeLayer(grupo);
    if (!visible) return;
    const b = map.getBounds();
    const caja = { sur: b.getSouth(), norte: b.getNorth(), oeste: b.getWest(), este: b.getEast() };
    for (const [id, r] of Object.entries(REGIONES_ZONAS)) if (regionVisible(r.caja, caja)) cargar(id);
  }
  map.on("moveend zoomend", actualizar);
  actualizar();
  return { actualizar, cargar, grupo };
}
