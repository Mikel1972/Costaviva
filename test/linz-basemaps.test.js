// Fondo satélite de Nueva Zelanda con LINZ Basemaps (2026-11-09).
// La clave NUNCA está en el repo: llega de la variable LINZ_BASEMAPS_KEY de
// Cloudflare Pages, que el middleware mete en un <meta> de la página del mapa
// (functions/_lib/linz-basemaps.js). Sin ella no se pide nada a LINZ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  URL_LINZ_AEREA, ATRIBUCION_LINZ_BASEMAPS, RECTANGULOS_NZ, RECTANGULOS_ESPANA, META_CLAVE_LINZ,
  urlTeselaLinz, claveLinzDePagina, dentroDeNZ, dentroDeEspana, vistaTocaNZ,
} from "../assets/js/capa-satelite.js";
import { conClaveLinz, claveLinzValida, PAGINAS_CON_MAPA } from "../functions/_lib/linz-basemaps.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const CLAVE = "c01abcdefghij0123456789xyz"; // inventada, solo para el test

test("la clave de LINZ no está en ningún fichero del repo", () => {
  const ficheros = execFileSync("git", ["ls-files"], { cwd: raiz, encoding: "utf8" })
    .split("\n").filter((f) => f && /\.(js|mjs|html|json|md|yml|yaml|toml|txt)$/.test(f) && f !== "test/linz-basemaps.test.js");
  for (const f of ficheros) {
    const t = leer(f);
    assert.doesNotMatch(t, /basemaps\.linz\.govt\.nz[^\s"'`]*[?&]api=[A-Za-z0-9]/, f);
    assert.doesNotMatch(t, /LINZ_BASEMAPS_KEY\s*[=:]\s*["'][A-Za-z0-9]/, f);
  }
  // El código pide la clave a la variable de entorno, no a una constante.
  assert.match(leer("functions/_middleware.js"), /clave: context\.env\?\.LINZ_BASEMAPS_KEY/);
});

test("URL de teselas: aerial, WebMercatorQuad, webp y ?api= con la clave; sin clave válida, null", () => {
  assert.equal(URL_LINZ_AEREA, "https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp");
  assert.equal(urlTeselaLinz(CLAVE), `${URL_LINZ_AEREA}?api=${CLAVE}`);
  assert.equal(urlTeselaLinz(`  ${CLAVE}\n`), `${URL_LINZ_AEREA}?api=${CLAVE}`);
  for (const mala of [undefined, null, "", "corta", 'x"><script>alert(1)</script>', "a b c d e f g h i j k"]) {
    assert.equal(urlTeselaLinz(mala), null, String(mala));
  }
});

test("atribución de LINZ: CC BY 4.0, Imagery Basemap contributors y enlace a su página", () => {
  assert.match(ATRIBUCION_LINZ_BASEMAPS, /LINZ CC BY 4\.0 © Imagery Basemap contributors/);
  assert.match(ATRIBUCION_LINZ_BASEMAPS, /href="https:\/\/www\.linz\.govt\.nz\/data\/linz-data\/linz-basemaps\/data-attribution"/);
  assert.match(ATRIBUCION_LINZ_BASEMAPS, /target="_blank" rel="noopener"/);
});

test("solo en Nueva Zelanda: todos los spots de NZ dentro, nada de España ni Portugal", () => {
  for (const s of SPOTS_NZ) assert.ok(dentroDeNZ(s.lat, s.lon), s.slug);
  for (const [la, lo] of [[43.43, -2.81], [38.72, -9.14], [28.14, -15.43], [39.57, 2.65]]) assert.ok(!dentroDeNZ(la, lo));
  for (const s of SPOTS_NZ) assert.ok(!dentroDeEspana(s.lat, s.lon), s.slug);
  assert.ok(!RECTANGULOS_ESPANA.some((r) => vistaTocaNZ(r)), "los rectángulos de España no tocan NZ");
  assert.ok(vistaTocaNZ([[-38.2, 174.6], [-37.6, 175.1]]), "Raglan-Kawhia");
  assert.ok(!vistaTocaNZ([[43.0, -3.5], [43.6, -1.8]]), "Bizkaia");
  assert.equal(RECTANGULOS_NZ.length, 1);
});

test("navegador: la clave se lee de la <meta> que pone el middleware; sin ella, nada", () => {
  const doc = (content) => ({
    querySelector: (sel) => (sel === `meta[name="${META_CLAVE_LINZ}"]` && content !== undefined ? { getAttribute: () => content } : null),
  });
  assert.equal(claveLinzDePagina(doc(CLAVE)), CLAVE);
  assert.equal(claveLinzDePagina(doc(undefined)), null);
  assert.equal(claveLinzDePagina(doc("")), null);
  assert.equal(claveLinzDePagina(doc("<mala>")), null);
  assert.equal(claveLinzDePagina(undefined), null, "sin document (Node)");
  assert.equal(claveLinzDePagina(), null);
  // Sin clave no se monta ninguna capa de LINZ ni se cita.
  const capa = leer("assets/js/capa-satelite.js");
  assert.match(capa, /const urlLinz = urlTeselaLinz\(claveLinzDePagina\(\)\);\n\s+if \(urlLinz\) \{/);
  assert.match(capa, /directas: urlLinz \? \[\{ id: "linz", url: urlLinz, rectangulos: RECTANGULOS_NZ \}\] : \[\]/);
  assert.match(capa, /const debe = !!urlLinz && visible && vistaTocaNZ/);
  // El mapa vectorial pinta las fuentes directas dentro de sus rectángulos.
  const base = leer("assets/js/mapa-base.js");
  assert.match(base, /\(cfg\.directas \|\| \[\]\)\.forEach/);
  assert.match(base, /tiles: \[f\.url\], tileSize: 256, maxzoom: cfg\.maxzoom, bounds:/);
});

// Doble mínimo de HTMLRewriter: "head" -> append antes de </head>.
class RewriterFalso {
  constructor() { this.h = []; }
  on(sel, handler) { this.h.push({ sel, handler }); return this; }
  transform(resp) {
    const h = this.h;
    const cuerpo = resp.text().then((html) => html.replace(/<\/head>/i, () => {
      let extra = "";
      for (const { sel, handler } of h) if (sel === "head") handler.element({ append: (c, o) => { assert.deepEqual(o, { html: true }); extra += c; } });
      return `${extra}</head>`;
    }));
    return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await cuerpo)); c.close(); } }), { headers: resp.headers });
  }
}
const pagina = () => new Response("<html><head><title>x</title></head><body></body></html>", { headers: { "content-type": "text/html; charset=utf-8" } });

test("middleware: con LINZ_BASEMAPS_KEY, <meta> en la página del mapa", async () => {
  for (const pathname of ["/", "/index.html"]) {
    const r = conClaveLinz(pagina(), { clave: CLAVE, pathname, Rewriter: RewriterFalso });
    assert.match(await r.text(), new RegExp(`<meta name="linz-basemaps-key" content="${CLAVE}"></head>`));
  }
  assert.deepEqual([...PAGINAS_CON_MAPA], ["/", "/index.html"]);
});

test("middleware: sin variable, con un valor raro, en otra página o sin HTML, la respuesta no se toca", () => {
  const casos = [
    { clave: undefined, pathname: "/" },
    { clave: "", pathname: "/" },
    { clave: 'x"><script>', pathname: "/" },
    { clave: CLAVE, pathname: "/login" },
    { clave: CLAVE, pathname: "/en/spots/nz-raglan" },
  ];
  for (const c of casos) {
    const p = pagina();
    assert.equal(conClaveLinz(p, { ...c, Rewriter: RewriterFalso }), p, JSON.stringify(c));
  }
  const json = new Response("{}", { headers: { "content-type": "application/json" } });
  assert.equal(conClaveLinz(json, { clave: CLAVE, pathname: "/", Rewriter: RewriterFalso }), json);
  assert.equal(claveLinzValida(` ${CLAVE} `), CLAVE);
  assert.equal(claveLinzValida(undefined), null);
});
