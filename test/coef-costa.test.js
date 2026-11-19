// Ola en la orilla aprendida de las cámaras (functions/_lib/coef-costa.js),
// 2026-11-19: "debemos medir por la medición de cámara y en los spots en los
// que no hay, inferimos de los spots cercanos [...] aprender".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aprenderCoefCosta, coefCostaDe, coefParaSpot, coefOrillaSpot, tablaOrillaSpot,
  coefOrillaDesdeTabla, lecturasContraOrilla, tamanoMar, tipoPeriodo, COEF_MIN, COEF_MAX,
} from "../functions/_lib/coef-costa.js";
import { muestrasCoefCosta } from "../scripts/oleaje-camaras/calibracion.mjs";
import { cocienteCamaraModelo } from "../functions/_lib/oleaje-camaras.js";
import COEF from "../functions/_lib/coef-costa-datos.js";

const m = (camara, orilla, hs, periodo = 8) => ({ camara, orilla, hs, periodo });

test("tamaño del mar y periodo", () => {
  assert.equal(tamanoMar(1), "pequeno");
  assert.equal(tamanoMar(2), "medio");
  assert.equal(tamanoMar(3.6), "grande");
  assert.equal(tipoPeriodo(8), "corto");
  assert.equal(tipoPeriodo(13), "largo");
  assert.equal(tipoPeriodo(null), null);
});

test("aprende el cociente orilla/mar abierto por cámara (media geométrica)", () => {
  const muestras = [...Array(40)].map(() => m("a", 0.4, 1)).concat([...Array(40)].map(() => m("b", 0.8, 1)));
  const mod = aprenderCoefCosta(muestras, { ahora: new Date("2026-11-19T00:00:00Z") });
  assert.equal(mod.n, 80);
  assert.ok(Math.abs(mod.camaras.a.coef - 0.4) < 0.03, `a ${mod.camaras.a.coef}`);
  assert.ok(Math.abs(mod.camaras.b.coef - 0.8) < 0.05, `b ${mod.camaras.b.coef}`);
  assert.equal(mod.generado, "2026-11-19T00:00:00.000Z");
});

test("con pocas muestras, el nivel concreto se encoge hacia el de arriba", () => {
  const base = [...Array(50)].map(() => m("a", 0.5, 1));
  const mod = aprenderCoefCosta([...base, m("a", 0.3, 4)]);
  const grande = mod.camaras.a.tamanos.grande;
  assert.equal(grande.n, 1);
  // 1 muestra de 0,075 frente a un padre de ~0,49: se queda mucho más cerca
  // del padre (en logaritmos). Desde 2026-11-19 el prior del mar grande ya
  // es algo más bajo que el de la cámara (efecto del tamaño), de ahí 0,3.
  assert.ok(grande.coef > 0.3 && grande.coef < mod.camaras.a.coef, `grande ${grande.coef}`);
  assert.ok(Math.log(mod.camaras.a.coef / grande.coef) < Math.log(grande.coef / 0.075));
});

test("coefCostaDe elige el nivel más concreto y acota", () => {
  const mod = aprenderCoefCosta([...Array(30)].map(() => m("a", 0.5, 2, 13)));
  assert.equal(coefCostaDe(mod, "a", 2, 13).nivel, "camara_tamano_periodo");
  // Sin muestras de mar grande, el tamaño sale igual (de la cámara y el
  // efecto común del tamaño), con n = 0.
  assert.equal(coefCostaDe(mod, "a", 4, 13).nivel, "camara_tamano");
  assert.equal(coefCostaDe(mod, "a", 4, 13).n, 0);
  assert.equal(coefCostaDe(mod, "x", 2, 13), null);
  const raro = { camaras: { z: { coef: 0.01, n: 3, tamanos: {} }, w: { coef: 5, n: 3, tamanos: {} } } };
  assert.equal(coefCostaDe(raro, "z", 1).coef, COEF_MIN);
  assert.equal(coefCostaDe(raro, "w", 1).coef, COEF_MAX);
});

test("vecinas: el coeficiente de la cámara rebajado hacia 1 según el peso", () => {
  const mod = { camaras: { deba: { coef: 0.36, n: 50, tamanos: {} } } };
  const c = coefParaSpot(mod, { camara: "deba", propia: false, peso: 0.5 }, 2, 8);
  assert.equal(c.coef, +Math.sqrt(0.36).toFixed(3));
  assert.equal(coefParaSpot(mod, { camara: "deba", propia: true }, 2, 8).coef, 0.36);
  assert.equal(coefParaSpot(mod, null, 2, 8), null);
});

test("spot vecino abrigado: el menor entre la cámara y el abrigo de la bahía", () => {
  const mod = { camaras: { berria: { coef: 0.5, n: 100, tamanos: {} } } };
  // Santoña: bahía abrigada (oleaje-costero.js); con mar del NW el abrigo manda.
  const c = coefOrillaSpot(mod, "santona", 3.6, 13, 315);
  assert.ok(c.coef < 0.5 ** 0.8, JSON.stringify(c));
  assert.equal(c.nivel, "abrigo");
  // Spot sin cámara ni vecina: no se inventa.
  assert.equal(coefOrillaSpot(mod, "spot-que-no-existe", 2, 8, 0), null);
});

test("tabla para el navegador: mismo resultado que /prevision", () => {
  const t = tablaOrillaSpot(COEF, "lekeitio");
  assert.equal(t.camara, "deba");
  for (const [hs, per] of [[1, 8], [2, 13], [4, 12], [2, null]]) {
    assert.equal(coefOrillaDesdeTabla(t, hs, per), coefOrillaSpot(COEF, "lekeitio", hs, per, 0).coef, `${hs} ${per}`);
  }
  assert.equal(coefOrillaDesdeTabla(null, 2, 8), null);
});

test("la copia de coefOrillaDesdeTabla() de index.html no se desvía", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mm = html.match(/function coefOrillaDesdeTabla\(t, hs, periodo\) \{[\s\S]*?\n\}/);
  assert.ok(mm, "no está coefOrillaDesdeTabla en index.html");
  const copia = new Function(`${mm[0]}; return coefOrillaDesdeTabla;`)();
  const t = tablaOrillaSpot(COEF, "sopelana");
  for (const [hs, per] of [[0.5, 6], [1.6, 11], [3.2, 9], [5, null]]) assert.equal(copia(t, hs, per), coefOrillaDesdeTabla(t, hs, per));
});

test("el cociente de la cámara se mide contra la orilla, no contra el mar abierto", () => {
  const mod = { camaras: { zarautz: { coef: 0.45, n: 190, tamanos: {} } } };
  const lect = { zarautz: { estimacion: 0.94, modeloCamara: 3.3, marAbierto: 3.3, errorRel: 1 }, otra: { estimacion: 1, modeloCamara: 2 } };
  const r = lecturasContraOrilla(mod, lect);
  assert.equal(r.zarautz.modeloCamara, 1.48);
  assert.deepEqual(r.otra, lect.otra);
  // Antes: 0,94 / 3,3 = 0,28 → tope 0,6 (no podía bajar del 60 % del mar abierto).
  assert.equal(cocienteCamaraModelo(0.94, 3.3, 1), 0.6);
  // Ahora: contra la orilla (1,48), 0,64: la cámara corrige de verdad.
  assert.equal(cocienteCamaraModelo(0.94, r.zarautz.modeloCamara, 1), 0.635);
});

test("muestrasCoefCosta: cada etiqueta con la lectura de su cámara a ±15 min", () => {
  const historial = [
    { camara: "a", fecha: "2026-11-01T10:00:00Z", marAbierto: { hs: 2, hsCorregida: 2.76, periodo: 12 } },
    { camara: "a", fecha: "2026-11-01T12:00:00Z", marAbierto: { hs: 1 } },
    { camara: "b", fecha: "2026-11-01T10:00:00Z" },
  ];
  const centro = (b) => ({ "0.5-1": 0.75, "1-2": 1.5 })[b] ?? null;
  const out = muestrasCoefCosta(historial, [
    { camara: "a", banda: "1-2", fecha: "2026-11-01T10:10:00Z", origen: "foto" },
    { camara: "a", banda: "0.5-1", fecha: "2026-11-01T11:00:00Z", origen: "foto" },
    { camara: "b", banda: "1-2", fecha: "2026-11-01T10:00:00Z", origen: "foto" },
    { camara: "a", banda: "rara", fecha: "2026-11-01T10:00:00Z", origen: "foto" },
  ], centro);
  assert.deepEqual(out, [{ camara: "a", orilla: 1.5, hs: 2.76, periodo: 12, origen: "foto" }]);
  // Con el mar abierto de su propia lectura (Supabase), manda ese.
  const conHs = muestrasCoefCosta(historial, [
    { camara: "a", banda: "1-2", fecha: "2026-11-01T10:10:00Z", origen: "foto", hs: 3.1 },
    { camara: "z", banda: "0.5-1", fecha: "2026-11-01T10:10:00Z", origen: "foto", hs: 2 },
  ], centro);
  assert.deepEqual(conHs, [
    { camara: "a", orilla: 1.5, hs: 3.1, periodo: 12, origen: "foto" },
    { camara: "z", orilla: 0.75, hs: 2, periodo: null, origen: "foto" },
  ]);
});

test("el coeficiente publicado sale de etiquetas reales y está en rango", () => {
  assert.ok(COEF.n >= 500, `n ${COEF.n}`);
  for (const [cam, c] of Object.entries(COEF.camaras)) {
    assert.ok(c.coef > 0 && c.coef <= 1.5, `${cam} ${c.coef}`);
  }
});

test("el robot solo reescribe el coeficiente si algo cambia más de un 3 %, y el fichero se lee igual", async () => {
  const { cambioMaterial, textoCoefCosta, leerTextoCoefCosta } = await import("../scripts/oleaje-camaras/medir-espuma.mjs");
  const a = { camaras: { x: { coef: 0.4, tamanos: { pequeno: { coef: 0.5 } } } } };
  assert.equal(cambioMaterial(null, a), true);
  assert.equal(cambioMaterial(a, { camaras: { x: { coef: 0.405, tamanos: { pequeno: { coef: 0.51 } } } } }), false);
  assert.equal(cambioMaterial(a, { camaras: { x: { coef: 0.45, tamanos: { pequeno: { coef: 0.5 } } } } }), true);
  assert.equal(cambioMaterial(a, { camaras: { x: a.camaras.x, y: { coef: 1, tamanos: {} } } }), true);
  assert.deepEqual(leerTextoCoefCosta(textoCoefCosta(COEF)), COEF);
  assert.equal(readFileSync(new URL("../functions/_lib/coef-costa-datos.js", import.meta.url), "utf8"), textoCoefCosta(COEF));
});

test("cámara sin mar grande: sigue la tendencia del resto, no su media de mar pequeño (Bakio, 2026-11-19)", () => {
  const muestras = [];
  // Cinco cámaras con la orilla recibiendo la mitad con mar grande que con pequeño.
  for (const c of ["a", "b", "c", "d", "e"]) {
    for (let i = 0; i < 30; i++) muestras.push(m(c, 0.6, 1), m(c, 1.2, 4)); // cociente 0,6 y 0,3
  }
  // "bakio": solo mar pequeño, 0,64.
  for (let i = 0; i < 25; i++) muestras.push(m("bakio", 0.64, 1));
  const mod = aprenderCoefCosta(muestras);
  const grande = coefCostaDe(mod, "bakio", 4.5, 12).coef;
  assert.ok(grande < 0.45, `grande ${grande}`);
  assert.ok(grande > 0.25, `grande ${grande}`);
  assert.ok(Math.abs(coefCostaDe(mod, "bakio", 1, 12).coef - 0.64) < 0.08);
  assert.ok(mod.efectoTamano.grande < 1 && mod.efectoTamano.pequeno > 1);
});

test("REGLA: con más mar nunca llega a la orilla una parte mayor (pequeño ≥ medio ≥ grande)", async () => {
  const { verificarCoefCosta, ordenarPorTamano } = await import("../functions/_lib/coef-costa.js");
  // Datos que se cruzan (pocas etiquetas de mar medio, muy bajas).
  const mod = aprenderCoefCosta([
    ...[...Array(30)].map(() => m("x", 0.5, 1)),
    ...[...Array(3)].map(() => m("x", 0.4, 2)),
    ...[...Array(20)].map(() => m("x", 1.6, 4)),
  ]);
  assert.deepEqual(verificarCoefCosta(mod), []);
  const t = ordenarPorTamano({ pequeno: { coef: 0.5, n: 10, periodos: {} }, medio: { coef: 0.2, n: 2, periodos: {} }, grande: { coef: 0.3, n: 2, periodos: { largo: { coef: 0.3, n: 1 } } } });
  assert.ok(t.pequeno.coef >= t.medio.coef && t.medio.coef >= t.grande.coef);
  assert.equal(t.medio.coef, t.grande.coef);
  assert.equal(t.grande.periodos.largo.coef, t.grande.coef);
  assert.deepEqual(verificarCoefCosta({ camaras: { y: { tamanos: { pequeno: { coef: 0.3 }, medio: { coef: 0.4 } } } } }).length, 2);
});

test("REGLA sobre lo publicado: coef-costa-datos.js la cumple en todas las cámaras", async () => {
  const { verificarCoefCosta } = await import("../functions/_lib/coef-costa.js");
  const { default: publicado } = await import("../functions/_lib/coef-costa-datos.js");
  assert.deepEqual(verificarCoefCosta(publicado), []);
});
