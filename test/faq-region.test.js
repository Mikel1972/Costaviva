// Preguntas frecuentes de las páginas de región (2026-11-23): salen de los
// mismos datos que la tabla (próxima pleamar/bajamar y especies de
// temporada), en es/en/pt, con FAQPage.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { preguntasMareasRegion, preguntasSpotsRegion, faqLd, faqHtml, enLugar } from "../functions/_lib/seo/faq-region.js";
import * as rutaMareasEs from "../functions/mareas/region/[region].js";
import { IB } from "../functions/_lib/seo/paginas-ib.js";

const spot = (slug, nombre, pl, bj) => ({
  slug, nombre,
  marea: { proximas: [{ tipo: "bajamar", hora: bj[0], altura: bj[1], manana: false }, { tipo: "pleamar", hora: pl[0], altura: pl[1], manana: pl[2] || false }] },
  bloques: [{ altura: [0.5, 1], viento: 10, dirViento: "N" }],
});
const CANTABRIA = [
  spot("comillas", "Comillas", ["14:10", 3.7], ["08:00", 0.4]),
  spot("laredo", "Laredo", ["14:20", 4.0], ["08:05", 0.5]),
  spot("santander", "Santander", ["04:00", 3.5, true], ["22:00", 0.1]),
];
const MEDI = [
  spot("denia", "Dénia", ["10:00", 0.3], ["16:00", 0.1]),
  spot("malaga", "Málaga", ["11:00", 0.6], ["17:00", 0.2]),
];

test("mareas: pleamar y bajamar con los pueblos del título primero y la diferencia mín–máx", () => {
  const q = preguntasMareasRegion({ spots: CANTABRIA, regionSlug: "cantabria", lugar: "Cantabria", idioma: "es" });
  assert.equal(q.length, 3);
  assert.equal(q[0].pregunta, "¿A qué hora es la pleamar hoy en Cantabria?");
  // Santander y Laredo están en el título de la región: van delante.
  assert.match(q[0].respuesta, /^Próxima pleamar: Laredo a las 14:20 \(4,0 m\), Santander mañana a las 04:00 \(3,5 m\) y Comillas a las 14:10 \(3,7 m\)\./);
  assert.match(q[1].respuesta, /Santander a las 22:00 \(0,1 m\)/);
  // 3,3 (Comillas) a 3,5 (Laredo).
  assert.equal(q[2].respuesta, "En la marea de ahora, entre la pleamar y la bajamar hay de 3,3 m (Comillas) a 3,5 m (Laredo) de diferencia, según el spot.");
});

test("mareas: en el Mediterráneo dice que hay marea pero pequeña (de los datos, no inventado)", () => {
  const q = preguntasMareasRegion({ spots: MEDI, regionSlug: "mediterraneo", lugar: "el Mediterráneo", idioma: "es" });
  assert.equal(q[2].pregunta, "¿Cuánto sube y baja la marea en el Mediterráneo?");
  assert.match(q[2].respuesta, /de 0,2 m \(Dénia\) a 0,4 m \(Málaga\).*Hay marea, pero pequeña/);
  const grande = preguntasMareasRegion({ spots: CANTABRIA, regionSlug: "cantabria", lugar: "Cantabria" });
  assert.doesNotMatch(grande[2].respuesta, /pequeña/);
});

test("mareas: spots con error o sin datos no cuentan; sin datos, sin preguntas", () => {
  assert.deepEqual(preguntasMareasRegion({ spots: [{ slug: "x", nombre: "X", error: "sin datos" }], regionSlug: "cantabria", lugar: "Cantabria" }), []);
  assert.deepEqual(preguntasMareasRegion({ spots: [{ slug: "x", nombre: "X", marea: { proximas: [] } }], regionSlug: "cantabria", lugar: "Cantabria" }), []);
  // Una diferencia de menos de 5 cm (curva plana) no se cita como mínimo.
  const plano = [...MEDI, spot("guardamardelsegura", "Guardamar del Segura", ["12:00", 0.12], ["18:00", 0.1])];
  const q = preguntasMareasRegion({ spots: plano, regionSlug: "mediterraneo", lugar: "el Mediterráneo" });
  assert.doesNotMatch(q[2].respuesta, /Guardamar/);
  assert.match(q[2].respuesta, /de 0,2 m \(Dénia\)/);
  assert.equal(faqLd([]), null);
  assert.equal(faqHtml([]), "");
});

test("en y pt: preposición bien puesta y decimales de cada idioma", () => {
  assert.equal(enLugar("pt", "galicia", "Galiza"), "na Galiza");
  assert.equal(enLugar("pt", "mediterraneo", "Mediterrâneo"), "no Mediterrâneo");
  assert.equal(enLugar("pt", "canarias", "Canárias"), "nas Canárias");
  assert.equal(enLugar("en", "pais-vasco", "the Basque Country"), "in the Basque Country");
  const en = preguntasMareasRegion({ spots: MEDI, regionSlug: "mediterraneo", lugar: "the Mediterranean", idioma: "en" });
  assert.equal(en[0].pregunta, "What time is high tide today in the Mediterranean?");
  assert.match(en[2].respuesta, /from 0\.2 m \(Dénia\) to 0\.4 m \(Málaga\).*under half a metre/);
  const pt = preguntasMareasRegion({ spots: CANTABRIA, regionSlug: "cantabria", lugar: "Cantábria", idioma: "pt" });
  assert.equal(pt[2].pregunta, "Quanto sobe e desce a maré na Cantábria?");
  assert.match(pt[0].respuesta, /amanhã às 04:00 \(3,5 m\)/);
});

test("spots: qué se pesca este mes, de la lista de temporada", () => {
  const dt = ["Abadejo", "Besugo", "Calamar"].map((nombre) => ({ nombre }));
  const q = preguntasSpotsRegion({ deTemporada: dt, regionSlug: "galicia", lugar: "Galicia", mes: "noviembre" });
  assert.equal(q[0].pregunta, "¿Qué se pesca en Galicia en noviembre?");
  assert.equal(q[0].respuesta, "En noviembre están de temporada 3 especies: Abadejo, Besugo, Calamar. En esta página están todas, con los meses de cada una.");
  const muchas = Array.from({ length: 11 }, (_, i) => ({ nombre: `Pez${i}` }));
  assert.match(preguntasSpotsRegion({ deTemporada: muchas, regionSlug: "galicia", lugar: "Galicia", mes: "noviembre" })[0].respuesta, /y 3 más\./);
  assert.deepEqual(preguntasSpotsRegion({ deTemporada: [], lugar: "Galicia", mes: "noviembre" }), []);
});

test("faqHtml escapa el texto y faqLd es un FAQPage", () => {
  const q = [{ pregunta: "¿<b>?", respuesta: "a & b" }];
  assert.match(faqHtml(q), /&lt;b&gt;/);
  assert.match(faqHtml(q), /a &amp; b/);
  const ld = faqLd(q, "pt");
  assert.equal(ld["@type"], "FAQPage");
  assert.equal(ld.inLanguage, "pt");
  assert.equal(ld.mainEntity[0].acceptedAnswer.text, "a & b");
});

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test("página /mareas/region/cantabria (es): preguntas y FAQPage en la página", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ spots: CANTABRIA }), { headers: { "content-type": "application/json" } });
  const r = await rutaMareasEs.onRequestGet({ request: new Request("https://costaviva.org/mareas/region/cantabria"), params: { region: "cantabria" }, env: {} });
  const html = await r.text();
  assert.match(html, /<h2 id="t-preg">Preguntas frecuentes<\/h2>/);
  assert.match(html, /¿A qué hora es la pleamar hoy en Cantabria\?/);
  assert.match(html, /"@type":"FAQPage"/);
});

test("páginas de región en inglés y portugués llevan sus preguntas", () => {
  const en = IB.en.paginaRegionMareas("cantabria", CANTABRIA).html;
  assert.match(en, /What time is high tide today in Cantabria\?/);
  assert.match(en, /FAQPage/);
  const pt = IB.pt.paginaRegionMareas("cantabria", CANTABRIA).html;
  assert.match(pt, /A que horas é a preia-mar hoje na Cantábria\?/);
});
