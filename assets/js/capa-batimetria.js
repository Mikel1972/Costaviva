// assets/js/capa-batimetria.js
//
// Batimetría gratuita de EMODnet (DTM 2024, CC BY 4.0) en la app
// (2026-10-08, aprobado por Mikel). Dos cosas:
//   1. Fondo de cada spot para el índice de pesca: las estadísticas de
//      `estadisticasPunto` (batimetria-calculo.js), que las reglas expertas
//      leen como `profundidad`, `prof_max_3km` y `dist_fondo_10_30m_km`
//      (profundidad ALCANZABLE desde embarcación a 3 km de la orilla).
//      Spots fijos: assets/datos/profundidad-spots.json
//      (scripts/batimetria/profundidad-spots.mjs). Puntos propios: el mismo
//      cálculo en el navegador sobre una caja de ~4 km pedida al WCS de
//      EMODnet (sin clave, CORS abierto), guardado en memoria; mientras no
//      llega, null (las reglas de profundidad no aplican).
//   2. Capa de isóbatas de 20, 50 y 100 m (assets/datos/isobatas.json,
//      scripts/batimetria/isobatas.mjs). Se enciende sola con la pestaña
//      Embarcación y con su botón ("Isób.") a mano; se carga solo la
//      primera vez que hace falta.
// Licencias y atribución: datos-robots/fuentes/BATIMETRIA.md.
//
// Las funciones puras (sin DOM ni red) tienen tests en test/batimetria.test.js;
// lo demás solo se usa en el navegador (index.html: window.Batimetria).

import { estadisticasPunto, parsearWcsTexto, urlWcs, cajaAlrededor } from "./batimetria-calculo.js";

export const ATRIBUCION_ISOBATAS =
  'Isóbatas: <a href="https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1" target="_blank" rel="noopener">EMODnet Bathymetry Consortium (DTM 2024)</a>, '
  + '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, calculadas por Costaviva. No sirven para navegar.';

export const ESTILO_ISOBATA = {
  20: { color: "#2E8FB8", weight: 2, opacity: 0.9 },
  50: { color: "#1F6A94", weight: 1.6, opacity: 0.8, dashArray: "6 4" },
  100: { color: "#16476A", weight: 1.3, opacity: 0.7, dashArray: "2 4" },
};

// Estadísticas de fondo de un spot fijo según profundidad-spots.json, o null.
export function batimetriaDeSpot(datos, slug) {
  return datos?.spots?.[slug] || null;
}

// Caja que se pide para un punto propio: 3 km de alcance + margen por si el
// punto está en tierra a algo de distancia del agua.
export const RADIO_CAJA_PUNTO_M = 4000;

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
      if (st.zona_m === null && st.prof_max_3km_m === null) return;
      entrada.valor = st;
      alCambiar(s);
    })
    .catch(() => { vivos.delete(s.slug); });
  return null;
}

let mapa = null, capa = null, cargando = null, boton = null;
const estado = { manual: null, modalidad: "costa" };

async function capaIsobatas(L) {
  if (capa) return capa;
  cargando ||= fetch("/assets/datos/isobatas.json")
    .then((r) => { if (!r.ok) throw new Error(`isobatas.json HTTP ${r.status}`); return r.json(); })
    .then((geo) => {
      capa = L.geoJSON(geo, {
        style: (f) => ESTILO_ISOBATA[f.properties.profundidad_m] || ESTILO_ISOBATA[100],
        onEachFeature: (f, l) => l.bindTooltip(`${f.properties.profundidad_m} m`, { sticky: true }),
        attribution: ATRIBUCION_ISOBATAS,
        interactive: true,
      });
      return capa;
    })
    .finally(() => { cargando = null; });
  return cargando;
}

async function aplicar() {
  if (!mapa) return;
  const ver = capaVisible(estado);
  boton?.classList.toggle("activo", ver);
  boton?.setAttribute("aria-pressed", ver ? "true" : "false");
  if (ver) {
    try {
      const c = await capaIsobatas(window.L);
      if (capaVisible(estado) && !mapa.hasLayer(c)) c.addTo(mapa);
    } catch (e) { console.warn("Isóbatas:", e.message); }
  } else if (capa && mapa.hasLayer(capa)) {
    mapa.removeLayer(capa);
  }
}

// map: el mapa de Leaflet; botonEl: el botón de la capa (opcional).
export function montarCapa(map, botonEl) {
  mapa = map;
  boton = botonEl || null;
  boton?.addEventListener("click", () => {
    const visible = capaVisible(estado);
    // A mano manda sobre la pestaña hasta que se cambie de pestaña.
    estado.manual = !visible;
    aplicar();
  });
  aplicar();
}

// La llama index.html cada vez que se pinta la pestaña de modalidad.
export function porModalidad(m) {
  if (m === estado.modalidad) return;
  estado.modalidad = m;
  estado.manual = null;
  aplicar();
}
