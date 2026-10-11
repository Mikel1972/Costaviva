// Fase 2 de Nueva Zelanda (2026-10-09) y lanzamiento (2026-10-11):
// /prevision por región (NZ ya pública, con su propia caché), la vista previa
// queda para regiones aún ocultas (admin o clave), marea LINZ en la ficha,
// normativa por enlace, reservas del DOC, SOS con el 111 y alta con código
// postal de 4 cifras. España no cambia. Sin red.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { onRequestGet, SPOTS, SPOTS_ES, previsionRegionNZ, listaSpotsRegion } from "../functions/prevision.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { REGIONES_CONOCIDAS, spotsDeRegion } from "../functions/_lib/regiones-activas.js";
import { autorizarRegion, regionDeUrl } from "../functions/_lib/vista-previa.js";
import { aniosNecesarios, completarSpotNZ } from "../functions/_lib/nz/prevision-nz.js";
import { ATRIBUCION_LINZ, AVISO_LINZ } from "../functions/_lib/nz/mareas-linz.js";
import { AREAS_MPI, normativaArea, normativaAreas, URL_APP_MPI } from "../assets/js/normativa-nz.js";
import { paisDeCodigoPostal } from "../functions/geocodificar.js";
import { numeroEmergencias } from "../functions/sos-alerta.js";
import { fuenteEs } from "./i18n-html.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const json = (r) => JSON.parse(leer(r));

await import("../assets/js/region-pais.js");
await import("../assets/js/sos-whatsapp.js");
const { RegionPais, SosWhatsapp } = globalThis;

// ---------------------------------------------------------------------------
// Simulación de Cloudflare: caché, fetch (Open-Meteo, Supabase) y ASSETS.
// ---------------------------------------------------------------------------
const fetchOriginal = globalThis.fetch;
const cachesOriginal = globalThis.caches;
after(() => {
  globalThis.fetch = fetchOriginal;
  if (cachesOriginal === undefined) delete globalThis.caches;
  else globalThis.caches = cachesOriginal;
});

function horasDesde(zona) {
  // 48 h locales a partir de la hora local actual (forma de Open-Meteo).
  const out = [];
  const ahora = Date.now();
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" });
  for (let i = 0; i < 48; i++) {
    const p = Object.fromEntries(f.formatToParts(new Date(ahora + i * 3600e3)).map((x) => [x.type, x.value]));
    out.push(`${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:00`);
  }
  return out;
}

function respuestaOpenMeteo(url) {
  const u = new URL(url);
  const lats = u.searchParams.get("latitude").split(",");
  const lons = u.searchParams.get("longitude").split(",");
  const zona = u.searchParams.get("timezone");
  const vars = (u.searchParams.get("hourly") || "").split(",");
  const time = horasDesde(zona);
  const uno = (i) => ({
    latitude: +lats[i], longitude: +lons[i], timezone: zona,
    hourly: Object.fromEntries([["time", time], ...vars.map((v) => [v, time.map(() => (v.includes("direction") ? 200 : 1.2))])]),
  });
  return lats.length === 1 ? uno(0) : lats.map((_, i) => uno(i));
}

function montarEntorno({ admin = false } = {}) {
  const llamadas = { openMeteo: [], supabase: [], otras: [] };
  const guardado = new Map();
  globalThis.caches = {
    default: {
      match: async (k) => { const r = guardado.get(k.url); return r ? r.clone() : undefined; },
      put: async (k, r) => { guardado.set(k.url, r.clone()); },
    },
  };
  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url);
    if (/open-meteo\.com/.test(u)) {
      llamadas.openMeteo.push(u);
      return new Response(JSON.stringify(respuestaOpenMeteo(u)), { headers: { "content-type": "application/json" } });
    }
    if (/supabase\.co\/auth\/v1\/user/.test(u)) {
      llamadas.supabase.push(u);
      const ok = admin && /Bearer token-admin/.test(opciones.headers?.Authorization || "");
      return ok ? new Response(JSON.stringify({ id: "u1" })) : new Response("{}", { status: 401 });
    }
    if (/rpc\/es_admin/.test(u)) {
      llamadas.supabase.push(u);
      return new Response(JSON.stringify(admin));
    }
    llamadas.otras.push(u);
    return new Response("[]", { status: 404 });
  };
  const ASSETS = {
    fetch: async (url) => {
      const ruta = new URL(url).pathname;
      try { return new Response(leer(ruta.slice(1)), { headers: { "content-type": "application/json" } }); } catch (e) { return new Response("", { status: 404 }); }
    },
  };
  const pendientes = [];
  const contexto = (url, { headers = {}, env = {} } = {}) => ({
    request: new Request(url, { headers }),
    env: { ASSETS, ...env },
    waitUntil: (p) => pendientes.push(p),
  });
  return { llamadas, guardado, contexto, esperar: () => Promise.all(pendientes) };
}

const lats = (u) => new URL(u).searchParams.get("latitude").split(",").map(Number);

// ---------------------------------------------------------------------------
// /prevision por región
// ---------------------------------------------------------------------------
test("SPOTS_ES: los 105 de siempre; SPOTS = España + los spots activos de NZ", () => {
  assert.equal(SPOTS_ES.length, 105);
  assert.deepEqual(SPOTS.map((s) => s.slug), [...SPOTS_ES, ...SPOTS_NZ].map((s) => s.slug));
  assert.ok(SPOTS_ES.every((s) => s.lat > 27 && s.lon < 5));
  assert.deepEqual(REGIONES_CONOCIDAS, ["nz"]);
  assert.equal(spotsDeRegion("nz").length, SPOTS_NZ.length);
  assert.deepEqual(spotsDeRegion("xx"), []);
});
test("región de la URL: es por defecto, nz conocida, el resto no existe", () => {
  assert.equal(regionDeUrl(new URL("https://x/prevision")), "es");
  assert.equal(regionDeUrl(new URL("https://x/prevision?region=ES")), "es");
  assert.equal(regionDeUrl(new URL("https://x/prevision?region=nz")), "nz");
  assert.equal(regionDeUrl(new URL("https://x/prevision?region=au")), null);
});

test("/prevision sin región: solo España, mismas variables de siempre y caché por URL", async () => {
  const e = montarEntorno();
  const r = await onRequestGet(e.contexto("https://costaviva.org/prevision"));
  assert.equal(r.status, 200);
  const datos = await r.json();
  assert.equal(datos.spots.length, 105);
  assert.ok(!datos.spots.some((s) => String(s.slug).startsWith("nz-")));
  const marinas = e.llamadas.openMeteo.filter((u) => u.includes("marine"));
  assert.ok(marinas.length >= 1);
  for (const u of marinas) {
    assert.match(u, /sea_level_height_msl/);
    assert.ok(lats(u).every((la) => la > 0), "ninguna coordenada del hemisferio sur");
  }
  assert.equal(marinas.flatMap(lats).length, 105);
  await e.esperar();
  assert.ok(e.guardado.has("https://costaviva.org/prevision"));
});

test("/prevision?region=nz es pública: sin sesión ni clave; una región inventada sigue en 404", async () => {
  const e = montarEntorno();
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz&lista=1"));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /public/);
  assert.equal(e.llamadas.openMeteo.length, 0);
  assert.equal(e.llamadas.supabase.length, 0, "no hace falta comprobar ningún admin");
  assert.equal((await onRequestGet(e.contexto("https://c.org/prevision?region=au"))).status, 404);
});
test("/prevision?region=nz: solo los spots de NZ, hora de Auckland, marea LINZ, normativa y reservas del DOC", async () => {
  const e = montarEntorno();
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz"));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /public, max-age=1800/);
  const datos = await r.json();
  assert.equal(datos.region, "nz");
  assert.equal(datos.spots.length, SPOTS_NZ.length);
  assert.deepEqual(datos.boyas, []);
  // Open-Meteo: una consulta por API, solo coordenadas de NZ, sin la marea del modelo.
  assert.equal(e.llamadas.openMeteo.length, 2);
  for (const u of e.llamadas.openMeteo) {
    assert.match(u, /timezone=Pacific%2FAuckland/);
    assert.equal(lats(u).length, SPOTS_NZ.length);
    assert.ok(lats(u).every((la) => la < -34));
    assert.doesNotMatch(u, /sea_level_height_msl/);
  }
  const leigh = datos.spots.find((s) => s.slug === "nz-leigh");
  assert.equal(leigh.zona, "Pacific/Auckland");
  assert.equal(leigh.region, "nz_auckland_kermadec");
  assert.ok(leigh.bloques.length > 0);
  assert.equal(leigh.marea.atribucion, ATRIBUCION_LINZ);
  assert.equal(leigh.marea.aviso, AVISO_LINZ);
  assert.equal(leigh.marea.puerto.nombre, "Leigh");
  assert.ok(Number.isFinite(leigh.marea.altura));
  assert.equal(leigh.normativa.url, AREAS_MPI.nz_auckland_kermadec.url);
  assert.equal(leigh.revisarUbicacion, false);
  // Leigh está junto a la reserva de Goat Island (Cape Rodney-Okakari Point).
  assert.ok(leigh.reservas.some((x) => /Cape Rodney/.test(x.nombre)), JSON.stringify(leigh.reservas));
  assert.match(datos.atribuciones.reservas, /Department of Conservation \(DOC\), Crown copyright, CC BY 4\.0/);
  assert.equal(datos.atribuciones.mareaDisponible, true);
  // Ningún spot de España en la respuesta.
  assert.ok(datos.spots.every((s) => s.slug.startsWith("nz-")));
  // Caché propia de la región, pública (ya no es vista previa).
  await e.esperar();
  assert.ok(e.guardado.has("https://c.org/prevision?region=nz"));
  assert.ok(!e.guardado.has("https://c.org/prevision?region=nz&vista-previa=1"));
});

test("la vista previa sigue para una región oculta: solo admin o clave, antes de la caché", async () => {
  const req = (h = {}, q = "") => new Request(`https://c.org/prevision?region=nz${q}`, { headers: h });
  // Con NZ fuera de las activas (como estaba antes del lanzamiento).
  assert.equal((await autorizarRegion(req(), {}, "nz", { activas: ["es"] })).ok, false);
  assert.equal((await autorizarRegion(req({}, "&clave=abc"), { VISTA_PREVIA_CLAVE: "abc" }, "nz", { activas: ["es"] })).ok, true);
});
test("/prevision?region=nz&lista=1: solo la lista, sin gastar Open-Meteo", async () => {
  const e = montarEntorno();
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz&lista=1"));
  assert.equal(r.status, 200);
  const datos = await r.json();
  assert.equal(datos.spots.length, SPOTS_NZ.length);
  assert.equal(e.llamadas.openMeteo.length, 0);
  assert.deepEqual(Object.keys(datos.spots[0]).sort(), ["lat", "lon", "modalidades", "nombre", "pais", "region", "slug", "zona", "zonaGeografica"]);
  assert.equal(datos.spots[0].zona, "Pacific/Auckland");
});
test("autorizarRegion: activa = pública; si no, admin o clave", async () => {
  const req = (h = {}, q = "") => new Request(`https://c.org/prevision?region=nz${q}`, { headers: h });
  assert.deepEqual(await autorizarRegion(req(), {}, "nz", { activas: ["es", "nz"] }), { ok: true, publica: true });
  assert.deepEqual(await autorizarRegion(req(), {}, "nz"), { ok: true, publica: true }, "NZ activa desde el 2026-10-11");
  assert.equal((await autorizarRegion(req(), {}, "nz", { activas: ["es"] })).ok, false);
  const admin = async () => ({ ok: true });
  assert.equal((await autorizarRegion(req({ Authorization: "Bearer x" }), {}, "nz", { comprobarAdmin: admin, activas: ["es"] })).via, "admin");
  assert.equal((await autorizarRegion(req({}, "&clave=abc"), { VISTA_PREVIA_CLAVE: "abc" }, "nz", { activas: ["es"] })).via, "clave");
  assert.equal((await autorizarRegion(req({}, "&clave=abd"), { VISTA_PREVIA_CLAVE: "abc" }, "nz", { activas: ["es"] })).ok, false);
});

test("sin los datos de LINZ la marea sale null y el spot sigue", async () => {
  const s = SPOTS_NZ[0];
  const r = completarSpotNZ({ slug: s.slug, bloques: [] }, s, { catalogo: null, anios: [] });
  assert.equal(r.marea, null);
  assert.equal(r.normativa.region, s.region);
  assert.deepEqual(aniosNecesarios(Date.UTC(2026, 11, 31)), [2026, 2027]);
  assert.equal(typeof previsionRegionNZ, "function");
  assert.equal(listaSpotsRegion(SPOTS_NZ).length, SPOTS_NZ.length);
});

// ---------------------------------------------------------------------------
// Normativa: solo enlaces
// ---------------------------------------------------------------------------
test("normativa NZ: un enlace oficial de MPI por área y ninguna cifra", () => {
  const regiones = new Set(SPOTS_NZ.map((s) => s.region));
  for (const r of regiones) assert.ok(AREAS_MPI[r], `${r} sin página de MPI`);
  for (const [id, a] of Object.entries(AREAS_MPI)) {
    assert.match(a.url, /^https:\/\/www\.mpi\.govt\.nz\/fishing-aquaculture\/recreational-fishing\/fishing-rules\/[a-z-]+$/, id);
    assert.doesNotMatch(a.nombre, /\d/);
  }
  assert.equal(normativaArea("cantabrico"), null);
  assert.equal(normativaArea("nz_central").app, URL_APP_MPI);
  assert.deepEqual(normativaAreas(["nz_central", "nz_auckland_kermadec", "nz_central", "x"]).map((n) => n.region), ["nz_auckland_kermadec", "nz_central"]);
  const fuente = leer("assets/js/normativa-nz.js").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(fuente, /\b(cm|bag limit|cupo)\b/i);
});

test("ficha del spot en index.html: coordenadas °S/°E, marea LINZ, normativa y rāhui", () => {
  const html = leer("index.html");
  assert.doesNotMatch(html, /°N, \$\{Math\.abs\(s\.lon\)/);
  assert.match(html, /getElementById\("panelCoords"\)\.textContent = formatoCoordenadas\(s\.lat, s\.lon\)/);
  for (const id of ["panelMareaFuente", "panelNormativaNZ", "panelNormativaEnlace", "panelUbicacionRevisar", "avisoVistaPrevia"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /mapa\.panel\.rahui/);
  // Cada región se pide sola (con el JWT si hay sesión, por si estuviera oculta).
  assert.match(html, /fetch\(`\/prevision\?\$\{params\}`/);
  assert.match(html, /Authorization: `Bearer \$\{token\}`/);
  const formato = new Function(`${html.match(/function formatoCoordenadas[\s\S]*?\n}/)[0]}; return formatoCoordenadas;`)();
  assert.equal(formato(-36.2904, 174.8043), "36.2904°S, 174.8043°E");
  assert.equal(formato(43.3647, -2.5089), "43.3647°N, 2.5089°W");
});

test("diario: la lista de NZ llega del servidor (/prevision?region=nz&lista=1)", () => {
  const html = leer("diario.html");
  assert.match(html, /async function cargarSpotsRegionPrevia/);
  assert.match(html, /lista: "1"/);
  assert.match(html, /await cargarSpotsRegionPrevia\(\);/);
});

// ---------------------------------------------------------------------------
// SOS y alta por país
// ---------------------------------------------------------------------------
test("SOS: 111 y +64 en Nueva Zelanda, 112 y +34 en el resto", () => {
  assert.equal(RegionPais.numeroEmergencia("nueva_zelanda"), "111");
  assert.equal(RegionPais.numeroEmergencia("nz_central"), "111");
  assert.equal(RegionPais.numeroEmergencia("cantabrico"), "112");
  assert.equal(RegionPais.numeroEmergencia(null), "112");
  assert.equal(RegionPais.prefijoTelefono("nueva_zelanda"), "64");
  assert.equal(RegionPais.prefijoTelefono("canarias"), "34");
  assert.equal(numeroEmergencias(-36.85, 174.76), "111");
  assert.equal(numeroEmergencias(43.36, -2.5), "112");
  assert.match(leer("functions/sos-alerta.js"), /considera llamar al \$\{numeroEmergencias\(lat, lon\)\}/);
});

test("teléfonos de NZ sin prefijo se guardan como +64; España igual que antes", () => {
  const n = SosWhatsapp.normalizarTelefono;
  assert.equal(n("021 123 4567", "64").e164, "+64211234567");
  assert.equal(n("6421234567", "64").e164, "+6421234567");
  assert.equal(n("+34 612 34 56 78", "64").e164, "+34612345678");
  assert.equal(n("612 34 56 78").e164, "+34612345678");
  assert.equal(n("612345678", "34").e164, "+34612345678");
  assert.equal(n("021 123 4567").ok, false);
  const alarma = leer("alarma.html");
  assert.doesNotMatch(alarma.replace(/function normalizarTel[\s\S]*?\n}/, ""), /normalizarTelefono\((valor|input\.value|telefono)\)/);
  assert.match(alarma, /src="\/assets\/js\/region-pais\.js"/);
  assert.match(alarma, /id="enlaceLlamarEmergencias" href="tel:112"/);
});

test("alta: 4 cifras en NZ, 5 en España; /geocodificar de acuerdo", () => {
  assert.equal(RegionPais.codigoPostalValido("1010", "nueva_zelanda"), true);
  assert.equal(RegionPais.codigoPostalValido("48001", "nueva_zelanda"), false);
  assert.equal(RegionPais.codigoPostalValido("48001", "cantabrico"), true);
  assert.equal(RegionPais.codigoPostalValido("1010", null), false);
  assert.equal(paisDeCodigoPostal("48001"), "Spain");
  assert.equal(paisDeCodigoPostal("1010"), "New%20Zealand");
  assert.equal(paisDeCodigoPostal("123"), null);
  const login = leer("login.html");
  assert.match(login, /RegionPais\.codigoPostalValido\(codigoPostal, regionAlta\)/);
  // En España el HTML del campo no cambia.
  assert.match(fuenteEs(login), /pattern="\[0-9\]\{5\}" maxlength="5"/);
});

test("i18n: claves nuevas de la fase 2 en es y en", () => {
  const dic = (r) => JSON.parse(leer(r).split("\n{\n")[1].split("\n}\n")[0].replace(/^/, "{").concat("}"));
  const es = dic("assets/i18n/es.js");
  const en = dic("assets/i18n/en.js");
  for (const k of ["alarma.llamar_num", "alarma.subtitulo_num", "alarma.llamar_explica_num", "alarma.prefijo_nz", "login.cp_4", "login.ej_cp_nz",
    "mapa.previa.aviso", "mapa.previa.no_disponible", "mapa.previa.region_nz", "mapa.panel.ubicacion_revisar", "mapa.panel.normativa_nz",
    "mapa.panel.normativa_app", "mapa.panel.rahui", "mapa.marea.puerto_linz"]) {
    assert.ok(es[k] && en[k], k);
  }
  assert.doesNotMatch(en["mapa.panel.normativa_nz"], /\d/);
});

test("registrar-presion: el coeficiente de Open-Meteo solo para España", () => {
  assert.match(leer("functions/registrar-presion.js"), /const spotsLote = SPOTS_ES\.filter/);
});
