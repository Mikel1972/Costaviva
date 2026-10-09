// Test de las isotermas y la escala fija por grados de 🌡 T. agua (2026-10-09,
// assets/js/isotermas.js). Campos sintéticos con el formato de
// capas/temperatura-agua.json (un byte por celda, 255 = tierra o sin dato,
// escala lineal de 0,125 °C). Sin red ni DOM: corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pixelesCapa } from "../assets/js/capas-mar.js";
import {
  ventanaMalla, percentilesVisibles, intervaloIsotermas, nivelesIsotermas,
  PALETA_TEMP_AGUA, TEMP_MIN, TEMP_MAX, bandaTemperatura, colorTemperatura, valorColorBandas, degradadoBandas, bandasVisibles, tintaSobre,
  contornos, isotermasVisibles, etiquetasIsotermas, textoGrados, textoExtremo, textoToque, textoIntervalo,
} from "../assets/js/isotermas.js";
import { fuenteEs } from "./i18n-html.js";

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

test("percentiles 2-98 del mar VISIBLE (para la leyenda y el intervalo)", () => {
  // Oeste 14 °C, este de 17 a 20 °C; tierra en una franja.
  const { d, bytes } = malla(50, 100, (f, c) => (c < 50 ? 14 : c < 55 ? null : 17 + (3 * (c - 55)) / 44));
  const este = { norte: d.norte, sur: d.sur, oeste: -5 + 5.5, este: d.este };
  const pct = percentilesVisibles(d, bytes, este);
  assert.ok(pct.bajo >= 17 && pct.bajo < 17.25, `bajo ${pct.bajo}`);
  assert.ok(pct.alto > 19.75 && pct.alto <= 20, `alto ${pct.alto}`);
  assert.equal(bandasVisibles(pct)[0], 17);
  assert.ok(bandasVisibles(pct).includes(19));
  assert.equal(percentilesVisibles(d, bytes, todo(d)).bajo, 14);
  // Sin mar a la vista (solo la franja de tierra) o fuera de la malla: null.
  assert.equal(percentilesVisibles(d, bytes, { norte: 45, sur: 40, oeste: 0.05, este: 0.4 }), null);
  assert.equal(percentilesVisibles(d, bytes, { norte: 60, sur: 55, oeste: 0, este: 1 }), null);
  // 1 % de celdas a 5 °C (ruido junto a la costa) no cuenta.
  const r = malla(10, 100, (f, c) => (f === 0 && c < 10 ? 5 : 18 + c / 50));
  assert.equal(percentilesVisibles(r.d, r.bytes, todo(r.d)).bajo >= 18, true);
});

test("escala fija: el mismo valor da el mismo color en dos vistas y dos mares distintos", () => {
  // Una celda a 18,375 °C rodeada de agua fría (Galicia) y otra rodeada de
  // agua cálida (Canarias): mismo color en la imagen, venga de donde venga.
  const frio = malla(10, 10, (f, c) => (f === 5 && c === 5 ? 18.375 : 12 + c * 0.2));
  const calido = malla(10, 10, (f, c) => (f === 5 && c === 5 ? 18.375 : 24 + f * 0.3));
  const pixel = ({ d, bytes }) => {
    const px = pixelesCapa(d, bytes, PALETA_TEMP_AGUA, valorColorBandas);
    // Mercator re-muestreado: buscar la fila de imagen que cae en la fila 5.
    for (let r = 0; r < d.filas; r++) {
      const o = (r * d.columnas + 5) * 4;
      const hex = "#" + [px[o], px[o + 1], px[o + 2]].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
      if (hex === colorTemperatura(18.375)) return hex;
    }
    return null;
  };
  assert.equal(pixel(frio), "#6CCF49");
  assert.equal(pixel(calido), "#6CCF49");
  // Y la vista (percentiles) no entra en el color: dos vistas, mismos colores.
  const vistaA = bandasVisibles({ bajo: 17.2, alto: 20.9 }), vistaB = bandasVisibles({ bajo: 18.1, alto: 26 });
  for (const g of vistaA.filter((x) => vistaB.includes(x))) assert.equal(colorTemperatura(g + 0.5), colorTemperatura(g));
  // index.html ya no reescala la imagen al mover el mapa.
  const html = fuenteEs(readFileSync("index.html", "utf8"));
  assert.doesNotMatch(html, /escalaAdaptativa|urlEscalas|setUrl\(/);
  assert.doesNotMatch(html, /se ajustan a lo que ves/);
  assert.match(html, /Cada color es un grado/);
});

test("escala fija: un color por grado de 8 a 30 °C, recortada en los extremos", () => {
  assert.equal(PALETA_TEMP_AGUA.length, TEMP_MAX - TEMP_MIN + 1);
  assert.equal(new Set(PALETA_TEMP_AGUA).size, PALETA_TEMP_AGUA.length, "sin colores repetidos");
  assert.equal(bandaTemperatura(18), 18);
  assert.equal(bandaTemperatura(18.99), 18);
  assert.equal(bandaTemperatura(3), 8);
  assert.equal(bandaTemperatura(33), 30);
  assert.equal(colorTemperatura(18.0), colorTemperatura(18.875));
  assert.notEqual(colorTemperatura(18.875), colorTemperatura(19));
  // valorColorBandas cae justo en la parada (sin mezclar con la vecina).
  for (let g = TEMP_MIN; g <= TEMP_MAX; g++) {
    const t = valorColorBandas(g + 0.4) * (PALETA_TEMP_AGUA.length - 1);
    assert.ok(Math.abs(t - (g - TEMP_MIN)) < 1e-9);
  }
  assert.equal((degradadoBandas().match(/#/g) || []).length, PALETA_TEMP_AGUA.length);
  assert.equal(tintaSobre("#95FE98"), "#10203a");
  assert.equal(tintaSobre("#3C48B5"), "#ffffff");
});

// CIEDE2000 y deuteranopía (Machado, Oliveira y Fernandes 2009, severidad 1).
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function lab(c) {
  const [r, g, b] = c.map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const ang = (b, a) => { const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1 = ang(b1, a1p), h2 = ang(b2, a2p);
  let dh = C1p * C2p === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dL = L2 - L1, dC = C2p - C1p, dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p !== 0) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const MD = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]];
const deutan = (c) => { const l = c.map(lin); return MD.map((f) => gam(Math.max(0, Math.min(1, f[0] * l[0] + f[1] * l[1] + f[2] * l[2])))); };

test("contraste entre grados vecinos: ΔE2000 ≥ 10 en visión normal y ≥ 10 con deuteranopía", () => {
  for (let k = 1; k < PALETA_TEMP_AGUA.length; k++) {
    const a = rgb(PALETA_TEMP_AGUA[k - 1]), b = rgb(PALETA_TEMP_AGUA[k]);
    const g = `${TEMP_MIN + k - 1}→${TEMP_MIN + k} °C`;
    assert.ok(de2000(lab(a), lab(b)) >= 10, `${g} normal ${de2000(lab(a), lab(b)).toFixed(1)}`);
    assert.ok(de2000(lab(deutan(a)), lab(deutan(b))) >= 10, `${g} deutan ${de2000(lab(deutan(a)), lab(deutan(b))).toFixed(1)}`);
  }
});

test("leyenda: grados visibles, mínimo 3 y uno de cada dos si son muchos", () => {
  assert.deepEqual(bandasVisibles({ bajo: 18.5, alto: 20.875 }), [18, 19, 20]);
  assert.deepEqual(bandasVisibles({ bajo: 19.5, alto: 19.9 }), [18, 19, 20]);
  assert.deepEqual(bandasVisibles({ bajo: 16.1, alto: 21 }), [16, 17, 18, 19, 20, 21]);
  assert.deepEqual(bandasVisibles({ bajo: 14, alto: 26 }), [14, 16, 18, 20, 22, 24, 26]);
  assert.deepEqual(bandasVisibles({ bajo: 5, alto: 7 }), [8, 9, 10]);
  assert.deepEqual(bandasVisibles(null), []);
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

test("textos con coma decimal", async () => {
  assert.equal(textoGrados(18), "18°");
  assert.equal(textoGrados(18.5), "18,5°");
  assert.equal(textoExtremo(16), "16 °C");
  assert.equal(textoExtremo(20.5), "20,5 °C");
  assert.equal(textoToque(18.375), "18,4 °C en superficie");
  assert.equal(textoIntervalo(0.5), "Líneas cada 0,5 °C");
  // Y el toque de index.html usa la misma coma.
  const html = fuenteEs(readFileSync("index.html", "utf8"));
  // Desde los idiomas (2026-10-09) la coma la pone I18n.num en español.
  assert.match(html, /formato: \(v\) => I18n\.t\("\{v\} °C en superficie", \{ v: I18n\.num\(v, 1\) \}\)/);
  const { I18n } = await import("../assets/js/i18n-modulo.js");
  assert.equal(I18n.num(18.375, 1), "18,4");
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
