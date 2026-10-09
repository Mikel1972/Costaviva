// Tarjetas de capa minimizables (assets/js/plegar-tarjeta.js, 2026-10-09,
// Mikel: en el iPhone la tarjeta de 〰 Frentes tapaba media pantalla y los
// spots de la costa). Estado inicial, botón accesible, recuerdo en
// localStorage (y que sin almacenamiento no se rompe nada), y que el HTML
// trae la cabecera con el chevron en las tarjetas de capa. Sin red ni DOM
// real. Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../assets/js/plegar-tarjeta.js");
const { estadoInicial, montar, PREFIJO } = globalThis.PlegarTarjeta;
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const JS = readFileSync(new URL("../assets/js/plegar-tarjeta.js", import.meta.url), "utf8");

function elemento() {
  const clases = new Set(), attrs = {}, oyentes = {};
  return {
    ownerDocument: { defaultView: {} },
    classList: {
      toggle: (c, v) => (v ? clases.add(c) : clases.delete(c)),
      contains: (c) => clases.has(c),
    },
    setAttribute: (n, v) => { attrs[n] = String(v); },
    getAttribute: (n) => attrs[n] ?? null,
    addEventListener: (t, f) => { oyentes[t] = f; },
    click() { oyentes.click?.(); },
    textContent: "", title: "",
  };
}
function almacen() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test("estado inicial: se respeta lo que eligió el usuario; en el móvil, minimizada a partir de la segunda vez", () => {
  assert.equal(estadoInicial({ guardado: null, vista: false, movil: true }), false, "primera vez en el móvil: entera");
  assert.equal(estadoInicial({ guardado: null, vista: true, movil: true }), true, "segunda vez en el móvil: minimizada");
  assert.equal(estadoInicial({ guardado: null, vista: true, movil: false }), false, "escritorio: entera");
  assert.equal(estadoInicial({ guardado: "1", vista: false, movil: false }), true);
  assert.equal(estadoInicial({ guardado: "0", vista: true, movil: true }), false, "la abrió a mano: se queda abierta");
});

test("el chevron minimiza y expande, con aria-expanded y lo recuerda por tarjeta", () => {
  const tarjeta = elemento(), boton = elemento(), a = almacen();
  const p = montar({ tarjeta, boton, id: "capa_mar", almacen: a, movil: () => true });
  assert.equal(p.alAbrir(), false, "primera vez: entera");
  assert.equal(boton.getAttribute("aria-expanded"), "true");
  assert.equal(a.m.get(PREFIJO + "vista_capa_mar"), "1");
  assert.equal(p.alAbrir(), true, "segunda vez en el móvil: minimizada");
  assert.equal(boton.getAttribute("aria-expanded"), "false");
  assert.equal(boton.getAttribute("aria-label"), "Expandir la leyenda");
  boton.click();
  assert.equal(tarjeta.classList.contains("plegada"), false);
  assert.equal(a.m.get(PREFIJO + "plegada_capa_mar"), "0");
  assert.equal(p.alAbrir(), false, "la abrió a mano: así se queda");
  boton.click();
  assert.equal(p.alAbrir(), true);
});

test("sin localStorage (modo privado, bloqueado) funciona igual", () => {
  const roto = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  const tarjeta = elemento(), boton = elemento();
  const p = montar({ tarjeta, boton, id: "viento", almacen: roto, movil: () => true });
  assert.equal(p.alAbrir(), false);
  boton.click();
  assert.equal(tarjeta.classList.contains("plegada"), true);
  assert.equal(montar({ tarjeta: null, boton }), null);
});

test("index.html: cabecera con chevron accesible en las tarjetas de capa, créditos dentro, sin on*=", () => {
  for (const [panel, boton, cuerpo] of [["capaMarPanel", "capaMarPlegar", "capaMarCuerpo"], ["vientoSliderPanel", "vientoPlegar", "vientoCuerpo"]]) {
    assert.match(HTML, new RegExp(`id="${panel}"`));
    assert.match(HTML, new RegExp(`class="tarjeta-plegar" id="${boton}" aria-expanded="true" aria-controls="${cuerpo}"`));
    assert.match(HTML, new RegExp(`class="tarjeta-cuerpo" id="${cuerpo}"`));
  }
  assert.match(HTML, /<div class="tarjeta-cuerpo" id="capaMarCuerpo">[\s\S]*id="capaMarCredito"/, "créditos de Copernicus en la vista expandida");
  assert.match(HTML, /\.tarjeta-plegar \{[^}]*width: 44px; height: 44px/, "área táctil de 44 px");
  assert.match(HTML, /src="\/assets\/js\/plegar-tarjeta\.js"/);
  assert.match(HTML, /map\.attributionControl\.addAttribution\(credito\)/, "y siempre en los créditos del mapa");
  assert.doesNotMatch(JS, /\son[a-z]{3,}\s*=/i);
  assert.match(JS, /try \{/);
});
