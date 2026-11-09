// Histórico previsto/real de las condiciones (2026-11-08).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { muestrasCondiciones, sesgoCondiciones, publicarCondiciones, candidatosCorreccion } from "../scripts/aprendizaje/sesgo-condiciones.mjs";

const salida = (u, viento, vientoReal, antes = 12) => ({
  user_id: u, concluida: true, fecha: "2026-11-08", lat: 43.43, lon: -2.95, viento_kmh: viento, oleaje_altura_max: 1.2, presion_valor: null, temp_agua: 15,
  indice_factores: { real: { horas_antes: antes, viento_kmh: vientoReal, oleaje_altura_max: 1.0, temp_agua: 15.4 } },
});

test("histórico: error = previsto − real, solo con la previsión apuntada antes de pescar", () => {
  const m = muestrasCondiciones({ salidas: [salida("a", 20, 15), salida("b", 20, 15, 0)] });
  const viento = m.filter((x) => x.variable === "viento_kmh");
  assert.equal(viento.length, 1);
  assert.equal(viento[0].error, 5);
  assert.ok(m.some((x) => x.variable === "ola_m" && Math.abs(x.error - 0.2) < 1e-9));
  assert.ok(!m.some((x) => x.variable === "presion_hpa"), "sin dato no hay muestra");
});

test("histórico: se publica solo con 5 personas y se propone solo con sesgo claro", () => {
  const salidas = [];
  for (let i = 0; i < 25; i++) salidas.push(salida(`u${i % 6}`, 20 + (i % 3), 15));
  const g = sesgoCondiciones(muestrasCondiciones({ salidas }));
  const viento = g.find((x) => x.variable === "viento_kmh");
  assert.equal(viento.personas, 6);
  assert.ok(viento.sesgo > 5);
  assert.ok(candidatosCorreccion(publicarCondiciones(g)).some((x) => x.variable === "viento_kmh"));
  const pocos = sesgoCondiciones(muestrasCondiciones({ salidas: salidas.filter((s) => s.user_id === "u0") }));
  assert.equal(publicarCondiciones(pocos).length, 0);
});

test("histórico: el diario guarda lo real al concluir la jornada", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /indice_factores: \{ \.\.\.\(salida\.indice_factores \|\| \{\}\), real \}/);
  assert.match(html, /function registroReal\(salida, post\)/);
});
