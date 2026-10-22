// Flota pesquera faenando (scripts/flota/flota-ais.mjs): lo puro, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claseEslora, celda, celdaDeFaena, leerMensaje, filasDeFaena, resumenBarco, horaEnPunto, zonasDeFaena, MIN_BARCOS_CELDA } from "../scripts/flota/flota-ais.mjs";

test("clase por eslora (A+B del AIS)", () => {
  assert.equal(claseEslora(10, 8), "<24");
  assert.equal(claseEslora(20, 10), "24-40");
  assert.equal(claseEslora(30, 15), ">40");
  assert.equal(claseEslora(0, 0), "?");
  assert.equal(claseEslora(511, 511), "?");
});

test("celda de 0,05° (~5 km)", () => {
  assert.deepEqual(celda(43.4321, -2.9876), [43.4, -3]);
  assert.deepEqual(celda(43.45, -2.95), [43.45, -2.95]);
});

test("faenando: despacio y con al menos 3 posiciones; amarrado o navegando, no", () => {
  const p = (sog) => ({ lat: 43.6, lon: -3.1, sog });
  assert.deepEqual(celdaDeFaena([p(2.5), p(3), p(2.8)]), [43.6, -3.1]);
  assert.equal(celdaDeFaena([p(0), p(0.1), p(0)]), null);
  assert.equal(celdaDeFaena([p(9), p(10), p(9.5)]), null);
  assert.equal(celdaDeFaena([p(3), p(3)]), null);
  assert.equal(celdaDeFaena([p(102.3), p(102.3), p(102.3)]), null);
});

test("lee los mensajes de aisstream.io", () => {
  assert.deepEqual(leerMensaje({ MessageType: "ShipStaticData", MetaData: { MMSI: 224000001 }, Message: { ShipStaticData: { Type: 30, Dimension: { A: 20, B: 8 } } } }), { mmsi: 224000001, tipo: 30, clase: "24-40" });
  assert.deepEqual(leerMensaje({ MessageType: "PositionReport", MetaData: { MMSI: 224000001 }, Message: { PositionReport: { Latitude: 43.6, Longitude: -3.1, Sog: 3 } } }).pos, { lat: 43.6, lon: -3.1, sog: 3 });
  assert.deepEqual(leerMensaje({ MessageType: "StaticDataReport", MetaData: { MMSI: 2 }, Message: { StaticDataReport: { Valid: true, ReportB: { ShipType: 30, Dimension: { A: 6, B: 4 } } } } }), { mmsi: 2, tipo: 30, clase: "<24" });
});

test("solo pesqueros, sin MMSI en las filas, y la clase de otra escucha sirve", () => {
  const pos = [2, 3, 2.5].map((sog) => ({ lat: 43.61, lon: -3.12, sog }));
  const clave = "k";
  const conocido = resumenBarco(3, clave);
  const { filas, nuevas } = filasDeFaena({
    1: { tipo: 30, clase: ">40", posiciones: pos },
    2: { tipo: 70, clase: ">40", posiciones: pos },
    3: { posiciones: pos },
  }, { [conocido]: "<24" }, clave, "2026-10-20");
  assert.equal(filas.length, 2);
  assert.ok(filas.every((f) => !/^\d+$/.test(f.barco) && f.barco.length === 24));
  assert.deepEqual(filas.map((f) => f.clase).sort(), ["<24", ">40"]);
  assert.equal(nuevas.length, 1);
});

// ---- Fase 2 (2026-10-22): zonas del día para la app ----

test("hora de la escucha: en punto y en UTC, y va en cada fila", () => {
  assert.equal(horaEnPunto(new Date("2026-10-22T10:37:12Z")), "2026-10-22T10:00:00.000Z");
  const pos = [2, 3, 2.5].map((sog) => ({ lat: 43.61, lon: -3.12, sog }));
  const { filas } = filasDeFaena({ 1: { tipo: 30, clase: "<24", posiciones: pos } }, {}, "k", "2026-10-22", "2026-10-22T10:00:00.000Z");
  assert.equal(filas[0].hora, "2026-10-22T10:00:00.000Z");
  assert.equal(filas[0].dia, "2026-10-22");
});

const AHORA = new Date("2026-10-22T12:30:00Z");
const fila = (barco, horasAtras, clase = "<24", lat = 43.6, lon = -3.1) => ({
  hora: new Date(AHORA.getTime() - horasAtras * 3600_000).toISOString(), celda_lat: lat, celda_lon: lon, barco, clase,
});

test("umbral de privacidad: una celda solo sale con 3 barcos DISTINTOS o más", () => {
  assert.equal(MIN_BARCOS_CELDA, 3);
  // 2 barcos, aunque se vean en muchas escuchas: no sale.
  const dos = [fila("a", 1), fila("a", 3), fila("a", 5), fila("b", 1), fila("b", 7)];
  assert.deepEqual(zonasDeFaena(dos, {}, AHORA), []);
  const tres = [...dos, fila("c", 2)];
  const z = zonasDeFaena(tres, {}, AHORA);
  assert.deepEqual(z.map((x) => [x.periodo, x.clase, x.n_barcos]), [["24h", "<24", 3], ["24h", "todas", 3]]);
  assert.ok(z.every((x) => x.n_barcos >= 3));
});

test("nunca devuelve barcos ni horas: solo celda, clase, recuento y especie_probable (null)", () => {
  const z = zonasDeFaena([fila("a", 1), fila("b", 2), fila("c", 3)], {}, AHORA);
  for (const x of z) {
    assert.deepEqual(Object.keys(x).sort(), ["calculado", "celda_lat", "celda_lon", "clase", "especie_probable", "n_barcos", "periodo"]);
    assert.equal(x.especie_probable, null);
    assert.equal(x.calculado, AHORA.toISOString());
  }
});

test("periodos: últimas 24 h y las 24 h anteriores (ayer); lo de más de 48 h y del futuro no cuenta", () => {
  const filas = [
    fila("a", 0.5), fila("b", 10), fila("c", 23.9),        // 24h
    fila("d", 24), fila("e", 30), fila("f", 47.9),         // ayer
    fila("g", 48), fila("h", 60), fila("i", -2),           // fuera
  ];
  const z = zonasDeFaena(filas, {}, AHORA).filter((x) => x.clase === "todas");
  assert.deepEqual(z.map((x) => [x.periodo, x.n_barcos]), [["24h", 3], ["ayer", 3]]);
});

test("cada pez tiene su momento: la celda de ayer no se arrastra a hoy", () => {
  const ayer = ["a", "b", "c", "d"].map((b) => fila(b, 30, "24-40", 43.5, -2.5));
  const hoy = ["e", "f", "g"].map((b) => fila(b, 3, ">40", 43.7, -3.4));
  const z = zonasDeFaena([...ayer, ...hoy], {}, AHORA).filter((x) => x.clase === "todas");
  assert.deepEqual(z.map((x) => [x.periodo, x.celda_lat, x.celda_lon, x.n_barcos]), [["24h", 43.7, -3.4, 3], ["ayer", 43.5, -2.5, 4]]);
});

test("por clase de eslora: la conocida (flota_barcos) manda; '?' solo cuenta en 'todas'", () => {
  const filas = [fila("a", 1, "?"), fila("b", 1, "?"), fila("c", 1, "?"), fila("d", 1, ">40")];
  const z = zonasDeFaena(filas, { a: ">40", b: ">40" }, AHORA);
  assert.deepEqual(z.map((x) => [x.clase, x.n_barcos]), [[">40", 3], ["todas", 4]]);
  assert.ok(!z.some((x) => x.clase === "?"));
});

test("celdas distintas se cuentan aparte (los numéricos de Supabase llegan como texto)", () => {
  const filas = [
    ...["a", "b", "c"].map((b) => ({ ...fila(b, 1), celda_lat: "43.60", celda_lon: "-3.10" })),
    ...["a", "b"].map((b) => fila(b, 2, "<24", 43.65, -3.1)),
  ];
  const z = zonasDeFaena(filas, {}, AHORA).filter((x) => x.clase === "todas");
  assert.deepEqual(z.map((x) => [x.celda_lat, x.celda_lon, x.n_barcos]), [[43.6, -3.1, 3]]);
});

test("workflow cada 2 h (pg_cron + respaldo) y migración de la fase 2 con su baseline", () => {
  const yml = readFileSync(new URL("../.github/workflows/flota-ais.yml", import.meta.url), "utf8");
  assert.match(yml, /cron: "41 \*\/2 \* \* \*"/);
  assert.match(yml, /workflow_dispatch:/);
  assert.match(yml, /saltar/);
  const sql = readFileSync(new URL("../supabase/migrations/20261022120000_flota_zonas_dia.sql", import.meta.url), "utf8");
  assert.match(sql, /check \(n_barcos >= 3\)/);
  assert.match(sql, /primary key \(hora, celda_lat, celda_lon, barco\)/);
  assert.match(sql, /cron\.schedule\('lanzar-flota-ais', '11 \*\/2 \* \* \*'/);
  assert.match(sql, /'publicar-con-veto\.yml', 'flota-ais\.yml'/);
  assert.doesNotMatch(sql, /disable row level security/i);
  // La tabla con los barcos sigue cerrada: ni grant ni policy para anon.
  assert.doesNotMatch(sql, /grant [^;]* on public\.flota_faena/i);
  assert.doesNotMatch(sql, /policy [^;]* on public\.flota_faena/i);
  assert.match(sql, /grant select on public\.flota_zonas to anon, authenticated;/);
  assert.match(sql, /-- anon-ok:/);
  const base = JSON.parse(readFileSync(new URL("../supabase/baseline-seguridad.json", import.meta.url), "utf8"));
  assert.deepEqual(base.tablas.find((t) => t.tablename === "flota_faena"), { tablename: "flota_faena", rls_enabled: true, policies: [] });
  assert.deepEqual(base.tablas.find((t) => t.tablename === "flota_zonas"), {
    tablename: "flota_zonas", rls_enabled: true,
    policies: [{ name: "lectura pública de las zonas de flota faenando", cmd: "r", roles: ["anon", "authenticated"] }],
  });
  assert.match(sql, /create policy "lectura pública de las zonas de flota faenando"/);
});
