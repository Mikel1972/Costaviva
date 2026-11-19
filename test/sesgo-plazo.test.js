// Lo que dijimos frente a lo que pasó (sesgo-plazo), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verdades, parear, aprenderSesgo, tramoPlazo, N_MIN_PLAZO } from "../scripts/oleaje-camaras/sesgo-plazo.mjs";
import { factorPlazo } from "../functions/_lib/sesgo-plazo.js";
import SESGO from "../functions/_lib/sesgo-plazo-datos.js";
import { cambioSesgo, textoSesgo, leerTextoSesgo } from "../scripts/oleaje-camaras/medir-espuma.mjs";

const centro = (b) => ({ "<0.5": 0.3, "0.5-1": 0.75, "1-2": 1.5 })[b] ?? null;

test("plazos", () => {
  assert.equal(tramoPlazo(2), "0-6");
  assert.equal(tramoPlazo(30), "24-48");
  assert.equal(tramoPlazo(80), null);
});

test("verdades: etiquetas siempre; la cámara solo con calibración fiable y con menos peso", () => {
  const v = verdades(
    [{ camara: "a", banda: "1-2", fecha: "2026-11-20T10:00:00Z", origen: "foto" }],
    [
      { camara: "a", fecha: "2026-11-20T11:00:00Z", estimacionCamara: { estimacion: 1.2 }, calibracion: { errorRel: 0.4 } },
      { camara: "a", fecha: "2026-11-20T12:00:00Z", estimacionCamara: { estimacion: 2 }, calibracion: { errorRel: 1 } },
    ], centro);
  assert.deepEqual(v.map((x) => [x.origen, x.altura, x.peso]), [["foto", 1.5, 1], ["camara", 1.2, 0.3]]);
});

test("parear: cada verdad con lo que habíamos previsto para esa hora, solo si estaba en el futuro", () => {
  const archivo = { generado: "2026-11-20T06:30:00Z", desde: "2026-11-20T00:00:00Z", camaras: { a: { orilla: Array.from({ length: 72 }, () => 2) } } };
  const p = parear([archivo], [
    { camara: "a", fecha: "2026-11-20T10:05:00Z", altura: 1.5, peso: 1, origen: "foto" },
    { camara: "a", fecha: "2026-11-20T05:00:00Z", altura: 1.5, peso: 1, origen: "foto" },
    { camara: "b", fecha: "2026-11-20T10:00:00Z", altura: 1, peso: 1, origen: "foto" },
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].previsto, 2);
  assert.ok(Math.abs(p[0].plazo - 3.58) < 0.01);
});

test("aprender: si siempre previmos de más, el factor baja; encogido con pocos datos", () => {
  const muchos = Array.from({ length: 60 }, () => ({ camara: "a", plazo: 10, previsto: 2, real: 1.5, peso: 1 }));
  const m = aprenderSesgo(muchos);
  const c = m.camaras.a["6-24"];
  assert.ok(c.factor < 0.8 && c.factor > 0.75, String(c.factor));
  assert.ok(c.maeCorregido < c.mae);
  const pocos = aprenderSesgo(muchos.slice(0, 3)).camaras.a["6-24"];
  assert.ok(pocos.factor > 0.9, String(pocos.factor));
  assert.ok(m.global["6-24"]);
});

test("la app solo corrige con datos suficientes, y menos en los spots vecinos", () => {
  const modelo = { nMin: N_MIN_PLAZO, camaras: { zarautz: { "6-24": { factor: 0.8, n: 40 }, "0-6": { factor: 0.5, n: 5 } }, deba: { "6-24": { factor: 0.64, n: 40 } } } };
  assert.equal(factorPlazo(modelo, "zarautz", 10), 0.8);
  assert.equal(factorPlazo(modelo, "zarautz", 2), 1, "pocos datos: sin corrección");
  assert.equal(factorPlazo(modelo, "lekeitio", 10), 0.8, "vecina de Deba con peso 0,5: 0,64^0,5");
  assert.equal(factorPlazo(modelo, "spot-sin-camara", 10), 1);
  assert.equal(factorPlazo(SESGO, "zarautz", 10), 1, "hoy aún no hay datos");
});

test("el robot solo reescribe el fichero si cambia algo que se usa", () => {
  const a = { nMin: 20, camaras: { x: { "6-24": { factor: 0.8, n: 30 } } } };
  assert.equal(cambioSesgo(a, { nMin: 20, camaras: { x: { "6-24": { factor: 0.81, n: 31 } } } }), false);
  assert.equal(cambioSesgo(a, { nMin: 20, camaras: { x: { "6-24": { factor: 0.9, n: 31 } } } }), true);
  assert.equal(cambioSesgo({ nMin: 20, camaras: {} }, { nMin: 20, camaras: { x: { "0-6": { factor: 1.1, n: 5 } } } }), false);
  assert.deepEqual(leerTextoSesgo(textoSesgo(a)), a);
});
