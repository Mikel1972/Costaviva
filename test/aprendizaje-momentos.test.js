// Momentos de actividad para el aprendizaje (2026-11-16, Mikel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { franja, momentosSalida, agruparMomentos } from "../scripts/aprendizaje/momentos.mjs";

test("franjas de 3 h", () => {
  assert.equal(franja("01:57:00"), "00-03");
  assert.equal(franja("23:10"), "21-24");
  assert.equal(franja(null), null);
});

test("picadas y capturas con hora son momentos, ordenados; sin hora no", () => {
  const m = momentosSalida(
    [{ hora: "02:05:00", marea_tendencia: "subiendo", condiciones: { luna_fase: "Menguante", presion_tendencia: "estable" } }, { hora: null }],
    [{ hora: "01:28:00", marea_tendencia: "bajando", marea_altura: 1.1 }, { hora: null }],
  );
  assert.deepEqual(m.map((x) => [x.tipo, x.hora, x.marea_tendencia]), [["captura", "01:28", "bajando"], ["picada", "02:05", "subiendo"]]);
  assert.equal(m[1].luna_fase, "Menguante");
});

test("solo se publican grupos con 3 personas o más", () => {
  const caso = (u, tend) => ({ usuario: u, momentos: [{ tipo: "picada", hora: "02:00", marea_tendencia: tend }] });
  const r = agruparMomentos([caso("a", "subiendo"), caso("b", "subiendo"), caso("c", "subiendo"), caso("a", "bajando")]);
  assert.equal(r.total_momentos, 4);
  const sube = r.grupos.find((g) => g.variable === "marea" && g.valor === "subiendo");
  assert.deepEqual(sube, { variable: "marea", valor: "subiendo", picadas: 3, capturas: 0, personas: 3 });
  assert.ok(!r.grupos.some((g) => g.valor === "bajando"));
  assert.ok(r.grupos_retenidos >= 1);
});

test("el diario completa las picadas que no tienen condiciones", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /filter\(\(p\) => p\.condiciones == null\)/);
});
