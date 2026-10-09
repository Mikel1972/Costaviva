// Pantalla de inicio (2026-10-09, captura de Mikel en el iPhone): mientras se
// comprueba la sesión, foto de una rompiente + marca, en vez de la pantalla
// crema con enlaces azules. El texto y los enlaces para los buscadores de
// index.html siguen en el DOM. Sin red ni navegador. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FOTOS, DISPOSITIVOS, MAX_BYTES, FOTOGRAMA, PAGINAS_ARRANQUE,
  rutaArranque, bloqueArranque, conBloqueArranque, bloquePantalla,
} from "../scripts/inicio/generar-pantallas-inicio.mjs";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const PAGINAS = ["index.html", "diario.html", "alarma.html", "grupos.html", "admin.html", "suscripcion.html"];

// Medidas de un JPEG (marcador SOF) o de un WebP (VP8 / VP8L / VP8X).
function medidas(ruta) {
  const b = readFileSync(ruta);
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), tipo: "jpg" };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    const fourcc = b.toString("latin1", 12, 16);
    if (fourcc === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, tipo: "webp" };
    if (fourcc === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, tipo: "webp" }; }
    if (fourcc === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1, tipo: "webp" };
  }
  throw new Error(`${ruta}: ni JPEG ni WebP`);
}

test("fotos: WebP y JPG con sus medidas, ≤ 80 kB y servibles", () => {
  assert.equal(MAX_BYTES, 80 * 1024);
  for (const f of FOTOS) {
    for (const ext of ["webp", "jpg"]) {
      const url = `/assets/inicio/${f.nombre}.${ext}`;
      const ruta = join(RAIZ, url);
      assert.ok(existsSync(ruta), `falta ${url}: node scripts/inicio/generar-pantallas-inicio.mjs`);
      assert.ok(statSync(ruta).size <= MAX_BYTES, `${url} pesa ${statSync(ruta).size} B`);
      assert.deepEqual(medidas(ruta), { w: f.ancho, h: f.alto, tipo: ext }, url);
      assert.ok(esRutaPermitida(url), `${url} fuera de la lista blanca`);
    }
  }
  assert.ok(existsSync(join(RAIZ, FOTOGRAMA)));
  assert.ok(!esRutaPermitida("/" + FOTOGRAMA), "el fotograma original no se sirve");
});

test("licencia de la foto anotada: Coverr, uso comercial, sin atribución obligatoria", () => {
  const l = JSON.parse(leer("scripts/inicio/LICENCIA.json"));
  assert.equal(l.licencia_url, "https://coverr.co/license");
  assert.match(l.origen, /^https:\/\/coverr\.co\/videos\//);
  assert.match(l.cita_licencia, /including for commercial purposes/);
  assert.match(l.atribucion, /No obligatoria/);
  assert.match(l.licencia_comprobada, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(leer("CLAUDE.md"), /coverr\.co\/license[\s\S]{0,400}pantalla de inicio|pantalla de inicio[\s\S]{0,1500}coverr\.co\/license/i);
});

test("cada página: pantalla de inicio con foto, marca e indicador, tras costaviva.css", () => {
  for (const p of PAGINAS) {
    const html = leer(p);
    const b = bloquePantalla(html);
    const iApp = html.indexOf('<link rel="stylesheet" href="/assets/css/costaviva.css">');
    const iInicio = html.indexOf('<link rel="stylesheet" href="/assets/css/pantalla-inicio.css">');
    assert.ok(iApp > 0 && iInicio > iApp, `${p}: pantalla-inicio.css después de costaviva.css`);
    for (const f of FOTOS) {
      assert.ok(html.includes(`<link rel="preload" as="image" href="/assets/inicio/${f.nombre}.webp" type="image/webp"`), `${p}: no precarga ${f.nombre}.webp`);
      assert.ok(html.indexOf(`href="/assets/inicio/${f.nombre}.webp"`) < html.indexOf("</head>"), `${p}: precarga fuera del <head>`);
    }
    assert.match(b, /<picture>[\s\S]*<source media="\(orientation: landscape\)" srcset="\/assets\/inicio\/rompiente-ancha\.webp" type="image\/webp">/, p);
    assert.match(b, /<img class="pantalla-inicio__foto" src="\/assets\/inicio\/rompiente-movil\.jpg" width="720" height="1280" fetchpriority="high" alt="[^"]+">/, p);
    assert.doesNotMatch(b, /loading="lazy"/, `${p}: la foto no puede ser lazy`);
    assert.match(b, /class="marca-logo"/, `${p}: sin logo`);
    assert.match(b, /class="pantalla-inicio__nombre logotipo">Costaviva</, `${p}: sin nombre`);
    assert.match(b, /role="status"><span class="pantalla-inicio__girando" aria-hidden="true"><\/span>Comprobando acceso…/, `${p}: sin indicador`);
    assert.doesNotMatch(b, /\son[a-z]+\s*=/i, `${p}: on*= en la pantalla de inicio (CSP)`);
    assert.doesNotMatch(b, /style="/, `${p}: estilos sueltos; van en pantalla-inicio.css`);
    // El script de la página la sigue quitando al tener acceso.
    assert.match(html, /getElementById\("comprobandoAcceso"\)\.remove\(\)/, `${p}: nadie quita la pantalla`);
  }
});

test("index.html: el texto y los enlaces para buscadores siguen ahí; canonical intacto, sin noindex", () => {
  const html = leer("index.html");
  const b = bloquePantalla(html);
  assert.match(b, /<div class="pantalla-inicio__seo">/);
  assert.match(b, /<strong>Costaviva<\/strong>: pesca en tiempo real en España y Portugal\. Mareas, oleaje, viento, índice de pesca por spot, especies de temporada y diario de pesca\./);
  assert.match(b, /<nav aria-label="Páginas públicas"><a href="\/spots">Spots de pesca<\/a><a href="\/especies">Especies<\/a><a href="\/mareas">Mareas hoy<\/a><\/nav>/);
  assert.ok(html.includes('<link rel="canonical" href="https://costaviva.org/" />'));
  assert.doesNotMatch(html, /noindex/i);
  for (const p of ["login.html", "index.html"]) assert.doesNotMatch(leer(p), /<meta[^>]+name="robots"[^>]+noindex/i, p);
});

test("pantalla-inicio.css: safe-area, enlaces sin el azul del navegador, sin movimiento si se pide", () => {
  const css = leer("assets/css/pantalla-inicio.css");
  for (const lado of ["top", "right", "bottom", "left"]) assert.match(css, new RegExp(`env\\(safe-area-inset-${lado}\\)`), `sin safe-area-inset-${lado}`);
  assert.match(css, /object-fit: cover/);
  assert.match(css, /\.pantalla-inicio__seo a \{[^}]*color: var\(--blanco\);[^}]*text-decoration: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /z-index: 9999/);
  // Los colores, de los tokens de costaviva.css (rgba de --mar aparte).
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-f]{3,8}\b/i, "color suelto: usar un token");
});

test("iOS: imágenes de arranque generadas para cada iPhone y declaradas en index y login", () => {
  const vistos = new Set();
  for (const d of DISPOSITIVOS) {
    const url = rutaArranque(d);
    assert.ok(!vistos.has(url), `repetida ${url}`);
    vistos.add(url);
    assert.deepEqual(medidas(join(RAIZ, url)), { w: d.w * d.dpr, h: d.h * d.dpr, tipo: "jpg" }, url);
    assert.ok(esRutaPermitida(url), url);
  }
  // Ni una de más en la carpeta (de una foto o un modelo anteriores).
  assert.deepEqual(readdirSync(join(RAIZ, "assets/inicio/arranque")).sort(), [...vistos].map((u) => u.split("/").pop()).sort());
  for (const p of PAGINAS_ARRANQUE) {
    const html = leer(p);
    assert.ok(html.includes(bloqueArranque()), `${p}: bloque de arranque desfasado; ejecuta scripts/inicio/generar-pantallas-inicio.mjs`);
    assert.equal(conBloqueArranque(html), html, `${p}: regenerar no debe cambiar nada`);
    assert.ok(html.indexOf(bloqueArranque()) < html.indexOf("</head>"), p);
  }
  assert.match(bloqueArranque(), /media="screen and \(device-width: 390px\) and \(device-height: 844px\) and \(-webkit-device-pixel-ratio: 3\) and \(orientation: portrait\)" href="\/assets\/inicio\/arranque\/arranque-1170x2532\.jpg"/);
  // Insertar en una página sin bloque lo cuelga tras el theme-color.
  const nuevo = conBloqueArranque('<head>\n<meta name="theme-color" content="#0B1E3F" />\n</head>');
  assert.ok(nuevo.startsWith('<head>\n<meta name="theme-color" content="#0B1E3F" />\n<!-- arranque-ios -->'));
});

test("manifest y caché: fondo y tema en --mar, /assets/inicio/* con una semana de caché", () => {
  const m = JSON.parse(leer("manifest.json"));
  const mar = leer("assets/css/costaviva.css").match(/--mar: (#[0-9A-Fa-f]{6});/)[1];
  assert.equal(m.background_color.toUpperCase(), mar.toUpperCase());
  assert.equal(m.theme_color.toUpperCase(), mar.toUpperCase());
  assert.match(leer("_headers"), /^\/assets\/inicio\/\*\n\s+Cache-Control: public, max-age=604800$/m);
});
