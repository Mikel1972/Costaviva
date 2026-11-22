// Alturas de marea sobre el cero del puerto (Puertos del Estado, 2026-11-21).
import { test } from "node:test";
import assert from "node:assert/strict";
import REFS from "../functions/_lib/marea-referencias-datos.js";
import { referenciaMarea, desplazamientoReferencia, MAX_KM_REFERENCIA } from "../functions/_lib/marea-referencia.js";
import { calcularMarea, SPOTS_ES } from "../functions/prevision.js";
import { renderizarPagina } from "../functions/mareas/[slug].js";

test("datos: 33 mareógrafos con nivel medio y cero; Sagunto fuera (su cero no es el del puerto)", () => {
  assert.equal(REFS.length, 33);
  for (const r of REFS) {
    assert.ok(Number.isFinite(r.nmm) && r.nmm > -1 && r.nmm < 4, r.nombre);
    assert.ok(["hidrografico", "puerto"].includes(r.cero), r.nombre);
  }
  assert.ok(!REFS.some((r) => /sagunt/i.test(r.estacion)));
  const bilbao = REFS.find((r) => r.nombre === "Bilbao");
  assert.equal(bilbao.nmm, 2.429); // 2,359 sobre el Cero REDMAR + 0,07 del cero hidrográfico
});

test("mareógrafo más cercano a menos de 60 km", () => {
  const bakio = SPOTS_ES.find((s) => s.slug === "bakio");
  assert.equal(referenciaMarea(bakio.lat, bakio.lon).puerto, "Bilbao");
  const zarautz = SPOTS_ES.find((s) => s.slug === "zarautz");
  assert.equal(referenciaMarea(zarautz.lat, zarautz.lon).puerto, "Pasaia");
  assert.equal(referenciaMarea(-36.8, 174.7), null); // Nueva Zelanda
  assert.equal(MAX_KM_REFERENCIA, 60);
});

test("calcularMarea con referencia: la curva se centra y sube al nivel medio del puerto", () => {
  const horas = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 10, 22, i)).toISOString().slice(0, 16));
  // Anomalía del modelo: media -0,3 m y amplitud 2 m (periodo 12,42 h).
  const alturas = horas.map((_, i) => -0.3 + 2 * Math.cos((2 * Math.PI * i) / 12.42));
  const ref = { puerto: "Bilbao", km: 21, nmm: 2.429, cero: "hidrografico" };
  const m = calcularMarea(horas, alturas, 80, "UTC", ref);
  assert.equal(m.referencia.puerto, "Bilbao");
  assert.equal(m.referencia.fuente, "Puertos del Estado");
  const pl = m.proximas.find((e) => e.tipo === "pleamar");
  const bj = m.proximas.find((e) => e.tipo === "bajamar");
  if (pl) assert.ok(Math.abs(pl.altura - 4.43) < 0.15, `pleamar ${pl.altura}`);
  if (bj) assert.ok(Math.abs(bj.altura - 0.43) < 0.15, `bajamar ${bj.altura}`);
  // Sin referencia, como antes: sobre la bajamar más baja (≈ 0).
  const sin = calcularMarea(horas, alturas, 80, "UTC", null);
  assert.equal(sin.referencia, undefined);
  const bjSin = sin.proximas.find((e) => e.tipo === "bajamar");
  if (bjSin) assert.ok(bjSin.altura < 0.1);
  assert.equal(desplazamientoReferencia([1, 2], ref), null); // pocos datos
});

test("página de mareas: cita a Puertos del Estado con enlace a PORTUS", () => {
  const html = renderizarPagina({ slug: "bakio", nombre: "Bakio", lat: 43.43, lon: -2.81, bloques: [],
    marea: { altura: 2.9, tendencia: "subiendo", coeficiente: 80, proximas: [], referencia: { puerto: "Bilbao", km: 21, cero: "hidrografico", fuente: "Puertos del Estado", url: "https://portus.puertos.es/" } } }, []);
  assert.match(html, /cero del puerto de Bilbao/);
  assert.match(html, /href="https:\/\/portus\.puertos\.es\/"[^>]*>Puertos del Estado</);
});
