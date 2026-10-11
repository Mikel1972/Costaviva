// Páginas públicas en portugués (/pt/, 2026-10-11; functions/_lib/seo/paginas-pt.js
// y functions/pt/**). Sin red: datos del repo y los fixtures de
// test/seo-paginas.test.js (un spot de Portugal se monta con la forma real
// de /prevision). Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SPOTS_ES as SPOTS } from "../functions/prevision.js";
import { datosEspeciesDePais } from "../functions/_lib/regiones-activas.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { urlsSitemap } from "../functions/_lib/seo/sitemap.js";
import { enlacesHreflang, idiomaDeRuta, rutaIdioma } from "../functions/_lib/seo/idiomas.js";
import {
  paginaEspeciePt, paginaIndiceEspeciesPt, paginaRegionSpotsPt, paginaMareaPt, paginaRegionMareasPt, paginaSpotPt,
  spotsPT, textoMesesPt, nombrePt, motivoPt, condicionesPt,
} from "../functions/_lib/seo/paginas-pt.js";
import { paginaEspecie, paginaSpot, paginaRegionSpots } from "../functions/_lib/seo/paginas.js";
import { REGIONES_MAREAS } from "../functions/_lib/seo/datos.js";
import * as rutaSpotPt from "../functions/pt/spots/[slug].js";
import * as rutaMareaPt from "../functions/pt/mareas/[slug].js";
import * as rutaEspeciePt from "../functions/pt/especies/[slug].js";
import * as rutaMareaEs from "../functions/mareas/[slug].js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
const json = (r) => JSON.parse(leer(r));
const especies = datosEspeciesDePais(json("assets/datos/especies.json"), "es");
const prevision = json("test/fixtures/seo-prevision.json");
const cascais = SPOTS.find((s) => s.slug === "cascais");
// /prevision de Cascais con la forma real (la de Mundaka del fixture, en su sitio).
const spCascais = { ...prevision.spots[0], slug: "cascais", nombre: cascais.nombre, lat: cascais.lat, lon: cascais.lon };
const prevPt = { ...prevision, spots: [...prevision.spots, spCascais] };

const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url) => {
  const p = new URL(typeof url === "string" ? url : url.url);
  if (p.pathname === "/prevision") return new Response(JSON.stringify(prevPt));
  if (p.pathname === "/meteo/marine") return new Response(leer("test/fixtures/seo-marine-bakio.json"));
  if (p.pathname === "/meteo/forecast") return new Response(leer("test/fixtures/seo-forecast-bakio.json"));
  return fetchOriginal(url);
};
function contexto(ruta, params = {}) {
  return {
    request: new Request(`https://costaviva.org${ruta}`), params, waitUntil: () => {},
    env: { ASSETS: { fetch: async (url) => { try { return new Response(leer(new URL(url).pathname.slice(1))); } catch { return new Response("no", { status: 404 }); } } } },
  };
}

const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
// Lo común de toda página /pt/: idioma, canónica /pt/, hreflang es + pt-PT +
// x-default (español), JSON-LD válido, sin on*= ni castellano a la vista.
function comprobarPt(h, ruta) {
  assert.match(h, /^<!doctype html>\s*<html lang="pt-PT">/i);
  assert.ok(h.includes(`<link rel="canonical" href="https://costaviva.org/pt${ruta}">`), `canónica /pt${ruta}`);
  assert.ok(h.includes(`<link rel="alternate" hreflang="es" href="https://costaviva.org${ruta}">`), "hreflang es");
  assert.ok(h.includes(`<link rel="alternate" hreflang="pt-PT" href="https://costaviva.org/pt${ruta}">`), "hreflang pt-PT");
  assert.ok(h.includes(`<link rel="alternate" hreflang="x-default" href="https://costaviva.org${ruta}">`), "x-default");
  assert.ok(h.includes('<meta property="og:locale" content="pt_PT">'));
  assert.equal((h.match(/<h1[ >]/g) || []).length, 1, "un solo h1");
  assert.doesNotMatch(h, /\son[a-z]+\s*=/i, "sin on*= (CSP)");
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  const texto = visible(h).replace(/Puertos del Estado|España \(español\)|\(em espanhol\)|\(espanhol\)/g, "");
  assert.doesNotMatch(texto, /[ñ¿¡]|\b(Especies|Mareas hoy|Temporada|Pesca en|desde costa|Talla mínima|pleamar|bajamar|Sin tarjeta|Prueba Costaviva)\b/, "castellano en una página /pt/");
  assert.doesNotMatch(texto, /\b(tela|celular|usuário|contato|isca)\b/i, "brasileñismos");
  assert.doesNotMatch(texto, /pendiente|por confirmar|heur[ií]stic|\bojo\b/i, "notas internas");
}

test("idiomas: /pt/ con hreflang pt-PT y x-default en español", () => {
  assert.equal(rutaIdioma("/spots/cascais", "pt"), "/pt/spots/cascais");
  assert.deepEqual(idiomaDeRuta("/pt/especies/lubina"), { idioma: "pt", ruta: "/especies/lubina" });
  const h = enlacesHreflang("/spots/cascais", "https://costaviva.org", ["es", "pt"]);
  assert.match(h, /hreflang="pt-PT" href="https:\/\/costaviva\.org\/pt\/spots\/cascais"/);
  assert.match(h, /hreflang="x-default" href="https:\/\/costaviva\.org\/spots\/cascais"/);
  assert.equal(enlacesHreflang("/spots/bakio", "https://costaviva.org", ["es"]), "", "España sin versión pt: igual que siempre");
});

test("rutas /pt/ en la lista blanca", () => {
  for (const r of ["/pt", "/pt/spots/cascais", "/pt/mareas/region/portugal", "/pt/especies/lubina"]) assert.equal(esRutaPermitida(r), true, r);
  assert.equal(esRutaPermitida("/ptx"), false);
});

test("utilidades: meses, nombres, condiciones y motivos en portugués", () => {
  assert.equal(textoMesesPt([10, 11, 12, 1, 2, 3]), "out–mar");
  assert.equal(textoMesesPt([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "Todo o ano");
  const lubina = especies.especies.find((e) => e.id === "lubina");
  assert.equal(nombrePt(lubina), "Robalo-legítimo");
  const c = condicionesPt(spCascais);
  assert.match(c.marea, /a vazar|a encher/);
  assert.match(c.mareaDetalle, /baixa-mar|preia-mar/);
  assert.equal(motivoPt({ clave: "va.marea.subiendo", texto: "marea subiendo" }, especies), "maré a encher");
  const regla = especies.reglas_expertas.reglas[0];
  assert.equal(motivoPt({ texto: regla.texto }, especies), regla.texto_pt);
  assert.equal(motivoPt({ texto: "algo sin traducir" }, especies), null, "sin traducción no se enseña");
});

test("/pt/especies/<slug>: ficha en portugués con el par hreflang", () => {
  const lubina = especies.especies.find((e) => e.id === "lubina");
  const { html } = paginaEspeciePt(lubina, especies, SPOTS, 10);
  comprobarPt(html, "/especies/lubina");
  assert.match(html, /<h1>.*Robalo-legítimo<\/h1>/);
  assert.match(html, /Tamanho mínimo/);
  assert.match(html, /href="\/pt\/spots\/cascais"/, "pesqueiros de Portugal donde pescarla");
  // Y la española, con el mismo par.
  const es = paginaEspecie(lubina, especies, SPOTS, 10).html;
  assert.match(es, /hreflang="pt-PT" href="https:\/\/costaviva\.org\/pt\/especies\/lubina"/);
});

test("/pt/especies: índice con todas las especies de España y Portugal", () => {
  const { html } = paginaIndiceEspeciesPt(especies, 10);
  comprobarPt(html, "/especies");
  for (const e of especies.especies) assert.ok(html.includes(`href="/pt/especies/${e.id.replace(/_/g, "-")}"`), e.id);
});

test("/pt/spots/region/portugal y la española con su par", () => {
  const { html } = paginaRegionSpotsPt(SPOTS, especies, 10);
  comprobarPt(html, "/spots/region/portugal");
  assert.equal((html.match(/<li><a href="\/pt\/spots\/[a-z]+">/g) || []).length, spotsPT(SPOTS).length);
  const region = REGIONES_MAREAS.find((r) => r.slug === "portugal");
  assert.match(paginaRegionSpots(region, SPOTS, especies, 10).html, /hreflang="pt-PT"/);
  const galicia = REGIONES_MAREAS.find((r) => r.slug === "galicia");
  assert.doesNotMatch(paginaRegionSpots(galicia, SPOTS, especies, 10).html, /hreflang/, "las regiones de España no cambian");
});

test("/pt/spots/<slug>: pesca en un spot de Portugal (handler real)", async () => {
  const resp = await rutaSpotPt.onRequestGet(contexto("/pt/spots/cascais", { slug: "cascais" }));
  assert.equal(resp.status, 200);
  const h = await resp.text();
  comprobarPt(h, "/spots/cascais");
  assert.match(h, /<h1>Pesca em Cascais<\/h1>/);
  assert.match(h, /O que se pesca em Cascais/);
  assert.match(h, /href="\/pt\/mareas\/cascais"/);
  // Un spot de España no tiene versión pt.
  const no = await rutaSpotPt.onRequestGet(contexto("/pt/spots/bakio", { slug: "bakio" }));
  assert.equal(no.status, 404);
  // La española de Cascais lleva el par; la de Bakio, no.
  const d = { especiesDatos: especies, tipoFondo: null, profundidad: null, caudales: null, camarasApp: {}, cond: null, indice: null, mes: 10 };
  assert.match(paginaSpot(cascais, SPOTS, d).html, /hreflang="pt-PT" href="https:\/\/costaviva\.org\/pt\/spots\/cascais"/);
  assert.doesNotMatch(paginaSpot(SPOTS.find((s) => s.slug === "bakio"), SPOTS, d).html, /hreflang/);
  assert.match(paginaSpotPt(cascais, SPOTS, { ...d, spotPrev: null }).html, /Condições de hoje/);
});

test("/pt/mareas/<slug> y /pt/mareas/region/portugal; /mareas/<spot de Portugal> con su par", async () => {
  const resp = await rutaMareaPt.onRequestGet(contexto("/pt/mareas/cascais", { slug: "cascais" }));
  assert.equal(resp.status, 200);
  const h = await resp.text();
  comprobarPt(h, "/mareas/cascais");
  assert.match(h, /Maré hoje em Cascais/);
  assert.match(h, /Próxima (preia-mar|baixa-mar)/);
  comprobarPt(paginaMareaPt(spCascais, prevPt.spots).html, "/mareas/cascais");
  comprobarPt(paginaRegionMareasPt(prevPt.spots).html, "/mareas/region/portugal");
  const es = await (await rutaMareaEs.onRequestGet(contexto("/mareas/cascais", { slug: "cascais" }))).text();
  assert.match(es, /hreflang="pt-PT" href="https:\/\/costaviva\.org\/pt\/mareas\/cascais"/);
  const mundaka = await (await rutaMareaEs.onRequestGet(contexto("/mareas/mundaka", { slug: "mundaka" }))).text();
  assert.doesNotMatch(mundaka, /hreflang/);
  assert.equal((await rutaEspeciePt.onRequestGet(contexto("/pt/especies/no-existe", { slug: "no-existe" }))).status, 404);
});

test("sitemap: /pt/ de Portugal y especies, y sitemap.xml al día", () => {
  const urls = urlsSitemap({ spots: SPOTS, especies: json("assets/datos/especies.json"), tipoFondo: null, profundidad: null });
  const pt = urls.filter((u) => u.loc.includes("/pt/"));
  const n = spotsPT(SPOTS).length;
  assert.equal(pt.filter((u) => /\/pt\/spots\/(?!region)/.test(u.loc)).length, n);
  assert.equal(pt.filter((u) => /\/pt\/mareas\/(?!region)/.test(u.loc)).length, n);
  assert.equal(pt.filter((u) => /\/pt\/especies\//.test(u.loc)).length, especies.especies.length);
  for (const r of ["/pt/spots/region/portugal", "/pt/mareas/region/portugal", "/pt/especies"]) assert.ok(pt.some((u) => u.loc === `https://costaviva.org${r}`), r);
  assert.ok(!pt.some((u) => /\/nz-|bakio/.test(u.loc)), "nada de NZ ni de España en /pt/");
  const disco = leer("sitemap.xml");
  assert.ok(disco.includes("<loc>https://costaviva.org/pt/spots/cascais</loc>"));
});
