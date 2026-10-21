// Flota pesquera faenando (scripts/flota/flota-ais.mjs): lo puro, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { claseEslora, celda, celdaDeFaena, leerMensaje, filasDeFaena, resumenBarco } from "../scripts/flota/flota-ais.mjs";

test("clase por eslora (A+B del AIS)", () => {
  assert.equal(claseEslora(10, 8), "<24");
  assert.equal(claseEslora(20, 10), "24-40");
  assert.equal(claseEslora(30, 15), ">40");
  assert.equal(claseEslora(0, 0), "?");
  assert.equal(claseEslora(511, 511), "?");
});

test("celda de 0,05° (~5 km)", () => {
  assert.deepEqual(celda(43.4321, -2.9876), [43.4, -3]);
  assert.deepEqual(celda(43.45, -2.95), [43.45, -2.95]);
});

test("faenando: despacio y con al menos 3 posiciones; amarrado o navegando, no", () => {
  const p = (sog) => ({ lat: 43.6, lon: -3.1, sog });
  assert.deepEqual(celdaDeFaena([p(2.5), p(3), p(2.8)]), [43.6, -3.1]);
  assert.equal(celdaDeFaena([p(0), p(0.1), p(0)]), null);
  assert.equal(celdaDeFaena([p(9), p(10), p(9.5)]), null);
  assert.equal(celdaDeFaena([p(3), p(3)]), null);
  assert.equal(celdaDeFaena([p(102.3), p(102.3), p(102.3)]), null);
});

test("lee los mensajes de aisstream.io", () => {
  assert.deepEqual(leerMensaje({ MessageType: "ShipStaticData", MetaData: { MMSI: 224000001 }, Message: { ShipStaticData: { Type: 30, Dimension: { A: 20, B: 8 } } } }), { mmsi: 224000001, tipo: 30, clase: "24-40" });
  assert.deepEqual(leerMensaje({ MessageType: "PositionReport", MetaData: { MMSI: 224000001 }, Message: { PositionReport: { Latitude: 43.6, Longitude: -3.1, Sog: 3 } } }).pos, { lat: 43.6, lon: -3.1, sog: 3 });
  assert.deepEqual(leerMensaje({ MessageType: "StaticDataReport", MetaData: { MMSI: 2 }, Message: { StaticDataReport: { Valid: true, ReportB: { ShipType: 30, Dimension: { A: 6, B: 4 } } } } }), { mmsi: 2, tipo: 30, clase: "<24" });
});

test("solo pesqueros, sin MMSI en las filas, y la clase de otra escucha sirve", () => {
  const pos = [2, 3, 2.5].map((sog) => ({ lat: 43.61, lon: -3.12, sog }));
  const clave = "k";
  const conocido = resumenBarco(3, clave);
  const { filas, nuevas } = filasDeFaena({
    1: { tipo: 30, clase: ">40", posiciones: pos },
    2: { tipo: 70, clase: ">40", posiciones: pos },
    3: { posiciones: pos },
  }, { [conocido]: "<24" }, clave, "2026-10-20");
  assert.equal(filas.length, 2);
  assert.ok(filas.every((f) => !/^\d+$/.test(f.barco) && f.barco.length === 24));
  assert.deepEqual(filas.map((f) => f.clase).sort(), ["<24", ">40"]);
  assert.equal(nuevas.length, 1);
});
