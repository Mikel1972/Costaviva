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

// Escala discreta de ámbar a granate (no se confunde con los azules de las
// isóbatas, que también salen en Embarcación).
export const TRAMOS = [
  { min: 3, max: 4, color: "#F6B84B" },
  { min: 5, max: 9, color: "#EE8434" },
  { min: 10, max: 19, color: "#D2492A" },
  { min: 20, max: Infinity, color: "#8E1B2C" },
];
export function colorFlota(n) {
  const t = TRAMOS.find((x) => n >= x.min && n <= x.max);
  return (t || TRAMOS[0]).color;
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

export const textoVacio = (periodo) => I18n.t(periodo === "ayer" ? "flota.vacio_ayer" : "flota.vacio_24h");

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
const REFRESCO_MS = 10 * 60_000;
let mapa = null, consultar = async () => [], grupo = null, control = null, controlPuesto = false;
const estado = { plegado: null, modalidad: "costa", periodo: "24h", clase: "todas", filas: null, pedido: 0, cargando: null };
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
  .flota-control .escala { display: flex; gap: 2px; margin-top: 6px; }
  .flota-control .escala span { flex: 1; text-align: center; padding: 1px 0; border-radius: 4px; color: var(--tinta); }
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
      b.addEventListener("click", () => { estado.periodo = p; pintar(); });
    }
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
    for (const t of TRAMOS) {
      const s = L.DomUtil.create("span", "", esc);
      s.style.background = t.color;
      if (t.max === Infinity) s.style.color = "var(--superficie)";
      s.textContent = t.max === Infinity ? `${t.min}+` : `${t.min}-${t.max}`;
    }
    L.DomUtil.create("div", "nota", cuerpo).textContent = I18n.t("flota.nota");
    const vacio = L.DomUtil.create("div", "vacio", cuerpo);
    vacio.setAttribute("data-flota-vacio", "");
    vacio.setAttribute("role", "status");
    vacio.hidden = true;
    return div;
  };
  return ctl;
}

function pintar() {
  if (!mapa || !grupo) return;
  const L = window.L;
  grupo.clearLayers();
  const div = control?.getContainer();
  if (div) {
    div.querySelectorAll("[data-periodo]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.periodo === estado.periodo ? "true" : "false"));
    const sel = div.querySelector("[data-flota-clase]");
    if (sel) sel.value = estado.clase;
  }
  if (estado.filas === null) return; // todavía cargando
  const zonas = zonasVisibles(estado.filas, { periodo: estado.periodo, clase: estado.clase });
  for (const f of zonas) {
    const color = colorFlota(Number(f.n_barcos));
    L.rectangle(limitesCelda(f.celda_lat, f.celda_lon), {
      color, weight: 1, opacity: 0.9, fillColor: color, fillOpacity: 0.45, interactive: true,
    }).bindTooltip(textoCelda(f), { sticky: true }).addTo(grupo);
  }
  const vacio = div?.querySelector("[data-flota-vacio]");
  if (vacio) {
    vacio.hidden = zonas.length > 0;
    vacio.textContent = zonas.length ? "" : textoVacio(estado.periodo);
  }
}

function cargar() {
  if (estado.cargando) return estado.cargando;
  if (estado.filas !== null && Date.now() - estado.pedido < REFRESCO_MS) return Promise.resolve();
  estado.cargando = Promise.resolve()
    .then(() => consultar())
    .then((filas) => { estado.filas = Array.isArray(filas) ? filas : []; estado.pedido = Date.now(); })
    .catch((e) => { console.warn("Flota:", e?.message || e); estado.filas ??= []; })
    .finally(() => { estado.cargando = null; if (capaVisible(estado.modalidad)) pintar(); });
  return estado.cargando;
}

function aplicar() {
  if (!mapa) return;
  const L = window.L;
  if (!capaVisible(estado.modalidad)) {
    if (grupo && mapa.hasLayer(grupo)) mapa.removeLayer(grupo);
    if (controlPuesto) { control.remove(); controlPuesto = false; mapa.attributionControl?.removeAttribution(atribucion()); }
    return;
  }
  ponerEstilos();
  grupo ||= L.featureGroup();
  if (!mapa.hasLayer(grupo)) grupo.addTo(mapa);
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
export function montarCapa(map, { consultar: fn } = {}) {
  mapa = map;
  if (fn) consultar = fn;
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
