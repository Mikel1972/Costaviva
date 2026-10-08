// Tarjetas de abajo del mapa en un solo dock (assets/js/tarjetas-mapa.js,
// 2026-10-08): en el móvil la tarjeta de rayos tapaba la lluvia animada y la
// leyenda del ⓘ abierta. Ahora se apilan en #tarjetasMapa y el script solo
// decide dónde empieza el dock y cuánto puede crecer. Sin red ni DOM.
// Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../assets/js/tarjetas-mapa.js");
const { solapan, fondoDock, techoDock, altoMaxDock, HUECO, ALTO_MINIMO } = globalThis.TarjetasMapa;
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const JS = readFileSync(new URL("../assets/js/tarjetas-mapa.js", import.meta.url), "utf8");

// Mapa de 390 px de ancho y 712 de alto (iPhone 12-15 con cabecera y menú).
const ALTO = 712;
const DOCK = { izq: 4, der: 272 };          // left 4, right 118 (móvil)
const INFO = { izq: 10, der: 50, arriba: 662, abajo: 702 };       // botón ⓘ
const PILDORA = { izq: 298, der: 384, arriba: 674, abajo: 706 };  // ⓒ Fuentes plegados
const CREDITOS_ABIERTOS = { izq: 60, der: 390, arriba: 655, abajo: 712 };
const ZOOM = { izq: 10, der: 44, arriba: 10, abajo: 76 };

test("dos rectángulos solapan solo si comparten columna", () => {
  assert.equal(solapan(DOCK, INFO), true);
  assert.equal(solapan(DOCK, PILDORA), false);
  assert.equal(solapan(DOCK, CREDITOS_ABIERTOS), true);
  assert.equal(solapan(DOCK, null), false);
});

test("el dock empieza encima del ⓘ y no le importa la píldora de créditos", () => {
  const fondo = fondoDock({ alto: ALTO, dock: DOCK, obstaculos: [INFO, PILDORA] });
  assert.equal(fondo, ALTO - INFO.arriba + HUECO);
  // Su borde inferior (alto - fondo) queda por encima del ⓘ.
  assert.ok(ALTO - fondo < INFO.arriba);
});

test("con los créditos abiertos (al cargar, en el móvil) el dock sube por encima", () => {
  const fondo = fondoDock({ alto: ALTO, dock: DOCK, obstaculos: [INFO, PILDORA, CREDITOS_ABIERTOS] });
  assert.equal(fondo, ALTO - CREDITOS_ABIERTOS.arriba + HUECO);
});

test("escritorio: encima del ⓘ, de los créditos y de las leyendas de abajo a la izquierda", () => {
  const alto = 640, dock = { izq: 10, der: 1000 };
  const info = { izq: 16, der: 60, arriba: 580, abajo: 624 };
  const creditos = { izq: 76, der: 1280, arriba: 606, abajo: 640 };
  const isobatas = { izq: 10, der: 190, arriba: 520, abajo: 574 };
  assert.equal(fondoDock({ alto, dock, obstaculos: [info, creditos] }), alto - 580 + HUECO);
  assert.equal(fondoDock({ alto, dock, obstaculos: [info, creditos, isobatas] }), alto - 520 + HUECO);
});

test("los obstáculos invisibles (0 x 0, leyenda cerrada) no cuentan", () => {
  const vacio = { izq: 0, der: 0, arriba: 0, abajo: 0 };
  assert.equal(fondoDock({ alto: ALTO, dock: DOCK, obstaculos: [vacio] }), HUECO);
  assert.equal(techoDock({ dock: DOCK, obstaculos: [vacio] }), HUECO);
});

test("el dock no sube hasta el zoom ni las leyendas del fondo del móvil", () => {
  const leyendaFondo = { izq: 10, der: 220, arriba: 86, abajo: 150 };
  assert.equal(techoDock({ dock: DOCK, obstaculos: [ZOOM] }), ZOOM.abajo + HUECO);
  assert.equal(techoDock({ dock: DOCK, obstaculos: [ZOOM, leyendaFondo] }), leyendaFondo.abajo + HUECO);
  // Lo que queda a la derecha del dock (botones de capas) no limita.
  assert.equal(techoDock({ dock: DOCK, obstaculos: [{ izq: 300, der: 380, arriba: 10, abajo: 338 }] }), HUECO);
});

test("alto máximo: lo que queda entre techo y fondo, con un mínimo (y scroll)", () => {
  for (const [ancho, alto] of [[360, 508], [390, 712], [430, 800]]) {
    const fondo = fondoDock({ alto, dock: { izq: 4, der: ancho - 118 }, obstaculos: [{ ...INFO, arriba: alto - 50, abajo: alto - 10 }] });
    const techo = techoDock({ dock: DOCK, obstaculos: [ZOOM] });
    const max = altoMaxDock({ alto, fondo, techo });
    assert.equal(max, alto - fondo - techo, `${ancho} px`);
    assert.ok(techo + max + fondo <= alto, `${ancho} px: cabe entre el zoom y el ⓘ`);
  }
  assert.equal(altoMaxDock({ alto: 200, fondo: 60, techo: 84 }), ALTO_MINIMO);
});

test("index.html: todas las tarjetas de abajo viven en el dock, en orden", () => {
  assert.match(HTML, /<script src="\/assets\/js\/tarjetas-mapa\.js"><\/script>/);
  assert.match(HTML, /window\.TarjetasMapa\.montar\(\{/);
  const i = HTML.indexOf('<div class="tarjetas-mapa" id="tarjetasMapa">');
  assert.ok(i > 0);
  const fin = HTML.indexOf('<button class="rayos-toggle"', i);
  const dock = HTML.slice(i, fin);
  for (const id of ["rayosHoja", "capaMarPanel", "vientoSliderPanel", "leyendaPanel"]) {
    assert.ok(dock.includes(`id="${id}"`), `${id} dentro del dock`);
    assert.equal(HTML.split(`id="${id}"`).length, 2, `${id} solo una vez`);
  }
  // La lluvia la mete lluvia-animada.js en el dock.
  assert.match(HTML, /contenedor: document\.getElementById\("tarjetasMapa"\)/);
  // La tarjeta de rayos ya no es un control de Leaflet abajo a la derecha.
  assert.ok(!/ControlRayos/.test(HTML));
  // Orden de arriba a abajo: rayos, lluvia, clorofila/temperatura, viento, leyenda ⓘ.
  const orden = ["rayos-hoja", "lluvia-anim-panel", "capa-mar-panel", "viento-slider-panel", "leyenda"]
    .map((c) => Number(new RegExp(`\\.tarjetas-mapa > \\.${c} \\{ order: (\\d)`).exec(HTML)?.[1]));
  assert.deepEqual(orden, [1, 2, 3, 4, 5]);
  // Rayos se queda en una línea de frase cuando la lluvia está abierta.
  assert.match(HTML, /\.tarjetas-mapa:has\(> \.lluvia-anim-panel:not\(\[hidden\]\)\) \.rayos-leyenda \{ display: none; \}/);
});

test("sin on*= ni colores sueltos (CSP y tokens Amanecer)", () => {
  assert.ok(!/\son[a-z]+=/i.test(JS), "nada de on*= en el script");
  const css = HTML.slice(HTML.indexOf(".tarjetas-mapa {"), HTML.indexOf(".lluvia-anim-ultima.vieja b { color: var(--peligro); }"));
  assert.ok(css.length > 500, "bloque CSS del dock encontrado");
  assert.ok(!/#[0-9a-f]{3,6}\b|rgba?\(/i.test(css), "el dock usa var(--...)");
});
