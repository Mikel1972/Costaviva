// Relleno de datos que faltan (assets/js/relleno-datos.js, 2026-11-19).
// Bug real: el proxy rechazó el mar de fondo y el índice, la ventana y la
// hoja salieron S/D en todos los spots. Regla de Mikel: mostrar siempre
// algo, sustituyendo lo que falta por la media de los últimos 5 valores.
import { test } from "node:test";
import assert from "node:assert/strict";

await import("../assets/js/relleno-datos.js");
const { rellenarHoras, recuerdoDe, recuerdoVigente, horasVacias, media } = globalThis.RellenoDatos;

const serie = (vals, campo = "ola") => vals.map((v, i) => ({ hora: `2026-11-19T${String(i).padStart(2, "0")}:00`, [campo]: v }));

test("un hueco se rellena con la media de los 5 anteriores y se marca como estimado", () => {
  const h = serie([1, 2, 3, 4, 5, 6, null, 8]);
  const r = rellenarHoras(h, null);
  assert.equal(h[6].ola, 4); // media de 2..6
  assert.deepEqual(h[6].estimados, ["ola"]);
  assert.equal(h[7].ola, 8);
  assert.equal(h[7].estimados, undefined);
  assert.deepEqual(r.estimados, ["ola"]);
});

test("varios huecos seguidos: cada uno usa los 5 anteriores, rellenos incluidos", () => {
  const h = serie([2, 2, 2, 2, 2, null, null]);
  rellenarHoras(h, null);
  assert.equal(h[5].ola, 2);
  assert.equal(h[6].ola, 2);
});

test("sin datos en la serie, se usa el recuerdo de la última vez", () => {
  const h = serie([null, null, null]);
  rellenarHoras(h, { ola: [1, 1, 2, 2, 4] });
  assert.equal(h[0].ola, 2);
  assert.ok(h.every((x) => x.estimados?.includes("ola")));
});

test("sin datos ni recuerdo, se queda vacío (nunca inventa)", () => {
  const h = serie([null, null]);
  const r = rellenarHoras(h, null);
  assert.equal(h[0].ola, null);
  assert.deepEqual(r.estimados, []);
});

test("las direcciones se promedian como ángulos", () => {
  assert.equal(media([350, 10], true), 0);
  const h = serie([350, 10, null], "vientoDir");
  rellenarHoras(h, null);
  assert.equal(h[2].vientoDir, 0);
});

test("el recuerdo guarda solo valores reales hasta la hora actual", () => {
  const h = serie([1, 2, 3, null, 5, 9]);
  rellenarHoras(h, null);
  const rec = recuerdoDe(h, "2026-11-19T04:00", 1000);
  assert.deepEqual(rec.ola, [1, 2, 3, 5]);
  assert.equal(rec.guardado, 1000);
});

test("un recuerdo de más de 3 días no vale", () => {
  const ahora = Date.UTC(2026, 10, 19);
  assert.ok(recuerdoVigente({ guardado: ahora - 3600e3 }, ahora));
  assert.equal(recuerdoVigente({ guardado: ahora - 4 * 86400e3 }, ahora), null);
  assert.equal(recuerdoVigente(null, ahora), null);
});

test("si fallan las dos peticiones, hay eje de horas desde ahora", () => {
  const h = horasVacias("2026-11-19T23:40", 3);
  assert.deepEqual(h.map((x) => x.hora), ["2026-11-19T23:00", "2026-11-20T00:00", "2026-11-20T01:00"]);
});
