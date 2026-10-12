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
import { ATRIBUCION_LINZ, ATRIBUCION_LINZ_CORTA, AVISO_LINZ, URL_LICENCIA_LINZ } from "../functions/_lib/nz/mareas-linz.js";

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

test("spots NZ: 68 activos (59 del lanzamiento + 9 de islas), Dusky Sound fuera", () => {
  assert.equal(SPOTS_NZ_TODOS.length, 69);
  assert.equal(SPOTS_NZ.length, 68);
  const fuera = SPOTS_NZ_TODOS.filter((s) => s.activo === false).map((s) => s.slug);
  assert.deepEqual(fuera, ["nz-dusky-sound"]);
  assert.ok(!SPOTS.some((s) => s.slug === "nz-dusky-sound"));
});

test("spots NZ: forma, región MPI, zona horaria y punto de pesca real (OSM, < 300 m de la costa)", () => {
  const slugs = new Set(SPOTS_NZ_TODOS.map((s) => s.slug));
  assert.equal(slugs.size, 69);
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
  // Las /pt/ (portugués, 2026-10-11) aparte: test/seo-pt.test.js.
  const es = urls.filter((u) => !u.loc.includes("/en/") && !u.loc.includes("/pt/"));
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
    // Atribución de LINZ (fórmula exacta de obra adaptada, con enlace a la
    // licencia CC BY 4.0) y aviso, en el pie de todas.
    assert.ok(html.includes(ATRIBUCION_LINZ), url);
    assert.ok(html.includes('<a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener" target="_blank">CC BY 4.0</a>'), `${url}: enlace a CC BY 4.0`);
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
  // Arranque en NZ con el país entero (2026-10-12), no Auckland.
  assert.match(html, /nz: \{ centro: \[-41\.3, 173\.5\], zoom: 5, encuadre: "nz" \}/, "NZ entera");
  assert.match(html, /map\.fitBounds\(VISTAS_REGION\[id\]\.limites/);
  // Círculos al tamaño del zoom y etiqueta de región que se va a los 2 s.
  assert.match(html, /const ESCALA_SPOT_POR_ZOOM = /);
  assert.match(html, /\.icono-spot > div \{ transform: scale\(var\(--escala-spot, 1\)\)/);
  assert.match(html, /classList\.add\("resumen-oculto"\), 2000\)/);
  assert.match(html, /return \{ region: r === "nueva_zelanda" \? "nz" : "es", fija: false \};/, "región del usuario, como el idioma");
  assert.match(html, /minZoom: 1,/);
  // Sin worldCopyJump (2026-10-12): la vista se queda en la franja -40..320.
  assert.doesNotMatch(html, /worldCopyJump: true/);
  assert.match(html, /const FRANJA_LONGITUD = \[-40, 320\];/);
  assert.match(html, /map\.on\("moveend", mantenerVistaEnFranja\);/);
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

// Marketing: desde el 2026-10-11 hay piezas de NZ, pero sus spots y especies
// salen de los datos (SPOTS_NZ, especies.json), nunca escritos a mano.
test("diario: la lista de NZ llega del servidor; marketing sin slugs de NZ escritos a mano", () => {
  assert.match(leer("diario.html"), /const REGIONES_DIARIO = \["nz"\];/);
  const ficheros = [
    "assets/js/tarjetas-mapa.js",
    ...readdirSync(join(RAIZ, "scripts/marketing")).filter((f) => f.endsWith(".mjs")).map((f) => `scripts/marketing/${f}`),
  ];
  for (const f of ficheros) assert.ok(!/["']nz-[a-z]/.test(leer(f)), `${f} menciona un slug de NZ`);
});

// Licencia LINZ verificada por escrito el 2026-10-11: fórmula de obra
// adaptada de https://www.linz.govt.nz/copyright, literal; en la UI puede ir
// abreviada con el nombre completo, "based on" y "CC BY 4.0" con enlace.
test("atribuciones de LINZ: la fórmula exacta de obra adaptada y el aviso de que no son tablas oficiales", () => {
  assert.equal(ATRIBUCION_LINZ, "This work is based on Toitū Te Whenua Land Information New Zealand data which are licensed by Toitū Te Whenua Land Information New Zealand for re-use under the Creative Commons Attribution 4.0 International licence.");
  assert.match(ATRIBUCION_LINZ_CORTA, /^Based on Toitū Te Whenua Land Information New Zealand data, CC BY 4\.0$/);
  assert.equal(URL_LICENCIA_LINZ, "https://creativecommons.org/licenses/by/4.0/");
  assert.match(AVISO_LINZ, /^Not official tide tables as specified in Maritime Rules Part 25/);
  for (const idioma of ["en", "es", "pt"]) {
    const linea = leer(`assets/i18n/${idioma}.js`).split("\n").find((l) => l.includes('"mapa.atrib.linz"'));
    assert.ok(linea, idioma);
    assert.ok(linea.includes("based on Toitū Te Whenua Land Information New Zealand data"), idioma);
    assert.ok(linea.includes('<a href=\\"https://creativecommons.org/licenses/by/4.0/\\" target=\\"_blank\\" rel=\\"noopener\\">CC BY 4.0</a>'), idioma);
    assert.doesNotMatch(linea, /Sourced from/, idioma);
  }
  for (const f of ["datos/nz/linz-puertos.json", "datos/nz/linz-mareas-2026.json", "datos/nz/linz-mareas-2027.json"]) {
    const d = JSON.parse(leer(f));
    assert.equal(d.atribucion, ATRIBUCION_LINZ, f);
    assert.doesNotMatch(d.licencia, /pendiente/, f);
  }
});

// Cámaras de NZ (assets/js/camaras-nz.js), conectadas el 2026-10-11: NZ es
// pública desde la PR #176, así que SÍ se cargan en la app (vía
// camaras-externas.js, que index.html importa) y el robot de salud las
// comprueba (recorre CAMARAS_EXTERNAS).
import { CAMARAS_NZ, camarasNZVisibles } from "../assets/js/camaras-nz.js";
import { CAMARAS_EXTERNAS, camarasExternasDeSpot } from "../assets/js/camaras-externas.js";

test("cámaras de NZ: se cargan en la ficha de cada spot NZ y en el robot de salud", () => {
  assert.ok(REGIONES_ACTIVAS.includes("nz"));
  assert.ok(CAMARAS_NZ.length > 0);
  assert.equal(camarasNZVisibles(REGIONES_ACTIVAS).length, CAMARAS_NZ.length);
  const slugsNZ = new Set(SPOTS_NZ.map((s) => s.slug));
  for (const c of CAMARAS_NZ) {
    assert.ok(slugsNZ.has(c.spot), c.id);
    assert.ok(camarasExternasDeSpot(c.spot).includes(c), `${c.id}: no sale en la ficha de ${c.spot}`);
    // Embebidas por decisión de Mikel (2026-10-11) o enlace: el detalle, en
    // test/camaras-externas.test.js.
    assert.ok(["imagen_oficial", "iframe_oficial", "enlace"].includes(c.modo), c.id);
  }
  assert.equal(CAMARAS_EXTERNAS.filter((c) => c.spot.startsWith("nz-")).length, CAMARAS_NZ.length);
  assert.match(leer("assets/js/camaras-externas.js"), /from "\.\/camaras-nz\.js"/);
  const index = leer("index.html");
  assert.match(index, /import \* as CamarasExternas from "\/assets\/js\/camaras-externas\.js"/);
  assert.match(index, /CE\.nombreCamara\(c, I18n\.idioma\(\)\)/, "nombre de la cámara en inglés en la ficha");
  const robot = leer("scripts/camaras/comprobar-camaras.mjs");
  assert.match(robot, /for \(const camara of CAMARAS_EXTERNAS\)/);
});
