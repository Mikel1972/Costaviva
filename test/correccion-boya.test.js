// Corrección de la previsión con la boya más cercana
// (assets/js/correccion-boya.js, 2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";

await import("../assets/js/correccion-boya.js");
const { correccionBoya, factorBoya, MAX_KM, DECAIMIENTO_H } = globalThis.CorreccionBoya;

const AHORA = Date.UTC(2026, 10, 19, 18, 0);
const hace = (h) => new Date(AHORA - h * 3600e3).toISOString();
const SOPELANA = { lat: 43.385, lon: -2.99 };
const BILBAO = { nombre: "AP Bilbao", lat: 43.40, lon: -3.13 };

test("la boya cercana corrige: cociente medido/modelo, con peso por distancia", () => {
  const c = correccionBoya({ ...SOPELANA, ahoraMs: AHORA, boyas: [{ ...BILBAO, alturaSignificativa: 2.1, actualizado: hace(2) }], modeloEnHora: () => 3 });
  assert.equal(c.nombre, "AP Bilbao");
  assert.equal(c.cociente, 0.7);
  assert.ok(c.peso > 0.6 && c.peso < 0.8);
  // En la hora de la medida corrige con todo su peso; a DECAIMIENTO_H horas, nada.
  assert.equal(factorBoya(c, 0), +(1 + (0.7 - 1) * c.peso).toFixed(4));
  assert.equal(factorBoya(c, DECAIMIENTO_H), 1);
  assert.ok(factorBoya(c, 3) > factorBoya(c, 0) && factorBoya(c, 3) < 1);
});

test("sin corrección: boya vieja, lejana, sin medida u olas pequeñas", () => {
  const base = { ...SOPELANA, ahoraMs: AHORA, modeloEnHora: () => 3 };
  assert.equal(correccionBoya({ ...base, boyas: [{ ...BILBAO, alturaSignificativa: 2, actualizado: hace(6) }] }), null);
  assert.equal(correccionBoya({ ...base, boyas: [{ nombre: "Gijón", lat: 43.62, lon: -5.66, alturaSignificativa: 2, actualizado: hace(1) }] }), null);
  assert.equal(correccionBoya({ ...base, boyas: [{ ...BILBAO, actualizado: hace(1) }] }), null);
  assert.equal(correccionBoya({ ...base, modeloEnHora: () => 0.2, boyas: [{ ...BILBAO, alturaSignificativa: 0.6, actualizado: hace(1) }] }), null);
  assert.equal(correccionBoya({ ...base, modeloEnHora: () => null, boyas: [{ ...BILBAO, alturaSignificativa: 2, actualizado: hace(1) }] }), null);
  assert.equal(factorBoya(null, 0), 1);
});

test("el cociente se limita: una boya rara no dispara la previsión", () => {
  const c = correccionBoya({ ...SOPELANA, ahoraMs: AHORA, boyas: [{ ...BILBAO, alturaSignificativa: 2.6, actualizado: hace(1) }], modeloEnHora: () => 1 });
  assert.equal(c.cociente, 2);
  assert.ok(MAX_KM >= 30);
});

// Caso real (2026-11-20): punto dentro de la ría de Camariñas, boya
// Villano-Sisargas 5,2 m y modelo 0,35 m en la celda abrigada. No es la misma
// ola: no se corrige (antes: x2 y «Mar abierto 0,7 m» junto a la boya).
test("boya y modelo que no son la misma ola (ría, bahía): no se corrige", () => {
  assert.equal(correccionBoya({ ...SOPELANA, ahoraMs: AHORA, boyas: [{ ...BILBAO, alturaSignificativa: 5.2, actualizado: hace(1) }], modeloEnHora: () => 0.35 }), null);
  assert.equal(correccionBoya({ ...SOPELANA, ahoraMs: AHORA, boyas: [{ ...BILBAO, alturaSignificativa: 0.4, actualizado: hace(1) }], modeloEnHora: () => 2 }), null);
});
