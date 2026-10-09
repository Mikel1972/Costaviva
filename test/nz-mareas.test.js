// Mareas de Nueva Zelanda con LINZ (fase 1 de NZ, 2026-10-09). Sin red:
// tablas reales de LINZ de 2026 de tres puertos (Auckland, Leigh y
// Lyttelton) y la tabla de secundarios 2026-27 en test/fixtures/linz/, más
// los datos ya generados en datos/nz/. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsearTablaLinz, parsearSecundariosLinz, comprimirEventos, descomprimirEventos, derivarSecundario,
  alturaEn, coeficientePleamar, coeficienteDia, mareaSpotNZ, asignarPuerto, eventosTabla, localAUtc,
  etiquetaLocal, ATRIBUCION_LINZ,
} from "../functions/_lib/nz/mareas-linz.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { urlsTablas, casarTablas, normalizar } from "../scripts/fuentes/linz-mareas.mjs";
import { armarGeojson, LIMITE_BYTES } from "../scripts/fuentes/doc-reservas-marinas.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const json = (r) => JSON.parse(leer(r));
const H = 3600 * 1000;
const MIN = 60000;

const auckland = parsearTablaLinz(leer("test/fixtures/linz/auckland-2026.csv"));
const leigh = parsearTablaLinz(leer("test/fixtures/linz/leigh-2026.csv"));
const lyttelton = parsearTablaLinz(leer("test/fixtures/linz/lyttelton-2026.csv"));
const sec = parsearSecundariosLinz(leer("test/fixtures/linz/secundarios-2026-27.csv"));
const iso = (t) => new Date(t).toISOString().slice(0, 16);
const mediana = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

test("tabla LINZ de Auckland 2026: cabecera, número de mareas y paso a UTC", () => {
  assert.equal(auckland.estacion, "070");
  assert.equal(auckland.nombre, "Auckland");
  assert.ok(Math.abs(auckland.lat + 36.85) < 0.01 && Math.abs(auckland.lon - 174.7667) < 0.01);
  assert.ok(auckland.eventos.length > 1400 && auckland.eventos.length < 1420, `${auckland.eventos.length}`);
  // 1 de enero, 05:47 NZDT (+13) = 31 de diciembre 16:47 UTC, pleamar de 3,1 m.
  assert.deepEqual(auckland.eventos[0], { t: Date.parse("2025-12-31T16:47:00Z"), h: 3.1, tipo: "pleamar" });
  assert.equal(auckland.eventos[1].tipo, "bajamar");
  // Cambio de hora del 5 de abril de 2026: el 4 aún +13, el 5 ya +12.
  assert.ok(auckland.eventos.some((e) => iso(e.t) === "2026-04-03T14:32" && e.h === 0.8)); // 4 abr 03:32
  assert.ok(auckland.eventos.some((e) => iso(e.t) === "2026-04-04T15:11" && e.h === 0.8)); // 5 abr 03:11
  // Pleamar y bajamar siempre alternas, y en orden.
  for (let i = 1; i < auckland.eventos.length; i++) {
    assert.notEqual(auckland.eventos[i].tipo, auckland.eventos[i - 1].tipo, iso(auckland.eventos[i].t));
    assert.ok(auckland.eventos[i].t > auckland.eventos[i - 1].t);
  }
});

test("hora local de NZ a UTC en los dos cambios de hora", () => {
  assert.equal(iso(localAUtc(2026, 7, 1, 12, 0)), "2026-07-01T00:00"); // invierno, +12
  assert.equal(iso(localAUtc(2026, 1, 15, 12, 0)), "2026-01-14T23:00"); // verano, +13
  assert.equal(iso(localAUtc(2026, 9, 27, 4, 0)), "2026-09-26T15:00"); // tras empezar el horario de verano
  assert.equal(etiquetaLocal(Date.parse("2026-10-08T23:30:00Z")), "2026-10-09T12:30");
});

test("puertos secundarios: bloques por puerto estándar y diferencias", () => {
  assert.ok(Object.keys(sec).length > 300);
  assert.equal(sec["6400"].estandar, null);
  assert.equal(sec["6400"].msl, 1.94);
  assert.deepEqual(
    { e: sec["6396b"].estandar, p: sec["6396b"].dif_pleamar_min, b: sec["6396b"].dif_bajamar_min, mhws: sec["6396b"].mhws, mlws: sec["6396b"].mlws, msl: sec["6396b"].msl, r: sec["6396b"].razon },
    { e: "6400", p: -12, b: -1, mhws: 2.5, mlws: 0.3, msl: 1.4, r: 0.79 }
  );
  assert.equal(sec["6386b"].estandar, "6366"); // Cape Reinga se refiere a Port Taranaki
  assert.equal(sec["6386b"].dif_pleamar_min, -94);
  assert.equal(sec["6402"].razon, null); // Maraetai: sin datos de altura ("-")
  assert.equal(sec["6402"].aproximado, true);
  assert.equal(sec["6490f"].estandar, "6490"); // Akaroa, de Lyttelton
});

test("secundario calculado (Leigh desde Auckland) frente a la tabla propia de LINZ", () => {
  const der = derivarSecundario(auckland.eventos, sec["6396b"], sec["6400"]);
  assert.equal(der.length, auckland.eventos.length);
  const dt = [];
  const dh = [];
  for (const e of der) {
    const real = leigh.eventos.filter((x) => x.tipo === e.tipo).reduce((b, x) => (Math.abs(x.t - e.t) < Math.abs(b.t - e.t) ? x : b));
    dt.push(Math.abs(real.t - e.t) / MIN);
    dh.push(Math.abs(real.h - e.h));
  }
  assert.ok(mediana(dt) <= 10 && p95(dt) <= 20, `hora: mediana ${mediana(dt)} p95 ${p95(dt)} min`);
  assert.ok(mediana(dh) <= 0.1 && p95(dh) <= 0.25, `altura: mediana ${mediana(dh)} p95 ${p95(dh)} m`);
});

test("formato compacto: ida y vuelta sin perder nada", () => {
  const c = comprimirEventos(lyttelton.eventos);
  assert.equal(c.d.length, lyttelton.eventos.length * 2);
  assert.deepEqual(descomprimirEventos(c), lyttelton.eventos);
  assert.deepEqual(descomprimirEventos({ t0: null, d: [] }), []);
});

test("altura entre mareas: coseno entre los dos extremos", () => {
  const [a, b] = auckland.eventos;
  assert.equal(alturaEn(auckland.eventos, a.t), a.h);
  assert.ok(Math.abs(alturaEn(auckland.eventos, (a.t + b.t) / 2) - (a.h + b.h) / 2) < 1e-9);
  const cuarto = alturaEn(auckland.eventos, a.t + (b.t - a.t) / 4);
  assert.ok(cuarto < a.h && cuarto > (a.h + b.h) / 2); // baja despacio al principio
  assert.equal(alturaEn(auckland.eventos, a.t - H), null);
});

test("coeficiente propio: 100 = marea viva media del puerto, vivas > muertas", () => {
  const k = sec["6400"]; // MHWS 3,3 / MLWS 0,5
  const coefs = auckland.eventos.map((_, i) => coeficientePleamar(auckland.eventos, i, k)).filter((c) => c !== null);
  assert.ok(coefs.length > 700);
  assert.ok(coefs.every((c) => c >= 20 && c <= 120));
  const m = mediana(coefs);
  assert.ok(m >= 70 && m <= 90, `mediana ${m}`);
  // Luna llena el 3-1-2026 (con perigeo): vivas fuertes el 4-7; cuarto
  // menguante el 10-1: muertas el 13-16.
  const vivas = coeficienteDia(auckland.eventos, "2026-01-05", k);
  const muertas = coeficienteDia(auckland.eventos, "2026-01-14", k);
  assert.ok(vivas >= 100 && muertas <= 65 && vivas - muertas >= 35, `vivas ${vivas}, muertas ${muertas}`);
  assert.equal(coeficientePleamar(auckland.eventos, 0, { mhws: null, mlws: null }), null);
});

test("marea de un spot: misma forma que la de España más puerto, fuente y aviso", () => {
  const anios = [{ puertos: { Lyttelton: comprimirEventos(lyttelton.eventos) } }];
  const catalogo = { secundarios: sec, tablas: {} };
  const spot = { slug: "nz-x", lat: -43.6, lon: 172.72, tz: "Pacific/Auckland", puerto_linz: { id: "6490", nombre: "Lyttelton", km: 0.4, tabla: "Lyttelton" } };
  const ahora = Date.parse("2026-03-10T02:00:00Z");
  const m = mareaSpotNZ(spot, catalogo, anios, ahora);
  assert.ok(m.altura > 0 && m.altura < 3);
  assert.ok(["subiendo", "bajando"].includes(m.tendencia));
  assert.equal(m.proximas.length, 2);
  assert.notEqual(m.proximas[0].tipo, m.proximas[1].tipo);
  assert.equal(m.tendencia, m.proximas[0].tipo === "pleamar" ? "subiendo" : "bajando");
  assert.match(m.proximas[0].hora, /^\d{2}:\d{2}$/);
  assert.ok(m.coeficiente >= 20 && m.coeficiente <= 120);
  assert.equal(m.puerto.metodo, "tabla");
  assert.equal(m.atribucion, ATRIBUCION_LINZ);
  assert.match(m.atribucion, /Land Information New Zealand.*CC BY 4\.0/);
  assert.match(m.aviso, /Maritime Rules Part 25/);
  // Secundario (Akaroa desde Lyttelton) y sin datos.
  const akaroa = { ...spot, puerto_linz: { id: "6490f", nombre: "Akaroa", km: 0.5, tabla: null } };
  sec["6490"].tabla = "Lyttelton";
  const ma = mareaSpotNZ(akaroa, catalogo, anios, ahora);
  assert.equal(ma.puerto.metodo, "secundario");
  assert.ok(Math.abs(ma.altura - m.altura) < 1);
  delete sec["6490"].tabla;
  assert.equal(mareaSpotNZ(spot, catalogo, [], ahora), null);
});

// ---------------------------------------------------------------------------
// Datos generados por scripts/fuentes/linz-mareas.mjs (datos/nz/)
// ---------------------------------------------------------------------------
const catalogo = json("datos/nz/linz-puertos.json");
const anios = [json("datos/nz/linz-mareas-2026.json"), json("datos/nz/linz-mareas-2027.json")];

test("datos/nz: el puerto de cada spot sigue siendo el que elige asignarPuerto()", () => {
  assert.equal(SPOTS_NZ.length, 60);
  for (const s of SPOTS_NZ) {
    assert.deepEqual(s.puerto_linz, asignarPuerto(s, catalogo), s.slug);
    assert.ok(s.puerto_linz.km < 20, `${s.slug} a ${s.puerto_linz.km} km de su puerto`);
    assert.deepEqual(catalogo.spots[s.slug], s.puerto_linz, `${s.slug} en linz-puertos.json`);
  }
});

test("datos/nz: los 60 spots tienen marea en 2026 y 2027, con atribución", () => {
  for (const a of anios) {
    assert.equal(a.atribucion, ATRIBUCION_LINZ);
    assert.match(a.licencia, /CC BY 4\.0/);
  }
  for (const ahora of [Date.parse("2026-10-09T00:00:00Z"), Date.parse("2027-06-15T12:00:00Z")]) {
    for (const s of SPOTS_NZ) {
      const m = mareaSpotNZ(s, catalogo, anios, ahora);
      assert.ok(m, `${s.slug} sin marea ${iso(ahora)}`);
      assert.ok(m.altura > -0.5 && m.altura < 6, `${s.slug} altura ${m.altura}`);
      assert.ok(m.coeficiente === null || (m.coeficiente >= 20 && m.coeficiente <= 120), `${s.slug} coef ${m.coeficiente}`);
    }
  }
  // Fin de 2026 a principios de 2027 sin hueco.
  const ev = eventosTabla(anios, "Auckland");
  const cambio = ev.findIndex((e) => e.t >= Date.parse("2027-01-01T00:00:00Z"));
  assert.ok(ev[cambio].t - ev[cambio - 1].t < 8 * H);
});

test("datos/nz: el catálogo casa las 87 tablas con su puerto secundario", () => {
  const tablas = Object.entries(catalogo.tablas);
  assert.equal(tablas.length, 87);
  const casadas = tablas.filter(([, t]) => t.secundario);
  assert.ok(casadas.length >= 60, `${casadas.length}`);
  for (const [nombre, t] of casadas) assert.equal(catalogo.secundarios[t.secundario].tabla, nombre);
  assert.equal(normalizar("Riverton / Aparima"), normalizar("Riverton - Aparima"));
  assert.equal(normalizar("Whakatāne"), "whakatane");
});

test("script: URLs de la lista de LINZ y casado de nombres", () => {
  const html = `<a href="https://static.charts.linz.govt.nz/tide-tables/maj-ports/csv/Port Ōhope Wharf 2026.csv">x</a>
    <a href="https://static.charts.linz.govt.nz/tide-tables/maj-ports/csv/Auckland 2027.csv">y</a>`;
  const u = urlsTablas(html);
  assert.equal(u["Port Ōhope Wharf"]["2026"], "https://static.charts.linz.govt.nz/tide-tables/maj-ports/csv/Port%20Ōhope%20Wharf%202026.csv");
  assert.ok(u.Auckland["2027"]);
  const tablas = { Leigh: { lat: -36.28, lon: 174.8 }, Lejos: { lat: -40, lon: 170 } };
  const s = { "6396b": { id: "6396b", nombre: "Leigh", lat: -36.2833, lon: 174.8 } };
  casarTablas(tablas, s);
  assert.equal(tablas.Leigh.secundario, "6396b");
  assert.equal(s["6396b"].tabla, "Leigh");
  assert.equal(tablas.Lejos.secundario, null);
});

test("reservas marinas de DOC: ≤ 300 KB, 49 reservas y atribución CC BY 4.0", () => {
  const f = "datos/nz/reservas-marinas-doc.geojson";
  assert.ok(statSync(join(RAIZ, f)).size <= LIMITE_BYTES);
  const g = json(f);
  assert.equal(g.type, "FeatureCollection");
  assert.equal(g.features.length, 49);
  assert.match(g.atribucion, /Department of Conservation.*CC BY 4\.0/);
  for (const x of g.features) {
    assert.ok(["Polygon", "MultiPolygon"].includes(x.geometry.type));
    assert.ok(x.properties.nombre);
  }
  const mini = armarGeojson({ features: [{ properties: { NaPALIS_ID: 1, Name: "X", Legislation: "L", Recorded_Area: 2 }, geometry: { type: "Polygon", coordinates: [] } }] }, 0.001, "2026-10-09");
  assert.deepEqual(mini.features[0].properties, { id: 1, nombre: "X", ley: "L", area_ha: 2 });
});
