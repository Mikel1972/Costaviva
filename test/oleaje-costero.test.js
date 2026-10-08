// Oleaje en mar abierto frente a "en la playa" (functions/_lib/oleaje-costero.js),
// factor de Gipuzkoa solo para mar abierto y con Open-Meteo, y la métrica de
// espuma de las webcams (scripts/oleaje-camaras/espuma.mjs).
// Lógica pura: sin red, sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ABRIGO_SPOTS, coeficienteAbrigo, coeficienteDesdeParametros, oleajeCostero, zonaOleaje, rangoAltura, distanciaKm,
} from "../functions/_lib/oleaje-costero.js";
import { factorOleaje, procesarSpot, SPOTS } from "../functions/prevision.js";
import {
  medirEspuma, huella, similitud, umbralRotura, coeficienteRelativo, ROI_CAMARAS,
} from "../scripts/oleaje-camaras/espuma.mjs";

test("Hondarribia: el NW (mar dominante) queda tapado, el NE entra", () => {
  assert.equal(coeficienteAbrigo("hondarribia", 323), ABRIGO_SPOTS.hondarribia.coefAbrigado);
  assert.equal(coeficienteAbrigo("hondarribia", 40), ABRIGO_SPOTS.hondarribia.coefAbierto);
  const n = coeficienteAbrigo("hondarribia", 0); // transición
  assert.ok(n > ABRIGO_SPOTS.hondarribia.coefAbrigado && n < ABRIGO_SPOTS.hondarribia.coefAbierto);
});

test("sin dirección se usa el coeficiente MAYOR (ante la duda, no subestimar)", () => {
  for (const [slug, p] of Object.entries(ABRIGO_SPOTS)) {
    assert.equal(coeficienteAbrigo(slug, null), p.coefAbierto, slug);
    assert.ok(p.coefAbrigado <= p.coefAbierto && p.coefAbierto <= 1 && p.coefAbrigado > 0, slug);
    assert.ok(p.criterio && p.criterio.length > 40, `${slug} sin criterio`);
    assert.ok(SPOTS.some((s) => s.slug === slug), `${slug} no es un spot`);
  }
});

test("spots expuestos y desconocidos: coeficiente 1, nada cambia", () => {
  assert.equal(coeficienteAbrigo("zarautz", 320), 1);
  assert.equal(coeficienteAbrigo("no-existe", 10), 1);
  const o = oleajeCostero("zarautz", 3.0, 320);
  assert.deepEqual(o.altura, o.alturaMarAbierto);
  assert.equal(o.coefAbrigo, null);
});

test("la transición es continua y el ángulo da la vuelta por 0°", () => {
  const p = { centro: 355, semiancho: 15, coefAbierto: 0.2, coefAbrigado: 0.08 };
  assert.equal(coeficienteDesdeParametros(p, 5), 0.2); // 10° de 355 cruzando el norte
  let previo = coeficienteDesdeParametros(p, 10);
  for (let d = 11; d <= 60; d++) {
    const c = coeficienteDesdeParametros(p, d);
    assert.ok(c <= previo + 1e-9, `no monótono en ${d}`);
    assert.ok(Math.abs(c - previo) < 0.01, `salto en ${d}`);
    previo = c;
  }
  assert.equal(coeficienteDesdeParametros(p, 60), 0.08);
});

test("caso real 2026-10-08: Hondarribia 2,98 m crudo ×1,38 → mar abierto 3,7–4,5 m, en la playa ~0,6 m", () => {
  const marAbierto = 2.98 * factorOleaje(43.3736, -1.7964);
  const o = oleajeCostero("hondarribia", marAbierto, 323);
  assert.deepEqual(o.alturaMarAbierto, [3.7, 4.5]);
  assert.deepEqual(o.altura, [0.6, 0.7]);
  assert.equal(o.coefAbrigo, 0.15);
});

test("×1,38 de Gipuzkoa: solo dentro de la caja y solo con Open-Meteo", () => {
  assert.equal(factorOleaje(43.3736, -1.7964), 1.38);
  assert.equal(factorOleaje(43.3736, -1.7964, "openmeteo"), 1.38);
  assert.equal(factorOleaje(43.3736, -1.7964, "copernicus"), 1);
  assert.equal(factorOleaje(43.3225, -2.42), 1); // Ondarroa, Bizkaia
});

test("rangoAltura: ±10 % y nunca negativo; null si no hay dato", () => {
  assert.deepEqual(rangoAltura(1), [0.9, 1.1]);
  assert.equal(rangoAltura(null), null);
  assert.equal(rangoAltura(NaN), null);
});

test("zonaOleaje: dice si es abrigada y a cuántos km está la celda del modelo", () => {
  const z = zonaOleaje({ slug: "hondarribia", lat: 43.3736, lon: -1.7964 }, 43.458336, -1.7916565);
  assert.equal(z.tipo, "abrigada");
  assert.ok(z.celdaModelo.distanciaKm > 9 && z.celdaModelo.distanciaKm < 10);
  assert.equal(z.parametros.centro, ABRIGO_SPOTS.hondarribia.centro);
  const a = zonaOleaje({ slug: "zarautz", lat: 43.2833, lon: -2.1667 }, undefined, undefined);
  assert.equal(a.tipo, "abierta");
  assert.equal(a.celdaModelo, null);
  assert.ok(Math.abs(distanciaKm(43, -2, 43.1, -2) - 11.06) < 0.1);
});

test("procesarSpot: en Hondarribia `altura` es la playa y `alturaMarAbierto` el modelo", () => {
  const spot = SPOTS.find((s) => s.slug === "hondarribia");
  // Hora local "de ahora" no coincidirá con la serie: procesarSpot cae al
  // índice 0, que basta para probar el cálculo.
  // Fechas que nunca son "ahora" (con 2026-10-08 el test fallaba ese mismo
  // día a las 13 h: procesarSpot arrancaba en el índice 1, que no es bloque).
  const horas = ["2000-01-01T12:00", "2000-01-01T13:00"];
  const marino = {
    latitude: 43.458336, longitude: -1.7916565,
    hourly: { time: horas, wave_height: [2.98, 2.9], wave_period: [8.65, 8.6], wave_direction: [323, 323],
      sea_surface_temperature: [18, 18], ocean_current_velocity: [0.1, 0.1], ocean_current_direction: [90, 90], sea_level_height_msl: [0, 0.1] },
  };
  const viento = { hourly: { time: horas, windspeed_10m: [20, 20], winddirection_10m: [300, 300], precipitation: [0, 0], cloudcover: [20, 20], pressure_msl: [1015, 1015] } };
  const r = procesarSpot(spot, marino, viento, null, null);
  const b = r.bloques[0];
  assert.deepEqual(b.alturaMarAbierto, [3.7, 4.5]);
  assert.deepEqual(b.altura, [0.6, 0.7]);
  assert.equal(r.zonaOleaje.tipo, "abrigada");
});

test("index.html lleva una copia EXACTA de la fórmula del coeficiente", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const m = html.match(/function coeficienteAbrigoDesdeParametros\(p, dirGrados\) \{[\s\S]*?\n\}/);
  assert.ok(m, "no está coeficienteAbrigoDesdeParametros en index.html");
  const copia = new Function(`${m[0]}; return coeficienteAbrigoDesdeParametros;`)();
  for (const p of Object.values(ABRIGO_SPOTS)) {
    for (let d = 0; d < 360; d += 7) assert.equal(copia(p, d), coeficienteDesdeParametros(p, d));
    assert.equal(copia(p, null), coeficienteDesdeParametros(p, null));
  }
  assert.equal(copia(null, 10), 1);
});

// --- Métrica de espuma -------------------------------------------------------

function imagen(w, h, pintar) {
  const d = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = pintar(x, y);
    const p = (y * w + x) * 3;
    d[p] = r; d[p + 1] = g; d[p + 2] = b;
  }
  return d;
}
const ROI = { x0: 0, y0: 0, x1: 1, y1: 1 };

test("espuma: mar azul liso = 0; con franjas blancas > 0", () => {
  const liso = imagen(40, 20, () => [30, 80, 140]);
  assert.equal(medirEspuma(liso, 40, 20, ROI).espuma, 0);
  const rompiendo = imagen(40, 20, (x, y) => (y % 5 === 0 ? [235, 238, 240] : [30, 80, 140]));
  const r = medirEspuma(rompiendo, 40, 20, ROI);
  assert.ok(r.espuma > 0.15 && r.espuma < 0.25, String(r.espuma));
  assert.equal(r.estado, "ok");
});

test("espuma: un casco rojo o arena amarilla no cuentan (es color, no bordes)", () => {
  const barcos = imagen(40, 20, (x, y) => (x % 4 === 0 ? [200, 40, 40] : y % 7 === 0 ? [220, 190, 120] : [30, 80, 140]));
  assert.equal(medirEspuma(barcos, 40, 20, ROI).espuma, 0);
});

test("espuma: noche y reflejo/niebla se marcan, no se dan por buenos", () => {
  assert.equal(medirEspuma(imagen(20, 10, () => [10, 12, 15]), 20, 10, ROI).estado, "sin_luz");
  assert.equal(medirEspuma(imagen(20, 10, () => [240, 240, 240]), 20, 10, ROI).estado, "dudosa");
});

test("ROI de cámaras: dentro del encuadre y con URL https (desde 2026-10-08 no solo de la Diputación)", () => {
  for (const [slug, r] of Object.entries(ROI_CAMARAS)) {
    assert.ok(r.x0 >= 0 && r.x1 <= 1 && r.x0 < r.x1 && r.y0 >= 0 && r.y1 <= 1 && r.y0 < r.y1, slug);
    assert.match(r.url, /^https:\/\//);
    assert.ok(SPOTS.some((s) => s.slug === slug), slug);
  }
});

test("similitud de encuadre: misma escena con otra luz ≈ 1; escena movida baja", () => {
  const w = 64, h = 36;
  const escena = (dx, k) => imagen(w, h, (x, y) => {
    const v = Math.min(255, Math.round(k * (((x + dx) * 7 + y * 13) % 200)));
    return [v, v, v];
  });
  const a = huella(escena(0, 1), w, h);
  assert.ok(similitud(a, huella(escena(0, 0.6), w, h)) > 0.99);
  assert.ok(similitud(a, huella(escena(9, 1), w, h)) < 0.8);
  assert.equal(similitud([1, 1], [1, 1]), null);
});

test("umbral de rotura y coeficiente relativo con datos sintéticos", () => {
  // Referencia expuesta: espuma a partir de 1 m. Spot abrigado: a partir de 2,5 m.
  const serie = (umbral) => Array.from({ length: 60 }, (_, i) => {
    const hs = 0.3 + i * 0.06;
    return { hs, espuma: hs >= umbral ? 0.2 : 0.002 };
  });
  const uRef = umbralRotura(serie(1.0));
  const uAbr = umbralRotura(serie(2.5));
  assert.ok(Math.abs(uRef - 1.0) < 0.1, String(uRef));
  assert.ok(Math.abs(uAbr - 2.5) < 0.1, String(uAbr));
  const c = coeficienteRelativo(serie(2.5), serie(1.0));
  assert.ok(c > 0.35 && c < 0.45, String(c));
  assert.equal(umbralRotura(serie(1).slice(0, 5)), null); // pocos datos: null, no un número inventado
});
