// assets/js/capa-gfw.js
//
// Actividad pesquera comercial de Global Fishing Watch (2026-11-02, aprobado
// por Mikel). CAPA GRATIS, para todos y en todas las modalidades: es la
// condición de GFW (Leah Buckley, 02-11) para no pedir licencia comercial.
// No meterla nunca detrás de Premium.
//
// Datos: tabla gfw_esfuerzo de Supabase (lectura pública), que rellena cada
// día scripts/gfw/esfuerzo-gfw.mjs: horas de pesca APARENTE (inferida del
// AIS) por celda de 0,1° (~10 km), por región (iberia, nz), periodo
// (reciente: 7 días que acaban hace 4; habitual: el mismo mes de los 3 años
// anteriores, media por año) y grupo de arte. Nunca barcos ni rutas.
//
// Cómo se presenta (lo prometido a GFW el 31-10): como presión pesquera
// sobre el mar, junto a las zonas sin pesca, nunca como guía de dónde hay
// peces; con la nota de "esfuerzo aparente, solo barcos con AIS" y la cita
// "Powered by Global Fishing Watch." enlazada a su web.
//
// Lo puro (sin DOM ni red) se prueba en test/capa-gfw.test.js.
import { I18n } from "./i18n-modulo.js";

export const PASO = 0.1;
export const PERIODOS = ["reciente", "habitual"];
export const ARTES = ["todas", "arrastre", "cerco", "palangre", "enmalle", "otras"];
export const URL_GFW = "https://globalfishingwatch.org";
const CLAVE_LOCAL = "va_gfw";

// Región de los datos según el centro del mapa.
export const regionDe = (lon) => (lon > 100 || lon < -150 ? "nz" : "iberia");

// Color de una celda: de amarillo pálido a morado según las horas, en escala
// logarítmica entre la mínima y la máxima de lo que se pinta.
const PALETA = ["#FDE68A", "#FBBF24", "#F97316", "#DC2626", "#9D174D", "#581C87"];
export function colorHoras(h, max) {
  if (!(h > 0) || !(max > 0)) return PALETA[0];
  const t = Math.min(1, Math.log1p(h) / Math.log1p(max));
  return PALETA[Math.min(PALETA.length - 1, Math.floor(t * PALETA.length))];
}

export const limitesCelda = (lat, lon) => [[+lat, +lon], [+(+lat + PASO).toFixed(4), +(+lon + PASO).toFixed(4)]];

const fmtHoras = (h) => (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10).toLocaleString(I18n.locale());
export const textoCelda = (f, arte) => I18n.t(arte === "todas" ? "gfw.celda" : "gfw.celda_arte", { h: fmtHoras(Number(f.horas)), arte: I18n.t(`gfw.arte.${arte}`).toLowerCase() });

// "Del 23 al 29 de oct." o, en lo habitual, "noviembre de 2023 a 2025".
export function textoFechas(periodo, filas) {
  const f = (filas || [])[0];
  if (!f) return "";
  const fecha = (d, o) => new Date(`${d}T12:00:00Z`).toLocaleDateString(I18n.locale(), { ...o, timeZone: "UTC" });
  if (periodo === "habitual") {
    return I18n.t("gfw.fechas_habitual", { mes: fecha(f.hasta, { month: "long" }), desde: f.desde.slice(0, 4), hasta: f.hasta.slice(0, 4) });
  }
  return I18n.t("gfw.fechas_reciente", { desde: fecha(f.desde, { day: "numeric", month: "short" }), hasta: fecha(f.hasta, { day: "numeric", month: "short" }) });
}

// Mes de "lo habitual" (para el botón): el mes actual.
export const mesActual = (ahora = new Date()) => ahora.toLocaleDateString(I18n.locale(), { month: "long" });

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
let mapa = null, consultar = async () => [], control = null, capa = null, renderer = null;
const estado = { ver: false, plegado: true, periodo: "reciente", arte: "todas", region: null, filas: null, pedido: 0 };

function leerLocal() {
  try { Object.assign(estado, JSON.parse(localStorage.getItem(CLAVE_LOCAL) || "{}")); } catch { /* sin almacenamiento */ }
  if (!PERIODOS.includes(estado.periodo)) estado.periodo = "reciente";
  if (!ARTES.includes(estado.arte)) estado.arte = "todas";
}
function guardarLocal() {
  try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify({ ver: estado.ver, periodo: estado.periodo, arte: estado.arte })); } catch { /* sin almacenamiento */ }
}

function ponerEstilos() {
  if (document.getElementById("estilos-gfw")) return;
  const st = document.createElement("style");
  st.id = "estilos-gfw";
  st.textContent = `
  .gfw-control { background: var(--superficie); border-radius: 14px; padding: 8px 10px; max-width: 240px;
    font: 600 11px var(--f-texto); color: var(--tinta); box-shadow: 0 6px 16px rgba(11,30,63,0.2); }
  .gfw-control.plegado { padding: 6px 10px; border-radius: 999px; }
  .gfw-control .chip { display: flex; align-items: center; gap: 6px; width: 100%; font: 700 11px var(--f-texto);
    color: var(--tinta); background: transparent; border: 0; padding: 0; cursor: pointer; text-align: left; }
  .gfw-control .chip .flecha { margin-left: auto; color: var(--tinta-2); }
  .gfw-control .cuerpo { margin-top: 6px; }
  .gfw-control .cuerpo[hidden] { display: none; }
  .gfw-control .ver { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .gfw-control .ver input { margin: 0; }
  .gfw-control .periodos { display: flex; gap: 4px; margin-bottom: 6px; }
  .gfw-control .periodos button { flex: 1; font: inherit; border: 1px solid var(--linea); border-radius: 999px;
    background: transparent; color: var(--tinta); padding: 3px 6px; cursor: pointer; }
  .gfw-control .periodos button[aria-pressed="true"] { background: var(--acento); border-color: var(--acento); color: var(--superficie); }
  .gfw-control label.arte { display: block; color: var(--tinta-2); }
  .gfw-control select { font: inherit; width: 100%; margin-top: 2px; }
  .gfw-control .fechas, .gfw-control .nota, .gfw-control .vacio { color: var(--tinta-2); font-weight: 500; margin-top: 4px; line-height: 1.35; }
  .gfw-control .vacio[hidden] { display: none; }
  .gfw-control .escala { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 6px; }
  .gfw-control .escala span { flex: 1; }
  .gfw-control .atrib { margin-top: 6px; font-weight: 700; }
  .gfw-control .atrib a { color: var(--acento); }`;
  document.head.appendChild(st);
}

const esquina = (ancho = globalThis.innerWidth) => (ancho <= 720 ? "topleft" : "bottomleft");

function crearControl(L) {
  const ctl = L.control({ position: esquina() });
  ctl.onAdd = () => {
    const div = L.DomUtil.create("div", "gfw-control");
    div.setAttribute("data-gfw-control", "");
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    const chip = L.DomUtil.create("button", "chip", div);
    chip.type = "button";
    chip.setAttribute("data-gfw-chip", "");
    chip.setAttribute("aria-controls", "gfwCuerpo");
    const tit = L.DomUtil.create("span", "tit", chip);
    const flecha = L.DomUtil.create("span", "flecha", chip);
    flecha.setAttribute("aria-hidden", "true");
    const cuerpo = L.DomUtil.create("div", "cuerpo", div);
    cuerpo.id = "gfwCuerpo";
    const ponerPlegado = (p) => {
      estado.plegado = p;
      chip.setAttribute("aria-expanded", p ? "false" : "true");
      tit.textContent = I18n.t(p ? "gfw.chip" : "gfw.titulo");
      flecha.textContent = p ? "▾" : "▴";
      cuerpo.hidden = p;
      div.classList.toggle("plegado", p);
    };
    chip.addEventListener("click", () => ponerPlegado(!estado.plegado));
    ponerPlegado(estado.plegado);

    const ver = L.DomUtil.create("label", "ver", cuerpo);
    const casilla = L.DomUtil.create("input", "", ver);
    casilla.type = "checkbox";
    casilla.checked = estado.ver;
    casilla.setAttribute("data-gfw-ver", "");
    L.DomUtil.create("span", "", ver).textContent = I18n.t("gfw.ver");
    casilla.addEventListener("change", () => { estado.ver = casilla.checked; guardarLocal(); cargar(); });

    const per = L.DomUtil.create("div", "periodos", cuerpo);
    per.setAttribute("role", "group");
    for (const p of PERIODOS) {
      const b = L.DomUtil.create("button", "", per);
      b.type = "button";
      b.dataset.gfwPeriodo = p;
      b.textContent = p === "habitual" ? I18n.t("gfw.habitual", { mes: mesActual() }) : I18n.t("gfw.reciente");
      b.addEventListener("click", () => { estado.periodo = p; estado.ver = true; casilla.checked = true; guardarLocal(); cargar(); });
    }
    const lab = L.DomUtil.create("label", "arte", cuerpo);
    lab.textContent = I18n.t("gfw.arte_titulo");
    const sel = L.DomUtil.create("select", "", lab);
    sel.setAttribute("data-gfw-arte", "");
    for (const a of ARTES) {
      const o = L.DomUtil.create("option", "", sel);
      o.value = a;
      o.textContent = I18n.t(`gfw.arte.${a}`);
    }
    sel.value = estado.arte;
    sel.addEventListener("change", () => { estado.arte = sel.value; estado.ver = true; casilla.checked = true; guardarLocal(); cargar(); });

    const esc = L.DomUtil.create("div", "escala", cuerpo);
    esc.setAttribute("aria-hidden", "true");
    for (const c of PALETA) L.DomUtil.create("span", "", esc).style.background = c;
    L.DomUtil.create("div", "fechas", cuerpo).setAttribute("data-gfw-fechas", "");
    const vacio = L.DomUtil.create("div", "vacio", cuerpo);
    vacio.setAttribute("data-gfw-vacio", "");
    vacio.setAttribute("role", "status");
    vacio.hidden = true;
    L.DomUtil.create("div", "nota", cuerpo).textContent = I18n.t("gfw.nota");
    const at = L.DomUtil.create("div", "atrib", cuerpo);
    const a = L.DomUtil.create("a", "", at);
    a.href = URL_GFW;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Powered by Global Fishing Watch.";
    return div;
  };
  return ctl;
}

function pintar() {
  if (!mapa) return;
  const L = window.L;
  capa ||= L.layerGroup();
  renderer ||= L.canvas({ padding: 0.3 });
  if (!mapa.getPane("gfwEsfuerzo")) mapa.createPane("gfwEsfuerzo").style.zIndex = 390;
  capa.clearLayers();
  const div = control?.getContainer();
  div?.querySelectorAll("[data-gfw-periodo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gfwPeriodo === estado.periodo)));
  const filas = estado.filas || [];
  const fechas = div?.querySelector("[data-gfw-fechas]");
  if (fechas) fechas.textContent = estado.ver ? textoFechas(estado.periodo, filas) : "";
  const vacio = div?.querySelector("[data-gfw-vacio]");
  if (vacio) { vacio.hidden = !(estado.ver && estado.filas && !filas.length); vacio.textContent = I18n.t("gfw.vacio"); }
  if (!estado.ver) { if (mapa.hasLayer(capa)) mapa.removeLayer(capa); return; }
  if (!mapa.hasLayer(capa)) capa.addTo(mapa);
  const max = Math.max(0, ...filas.map((f) => Number(f.horas)));
  for (const f of filas) {
    L.rectangle(limitesCelda(f.celda_lat, f.celda_lon), {
      renderer, pane: "gfwEsfuerzo", stroke: false, fillColor: colorHoras(Number(f.horas), max), fillOpacity: 0.55, interactive: true,
    }).bindTooltip(textoCelda(f, estado.arte), { sticky: true }).addTo(capa);
  }
}

async function cargar() {
  if (!mapa) return;
  estado.region = regionDe(mapa.getCenter().lng);
  if (!estado.ver) { estado.filas = null; pintar(); return; }
  const n = ++estado.pedido;
  try {
    const filas = await consultar({ region: estado.region, periodo: estado.periodo, arte: estado.arte });
    if (n !== estado.pedido) return;
    estado.filas = Array.isArray(filas) ? filas : [];
  } catch (e) {
    console.warn("GFW:", e?.message || e);
    if (n === estado.pedido) estado.filas = [];
  }
  pintar();
}

// consultar({ region, periodo, arte }): promesa con las filas de gfw_esfuerzo
// (celda_lat, celda_lon, horas, desde, hasta).
export function montarCapa(map, { consultar: fn } = {}) {
  mapa = map;
  if (fn) consultar = fn;
  leerLocal();
  estado.plegado = true;
  ponerEstilos();
  control = crearControl(window.L);
  control.addTo(map);
  map.on("moveend", () => { if (regionDe(map.getCenter().lng) !== estado.region) cargar(); });
  cargar();
}
