// Actividad pesquera de Global Fishing Watch (scripts/gfw/esfuerzo-gfw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ventana, celdasDeRespuesta, poligono, DIAS_RETRASO, DIAS_VENTANA, grupoArte, ventanasHabituales, juntarRespuestas, LISTA_ARTES, esCaidaTemporal } from "../scripts/gfw/esfuerzo-gfw.mjs";
import { readFileSync } from "node:fs";

test("ventana: 7 días que acaban hace 4 (los datos de GFW llegan con 96 h de retraso)", () => {
  assert.equal(DIAS_RETRASO, 4);
  assert.equal(DIAS_VENTANA, 7);
  assert.deepEqual(ventana(new Date("2026-11-02T10:00:00Z")), { desde: "2026-10-23", hasta: "2026-10-29" });
});

test("celdas: suma horas por celda de 0,1°, sin barcos ni banderas, solo > 0", () => {
  const json = { entries: [{ "public-global-fishing-effort:v3.0": [
    { lat: 43.51, lon: -2.49, hours: 3.2, flag: "ESP", geartype: "trawlers", shipName: "X", mmsi: 1 },
    { lat: 43.55, lon: -2.42, hours: 1.8, flag: "FRA", geartype: "set_longlines", shipName: "Y", mmsi: 2 },
    { lat: 43.65, lon: -2.42, hours: 0 },
    { lat: 36.31, lon: -6.38, hours: 0.02 },
    { lat: "x", lon: 1, hours: 4 },
  ] }] };
  assert.deepEqual(celdasDeRespuesta(json), [
    { arte: "todas", celda_lat: 43.5, celda_lon: -2.5, horas: 5 },
    { arte: "arrastre", celda_lat: 43.5, celda_lon: -2.5, horas: 3.2 },
    { arte: "palangre", celda_lat: 43.5, celda_lon: -2.5, horas: 1.8 },
  ]);
  for (const c of celdasDeRespuesta(json)) assert.deepEqual(Object.keys(c).sort(), ["arte", "celda_lat", "celda_lon", "horas"], "ni barcos ni banderas");
  assert.deepEqual(celdasDeRespuesta({}), []);
});

test("polígono cerrado de la caja", () => {
  assert.deepEqual(poligono([-10, 35, -1, 45]).coordinates[0], [[-10, 35], [-1, 35], [-1, 45], [-10, 45], [-10, 35]]);
});

test("artes: grupos para el pescador; lo desconocido a otras", () => {
  assert.deepEqual(LISTA_ARTES, ["todas", "arrastre", "cerco", "palangre", "enmalle", "otras"]);
  assert.equal(grupoArte("trawlers"), "arrastre");
  assert.equal(grupoArte("tuna_purse_seines"), "cerco");
  assert.equal(grupoArte("drifting_longlines"), "palangre");
  assert.equal(grupoArte("set_gillnets"), "enmalle");
  assert.equal(grupoArte("fishing"), "otras");
  assert.equal(grupoArte(undefined), "otras");
  const sql = readFileSync(new URL("../supabase/migrations/20261102180000_gfw_esfuerzo_artes.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`check (arte in (${LISTA_ARTES.map((a) => `'${a}'`).join(", ")}))`), "el CHECK de la tabla es esta lista");
});

test("habitual: el mismo mes de los 3 años anteriores, media por año", () => {
  assert.deepEqual(ventanasHabituales(new Date("2026-11-02T10:00:00Z")), [
    { desde: "2025-11-01", hasta: "2025-11-30" },
    { desde: "2024-11-01", hasta: "2024-11-30" },
    { desde: "2023-11-01", hasta: "2023-11-30" },
  ]);
  const ano = (h) => ({ entries: [{ d: [{ lat: 43.51, lon: -2.49, hours: h, geartype: "trawlers" }] }] });
  const media = celdasDeRespuesta(juntarRespuestas([ano(3), ano(6), ano(0)]), 3);
  assert.deepEqual(media.find((c) => c.arte === "todas").horas, 3);
});

test("GFW: reconoce una caída temporal suya (2026-11-04)", () => {
  const texto = '{"statusCode":404,"error":"Not Found","messages":[{"title":"Not Found","detail":"This feature is temporarily unavailable because of infrastructure constraints and an upstream data dependency issue."}]}';
  assert.equal(esCaidaTemporal(404, texto), true);
  assert.equal(esCaidaTemporal(503, ""), true);
  assert.equal(esCaidaTemporal(429, ""), true);
  assert.equal(esCaidaTemporal(401, '{"error":"Unauthorized"}'), false);
  assert.equal(esCaidaTemporal(404, '{"error":"Not Found"}'), false);
});
