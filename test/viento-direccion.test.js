// Viento con su dirección en todas partes (2026-11-06, Mikel: "En el diario,
// o en cualquier otro sitio, además de la intensidad del viento hay que poner
// la dirección").
//
// Lo que protege:
//   1. I18n.rumbo / I18n.viento (assets/js/i18n.js): 16 rumbos con las mismas
//      letras que RUMBOS_16 de index.html, /prevision y el viento_dir del
//      diario ("15 km/h NW"); sin dirección, solo la velocidad.
//   2. Los motivos del índice con viento (ventana-actividad.js) llevan la
//      dirección; los guardados antes (sin `dir`) siguen como estaban.
//   3. La descripción de /en/tides/<spot> dice de dónde viene el viento.
//   4. La ficha de la salida del diario enseña viento_dir junto a la velocidad.
// Sin red ni DOM: corre en tests.yml.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { I18n } = await import("../assets/js/i18n-modulo.js");
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
afterEach(() => I18n.fijarPreferencias({}));

test("I18n.rumbo: grados o rumbo ya escrito -> 16 rumbos, mismas letras que RUMBOS_16 de index.html", () => {
  const html = leer("index.html");
  const rumbos16 = JSON.parse(html.match(/const RUMBOS_16 = (\[[^\]]+\])/)[1]);
  rumbos16.forEach((r, i) => assert.equal(I18n.rumbo(i * 22.5), r, `${i * 22.5}°`));
  assert.equal(I18n.rumbo(359), "N");
  assert.equal(I18n.rumbo(-90), "W");
  assert.equal(I18n.rumbo(720 + 315), "NW");
  assert.equal(I18n.rumbo("180"), "S", "grados en texto");
  assert.equal(I18n.rumbo("NNE 32°"), "NNE", "el dirOla de /prevision");
  assert.equal(I18n.rumbo("NW"), "NW");
  for (const x of [null, undefined, "", NaN]) assert.equal(I18n.rumbo(x), "", String(x));
});

test("I18n.viento: velocidad en la unidad del usuario + dirección; sin dirección, solo la velocidad", () => {
  assert.equal(I18n.viento(15, "NW"), "15 km/h NW");
  assert.equal(I18n.viento(15, 315), "15 km/h NW");
  assert.equal(I18n.viento(15, null), "15 km/h", "salidas antiguas sin viento_dir");
  assert.equal(I18n.viento(null, "NW"), "", "sin velocidad no se enseña nada");
  assert.equal(I18n.viento(18.52, "SW", undefined, "en"), "19 km/h SW");
  I18n.fijarPreferencias({ viento: "nudos" });
  assert.equal(I18n.viento(18.52, "SW"), "10 nudos SW");
  assert.equal(I18n.viento(18.52, "SW", undefined, "en"), "10 kn SW");
  assert.equal(I18n.viento(18.52, "SW", undefined, "pt"), "10 nós SW");
});

test("motivos del índice con viento: llevan la dirección; los guardados sin `dir`, igual que antes", async () => {
  const VA = await import("../assets/js/ventana-actividad.js");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 45, dir: "WNW" }, "es"), "viento fuerte (45 km/h WNW)");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 45, dir: "WNW" }, "en"), "strong wind (45 km/h WNW)");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 45 }, "es"), "viento fuerte (45 km/h)");
  assert.equal(VA.textoMotivo("va.seg.viento", { v: 30, dir: "N" }, "pt"), "vento 30 km/h N");
  assert.equal(VA.textoMotivo("va.seg.tope", { nivel: "Kayak", v: 30, dir: "N", tope: 40 }, "es"), "Kayak, viento 30 km/h N: máximo 40");

  const datos = JSON.parse(leer("assets/datos/especies.json"));
  const especie = datos.especies.find((e) => e.id === "lubina") || datos.especies[0];
  const horas = (vientoDir) => Array.from({ length: 48 }, (_, i) => ({
    hora: `2026-10-0${i < 24 ? 8 : 9}T${String(i % 24).padStart(2, "0")}:00`,
    nivelMar: 1.6 * Math.sin((i * 2 * Math.PI) / 12.4), ola: 1.2, viento: 45, vientoDir, tempAgua: 17.4, presion: 1016 - i * 0.6, lluvia: 0,
  }));
  const motivo = (dir) => VA.calcularVentana(especie, datos.reglas_por_defecto, horas(dir), { lat: 43.43, lon: -2.81, modalidad: "costa" })[30]
    .razones.find((x) => x.clave === "va.viento.fuerte");
  assert.equal(motivo(135).textoEs, "viento fuerte (45 km/h SE)");
  assert.equal(motivo(null).textoEs, "viento fuerte (45 km/h)", "sin dirección en la serie, solo la velocidad");
  assert.deepEqual(motivo(null).vars, { v: 45 });
});

test("/en/tides/<spot>: la descripción dice de dónde viene el viento", async () => {
  const { paginaMareaNZ } = await import("../functions/_lib/seo/paginas-en.js");
  const spot = { slug: "nz-prueba", nombre: "Prueba Beach", lat: -37.8, lon: 174.87 };
  const bloque = { hora: "09:00", altura: [0.5, 1], viento: 22, dirViento: "SW", tempAgua: 16 };
  const { html } = paginaMareaNZ(spot, [spot], { spotPrev: { bloques: [bloque] }, dias: [] });
  assert.match(html, /wind 22 km\/h SW\./);
  const sinDir = paginaMareaNZ(spot, [spot], { spotPrev: { bloques: [{ ...bloque, dirViento: null }] }, dias: [] }).html;
  assert.match(sinDir, /wind 22 km\/h\./);
});

test("diario: la ficha de la salida enseña viento_dir junto a la velocidad (las antiguas, solo la velocidad)", () => {
  const html = leer("diario.html");
  const fila = html.split("\n").find((l) => l.includes('I18n.t("diario.f.viento")'));
  assert.ok(fila, "fila del viento en contextoHTML");
  assert.match(fila, /viento_dir/, "la fila usa viento_dir");
});
