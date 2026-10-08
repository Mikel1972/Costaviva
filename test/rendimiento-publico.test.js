// Rendimiento de las páginas públicas (2026-10-08, PageSpeed móvil de
// /spots/bakio: 87, "solicitudes que bloquean el renderizado: 1,9 s").
// Nada bloquea el pintado: CSS en línea, letras propias precargadas y sin
// Google Fonts. Sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { documento, htmlNoEncontradaGeneral, FUENTES_PRECARGA, cta } from "../functions/_lib/seo/base.js";
import { paginaSpot, paginaEspecie, paginaRegionSpots, paginaIndiceSpots, paginaIndiceEspecies } from "../functions/_lib/seo/paginas.js";
import { REGIONES_MAREAS } from "../functions/_lib/seo/datos.js";
import { construirCsp } from "../functions/_middleware.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { moduloEstilos, cssEnLinea, minificarCss, RUTA_ESTILOS } from "../scripts/seo/generar-estilos.mjs";
import { SPOTS } from "../functions/prevision.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const especies = JSON.parse(leer("assets/datos/especies.json"));

const GOOGLE = /fonts\.(googleapis|gstatic)\.com/;

function paginasPublicas() {
  const region = REGIONES_MAREAS[0];
  const spot = SPOTS.find((s) => s.slug === "bakio") || SPOTS[0];
  const datosSpot = {
    especiesDatos: especies, tipoFondo: JSON.parse(leer("assets/datos/tipo-fondo.json")),
    profundidad: JSON.parse(leer("assets/datos/profundidad-spots.json")), caudales: {}, camarasApp: {}, cond: null, indice: null, mes: 10,
  };
  return [
    ["documento()", documento({ titulo: "T", descripcion: "D", ruta: "/spots", cuerpo: `<h1>Hola</h1>${cta()}` })],
    ["404 general", htmlNoEncontradaGeneral()],
    ["404.html", leer("404.html")],
    ["/spots", paginaIndiceSpots(SPOTS).html],
    [`/spots/region/${region.slug}`, paginaRegionSpots(region, SPOTS, especies, 10).html],
    [`/spots/${spot.slug}`, paginaSpot(spot, SPOTS, datosSpot).html],
    ["/especies", paginaIndiceEspecies(especies, 10).html],
    [`/especies/${especies.especies[0].id}`, paginaEspecie(especies.especies[0], especies, SPOTS, 10).html],
  ];
}

test("páginas públicas: sin Google Fonts, sin hojas externas ni scripts que bloqueen", () => {
  for (const [nombre, html] of paginasPublicas()) {
    const head = html.slice(0, html.indexOf("</head>"));
    assert.doesNotMatch(html, GOOGLE, `${nombre}: pide Google Fonts`);
    assert.doesNotMatch(head, /<link[^>]+rel="stylesheet"/, `${nombre}: hoja de estilos externa en <head>`);
    for (const s of head.match(/<script\b[^>]*>/g) || []) {
      assert.match(s, /type="application\/ld\+json"/, `${nombre}: script que bloquea en <head>: ${s}`);
    }
    assert.match(head, /<style>[^<]*@font-face[^<]*<\/style>/, `${nombre}: sin el CSS en línea`);
    assert.ok(head.includes(`<style>${cssEnLinea()}</style>`), `${nombre}: el CSS en línea no es el de las hojas`);
  }
});

test("páginas públicas: precargan las dos letras latin, con crossorigin y antes del <style>", () => {
  assert.deepEqual(FUENTES_PRECARGA, ["/assets/fonts/Manrope-latin.woff2", "/assets/fonts/Unbounded-latin.woff2"]);
  for (const [nombre, html] of paginasPublicas()) {
    for (const f of FUENTES_PRECARGA) {
      const etiqueta = `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`;
      assert.ok(html.includes(etiqueta), `${nombre}: falta ${etiqueta}`);
      assert.ok(html.indexOf(etiqueta) < html.indexOf("<style>"), `${nombre}: la precarga va antes del CSS`);
    }
  }
  // Lo precargado es lo que pide el CSS (si no, el navegador lo baja dos veces).
  for (const f of FUENTES_PRECARGA) assert.ok(cssEnLinea().includes(`url("${f}")`), `${f} no está en el CSS en línea`);
});

test("estilos.js al día con costaviva.css + publico.css", () => {
  assert.equal(leer(RUTA_ESTILOS), moduloEstilos(), "ejecuta node scripts/seo/generar-sitemap.mjs");
  assert.equal(minificarCss("a  {\n color: red; /* x */\n}\n.b :hover { x: 1 }"), "a{color: red}.b :hover{x: 1}");
});

test("letras: ficheros y licencias OFL en assets/fonts, @font-face con swap y sin Google", () => {
  for (const f of ["Manrope-latin", "Manrope-latin-ext", "Unbounded-latin", "Unbounded-latin-ext"]) {
    const b = readFileSync(join(RAIZ, "assets/fonts", `${f}.woff2`));
    assert.equal(b.subarray(0, 4).toString("latin1"), "wOF2", `${f}.woff2 no es woff2`);
  }
  for (const f of ["OFL-Manrope.txt", "OFL-Unbounded.txt"]) assert.match(leer(`assets/fonts/${f}`), /SIL OPEN FONT LICENSE/i, f);
  for (const hoja of ["assets/css/costaviva.css", "assets/css/publico.css"]) {
    // Las de reserva ("... fallback", solo local()) no bajan nada.
    const reglas = (leer(hoja).match(/@font-face\s*\{[^}]*\}/g) || []).filter((r) => !/fallback"/.test(r));
    assert.ok(reglas.length >= 4, `${hoja}: sin @font-face`);
    for (const r of reglas) {
      assert.match(r, /font-display:\s*swap/, `${hoja}: @font-face sin swap`);
      const url = r.match(/url\("([^"]+)"\)/)[1];
      assert.ok(url.startsWith("/assets/fonts/") && existsSync(join(RAIZ, url)), `${hoja}: ${url} no existe`);
      assert.ok(esRutaPermitida(url), `${url} fuera de la lista blanca`);
    }
  }
  // Las páginas públicas usan solo sus pesos sueltos (los que pedían a
  // Google), no los rangos de la app: un 700 en Manrope se sigue viendo a 800.
  const pesos = (cssEnLinea().match(/font-weight: ?[\d ]+;font-display/g) || []).map((x) => x.match(/[\d ]+(?=;)/)[0].trim());
  assert.deepEqual([...new Set(pesos)].sort(), ["400", "600", "700", "800"]);
  // Letras de reserva con medidas ajustadas (sin CLS al cambiar de letra).
  const css = cssEnLinea();
  for (const f of ["Manrope fallback", "Unbounded fallback"]) {
    assert.match(css, new RegExp(`@font-face\\{font-family: "${f}";[^}]*src: local\\([^}]*size-adjust:`), `${f} sin medidas`);
  }
  assert.match(css, /--f-texto: "Manrope", "Manrope fallback"/);
});

test("app: ninguna página .html pide Google Fonts; index y login precargan las letras", () => {
  for (const p of readdirSync(RAIZ).filter((f) => f.endsWith(".html"))) {
    const html = leer(p);
    assert.doesNotMatch(html, GOOGLE, `${p}: pide Google Fonts`);
    // Las letras las declara costaviva.css: toda página de la app lo carga.
    if (p !== "404.html") assert.match(html, /href="\/assets\/css\/costaviva\.css"/, `${p}: sin costaviva.css, sin letras`);
  }
  for (const p of ["index.html", "login.html"]) {
    for (const f of FUENTES_PRECARGA) assert.ok(leer(p).includes(`<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`), `${p}: no precarga ${f}`);
  }
});

test("CSP: letras y estilos propios permitidos, Google fuera", () => {
  const csp = Object.fromEntries(construirCsp("N").split("; ").map((d) => { const [k, ...v] = d.split(" "); return [k, v]; }));
  assert.ok(csp["font-src"].includes("'self'"), "font-src sin 'self'");
  assert.ok(csp["style-src"].includes("'self'") && csp["style-src"].includes("'unsafe-inline'"), "style-src no admite el <style> en línea");
  assert.doesNotMatch(construirCsp("N"), GOOGLE);
});

test("_headers: un año de caché para /assets/fonts/*; CSS y JS sin caché", () => {
  const h = leer("_headers");
  assert.match(h, /^\/assets\/fonts\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m);
  assert.doesNotMatch(h, /^\/assets\/(css|js)\//m);
});
