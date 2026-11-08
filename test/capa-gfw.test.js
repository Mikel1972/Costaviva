// Capa de actividad pesquera comercial de Global Fishing Watch (assets/js/capa-gfw.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerDiccionario } from "./i18n-html.js";

globalThis.window ??= {};
const { regionDe, colorHoras, limitesCelda, ARTES, PERIODOS, URL_GFW, estadoInicial } = await import("../assets/js/capa-gfw.js");

test("región según el centro del mapa", () => {
  assert.equal(regionDe(-2.7), "iberia");
  assert.equal(regionDe(174.8), "nz");
  assert.equal(regionDe(-179.5), "nz");
});

test("color: más horas, más oscuro; celda de 0,1°", () => {
  assert.equal(colorHoras(0, 10), "#FDE68A");
  assert.equal(colorHoras(1000, 1000), "#581C87");
  assert.notEqual(colorHoras(5, 1000), colorHoras(500, 1000));
  assert.deepEqual(limitesCelda(43.5, -2.5), [[43.5, -2.5], [43.6, -2.4]]);
});

test("artes y periodos iguales que en el robot y la tabla", async () => {
  const robot = await import("../scripts/gfw/esfuerzo-gfw.mjs");
  assert.deepEqual(ARTES, robot.LISTA_ARTES);
  assert.deepEqual(PERIODOS, ["reciente", "habitual"]);
});

test("condiciones de GFW: cita enlazada, nota de esfuerzo aparente y capa gratis", () => {
  const JS = readFileSync(new URL("../assets/js/capa-gfw.js", import.meta.url), "utf8");
  const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(URL_GFW, "https://globalfishingwatch.org");
  assert.match(JS, /"Powered by Global Fishing Watch\."/);
  assert.match(HTML, /\.from\("gfw_esfuerzo"\)/);
  assert.match(HTML, /import \* as GFW from "\/assets\/js\/capa-gfw\.js";/);
  // Gratis: la capa no mira el plan ni Premium.
  const codigo = JS.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(codigo, /premium|Plan\.|estadoPlan/i);
  for (const i of ["es", "en", "pt"]) {
    const d = leerDiccionario(new URL(`../assets/i18n/${i}.js`, import.meta.url));
    const usadas = [...JS.matchAll(/I18n\.t\("(gfw\.[\w.]+)"/g)].map((m) => m[1]);
    for (const k of [...usadas, ...ARTES.map((a) => `gfw.arte.${a}`)]) assert.ok(k in d, `${k} en ${i}`);
    assert.match(d["gfw.nota"], /AIS/);
  }
  const es = leerDiccionario(new URL("../assets/i18n/es.js", import.meta.url));
  assert.match(es["gfw.nota"], /aparente/);
  assert.match(es["gfw.nota"], /No es una guía de dónde hay peces/);
});

test("al abrir la app la capa empieza apagada aunque se guardara encendida (2026-11-07)", () => {
  // Mikel: "Cuando se entra en la app, solamente deben aparecer marcados los
  // spots. Todo lo demás desactivado." Periodo y arte sí se recuerdan.
  assert.deepEqual(estadoInicial({ ver: true, periodo: "habitual", arte: "cerco" }), { ver: false, periodo: "habitual", arte: "cerco" });
  assert.deepEqual(estadoInicial({ ver: true }), { ver: false, periodo: "reciente", arte: "todas" });
  assert.deepEqual(estadoInicial({ periodo: "raro", arte: "dinamita" }), { ver: false, periodo: "reciente", arte: "todas" });
  assert.deepEqual(estadoInicial(null), { ver: false, periodo: "reciente", arte: "todas" });
  assert.deepEqual(estadoInicial("basura"), { ver: false, periodo: "reciente", arte: "todas" });
  const JS = readFileSync(new URL("../assets/js/capa-gfw.js", import.meta.url), "utf8");
  assert.match(JS, /const estado = \{ ver: false,/);
  assert.match(JS, /JSON\.stringify\(\{ periodo: estado\.periodo, arte: estado\.arte \}\)/, "no se guarda ver");
});
