// Tests de la lluvia animada (assets/js/lluvia-animada.js): tomas de la
// ventana de 3 h, horas en Madrid y estado de reproducción/pausa.
// Lógica pura: sin red, sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duracionISOaMs, parsearDimensionTiempo, framesEnVentana, horaWms, ultimaEstimada,
  horaMadrid, estadoCarga, crearEstado, alternarReproduccion, siguienteIndice,
  ultimoIndiceListo, retardo, avanzar, RETARDO_FRAME_MS, RETARDO_ULTIMO_MS, ATRIBUCION,
} from "../assets/js/lluvia-animada.js";

// Recorte real del GetCapabilities de msg_fes:h60b (EUMETView, 2026-10-08).
const CAPS_INTERVALO = `<Layer queryable="1" opaque="0"><Name>msg_fes:h60b</Name>
<Dimension name="time" default="2026-10-08T09:45:00Z" units="ISO8601" nearestValue="1">2022-12-09T00:45:00.000Z/2026-10-08T09:45:00.000Z/PT15M</Dimension></Layer>`;

test("duraciones ISO 8601", () => {
  assert.equal(duracionISOaMs("PT15M"), 15 * 60000);
  assert.equal(duracionISOaMs("PT10M"), 10 * 60000);
  assert.equal(duracionISOaMs("PT1H"), 3600000);
  assert.equal(duracionISOaMs("PT1H30M"), 90 * 60000);
  assert.equal(duracionISOaMs("P1D"), null);
  assert.equal(duracionISOaMs(""), null);
});

test("lee la dimensión time en forma de intervalo", () => {
  const d = parsearDimensionTiempo(CAPS_INTERVALO);
  assert.equal(horaWms(d.ultima), "2026-10-08T09:45:00Z");
  assert.equal(d.pasoMs, 15 * 60000);
  assert.equal(d.lista, null);
});

test("lee la dimensión time en forma de lista", () => {
  const xml = `<Dimension name="time" default="2026-10-08T10:00:00Z">2026-10-08T09:40:00Z,2026-10-08T09:50:00Z,2026-10-08T10:00:00Z</Dimension>`;
  const d = parsearDimensionTiempo(xml);
  assert.equal(horaWms(d.ultima), "2026-10-08T10:00:00Z");
  assert.equal(d.pasoMs, 10 * 60000);
  assert.equal(d.lista.length, 3);
});

test("sin dimensión time -> null", () => {
  assert.equal(parsearDimensionTiempo("<Layer></Layer>"), null);
  assert.equal(parsearDimensionTiempo(""), null);
});

test("ventana de 3 h cada 15 min: 13 tomas, de la más antigua a la última", () => {
  const f = framesEnVentana(parsearDimensionTiempo(CAPS_INTERVALO));
  assert.equal(f.length, 13);
  assert.equal(f[0], "2026-10-08T06:45:00Z");
  assert.equal(f[12], "2026-10-08T09:45:00Z");
  for (let i = 1; i < f.length; i++) assert.equal(Date.parse(f[i]) - Date.parse(f[i - 1]), 15 * 60000);
});

test("ventana de 3 h con tomas cada 10 min: 19 tomas", () => {
  const f = framesEnVentana({ ultima: Date.parse("2026-10-08T10:00:00Z"), pasoMs: 10 * 60000 });
  assert.equal(f.length, 19);
  assert.equal(f[0], "2026-10-08T07:00:00Z");
});

test("con lista explícita solo entran las tomas que existen dentro de las 3 h", () => {
  const t = (s) => Date.parse(s);
  const lista = [t("2026-10-08T05:00:00Z"), t("2026-10-08T07:00:00Z"), t("2026-10-08T08:30:00Z"), t("2026-10-08T10:00:00Z")];
  const f = framesEnVentana({ ultima: lista[3], pasoMs: 0, lista });
  assert.deepEqual(f, ["2026-10-08T07:00:00Z", "2026-10-08T08:30:00Z", "2026-10-08T10:00:00Z"]);
});

test("sin última hora válida no hay tomas", () => {
  assert.deepEqual(framesEnVentana({ ultima: NaN, pasoMs: 900000 }), []);
});

test("respaldo sin capabilities: hace 45 min, redondeado a 15", () => {
  assert.equal(horaWms(ultimaEstimada(Date.parse("2026-10-08T10:32:15Z"))), "2026-10-08T09:45:00Z");
});

test("horas en Madrid: CEST en verano, CET en invierno", () => {
  assert.equal(horaMadrid("2026-10-08T09:45:00Z"), "11:45");
  assert.equal(horaMadrid("2026-12-01T09:45:00Z"), "10:45");
  assert.equal(horaMadrid("2026-10-08T22:05:00Z"), "00:05");
  // Cambio de hora del 25-10-2026 (03:00 CEST -> 02:00 CET a la 01:00 UTC).
  assert.equal(horaMadrid("2026-10-25T00:45:00Z"), "02:45");
  assert.equal(horaMadrid("2026-10-25T01:15:00Z"), "02:15");
  assert.equal(horaMadrid("no es una fecha"), "--:--");
});

test("estado de carga de una toma", () => {
  assert.equal(estadoCarga({ cargadas: 0, errores: 0, terminado: false }), "pendiente");
  assert.equal(estadoCarga({ cargadas: 3, errores: 1, terminado: true }), "ok");
  assert.equal(estadoCarga({ cargadas: 0, errores: 4, terminado: true }), "fallo");
  assert.equal(estadoCarga({ cargadas: 0, errores: 0, terminado: true }), "ok");
});

test("arranca reproduciendo en la última toma; play/pausa alterna", () => {
  const e = crearEstado(13);
  assert.equal(e.reproduciendo, true);
  assert.equal(e.indice, 12);
  const p = alternarReproduccion(e);
  assert.equal(p.reproduciendo, false);
  assert.equal(alternarReproduccion(p).reproduciendo, true);
  assert.equal(e.reproduciendo, true, "no muta el estado original");
});

test("avanza en bucle saltando las tomas que fallaron o no han cargado", () => {
  const listas = [true, false, true, true, false];
  assert.equal(siguienteIndice(0, listas), 2);
  assert.equal(siguienteIndice(3, listas), 0, "da la vuelta al llegar al final");
  assert.equal(siguienteIndice(4, listas), 0);
  assert.equal(siguienteIndice(2, [false, false, true]), 2, "si solo hay una lista, se queda en ella");
  assert.equal(siguienteIndice(0, [false, false]), -1);
});

test("en pausa no avanza; en marcha sí", () => {
  const listas = [true, true, true];
  let e = { ...crearEstado(3), indice: 0 };
  e = avanzar(e, listas);
  assert.equal(e.indice, 1);
  e = avanzar(alternarReproduccion(e), listas);
  assert.equal(e.indice, 1);
  assert.equal(avanzar({ ...crearEstado(2), indice: 0 }, [false, false]).indice, 0);
});

test("la última toma disponible dura más en pantalla", () => {
  const listas = [true, true, true, false];
  assert.equal(ultimoIndiceListo(listas), 2);
  assert.equal(retardo(2, listas), RETARDO_ULTIMO_MS);
  assert.equal(retardo(0, listas), RETARDO_FRAME_MS);
  assert.ok(RETARDO_ULTIMO_MS > RETARDO_FRAME_MS);
});

test("la atribución cita EUMETSAT H SAF y CC BY 4.0", () => {
  assert.match(ATRIBUCION, /EUMETSAT H SAF/);
  assert.match(ATRIBUCION, /CC BY 4\.0/);
  assert.doesNotMatch(ATRIBUCION, /\son[a-z]{3,}\s*=/i);
});
