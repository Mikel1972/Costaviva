// Diario en el móvil (2026-10-09, captura de Mikel en el iPhone): la hoja
// del día quedaba bajo el menú inferior y tapaba la cabecera, y la ficha de
// la salida mezclaba la boya (ficha) con el modelo (índice), con decimales
// en punto. Lógica pura de assets/js/condiciones-salida.js y comprobaciones
// del HTML. Sin red ni DOM. Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  boyaMasCercana, aplicarBoyaASerie, fmtDecimal, textoOleaje, textoCeboAparejo,
} from "../assets/js/condiciones-salida.js";

const html = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("oleaje: un valor de boya sale una vez y con coma", () => {
  assert.equal(textoOleaje(1.9, 1.9), "1,9 m");
  assert.equal(textoOleaje(1.71, 2.09), "1,7–2,1 m");
  assert.equal(textoOleaje(null, null), "—");
  assert.equal(textoOleaje(0.5, null), "0,5 m");
});

test("decimales con coma", () => {
  assert.equal(fmtDecimal(17.2), "17,2");
  assert.equal(fmtDecimal(20), "20");
  assert.equal(fmtDecimal(0), "0");
  assert.equal(fmtDecimal(null), null);
});

test("cebo/aparejo/señuelo sin separadores sueltos", () => {
  assert.equal(textoCeboAparejo({ cebo: "Anchoa", senuelo: "Pulpo" }), "Cebo: Anchoa · Señuelo: Pulpo");
  assert.equal(textoCeboAparejo({ senuelo: "Jig" }), "Señuelo: Jig");
  assert.equal(textoCeboAparejo({}), "");
});

test("boya más cercana y aplicada solo a la hora de la salida", () => {
  const boyas = [
    { nombre: "Lejos", lat: 43.5, lon: -2, alturaSignificativa: 3, tempAgua: 15 },
    { nombre: "Nazaré", lat: 39.55, lon: -9.2, alturaSignificativa: 1.9, tempAgua: 17.2 },
    { nombre: "Rota", error: "sin dato" },
  ];
  const b = boyaMasCercana(boyas, 39.603, -9.08);
  assert.equal(b.nombre, "Nazaré");
  assert.equal(boyaMasCercana([], 0, 0), null);
  const serie = [{ hora: "15", ola: 1.2, tempAgua: 20.4 }, { hora: "16", ola: 1.2, tempAgua: 20.4 }];
  const s2 = aplicarBoyaASerie(serie, 1, b);
  assert.deepEqual(s2[1], { hora: "16", ola: 1.9, tempAgua: 17.2 });
  assert.deepEqual(s2[0], serie[0]);
  assert.equal(serie[1].tempAgua, 20.4, "no muta la serie original");
  assert.equal(aplicarBoyaASerie(serie, 1, null), serie);
});

test("diario: el índice usa la boya que enseña la ficha", () => {
  const h = html("diario.html");
  const iBoya = h.indexOf("CondSalida.aplicarBoyaASerie(");
  const iIndice = h.indexOf("VentanaActividad.indiceSpot(");
  assert.ok(iBoya > 0 && iIndice > iBoya, "la boya se aplica antes de calcular el índice");
  assert.doesNotMatch(h, /oleaje_altura_min\}–\$\{salida\.oleaje_altura_max\}m/);
  assert.doesNotMatch(h, /\$\{salida\.temp_agua\}°C/);
  assert.match(h, /<details class="nota-ficha nota-plegada"><summary>ⓘ Coeficiente de marea<\/summary>/);
});

test("diario: la hoja del día no se mete bajo el menú ni bajo la cabecera", () => {
  const h = html("diario.html");
  const panel = h.match(/\.panel-dia \{[\s\S]*?\}/)[0];
  assert.match(panel, /bottom: var\(--menu-alto, calc\(72px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(panel, /var\(--cabecera-abajo/);
  assert.doesNotMatch(panel, /bottom: 54px/);
  assert.match(h, /setProperty\("--cabecera-abajo"/);
  assert.match(h, /setProperty\("--menu-alto"/);
});

test("diario: '➕ Añadir entrada' pegado al pie de la hoja y oculto con formulario abierto", () => {
  const h = html("diario.html");
  assert.match(h, /#btnAnadirEntrada \{[^}]*position: sticky; bottom: -20px/);
  assert.match(h, /#zonaFormulario:not\(:empty\) ~ #btnAnadirEntrada \{ display: none; \}/);
  assert.match(h, /`<div id="zonaFormulario"><\/div>` \+\s*`<button class="secundario" id="btnAnadirEntrada">/);
  assert.match(h, /\.panel-dia h2::first-letter \{ text-transform: uppercase; \}/);
});

test("páginas con menú inferior: hueco abajo y safe-area arriba", () => {
  const css = html("assets/css/costaviva.css");
  assert.match(css, /\.tabs-nav \{[^}]*height: calc\(72px \+ env\(safe-area-inset-bottom\)\)/);
  for (const f of ["diario.html", "alarma.html", "grupos.html", "index.html"]) {
    const h = html(f);
    assert.match(h, /padding-bottom: calc\(72px \+ env\(safe-area-inset-bottom\)\)/, `${f}: hueco del menú`);
    assert.match(h, /header \{ padding: max\(10px, env\(safe-area-inset-top\)\)/, `${f}: safe-area arriba`);
    assert.match(h, /viewport-fit=cover/, f);
  }
});

test("captura: nombre científico solo por nombre exacto y escapado", () => {
  const d = html("diario.html");
  assert.match(d, /async function cientificoDe\(nombre\)/);
  assert.match(d, /const cientifico = await cientificoDe\(captura\.especie\)/);
  assert.match(d, /<i class="cientifico">\$\{escNombre\(cientifico\)\}<\/i>/);
  assert.match(d, /\.tarjeta-captura \.especie \.cientifico \{/);
});
