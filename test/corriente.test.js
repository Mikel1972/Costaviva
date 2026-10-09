// Tests de 🌊 Corriente (2026-10-09, Mikel: "¿La corriente se puede mostrar
// por manchas (con direcciones)?"). Lo que escribe Python
// (scripts/fuentes/descargar-capas.py, salida_frentes: fixture generado con
// él) lo lee igual el navegador (assets/js/corriente.js): manchas por tramos,
// flechas en rejilla de pantalla, frase del toque y leyenda. Además, que el
// botón y la tarjeta minimizable están en index.html. Sin red. Corre en
// tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as C from "../assets/js/corriente.js";
import { pixelesCapa, valorEnPunto } from "../assets/js/capas-mar.js";

const X = JSON.parse(readFileSync("test/fixtures/corriente-mini.json", "utf8"));
const D = X.frentes;
const B = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));
const U = B(D.corriente.u), V = B(D.corriente.v);
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const centro = (f, c) => [D.norte - (f + 0.5) * D.paso, D.oeste + (c + 0.5) * D.paso];

test("corriente: la fuerza de Python (malla fina) se lee igual en JS", () => {
  const m = C.mallaVelocidad(D, B);
  assert.equal(m.fina, true);
  assert.equal(m.bytes.length, D.filas * D.columnas);
  assert.equal(m.paso, D.paso);
  for (let c = 0; c < 12; c++) {
    const [la, lo] = centro(0, c);
    assert.ok(Math.abs(valorEnPunto(m, m.bytes, la, lo) - X.ms_por_columna[c]) < 0.011, `columna ${c}`);
  }
  assert.equal(valorEnPunto(m, m.bytes, ...centro(11, 11)), null, "tierra");
});

test("corriente: sin `velocidad` (ficheros de antes) sale de u/v de la malla de las flechas", () => {
  const viejo = { ...D, corriente: { ...D.corriente } };
  delete viejo.corriente.velocidad;
  const m = C.mallaVelocidad(viejo, B);
  assert.equal(m.fina, false);
  assert.equal(m.filas, 4);
  assert.equal(m.columnas, 4);
  assert.ok(Math.abs(m.sur - D.sur) < 1e-9 && Math.abs(m.este - D.este) < 1e-9);
  // Bloque de las columnas 0-2: media 0,10 m/s.
  assert.ok(Math.abs(valorEnPunto(m, m.bytes, ...centro(0, 1)) - 0.1) < 0.03);
  assert.equal(C.mallaVelocidad({ ...D, corriente: undefined }, B), null);
});

test("corriente: tramos en nudos, leyenda en nudos y km/h, paleta de un tono de claro a oscuro", () => {
  const ms = (kn) => kn * C.NUDO_MS;
  assert.equal(C.tramo(ms(0.1)), 0);
  assert.equal(C.tramo(ms(0.15)), 1);
  assert.equal(C.tramo(ms(0.29)), 1);
  assert.equal(C.tramo(ms(0.4)), 2);
  assert.equal(C.tramo(ms(0.7)), 3);
  assert.equal(C.tramo(ms(1.2)), 4);
  assert.deepEqual(C.leyendaTramos().map((f) => f[1]), [
    "Menos de 0,15 nudos (< 0,3 km/h): muy floja",
    "0,15-0,3 nudos (0,3-0,6 km/h)",
    "0,3-0,5 nudos (0,6-0,9 km/h)",
    "0,5-1 nudo (0,9-1,9 km/h)",
    "Más de 1 nudo (> 1,9 km/h)",
  ]);
  assert.equal(C.PALETA_CORRIENTE.length, C.TRAMOS_NUDOS.length + 1);
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b, i) => a + b * [0.2126, 0.7152, 0.0722][i], 0);
  const l = C.PALETA_CORRIENTE.map(lum);
  for (let i = 1; i < l.length; i++) assert.ok(l[i] < l[i - 1], "más fuerte = más oscuro");
});

test("corriente: manchas por escalones con el mismo pintado que clorofila y temperatura", () => {
  const m = C.mallaVelocidad(D, B);
  const px = pixelesCapa(m, m.bytes, C.PALETA_CORRIENTE, C.valorColorCorriente);
  const color = (f, c) => [...px.slice((f * m.columnas + c) * 4, (f * m.columnas + c) * 4 + 4)];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  assert.deepEqual(color(0, 0), [...hex(C.PALETA_CORRIENTE[0]), 255]); // 0,04 m/s
  assert.deepEqual(color(0, 3), [...hex(C.PALETA_CORRIENTE[2]), 255]); // 0,22 m/s = 0,43 nudos
  assert.deepEqual(color(0, 5), [...hex(C.PALETA_CORRIENTE[3]), 255]); // 0,34 m/s = 0,66 nudos
  assert.deepEqual(color(0, 11), [...hex(C.PALETA_CORRIENTE[4]), 255]); // 0,70 m/s = 1,36 nudos
  assert.equal(color(11, 11)[3], 0, "tierra transparente");
  // En el mapa: manchas suaves a 3 píxeles por celda, mismos colores.
  const s1 = C.pixelesCorriente(m, 1);
  assert.deepEqual([...s1.px], [...px], "a 1 píxel por celda, igual que pixelesCapa");
  const s3 = C.pixelesCorriente(m, 3);
  assert.equal(s3.ancho, 36);
  assert.equal(s3.alto, 36);
  const c3 = (r, k) => [...s3.px.slice((r * 36 + k) * 4, (r * 36 + k) * 4 + 4)];
  assert.deepEqual(c3(1, 1), [...hex(C.PALETA_CORRIENTE[0]), 255]);
  assert.deepEqual(c3(1, 34), [...hex(C.PALETA_CORRIENTE[4]), 255]);
  assert.equal(c3(34, 34)[3], 0, "tierra transparente");
});

test("corriente: frase llana del toque, sin notas internas", () => {
  const m = C.mallaVelocidad(D, B);
  const en = (f, c) => C.corrienteEnPunto(D, m, U, V, ...centro(f, c));
  assert.equal(C.textoToque(en(0, 5)), "Corriente hacia el NE, 0,7 nudos (1,2 km/h).");
  assert.equal(C.textoToque(en(0, 0)), "Corriente hacia el NE, 0,1 nudos (0,1 km/h).");
  assert.equal(C.textoToque(en(11, 11)), "Tierra o sin dato aquí.");
  assert.equal(C.textoToque(null, C.dentroDeZona(m, 50, -4)), "Fuera de la zona con datos.");
  assert.equal(C.textoToque({ ms: 0.01, u: 0.01, v: 0 }), "Corriente casi parada.");
  assert.equal(C.textoToque({ ms: 0.5144, u: 0, v: -0.5 }), "Corriente hacia el S, 1 nudo (1,9 km/h).");
  assert.equal(C.textoToque({ ms: 0.3, u: null, v: null }), "Corriente de 0,6 nudos (1,1 km/h).");
});

test("corriente: flechas en rejilla fija de pantalla, legibles en el móvil", () => {
  const p = C.rejillaPantalla(375, 600);
  const xs = [...new Set(p.map((q) => q.x))], ys = [...new Set(p.map((q) => q.y))];
  assert.ok(xs.length <= 12 && ys.length <= 12);
  assert.ok(xs[1] - xs[0] >= 56 && ys[1] - ys[0] >= 56, "nunca a menos de 56 px");
  assert.ok(C.rejillaPantalla(1600, 900).length <= 12 * 12);
  assert.deepEqual(C.rejillaPantalla(0, 100), []);
  const m = C.mallaVelocidad(D, B);
  const puntos = [[0, 0], [0, 6], [0, 11], [11, 11]].map(([f, c], i) => ({ x: i * 60, y: 0, lat: centro(f, c)[0], lon: centro(f, c)[1] }));
  const fl = C.flechasPantalla(D, m, U, V, puntos);
  assert.equal(fl.length, 3, "en tierra no hay flecha");
  for (const f of fl) assert.ok(f.dx > 0 && f.dy < 0, "hacia el NE: derecha y arriba en pantalla");
  assert.ok(fl[0].largo < fl[1].largo && fl[1].largo < fl[2].largo, "más fuerte, más larga");
  assert.ok(fl[2].largo <= 34 && fl[0].largo >= 12);
});

test("corriente: botón en la columna de las capas de mar, conmutador independiente y sin on*=", () => {
  assert.match(HTML, /id="toggleCorriente"[^>]*aria-pressed="false"/);
  assert.match(HTML, /class="boyas-toggle corriente-toggle"/);
  assert.match(HTML, /alternarCapaMar\("corriente"\)/);
  assert.match(HTML, /fichero: "frentes"/, "reutiliza frentes.json, sin fichero nuevo");
  assert.match(HTML, /import \* as Corriente from "\/assets\/js\/corriente\.js"/);
  assert.match(HTML, /sin marea/i);
  assert.doesNotMatch(HTML, /\son[a-z]{3,}\s*=\s*["'`]/i, "sin on*= (CSP)");
});
