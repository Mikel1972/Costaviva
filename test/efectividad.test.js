// Bloque «Efectividad y visitas» del informe diario (2026-11-23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sumarDias, diasEntre, totalesPaginas, filaMedida, tablaVisitas, tablaDias, tablaMd, rutaDeUrl } from "../scripts/seo/efectividad-lib.mjs";
import { informeAHtml } from "../functions/_lib/informe-html.js";

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

test("filaMedida: antes → después por día y veredicto", () => {
  const m = { titulo: "Lubina", fecha: "2026-11-23", pr: [609] };
  const f = filaMedida(m, { clics: 0, impresiones: 70, posicion: 17 }, { clics: 2, impresiones: 40, posicion: 12 }, 2);
  assert.equal(f[0], "Lubina (PR 609)");
  assert.equal(f[1], "23/11");
  assert.equal(f[3], "10 → 20 (+100 %)");
  assert.equal(f[6], "17 → 12");
  assert.equal(f[7], "✅ sube 5 puestos (pocos días)");
  assert.match(filaMedida(m, { clics: 0, impresiones: 0, posicion: NaN }, null, 0)[7], /esperando/);
  assert.equal(filaMedida(m, { clics: 0, impresiones: 70, posicion: 10 }, { clics: 0, impresiones: 70, posicion: 14 }, 7)[7], "⚠️ baja 4 puestos");
  assert.equal(filaMedida(m, { clics: 0, impresiones: 0, posicion: NaN }, { clics: 0, impresiones: 7, posicion: 9 }, 7)[7], "✅ empieza a salir");
});

test("tablaVisitas: resumen de ayer y tabla día a día por origen", () => {
  const filas = [
    { dia: "2026-11-22", pagina: "spots", fuente: "google", visitas: 5 },
    { dia: "2026-11-22", pagina: "mareas", fuente: "directo", visitas: 4 },
    { dia: "2026-11-22", pagina: "spots", fuente: "facebook", visitas: 2 },
    { dia: "2026-11-15", pagina: "spots", fuente: "google", visitas: 3 },
    { dia: "2026-11-23", pagina: "spots", fuente: "google", visitas: 2 },
  ];
  const l = tablaVisitas(filas, "2026-11-23").join("\n");
  // El 15/11 el contador aún contaba robots: sin comparación, y esos días van con *.
  assert.match(l, /Ayer \(22\/11\): 11 visitas \(el mismo día de la semana anterior, 3, aún contaba robots: sin comparación\)/);
  assert.match(l, /\| Día \| Total \| Google \| Bing \| Redes sociales \| Directo \| Otros \|/);
  assert.match(l, /\| 20\/11\* \| 0 \|/);
  assert.match(l, /\| 22\/11 \| 11 \| 5 \| 0 \| 2 \| 4 \| 0 \|/);
  assert.match(l, /\| 23\/11 \(hoy, hasta ahora\) \| 2 \| 2 \|/);
  assert.match(l, /\* Antes del 21\/11/);
  const l2 = tablaVisitas([{ dia: "2026-12-01", pagina: "spots", fuente: "google", visitas: 6 }, { dia: "2026-11-24", pagina: "spots", fuente: "google", visitas: 3 }], "2026-12-02").join("\n");
  assert.match(l2, /Ayer \(1\/12\): 6 visitas \(\+100 %\) frente al mismo día de la semana anterior \(3\)/);
  assert.doesNotMatch(l2, /robots/);
});

test("tablaDias ordena por fecha y marca hoy", () => {
  const l = tablaDias([{ keys: ["2026-11-21"], clicks: 1, impressions: 50, ctr: 0.02, position: 13.6 }, { keys: ["2026-11-20"], clicks: 0, impressions: 40, ctr: 0, position: 20 }], "2026-11-21").join("\n");
  assert.ok(l.indexOf("20/11") < l.indexOf("21/11"));
  assert.match(l, /\| 21\/11 \(hoy, a medias\) \| 1 \| 50 \| 2 % \| 13,6 \|/);
});

test("tablaMd cambia las barras de las celdas", () => {
  assert.deepEqual(tablaMd(["a", "b"], [["x|y", "z"]]), ["", "| a | b |", "|---|---|", "| x/y | z |", ""]);
});

test("informeAHtml: tablas, listas, títulos y escape", () => {
  const h = informeAHtml(["### 2026-11-23", "- Visitas:", "    - Ayer: 9 <b>", "", "| Día | Total |", "|---|---|", "| 22/11 | 9 |", "| 23/11 | 2 |", "", "**ok**"].join("\n"));
  assert.match(h, /<h4[^>]*>2026-11-23<\/h4>/);
  assert.match(h, /<table[^>]*><thead><tr><th[^>]*>Día<\/th><th[^>]*>Total<\/th><\/tr><\/thead><tbody><tr[^>]*><td[^>]*>22\/11<\/td><td[^>]*>9<\/td><\/tr><tr[^>]*><td[^>]*>23\/11<\/td>/);
  assert.match(h, /margin:2px 0 2px 36px[^>]*>• Ayer: 9 &lt;b&gt;/);
  assert.match(h, /<strong>ok<\/strong>/);
  assert.doesNotMatch(h, /\|---/);
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
