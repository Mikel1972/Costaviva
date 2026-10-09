// Test de las isotermas y la escala adaptativa de 🌡 T. agua (2026-10-09,
// assets/js/isotermas.js). Campos sintéticos con el formato de
// capas/temperatura-agua.json (un byte por celda, 255 = tierra o sin dato,
// escala lineal de 0,125 °C). Sin red ni DOM: corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ventanaMalla, percentilesVisibles, escalaAdaptativa, intervaloIsotermas, nivelesIsotermas,
  contornos, isotermasVisibles, etiquetasIsotermas, textoGrados, textoExtremo, textoToque, textoIntervalo,
} from "../assets/js/isotermas.js";

const ESCALA = { tipo: "lineal", min: 0, paso: 0.125 };
// Malla de filas x columnas de 0,1° desde (45 N, -5 E), valor(f, c) en °C o null.
function malla(filas, columnas, valor) {
  const d = { norte: 45, sur: 45 - filas * 0.1, oeste: -5, este: -5 + columnas * 0.1, paso: 0.1, filas, columnas, escala: ESCALA };
  const bytes = new Uint8Array(filas * columnas);
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const v = valor(f, c);
      bytes[f * columnas + c] = v === null ? 255 : Math.round(v / 0.125);
    }
  }
  return { d, bytes };
}
const todo = (d) => ({ norte: d.norte, sur: d.sur, oeste: d.oeste, este: d.este });

test("gradiente oeste-este: una isoterma vertical por nivel, en la columna esperada", () => {
  // 15 °C en la columna 0, +0,25 °C por columna: 18 °C en la columna 12.
  const { d, bytes } = malla(20, 30, (f, c) => 15 + 0.25 * c);
  const iso = isotermasVisibles(d, bytes, todo(d), [18, 20]);
  assert.deepEqual(iso.map((x) => x.nivel), [18, 20]);
  for (const { nivel, lineas } of iso) {
    assert.equal(lineas.length, 1, `una sola línea de ${nivel} °C`);
    const l = lineas[0];
    const colEsperada = (nivel - 15) / 0.25; // índice de columna (centros)
    const lonEsperada = d.oeste + (colEsperada + 0.5) * d.paso;
    for (const [, lon] of l) assert.ok(Math.abs(lon - lonEsperada) < 0.06, `lon ${lon} ≈ ${lonEsperada}`);
    // Recorre la malla de norte a sur (de centro a centro).
    const lats = l.map((p) => p[0]);
    assert.ok(Math.abs(Math.max(...lats) - (d.norte - 0.05)) < 1e-9);
    assert.ok(Math.abs(Math.min(...lats) - (d.sur + 0.05)) < 1e-9);
  }
});

test("mancha cálida circular: isoterma cerrada alrededor del centro", () => {
  const { d, bytes } = malla(41, 41, (f, c) => 22 - 0.1 * Math.hypot(f - 20, c - 20));
  const [{ lineas }] = isotermasVisibles(d, bytes, todo(d), [21]);
  assert.equal(lineas.length, 1);
  const l = lineas[0];
  assert.deepEqual(l[0], l[l.length - 1], "cerrada: empieza y acaba en el mismo punto");
  // Radio ≈ 10 celdas = 1°.
  const [latC, lonC] = [d.norte - 20.5 * d.paso, d.oeste + 20.5 * d.paso];
  for (const [lat, lon] of l) {
    const r = Math.hypot(lat - latC, lon - lonC);
    assert.ok(r > 0.85 && r < 1.15, `radio ${r}`);
  }
});

test("tierra y celdas sin dato: la isoterma no las cruza", () => {
  // Mitad sur = tierra; gradiente norte-sur en el mar.
  const { d, bytes } = malla(20, 20, (f, c) => (f >= 10 ? null : 16 + 0.3 * f));
  const iso = isotermasVisibles(d, bytes, todo(d), [17, 30]);
  assert.deepEqual(iso.map((x) => x.nivel), [17], "30 °C no existe: sin línea");
  for (const [lat] of iso[0].lineas.flat()) assert.ok(lat > d.norte - 10 * d.paso, "nada sobre tierra");
  // Una línea entre mar y tierra no aparece: el borde de la costa no es una isoterma.
  const { d: d2, bytes: b2 } = malla(10, 10, (f, c) => (c < 5 ? 18 : null));
  assert.deepEqual(isotermasVisibles(d2, b2, todo(d2), [18, 17.5, 18.5]), []);
});

test("silla (marching squares): dos líneas, sin cruzarse", () => {
  // Esquinas tl y br por encima del nivel.
  const campo = new Float32Array([20, 10, 10, 20]);
  const l = contornos(campo, 2, 2, 15);
  assert.equal(l.length, 2);
  for (const x of l) assert.equal(x.length, 2);
});

test("ruido de una celda: se descarta (largo mínimo)", () => {
  const { d, bytes } = malla(20, 20, (f, c) => (f === 10 && c === 10 ? 25 : 18));
  assert.deepEqual(isotermasVisibles(d, bytes, todo(d), [19]), []);
});

test("escala adaptativa: percentiles 2-98 del mar VISIBLE, redondeados a medio grado", () => {
  // Oeste 14 °C, este de 17 a 20 °C; tierra en una franja.
  const { d, bytes } = malla(50, 100, (f, c) => (c < 50 ? 14 : c < 55 ? null : 17 + (3 * (c - 55)) / 44));
  const este = { norte: d.norte, sur: d.sur, oeste: -5 + 5.5, este: d.este };
  const pct = percentilesVisibles(d, bytes, este);
  assert.ok(pct.bajo >= 17 && pct.bajo < 17.25, `bajo ${pct.bajo}`);
  assert.ok(pct.alto > 19.75 && pct.alto <= 20, `alto ${pct.alto}`);
  assert.deepEqual(escalaAdaptativa(pct), { min: 17, max: 20 });
  // Toda la malla: el oeste frío entra en la escala.
  assert.equal(escalaAdaptativa(percentilesVisibles(d, bytes, todo(d))).min, 14);
  // Sin mar a la vista (solo la franja de tierra): null, se queda la escala anterior.
  assert.equal(percentilesVisibles(d, bytes, { norte: 45, sur: 40, oeste: 0.05, este: 0.4 }), null);
  // Fuera de la malla.
  assert.equal(percentilesVisibles(d, bytes, { norte: 60, sur: 55, oeste: 0, este: 1 }), null);
});

test("escala adaptativa: un percentil 2 % fuera de rango no estira la escala", () => {
  // 1 % de celdas a 5 °C (ruido junto a la costa): no deben contar.
  const { d, bytes } = malla(10, 100, (f, c) => (f === 0 && c < 10 ? 5 : 18 + c / 50));
  const esc = escalaAdaptativa(percentilesVisibles(d, bytes, todo(d)));
  assert.equal(esc.min, 18);
});

test("escala adaptativa: ancho mínimo de 2 °C con el mar casi uniforme", () => {
  const esc = escalaAdaptativa({ bajo: 18.25, alto: 18.5 });
  assert.equal(esc.max - esc.min, 2);
  assert.ok(esc.min <= 18.25 && esc.max >= 18.5);
  assert.deepEqual(escalaAdaptativa({ bajo: 16.1, alto: 20.9 }), { min: 16, max: 21 });
  assert.equal(escalaAdaptativa(null), null);
});

test("intervalo: 1 °C normal, 0,5 °C si el rango es estrecho, 2 °C muy alejado, como mucho 10 líneas", () => {
  assert.equal(intervaloIsotermas({ bajo: 16, alto: 21 }, 8), 1);
  assert.equal(intervaloIsotermas({ bajo: 18.5, alto: 20.875 }, 7), 0.5);
  assert.equal(intervaloIsotermas({ bajo: 16, alto: 21 }, 5), 2);
  assert.equal(intervaloIsotermas({ bajo: 10, alto: 28 }, 8), 2);
  assert.deepEqual(nivelesIsotermas({ bajo: 18.5, alto: 20.875 }, 0.5), [18.5, 19, 19.5, 20, 20.5]);
  assert.deepEqual(nivelesIsotermas({ bajo: 16.1, alto: 21 }, 2), [18, 20]);
  assert.deepEqual(nivelesIsotermas(null, 1), []);
});

test("etiquetas: dentro de la pantalla, separadas y como mucho `max`", () => {
  // 12 líneas verticales cada 30 px en una pantalla de 390x844.
  const lineas = Array.from({ length: 12 }, (_, k) => ({
    nivel: 15 + k, puntos: Array.from({ length: 50 }, (_, i) => ({ x: 20 + 30 * k, y: -100 + 22 * i })),
  }));
  const e = etiquetasIsotermas(lineas, { ancho: 390, alto: 844, max: 8 });
  assert.ok(e.length <= 8 && e.length >= 4, `${e.length} etiquetas`);
  for (const a of e) {
    assert.ok(a.x >= 28 && a.x <= 390 - 28 && a.y >= 28 && a.y <= 844 - 28);
    for (const b of e) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 90);
  }
  // Columna de botones libre.
  for (const a of etiquetasIsotermas(lineas, { ancho: 390, alto: 844, margenDerecha: 120 })) assert.ok(a.x <= 270);
  assert.equal(e[0].texto, textoGrados(e[0].nivel));
});

test("textos con coma decimal", () => {
  assert.equal(textoGrados(18), "18°");
  assert.equal(textoGrados(18.5), "18,5°");
  assert.equal(textoExtremo(16), "16 °C");
  assert.equal(textoExtremo(20.5), "20,5 °C");
  assert.equal(textoToque(18.375), "18,4 °C en superficie");
  assert.equal(textoIntervalo(0.5), "Líneas cada 0,5 °C");
  // Y el toque de index.html usa la misma coma.
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /formato: \(v\) => `\$\{v\.toFixed\(1\)\.replace\("\.", ","\)\} °C en superficie`/);
});

test("ventana de la malla: recorta a la malla y añade margen", () => {
  const { d } = malla(10, 10, () => 18);
  assert.deepEqual(ventanaMalla(d, { norte: 50, sur: 30, oeste: -20, este: 20 }), { f0: 0, f1: 9, c0: 0, c1: 9 });
  assert.deepEqual(ventanaMalla(d, { norte: 44.75, sur: 44.45, oeste: -4.75, este: -4.45 }, 1), { f0: 1, f1: 6, c0: 1, c1: 6 });
});

test("rendimiento: malla real de tamaño (360x432) entera en menos de 150 ms", () => {
  const { d, bytes } = malla(360, 432, (f, c) => (c % 97 < 3 ? null : 14 + f / 30 + Math.sin(c / 9) + Math.cos(f / 7)));
  const t0 = performance.now();
  const pct = percentilesVisibles(d, bytes, todo(d));
  const niveles = nivelesIsotermas(pct, intervaloIsotermas(pct, 5));
  const iso = isotermasVisibles(d, bytes, todo(d), niveles);
  const ms = performance.now() - t0;
  assert.ok(iso.length > 0);
  assert.ok(ms < 150, `${ms.toFixed(1)} ms`);
});
