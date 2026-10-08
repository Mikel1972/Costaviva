// assets/js/capa-tipo-fondo.js
//
// Tipo de fondo y de orilla de cada spot (2026-10-08, aprobado por Mikel:
// "saber el tipo de fondo, sobre todo los primeros 50 m desde la costa").
// Tres cosas:
//   1. Datos por spot (assets/datos/tipo-fondo.json, precalculado sin IA por
//      scripts/fondo/tipo-fondo.mjs): orilla a 50 m del punto de costa
//      (OpenStreetMap, ODbL) y composición del fondo a 500 m y 1 km
//      (EMODnet Seabed Habitats, EUSeaMap 2025, CC BY 4.0).
//   2. Variables de contexto para las reglas expertas del índice
//      (orilla_tipo, fondo_roca, fondo_arena, fondo_fango, fondo_grava,
//      posidonia, algas). SOLO desde costa y en submarina: en embarcación
//      salen null y ninguna regla de fondo puede aplicar.
//   3. Capa "Sustrato" del mapa: WMS de EMODnet (EUSeaMap 2025, tipo de
//      sustrato, todas las escalas: costa, plataforma y talud) con leyenda
//      y atribución. El botón "Fondo" de siempre es la batimetría; este es
//      otro.
// Puntos propios: si hay un spot con dato a menos de 1,5 km se usa el suyo;
// si no, se pregunta en vivo a EMODnet el sustrato del propio punto (sin
// orilla, una sola muestra).
// Licencias y calidad: CLAUDE.md, sección "Tipo de fondo y orilla".
//
// Las funciones puras (sin DOM ni red) tienen tests en test/tipo-fondo.test.js;
// lo demás solo se usa en el navegador (index.html: window.TipoFondo).

export const WMS_EMODNET_SEABED = "https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms";
// Grupo con todas las simplificaciones (800/400/200 m y detalle completo):
// GeoServer elige la adecuada a cada escala, así que se ve de la costa al talud.
export const CAPA_SUSTRATO = "eusm_subs_group";
// Capa de detalle completo con la clasificación EUNIS 2019 (sustrato, zona
// biológica y Posidonia) para preguntar un punto concreto.
export const CAPA_PUNTO = "eusm2025_eunis2019_full";
// Zoom mínimo de la capa: a escala de plataforma (Golfo de Bizkaia entero) ya
// se distingue roca, arena y fango (petición de Mikel: "hasta donde tengamos").
export const ZOOM_MIN_CAPA = 7;
// Radio para reutilizar el dato de un spot fijo en un punto propio.
export const RADIO_SPOT_CERCANO_KM = 1.5;

export const ATRIBUCION_SUSTRATO =
  'Sustrato: <a href="https://emodnet.ec.europa.eu/en/seabed-habitats" target="_blank" rel="noopener">EMODnet Seabed Habitats</a> (EUSeaMap 2025), '
  + '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, financiado por la Comisión Europea. Orientativo, no sirve para navegar.';

// Leyenda (colores del estilo de EMODnet, GetLegendGraphic de eusm2025_subs_full).
export const LEYENDA_SUSTRATO = [
  { clase: "roca", texto: "Roca", color: "#780000" },
  { clase: "arena", texto: "Arena", color: "#F6F17C" },
  { clase: "grava", texto: "Grava o mixto", color: "#D1CD6A" },
  { clase: "fango", texto: "Fango", color: "#95DCFC" },
  { clase: "posidonia", texto: "Posidonia", color: "#2EA531" },
  { clase: null, texto: "Sin clasificar", color: "#A5A5A5" },
];

export const CLASES_FONDO = ["roca", "arena", "grava", "fango", "posidonia", "pradera", "biogenico"];
export const TIPOS_ORILLA = ["acantilado", "roca", "escollera", "playa_arena", "playa_cantos", "playa", "puerto"];
// Desempate cuando dos tipos de orilla están a la misma distancia.
const PRIORIDAD_ORILLA = ["acantilado", "escollera", "roca", "playa_arena", "playa_cantos", "playa", "puerto"];

// Variables de contexto que aporta este módulo a las reglas expertas.
export const VARIABLES_FONDO = ["orilla_tipo", "fondo_roca", "fondo_arena", "fondo_fango", "fondo_grava", "posidonia", "algas"];
// Con menos de esta parte de puntos de mar con dato, el fondo se da por desconocido.
export const COBERTURA_MINIMA = 0.3;

// Clase de fondo de un polígono de EUSeaMap (campo `substrate`, y el código
// EUNIS 2019 si lo hay). null = sin clasificar ("Seabed", "Sediment"...).
export function clasificarSustrato(substrate, eunis = "") {
  const s = String(substrate || "").toLowerCase();
  const e = String(eunis || "").toUpperCase();
  if (/dead mattes/.test(s)) return "biogenico";
  if (e === "MB252" || /posidonia/.test(s)) return "posidonia";
  if (/cymodocea|zostera|seagrass/.test(s)) return "pradera";
  if (/rock|hard substrat|coralligenous|reef/.test(s)) return "roca";
  // "Muddy sand" sola es arena; las clases combinadas ("Fine mud or Sandy
  // mud or Muddy sand") y "Sandy mud" son sedimento fino: fango.
  if (/muddy sand/.test(s) && !/ or /.test(s)) return "arena";
  if (/mud/.test(s)) return "fango";
  if (/sand/.test(s)) return "arena";
  if (/coarse|mixed|gravel/.test(s)) return "grava";
  if (/beds|mussel|oyster|bivalve|biogenic|ficopomatus|lophelia/.test(s)) return "biogenico";
  return null;
}

// ¿Roca somera con algas? En EUNIS, la roca infralitoral es la que está
// dominada por algas (hay luz).
export function esRocaConAlgas(clase, biozona) {
  return clase === "roca" && /infralittoral/i.test(String(biozona || ""));
}

// Tipo de orilla de un elemento de OpenStreetMap por sus etiquetas, o null.
export function clasificarOrilla(tags = {}) {
  const n = tags.natural, m = tags.man_made;
  if (n === "cliff") return "acantilado";
  if (["bare_rock", "rock", "stone", "reef"].includes(n)) return "roca";
  if (n === "beach") {
    const sup = String(tags.surface || "");
    if (/^(sand|fine_sand)$/.test(sup)) return "playa_arena";
    if (/^(pebblestone|pebbles|gravel|shingle|stone|rock|cobblestone|fine_gravel|rocks)$/.test(sup)) return "playa_cantos";
    return "playa";
  }
  if (n === "shingle") return "playa_cantos";
  if (n === "sand") return "playa_arena";
  if (m === "breakwater" || m === "groyne") return "escollera";
  if (m === "pier") return "puerto";
  if (tags.harbour === "yes" || tags.landuse === "harbour" || tags.landuse === "port" || tags.leisure === "marina") return "puerto";
  return null;
}

// Tipo principal de orilla entre los candidatos [{ tipo, d }] a `radio` m o
// menos: el más cercano y, a igual distancia (redondeada a 5 m), el de más
// prioridad. Devuelve { tipo, tipos } o null.
export function orillaPrincipal(candidatos, radio = 50) {
  const cerca = candidatos.filter((c) => c.tipo && c.d <= radio);
  if (!cerca.length) return null;
  const orden = [...cerca].sort((a, b) => (Math.round(a.d / 5) - Math.round(b.d / 5))
    || (PRIORIDAD_ORILLA.indexOf(a.tipo) - PRIORIDAD_ORILLA.indexOf(b.tipo)));
  const tipos = [...new Set(orden.map((c) => c.tipo))];
  return { tipo: orden[0].tipo, tipos };
}

// Fracciones de cada clase entre las muestras [{ clase, algas }] de un radio.
// `total` = puntos de mar del círculo (con o sin dato). Ceros fuera para que
// el JSON pese poco; `cobertura` = parte de los puntos con clase.
export function fracciones(muestras, total) {
  const n = muestras.filter((m) => m.clase).length;
  const out = {};
  if (!n) return { cobertura: 0 };
  for (const c of CLASES_FONDO) {
    const k = muestras.filter((m) => m.clase === c).length;
    if (k) out[c] = Math.round((k / n) * 100) / 100;
  }
  const algas = muestras.filter((m) => m.algas).length;
  if (algas) out.algas = Math.round((algas / n) * 100) / 100;
  out.cobertura = Math.round((n / Math.max(n, total || n)) * 100) / 100;
  return out;
}

const NOMBRE_CLASE = {
  roca: "roca", arena: "arena", grava: "grava", fango: "fango",
  posidonia: "posidonia", pradera: "pradera marina",
};
const NOMBRE_ORILLA = {
  acantilado: "orilla de acantilado", roca: "orilla de roca", escollera: "escollera o espigón",
  playa_arena: "playa de arena", playa_cantos: "playa de cantos", playa: "playa", puerto: "puerto",
};

// Fondo cercano (500 m) con dato suficiente, o null.
function fondoCercano(e) {
  const f = e?.fondo_500 || null;
  return f && (f.cobertura ?? 0) >= COBERTURA_MINIMA ? f : null;
}

// "Fondo: roca y arena · orilla de acantilado" (palabras llanas, sin números),
// o null si no hay nada que decir.
export function textoFondo(e) {
  if (!e) return null;
  const f = fondoCercano(e);
  let fondo = null;
  if (f) {
    const clases = Object.keys(NOMBRE_CLASE).filter((c) => (f[c] || 0) >= 0.15).sort((a, b) => f[b] - f[a]).slice(0, 2);
    if (clases.length) {
      let t = clases.map((c) => NOMBRE_CLASE[c]).join(" y ");
      if (clases[0] === "roca" && (f.algas || 0) >= 0.5 * f.roca) t = t.replace("roca", "roca con algas");
      fondo = t;
    }
  }
  const orilla = e.orilla?.tipo ? NOMBRE_ORILLA[e.orilla.tipo] : null;
  if (!fondo && !orilla) return null;
  return [`Fondo: ${fondo || "sin dato cerca"}`, orilla].filter(Boolean).join(" · ");
}

// Variables de contexto para las reglas expertas. En embarcación (o sin
// dato) todo null: ninguna regla de fondo aplica.
export function contextoFondo(e, modalidad = "costa") {
  const ctx = Object.fromEntries(VARIABLES_FONDO.map((k) => [k, null]));
  if (!e || modalidad === "embarcacion") return ctx;
  ctx.orilla_tipo = e.orilla?.tipo ?? null;
  const f = fondoCercano(e);
  if (f) {
    ctx.fondo_roca = f.roca || 0;
    ctx.fondo_arena = f.arena || 0;
    ctx.fondo_fango = f.fango || 0;
    ctx.fondo_grava = f.grava || 0;
    ctx.posidonia = f.posidonia || 0;
    ctx.algas = f.algas || 0;
  }
  return ctx;
}

const RAD = Math.PI / 180;
export function distanciaKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// Entrada de tipo-fondo.json para un spot: la suya si es fijo; para un punto
// propio, la del spot fijo más cercano a 1,5 km o menos (marcada `cercano`).
export function entradaDeSpot(datos, s) {
  if (!datos?.spots || !s) return null;
  if (!s.esUsuario) return datos.spots[s.slug] || null;
  let mejor = null;
  for (const [slug, e] of Object.entries(datos.spots)) {
    const ref = e.spot ? { lat: e.spot[0], lon: e.spot[1] } : null;
    if (!ref) continue;
    const d = distanciaKm(s, ref);
    if (d <= RADIO_SPOT_CERCANO_KM && (!mejor || d < mejor.d)) mejor = { d, slug, e };
  }
  return mejor ? { ...mejor.e, cercano: mejor.slug } : null;
}

// GetFeatureInfo de un punto (WMS 1.3.0, CRS:84 = lon,lat), solo atributos.
export function urlPunto(lat, lon) {
  const d = 0.0005, x = +lon, y = +lat;
  const q = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetFeatureInfo",
    layers: CAPA_PUNTO, query_layers: CAPA_PUNTO, styles: "", crs: "CRS:84",
    bbox: [x - d, y - d, x + d, y + d].map((v) => v.toFixed(5)).join(","),
    width: "3", height: "3", i: "1", j: "1",
    info_format: "application/json", feature_count: "1",
    propertyName: "substrate,biozone,eunis2019c",
  });
  return `${WMS_EMODNET_SEABED}?${q}`;
}

// Respuesta de urlPunto -> entrada con una sola muestra (sin orilla), o null.
export function entradaDePunto(json) {
  const p = json?.features?.[0]?.properties;
  if (!p) return null;
  const clase = clasificarSustrato(p.substrate, p.eunis2019c);
  if (!clase) return null;
  return { orilla: null, fondo_500: fracciones([{ clase, algas: esRocaConAlgas(clase, p.biozone) }], 1), puntual: true };
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
let datos = null;
const vivos = new Map(); // slug -> { valor }
let alCambiar = () => {};

export function iniciar({ onFondo } = {}) {
  if (onFondo) alCambiar = onFondo;
  return fetch("/assets/datos/tipo-fondo.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { datos = d; })
    .catch(() => { /* sin dato: ni línea ni reglas de fondo */ });
}

// Síncrona (el contexto del índice lo es). Punto propio sin spot cercano: lo
// pide a EMODnet y avisa con onFondo(s) al llegar.
export function fondo(s) {
  if (!s) return null;
  const e = entradaDeSpot(datos, s);
  if (e || !s.esUsuario || !datos) return e;
  const c = vivos.get(s.slug);
  if (c) return c.valor;
  const entrada = { valor: null };
  vivos.set(s.slug, entrada);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  fetch(urlPunto(s.lat, s.lon), { signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      entrada.valor = entradaDePunto(j);
      if (entrada.valor) alCambiar(s);
    })
    .catch(() => { vivos.delete(s.slug); })
    .finally(() => clearTimeout(t));
  return null;
}

export const texto = (s) => textoFondo(fondo(s));
export const contexto = (s, modalidad) => contextoFondo(fondo(s), modalidad);

let capa = null, leyenda = null;

// Leyenda: el estilo (estilo Amanecer, variables de costaviva.css) está en
// index.html (.leyenda-sustrato); aquí solo la estructura. Los colores de las
// muestras NO son del tema: copian los del WMS de EMODnet para que casen.
function crearLeyenda(L) {
  const C = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "leyenda-sustrato");
      div.setAttribute("role", "note");
      const tit = document.createElement("div");
      tit.className = "titulo";
      tit.textContent = "Tipo de fondo";
      div.appendChild(tit);
      for (const l of LEYENDA_SUSTRATO) {
        const fila = document.createElement("div");
        const muestra = document.createElement("i");
        muestra.style.background = l.color;
        fila.appendChild(muestra);
        fila.appendChild(document.createTextNode(l.texto));
        div.appendChild(fila);
      }
      const nota = document.createElement("div");
      nota.className = "nota";
      nota.textContent = "Cerca de la orilla, orientativo.";
      div.appendChild(nota);
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });
  return new C();
}

// map: el mapa de Leaflet; botonEl: el botón de la capa; aviso(texto): para
// decir que hay que acercarse.
export function montarCapa(map, botonEl, aviso = () => {}) {
  const L = window.L;
  // Panel por defecto (tilePane, z 200): por encima del mapa base y del
  // relieve (paneles mapaBase 150 y relieveFondo 160 de mapa-base.js) y por
  // debajo de overlayPane/markerPane (spots, marcadores, isóbatas).
  capa = L.tileLayer.wms(WMS_EMODNET_SEABED, {
    pane: "tilePane", layers: CAPA_SUSTRATO, styles: "", format: "image/png", transparent: true,
    opacity: 0.6, minZoom: ZOOM_MIN_CAPA, attribution: ATRIBUCION_SUSTRATO,
  });
  leyenda = crearLeyenda(L);
  const avisoZoom = () => {
    if (map.hasLayer(capa) && map.getZoom() < ZOOM_MIN_CAPA) aviso("Acércate un poco para ver el tipo de fondo.");
  };
  botonEl?.addEventListener("click", () => {
    const ver = !map.hasLayer(capa);
    if (ver) { capa.addTo(map); leyenda.addTo(map); avisoZoom(); }
    else { map.removeLayer(capa); leyenda.remove(); }
    botonEl.classList.toggle("activo", ver);
    botonEl.setAttribute("aria-pressed", ver ? "true" : "false");
  });
  map.on("zoomend", avisoZoom);
}
