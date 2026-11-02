// Actividad pesquera de Global Fishing Watch (scripts/gfw/esfuerzo-gfw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ventana, celdasDeRespuesta, poligono, DIAS_RETRASO, DIAS_VENTANA } from "../scripts/gfw/esfuerzo-gfw.mjs";

test("ventana: 7 días que acaban hace 4 (los datos de GFW llegan con 96 h de retraso)", () => {
  assert.equal(DIAS_RETRASO, 4);
  assert.equal(DIAS_VENTANA, 7);
  assert.deepEqual(ventana(new Date("2026-11-02T10:00:00Z")), { desde: "2026-10-23", hasta: "2026-10-29" });
});

test("celdas: suma horas por celda de 0,1°, sin barcos ni banderas, solo > 0", () => {
  const json = { entries: [{ "public-global-fishing-effort:v3.0": [
    { lat: 43.51, lon: -2.49, hours: 3.2, flag: "ESP", vesselIDs: 2 },
    { lat: 43.55, lon: -2.42, hours: 1.8, flag: "FRA", vesselIDs: 1 },
    { lat: 43.65, lon: -2.42, hours: 0 },
    { lat: "x", lon: 1, hours: 4 },
  ] }] };
  assert.deepEqual(celdasDeRespuesta(json), [{ celda_lat: 43.5, celda_lon: -2.5, horas: 5 }]);
  assert.deepEqual(celdasDeRespuesta({}), []);
});

test("polígono cerrado de la caja", () => {
  assert.deepEqual(poligono([-10, 35, -1, 45]).coordinates[0], [[-10, 35], [-1, 35], [-1, 45], [-10, 45], [-10, 35]]);
});
