// Flota pesquera faenando (scripts/flota/flota-ais.mjs): lo puro, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claseEslora, celda, celdaDeFaena, leerMensaje, filasDeFaena, resumenBarco, horaEnPunto, zonasDeFaena, zonasPorDia, diaMadrid, MIN_BARCOS_CELDA, CLASES_ZONA as CLASES } from "../scripts/flota/flota-ais.mjs";

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
  const filas = [fila("a", 1, "?"), fila("b", 1, "?"), fila("c", 1, "?"), fila("d", 1, ">40"), fila("e", 1, "?"), fila("f", 1, "?"), fila("g", 1, "?")];
  const z = zonasDeFaena(filas, { a: ">40", b: ">40" }, AHORA);
  assert.deepEqual(z.map((x) => [x.clase, x.n_barcos]), [[">40", 3], ["todas", 7]]);
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

test("contra la resta: una clase no sale si 'todas' menos ella deja 1 o 2 barcos", () => {
  const celda = (clases) => clases.map(([b, c]) => fila(b, 1, c));
  const clasesDe = (filas) => zonasDeFaena(filas, {}, AHORA).map((x) => [x.clase, x.n_barcos]);
  // todas 4, <24 3 -> delataría 1 barco de otra eslora: solo "todas".
  assert.deepEqual(clasesDe(celda([["a", "<24"], ["b", "<24"], ["c", "<24"], ["d", ">40"]])), [["todas", 4]]);
  // todas 5, <24 3 -> resto 2: solo "todas".
  assert.deepEqual(clasesDe(celda([["a", "<24"], ["b", "<24"], ["c", "<24"], ["d", ">40"], ["e", "?"]])), [["todas", 5]]);
  // todas 3, <24 3 -> resto 0: sale.
  assert.deepEqual(clasesDe(celda([["a", "<24"], ["b", "<24"], ["c", "<24"]])), [["<24", 3], ["todas", 3]]);
  // todas 6, <24 3 y >40 3 -> restos 3 y 0: salen las dos.
  assert.deepEqual(clasesDe(celda([["a", "<24"], ["b", "<24"], ["c", "<24"], ["d", ">40"], ["e", ">40"], ["f", ">40"]])),
    [["<24", 3], [">40", 3], ["todas", 6]]);
  // todas 7, <24 3 y 24-40 3: cada una deja 4, pero juntas dejan 1 -> se quita una.
  const z = clasesDe(celda([["a", "<24"], ["b", "<24"], ["c", "<24"], ["d", "24-40"], ["e", "24-40"], ["f", "24-40"], ["g", "?"]]));
  assert.equal(z.length, 2);
  assert.deepEqual(z.at(-1), ["todas", 7]);
  // Propiedad: en cualquier celda publicada, "todas" menos lo publicado por clases es 0 o >= 3.
  for (const [tot, ...cls] of [[7, 3, 3], [9, 3, 3, 3], [8, 5, 3], [10, 4, 4, 1]]) {
    const filas = [];
    let i = 0;
    cls.forEach((n, k) => { for (let j = 0; j < n; j++) filas.push(fila(`b${i++}`, 1, CLASES[k])); });
    while (i < tot) filas.push(fila(`b${i++}`, 1, "?"));
    const zs = zonasDeFaena(filas, {}, AHORA);
    const total = zs.find((x) => x.clase === "todas").n_barcos;
    const resto = total - zs.filter((x) => x.clase !== "todas").reduce((s, x) => s + x.n_barcos, 0);
    assert.ok(resto === 0 || resto >= 3, `${tot}/${cls}: resto ${resto}`);
    for (const x of zs.filter((x) => x.clase !== "todas")) assert.ok(total - x.n_barcos === 0 || total - x.n_barcos >= 3);
  }
});

// ---- Histórico diario para el ▶️ de 14 días (2026-10-23) ----

test("histórico: días de Madrid (hoy y ayer), cada día suelto, mismo umbral y regla contra la resta", () => {
  // 22:30 UTC del 22 = 00:30 del 23 en Madrid.
  const ahora = new Date("2026-10-22T22:30:00Z");
  assert.equal(diaMadrid(ahora), "2026-10-23");
  const f = (barco, iso, clase = "<24", lat = 43.6) => ({ hora: iso, celda_lat: lat, celda_lon: -3.1, barco, clase });
  const filas = [
    // 22:00 UTC = 00:00 del 23 en Madrid -> hoy
    f("a", "2026-10-22T22:00:00Z"), f("b", "2026-10-22T22:00:00Z"), f("c", "2026-10-22T22:00:00Z"),
    // 21:00 UTC = 23:00 del 22 en Madrid -> ayer (aunque en UTC sea el mismo día)
    f("d", "2026-10-22T21:00:00Z", ">40", 43.5), f("e", "2026-10-22T03:00:00Z", ">40", 43.5), f("g", "2026-10-21T23:00:00Z", ">40", 43.5),
    f("h", "2026-10-22T10:00:00Z", "<24", 43.5),
    // 21 de Madrid: ni hoy ni ayer -> fuera
    f("x", "2026-10-21T20:00:00Z"), f("y", "2026-10-21T20:00:00Z"), f("z", "2026-10-21T20:00:00Z"),
  ];
  const { dias, zonas } = zonasPorDia(filas, {}, ahora);
  assert.deepEqual(dias, ["2026-10-22", "2026-10-23"]);
  assert.deepEqual(zonas.map((z) => [z.dia, z.celda_lat, z.clase, z.n_barcos]), [
    ["2026-10-22", 43.5, "todas", 4],             // >40 = 3 dejaría 1 de <24: no sale
    ["2026-10-23", 43.6, "<24", 3],
    ["2026-10-23", 43.6, "todas", 3],
  ]);
  for (const z of zonas) {
    assert.deepEqual(Object.keys(z).sort(), ["calculado", "celda_lat", "celda_lon", "clase", "dia", "especie_probable", "n_barcos"]);
    assert.ok(z.n_barcos >= 3);
  }
  // Un barco visto en varias escuchas del mismo día cuenta una vez.
  const rep = zonasPorDia([f("a", "2026-10-22T22:00:00Z"), f("a", "2026-10-22T22:10:00Z"), f("b", "2026-10-22T22:00:00Z")], {}, ahora);
  assert.deepEqual(rep.zonas, []);
});

test("histórico: migración de flota_zonas_dia (lectura pública, sin escritura) y su baseline", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261023100000_flota_zonas_historico.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.flota_zonas_dia/);
  assert.match(sql, /check \(n_barcos >= 3\)/);
  assert.match(sql, /primary key \(dia, celda_lat, celda_lon, clase\)/);
  assert.match(sql, /grant select on public\.flota_zonas_dia to anon, authenticated;/);
  assert.match(sql, /-- anon-ok:/);
  assert.doesNotMatch(sql, /for (insert|update|delete|all)/i);
  assert.doesNotMatch(sql, /security definer/i);
  const base = JSON.parse(readFileSync(new URL("../supabase/baseline-seguridad.json", import.meta.url), "utf8"));
  assert.deepEqual(base.tablas.find((t) => t.tablename === "flota_zonas_dia"), {
    tablename: "flota_zonas_dia", rls_enabled: true,
    policies: [{ name: "lectura pública del histórico de zonas de flota", cmd: "r", roles: ["anon", "authenticated"] }],
  });
  const robot = readFileSync(new URL("../scripts/flota/flota-ais.mjs", import.meta.url), "utf8");
  assert.match(robot, /flota_zonas_dia\?dia=lt\.\$\{corte\}/, "borra lo de más de 60 días");
});
