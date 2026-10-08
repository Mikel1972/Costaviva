// assets/js/capa-batimetria.js
//
// Batimetría gratuita de EMODnet (DTM 2024, CC BY 4.0) en la app
// (2026-10-08, aprobado por Mikel). Dos cosas:
//   1. Fondo de cada spot para el índice de pesca: las estadísticas de
//      `estadisticasPunto` (batimetria-calculo.js), que las reglas expertas
//      leen como `profundidad`, `prof_max_5km` y `dist_fondo_10_30m_km`
//      (profundidad ALCANZABLE desde embarcación a 5 km de la orilla).
//      Spots fijos: assets/datos/profundidad-spots.json
//      (scripts/batimetria/profundidad-spots.mjs). Puntos propios: el mismo
//      cálculo en el navegador sobre una caja de ~4 km pedida al WCS de
//      EMODnet (sin clave, CORS abierto), guardado en memoria; mientras no
//      llega, null (las reglas de profundidad no aplican).
//   2. Capa de isóbatas (scripts/batimetria/isobatas.mjs), en dos ficheros
//      para no cargar de golpe uno enorme: las profundas (150 a 5000 m,
//      isobatas-profundas.json) a cualquier zoom y las someras (20, 50 y
//      100 m, isobatas.json, más detalladas) desde zoom 8. Cada fichero se
//      pide la primera vez que hace falta. Etiquetas "200 m" en puntos
//      precalculados (solo las que caen en pantalla, desde cierto zoom) y
//      leyenda de colores. Se enciende sola con la pestaña Embarcación y a
//      mano con "Profundidad" en el selector del botón "Fondo"
//      (selector-fondo.js).
// Licencias y atribución: datos-robots/fuentes/BATIMETRIA.md.
//
// Las funciones puras (sin DOM ni red) tienen tests en test/batimetria.test.js;
// lo demás solo se usa en el navegador (index.html: window.Batimetria).

import { estadisticasPunto, parsearWcsTexto, urlWcs, cajaAlrededor } from "./batimetria-calculo.js";

export const ATRIBUCION_ISOBATAS =
  'Isóbatas: <a href="https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1" target="_blank" rel="noopener">EMODnet Bathymetry Consortium (DTM 2024)</a>, '
  + '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, calculadas por Costaviva. No sirven para navegar.';

export const NIVELES_SOMEROS = [20, 50, 100];
export const NIVELES_PROFUNDOS = [150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000];
export const ZOOM_SOMERAS = 8;          // las de 20/50/100 m, desde aquí
export const ZOOM_ETIQUETAS_PROFUNDAS = 6;
export const ZOOM_ETIQUETAS_SOMERAS = 10;
export const MAX_ETIQUETAS = 120;       // por pantalla

// Escala discreta de azules: más claro cuanto menos fondo (orden de los
// niveles, no metros: 20 y 5000 m tienen que distinguirse igual de bien).
const ESCALA = ["#8FD3F0", "#5DB8E3", "#3E9FD3", "#2B88C2", "#2275B0", "#1C649F", "#18568E",
  "#154A7E", "#123F6F", "#0F3561", "#0D2C54", "#0B2448", "#091D3D", "#071733"];
export const TODOS_LOS_NIVELES = [...NIVELES_SOMEROS, ...NIVELES_PROFUNDOS];
export function colorIsobata(prof) {
  const i = TODOS_LOS_NIVELES.indexOf(prof);
  return ESCALA[i < 0 ? ESCALA.length - 1 : i];
}
export function estiloIsobata(prof) {
  const somera = NIVELES_SOMEROS.includes(prof);
  const principal = [20, 100, 200, 500, 1000, 2000, 5000].includes(prof);
  return {
    color: colorIsobata(prof),
    weight: prof === 20 ? 2.2 : principal ? 1.6 : 1.1,
    opacity: somera ? 0.95 : 0.8,
    dashArray: principal ? null : "5 4",
  };
}

// Etiquetas que se pintan: las de los niveles cargados que caen dentro de
// `caja` ({ sur, norte, oeste, este }), según el zoom, hasta `max`, repartidas
// entre niveles (no todas del primero). feats: features de los GeoJSON.
export function etiquetasVisibles(feats, caja, zoom, max = MAX_ETIQUETAS) {
  const porNivel = feats
    .filter((f) => zoom >= (NIVELES_SOMEROS.includes(f.properties.profundidad_m) ? ZOOM_ETIQUETAS_SOMERAS : ZOOM_ETIQUETAS_PROFUNDAS))
    .map((f) => (f.properties.etiquetas || [])
      .filter(([lon, lat]) => lat >= caja.sur && lat <= caja.norte && lon >= caja.oeste && lon <= caja.este)
      .map(([lon, lat]) => ({ prof: f.properties.profundidad_m, lat, lon })));
  const out = [];
  for (let k = 0; out.length < max && porNivel.some((l) => k < l.length); k++) {
    for (const l of porNivel) if (k < l.length && out.length < max) out.push(l[k]);
  }
  return out;
}

// Estadísticas de fondo de un spot fijo según profundidad-spots.json, o null.
export function batimetriaDeSpot(datos, slug) {
  return datos?.spots?.[slug] || null;
}

// Caja que se pide para un punto propio: 5 km de alcance + margen por si el
// punto está en tierra a algo de distancia del agua.
export const RADIO_CAJA_PUNTO_M = 6000;

// ¿Se debe ver la capa? Encendida a mano, o sola en la pestaña Embarcación.
export function capaVisible({ manual, modalidad }) {
  return manual === true || (manual === null && modalidad === "embarcacion");
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
let datosSpots = null;
const vivos = new Map(); // slug -> { valor, promesa }
let alCambiar = () => {};

export function iniciar({ onProfundidad } = {}) {
  if (onProfundidad) alCambiar = onProfundidad;
  fetch("/assets/datos/profundidad-spots.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { datosSpots = d; })
    .catch(() => { /* sin dato: las reglas de profundidad no aplican */ });
}

// Síncrona (el contexto del índice lo es): devuelve lo que haya y, para un
// punto propio sin dato aún, lo pide y avisa con onProfundidad(s) al llegar.
export function batimetria(s) {
  if (!s) return null;
  if (!s.esUsuario) return batimetriaDeSpot(datosSpots, s.slug);
  const c = vivos.get(s.slug);
  if (c) return c.valor;
  const entrada = { valor: null };
  vivos.set(s.slug, entrada);
  fetch(urlWcs(cajaAlrededor(+s.lat, +s.lon, RADIO_CAJA_PUNTO_M)))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`WCS HTTP ${r.status}`))))
    .then((t) => {
      const st = estadisticasPunto(parsearWcsTexto(t), +s.lat, +s.lon);
      if (st.zona_m === null && st.prof_max_5km_m === null) return;
      entrada.valor = st;
      alCambiar(s);
    })
    .catch(() => { vivos.delete(s.slug); });
  return null;
}

let mapa = null, avisarCambio = () => {}, leyenda = null, leyendaPuesta = false, capaEtiquetas = null;
const estado = { manual: null, modalidad: "costa" };
const juegos = {
  profundas: { url: "/assets/datos/isobatas-profundas.json", zoomMin: 0, capa: null, geo: null, cargando: null },
  someras: { url: "/assets/datos/isobatas.json", zoomMin: ZOOM_SOMERAS, capa: null, geo: null, cargando: null },
};

function cargar(j, L) {
  if (j.capa) return Promise.resolve(j.capa);
  j.cargando ||= fetch(j.url)
    .then((r) => { if (!r.ok) throw new Error(`${j.url} HTTP ${r.status}`); return r.json(); })
    .then((geo) => {
      j.geo = geo;
      j.capa = L.geoJSON(geo, {
        style: (f) => estiloIsobata(f.properties.profundidad_m),
        onEachFeature: (f, l) => l.bindTooltip(`${f.properties.profundidad_m} m`, { sticky: true }),
        attribution: ATRIBUCION_ISOBATAS,
      });
      return j.capa;
    })
    .finally(() => { j.cargando = null; });
  return j.cargando;
}

function ponerEstilos() {
  if (document.getElementById("estilos-isobatas")) return;
  const st = document.createElement("style");
  st.id = "estilos-isobatas";
  st.textContent = `
  .isobata-etq { background: none; border: none; }
  .isobata-etq span { display: inline-block; transform: translate(-50%, -50%); white-space: nowrap;
    font: 700 10.5px var(--f-texto); color: var(--tinta); background: rgba(255,255,255,0.85);
    border-radius: 4px; padding: 0 4px; border-left: 3px solid var(--c); }
  .isobatas-leyenda { background: var(--superficie); border: 0; border-radius: 14px; padding: 8px 10px;
    font: 600 10.5px var(--f-texto); color: var(--tinta); box-shadow: 0 6px 16px rgba(11,30,63,0.2); }
  .isobatas-leyenda .tit { color: var(--tinta-2); margin-bottom: 4px; }
  .isobatas-leyenda .barra { display: grid; grid-template-columns: repeat(14, 14px); }
  .isobatas-leyenda .barra i { height: 10px; }
  .isobatas-leyenda .ext { display: flex; justify-content: space-between; color: var(--tinta-2); margin-top: 2px; }`;
  document.head.appendChild(st);
}

// Esquina de las leyendas del fondo: abajo a la izquierda; en el móvil, arriba
// (debajo del zoom), porque abajo los créditos de las capas ocupan varias
// líneas y las tapaban. La misma regla en capa-tipo-fondo.js.
export const esquinaLeyenda = (ancho = globalThis.innerWidth) => (ancho <= 720 ? "topleft" : "bottomleft");

function crearLeyenda(L) {
  const ctl = L.control({ position: esquinaLeyenda() });
  ctl.onAdd = () => {
    const div = L.DomUtil.create("div", "isobatas-leyenda");
    div.setAttribute("role", "img");
    div.setAttribute("aria-label", `Isóbatas de ${TODOS_LOS_NIVELES[0]} a ${TODOS_LOS_NIVELES.at(-1)} m: más oscuro, más profundo`);
    const tit = L.DomUtil.create("div", "tit", div);
    tit.textContent = "Profundidad (m)";
    const barra = L.DomUtil.create("div", "barra", div);
    for (const n of TODOS_LOS_NIVELES) {
      const i = L.DomUtil.create("i", "", barra);
      i.style.background = colorIsobata(n);
      i.title = `${n} m`;
    }
    const ext = L.DomUtil.create("div", "ext", div);
    for (const t of ["20", "200", "1000", "5000"]) L.DomUtil.create("span", "", ext).textContent = t;
    return div;
  };
  return ctl;
}

function pintarEtiquetas(L) {
  if (!capaEtiquetas) return;
  capaEtiquetas.clearLayers();
  const feats = Object.values(juegos).filter((j) => j.capa && mapa.hasLayer(j.capa)).flatMap((j) => j.geo.features);
  const b = mapa.getBounds();
  const caja = { sur: b.getSouth(), norte: b.getNorth(), oeste: b.getWest(), este: b.getEast() };
  for (const e of etiquetasVisibles(feats, caja, mapa.getZoom())) {
    const html = document.createElement("span");
    html.textContent = `${e.prof} m`;
    html.style.setProperty("--c", colorIsobata(e.prof));
    L.marker([e.lat, e.lon], {
      icon: L.divIcon({ className: "isobata-etq", html, iconSize: null }),
      interactive: false, keyboard: false,
    }).addTo(capaEtiquetas);
  }
}

async function aplicar() {
  if (!mapa) return;
  const L = window.L;
  const ver = capaVisible(estado);
  avisarCambio(ver);
  if (!ver) {
    for (const j of Object.values(juegos)) if (j.capa && mapa.hasLayer(j.capa)) mapa.removeLayer(j.capa);
    if (capaEtiquetas && mapa.hasLayer(capaEtiquetas)) mapa.removeLayer(capaEtiquetas);
    if (leyendaPuesta) { leyenda.remove(); leyendaPuesta = false; }
    return;
  }
  ponerEstilos();
  capaEtiquetas ||= L.layerGroup();
  if (!mapa.hasLayer(capaEtiquetas)) capaEtiquetas.addTo(mapa);
  leyenda ||= crearLeyenda(L);
  if (!leyendaPuesta) { leyenda.addTo(mapa); leyendaPuesta = true; }
  const zoom = mapa.getZoom();
  await Promise.all(Object.values(juegos).map(async (j) => {
    if (zoom < j.zoomMin) { if (j.capa && mapa.hasLayer(j.capa)) mapa.removeLayer(j.capa); return; }
    try {
      const c = await cargar(j, L);
      if (capaVisible(estado) && mapa.getZoom() >= j.zoomMin && !mapa.hasLayer(c)) c.addTo(mapa);
    } catch (e) { console.warn("Isóbatas:", e.message); }
  }));
  if (capaVisible(estado)) pintarEtiquetas(L);
}

// map: el mapa de Leaflet; onCambio(visible): se llama cada vez que se
// decide si se ve (también cuando la enciende o apaga la pestaña).
export function montarCapa(map, { onCambio } = {}) {
  mapa = map;
  if (onCambio) avisarCambio = onCambio;
  map.on("zoomend moveend", () => { if (capaVisible(estado)) aplicar(); });
  aplicar();
}

// Lo que se ve ahora (a mano o por la pestaña).
export const visible = () => capaVisible(estado);

// A mano (selector "Fondo"): manda sobre la pestaña hasta que se cambie de pestaña.
export function ponerVisible(v) {
  estado.manual = !!v;
  aplicar();
}

// La llama index.html cada vez que se pinta la pestaña de modalidad.
export function porModalidad(m) {
  if (m === estado.modalidad) return;
  estado.modalidad = m;
  estado.manual = null;
  aplicar();
}
