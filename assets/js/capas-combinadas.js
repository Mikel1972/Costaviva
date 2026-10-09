// assets/js/capas-combinadas.js
// Varias capas de mar a la vez (2026-10-09, Mikel: "Debiéramos poder
// seleccionar varios campos a la vez: temperatura con clorofila o esas dos
// con alguno más… y el resumen igual debiera ir en otro lugar o en otro
// formato para ver que es un resumen de varios").
//
// Antes, una capa de mar a la vez (se tapaban). Ahora cada botón (🌿 🌡 〰 🌊)
// es un conmutador independiente y, para que no se tapen, al combinarse cada
// capa se dibuja de una forma distinta:
//   🌡 Temperatura  isotermas con su número; su color de fondo, solo si es
//                   la capa de fondo.
//   🌿 Clorofila    color de fondo (la de fondo por defecto); si otra es el
//                   fondo, líneas verdes discontinuas (0,2 · 0,5 · 2 mg/m³).
//   〰 Frentes      trazos de color con un halo blanco (sin el gris de "sin
//                   dato" ni el celeste tenue), encima de lo que haya; su
//                   imagen de siempre solo si es la única.
//   🌊 Corriente    flechas siempre; manchas solo si es la de fondo.
// Con UNA sola capa todo se ve exactamente como antes.
//
// Solo una capa pinta el color de fondo: la que el usuario eligió tocando su
// fila en la leyenda ("la última que pusiste como fondo") o, si no eligió o
// la apagó, por defecto clorofila > temperatura > corriente > frentes.
// 〰 Frentes nunca es el fondo si hay otra capa (son trazos finos: debajo no
// se vería nada).
//
// Cálculo puro, sin DOM ni red: lo usan index.html (window.CapasCombinadas) y
// test/capas-combinadas.test.js.

// Orden de los botones, de las filas de la leyenda y de las líneas del globo.
import { I18n } from "./i18n-modulo.js";

export const CAPAS = ["clorofila", "temperatura-agua", "frentes", "corriente"];
export const PRIORIDAD_FONDO = ["clorofila", "temperatura-agua", "corriente", "frentes"];
export const ICONOS = { clorofila: "🌿", "temperatura-agua": "🌡", frentes: "〰", corriente: "🌊" };
export const NOMBRES = { clorofila: I18n.t("cc.nombre.clorofila"), "temperatura-agua": I18n.t("cc.nombre.tagua"), frentes: I18n.t("cc.nombre.frentes"), corriente: I18n.t("cc.nombre.corriente") };
// Líneas de clorofila cuando no es el fondo (mg/m³): las clases baja <
// 0,2 ≤ moderada < 2 ≤ alta de la leyenda y del índice, y 0,5 en medio.
export const NIVELES_CLOROFILA = [0.2, 0.5, 2];
export const CLAVE = "cv_capas_mar";

export function normalizarActivas(lista) {
  const set = new Set(Array.isArray(lista) ? lista : []);
  return CAPAS.filter((n) => set.has(n));
}

// ¿Puede esta capa ser el fondo con estas activas?
export function puedeSerFondo(nombre, activas) {
  const a = normalizarActivas(activas);
  if (!a.includes(nombre)) return false;
  return a.length === 1 || nombre !== "frentes";
}

// Capa que pinta el color de fondo (null si no hay ninguna activa).
export function elegirFondo(activas, preferido = null) {
  const a = normalizarActivas(activas);
  if (!a.length) return null;
  if (a.length === 1) return a[0];
  if (preferido && puedeSerFondo(preferido, a)) return preferido;
  return PRIORIDAD_FONDO.find((n) => puedeSerFondo(n, a)) || null;
}

// Cómo se dibuja cada capa. Devuelve:
//   relleno    su imagen de color de siempre
//   trazos     (frentes) solo los bordes, con halo, sin relleno opaco
//   lineas     (temperatura) isotermas; (clorofila) contornos discontinuos
//   flechas    (corriente / frentes) flechas de corriente
//   fondo      es la capa de fondo
export function modoCapa(nombre, activas, fondo) {
  const a = normalizarActivas(activas);
  if (!a.includes(nombre)) return null;
  const sola = a.length === 1;
  const esFondo = nombre === fondo;
  const m = { relleno: false, trazos: false, lineas: false, flechas: false, fondo: esFondo, sola };
  if (nombre === "clorofila") { m.relleno = esFondo; m.lineas = !esFondo; }
  else if (nombre === "temperatura-agua") { m.relleno = esFondo; m.lineas = true; }
  else if (nombre === "corriente") { m.relleno = esFondo; m.flechas = true; }
  else if (nombre === "frentes") {
    m.relleno = sola;
    m.trazos = !sola;
    // Con 🌊 Corriente encendida, sus flechas ya dicen hacia dónde va: no se
    // duplican.
    m.flechas = !a.includes("corriente");
  }
  return m;
}

// Estado guardado (solo comodidad: sin almacenamiento todo funciona igual).
export function leerEstado(almacen) {
  try {
    const x = JSON.parse(almacen ? almacen.getItem(CLAVE) : "null");
    if (!x || typeof x !== "object") return { activas: [], fondo: null };
    return { activas: normalizarActivas(x.activas), fondo: CAPAS.includes(x.fondo) ? x.fondo : null };
  } catch (e) {
    return { activas: [], fondo: null };
  }
}
export function guardarEstado(almacen, estado) {
  try {
    if (almacen) almacen.setItem(CLAVE, JSON.stringify({ activas: normalizarActivas(estado.activas), fondo: CAPAS.includes(estado.fondo) ? estado.fondo : null }));
  } catch (e) { /* sin almacenamiento */ }
}

// ---------------------------------------------------------------------------
// Textos (coma decimal, lenguaje llano, sin cifras de umbrales).
// ---------------------------------------------------------------------------
const coma = (x, dec = 1) => I18n.decimal(String(+x.toFixed(dec)));

// "Clorofila moderada (0,45 mg/m³)"; null = sin dato.
export function nivelClorofila(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return v < 0.2 ? "baja" : v < 2 ? "moderada" : "alta";
}
export function textoClorofila(v) {
  const n = nivelClorofila(v);
  if (!n) return I18n.t("cc.clorofila.sin_dato");
  const extra = n === "baja" ? I18n.t("cc.clorofila.extra_baja") : n === "alta" ? I18n.t("cc.clorofila.extra_alta") : null;
  return I18n.t(`cc.clorofila.${n}`, { v: coma(v, v < 1 ? 2 : 1), extra: extra ? `: ${extra}` : "" });
}
export function textoTemperatura(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return I18n.t("cc.temp.sin_dato");
  return I18n.t("capas.tagua.formato", { v: coma(v) });
}

// Resumen de 〰 Frentes para una línea del globo, a partir de los rasgos de
// frentes.js (rasgosPunto, radio 10 km). null = fuera de la malla.
export function textoFrentes(r) {
  if (!r) return I18n.t("cc.frentes.sin_dato");
  const dist = (k) => (r[`dist_${k}_km`] <= 3 ? I18n.t("frentes.aqui_mismo") : I18n.t("frentes.a_unos", { km: Math.round(r[`dist_${k}_km`]) }));
  if (r.frente_ambos) return I18n.t("cc.frentes.ambos", { dist: dist("frente_ambos") });
  if (r.frente_y_corriente) return I18n.t("cc.frentes.y_corriente", { dist: dist("frente_y_corriente") });
  const partes = [];
  if (r.frente_clorofila) partes.push(I18n.t("cc.frentes.clorofila", { dist: dist("frente_clorofila") }));
  if (r.frente_termico) partes.push(I18n.t("cc.frentes.termico", { dist: dist("frente_termico") }));
  if (partes.length) return partes.join(I18n.t("va.seg.y")).replace(/^./, (c) => c.toUpperCase());
  if (r.convergencia) return I18n.t("cc.frentes.convergencia", { dist: dist("convergencia") });
  return r.frente_clorofila === null ? I18n.t("frentes.sin_cambios_temp") : I18n.t("frentes.sin_frentes");
}

// Globo combinado: una línea por capa, en el orden de CAPAS, con su icono.
// partes = { nombre: texto }. Quita el punto final de cada texto.
export function lineasGlobo(partes) {
  return CAPAS.filter((n) => partes[n]).map((n) => `${ICONOS[n]} ${String(partes[n]).replace(/\.\s*$/, "")}`);
}

// Texto corto de la leyenda conjunta para cada fila (lo que se ve en el
// mapa), una línea en el móvil.
export function textoFila(nombre, modo, { intervalo = null } = {}) {
  const cada = intervalo ? I18n.t("cc.fila.cada", { v: coma(intervalo) }) : "";
  if (nombre === "clorofila") return modo.relleno ? I18n.t("cc.fila.clorofila_relleno") : I18n.t("cc.fila.clorofila_lineas");
  if (nombre === "temperatura-agua") return modo.relleno ? I18n.t("cc.fila.tagua_relleno", { cada }) : I18n.t("cc.fila.tagua_lineas", { cada });
  if (nombre === "corriente") return modo.relleno ? I18n.t("cc.fila.corriente_relleno") : I18n.t("cc.fila.corriente_flechas");
  if (nombre === "frentes") return modo.trazos ? "" : I18n.t("cc.fila.frentes");
  return "";
}

// Etiquetas cortas de las muestras de 〰 Frentes en la fila.
export const ETIQUETAS_TRAZO = { doble: I18n.t("cc.trazo.doble"), clorofila: I18n.t("cc.trazo.clorofila"), termico: I18n.t("cc.trazo.termico") };
