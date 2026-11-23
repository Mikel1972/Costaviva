// Bloque «Efectividad y visitas» del informe diario (2026-11-23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sumarDias, diasEntre, totalesPaginas, lineaMedida, lineasVisitas, lineasDias, rutaDeUrl } from "../scripts/seo/efectividad-lib.mjs";

const fila = (url, clicks, impressions, position) => ({ keys: [url], clicks, impressions, position });

test("fechas", () => {
  assert.equal(sumarDias("2026-11-30", 1), "2026-12-01");
  assert.equal(sumarDias("2026-11-23", -7), "2026-11-16");
  assert.equal(diasEntre("2026-11-23", "2026-11-25"), 3);
  assert.equal(rutaDeUrl("https://costaviva.org/especies/lubina/"), "/especies/lubina");
  assert.equal(rutaDeUrl("https://costaviva.org/"), "/");
});

test("totalesPaginas: solo las rutas que casan, posición ponderada por impresiones", () => {
  const filas = [
    fila("https://costaviva.org/especies/lubina", 1, 30, 10),
    fila("https://costaviva.org/en/species/lubina", 0, 10, 30),
    fila("https://costaviva.org/especies/lubina-x", 5, 100, 1),
  ];
  const t = totalesPaginas(filas, ["^(/en|/pt)?/(especies|species)/lubina$"]);
  assert.deepEqual({ ...t, posicion: Math.round(t.posicion * 10) / 10 }, { clics: 1, impresiones: 40, posicion: 15, paginas: 2 });
  assert.ok(Number.isNaN(totalesPaginas([], [".*"]).posicion));
});

test("lineaMedida: antes/después por día, posición que sube con ✅", () => {
  const m = { titulo: "Lubina", fecha: "2026-11-23", pr: [609] };
  const l = lineaMedida(m, { clics: 0, impresiones: 70, posicion: 17 }, { clics: 2, impresiones: 40, posicion: 12 }, 2);
  assert.match(l, /Lubina \(23\/11, PR 609\)/);
  assert.match(l, /impresiones\/día 10 → 20 \(\+100 %\)/);
  assert.match(l, /posición 17 → 12 \(sube 5 ✅\)/);
  assert.match(l, /pocos días, orientativo/);
  assert.match(lineaMedida(m, { clics: 0, impresiones: 0, posicion: NaN }, null, 0), /aún sin datos de después/);
  assert.match(lineaMedida(m, { clics: 0, impresiones: 70, posicion: 10 }, { clics: 0, impresiones: 70, posicion: 14 }, 7), /baja 4 ⚠️/);
});

test("lineasVisitas: ayer, por origen, hoy y la semana", () => {
  const filas = [
    { dia: "2026-11-22", pagina: "spots", fuente: "google", visitas: 5 },
    { dia: "2026-11-22", pagina: "mareas", fuente: "directo", visitas: 4 },
    { dia: "2026-11-15", pagina: "spots", fuente: "google", visitas: 3 },
    { dia: "2026-11-23", pagina: "spots", fuente: "google", visitas: 2 },
  ];
  const l = lineasVisitas(filas, "2026-11-23").join("\n");
  // El 15/11 el contador aún contaba robots: sin comparación, y los días
  // anteriores al 21/11 salen con *.
  assert.match(l, /Ayer \(22\/11\): 9 visitas \(el mismo día de la semana anterior, 3, aún contaba robots: sin comparación\)/);
  assert.match(l, /20\/11: 0\* · 21\/11: 0 · 22\/11: 9 \(\* antes del 21\/11/);
  const l2 = lineasVisitas([{ dia: "2026-12-01", pagina: "spots", fuente: "google", visitas: 6 }, { dia: "2026-11-24", pagina: "spots", fuente: "google", visitas: 3 }], "2026-12-02").join("\n");
  assert.match(l2, /Ayer \(1\/12\): 6 visitas \(\+100 %\) frente al mismo día de la semana anterior \(3\)/);
  assert.doesNotMatch(l2, /robots/);
  assert.match(l, /por origen: google 5, directo 4/);
  assert.match(l, /Hoy hasta ahora \(23\/11\): 2 visitas/);
});

test("lineasDias ordena por fecha", () => {
  const l = lineasDias([{ keys: ["2026-11-21"], clicks: 1, impressions: 50, position: 13.6 }, { keys: ["2026-11-20"], clicks: 0, impressions: 40, position: 20 }]);
  assert.match(l[0], /20\/11/);
  assert.match(l[1], /21\/11: 1 clics, 50 impresiones, posición 13,6/);
});

test("medidas.json: fechas, títulos y patrones válidos", () => {
  const { medidas } = JSON.parse(readFileSync(new URL("../datos-robots/seo/medidas.json", import.meta.url), "utf8"));
  assert.ok(medidas.length);
  const ids = new Set();
  for (const m of medidas) {
    assert.match(m.fecha, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(m.titulo && m.paginas?.length, m.id);
    assert.ok(!ids.has(m.id), `id repetido ${m.id}`);
    ids.add(m.id);
    for (const p of m.paginas) new RegExp(p);
  }
  // Las zonas de NZ no recogen las regiones de España y Portugal.
  const nz = medidas.find((m) => m.id === "faq-zonas-nz").paginas.map((p) => new RegExp(p));
  assert.ok(nz.some((r) => r.test("/en/tides/region/northland")));
  assert.ok(!nz.some((r) => r.test("/mareas/region/cantabria")));
});
