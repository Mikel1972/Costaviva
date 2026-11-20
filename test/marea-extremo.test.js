import test from "node:test";
import assert from "node:assert/strict";
import { vertice, sumarMinutos } from "../functions/_lib/marea-extremo.js";

test("pleamar al minuto: la parábola de tres horas da la hora real", () => {
  // Marea senoidal de 12 h 25 min con pleamar a las 12:20 (amplitud 1,5 m).
  const T = 12 + 25 / 60, pico = 12 + 20 / 60;
  const h = (t) => 1.5 * Math.cos((2 * Math.PI * (t - pico)) / T);
  const v = vertice(h(11), h(12), h(13));
  assert.ok(Math.abs(v.desfaseMin - 20) <= 2, `desfase ${v.desfaseMin}`);
  assert.ok(Math.abs(v.altura - 1.5) < 0.02);
});

test("bajamar y casos límite", () => {
  assert.equal(vertice(1, 0.5, 1).desfaseMin, 0);
  assert.ok(vertice(1.2, 0.5, 0.9).desfaseMin > 0);
  assert.equal(vertice(1, 1, 1).desfaseMin, 0);
  assert.equal(vertice(null, 1, 1), null);
  assert.ok(Math.abs(vertice(0, 10, 0).desfaseMin) <= 30);
});

test("sumarMinutos cruza horas y días", () => {
  assert.equal(sumarMinutos("2026-11-20T12:00", 20), "2026-11-20T12:20");
  assert.equal(sumarMinutos("2026-11-20T00:00", -25), "2026-11-19T23:35");
  assert.equal(sumarMinutos("2026-11-20T23:00", 30), "2026-11-20T23:30");
});
