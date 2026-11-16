// Sol y Luna de un instante (2026-11-16, Mikel en Lemoiz).
import { test } from "node:test";
import assert from "node:assert/strict";
import { solLuna } from "../assets/js/sol-luna.js";

const LEMOIZ = [43.4334, -2.9002];

test("Lemoiz 16-nov 01:57 (hora local): de noche, amanecer en ~6 h, luna ya puesta", () => {
  const r = solLuna(Date.parse("2026-11-16T00:57:00Z"), ...LEMOIZ);
  assert.equal(r.sol_momento, "noche");
  // Amanecer en Bilbao el 16-nov hacia las 08:05 local (07:05 UTC): ~368 min.
  assert.ok(Math.abs(r.sol_min_amanecer - 368) <= 10, String(r.sol_min_amanecer));
  // Anochecer del 15-nov hacia las 17:47 local: hace ~490 min.
  assert.ok(Math.abs(r.sol_min_anochecer + 490) <= 10, String(r.sol_min_anochecer));
  assert.equal(r.luna_visible, false);
  assert.ok(["mayor", "menor", "ninguno"].includes(r.solunar));
});

test("mediodía: sol a ~28° en noviembre a 43° N; crepúsculo al amanecer", () => {
  assert.ok(Math.abs(solLuna(Date.parse("2026-11-16T12:10:00Z"), ...LEMOIZ).sol_altura - 28) < 2);
  assert.equal(solLuna(Date.parse("2026-11-16T06:50:00Z"), ...LEMOIZ).sol_momento, "crepusculo");
});

test("periodo solunar mayor: a menos de 1 h del tránsito de la luna", () => {
  // Busca un instante con |min_transito| pequeño y comprueba la etiqueta.
  let t = Date.parse("2026-11-16T00:00:00Z");
  for (let i = 0; i < 48 * 6; i++, t += 10 * 60000) {
    const r = solLuna(t, ...LEMOIZ);
    if (Math.abs(r.luna_min_transito) <= 20) { assert.equal(r.solunar, "mayor"); return; }
  }
  assert.fail("no se encontró un tránsito en 48 h");
});

test("sin lugar o instante, nada", () => {
  assert.deepEqual(solLuna(NaN, 43, -3), {});
  assert.deepEqual(solLuna(Date.now(), null, -3), {});
});
