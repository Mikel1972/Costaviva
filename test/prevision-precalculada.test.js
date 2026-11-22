// Previsión precalculada por el robot (2026-11-22): prevision-precalculada.yml
// + scripts/prevision/precalcular.mjs; /prevision la sirve sin parsearla.
import { test } from "node:test";
import assert from "node:assert/strict";
import { armarJson, demasiadosErrores } from "../scripts/prevision/precalcular.mjs";
import {
  edadPrecalculadaMin, conEstacionesAemet, leerPrevisionPrecalculada, MAX_EDAD_PRECALCULADA_MIN, RUTA_PREVISION_PRECALCULADA,
} from "../functions/prevision.js";

const AHORA = Date.parse("2026-11-22T10:00:00Z");

test("el robot pone generado_en la primera clave y quita estacionesAemet", () => {
  const texto = armarJson({ spots: [{ slug: "bakio" }], estacionesAemet: { x: 1 }, boyas: [] }, new Date(AHORA));
  assert.ok(texto.startsWith('{"generado_en":"2026-11-22T10:00:00.000Z"'));
  const d = JSON.parse(texto);
  assert.equal("estacionesAemet" in d, false);
  assert.deepEqual(d.spots, [{ slug: "bakio" }]);
  assert.equal(edadPrecalculadaMin(texto, AHORA + 30 * 60000), 30);
});

test("edad: sin generado_en al principio cuenta como vieja", () => {
  assert.equal(edadPrecalculadaMin('{"spots":[],"generado_en":"2026-11-22T10:00:00Z"}', AHORA), Infinity);
  assert.equal(edadPrecalculadaMin("", AHORA), Infinity);
  assert.equal(edadPrecalculadaMin(null, AHORA), Infinity);
});

test("al servir se añaden las estaciones de AEMET sin parsear y queda JSON válido", () => {
  const texto = armarJson({ spots: [] }, new Date(AHORA));
  const d = JSON.parse(conEstacionesAemet(texto + "\n", [{ id: "1082" }]));
  assert.deepEqual(d.estacionesAemet, [{ id: "1082" }]);
  assert.equal(JSON.parse(conEstacionesAemet(texto, undefined)).estacionesAemet, null);
});

test("no se sube una previsión con más de la mitad de los spots en error", () => {
  assert.equal(demasiadosErrores([{ error: "429" }, { error: "429" }, {}]), true);
  assert.equal(demasiadosErrores([{ error: "429" }, {}, {}]), false);
  assert.equal(demasiadosErrores([{ error: "x" }, {}]), false);
  assert.equal(demasiadosErrores([]), true);
});

test("la Function lee la precalculada reciente y descarta la vieja o la que falla", async () => {
  const llamadas = [];
  const servir = (texto, ok = true) => async (url) => { llamadas.push(url); return { ok, text: async () => texto }; };
  const reciente = armarJson({ spots: [] }, new Date(AHORA - 20 * 60000));
  const r = await leerPrevisionPrecalculada({}, { fetchImpl: servir(reciente), ahora: AHORA });
  assert.equal(r.texto, reciente);
  assert.equal(Math.round(r.edad), 20);
  assert.ok(llamadas[0].endsWith(`/${RUTA_PREVISION_PRECALCULADA}`));

  const vieja = armarJson({ spots: [] }, new Date(AHORA - (MAX_EDAD_PRECALCULADA_MIN + 1) * 60000));
  assert.equal(await leerPrevisionPrecalculada({}, { fetchImpl: servir(vieja), ahora: AHORA }), null);
  assert.equal(await leerPrevisionPrecalculada({}, { fetchImpl: servir("", false), ahora: AHORA }), null);
  assert.equal(await leerPrevisionPrecalculada({}, { fetchImpl: async () => { throw new Error("red"); }, ahora: AHORA }), null);
});
