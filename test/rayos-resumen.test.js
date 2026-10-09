// Tests de la lógica pura del panel de rayos (assets/js/rayos.js,
// 2026-10-08): distancia y rumbo, el rayo más cercano, la referencia desde
// la que se mide y la frase de una línea. Sin red ni DOM: corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kmEntre, rumbo, puntoCardinal, edadMinutos, textoEdad, rayoMasCercano,
  elegirReferencia, debeCambiarReferencia, resumenRayos, rayosParaEncuadre, colorPorEdad,
  RADIO_KM, VENTANA_MIN, ZOOM_MIN_VIVO,
} from "../assets/js/rayos.js";

const BERMEO = { lat: 43.42, lon: -2.72 };

test("distancia: 1° de latitud son ~111 km y un punto consigo mismo da 0", () => {
  assert.ok(Math.abs(kmEntre({ lat: 43, lon: -3 }, { lat: 44, lon: -3 }) - 111.2) < 0.5);
  assert.equal(kmEntre(BERMEO, BERMEO), 0);
  // Bilbao–Donostia, ~80 km en línea recta.
  const km = kmEntre({ lat: 43.263, lon: -2.935 }, { lat: 43.318, lon: -1.981 });
  assert.ok(km > 75 && km < 80, `km=${km}`);
});

test("rumbo y punto cardinal en castellano (O, no W)", () => {
  assert.ok(Math.abs(rumbo(BERMEO, { lat: 44, lon: -2.72 })) < 0.01);
  assert.ok(Math.abs(rumbo(BERMEO, { lat: 43.42, lon: -1.5 }) - 90) < 1);
  assert.ok(Math.abs(rumbo(BERMEO, { lat: 43, lon: -2.72 }) - 180) < 0.01);
  assert.equal(puntoCardinal(0), "N");
  assert.equal(puntoCardinal(22), "N");
  assert.equal(puntoCardinal(23), "NE");
  assert.equal(puntoCardinal(225), "SO");
  assert.equal(puntoCardinal(270), "O");
  assert.equal(puntoCardinal(315), "NO");
  assert.equal(puntoCardinal(359), "N");
  assert.equal(puntoCardinal(-45), "NO");
  assert.equal(puntoCardinal(rumbo(BERMEO, { lat: 43.6, lon: -2.95 })), "NO");
});

test("edad: sin hora se toma el extremo de la ventana; menos de 1 min es 'ahora mismo'", () => {
  assert.equal(edadMinutos({ ts: 1000 }, 1000 + 180), 3);
  assert.equal(edadMinutos({ ts: 2000 }, 1000), 0);
  assert.equal(edadMinutos({ ts: null }, 1000), VENTANA_MIN);
  assert.equal(textoEdad(0.4), "ahora mismo");
  assert.equal(textoEdad(7.6), "hace 8 min");
});

test("rayo más cercano: distancia, rumbo y edad; ignora puntos sin coordenadas", () => {
  const ahora = 10_000;
  const rayos = [
    { lat: 43.9, lon: -2.72, ts: ahora - 60 },
    { lat: 43.5, lon: -2.82, ts: ahora - 300 },
    { lat: null, lon: -2.7, ts: ahora },
    { lat: 43.42, lon: -1.0, ts: ahora },
  ];
  const m = rayoMasCercano(BERMEO, rayos, ahora);
  assert.equal(m.rayo, rayos[1]);
  assert.ok(m.km > 11 && m.km < 13, `km=${m.km}`);
  assert.equal(m.cardinal, "NO");
  assert.equal(m.edadMin, 5);
  assert.equal(rayoMasCercano(BERMEO, [], ahora), null);
  assert.equal(rayoMasCercano(BERMEO, undefined, ahora), null);
});

test("a igual distancia gana el más reciente", () => {
  const ahora = 10_000;
  const viejo = { lat: 43.5, lon: -2.72, ts: ahora - 240 };
  const nuevo = { lat: 43.5, lon: -2.72, ts: ahora - 30 };
  assert.equal(rayoMasCercano(BERMEO, [viejo, nuevo], ahora).rayo, nuevo);
});

test("referencia: spot abierto > GPS con permiso > centro del mapa", () => {
  const centro = { lat: 43.5, lon: -2.8 };
  const gps = { lat: 43.3, lon: -2.9 };
  const spot = { nombre: "Mundaka", lat: 43.4047, lon: -2.6989 };
  assert.deepEqual(elegirReferencia({ spot, gps, centro }), { lat: 43.4047, lon: -2.6989, de: "de Mundaka", lugar: "Mundaka", origen: "spot" });
  assert.deepEqual(elegirReferencia({ gps, centro }), { lat: 43.3, lon: -2.9, de: "de ti", lugar: "ti", origen: "gps" });
  assert.equal(elegirReferencia({ spot: null, gps: null, centro }).origen, "centro");
  assert.equal(elegirReferencia({ spot: { nombre: "x" }, centro }).origen, "centro");
});

test("al mover el mapa solo se cambia la referencia si el centro se va lejos y con zoom suficiente", () => {
  const ref = { lat: 43.42, lon: -2.72 };
  assert.equal(debeCambiarReferencia(ref, { lat: 43.5, lon: -2.8 }, 10), false);
  assert.equal(debeCambiarReferencia(ref, { lat: 44.0, lon: -2.72 }, 10), true);
  assert.equal(debeCambiarReferencia(ref, { lat: 44.0, lon: -2.72 }, ZOOM_MIN_VIVO - 1), false);
  assert.equal(debeCambiarReferencia(null, { lat: 44.0, lon: -2.72 }, 10), false);
});

test("frase: con rayos dice distancia, rumbo, desde dónde y hace cuánto; color por distancia", () => {
  const ref = { de: "de ti" };
  const r = resumenRayos({ estado: "ok", ref, total: 4, masCercano: { km: 12.4, cardinal: "NO", edadMin: 8.2 } });
  assert.equal(r.texto, "⚡ Rayo más cercano: 12 km al NO de ti · hace 8 min");
  assert.equal(r.nivel, "peligro");
  assert.equal(r.conteo, "4 rayos en los últimos 5 min a menos de 100 km.");
  assert.equal(resumenRayos({ estado: "ok", ref, total: 1, masCercano: { km: 30, cardinal: "N", edadMin: 0.2 } }).nivel, "aviso");
  assert.equal(resumenRayos({ estado: "ok", ref, total: 1, masCercano: { km: 30, cardinal: "N", edadMin: 0.2 } }).conteo, "1 rayo en los últimos 5 min a menos de 100 km.");
  assert.equal(resumenRayos({ estado: "ok", ref, total: 1, masCercano: { km: 80, cardinal: "E", edadMin: 2 } }).nivel, "lejos");
  assert.match(resumenRayos({ estado: "ok", ref, total: 1, masCercano: { km: 0.3, cardinal: "E", edadMin: 0 } }).texto, /menos de 1 km al E de ti · ahora mismo/);
});

test("frase: sin rayos, cargando, mapa alejado y sin tiempo real", () => {
  const sin = resumenRayos({ estado: "ok", masCercano: null });
  assert.equal(sin.texto, `Sin rayos a menos de ${RADIO_KM} km en los últimos ${VENTANA_MIN} min`);
  assert.equal(sin.nivel, "ok");
  assert.equal(resumenRayos({ estado: "cargando" }).texto, "Buscando rayos cerca…");
  assert.match(resumenRayos({ estado: "lejos" }).texto, /Acerca el mapa/);
  for (const estado of ["no_disponible", "limite", undefined]) {
    const r = resumenRayos({ estado });
    assert.match(r.texto, /satélite/);
    assert.equal(r.nivel, "neutro");
  }
});

test("encuadre: el más cercano y los de su misma tormenta, no todos los de 100 km", () => {
  const ref = { lat: 43.42, lon: -2.72 };
  const cerca = { lat: 43.52, lon: -2.72 };      // ~11 km
  const misma = { lat: 43.7, lon: -2.72 };       // ~31 km
  const lejos = { lat: 44.2, lon: -2.72 };       // ~87 km
  const m = rayoMasCercano(ref, [cerca, misma, lejos], 0);
  assert.deepEqual(rayosParaEncuadre(ref, [cerca, misma, lejos], m), [cerca, misma]);
  assert.deepEqual(rayosParaEncuadre(ref, [cerca], null), []);
});

test("color por edad: más oscuro cuanto más reciente", () => {
  assert.equal(colorPorEdad(0.5), "#5A189A");
  assert.equal(colorPorEdad(2), "#7B2CBF");
  assert.equal(colorPorEdad(4), "#B07FE0");
});
