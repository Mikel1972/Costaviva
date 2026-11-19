// Regla de vecinos de la ola en la orilla (functions/_lib/coherencia-vecinos.js, 2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { revisarVecinos, daOrilla, MARGEN } from "../functions/_lib/coherencia-vecinos.js";

const spot = (slug, lat, lon, max, extra = {}) => ({
  slug, lat, lon, zonaOleaje: { tipo: "abierta", orilla: { camara: slug } },
  bloques: [{ horaISO: "2026-11-19T21:00", altura: [+(max * 0.8).toFixed(1), max] }], ...extra,
});

test("Bakio no puede dar 2,9 si Sopelana da 1,6 y Lekeitio 2,1 (Mikel, 2026-11-19): se recorta y avisa", () => {
  const r = revisarVecinos([
    spot("sopelana", 43.388, -2.998, 1.6), spot("bakio", 43.43, -2.81, 2.9),
    spot("lekeitio", 43.365, -2.509, 2.1), spot("mundaka", 43.405, -2.699, 1.7),
  ]);
  const bakio = r.spots.find((s) => s.slug === "bakio").bloques[0];
  // Mediana de Sopelana, Lekeitio y Mundaka = 1,7 → tope 1,3 × 1,7 ≈ 2,2.
  assert.ok(bakio.altura[1] <= MARGEN * 1.7 + 0.05, JSON.stringify(bakio));
  assert.deepEqual(bakio.revisadoVecinos.antes, [2.3, 2.9]);
  assert.deepEqual(r.avisos.map((a) => [a.slug, a.tipo]), [["bakio", "alto"]]);
  // Los demás, sin tocar.
  assert.equal(r.spots.find((s) => s.slug === "sopelana").bloques[0].altura[1], 1.6);
});

test("solo hacia arriba, solo con vecinos que dan orilla y con al menos 2", () => {
  // Un spot abrigado más bajo que sus vecinos no avisa.
  const abrigado = (sl, la, lo, m) => ({ ...spot(sl, la, lo, m), zonaOleaje: { tipo: "abrigada" } });
  const bajo = revisarVecinos([abrigado("a", 43.4, -2.9, 0.4), spot("b", 43.41, -2.95, 1.6), spot("c", 43.42, -2.85, 1.8), spot("d", 43.43, -2.8, 1.7)]);
  assert.equal(bajo.avisos.length, 0);
  // Un vecino con mar abierto (sin orilla) no cuenta: con uno solo no se compara.
  const abierto = { slug: "mar", lat: 43.41, lon: -2.95, bloques: [{ horaISO: "2026-11-19T21:00", altura: [4, 5] }] };
  assert.equal(daOrilla(abierto), false);
  const r = revisarVecinos([spot("x", 43.4, -2.9, 3), abierto, spot("y", 43.42, -2.85, 1)]);
  assert.equal(r.avisos.length, 0);
  // Lejos (> 40 km) no es vecino.
  assert.equal(revisarVecinos([spot("p", 43.4, -2.9, 3), spot("q", 43.4, -1.5, 1), spot("r", 43.4, -1.6, 1)]).avisos.length, 0);
});

test("dos spots altos juntos no se tapan: se compara con la mediana, no con el máximo", () => {
  const r = revisarVecinos([
    spot("bakio", 43.43, -2.81, 2.9), spot("plentzia", 43.405, -2.944, 3.2),
    spot("sopelana", 43.388, -2.998, 1.6), spot("getxo", 43.35, -3.01, 1.3), spot("mundaka", 43.405, -2.699, 1.7),
  ]);
  // Plentzia, la más alta de todas, se recorta (no por debajo de Bakio, su
  // vecino real más alto); Bakio queda por debajo de Plentzia y no se toca.
  const altos = r.avisos.filter((a) => a.tipo === "alto").map((a) => a.slug);
  assert.deepEqual(altos, ["plentzia"]);
  assert.equal(r.spots.find((s) => s.slug === "plentzia").bloques[0].altura[1], 2.9);
});

test("sin historia, nada hacia abajo: una bahía puede dar mucho menos (Mikel, 2026-11-19)", () => {
  const r = revisarVecinos([spot("deba", 43.3, -2.35, 0.6), spot("zumaia", 43.3, -2.25, 1.8), spot("zarautz", 43.29, -2.17, 1.6), spot("getaria", 43.3, -2.2, 1.7)]);
  assert.equal(r.avisos.filter((a) => a.slug === "deba").length, 0);
});

test("con historia: la relación aprendida entre cámaras manda (bahía que siempre da el 40 %)", async () => {
  const { aprenderRelaciones, relacionEsperada } = await import("../functions/_lib/coherencia-vecinos.js");
  const camaras = { bahia: { lat: 43.37, lon: -1.79 }, playa: { lat: 43.29, lon: -2.17 } };
  const verdades = [];
  for (let i = 0; i < 12; i++) {
    const fecha = new Date(Date.UTC(2026, 10, 1 + i, 10)).toISOString();
    verdades.push({ camara: "bahia", fecha, altura: 0.6, hs: 4 }, { camara: "playa", fecha, altura: 1.5, hs: 4 });
  }
  const rel = aprenderRelaciones(verdades, camaras);
  const e = relacionEsperada(rel, "bahia", "playa", "grande");
  assert.ok(Math.abs(Math.exp(e.log) - 0.4) < 0.01);
  assert.equal(relacionEsperada(rel, "bahia", "playa", "pequeno"), null);
  const camaraDe = (slug) => slug;
  const mk = (slug, lat, lon, max) => ({ ...spot(slug, lat, lon, max), bloques: [{ horaISO: "2026-11-19T21:00", altura: [max * 0.8, max], alturaMarAbierto: [4, 5] }] });
  // Lo normal (0,6 frente a 1,5): sin aviso.
  assert.equal(revisarVecinos([mk("bahia", 43.37, -1.79, 0.6), mk("playa", 43.29, -2.17, 1.5)], { relaciones: rel, camaraDe }).avisos.length, 0);
  // La bahía da hoy tanto como la playa: no cuadra con su historia → recorte.
  const r = revisarVecinos([mk("bahia", 43.37, -1.79, 1.5), mk("playa", 43.29, -2.17, 1.5)], { relaciones: rel, camaraDe });
  const a = r.avisos.find((x) => x.slug === "bahia");
  assert.equal(a.tipo, "alto");
  assert.equal(a.base, "historico");
  assert.ok(r.spots.find((s) => s.slug === "bahia").bloques[0].altura[1] < 1.5);
  // Y la playa, vista desde la bahía, sale "bajo": solo aviso, sin tocar.
  const p = r.avisos.find((x) => x.slug === "playa");
  assert.equal(p.tipo, "bajo");
  assert.equal(r.spots.find((s) => s.slug === "playa").bloques[0].altura[1], 1.5);
});
