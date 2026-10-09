// Páginas públicas e indexables (/spots, /especies), sitemap.xml, robots.txt
// y las reglas de indexación del middleware (2026-10-08, SEO). Sin red: los
// datos salen del repo y de test/fixtures/seo-*.json (respuestas reales de
// /prevision y /meteo/* de Bakio del 2026-10-08). Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { decisionIndexacion, PAGINAS_PRIVADAS } from "../functions/_lib/seo/indexacion.js";
import { urlsSitemap } from "../functions/_lib/seo/sitemap.js";
import { RIOS_SPOT, TEXTO_INTERNO_PUBLICO, slugEspecie, REGIONES_MAREAS } from "../functions/_lib/seo/datos.js";
import { serieHorariaSpot, indiceDeHoy, condicionesDePrevision } from "../functions/_lib/seo/indice-hoy.js";
import { SPOTS } from "../functions/prevision.js";
import * as rutaSpot from "../functions/spots/[slug].js";
import * as rutaSpots from "../functions/spots/index.js";
import * as rutaRegion from "../functions/spots/region/[region].js";
import * as rutaEspecies from "../functions/especies/index.js";
import * as rutaEspecie from "../functions/especies/[slug].js";
import { datosEspeciesVisibles } from "../functions/_lib/regiones-activas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const json = (r) => JSON.parse(leer(r));
// Solo las especies públicas: las de NZ (región oculta, fase 2c) no tienen
// página ni entran en el sitemap (test/nz-especies.test.js lo comprueba).
const especies = datosEspeciesVisibles(json("assets/datos/especies.json"));
const prevision = json("test/fixtures/seo-prevision.json");
const marino = json("test/fixtures/seo-marine-bakio.json");
const tiempo = json("test/fixtures/seo-forecast-bakio.json");

// ---------------------------------------------------------------------------
// Doble de Cloudflare: env.ASSETS lee del repo; fetch sirve los fixtures.
// ---------------------------------------------------------------------------
function contexto(ruta, params = {}) {
  return {
    request: new Request(`https://costaviva.org${ruta}`),
    params,
    env: {
      ASSETS: {
        fetch: async (url) => {
          const p = new URL(url).pathname;
          try {
            return new Response(leer(p.slice(1)), { headers: { "content-type": "application/json" } });
          } catch {
            return new Response("no", { status: 404 });
          }
        },
      },
    },
    waitUntil: () => {},
  };
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url) => {
  const p = new URL(typeof url === "string" ? url : url.url);
  if (p.pathname === "/prevision") return new Response(JSON.stringify(prevision));
  if (p.pathname === "/meteo/marine") return new Response(JSON.stringify(marino));
  if (p.pathname === "/meteo/forecast") return new Response(JSON.stringify(tiempo));
  return fetchOriginal(url);
};

async function html(resp) {
  return { status: resp.status, headers: resp.headers, texto: await resp.text() };
}
function visible(h) {
  return h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
}
function etiquetasObligatorias(h, canonical) {
  assert.match(h, /^<!doctype html>\s*<html lang="es">/i);
  assert.match(h, /<meta name="viewport"/);
  const titulo = /<title>([^<]+)<\/title>/.exec(h)?.[1];
  assert.ok(titulo && titulo.length >= 20 && titulo.length <= 110, `título raro: ${titulo}`);
  const desc = /<meta name="description" content="([^"]+)"/.exec(h)?.[1];
  assert.ok(desc && desc.length >= 60 && desc.length <= 320, `descripción raro: ${desc}`);
  assert.ok(h.includes(`<link rel="canonical" href="${canonical}">`), `falta canonical ${canonical}`);
  assert.ok(h.includes(`<meta property="og:url" content="${canonical}">`));
  for (const m of ["og:title", "og:description", "og:image", "og:locale"]) assert.ok(h.includes(`property="${m}"`), m);
  assert.ok(h.includes('name="twitter:card"'));
  assert.equal((h.match(/<h1[ >]/g) || []).length, 1, "un solo h1");
  // Ningún on*= (la CSP con nonce los bloquearía) ni scripts que no sean JSON-LD.
  assert.doesNotMatch(h, /\son[a-z]+\s*=/i);
  const scripts = h.match(/<script\b[^>]*>/g) || [];
  for (const s of scripts) assert.equal(s, '<script type="application/ld+json">');
  const lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.ok(lds.some((x) => x["@type"] === "BreadcrumbList"), "BreadcrumbList");
  assert.doesNotMatch(h, /noindex/);
  return { titulo, desc, lds };
}

// ---------------------------------------------------------------------------
test("rutas públicas: spots y especies pasan la lista blanca, lo parecido no", () => {
  for (const r of ["/spots", "/spots/", "/spots/bakio", "/spots/region/pais-vasco", "/especies", "/especies/", "/especies/lubina", "/assets/css/publico.css"]) {
    assert.equal(esRutaPermitida(r), true, r);
  }
  for (const r of ["/spotsx", "/especiesx", "/spots.json", "/functions/spots/index.js", "/functions/_lib/seo/base.js"]) {
    assert.equal(esRutaPermitida(r), false, r);
  }
});

test("indexación: un solo dominio, https, previews y app privada con noindex", () => {
  assert.deepEqual(decisionIndexacion("http://costaviva.org/spots/bakio?x=1"), { redirigir: "https://costaviva.org/spots/bakio?x=1", noindex: false });
  assert.deepEqual(decisionIndexacion("https://fishnow-59u.pages.dev/mareas/bakio"), { redirigir: "https://costaviva.org/mareas/bakio", noindex: false });
  assert.deepEqual(decisionIndexacion("https://fishnow-59u.pages.dev/"), { redirigir: "https://costaviva.org/", noindex: false });
  // Endpoints y POST en el alias: no se redirigen (Stripe, crons), noindex.
  assert.deepEqual(decisionIndexacion("https://fishnow-59u.pages.dev/stripe-webhook", "POST"), { redirigir: null, noindex: true });
  assert.deepEqual(decisionIndexacion("https://fishnow-59u.pages.dev/prevision"), { redirigir: null, noindex: true });
  assert.deepEqual(decisionIndexacion("https://fishnow-59u.pages.dev/login", "POST"), { redirigir: null, noindex: true });
  // Previews de las PR: sin redirección (Mikel las revisa) y con noindex.
  assert.deepEqual(decisionIndexacion("https://claude-seo.fishnow-59u.pages.dev/spots/bakio"), { redirigir: null, noindex: true });
  assert.deepEqual(decisionIndexacion("https://1a2b3c4d.fishnow-59u.pages.dev/"), { redirigir: null, noindex: true });
  // Dominio principal: públicas indexables, privadas con noindex.
  for (const r of ["/", "/login", "/login.html", "/mareas", "/spots/bakio", "/especies/lubina", "/privacidad"]) {
    assert.equal(decisionIndexacion(`https://costaviva.org${r}`).noindex, false, r);
  }
  for (const r of PAGINAS_PRIVADAS) assert.equal(decisionIndexacion(`https://costaviva.org${r}`).noindex, true, r);
  assert.equal(PAGINAS_PRIVADAS.has("/login"), false, "nunca noindex en /login (ver CLAUDE.md)");
});

test("middleware: aplica la redirección y el noindex", async () => {
  const { onRequest } = await import("../functions/_middleware.js");
  globalThis.HTMLRewriter ??= class { on() { return this; } transform(r) { return r; } };
  const next = async () => new Response("<p>hola</p>", { headers: { "content-type": "text/html" } });
  const r1 = await onRequest({ request: new Request("https://fishnow-59u.pages.dev/spots"), next });
  assert.equal(r1.status, 301);
  assert.equal(r1.headers.get("location"), "https://costaviva.org/spots");
  const r2 = await onRequest({ request: new Request("https://costaviva.org/diario"), next });
  assert.equal(r2.headers.get("x-robots-tag"), "noindex");
  const r3 = await onRequest({ request: new Request("https://costaviva.org/spots"), next });
  assert.equal(r3.headers.get("x-robots-tag"), null);
  const r4 = await onRequest({ request: new Request("https://costaviva.org/CLAUDE.md"), next });
  assert.equal(r4.status, 404);
});

test("sitemap.xml: generado de los datos, válido y solo con URLs públicas", () => {
  const xml = leer("sitemap.xml");
  execFileSync(process.execPath, [join(RAIZ, "scripts/seo/generar-sitemap.mjs"), "--check"], { stdio: "pipe" });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.equal((xml.match(/<url>/g) || []).length, (xml.match(/<\/url>/g) || []).length);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert.equal(lastmods.length, locs.length);
  for (const f of lastmods) assert.match(f, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(locs).size, locs.length, "sin URLs repetidas");
  assert.ok(locs.length < 50000);
  for (const l of locs) {
    assert.ok(l.startsWith("https://costaviva.org/"), l);
    const ruta = new URL(l).pathname;
    assert.equal(esRutaPermitida(ruta), true, `${ruta} no pasa la lista blanca`);
    assert.equal(decisionIndexacion(l).noindex, false, `${ruta} tiene noindex`);
    assert.ok(!/\/login|\.html$/.test(ruta), `${ruta} no debe ir al sitemap`);
  }
  const esperadas = [
    "/", "/spots", "/especies", "/mareas", "/privacidad",
    ...SPOTS.map((s) => `/spots/${s.slug}`), ...SPOTS.map((s) => `/mareas/${s.slug}`),
    ...REGIONES_MAREAS.map((r) => `/spots/region/${r.slug}`), ...REGIONES_MAREAS.map((r) => `/mareas/region/${r.slug}`),
    ...especies.especies.map((e) => `/especies/${slugEspecie(e.id)}`),
  ];
  for (const r of esperadas) assert.ok(locs.includes(`https://costaviva.org${r}`), `falta ${r}`);
  assert.equal(urlsSitemap({ spots: SPOTS, especies, tipoFondo: null, profundidad: null }).length, locs.length);
});

test("robots.txt: permite lo público, bloquea la app y apunta al sitemap", () => {
  const r = leer("robots.txt");
  assert.match(r, /^User-agent: \*$/m);
  assert.match(r, /^Allow: \/$/m);
  assert.match(r, /^Sitemap: https:\/\/costaviva\.org\/sitemap\.xml$/m);
  const bloqueadas = [...r.matchAll(/^Disallow:\s*(\S*)$/gm)].map((m) => m[1]);
  for (const p of ["/diario", "/alarma", "/grupos", "/suscripcion", "/admin", "/etiquetar-olas"]) assert.ok(bloqueadas.includes(p), p);
  for (const libre of ["/", "/login", "/spots/bakio", "/especies/lubina", "/mareas/bakio", "/assets/css/publico.css", "/prevision", "/meteo/forecast", "/privacidad"]) {
    assert.ok(!bloqueadas.some((b) => b && libre.startsWith(b)), `${libre} no debe bloquearse`);
  }
});

test("/spots/bakio: HTML en la respuesta, etiquetas SEO, datos de hoy e índice", async () => {
  const r = await html(await rutaSpot.onRequestGet(contexto("/spots/bakio", { slug: "bakio" })));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /max-age=\d+/);
  const { lds } = etiquetasObligatorias(r.texto, "https://costaviva.org/spots/bakio");
  assert.ok(r.texto.includes("<h1>Pesca en Bakio</h1>"));
  const lugar = lds.find((x) => Array.isArray(x["@type"]) && x["@type"].includes("Place"));
  assert.equal(lugar.geo.latitude, 43.4297);
  const t = visible(r.texto);
  for (const trozo of ["Condiciones de hoy", "Desde costa", "Embarcación", "Submarina", "Fondo y profundidad", "Estepona", "Spots cercanos"]) {
    assert.ok(t.includes(trozo), `falta "${trozo}"`);
  }
  assert.ok(r.texto.includes('href="/mareas/bakio"'), "enlaza a su página de mareas");
  assert.ok(r.texto.includes('href="/spots/region/pais-vasco"'));
  assert.ok(r.texto.includes('href="/especies/lubina"'), "enlaza a especies");
  assert.ok(r.texto.includes('href="/login?alta=1"'), "CTA");
  assert.doesNotMatch(t, TEXTO_INTERNO_PUBLICO);
});

test("condiciones de hoy: índice de pesca con flechas a partir de los datos reales", () => {
  const spot = prevision.spots.find((s) => s.slug === "bakio");
  const horas = serieHorariaSpot(spot, marino, tiempo);
  const ind = indiceDeHoy(especies, spot, horas, { ahoraISO: "2026-10-08T18:00" });
  assert.ok(ind && ind.puntuacion >= 0 && ind.puntuacion <= 100);
  assert.ok(["bueno", "medio", "malo"].includes(ind.nivel));
  assert.ok(ind.especie);
  assert.ok(ind.motivos.length > 0 && ind.motivos.every((m) => /^(▲▲?|▼▼?)$/.test(m.flecha)));
  assert.equal(indiceDeHoy(especies, spot, horas, { ahoraISO: "2030-01-01T00:00" }), null, "sin datos de esa hora, sin índice");
  const c = condicionesDePrevision(spot);
  assert.match(c.ola, /m$/);
  assert.equal(condicionesDePrevision({ slug: "x", error: "fallo" }), null);
});

test("/spots/<slug> sin datos de hoy: sale igual, sin índice y con caché corta", async () => {
  const guardado = globalThis.fetch;
  globalThis.fetch = async () => new Response("caído", { status: 503 });
  try {
    const r = await html(await rutaSpot.onRequestGet(contexto("/spots/mundaka", { slug: "mundaka" })));
    assert.equal(r.status, 200);
    assert.ok(r.texto.includes("no tenemos los datos de hoy"));
    assert.match(r.headers.get("cache-control"), /max-age=300/);
  } finally {
    globalThis.fetch = guardado;
  }
});

test("todas las páginas de spot y especie: 200, únicas y sin notas internas", async () => {
  const titulos = new Set(), descs = new Set();
  for (const s of SPOTS) {
    const r = await html(await rutaSpot.onRequestGet(contexto(`/spots/${s.slug}`, { slug: s.slug })));
    assert.equal(r.status, 200, s.slug);
    const { titulo, desc } = etiquetasObligatorias(r.texto, `https://costaviva.org/spots/${s.slug}`);
    titulos.add(titulo); descs.add(desc);
    const fuga = visible(r.texto).match(new RegExp(`.{0,60}(${TEXTO_INTERNO_PUBLICO.source}).{0,40}`, "i"));
    assert.equal(fuga, null, `${s.slug}: ${fuga?.[0]}`);
  }
  for (const e of especies.especies) {
    const slug = slugEspecie(e.id);
    const r = await html(await rutaEspecie.onRequestGet(contexto(`/especies/${slug}`, { slug })));
    assert.equal(r.status, 200, slug);
    const { titulo, desc } = etiquetasObligatorias(r.texto, `https://costaviva.org/especies/${slug}`);
    titulos.add(titulo); descs.add(desc);
    const t = visible(r.texto);
    assert.doesNotMatch(t, TEXTO_INTERNO_PUBLICO, slug);
    assert.ok(t.includes(e.nombres.es), slug);
  }
  const total = SPOTS.length + especies.especies.length;
  assert.equal(titulos.size, total, "títulos únicos");
  assert.equal(descs.size, total, "descripciones únicas");
});

test("/especies/lubina: nombres, tallas con norma, temporada y dónde pescarla", async () => {
  const r = await html(await rutaEspecie.onRequestGet(contexto("/especies/lubina", { slug: "lubina" })));
  const t = visible(r.texto);
  for (const trozo of ["Dicentrarchus labrax", "Llobarro", "Robalo-legítimo", "Temporada por zonas", "Talla mínima", "42 cm", "Dónde pescar lubina", "Cebos"]) {
    assert.ok(t.includes(trozo), `falta "${trozo}"`);
  }
  assert.ok(r.texto.includes('href="/spots/bakio"'));
  assert.ok(r.texto.includes("https://www.boe.es/"), "enlace a la norma");
});

test("índices y regiones: enlazan a todo", async () => {
  const s = await html(await rutaSpots.onRequestGet(contexto("/spots")));
  etiquetasObligatorias(s.texto, "https://costaviva.org/spots");
  for (const sp of SPOTS) assert.ok(s.texto.includes(`href="/spots/${sp.slug}"`), sp.slug);
  const e = await html(await rutaEspecies.onRequestGet(contexto("/especies")));
  etiquetasObligatorias(e.texto, "https://costaviva.org/especies");
  for (const x of especies.especies) assert.ok(e.texto.includes(`href="/especies/${slugEspecie(x.id)}"`), x.id);
  for (const reg of REGIONES_MAREAS) {
    const r = await html(await rutaRegion.onRequestGet(contexto(`/spots/region/${reg.slug}`, { region: reg.slug })));
    assert.equal(r.status, 200);
    etiquetasObligatorias(r.texto, `https://costaviva.org/spots/region/${reg.slug}`);
    assert.ok(r.texto.includes(`href="/mareas/region/${reg.slug}"`));
  }
});

test("404 de verdad con noindex, y redirecciones a la URL única", async () => {
  for (const [mod, ruta, params] of [
    [rutaSpot, "/spots/no-existe", { slug: "no-existe" }],
    [rutaEspecie, "/especies/no-existe", { slug: "no-existe" }],
    [rutaRegion, "/spots/region/narnia", { region: "narnia" }],
  ]) {
    const r = await html(await mod.onRequestGet(contexto(ruta, params)));
    assert.equal(r.status, 404, ruta);
    assert.equal(r.headers.get("x-robots-tag"), "noindex");
    assert.match(r.texto, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(r.texto, /rel="canonical"/);
  }
  const barra = await rutaSpots.onRequestGet(contexto("/spots/"));
  assert.equal(barra.status, 301);
  assert.equal(barra.headers.get("location"), "https://costaviva.org/spots");
  const guion = await rutaEspecie.onRequestGet(contexto("/especies/bonito_norte", { slug: "bonito_norte" }));
  assert.equal(guion.status, 301);
  assert.equal(guion.headers.get("location"), "https://costaviva.org/especies/bonito-norte");
});

test("ríos de los spots: la copia sigue igual que RIOS de index.html", () => {
  const indexHtml = leer("index.html");
  const pares = [...indexHtml.matchAll(/rio: "([^"]+)", spotCosta: "([^"]+)"/g)].map((m) => [m[2], m[1]]);
  assert.ok(pares.length > 0);
  assert.deepEqual(Object.fromEntries(pares), Object.fromEntries(Object.entries(RIOS_SPOT).map(([k, v]) => [k, v.rio])));
});

test("portada: HTML para buscadores con enlaces a las páginas públicas", () => {
  const indexHtml = leer("index.html");
  assert.ok(indexHtml.includes('<link rel="canonical" href="https://costaviva.org/" />'));
  for (const r of ["/spots", "/especies", "/mareas"]) assert.ok(indexHtml.includes(`href="${r}"`), r);
  const login = leer("login.html");
  assert.ok(login.includes('<link rel="canonical" href="https://costaviva.org/" />'), "login sigue con canonical a /");
  assert.doesNotMatch(login, /noindex/);
  for (const r of ["/spots", "/especies"]) assert.ok(login.includes(`href="${r}"`), r);
  const mareas = leer("functions/mareas/[slug].js");
  assert.ok(mareas.includes('href="/spots/${spot.slug}"'), "mareas enlaza a su spot");
});
