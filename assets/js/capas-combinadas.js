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
export const CAPAS = ["clorofila", "temperatura-agua", "frentes", "corriente"];
export const PRIORIDAD_FONDO = ["clorofila", "temperatura-agua", "corriente", "frentes"];
export const ICONOS = { clorofila: "🌿", "temperatura-agua": "🌡", frentes: "〰", corriente: "🌊" };
export const NOMBRES = { clorofila: "Clorofila", "temperatura-agua": "Temperatura del agua", frentes: "Frentes", corriente: "Corriente" };
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
const coma = (x, dec = 1) => String(+x.toFixed(dec)).replace(".", ",");

// "Clorofila moderada (0,45 mg/m³)"; null = sin dato.
export function nivelClorofila(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return v < 0.2 ? "baja" : v < 2 ? "moderada" : "alta";
}
export function textoClorofila(v) {
  const n = nivelClorofila(v);
  if (!n) return "Clorofila: sin dato aquí (nubes o costa)";
  const extra = n === "baja" ? "agua limpia" : n === "alta" ? "posible floración, agua turbia" : null;
  return `Clorofila ${n} (${coma(v, v < 1 ? 2 : 1)} mg/m³${extra ? `: ${extra}` : ""})`;
}
export function textoTemperatura(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "Temperatura: sin dato aquí";
  return `${coma(v)} °C en superficie`;
}

// Resumen de 〰 Frentes para una línea del globo, a partir de los rasgos de
// frentes.js (rasgosPunto, radio 10 km). null = fuera de la malla.
export function textoFrentes(r) {
  if (!r) return "Frentes: sin dato aquí";
  const dist = (k) => (r[`dist_${k}_km`] <= 3 ? "aquí mismo" : `a unos ${Math.round(r[`dist_${k}_km`])} km`);
  if (r.frente_ambos) return `Borde de clorofila y de temperatura ${dist("frente_ambos")}: lo más prometedor`;
  if (r.frente_y_corriente) return `Borde donde la corriente junta el agua ${dist("frente_y_corriente")}`;
  const partes = [];
  if (r.frente_clorofila) partes.push(`borde de agua verde y azul ${dist("frente_clorofila")}`);
  if (r.frente_termico) partes.push(`cambio de temperatura ${dist("frente_termico")}`);
  if (partes.length) return partes.join(" y ").replace(/^./, (c) => c.toUpperCase());
  if (r.convergencia) return `La corriente junta el agua ${dist("convergencia")}`;
  return r.frente_clorofila === null ? "Sin cambios de temperatura a menos de 10 km" : "Sin frentes a menos de 10 km";
}

// Globo combinado: una línea por capa, en el orden de CAPAS, con su icono.
// partes = { nombre: texto }. Quita el punto final de cada texto.
export function lineasGlobo(partes) {
  return CAPAS.filter((n) => partes[n]).map((n) => `${ICONOS[n]} ${String(partes[n]).replace(/\.\s*$/, "")}`);
}

// Texto corto de la leyenda conjunta para cada fila (lo que se ve en el
// mapa), una línea en el móvil.
export function textoFila(nombre, modo, { intervalo = null } = {}) {
  const cada = intervalo ? `, cada ${coma(intervalo)} °C` : "";
  if (nombre === "clorofila") return modo.relleno ? "azul, poca · verde · amarillo, mucha" : "líneas verdes, en mg/m³";
  if (nombre === "temperatura-agua") return modo.relleno ? `un color por grado; líneas${cada}` : `líneas con su número${cada}`;
  if (nombre === "corriente") return modo.relleno ? "más oscuro, más fuerte; flechas: hacia dónde va" : "flechas: hacia dónde va (más largas, más fuerte)";
  if (nombre === "frentes") return modo.trazos ? "" : "bordes entre aguas distintas";
  return "";
}

// Etiquetas cortas de las muestras de 〰 Frentes en la fila.
export const ETIQUETAS_TRAZO = { doble: "dos señales", clorofila: "clorofila", termico: "temperatura" };
