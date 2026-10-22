// Lonjas de Galicia (scripts/lonjas/galicia.mjs): lo puro, sin red. Las
// fixtures son recortes de respuestas reales de pescadegalicia.gal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  numeroGal, fechaISO, fechaGal, diasAnteriores, cuerpoPeticion, csrfDe, leerFilas, leerTotales,
  totalElementos, unificar, resumen, cuadra, lonjasSinCoordenadas, CITA,
} from "../scripts/lonjas/galicia.mjs";

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const HTML = fixture("pescadegalicia-agregacion.html");
const HTML_GRUPO = fixture("pescadegalicia-agregacion-grupo.html");
const CATALOGO = JSON.parse(readFileSync(new URL("../scripts/lonjas/lonjas-galicia.json", import.meta.url), "utf8"));

test("números en formato gallego", () => {
  assert.equal(numeroGal("8.224,20"), 8224.2);
  assert.equal(numeroGal("1.171.665,56"), 1171665.56);
  assert.equal(numeroGal("127,50"), 127.5);
  assert.equal(numeroGal("4"), 4);
  assert.equal(numeroGal(" 0,89 "), 0.89);
  assert.equal(numeroGal(""), null);
  assert.equal(numeroGal(null), null);
  assert.equal(numeroGal("n/d"), null);
});

test("fechas dd/mm/aaaa <-> ISO", () => {
  assert.equal(fechaISO("21/10/2026"), "2026-10-21");
  assert.equal(fechaISO("2026-10-21"), null);
  assert.equal(fechaGal("2026-10-21"), "21/10/2026");
});

test("D-1, D-2 y D-3 en hora de Madrid", () => {
  assert.deepEqual(diasAnteriores(new Date("2026-10-22T10:17:00Z")), ["2026-10-21", "2026-10-20", "2026-10-19"]);
  // 23:30 UTC del 31-12 ya es 1-1 en Madrid
  assert.deepEqual(diasAnteriores(new Date("2026-12-31T23:30:00Z"), 1), ["2026-12-31"]);
  // cambio de mes
  assert.deepEqual(diasAnteriores(new Date("2026-11-02T10:00:00Z"), 3), ["2026-11-01", "2026-10-31", "2026-10-30"]);
});

test("cuerpo del POST: filtro de fecha y agrupación por fecha, lonja, grupo y especie", () => {
  const c = cuerpoPeticion("2026-10-21", "2026-10-21", 2);
  assert.equal(c.paginaActual, 2);
  assert.equal(c.tamanhoPagina, 1000);
  assert.deepEqual(c.listaFiltros[0], { tipo: "TYPE_FECHA", codigo: "fecha", path: "fecha", isDatetime: false, isTimeOnly: false, valorDesde: "21/10/2026", valorHasta: "21/10/2026", texto: "21/10/2026 - 21/10/2026" });
  assert.deepEqual(c.columnasAgregateGroups.filter((g) => g.agregated).map((g) => g.codigo), ["fecha", "lonjaAgrupacionView", "grupoBiologico", "especie"]);
  assert.deepEqual(c.columnasAgregateIndexes.map((g) => g.codigo), ["cantidadsum", "importesum", "precioMedioany"]);
});

test("token _csrf de la página", () => {
  assert.equal(csrfDe('<meta name="_csrf" content="abc-123_X"/>'), "abc-123_X");
  assert.equal(csrfDe("<html></html>"), null);
});

test("lee las filas de la tabla real (sin grupo)", () => {
  const filas = leerFilas(HTML);
  assert.equal(filas.length, 3);
  assert.deepEqual(filas[0], { fecha: "2026-10-21", region: "galicia", lonja: "Carril", especie: "Ameixa xaponesa", kg: 127.5, importe: 1820.55, precio_medio: 14.28, grupo: null });
  assert.equal(filas[2].lonja, "Vigo (Canido)");
  assert.equal(totalElementos(HTML), 374);
  // El pie "Totais" no es una fila de venta
  assert.ok(filas.every((f) => f.lonja !== "Totais:"));
});

test("lee el grupo biológico cuando se agrupa por él", () => {
  const filas = leerFilas(HTML_GRUPO);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0], { fecha: "2026-10-21", region: "galicia", lonja: "Baiona", especie: "Xarda pintada", kg: 2.25, importe: 6.75, precio_medio: 3, grupo: "Peixes" });
  assert.equal(totalElementos(HTML_GRUPO), 808);
});

test("pie Totais y cuadre de kg", () => {
  assert.deepEqual(leerTotales(HTML), { kg: 90660.44, importe: 451125.32 });
  const filas = leerFilas(HTML);
  assert.equal(cuadra(filas, leerTotales(HTML)), false); // recorte: 3 de 374 filas
  assert.equal(cuadra(filas, { kg: 133.5 }), true);
  assert.equal(cuadra(filas, { kg: null }), true);
});

test("unificar: una fila por clave; si se repite, suma", () => {
  const f = { fecha: "2026-10-21", region: "galicia", lonja: "Vigo", especie: "Pescada", kg: 10, importe: 50, precio_medio: 5, grupo: null };
  const u = unificar([f, { ...f, kg: 30, importe: 90, grupo: "Peixes" }, { ...f, especie: "Xurelo" }]);
  assert.equal(u.length, 2);
  assert.deepEqual(u[0], { ...f, kg: 40, importe: 140, precio_medio: 3.5, grupo: "Peixes" });
  assert.equal(f.kg, 10, "no muta la entrada");
});

test("resumen: solo totales", () => {
  const r = resumen(leerFilas(HTML));
  assert.deepEqual(r, { filas: 3, lonjas: 3, especies: 1, kg: 134, importe: 1902 });
});

test("catálogo de lonjas: ids y nombres únicos, coordenadas dentro de Galicia", () => {
  const ls = CATALOGO.lonjas;
  assert.ok(ls.length >= 60);
  assert.equal(new Set(ls.map((l) => l.id)).size, ls.length);
  assert.equal(new Set(ls.map((l) => l.nombre)).size, ls.length);
  for (const l of ls) {
    if (l.lat == null) { assert.equal(l.lon, null, l.nombre); continue; }
    assert.ok(l.lat > 41.8 && l.lat < 43.8 && l.lon > -9.4 && l.lon < -6.9, `${l.nombre} fuera de Galicia`);
  }
  assert.ok(ls.filter((l) => l.lat != null).length >= 59);
  assert.match(CATALOGO._nota, /Fonte: Xunta de Galicia – pescadegalicia\.gal/);
});

test("todas las lonjas de las fixtures están en el catálogo", () => {
  assert.deepEqual(lonjasSinCoordenadas([...leerFilas(HTML), ...leerFilas(HTML_GRUPO)], CATALOGO), []);
  assert.deepEqual(lonjasSinCoordenadas([{ lonja: "Nova" }], CATALOGO), ["Nova"]);
});

test("cita de la fuente exigida por el aviso legal", () => {
  assert.equal(CITA, "Fonte: Xunta de Galicia – pescadegalicia.gal");
  const wf = readFileSync(new URL("../.github/workflows/lonjas-galicia.yml", import.meta.url), "utf8");
  assert.match(wf, /Fonte: Xunta de Galicia – pescadegalicia\.gal/);
  assert.doesNotMatch(wf, /ANTHROPIC|claude/i, "robot sin IA");
  const mig = readdirSync(new URL("../supabase/migrations/", import.meta.url)).find((f) => f.endsWith("_lonja_ventas.sql"));
  assert.ok(mig, "falta la migración de lonja_ventas");
});
