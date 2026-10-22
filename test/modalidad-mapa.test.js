// Modalidad de pesca global en el mapa (2026-10-22, diseño aprobado por
// Mikel): píldora 🪨 🚤 🤿 arriba a la izquierda del mapa, sin pregunta la
// primera vez (Desde costa), recuerda la última elegida en "va_modalidad",
// un punto propio de embarcación/buceo pone la suya sin guardarla, y cada
// cambio sale una sola vez como evento "modalidad" del documento (lo escucha
// la capa de la flota). Las pestañas de la ficha se quitaron.
// Aquí se ejecuta el bloque real de index.html en un sandbox con un DOM de
// mentira; la prueba en Chromium está en test/navegador/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { leerDiccionario } from "./i18n-html.js";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const INICIO = "// ---- Modalidad de pesca global";
const FIN = "// Caudal del río asociado al spot";
const BLOQUE = HTML.slice(HTML.indexOf(INICIO), HTML.indexOf(FIN));

function elemento(extra = {}) {
  const attrs = {};
  const clases = new Set();
  const oyentes = {};
  return {
    textContent: "", tabIndex: 0, dataset: {}, ...extra,
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return attrs[k] ?? null; },
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c) },
    addEventListener(t, fn) { oyentes[t] = fn; }, disparar(t, ev) { oyentes[t]?.(ev); },
    focus() { sandbox.enfocado = this.dataset.modalidad; },
  };
}
let sandbox;

function montar({ guardada = null, region = "es" } = {}) {
  const almacen = new Map(guardada ? [["va_modalidad", guardada]] : []);
  const botones = ["costa", "embarcacion", "submarina"].map((m) => elemento({ dataset: { modalidad: m } }));
  const porId = { modActual: elemento(), modDesc: elemento(), vaNotaReglas: elemento(), modalidadNombre: elemento() };
  for (const b of botones) porId[`modPill-${b.dataset.modalidad}`] = b;
  const eventos = [];
  const tf = { on: false, visible() { return this.on; }, ponerVisible(v) { this.on = !!v; } };
  sandbox = {
    eventos, botones, tf, enfocado: null, repintes: 0,
    I18n: { t: (k) => k, velocidad: (v) => `${v}`, metros: (v) => `${v}` },
    localStorage: { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)) },
    almacen,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => porId[id],
      querySelectorAll: (sel) => (sel.includes("modalidadPildora") ? botones : []),
      dispatchEvent: (ev) => eventos.push(ev),
    },
    window: { Batimetria: { m: null, porModalidad(m) { this.m = m; } }, TipoFondo: tf },
    regionDeCentro: () => region,
    selectorFondo: { refrescar() {} },
    setTimeout: () => 0, clearTimeout: () => {},
    vaEstado: { s: null, idxSel: 3, modalidad: "costa" },
    spotAbiertoActual: null,
    pintarIndicePesca() { sandbox.repintes++; }, pintarVentanaActividad() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(`${BLOQUE}\nthis.api = { ponerModalidad, elegirModalidad, prepararModalidad };`, sandbox);
  return sandbox;
}

const marcada = (sb) => sb.botones.find((b) => b.getAttribute("aria-checked") === "true")?.dataset.modalidad;

test("la primera vez: Desde costa, sin pregunta y sin guardar nada", () => {
  const sb = montar();
  assert.equal(sb.vaEstado.modalidad, "costa");
  assert.equal(marcada(sb), "costa");
  assert.equal(sb.document.documentElement.dataset.modalidad, "costa");
  assert.equal(sb.almacen.size, 0);
  assert.equal(sb.eventos.length, 0, "al cargar no se emite (se lee de <html data-modalidad>)");
});

test("recuerda la última elegida (clave de siempre, va_modalidad) y descarta valores raros", () => {
  assert.equal(montar({ guardada: "submarina" }).vaEstado.modalidad, "submarina");
  assert.equal(montar({ guardada: "helicoptero" }).vaEstado.modalidad, "costa");
});

test("elegir en la píldora: guarda, marca, enseña el nombre y emite un solo evento", () => {
  const sb = montar();
  sb.spotAbiertoActual = { slug: "bakio" };
  sb.api.elegirModalidad("embarcacion", false);
  assert.equal(sb.almacen.get("va_modalidad"), "embarcacion");
  assert.equal(marcada(sb), "embarcacion");
  assert.equal(sb.botones[1].tabIndex, 0);
  assert.equal(sb.botones[0].tabIndex, -1);
  assert.equal(sb.document.getElementById("modActual").textContent, "mapa.mod.tab_embarcacion");
  assert.equal(sb.document.getElementById("modalidadNombre").textContent, "va.mod.embarcacion");
  assert.ok(sb.document.getElementById("modalidadNombre").classList.contains("visible"));
  assert.equal(sb.eventos.length, 1);
  assert.equal(sb.eventos[0].type, "modalidad");
  assert.deepEqual({ ...sb.eventos[0].detail }, { modalidad: "embarcacion" });
  assert.equal(sb.repintes, 1, "la ficha abierta se recalcula");
  assert.equal(sb.vaEstado.idxSel, null);
  sb.api.elegirModalidad("embarcacion", false);
  assert.equal(sb.eventos.length, 1, "la misma modalidad no vuelve a emitir");
});

test("teclado: flechas, Inicio y Fin mueven la selección y el foco", () => {
  const sb = montar();
  const tecla = (b, key) => b.disparar("keydown", { key, preventDefault() {} });
  tecla(sb.botones[0], "ArrowRight");
  assert.equal(marcada(sb), "embarcacion");
  assert.equal(sb.enfocado, "embarcacion");
  tecla(sb.botones[1], "ArrowLeft");
  assert.equal(marcada(sb), "costa");
  tecla(sb.botones[0], "ArrowLeft");
  assert.equal(marcada(sb), "submarina", "da la vuelta");
  tecla(sb.botones[2], "Home");
  assert.equal(marcada(sb), "costa");
  tecla(sb.botones[0], "End");
  assert.equal(marcada(sb), "submarina");
  sb.botones[1].disparar("click");
  assert.equal(marcada(sb), "embarcacion");
});

test("punto propio de embarcación o buceo: cambia la modalidad global sin guardarla, solo al abrirlo", () => {
  const sb = montar({ guardada: "costa" });
  sb.api.prepararModalidad({ slug: "propio-1", tipo: "embarcacion" });
  assert.equal(sb.vaEstado.modalidad, "embarcacion");
  assert.equal(marcada(sb), "embarcacion");
  assert.equal(sb.almacen.get("va_modalidad"), "costa", "no es una elección del usuario");
  assert.equal(sb.eventos.at(-1).detail.modalidad, "embarcacion");
  sb.api.elegirModalidad("costa", false);
  sb.api.prepararModalidad({ slug: "propio-1", tipo: "embarcacion" });
  assert.equal(sb.vaEstado.modalidad, "costa", "repintar el mismo punto no pisa lo que eligió después");
  sb.api.prepararModalidad({ slug: "propio-2", tipo: "buceo" });
  assert.equal(sb.vaEstado.modalidad, "submarina");
  sb.api.prepararModalidad({ slug: "bakio" });
  assert.equal(sb.vaEstado.modalidad, "submarina", "un spot fijo se abre en la modalidad global");
});

test("capas: isóbatas en Embarcación; tipo de fondo en Submarina (no en NZ) y se apaga solo si lo encendió ella", () => {
  const sb = montar();
  sb.api.elegirModalidad("embarcacion", false);
  assert.equal(sb.window.Batimetria.m, "embarcacion");
  assert.equal(sb.tf.on, false);
  sb.api.elegirModalidad("submarina", false);
  assert.equal(sb.tf.on, true);
  sb.api.elegirModalidad("costa", false);
  assert.equal(sb.tf.on, false);
  sb.tf.on = true; // encendido a mano
  sb.api.elegirModalidad("submarina", false);
  sb.api.elegirModalidad("costa", false);
  assert.equal(sb.tf.on, true, "lo encendido a mano se respeta");
  const nz = montar({ region: "nz" });
  nz.api.elegirModalidad("submarina", false);
  assert.equal(nz.tf.on, false, "EMODnet no cubre Nueva Zelanda");
});

test("index.html: píldora accesible en el mapa, sin pestañas en la ficha y un solo emisor del evento", () => {
  const pildora = HTML.match(/<div class="modalidad-pildora"[^>]*>[\s\S]*?<\/div>/)?.[0] || "";
  assert.match(pildora, /role="radiogroup"/);
  assert.match(pildora, /data-i18n-aria-label="mapa\.mod\.grupo"/);
  for (const m of ["costa", "embarcacion", "submarina"]) {
    assert.match(pildora, new RegExp(`role="radio" id="modPill-${m}"[^>]*data-i18n-aria-label="va\\.mod\\.${m}"`), m);
  }
  assert.ok(HTML.indexOf('id="modalidadPildora"') < HTML.indexOf('id="toggleLeyenda"'), "dentro del mapa");
  assert.doesNotMatch(HTML, /modTab-|role="tablist"[^>]*mapa\.mod\.grupo/, "las pestañas de la ficha ya no están");
  assert.equal(HTML.match(/new CustomEvent\("modalidad"/g)?.length, 1);
  assert.equal(HTML.match(/vaEstado\.modalidad = /g)?.length, 2, "solo la carga inicial y ponerModalidad la cambian");
});

test("i18n: claves de la píldora y de la ficha en es, en y pt", () => {
  const claves = ["mapa.mod.grupo", "mapa.mod.cambiar_en_mapa", "va.mod.costa", "va.mod.embarcacion", "va.mod.submarina",
    "mapa.mod.tab_costa", "mapa.mod.tab_embarcacion", "mapa.mod.tab_submarina"];
  for (const idioma of ["es", "en", "pt"]) {
    const D = leerDiccionario(new URL(`../assets/i18n/${idioma}.js`, import.meta.url));
    for (const k of claves) assert.ok(typeof D[k] === "string" && D[k].trim(), `${idioma}: ${k}`);
    assert.match(D["mapa.mod.cambiar_en_mapa"], /🪨 🚤 🤿/, idioma);
  }
});
