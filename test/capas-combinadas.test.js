// Varias capas de mar a la vez (2026-10-09, assets/js/capas-combinadas.js):
// cómo se dibuja cada una al combinarse, quién pone el fondo, el globo del
// toque, lo que se recuerda y los trazos de 〰 Frentes. Sin red ni DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAPAS, PRIORIDAD_FONDO, CLAVE, normalizarActivas, puedeSerFondo, elegirFondo, modoCapa,
  leerEstado, guardarEstado, nivelClorofila, textoClorofila, textoTemperatura, textoFrentes,
  lineasGlobo, textoFila, NIVELES_CLOROFILA,
} from "../assets/js/capas-combinadas.js";
import { pixelesFrentesTrazo, pixelesFrentes, CLASES_TRAZO, HALO_TRAZO, COLORES_FRENTES } from "../assets/js/frentes.js";
import { filaDeDatos, filaReal } from "../assets/js/capas-mar.js";
import { fuenteEs } from "./i18n-html.js";

const HTML = fuenteEs(readFileSync("index.html", "utf8"));
const TODAS = ["clorofila", "temperatura-agua", "frentes", "corriente"];

test("una sola capa: se dibuja exactamente como antes", () => {
  assert.deepEqual(modoCapa("clorofila", ["clorofila"], "clorofila"), { relleno: true, trazos: false, lineas: false, flechas: false, fondo: true, sola: true });
  const t = modoCapa("temperatura-agua", ["temperatura-agua"], "temperatura-agua");
  assert.ok(t.relleno && t.lineas && !t.trazos, "color por grado + isotermas, como hoy");
  const f = modoCapa("frentes", ["frentes"], "frentes");
  assert.ok(f.relleno && f.flechas && !f.trazos, "frentes sola: su imagen de siempre (con el gris) y sus flechas");
  const c = modoCapa("corriente", ["corriente"], "corriente");
  assert.ok(c.relleno && c.flechas, "manchas + flechas");
  for (const n of CAPAS) assert.equal(elegirFondo([n]), n, "sola, siempre es su propio fondo");
});

test("combinación: solo una pinta el fondo y las demás no lo tapan", () => {
  for (const preferido of [null, ...CAPAS]) {
    const fondo = elegirFondo(TODAS, preferido);
    const modos = TODAS.map((n) => modoCapa(n, TODAS, fondo));
    assert.equal(modos.filter((m) => m.relleno).length, 1, `un solo relleno (preferido ${preferido})`);
    assert.equal(modos.filter((m) => m.fondo).length, 1);
  }
  const fondo = elegirFondo(TODAS);
  const m = Object.fromEntries(TODAS.map((n) => [n, modoCapa(n, TODAS, fondo)]));
  assert.ok(m["temperatura-agua"].lineas && !m["temperatura-agua"].relleno, "temperatura en isotermas");
  assert.ok(m.frentes.trazos && !m.frentes.relleno, "frentes en trazos, sin relleno opaco");
  assert.ok(!m.frentes.flechas && m.corriente.flechas, "las flechas no se duplican");
  assert.ok(m.corriente.flechas && !m.corriente.relleno, "corriente solo flechas si no es el fondo");
  // Clorofila sin ser el fondo: contornos.
  const mc = modoCapa("clorofila", ["clorofila", "temperatura-agua"], "temperatura-agua");
  assert.ok(mc.lineas && !mc.relleno);
  // Frentes con otra que no es corriente: trazos y sus flechas.
  const mf = modoCapa("frentes", ["clorofila", "frentes"], "clorofila");
  assert.ok(mf.trazos && mf.flechas);
  assert.equal(modoCapa("frentes", ["clorofila"], "clorofila"), null, "apagada: nada");
});

test("prioridad del fondo: la elegida; si no, clorofila > temperatura > corriente > frentes", () => {
  assert.deepEqual(PRIORIDAD_FONDO, ["clorofila", "temperatura-agua", "corriente", "frentes"]);
  assert.equal(elegirFondo(TODAS), "clorofila");
  assert.equal(elegirFondo(["temperatura-agua", "corriente", "frentes"]), "temperatura-agua");
  assert.equal(elegirFondo(["corriente", "frentes"]), "corriente");
  assert.equal(elegirFondo(TODAS, "corriente"), "corriente", "la que el usuario puso de fondo");
  assert.equal(elegirFondo(TODAS, "temperatura-agua"), "temperatura-agua");
  assert.equal(elegirFondo(["clorofila", "temperatura-agua"], "corriente"), "clorofila", "si la elegida está apagada, la regla por defecto");
  assert.equal(elegirFondo(TODAS, "frentes"), "clorofila", "frentes nunca es el fondo si hay otra");
  assert.equal(puedeSerFondo("frentes", ["frentes", "corriente"]), false);
  assert.equal(puedeSerFondo("frentes", ["frentes"]), true);
  assert.equal(puedeSerFondo("clorofila", ["corriente"]), false, "apagada no");
  assert.equal(elegirFondo([]), null);
  assert.deepEqual(normalizarActivas(["corriente", "x", "clorofila", "corriente"]), ["clorofila", "corriente"], "orden fijo, sin repetidas ni desconocidas");
});

test("globo combinado: una línea por capa, coma decimal, lenguaje llano", () => {
  const lineas = lineasGlobo({
    corriente: "Corriente hacia el NE, 0,3 nudos (0,6 km/h).",
    "temperatura-agua": textoTemperatura(19.375),
    clorofila: textoClorofila(0.45),
    frentes: textoFrentes({ frente_clorofila: true, dist_frente_clorofila_km: 3.4, frente_termico: false, frente_ambos: false, frente_y_corriente: false, convergencia: false }),
  });
  assert.deepEqual(lineas, [
    "🌿 Clorofila moderada (0,45 mg/m³)",
    "🌡 19,4 °C en superficie",
    "〰 Borde de agua verde y azul a unos 3 km",
    "🌊 Corriente hacia el NE, 0,3 nudos (0,6 km/h)",
  ]);
  assert.equal(textoClorofila(0.1), "Clorofila baja (0,1 mg/m³: agua limpia)");
  assert.equal(textoClorofila(3.2), "Clorofila alta (3,2 mg/m³: posible floración, agua turbia)");
  assert.equal(textoClorofila(null), "Clorofila: sin dato aquí (nubes o costa)");
  assert.equal(nivelClorofila(0.2), "moderada");
  assert.equal(nivelClorofila(2), "alta");
  assert.equal(textoTemperatura(null), "Temperatura: sin dato aquí");
  assert.equal(textoFrentes({ frente_ambos: true, dist_frente_ambos_km: 1 }), "Borde de clorofila y de temperatura aquí mismo: lo más prometedor");
  assert.equal(textoFrentes({ frente_clorofila: true, dist_frente_clorofila_km: 5, frente_termico: true, dist_frente_termico_km: 8.6 }), "Borde de agua verde y azul a unos 5 km y cambio de temperatura a unos 9 km");
  assert.equal(textoFrentes({ frente_clorofila: false, frente_termico: false }), "Sin frentes a menos de 10 km");
  assert.equal(textoFrentes({ frente_clorofila: null, frente_termico: false }), "Sin cambios de temperatura a menos de 10 km");
  assert.equal(textoFrentes(null), "Frentes: sin dato aquí");
  // Nada de notas internas ni cifras de umbral.
  for (const l of lineas) assert.doesNotMatch(l, /umbral|°C\/km|log10|null|undefined|NaN/);
});

test("leyenda conjunta: textos cortos de cada fila", () => {
  const fondo = elegirFondo(TODAS);
  assert.match(textoFila("temperatura-agua", modoCapa("temperatura-agua", TODAS, fondo), { intervalo: 0.5 }), /cada 0,5 °C/);
  assert.match(textoFila("clorofila", modoCapa("clorofila", TODAS, fondo)), /azul, poca/);
  assert.match(textoFila("clorofila", modoCapa("clorofila", TODAS, "temperatura-agua")), /líneas verdes/);
  assert.match(textoFila("corriente", modoCapa("corriente", TODAS, fondo)), /flechas/);
  assert.deepEqual(NIVELES_CLOROFILA, [0.2, 0.5, 2]);
});

test("persistencia: se recuerda lo encendido y el fondo; sin almacenamiento, nada se rompe", () => {
  const mapa = new Map();
  const almacen = { getItem: (k) => (mapa.has(k) ? mapa.get(k) : null), setItem: (k, v) => mapa.set(k, String(v)) };
  assert.deepEqual(leerEstado(almacen), { activas: [], fondo: null });
  guardarEstado(almacen, { activas: ["corriente", "clorofila"], fondo: "corriente" });
  assert.equal(mapa.get(CLAVE), JSON.stringify({ activas: ["clorofila", "corriente"], fondo: "corriente" }));
  assert.deepEqual(leerEstado(almacen), { activas: ["clorofila", "corriente"], fondo: "corriente" });
  mapa.set(CLAVE, "{roto");
  assert.deepEqual(leerEstado(almacen), { activas: [], fondo: null });
  mapa.set(CLAVE, JSON.stringify({ activas: ["mar", "frentes"], fondo: "nada" }));
  assert.deepEqual(leerEstado(almacen), { activas: ["frentes"], fondo: null });
  const roto = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  assert.deepEqual(leerEstado(roto), { activas: [], fondo: null });
  assert.doesNotThrow(() => guardarEstado(roto, { activas: ["clorofila"] }));
  assert.deepEqual(leerEstado(null), { activas: [], fondo: null });
  assert.doesNotThrow(() => guardarEstado(null, { activas: [] }));
});

// Malla mínima de frentes: 4x4 celdas, un frente térmico en la columna 1
// (filas 0-3), "sin dato" (nubes) en la columna 3 y tierra en (0,0).
function mallaFrentes() {
  const d = { norte: 44, sur: 43.6, oeste: -4, este: -3.6, paso: 0.1, filas: 4, columnas: 4 };
  const bytes = new Uint8Array(16).fill(8); // nivel 1, sin frente
  for (let f = 0; f < 4; f++) { bytes[f * 4 + 1] = 2 | 8; bytes[f * 4 + 3] = 64; }
  bytes[0] = 255;
  return { d, bytes };
}

test("trazos de 〰 Frentes: solo los bordes, con halo, sin el gris de sin dato", () => {
  const { d, bytes } = mallaFrentes();
  const { ancho, alto, px } = pixelesFrentesTrazo(d, bytes, COLORES_FRENTES, 4);
  assert.equal(ancho, 16);
  assert.equal(alto, 16);
  assert.deepEqual(CLASES_TRAZO, ["doble", "clorofila", "termico"]);
  const pixel = (x, y) => Array.from(px.slice((y * ancho + x) * 4, (y * ancho + x) * 4 + 4));
  const y = 8; // fila del medio
  assert.deepEqual(pixel(4, y), HALO_TRAZO, "borde izquierdo del trazo: halo");
  assert.deepEqual(pixel(7, y), HALO_TRAZO, "borde derecho: halo");
  assert.deepEqual(pixel(5, y), COLORES_FRENTES.termico, "dentro: el color, opaco");
  assert.equal(pixel(13, y)[3], 0, "las nubes (gris en la capa sola) no se pintan");
  assert.equal(pixel(9, y)[3], 0, "mar sin frente: transparente");
  // La capa sola sí pinta el gris (no cambia).
  const solo = pixelesFrentes(d, bytes, COLORES_FRENTES);
  assert.equal(solo[(1 * 4 + 3) * 4 + 3], COLORES_FRENTES.sin_dato[3]);
  // Fila real = fila de siempre sin redondear.
  for (let r = 0; r < 16; r++) assert.equal(Math.min(3, Math.floor(filaReal(d, r, 16))), filaDeDatos(d, r, 16));
});

test("index.html: conmutadores independientes, fondo con un toque, recuerdo y sin on*=", () => {
  assert.match(HTML, /import \* as CapasCombinadas from "\/assets\/js\/capas-combinadas\.js"/);
  for (const id of ["toggleClorofila", "toggleTempAgua", "toggleFrentes", "toggleCorriente"]) {
    assert.match(HTML, new RegExp(`id="${id}"[^>]*aria-pressed="false"`));
  }
  // Encender una no apaga las demás: ya no existe apagarCapaMar.
  assert.doesNotMatch(HTML, /apagarCapaMar\(/);
  assert.doesNotMatch(HTML, /capaMarActiva\b/);
  assert.match(HTML, /id="capaMarFilas"/);
  assert.match(HTML, /getElementById\("capaMarFilas"\)\.addEventListener\("click"/, "tocar una fila = fondo");
  assert.match(HTML, /capasMar\.fondo = fila\.dataset\.capa/);
  assert.match(HTML, /guardarEstado\(almacenLocal\(\)/);
  assert.match(HTML, /restaurarCapasMar\(\)/);
  assert.match(HTML, /"CAPAS DEL MAR"/);
  assert.match(HTML, /globoCapasMar\(lat, lng\)/);
  // Créditos de Copernicus siempre, con los DOIs de todas las capas encendidas.
  assert.match(HTML, /function creditoCapaMar\(ds\)/);
  assert.match(HTML, /new Set\(\[\]\.concat\(ds\)\.flatMap\(\(d\) => d\.dois \|\| \[d\.doi\]\)\)/);
  // Mismo bucket, una petición por fichero aunque se pida a la vez.
  assert.match(HTML, /cargandoCapasMar\[nombre\] \|\|=/);
  assert.doesNotMatch(HTML, /\son[a-z]{3,}\s*=\s*["'`]/i, "sin on*= (CSP)");
});
