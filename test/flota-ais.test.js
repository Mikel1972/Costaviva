// Flota pesquera faenando (scripts/flota/flota-ais.mjs): lo puro, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claseEslora, celda, celdaDeFaena, leerMensaje, filasDeFaena, resumenBarco, horaEnPunto, zonasDeFaena, zonasPorDia, diaMadrid, posicionParado, puertoCercano, distanciaKm, cargarPuertos, paradosDeEscucha, grupoTipo, diagnosticoTipos, probablesDeEscucha, KM_PROBABLE_PUERTO, posicionNavegando, navegandoDeEscucha, PASO_MAR, CAJA, MIN_BARCOS_CELDA, CLASES_ZONA as CLASES } from "../scripts/flota/flota-ais.mjs";

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

// ---- Flota parada (2026-10-23) ----

test("parado: al menos 3 posiciones con velocidad mediana < 0,5 nudos", () => {
  const p = (sog, lat = 43.322, lon = -2.418) => ({ lat, lon, sog });
  assert.deepEqual(posicionParado([p(0), p(0.1), p(0.2)]), [43.322, -2.418]);
  assert.equal(posicionParado([p(0), p(0.1)]), null, "pocas posiciones");
  assert.equal(posicionParado([p(2), p(3), p(0)]), null, "faenando no es parado");
  assert.equal(posicionParado([p(0.5), p(0.6), p(0.5)]), null, "0,5 ya no cuenta");
  assert.equal(posicionParado([p(102.3), p(102.3), p(102.3)]), null, "velocidad no disponible");
});

test("puertos: los de puertos.json + las lonxas de Galicia, todos dentro de la caja del AIS y aproximados", () => {
  const json = JSON.parse(readFileSync(new URL("../scripts/flota/puertos.json", import.meta.url), "utf8"));
  assert.equal(json.aproximado, true);
  assert.match(json._nota, /APROXIMADAS/);
  const ps = cargarPuertos();
  assert.ok(ps.length >= 80);
  assert.equal(new Set(ps.map((x) => x.id)).size, ps.length, "ids únicos");
  for (const x of ps) {
    assert.match(x.id, /^[a-z0-9-]+$/, x.id);
    assert.ok(x.lat >= CAJA[0][0] && x.lat <= CAJA[1][0] && x.lon >= CAJA[0][1] && x.lon <= CAJA[1][1], `${x.nombre} fuera de la caja`);
    assert.ok(!/\.$/.test(x.nombre), x.nombre);
  }
  for (const n of ["Ondarroa", "Bermeo", "Pasaia", "Santoña", "Avilés", "Burela", "Celeiro", "Ribeira"]) assert.ok(ps.some((x) => x.nombre === n), n);
});

test("puerto cercano: el más próximo a menos de 2 km; lejos, ninguno", () => {
  const ps = cargarPuertos();
  assert.ok(Math.abs(distanciaKm(43.3, -2.4, 43.3, -2.4)) < 1e-9);
  assert.ok(Math.abs(distanciaKm(43.3, -2.4, 43.309, -2.4) - 1.0) < 0.01);
  assert.equal(puertoCercano(43.323, -2.419, ps).nombre, "Ondarroa");
  assert.equal(puertoCercano(43.309, -2.383, ps).nombre, "Mutriku", "a 3 km de Ondarroa: el más cercano");
  assert.equal(puertoCercano(43.6, -2.6, ps), null, "en mar abierto");
});

test("flota parada: por puerto o celda del mar, barcos distintos, solo >= 3 y sin barcos en las filas", () => {
  const clave = "k";
  const parado = (lat, lon) => ({ tipo: 30, posiciones: [0, 0.1, 0].map((sog) => ({ lat, lon, sog })) });
  const barcos = {
    1: parado(43.322, -2.418), 2: parado(43.323, -2.417), 3: parado(43.321, -2.419), 4: parado(43.322, -2.418), // Ondarroa: 4
    5: parado(43.42, -2.721), 6: parado(43.42, -2.72),                                                           // Bermeo: 2 -> no
    7: parado(43.61, -2.81), 8: parado(43.62, -2.82), 9: parado(43.63, -2.83),                                   // mar: 3
    10: { tipo: 70, posiciones: parado(43.322, -2.418).posiciones },                                              // mercante: no
    11: { tipo: 30, posiciones: [3, 3, 2].map((sog) => ({ lat: 43.322, lon: -2.418, sog })) },                    // faenando: no
  };
  const filas = paradosDeEscucha(barcos, {}, clave, cargarPuertos(), "2026-10-23T08:20:00.000Z");
  assert.deepEqual(filas, [
    { clave: "mar:43.60,-2.85", tipo: "mar", puerto: null, lat: 43.6, lon: -2.85, n_barcos: 3, escucha: "2026-10-23T08:20:00.000Z" },
    { clave: "puerto:ondarroa", tipo: "puerto", puerto: "Ondarroa", lat: 43.322, lon: -2.418, n_barcos: 4, escucha: "2026-10-23T08:20:00.000Z" },
  ]);
  // Un pesquero conocido de otra escucha (sin mensaje estático ahora) también cuenta.
  const conocido = resumenBarco(12, clave);
  const mas = paradosDeEscucha({ ...barcos, 12: { posiciones: parado(43.42, -2.72).posiciones }, 13: parado(43.42, -2.72) }, { [conocido]: "<24" }, clave, cargarPuertos(), "x");
  assert.equal(mas.find((f) => f.clave === "puerto:bermeo")?.n_barcos, 4);
});

test("flota parada: migración (lectura pública, sin escritura) y baseline", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261023130000_flota_parados.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.flota_parados/);
  assert.match(sql, /check \(n_barcos >= 3\)/);
  assert.match(sql, /grant select on public\.flota_parados to anon, authenticated;/);
  assert.match(sql, /-- anon-ok:/);
  assert.doesNotMatch(sql, /for (insert|update|delete|all)/i);
  assert.doesNotMatch(sql, /security definer/i);
  // Las claves que escribe el robot cumplen el CHECK de la tabla.
  const re = /^(puerto:[a-z0-9-]+|mar:-?[0-9]+\.[0-9]{2},-?[0-9]+\.[0-9]{2})$/;
  assert.ok(sql.includes(`'${re.source}'`), "el CHECK de la clave es esta misma expresión");
  for (const k of ["puerto:ondarroa", "puerto:gal-12", "mar:43.60,-2.85", "mar:42.05,-10.00"]) assert.match(k, re);
  const base = JSON.parse(readFileSync(new URL("../supabase/baseline-seguridad.json", import.meta.url), "utf8"));
  assert.deepEqual(base.tablas.find((t) => t.tablename === "flota_parados"), {
    tablename: "flota_parados", rls_enabled: true,
    policies: [{ name: "lectura pública de la flota parada", cmd: "r", roles: ["anon", "authenticated"] }],
  });
});

// ---- Pesqueros en el mar en movimiento (2026-10-23) ----

test("navegando: velocidad mediana >= 0,5 nudos, una posición basta, la última", () => {
  const p = (sog, lat = 43.6, lon = -2.8) => ({ lat, lon, sog });
  assert.deepEqual(posicionNavegando([p(8)]), [43.6, -2.8]);
  assert.deepEqual(posicionNavegando([p(3, 43.6), p(3, 43.7), p(4, 43.8)]), [43.8, -2.8], "la última posición");
  assert.equal(posicionNavegando([p(0), p(0.1), p(9)]), null, "parado");
  assert.equal(posicionNavegando([]), null);
  assert.equal(posicionNavegando([p(102.3)]), null, "velocidad no disponible");
});

test("pesqueros en el mar: lejos de puerto, celda de 0,1°, barcos distintos, solo >= 3, sin solaparse con los parados", () => {
  const clave = "k";
  const mueve = (lat, lon, sog = 8) => ({ tipo: 30, posiciones: [{ lat, lon, sog }] });
  const barcos = {
    1: mueve(43.61, -2.81), 2: mueve(43.65, -2.85), 3: mueve(43.69, -2.89, 3),   // celda 43.60,-2.90: 3
    4: mueve(43.91, -2.81), 5: mueve(43.95, -2.85),                              // 2 -> no
    6: mueve(43.322, -2.418), 7: mueve(43.323, -2.417), 8: mueve(43.321, -2.419), // en Ondarroa: no
    9: { tipo: 70, posiciones: mueve(43.62, -2.82).posiciones },                  // mercante: no
    10: { tipo: 30, posiciones: [0, 0, 0.1].map((sog) => ({ lat: 43.62, lon: -2.82, sog })) }, // parado: no
  };
  assert.equal(PASO_MAR, 0.1);
  const filas = navegandoDeEscucha(barcos, {}, clave, cargarPuertos(), "2026-10-23T14:00:00.000Z");
  assert.deepEqual(filas, [
    { clave: "nav:43.60,-2.90", tipo: "navegando", puerto: null, lat: 43.6, lon: -2.9, n_barcos: 3, escucha: "2026-10-23T14:00:00.000Z" },
  ]);
  const re = /^(puerto:[a-z0-9-]+|(mar|nav):-?[0-9]+\.[0-9]{2},-?[0-9]+\.[0-9]{2})$/;
  const sql = readFileSync(new URL("../supabase/migrations/20261023160000_flota_navegando.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`'${re.source}'`), "el CHECK nuevo de la clave es esta misma expresión");
  assert.match(sql, /check \(tipo in \('puerto', 'mar', 'navegando'\)\)/);
  assert.doesNotMatch(sql, /policy|grant|security definer/i, "ni policies ni permisos nuevos");
  for (const k of ["nav:43.60,-2.90", "mar:43.60,-2.85", "puerto:ondarroa"]) assert.match(k, re);
});

test("escucha de 40 min por defecto (workflow y script)", () => {
  const yml = readFileSync(new URL("../.github/workflows/flota-ais.yml", import.meta.url), "utf8");
  const js = readFileSync(new URL("../scripts/flota/flota-ais.mjs", import.meta.url), "utf8");
  assert.match(yml, /default: "40"/);
  assert.match(yml, /minutos \|\| '40'/);
  assert.match(yml, /timeout-minutes: 60/);
  assert.match(js, /: 40;/);
});

test("diagnóstico de tipos AIS: solo totales y los sin tipo que van a velocidad de faena", () => {
  assert.equal(grupoTipo(undefined), "sin_tipo");
  assert.equal(grupoTipo(0), "sin_tipo");
  assert.equal(grupoTipo(30), "pesquero");
  assert.equal(grupoTipo(37), "recreo");
  assert.equal(grupoTipo(71), "carga");
  const faena = [3, 3, 2].map((sog) => ({ lat: 43.9, lon: -2.5, sog }));
  const rapido = [12, 12, 12].map((sog) => ({ lat: 43.9, lon: -2.5, sog }));
  const d = diagnosticoTipos({ 1: { posiciones: faena }, 2: { tipo: 0, posiciones: rapido }, 3: { tipo: 30, posiciones: faena }, 4: { tipo: 70, posiciones: rapido }, 5: { posiciones: faena } }, { [resumenBarco(5, "k")]: "<24" }, "k");
  assert.deepEqual(d, { porGrupo: { sin_tipo: 2, pesquero: 2, carga: 1 }, sinTipoFaena: 1 });
});

test("pesqueros probables (en pruebas): sin tipo, a velocidad de faena y lejos de puerto", () => {
  const faena = (lat, lon) => [3, 3, 2].map((sog) => ({ lat, lon, sog }));
  const barcos = {
    1: { tipo: 30, posiciones: faena(43.91, -2.51) }, 2: { tipo: 30, posiciones: faena(43.92, -2.52) }, // declarados en la celda
    3: { posiciones: faena(43.93, -2.53) },                       // sin tipo, mar adentro: probable
    4: { tipo: 0, posiciones: faena(43.322, -2.418) },            // sin tipo, en Ondarroa: no
    5: { tipo: 37, posiciones: faena(43.91, -2.51) },             // recreo: no
    6: { posiciones: [12, 12, 12].map((sog) => ({ lat: 43.9, lon: -2.5, sog })) }, // navegando rápido: no
  };
  assert.equal(KM_PROBABLE_PUERTO, 10);
  assert.deepEqual(probablesDeEscucha(barcos, {}, "k", cargarPuertos()), { probables: 1, celdasDeclarados: 0, celdasConProbables: 1 });
});
