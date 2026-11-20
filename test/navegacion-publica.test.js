// «Siempre tiene que haber una de atrás» (Mikel, 2026-11-20): todas las
// páginas públicas llevan «← Atrás» o un enlace para volver.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migasHtml } from "../functions/_lib/seo/base.js";

test("migas: siempre «← Atrás» a la página de arriba (o al mapa en la primera)", () => {
  assert.match(migasHtml([{ nombre: "Aprende", ruta: "/aprende" }, { nombre: "Nudo palomar", ruta: "/aprende/nudo-palomar" }]), /class="volver"><a href="\/aprende">← Atrás: Aprende/);
  // En la primera, sin «Atrás: Mapa»: ya está el botón «🗺️ Mapa» (Mikel: «es redundante»).
  assert.doesNotMatch(migasHtml([{ nombre: "Spots", ruta: "/spots" }]), /volver/);
  assert.match(migasHtml([{ nombre: "Tides", ruta: "/en/tides" }, { nombre: "Napier", ruta: "/en/tides/napier" }], "en"), /← Back: Tides/);
});

test("mareas, empieza, clubes, privacidad y términos: con enlace para volver", () => {
  assert.match(readFileSync("functions/mareas/index.js", "utf8"), /class="nav-cv"[\s\S]{0,200}🗺️ Mapa/);
  assert.doesNotMatch(readFileSync("functions/mareas/index.js", "utf8"), /Atrás: Mapa/);
  for (const f of ["functions/mareas/region/[region].js", "functions/mareas/[slug].js"]) {
    assert.match(readFileSync(f, "utf8"), /class="nav-cv"[\s\S]{0,200}← Atrás/, f);
  }
  for (const f of ["empieza.html", "clubes.html", "privacidad.html", "terminos.html"]) {
    assert.match(readFileSync(f, "utf8"), /href="\/"|>Volver /, f);
  }
});

test("sedales: fichas de material con apartados desplegables y usos de costa y embarcación", async () => {
  const { paginaFicha } = await import("../functions/_lib/seo/paginas-formacion.js");
  const datos = JSON.parse(readFileSync("assets/datos/formacion.json", "utf8"));
  const sedales = datos.fichas.filter((f) => f.tema === "sedales");
  assert.ok(sedales.length >= 6);
  for (const f of sedales) {
    const { html } = paginaFicha(datos, f);
    assert.match(html, /<details class="tema bloque tarjeta" id="colores">/, f.id);
    assert.match(html, /🪨 Desde costa/, f.id);
    assert.match(html, /🚤 Desde embarcación/, f.id);
    assert.doesNotMatch(html, /Paso a paso/, f.id);
    assert.ok(f.fuentes.length >= 2, `${f.id}: al menos dos fuentes`);
  }
});

test("bajos: fichas desplegables con grosor y largo, costa y embarcación; el congrio en el acero", async () => {
  const { paginaFicha } = await import("../functions/_lib/seo/paginas-formacion.js");
  const datos = JSON.parse(readFileSync("assets/datos/formacion.json", "utf8"));
  const bajos = datos.fichas.filter((f) => f.tema === "bajos");
  assert.ok(bajos.length >= 7);
  for (const f of bajos) {
    const { html } = paginaFicha(datos, f);
    for (const id of ["como-es", "medidas", "costa", "embarcacion", "ojo", "fuentes"]) assert.match(html, new RegExp(`<details class="tema bloque tarjeta" id="${id}">`), `${f.id} ${id}`);
  }
  assert.match(datos.fichas.find((f) => f.id === "sedal-acero").resumen, /congrio/);
});

test("nudos: apartados desplegables (paso a paso abierto)", async () => {
  const { paginaFicha } = await import("../functions/_lib/seo/paginas-formacion.js");
  const datos = JSON.parse(readFileSync("assets/datos/formacion.json", "utf8"));
  for (const f of datos.fichas.filter((x) => x.tema === "nudos")) {
    const { html } = paginaFicha(datos, f);
    assert.match(html, /<details class="tema bloque tarjeta" id="pasos" open>/, f.id);
    for (const id of ["resistencia", "bien-con", "ojo", "fuentes"]) assert.match(html, new RegExp(`id="${id}">`), `${f.id} ${id}`);
  }
});
