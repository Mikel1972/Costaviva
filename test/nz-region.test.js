// Región Nueva Zelanda ACTIVA (lanzamiento, 2026-10-11; antes, fase 1: todo
// oculto detrás del interruptor). Comprueba que NZ SÍ sale donde debe (mapa,
// /prevision?region=nz pública, páginas en inglés /en/spots, /en/tides,
// /en/species, sitemap) y que España NO cambia (sus 105 spots, sus páginas en
// español, sus canónicas, sin hreflang). Sin red. Corre en tests.yml.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { REGIONES_ACTIVAS, regionActiva, spotsRegionesActivas } from "../functions/_lib/regiones-activas.js";
import { SPOTS_NZ, SPOTS_NZ_TODOS } from "../functions/_lib/nz/spots-nz.js";
import { asignarPuerto } from "../functions/_lib/nz/mareas-linz.js";
import { SPOTS, SPOTS_ES, onRequestGet as prevision } from "../functions/prevision.js";
import { SPOTS as SPOTS_SEO } from "../functions/_lib/seo/carga.js";
import { urlsSitemap } from "../functions/_lib/seo/sitemap.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { paginaIndiceSpots } from "../functions/_lib/seo/paginas.js";
import * as rutaSpotEs from "../functions/spots/[slug].js";
import * as rutaMareaEs from "../functions/mareas/[slug].js";
import * as rutaEspecieEs from "../functions/especies/[slug].js";
import * as rutaSpotEn from "../functions/en/spots/[slug].js";
import * as rutaSpotsEn from "../functions/en/spots/index.js";
import * as rutaZonaEn from "../functions/en/spots/region/[region].js";
import * as rutaMareaEn from "../functions/en/tides/[slug].js";
import * as rutaMareasEn from "../functions/en/tides/index.js";
import * as rutaEspecieEn from "../functions/en/species/[slug].js";
import * as rutaEspeciesEn from "../functions/en/species/index.js";
import { ATRIBUCION_LINZ, AVISO_LINZ } from "../functions/_lib/nz/mareas-linz.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const especies = JSON.parse(leer("assets/datos/especies.json"));
const catalogo = JSON.parse(leer("datos/nz/linz-puertos.json"));
const esNZ = (s) => s.pais === "nz" || String(s.slug).startsWith("nz-") || s.lon > 160 || s.lat < -30;

// ---------------------------------------------------------------------------
// Simulación mínima de Cloudflare (caché, fetch, ASSETS) para las rutas.
// ---------------------------------------------------------------------------
const fetchOriginal = globalThis.fetch;
const cachesOriginal = globalThis.caches;
after(() => {
  globalThis.fetch = fetchOriginal;
  if (cachesOriginal === undefined) delete globalThis.caches;
  else globalThis.caches = cachesOriginal;
});
function entorno() {
  const guardado = new Map();
  globalThis.caches = { default: { match: async (k) => guardado.get(k.url)?.clone(), put: async (k, r) => { guardado.set(k.url, r.clone()); } } };
  const llamadas = [];
  globalThis.fetch = async (url) => {
    llamadas.push(String(url));
    // Open-Meteo y /prevision no responden: las páginas salen sin "hoy".
    return new Response("{}", { status: 503 });
  };
  const ASSETS = { fetch: async (url) => { try { return new Response(leer(new URL(url).pathname.slice(1)), { headers: { "content-type": "application/json" } }); } catch (e) { return new Response("", { status: 404 }); } } };
  const ctx = (url, params = {}) => ({ request: new Request(url), env: { ASSETS }, params, waitUntil: () => {} });
  return { ctx, llamadas };
}

// ---------------------------------------------------------------------------
// Interruptor y spots
// ---------------------------------------------------------------------------
test("interruptor: NZ activa", () => {
  assert.deepEqual([...REGIONES_ACTIVAS], ["es", "nz"]);
  assert.equal(regionActiva("nz"), true);
  assert.equal(regionActiva("es"), true);
  assert.equal(spotsRegionesActivas().length, SPOTS_NZ.length);
  assert.deepEqual(spotsRegionesActivas(["es"]), []);
});

test("/prevision (lo de España) y las páginas en español: los 105 de siempre, sin NZ", () => {
  assert.equal(SPOTS_ES.length, 105);
  assert.equal(SPOTS.length, 105 + SPOTS_NZ.length);
  assert.equal(SPOTS_SEO.filter(esNZ).length, 0);
  assert.equal(SPOTS_SEO.length, 105);
  assert.match(paginaIndiceSpots(SPOTS_SEO).titulo, /^Spots de pesca en España y Portugal: 105 lugares/);
});

test("spots NZ: 59 en el lanzamiento, Dusky Sound fuera", () => {
  assert.equal(SPOTS_NZ_TODOS.length, 60);
  assert.equal(SPOTS_NZ.length, 59);
  const fuera = SPOTS_NZ_TODOS.filter((s) => s.activo === false).map((s) => s.slug);
  assert.deepEqual(fuera, ["nz-dusky-sound"]);
  assert.ok(!SPOTS.some((s) => s.slug === "nz-dusky-sound"));
});

test("spots NZ: forma, región MPI, zona horaria y punto de pesca real (OSM, < 300 m de la costa)", () => {
  const slugs = new Set(SPOTS_NZ_TODOS.map((s) => s.slug));
  assert.equal(slugs.size, 60);
  const espana = new Set(SPOTS_ES.map((s) => s.slug));
  const regiones = new Set(["nz_auckland_kermadec", "nz_central", "nz_challenger", "nz_south_east", "nz_kaikoura", "nz_southland", "nz_fiordland"]);
  for (const s of SPOTS_NZ) {
    assert.match(s.slug, /^nz-[a-z0-9-]+$/);
    assert.ok(!espana.has(s.slug));
    assert.equal(s.pais, "nz");
    assert.equal(s.tz, "Pacific/Auckland");
    assert.ok(regiones.has(s.region), `${s.slug}: ${s.region}`);
    assert.ok(s.lat < -34 && s.lat > -47.5 && s.lon > 166 && s.lon < 179, `${s.slug} fuera de NZ`);
    assert.ok(s.modalidades.length && s.modalidades.every((m) => ["costa", "embarcacion"].includes(m)));
    // Ninguno queda en el centro del pueblo, de un fiordo o en un edificio.
    assert.equal(s.revisar_ubicacion, undefined, s.slug);
    assert.doesNotMatch(s.osm, /\b(place|boundary|amenity|tourism)=|natural=(bay|peak)/, `${s.slug}: ${s.osm}`);
    assert.match(s.osm, /^(node|way|relation)\/\d+ /, `${s.slug}: origen OSM`);
    // Los movidos el 2026-10-11 llevan el punto de antes y la costa comprobada.
    if (s.osm_antes) {
      assert.match(s.costa?.osm || "", /^way\/\d+$/, s.slug);
      assert.ok(s.costa.m < 300, `${s.slug} a ${s.costa.m} m de la costa`);
    }
  }
  assert.equal(SPOTS_NZ.filter((s) => s.osm_antes).length, 51, "51 movidos (52 por revisar menos Dusky Sound)");
  assert.equal(SPOTS_NZ.find((s) => s.slug === "nz-kaikoura").region, "nz_kaikoura");
  assert.equal(SPOTS_NZ.find((s) => s.slug === "nz-milford-sound").region, "nz_fiordland");
});

test("spots NZ: el puerto LINZ de cada uno sigue siendo el más cercano (y está en linz-puertos.json)", () => {
  for (const s of SPOTS_NZ) {
    const p = asignarPuerto(s, catalogo);
    assert.equal(p.nombre, s.puerto_linz.nombre, s.slug);
    assert.equal(p.id, s.puerto_linz.id, s.slug);
    assert.equal(p.km, s.puerto_linz.km, s.slug);
    assert.deepEqual(catalogo.spots[s.slug], { id: s.puerto_linz.id, nombre: s.puerto_linz.nombre, tabla: s.puerto_linz.tabla, km: s.puerto_linz.km }, s.slug);
  }
});

test("datos/nz no se sirve en público (lista blanca de rutas); /en/ sí", () => {
  for (const r of ["/datos/nz/linz-puertos.json", "/datos/nz/linz-mareas-2026.json", "/datos/nz/reservas-marinas-doc.geojson"]) {
    assert.equal(esRutaPermitida(r), false, r);
  }
  for (const r of ["/en", "/en/spots", "/en/spots/nz-leigh", "/en/tides/nz-leigh", "/en/species/nz-snapper", "/en/spots/region/northland"]) {
    assert.equal(esRutaPermitida(r), true, r);
  }
});

// ---------------------------------------------------------------------------
// /prevision?region=nz pública
// ---------------------------------------------------------------------------
test("/prevision?region=nz&lista=1 pública (sin sesión ni clave)", async () => {
  const e = entorno();
  const r = await prevision(e.ctx("https://costaviva.org/prevision?region=nz&lista=1"));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.spots.length, SPOTS_NZ.length);
  assert.ok(d.spots.every((s) => s.slug.startsWith("nz-")));
});

// ---------------------------------------------------------------------------
// Sitemap: España igual, NZ en /en/
// ---------------------------------------------------------------------------
test("sitemap: las URL de España de siempre (284) y las de NZ solo bajo /en/, sin /login", () => {
  const urls = urlsSitemap({ spots: SPOTS, especies, tipoFondo: null, profundidad: null });
  const es = urls.filter((u) => !u.loc.includes("/en/"));
  const en = urls.filter((u) => u.loc.includes("/en/"));
  assert.equal(es.length, 284);
  assert.ok(!es.some((u) => /\/nz-|\/nz\//.test(u.loc)), "nada de NZ en las URL en español");
  for (const r of ["/en/spots", "/en/tides", "/en/species", "/en/spots/nz-leigh", "/en/tides/nz-leigh", "/en/species/nz-snapper", "/en/spots/region/auckland-hauraki-gulf", "/en/tides/region/otago"]) {
    assert.ok(en.some((u) => u.loc === `https://costaviva.org${r}`), r);
  }
  assert.equal(en.filter((u) => /\/en\/spots\/nz-/.test(u.loc)).length, SPOTS_NZ.length);
  assert.ok(!urls.some((u) => /\/login|dusky/.test(u.loc)));
  const disco = leer("sitemap.xml");
  assert.equal((disco.match(/<loc>/g) || []).length, urls.length);
  assert.ok(!/\/login/.test(disco));
});

// ---------------------------------------------------------------------------
// Rutas: España igual; NZ en inglés
// ---------------------------------------------------------------------------
test("rutas en español de un spot o especie de NZ: 301 a su página en inglés", async () => {
  const e = entorno();
  const casos = [
    [rutaSpotEs, "https://costaviva.org/spots/nz-leigh", { slug: "nz-leigh" }, "https://costaviva.org/en/spots/nz-leigh"],
    [rutaMareaEs, "https://costaviva.org/mareas/nz-leigh", { slug: "nz-leigh" }, "https://costaviva.org/en/tides/nz-leigh"],
    [rutaEspecieEs, "https://costaviva.org/especies/nz-snapper", { slug: "nz-snapper" }, "https://costaviva.org/en/species/nz-snapper"],
  ];
  for (const [ruta, url, params, destino] of casos) {
    const r = await ruta.onRequestGet(e.ctx(url, params));
    assert.equal(r.status, 301, url);
    assert.equal(r.headers.get("location"), destino);
  }
});

test("páginas /en/ de NZ: inglés, canónica /en/, hreflang en + x-default, LINZ, MPI y rāhui", async () => {
  const e = entorno();
  const paginas = [
    [rutaSpotEn, "https://costaviva.org/en/spots/nz-leigh", { slug: "nz-leigh" }],
    [rutaMareaEn, "https://costaviva.org/en/tides/nz-leigh", { slug: "nz-leigh" }],
    [rutaEspecieEn, "https://costaviva.org/en/species/nz-snapper", { slug: "nz-snapper" }],
    [rutaSpotsEn, "https://costaviva.org/en/spots", {}],
    [rutaMareasEn, "https://costaviva.org/en/tides", {}],
    [rutaEspeciesEn, "https://costaviva.org/en/species", {}],
    [rutaZonaEn, "https://costaviva.org/en/spots/region/auckland-hauraki-gulf", { region: "auckland-hauraki-gulf" }],
  ];
  for (const [ruta, url, params] of paginas) {
    const r = await ruta.onRequestGet(e.ctx(url, params));
    assert.equal(r.status, 200, url);
    const html = await r.text();
    assert.match(html, /<html lang="en">/, url);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${url}: canónica`);
    assert.ok(html.includes(`<link rel="alternate" hreflang="en" href="${url}">`), `${url}: hreflang en`);
    assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${url}">`), `${url}: x-default`);
    assert.match(html, /<meta property="og:locale" content="en_NZ">/);
    // Atribución de LINZ (frase exacta) y aviso, en el pie de todas.
    assert.ok(html.includes("Sourced from Land Information New Zealand data (CC BY 4.0)"), url);
    assert.ok(html.includes(AVISO_LINZ), url);
    assert.ok(html.includes("Department of Conservation (DOC), Crown copyright, CC BY 4.0"), url);
    // Nada en español a la vista (salvo el enlace a la versión de España).
    const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ");
    assert.doesNotMatch(visible.replace(/Spots in Spain and Portugal \(in Spanish\)|Privacy \(Spanish\)/g, ""), /\b(Pesca|Mareas|Especies|temporada|Entrar|hoy)\b/, `${url}: texto en español`);
    // Ninguna cifra de normativa.
    assert.doesNotMatch(visible, /\b\d+\s?cm\b|bag limit of \d/i, url);
  }
  const spot = await (await rutaSpotEn.onRequestGet(e.ctx("https://costaviva.org/en/spots/nz-leigh?x=1", { slug: "nz-leigh" }))).text();
  assert.match(spot, /href="https:\/\/www\.mpi\.govt\.nz\/fishing-aquaculture\/recreational-fishing\/fishing-rules\/auckland-kermadec-fishing-rules"/);
  assert.match(spot, /Rāhui/);
  assert.match(spot, /Cape Rodney/, "aviso de la reserva marina de Goat Island");
  const especie = await (await rutaEspecieEn.onRequestGet(e.ctx("https://costaviva.org/en/species/nz-snapper", { slug: "nz-snapper" }))).text();
  assert.match(especie, /Snapper/);
  assert.match(especie, /Tāmure/, "nombre māori");
  assert.doesNotMatch(especie, /Pargo/, "sin el nombre español");
  // Un slug de España en /en/ no existe.
  const no = await rutaSpotEn.onRequestGet(e.ctx("https://costaviva.org/en/spots/bakio", { slug: "bakio" }));
  assert.equal(no.status, 404);
  assert.match(await no.text(), /We could not find this page/);
});

test("páginas en español de España: sin hreflang y con su canónica de siempre", async () => {
  const e = entorno();
  const r = await rutaSpotEs.onRequestGet(e.ctx("https://costaviva.org/spots/bakio", { slug: "bakio" }));
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<html lang="es">/);
  assert.doesNotMatch(html, /hreflang/);
  assert.ok(html.includes('<link rel="canonical" href="https://costaviva.org/spots/bakio">'));
  assert.doesNotMatch(html, /nz-/);
});

// ---------------------------------------------------------------------------
// Mapa (index.html), diario y marketing
// ---------------------------------------------------------------------------
test("mapa: NZ se pide sola (/prevision?region=nz), arranque en Auckland para NZ, mundo entero y selector de región", () => {
  const html = leer("index.html");
  // Cada región con su petición: nunca todos los spots juntos.
  assert.match(html, /fetch\(`\/prevision\?\$\{params\}`/);
  assert.match(html, /const params = new URLSearchParams\(\{ region \}\)/);
  assert.match(html, /nz: \{ centro: \[-36\.85, 174\.76\], zoom: 9 \}/, "Auckland");
  assert.match(html, /return \{ region: r === "nueva_zelanda" \? "nz" : "es", fija: false \};/, "región del usuario, como el idioma");
  assert.match(html, /minZoom: 1,/);
  assert.match(html, /worldCopyJump: true,/);
  assert.match(html, /maxBounds: \[\[-85, -540\], \[85, 540\]\]/);
  for (const id of ["es", "pt", "canarias", "nz"]) assert.match(html, new RegExp(`${id}: \\{ limites: `), id);
  assert.match(html, /data-accion="irARegionMapa" data-args='\$\{JSON\.stringify\(\[id\]\)\}'/);
  assert.match(html, /CLAVE_VISTA_REGION = "costaviva\.vistaRegion"/);
  // A zoom de continente no se pintan los spots ni se piden datos.
  assert.match(html, /#map\.zoom-bajo \.icono-spot \{ display: none; \}/);
  assert.match(html, /if \(map\.getZoom\(\) < ZOOM_MIN_SPOTS\) return \[\];/);
  // Ningún slug de NZ escrito a mano en el HTML: llegan del servidor.
  assert.ok(!/["']nz-[a-z]/.test(html));
});

test("diario: la lista de NZ llega del servidor; marketing sin NZ", () => {
  assert.match(leer("diario.html"), /const REGIONES_DIARIO = \["nz"\];/);
  const ficheros = [
    "assets/js/tarjetas-mapa.js",
    ...readdirSync(join(RAIZ, "scripts/marketing")).filter((f) => f.endsWith(".mjs")).map((f) => `scripts/marketing/${f}`),
  ];
  for (const f of ficheros) assert.ok(!/["']nz-[a-z]/.test(leer(f)), `${f} menciona un slug de NZ`);
});

test("atribuciones de LINZ: la frase exacta y el aviso de que no son tablas oficiales", () => {
  assert.equal(ATRIBUCION_LINZ, "Sourced from Land Information New Zealand data (CC BY 4.0)");
  assert.match(AVISO_LINZ, /^Not official tide tables as specified in Maritime Rules Part 25/);
  assert.match(leer("assets/i18n/en.js"), /"mapa\.atrib\.linz": "NZ tides: Sourced from Land Information New Zealand data \(CC BY 4\.0\); not official tide tables"/);
});
