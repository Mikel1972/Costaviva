// Hora de las boyas (2026-10-09). La boya de Nazaré (Instituto Hidrográfico,
// visor MONICAN) devuelve SDATA en la zona de `dtz`, sin sufijo: con
// dtz=Europe/Lisbon llegaba "21:00" (= 20:00 UTC) y el navegador la leía en
// su zona (en España, una hora antes). Ahora se pide en UTC y sale con "Z".
// Y el diario solo usa la boya si su lectura es de la hora de la salida.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSULTA_NAZARE, sdataAUtcISO, boyaDesdeNazare, boyaDesdeCopernicus, BOYAS } from "../functions/prevision.js";
import { boyaDeLaHora, MARGEN_BOYA_HORAS } from "../assets/js/condiciones-salida.js";
import { msDeEtiqueta } from "../assets/js/regiones.js";

// Respuesta real del visor el 2026-10-09 a las 20:45 UTC con dtz=UTC
// (recortada): la última hora con dato es la de las 20:00 UTC.
const ALTURAS = [{ SDATA: "2026-10-09 18:00", HMAX: 2.6, HS: "1.7" }, { SDATA: "2026-10-09 19:00", HMAX: 2.5, HS: "1.6" }, { SDATA: "2026-10-09 20:00", HMAX: 2.7, HS: "1.6" }, { SDATA: "2026-10-09 21:00", HMAX: "NaN", HS: "NaN" }];
const PERIODOS = [{ SDATA: "2026-10-09 20:00", TP: "11.8" }];
const DIRECCIONES = [{ SDATA: "2026-10-09 20:00", THTP: "295" }];
const TEMPS = [{ SDATA: "2026-10-09 19:00", TEMP: 17.4 }, { SDATA: "2026-10-09 20:00", TEMP: 17.3 }];
const AHORA = Date.UTC(2026, 9, 9, 20, 45);

test("Nazaré: se pide en UTC (dtz=UTC) y SDATA sale como ISO con Z", () => {
  assert.match(CONSULTA_NAZARE, /(^|&)dtz=UTC(&|$)/);
  assert.equal(sdataAUtcISO("2026-10-09 20:00"), "2026-10-09T20:00:00Z");
  assert.equal(sdataAUtcISO("2026-10-09T05:30"), "2026-10-09T05:30:00Z");
  assert.equal(sdataAUtcISO("basura"), null);
  assert.equal(sdataAUtcISO(undefined), null);
});

test("Nazaré: la última lectura válida, con su hora en UTC", () => {
  const b = boyaDesdeNazare(ALTURAS, PERIODOS, DIRECCIONES, TEMPS, AHORA);
  assert.equal(b.actualizado, "2026-10-09T20:00:00Z");
  assert.equal(b.alturaSignificativa, 1.6);
  assert.equal(b.periodoPico, 11.8);
  assert.equal(b.tempAgua, 17.3);
  assert.match(b.dirOla, /^WNW 295°$/);
  // En cualquier zona del navegador es el mismo instante.
  assert.equal(new Date(b.actualizado).getTime(), Date.UTC(2026, 9, 9, 20));
  assert.equal(new Date(b.actualizado).toLocaleTimeString("es-ES", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" }), "21:00");
  assert.equal(new Date(b.actualizado).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }), "22:00");
});

test("Nazaré: lectura vieja = sin boya; temperatura de otra hora no se mezcla", () => {
  assert.throws(() => boyaDesdeNazare(ALTURAS, PERIODOS, DIRECCIONES, TEMPS, Date.UTC(2026, 9, 10, 3)), /últimas/);
  assert.throws(() => boyaDesdeNazare([{ SDATA: "2026-10-09 20:00", HS: "NaN" }], [], [], [], AHORA), /sin datos/);
  const b = boyaDesdeNazare(ALTURAS, [], [], [{ SDATA: "2026-10-09 15:00", TEMP: 18 }], AHORA);
  assert.equal(b.tempAgua, null);
  assert.equal(b.periodoPico, null);
  assert.equal(b.dirOla, null);
});

test("las boyas de Copernicus ya venían en UTC con Z", () => {
  const b = boyaDesdeCopernicus(BOYAS[0], { [BOYAS[0].copernicus]: { ultima: { hora: "2026-10-09T18:00:00Z", hs: 1.2, tp: 9, dir: 300, temp: 19 } } }, AHORA);
  assert.equal(b.actualizado, "2026-10-09T18:00:00Z");
});

test("msDeEtiqueta: hora local -> instante, también en los cambios de hora", () => {
  assert.equal(msDeEtiqueta("2026-10-09T22:00", "Europe/Madrid"), Date.UTC(2026, 9, 9, 20));
  assert.equal(msDeEtiqueta("2026-10-09T21:00", "Europe/Lisbon"), Date.UTC(2026, 9, 9, 20));
  assert.equal(msDeEtiqueta("2026-01-09T21:00", "Europe/Lisbon"), Date.UTC(2026, 0, 9, 21));
  assert.equal(msDeEtiqueta("2026-03-29T04:00", "Europe/Madrid"), Date.UTC(2026, 2, 29, 2)); // ya CEST
  assert.equal(msDeEtiqueta("2026-10-25T02:00", "Europe/Madrid"), Date.UTC(2026, 9, 25, 0)); // la primera 02
  assert.equal(msDeEtiqueta("2026-10-10T00:00", "Pacific/Auckland"), Date.UTC(2026, 9, 9, 11));
});

test("diario: la boya solo vale para la hora de la salida (±2 h)", () => {
  const b = boyaDesdeNazare(ALTURAS, PERIODOS, DIRECCIONES, TEMPS, AHORA); // 20:00 UTC
  assert.equal(MARGEN_BOYA_HORAS, 2);
  // Salida en Peniche (Lisboa) a las 21:00 locales = la misma hora.
  assert.equal(boyaDeLaHora(b, "2026-10-09T21:00", "Europe/Lisbon"), true);
  // Salida en Galicia a las 22:00 de Madrid = 20:00 UTC.
  assert.equal(boyaDeLaHora(b, "2026-10-09T22:00", "Europe/Madrid"), true);
  assert.equal(boyaDeLaHora(b, "2026-10-09T23:00", "Europe/Lisbon"), true); // 2 h justas
  assert.equal(boyaDeLaHora(b, "2026-10-10T00:00", "Europe/Lisbon"), false); // 3 h
  // Salida de las 07:00 apuntada por la noche: antes se guardaba la boya de
  // las 21:00 (13-14 h después); ahora, el modelo de las 07:00.
  assert.equal(boyaDeLaHora(b, "2026-10-09T07:00", "Europe/Lisbon"), false);
  // Hora sin zona (formato antiguo de Nazaré) o sin hora: no se usa.
  assert.equal(boyaDeLaHora({ ...b, actualizado: "2026-10-09 21:00" }, "2026-10-09T21:00", "Europe/Lisbon"), false);
  assert.equal(boyaDeLaHora(b, null, "Europe/Lisbon"), false);
  assert.equal(boyaDeLaHora(null, "2026-10-09T21:00", "Europe/Lisbon"), false);
});
