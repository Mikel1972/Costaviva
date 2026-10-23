// assets/js/capa-flota.js
//
// Flota pesquera faenando, fase 2 (2026-10-22, diseño aprobado por Mikel:
// "cada pez tiene su momento: anchoa 3 días, luego chicharro"). Zonas
// calientes DEL DÍA en el mapa, solo con la modalidad 🚤 Embarcación y para
// todos (plan gratis incluido).
//
// Datos: tabla flota_zonas de Supabase (lectura pública), que rellena el
// robot scripts/flota/flota-ais.mjs cada 2 h con el AIS de aisstream.io:
// barcos DISTINTOS faenando por celda de 0,05° (~5 km), en las últimas 24 h
// ("24h") o en las 24 h anteriores ("ayer"), por clase de eslora o "todas".
// Privacidad: nunca barcos ni rutas, y solo celdas con 3 barcos o más (lo
// exige también la base de datos). especie_probable vendrá de cruzar con las
// lonjas (más adelante); hoy siempre null y no se enseña.
//
// La capa escucha el estado de la modalidad con el evento
// `modalidad` ({ detail: { modalidad } }) que lanza index.html cada vez que
// cambia, no los clics de las pestañas: así sigue funcionando cuando el
// selector pase al mapa. porModalidad(m) hace lo mismo a mano.
//
// Mapa de calor (2026-10-23, Mikel: "como mapa de calor"): manchas suaves
// de amarillo a rojo en un <canvas> propio, sin librerías (nada nuevo en la
// CSP). Cada celda es una mancha de ~5 km centrada en la celda, más intensa
// con más barcos. Las manchas se juntan con el MÁXIMO, no sumando: a zoom
// bajo, varias celdas vecinas no se convierten en una franja más roja que
// cualquiera de ellas. Tooltip "N barcos faenando" de la celda bajo el
// ratón o el dedo.
//
// Lo puro (sin DOM ni red) tiene tests en test/capa-flota.test.js; lo demás
// solo en el navegador (index.html: window.Flota).

import { I18n } from "./i18n-modulo.js";

export const MIN_BARCOS = 3;
export const PASO_CELDA = 0.05;
export const PERIODOS = ["24h", "ayer"];
export const CLASES = ["todas", "<24", "24-40", ">40"];
// Un cálculo más viejo que esto se da por caducado (el robot va cada 2 h):
// mejor "sin datos" que enseñar como "últimas 24 h" lo de hace días.
export const CADUCA_H = 26;

// Gradiente del calor: amarillo -> naranja -> rojo -> granate (no se
// confunde con los azules de las isóbatas, que también salen en Embarcación).
export const PARADAS = [
  [0, [255, 224, 102]],
  [0.45, [245, 158, 11]],
  [0.75, [220, 38, 38]],
  [1, [127, 29, 29]],
];
export function colorCalor(v) {
  const x = Math.min(1, Math.max(0, Number(v) || 0));
  for (let i = 1; i < PARADAS.length; i++) {
    const [b, cb] = PARADAS[i];
    if (x <= b) {
      const [a, ca] = PARADAS[i - 1];
      const t = (x - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
    }
  }
  return [...PARADAS.at(-1)[1]];
}
export const gradienteCss = () => `linear-gradient(90deg, ${PARADAS.map(([p, c]) => `rgb(${c.join(",")}) ${Math.round(p * 100)}%`).join(", ")})`;

// Intensidad de una celda (0-1): 3 barcos ya se ve (0,35); 30 o más, al
// máximo. Escala logarítmica: de 3 a 6 barcos se nota más que de 23 a 26.
export const BARCOS_MAX = 30;
export function intensidadFlota(n) {
  const x = Number(n);
  if (!(x >= MIN_BARCOS)) return 0;
  const t = Math.min(1, Math.log(x / MIN_BARCOS) / Math.log(BARCOS_MAX / MIN_BARCOS));
  return +(0.35 + 0.65 * t).toFixed(4);
}
// Opacidad del píxel según su intensidad: borde transparente, centro como
// mucho al 80 % (el mapa se sigue leyendo debajo).
export const OPACIDAD_MAX = 0.8;
export const alfaCalor = (v) => Math.min(OPACIDAD_MAX, Math.max(0, v) * 1.15);
// Tabla de 256 colores RGBA para pasar de intensidad (0-255) a color.
export function tablaCalor() {
  const t = new Uint8ClampedArray(256 * 4);
  for (let i = 1; i < 256; i++) {
    const [r, g, b] = colorCalor(i / 255);
    t.set([r, g, b, Math.round(alfaCalor(i / 255) * 255)], i * 4);
  }
  return t;
}

// Radio de la mancha: ~3,5 km (una celda de 0,05° y su borde suave), en
// píxeles según el zoom y la latitud (Web Mercator, teselas de 256 px), con
// un mínimo para que se vea a zoom bajo y un máximo de pantalla.
export const RADIO_BLOB_M = 3500;
export const RADIO_MIN_PX = 7;
export const RADIO_MAX_PX = 260;
export const metrosPorPixel = (zoom, lat) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
export function radioBlobPx(zoom, lat) {
  return Math.round(Math.min(RADIO_MAX_PX, Math.max(RADIO_MIN_PX, RADIO_BLOB_M / metrosPorPixel(zoom, lat))));
}
export const centroCelda = (lat, lon, paso = PASO_CELDA) => [+(+lat + paso / 2).toFixed(4), +(+lon + paso / 2).toFixed(4)];

// La celda que se enseña en el tooltip: la que contiene el punto o, si no,
// la de centro más cercano a menos de una celda (el borde suave de la mancha).
export function celdaCercana(zonas, lat, lon, paso = PASO_CELDA) {
  let mejor = null, dMejor = Infinity;
  for (const z of zonas || []) {
    const [cl, cn] = centroCelda(z.celda_lat, z.celda_lon, paso);
    const d = Math.max(Math.abs(lat - cl), Math.abs(lon - cn));
    if (d <= paso && d < dMejor) { mejor = z; dMejor = d; }
  }
  return mejor;
}

export const capaVisible = (modalidad) => modalidad === "embarcacion";

// Rectángulo de una celda: esquina sur-oeste + 0,05°.
export function limitesCelda(lat, lon, paso = PASO_CELDA) {
  const r = (v) => +v.toFixed(4);
  return [[r(+lat), r(+lon)], [r(+lat + paso), r(+lon + paso)]];
}

// Las filas de flota_zonas que se pintan: del periodo y la clase elegidos,
// con 3 barcos o más (aunque llegara otra cosa) y de un cálculo reciente.
export function zonasVisibles(filas, { periodo = "24h", clase = "todas", ahora = new Date() } = {}) {
  const limite = ahora.getTime() - CADUCA_H * 3600_000;
  return (filas || []).filter((f) => f.periodo === periodo && f.clase === clase
    && Number(f.n_barcos) >= MIN_BARCOS
    && Number.isFinite(Number(f.celda_lat)) && Number.isFinite(Number(f.celda_lon))
    && !(Date.parse(f.calculado) < limite));
}

// Texto del tooltip de una celda (con la especie probable cuando la haya).
export function textoCelda(f) {
  const partes = [I18n.t("flota.barcos_faenando", { n: Number(f.n_barcos) })];
  if (f.clase !== "todas") partes.push(I18n.t(`flota.clase.${claveClase(f.clase)}`));
  if (f.especie_probable) partes.push(I18n.t("flota.especie_probable", { especie: f.especie_probable }));
  return partes.join(" · ");
}
export const claveClase = (c) => ({ todas: "todas", "<24": "menos24", "24-40": "de24a40", ">40": "mas40" })[c];

// En pantallas estrechas el control empieza plegado en un chip "🚤 Flota ▾"
// (tapaba un tercio del mapa en el móvil); en escritorio, abierto.
export const ANCHO_PLEGADO = 600;
export const empiezaPlegado = (ancho = globalThis.innerWidth) => Number.isFinite(ancho) && ancho > 0 && ancho <= ANCHO_PLEGADO;

// ▶️ de los últimos 14 días (2026-10-23): cada fotograma es UN día (de
// Madrid) de flota_zonas_dia, no un acumulado. Mismo filtro de eslora y
// mismo umbral. Hacen falta al menos 2 días con datos.
export const DIAS_PLAY = 14;
export const MIN_DIAS_PLAY = 2;
export const PASO_PLAY_MS = 1200;
// Madrid a propósito: el día del histórico es el de Madrid para toda la
// flota (la caja del AIS es Cantábrico y Galicia), no la zona de un spot.
const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
export const diaMadrid = (fecha) => FORMATO_DIA.format(fecha);
// Los 14 días de Madrid que acaban hoy, del más viejo al de hoy.
export function diasPlay(ahora = new Date(), n = DIAS_PLAY) {
  const hoy = Date.parse(`${diaMadrid(ahora)}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(hoy - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
}
export function zonasDelDia(filas, dia, clase = "todas") {
  return (filas || []).filter((f) => String(f.dia) === dia && f.clase === clase && Number(f.n_barcos) >= MIN_BARCOS
    && Number.isFinite(Number(f.celda_lat)) && Number.isFinite(Number(f.celda_lon)));
}
export const diasConDatos = (filas, dias) => new Set((filas || []).filter((f) => Number(f.n_barcos) >= MIN_BARCOS).map((f) => String(f.dia)).filter((d) => !dias || dias.includes(d))).size;
// "mié 22 oct" / "Wed 22 Oct" / "qua., 22/10"... en el idioma de la app.
export const fechaDia = (dia) => new Date(`${dia}T12:00:00Z`).toLocaleDateString(I18n.locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// 🔴 Flota PARADA (2026-10-23): foto de la ÚLTIMA escucha (flota_parados),
// por puerto (a menos de 2 km) o por celda en el mar, solo con 3 barcos o
// más, sin desglose por eslora. Encendida por defecto, con su casilla.
export const CADUCA_PARADOS_H = 6; // el robot va cada 2 h
export const COLOR_PARADOS = "#DC2626";
export function paradosVisibles(filas, ahora = new Date()) {
  const limite = ahora.getTime() - CADUCA_PARADOS_H * 3600_000;
  return (filas || []).filter((f) => (f.tipo === "puerto" || f.tipo === "mar") && Number(f.n_barcos) >= MIN_BARCOS
    && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)) && Date.parse(f.escucha) >= limite);
}
// 🔵 Pesqueros EN EL MAR en movimiento (2026-10-23): misma tabla, tipo
// 'navegando', celdas de 0,1°, misma foto de la última escucha.
export const PASO_NAVEGANDO = 0.1;
export const COLOR_NAVEGANDO = "#2563EB";
export function navegandoVisibles(filas, ahora = new Date()) {
  const limite = ahora.getTime() - CADUCA_PARADOS_H * 3600_000;
  return (filas || []).filter((f) => f.tipo === "navegando" && Number(f.n_barcos) >= MIN_BARCOS
    && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)) && Date.parse(f.escucha) >= limite);
}
// Dónde va el círculo: el puerto, o el centro de la celda en el mar.
export const posicionParado = (f) => (f.tipo === "puerto" ? [Number(f.lat), Number(f.lon)]
  : centroCelda(f.lat, f.lon, f.tipo === "navegando" ? PASO_NAVEGANDO : PASO_CELDA));
export const textoParado = (f) => (f.tipo === "puerto"
  ? I18n.t("flota.parados_puerto", { puerto: f.puerto, n: Number(f.n_barcos) })
  : f.tipo === "navegando" ? I18n.t("flota.navegando_mar", { n: Number(f.n_barcos) })
  : I18n.t("flota.parados_mar", { n: Number(f.n_barcos) }));
// Diámetro del círculo con la cifra: de 22 px (3 barcos) a 38 px (40 o más).
export const tamParado = (n) => Math.round(22 + 16 * Math.min(1, Math.log(Math.max(MIN_BARCOS, n) / MIN_BARCOS) / Math.log(40 / MIN_BARCOS)));
export function ultimaEscucha(filas) {
  const t = Math.max(...(filas || []).map((f) => Date.parse(f.escucha)).filter(Number.isFinite));
  return Number.isFinite(t) ? new Date(t) : null;
}
export const horaEscucha = (fecha) => fecha.toLocaleTimeString(I18n.locale(), { hour: "2-digit", minute: "2-digit" });

export const textoVacio = (periodo) => I18n.t(periodo === "ayer" ? "flota.vacio_ayer" : "flota.vacio_24h");

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
const REFRESCO_MS = 10 * 60_000;
let mapa = null, consultar = async () => [], calor = null, control = null, controlPuesto = false;
const estado = { plegado: null, modalidad: "costa", periodo: "24h", clase: "todas", filas: null, pedido: 0, cargando: null,
  historico: null, dia: null, reloj: null, parados: null, verParados: true, verNavegando: true };
let consultarDias = async () => [];
let consultarParados = async () => [];
let capaParados = null;
const atribucion = () => I18n.t("flota.atribucion");

function ponerEstilos() {
  if (document.getElementById("estilos-flota")) return;
  const st = document.createElement("style");
  st.id = "estilos-flota";
  st.textContent = `
  .flota-control { background: var(--superficie); border-radius: 14px; padding: 8px 10px; max-width: 230px;
    font: 600 11px var(--f-texto); color: var(--tinta); box-shadow: 0 6px 16px rgba(11,30,63,0.2); }
  .flota-control .chip { display: flex; align-items: center; gap: 6px; width: 100%; font: 700 11px var(--f-texto);
    color: var(--tinta); background: transparent; border: 0; padding: 0; cursor: pointer; text-align: left; }
  .flota-control .chip .flecha { margin-left: auto; color: var(--tinta-2); }
  .flota-control .cuerpo { margin-top: 6px; }
  .flota-control .cuerpo[hidden] { display: none; }
  .flota-control.plegado { padding: 6px 10px; border-radius: 999px; }
  .flota-control .periodos { display: flex; gap: 4px; margin-bottom: 6px; }
  .flota-control .periodos button { flex: 1; font: inherit; border: 1px solid var(--linea); border-radius: 999px;
    background: transparent; color: var(--tinta); padding: 3px 8px; cursor: pointer; }
  .flota-control .periodos button[aria-pressed="true"] { background: var(--acento); border-color: var(--acento); color: var(--superficie); }
  .flota-control label { display: block; color: var(--tinta-2); }
  .flota-control select { font: inherit; width: 100%; margin-top: 2px; }
  .flota-control .play { display: flex; align-items: center; gap: 8px; margin: 2px 0 2px; }
  .flota-control .play input { flex: 1; min-width: 0; }
  .flota-control .play button:disabled, .flota-control .play input:disabled { opacity: 0.45; cursor: default; }
  .flota-control .fecha { color: var(--tinta-2); font-weight: 500; margin-bottom: 6px; min-height: 1.2em; }
  .flota-control .escala { margin-top: 6px; }
  .flota-control .parados { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--tinta); }
  .flota-control .parados input { margin: 0; }
  .flota-control .escucha { color: var(--tinta-2); font-weight: 500; }
  .flota-parado { background: none; border: none; }
  .flota-parado span { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;
    border-radius: 50%; background: ${COLOR_PARADOS}; color: #fff; border: 2px solid #fff;
    font: 800 11px var(--f-texto); box-shadow: 0 2px 6px rgba(11,30,63,0.35); box-sizing: border-box; }
  .flota-parado.navegando span { background: ${COLOR_NAVEGANDO}; }
  .flota-control .escala .barra { height: 10px; border-radius: 5px; }
  .flota-control .escala .ext { display: flex; justify-content: space-between; color: var(--tinta-2); margin-top: 2px; font-weight: 500; }
  .leaflet-pane canvas.flota-calor { position: absolute; left: 0; top: 0; pointer-events: none; }
  .flota-control .nota, .flota-control .vacio { color: var(--tinta-2); font-weight: 500; margin-top: 4px; line-height: 1.35; }
  .flota-control .vacio[hidden] { display: none; }`;
  document.head.appendChild(st);
}

const esquina = (ancho = globalThis.innerWidth) => (ancho <= 720 ? "topleft" : "bottomleft");

function crearControl(L) {
  const ctl = L.control({ position: esquina() });
  ctl.onAdd = () => {
    const div = L.DomUtil.create("div", "flota-control");
    div.setAttribute("data-flota-control", "");
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    estado.plegado ??= empiezaPlegado();
    const chip = L.DomUtil.create("button", "chip", div);
    chip.type = "button";
    chip.setAttribute("data-flota-chip", "");
    chip.setAttribute("aria-controls", "flotaCuerpo");
    const tit = L.DomUtil.create("span", "tit", chip);
    const flecha = L.DomUtil.create("span", "flecha", chip);
    flecha.setAttribute("aria-hidden", "true");
    const cuerpo = L.DomUtil.create("div", "cuerpo", div);
    cuerpo.id = "flotaCuerpo";
    const ponerPlegado = (p) => {
      estado.plegado = p;
      chip.setAttribute("aria-expanded", p ? "false" : "true");
      tit.textContent = I18n.t(p ? "flota.chip" : "flota.titulo");
      flecha.textContent = p ? "▾" : "▴";
      cuerpo.hidden = p;
      div.classList.toggle("plegado", p);
    };
    chip.addEventListener("click", () => ponerPlegado(!estado.plegado));
    ponerPlegado(estado.plegado);
    const per = L.DomUtil.create("div", "periodos", cuerpo);
    per.setAttribute("role", "group");
    per.setAttribute("aria-label", I18n.t("flota.periodo_aria"));
    for (const p of PERIODOS) {
      const b = L.DomUtil.create("button", "", per);
      b.type = "button";
      b.dataset.periodo = p;
      b.textContent = I18n.t(p === "ayer" ? "flota.ayer" : "flota.hoy");
      b.addEventListener("click", () => { reproducir(false); estado.dia = null; estado.periodo = p; pintar(); });
    }
    // ▶️ de los últimos 14 días, como el del viento (botón redondo + barra).
    const fila = L.DomUtil.create("div", "play", cuerpo);
    const play = L.DomUtil.create("button", "viento-play", fila);
    play.type = "button";
    play.setAttribute("data-flota-play", "");
    const barra = L.DomUtil.create("input", "", fila);
    barra.type = "range";
    barra.min = "0";
    barra.max = String(DIAS_PLAY - 1);
    barra.step = "1";
    barra.value = String(DIAS_PLAY - 1);
    barra.setAttribute("data-flota-dia", "");
    barra.setAttribute("aria-label", I18n.t("flota.dia_aria"));
    const fecha = L.DomUtil.create("div", "fecha", cuerpo);
    fecha.setAttribute("data-flota-fecha", "");
    fecha.setAttribute("aria-live", "polite");
    play.addEventListener("click", () => reproducir(!estado.reloj));
    barra.addEventListener("input", () => { reproducir(false); ponerDia(+barra.value); });
    const lab = L.DomUtil.create("label", "", cuerpo);
    lab.textContent = I18n.t("flota.eslora");
    const sel = L.DomUtil.create("select", "", lab);
    sel.setAttribute("data-flota-clase", "");
    for (const c of CLASES) {
      const o = L.DomUtil.create("option", "", sel);
      o.value = c;
      o.textContent = I18n.t(`flota.clase.${claveClase(c)}`);
    }
    sel.addEventListener("change", () => { estado.clase = sel.value; pintar(); });
    const esc = L.DomUtil.create("div", "escala", cuerpo);
    esc.setAttribute("role", "img");
    esc.setAttribute("aria-label", I18n.t("flota.leyenda_aria"));
    L.DomUtil.create("div", "barra", esc).style.background = gradienteCss();
    const ext = L.DomUtil.create("div", "ext", esc);
    L.DomUtil.create("span", "", ext).textContent = I18n.t("flota.leyenda_pocos");
    L.DomUtil.create("span", "", ext).textContent = I18n.t("flota.leyenda_muchos");
    // 🔴 Parados (última escucha), encendidos por defecto.
    const par = L.DomUtil.create("label", "parados", cuerpo);
    const casilla = L.DomUtil.create("input", "", par);
    casilla.type = "checkbox";
    casilla.checked = estado.verParados;
    casilla.setAttribute("data-flota-parados", "");
    L.DomUtil.create("span", "", par).textContent = I18n.t("flota.parados");
    casilla.addEventListener("change", () => { estado.verParados = casilla.checked; pintarParados(); });
    // 🔵 Pesqueros en el mar en movimiento (última escucha), también encendidos.
    const nav = L.DomUtil.create("label", "parados", cuerpo);
    const casillaNav = L.DomUtil.create("input", "", nav);
    casillaNav.type = "checkbox";
    casillaNav.checked = estado.verNavegando;
    casillaNav.setAttribute("data-flota-navegando", "");
    L.DomUtil.create("span", "", nav).textContent = I18n.t("flota.navegando");
    casillaNav.addEventListener("change", () => { estado.verNavegando = casillaNav.checked; pintarParados(); });
    const esc2 = L.DomUtil.create("div", "escucha", cuerpo);
    esc2.setAttribute("data-flota-escucha", "");
    L.DomUtil.create("div", "nota", cuerpo).textContent = I18n.t("flota.nota");
    const vacio = L.DomUtil.create("div", "vacio", cuerpo);
    vacio.setAttribute("data-flota-vacio", "");
    vacio.setAttribute("role", "status");
    vacio.hidden = true;
    return div;
  };
  return ctl;
}

// Capa de calor de Leaflet: un <canvas> del tamaño del mapa en su panel
// (debajo de los spots), que se repinta al soltar el mapa. Las manchas se
// pintan en gris con "lighten" (máximo por píxel) y luego cada gris se
// cambia por su color de tablaCalor().
function crearCapaCalor(L) {
  const tabla = tablaCalor();
  const Capa = L.Layer.extend({
    onAdd(map) {
      if (!map.getPane("flotaCalor")) {
        const p = map.createPane("flotaCalor");
        p.style.zIndex = 390;
        p.style.pointerEvents = "none";
      }
      this._lienzo = L.DomUtil.create("canvas", "flota-calor", map.getPane("flotaCalor"));
      this._lienzo.setAttribute("data-flota-calor", "");
      this._tip ||= L.tooltip({ direction: "top", offset: [0, -6] });
      map.on("moveend zoomend resize viewreset", this._redibujar, this);
      map.on("zoomstart", this._ocultar, this);
      map.on("mousemove click", this._señalar, this);
      map.on("mouseout", this._quitarTip, this);
      this._redibujar();
    },
    onRemove(map) {
      map.off("moveend zoomend resize viewreset", this._redibujar, this);
      map.off("zoomstart", this._ocultar, this);
      map.off("mousemove click", this._señalar, this);
      map.off("mouseout", this._quitarTip, this);
      this._quitarTip();
      L.DomUtil.remove(this._lienzo);
    },
    ponerZonas(zonas) { this._zonas = zonas || []; if (this._map) this._redibujar(); },
    _ocultar() { if (this._lienzo) this._lienzo.style.visibility = "hidden"; },
    _quitarTip() { if (this._tip && this._map?.hasLayer(this._tip)) this._map.removeLayer(this._tip); },
    _señalar(e) {
      const z = celdaCercana(this._zonas, e.latlng.lat, e.latlng.lng);
      if (!z) return this._quitarTip();
      this._tip.setLatLng(centroCelda(z.celda_lat, z.celda_lon)).setContent(textoCelda(z));
      if (!this._map.hasLayer(this._tip)) this._tip.addTo(this._map);
    },
    _redibujar() {
      const map = this._map, c = this._lienzo;
      if (!map || !c) return;
      const tam = map.getSize();
      c.width = tam.x; c.height = tam.y;
      c.style.width = `${tam.x}px`; c.style.height = `${tam.y}px`;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, tam.x, tam.y);
      ctx.globalCompositeOperation = "lighten";
      const zoom = map.getZoom();
      let n = 0;
      for (const z of this._zonas || []) {
        const [lat, lon] = centroCelda(z.celda_lat, z.celda_lon);
        const p = map.latLngToContainerPoint([lat, lon]);
        const r = radioBlobPx(zoom, lat);
        if (p.x < -r || p.y < -r || p.x > tam.x + r || p.y > tam.y + r) continue;
        const g = Math.round(255 * intensidadFlota(z.n_barcos));
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, `rgb(${g},${g},${g})`);
        gr.addColorStop(0.5, `rgb(${Math.round(g * 0.8)},${Math.round(g * 0.8)},${Math.round(g * 0.8)})`);
        gr.addColorStop(1, "rgb(0,0,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
        n++;
      }
      ctx.globalCompositeOperation = "source-over";
      if (tam.x && tam.y) {
        const img = ctx.getImageData(0, 0, tam.x, tam.y);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const k = d[i] * 4;
          d[i] = tabla[k]; d[i + 1] = tabla[k + 1]; d[i + 2] = tabla[k + 2]; d[i + 3] = tabla[k + 3];
        }
        ctx.putImageData(img, 0, 0);
      }
      c.dataset.celdas = String(n);
      c.style.visibility = "visible";
    },
  });
  return new Capa();
}

// ▶️: avanza un día cada PASO_PLAY_MS y da la vuelta; tocar la barra, Hoy
// o Ayer lo para.
function reproducir(si) {
  clearInterval(estado.reloj);
  estado.reloj = null;
  const boton = control?.getContainer()?.querySelector("[data-flota-play]");
  if (boton) {
    boton.textContent = si ? "⏸" : "▶";
    boton.setAttribute("aria-label", I18n.t(si ? "lluvia.pausar" : "lluvia.reproducir"));
  }
  if (!si) return;
  const dias = diasPlay();
  let i = estado.dia ? dias.indexOf(estado.dia) : -1;
  if (i < 0 || i >= dias.length - 1) i = -1;
  estado.reloj = setInterval(() => ponerDia((dias.indexOf(estado.dia) + 1) % dias.length), PASO_PLAY_MS);
  ponerDia(i + 1);
}
function ponerDia(i) {
  const dias = diasPlay();
  estado.dia = dias[Math.max(0, Math.min(dias.length - 1, i))];
  pintar();
}

// Círculos con la cifra: rojos la flota parada (puertos y mar), azules los
// pesqueros que se mueven en el mar.
function pintarParados() {
  if (!mapa) return;
  const L = window.L;
  capaParados ||= L.layerGroup();
  // Su propio panel, por encima de los spots (muchos puertos son spots).
  if (!mapa.getPane("flotaParados")) mapa.createPane("flotaParados").style.zIndex = 640;
  capaParados.clearLayers();
  const rojos = paradosVisibles(estado.parados), azules = navegandoVisibles(estado.parados);
  const filas = [...(estado.verNavegando ? azules : []), ...(estado.verParados ? rojos : [])];
  const ver = capaVisible(estado.modalidad) && (estado.verParados || estado.verNavegando);
  if (ver && !mapa.hasLayer(capaParados)) capaParados.addTo(mapa);
  if (!ver && mapa.hasLayer(capaParados)) mapa.removeLayer(capaParados);
  const etq = control?.getContainer()?.querySelector("[data-flota-escucha]");
  if (etq) {
    const u = ultimaEscucha([...rojos, ...azules]);
    etq.textContent = estado.parados === null ? "" : u ? I18n.t("flota.ultima_escucha", { hora: horaEscucha(u) }) : I18n.t("flota.sin_parados");
  }
  if (!ver) return;
  for (const f of filas) {
    const tam = tamParado(Number(f.n_barcos));
    const html = document.createElement("span");
    html.textContent = String(f.n_barcos);
    L.marker(posicionParado(f), {
      icon: L.divIcon({ className: f.tipo === "navegando" ? "flota-parado navegando" : "flota-parado", html, iconSize: [tam, tam] }),
      keyboard: false, title: textoParado(f), pane: "flotaParados",
    }).bindTooltip(textoParado(f), { direction: "top", offset: [0, -tam / 2] }).addTo(capaParados);
  }
}

function pintar() {
  pintarParados();
  if (!mapa || !calor) return;
  const div = control?.getContainer();
  const dias = diasPlay();
  const hayDias = diasConDatos(estado.historico, dias) >= MIN_DIAS_PLAY;
  if (div) {
    div.querySelectorAll("[data-periodo]").forEach((b) => b.setAttribute("aria-pressed", !estado.dia && b.dataset.periodo === estado.periodo ? "true" : "false"));
    const sel = div.querySelector("[data-flota-clase]");
    if (sel) sel.value = estado.clase;
    const play = div.querySelector("[data-flota-play]"), barra = div.querySelector("[data-flota-dia]"), fecha = div.querySelector("[data-flota-fecha]");
    if (play && !estado.reloj) { play.textContent = "▶"; play.setAttribute("aria-label", I18n.t("lluvia.reproducir")); }
    if (play) play.disabled = !hayDias;
    if (barra) {
      barra.disabled = !hayDias;
      barra.value = String(estado.dia ? dias.indexOf(estado.dia) : dias.length - 1);
    }
    if (fecha) {
      fecha.textContent = !hayDias ? (estado.historico === null ? "" : I18n.t("flota.pocos_dias"))
        : estado.dia ? fechaDia(estado.dia) : I18n.t("flota.play_ayuda", { n: DIAS_PLAY });
    }
  }
  let zonas, vacioTxt;
  if (estado.dia) {
    zonas = zonasDelDia(estado.historico, estado.dia, estado.clase);
    vacioTxt = I18n.t("flota.vacio_dia", { fecha: fechaDia(estado.dia) });
  } else {
    if (estado.filas === null) return calor.ponerZonas([]); // todavía cargando
    zonas = zonasVisibles(estado.filas, { periodo: estado.periodo, clase: estado.clase });
    vacioTxt = textoVacio(estado.periodo);
  }
  calor.ponerZonas(zonas);
  const vacio = div?.querySelector("[data-flota-vacio]");
  if (vacio) {
    vacio.hidden = zonas.length > 0;
    vacio.textContent = zonas.length ? "" : vacioTxt;
  }
}

function cargar() {
  if (estado.cargando) return estado.cargando;
  if (estado.filas !== null && Date.now() - estado.pedido < REFRESCO_MS) return Promise.resolve();
  estado.cargando = Promise.resolve()
    .then(() => Promise.all([
      Promise.resolve().then(() => consultar()).catch((e) => { console.warn("Flota:", e?.message || e); return null; }),
      Promise.resolve().then(() => consultarDias(diasPlay()[0])).catch((e) => { console.warn("Flota (días):", e?.message || e); return null; }),
      Promise.resolve().then(() => consultarParados()).catch((e) => { console.warn("Flota (parados):", e?.message || e); return null; }),
    ]))
    .then(([filas, historico, parados]) => {
      estado.parados = Array.isArray(parados) ? parados : (estado.parados ?? []);
      estado.filas = Array.isArray(filas) ? filas : (estado.filas ?? []);
      estado.historico = Array.isArray(historico) ? historico : (estado.historico ?? []);
      estado.pedido = Date.now();
    })
    .finally(() => { estado.cargando = null; if (capaVisible(estado.modalidad)) pintar(); });
  return estado.cargando;
}

function aplicar() {
  if (!mapa) return;
  const L = window.L;
  if (!capaVisible(estado.modalidad)) {
    reproducir(false);
    if (calor && mapa.hasLayer(calor)) mapa.removeLayer(calor);
    if (capaParados && mapa.hasLayer(capaParados)) mapa.removeLayer(capaParados);
    if (controlPuesto) { control.remove(); controlPuesto = false; mapa.attributionControl?.removeAttribution(atribucion()); }
    return;
  }
  ponerEstilos();
  calor ||= crearCapaCalor(L);
  if (!mapa.hasLayer(calor)) calor.addTo(mapa);
  control ||= crearControl(L);
  if (!controlPuesto) { control.addTo(mapa); controlPuesto = true; mapa.attributionControl?.addAttribution(atribucion()); }
  pintar();
  cargar();
}

// Modalidad al arrancar: la que marca <html data-modalidad>, si no la última
// elegida en este navegador (localStorage va_modalidad), si no "costa".
export function modalidadInicial(doc = globalThis.document, almacen = globalThis.localStorage) {
  const validas = ["costa", "embarcacion", "submarina"];
  const html = doc?.documentElement?.dataset?.modalidad;
  if (validas.includes(html)) return html;
  try { const g = almacen?.getItem("va_modalidad"); if (validas.includes(g)) return g; } catch (e) { /* sin almacenamiento */ }
  return "costa";
}

// map: el mapa de Leaflet; consultar(): promesa con las filas de flota_zonas.
// consultarDias(desde): promesa con las filas de flota_zonas_dia desde ese día.
// consultarParados(): promesa con las filas de flota_parados.
export function montarCapa(map, { consultar: fn, consultarDias: fnDias, consultarParados: fnParados } = {}) {
  if (fnParados) consultarParados = fnParados;
  mapa = map;
  if (fn) consultar = fn;
  if (fnDias) consultarDias = fnDias;
  estado.modalidad = modalidadInicial();
  document.addEventListener("modalidad", (ev) => porModalidad(ev.detail?.modalidad));
  aplicar();
}

// Cambia la modalidad (lo hace el evento `modalidad`; también se puede a mano).
export function porModalidad(m) {
  if (!m || m === estado.modalidad) return;
  estado.modalidad = m;
  aplicar();
}

export const visible = () => capaVisible(estado.modalidad);
