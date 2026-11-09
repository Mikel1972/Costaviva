// La foto aprende a calcular la talla (2026-11-09): muestras, calibración por
// especie y corrección en identificar-captura.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claveEspecie, muestrasTallaFoto, gruposTallaFoto, calibracionTallaFoto, aplicarCalibracion } from "../assets/js/talla-foto.js";

test("la especie se compara sin acentos ni mayúsculas", () => {
  assert.equal(claveEspecie("Sargo"), "sargo");
  assert.equal(claveEspecie("Pulpo común"), "pulpo comun");
  assert.equal(claveEspecie("Calamar / chipirón"), "calamar");
});

test("solo cuentan las tallas medidas con cálculo de la foto y de quien no se opuso", () => {
  const salidas = [{ id: "s1", user_id: "a" }, { id: "s2", user_id: "b" }];
  const capturas = [
    { salida_id: "s1", especie: "Sargo", talla_cm: 30, talla_estimada_cm: 30, talla_medida: true },
    { salida_id: "s1", especie: "Sargo", talla_cm: 28, talla_estimada_cm: 31, talla_medida: false },
    { salida_id: "s1", especie: "Sargo", talla_cm: 28, talla_estimada_cm: null, talla_medida: true },
    { salida_id: "s2", especie: "Sargo", talla_cm: 25, talla_estimada_cm: 27, talla_medida: true },
  ];
  const m = muestrasTallaFoto({ salidas, capturas, excluir: new Set(["b"]) });
  assert.deepEqual(m.map((x) => x.error), [0]);
});

function muchas(n, personas, error) {
  const salidas = [], capturas = [];
  for (let i = 0; i < n; i++) {
    salidas.push({ id: `s${i}`, user_id: `u${i % personas}` });
    capturas.push({ salida_id: `s${i}`, especie: "Lubina", talla_cm: 40, talla_estimada_cm: 40 + error + (i % 2 ? 0.5 : -0.5), talla_medida: true });
  }
  return muestrasTallaFoto({ salidas, capturas });
}

test("con 10 medidas de 5 personas y sesgo claro, se corrige", () => {
  const cal = calibracionTallaFoto(gruposTallaFoto(muchas(10, 5, 3)));
  assert.equal(cal.lubina.sesgo_cm, 3);
  assert.equal(cal.lubina.margen_cm, 3);
  const r = aplicarCalibracion({ especie: "Lubina", talla_cm: 45, peso_g: 1000 }, cal);
  assert.equal(r.talla_cm, 42);
  assert.equal(r.talla_foto_cm, 45);
  assert.equal(r.calibrada, true);
  assert.equal(r.peso_g, Math.round(1000 * (42 / 45) ** 3));
});

test("sin personas suficientes no se publica ni se corrige", () => {
  assert.deepEqual(calibracionTallaFoto(gruposTallaFoto(muchas(20, 4, 3))), {});
});

test("sin sesgo claro solo se da el margen", () => {
  const cal = calibracionTallaFoto(gruposTallaFoto(muchas(10, 5, 0)));
  assert.equal(cal.lubina.sesgo_cm, 0);
  const r = aplicarCalibracion({ especie: "Lubina", talla_cm: 45, peso_g: 1000 }, cal);
  assert.equal(r.talla_cm, 45);
  assert.equal(r.margen_cm, 0.5);
  assert.equal(r.calibrada, false);
});

test("sin talla o especie no calibrada: la foto tal cual", () => {
  const r = aplicarCalibracion({ especie: "Sargo", talla_cm: null, peso_g: null }, { lubina: { n: 10, margen_cm: 2, sesgo_cm: 1 } });
  assert.equal(r.talla_cm, null);
  assert.equal(r.margen_cm, null);
});

test("el diario guarda el cálculo de la foto y la casilla de talla medida", () => {
  const h = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(h, /id="capturaTallaMedida"/);
  assert.match(h, /talla_medida: talla \? tallaMedida : null/);
  assert.match(h, /talla_estimada_cm: resultado\.talla_foto_cm/);
  const f = readFileSync(new URL("../functions/identificar-captura.js", import.meta.url), "utf8");
  assert.match(f, /aplicarCalibracion\(interpretado\.resultado, CALIBRACION_TALLA\)/);
});

import { muestrasPesoFoto, gruposPesoFoto, calibracionPesoFoto } from "../assets/js/talla-foto.js";

function pesadas(n, personas, factor) {
  const salidas = [], capturas = [];
  for (let i = 0; i < n; i++) {
    salidas.push({ id: `s${i}`, user_id: `u${i % personas}` });
    const real = 500 + 10 * i;
    capturas.push({ salida_id: `s${i}`, especie: "Sargo", peso_g: real, peso_estimado_g: Math.round(real * factor * (i % 2 ? 1.01 : 0.99)), peso_medido: true });
  }
  return muestrasPesoFoto({ salidas, capturas });
}

test("peso: solo cuentan las capturas pesadas con cálculo de la foto", () => {
  const salidas = [{ id: "s1", user_id: "a" }];
  const capturas = [
    { salida_id: "s1", especie: "Sargo", peso_g: 560, peso_estimado_g: 450, peso_medido: true },
    { salida_id: "s1", especie: "Sargo", peso_g: 560, peso_estimado_g: 450, peso_medido: false },
    { salida_id: "s1", especie: "Sargo", peso_g: 560, peso_estimado_g: null, peso_medido: true },
  ];
  const m = muestrasPesoFoto({ salidas, capturas });
  assert.equal(m.length, 1);
  assert.equal(m[0].error_g, -110);
  assert.equal(m[0].error_pct, -19.64);
});

test("peso: con sesgo claro (la foto se queda corta un 20 %), se corrige", () => {
  const cal = calibracionPesoFoto(gruposPesoFoto(pesadas(10, 5, 0.8)));
  assert.ok(cal.sargo.sesgo_pct < -19 && cal.sargo.sesgo_pct > -21, String(cal.sargo.sesgo_pct));
  const r = aplicarCalibracion({ especie: "Sargo", talla_cm: 30, peso_g: 450 }, { talla: {}, peso: cal });
  assert.equal(r.peso_foto_g, 450);
  assert.ok(r.peso_g > 550 && r.peso_g < 570, String(r.peso_g));
  assert.equal(r.calibrada, true);
  assert.ok(r.margen_peso_g > 0);
});

test("peso: sin personas suficientes no se corrige", () => {
  assert.deepEqual(calibracionPesoFoto(gruposPesoFoto(pesadas(20, 4, 0.8))), {});
});

test("la calibración antigua (solo talla) sigue valiendo", () => {
  const r = aplicarCalibracion({ especie: "Lubina", talla_cm: 45, peso_g: 1000 }, { lubina: { n: 10, margen_cm: 3, sesgo_cm: 3 } });
  assert.equal(r.talla_cm, 42);
});

test("el diario guarda «Lo he pesado»", () => {
  const h = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(h, /id="capturaPesoMedido"/);
  assert.match(h, /peso_medido: peso \? pesoMedido : null/);
});
