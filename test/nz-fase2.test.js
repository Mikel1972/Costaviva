// Fase 2 de Nueva Zelanda (2026-10-09): /prevision por región, vista previa
// solo para el admin (o con la clave), marea LINZ en la ficha, normativa por
// enlace, SOS con el 111 y alta con código postal de 4 cifras. Con "nz"
// fuera de REGIONES_ACTIVAS, España no cambia y nadie más ve NZ. Sin red.

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
test("SPOTS_ES: los 105 de siempre; SPOTS (lo público) no lleva NZ mientras esté apagada", () => {
  assert.equal(SPOTS_ES.length, 105);
  assert.deepEqual(SPOTS.map((s) => s.slug), SPOTS_ES.map((s) => s.slug));
  assert.ok(SPOTS_ES.every((s) => s.lat > 27 && s.lon < 5));
  assert.deepEqual(REGIONES_CONOCIDAS, ["nz"]);
  assert.equal(spotsDeRegion("nz").length, 60);
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

test("/prevision?region=nz sin admin ni clave: 404 y ni una llamada a Open-Meteo", async () => {
  const e = montarEntorno();
  for (const url of ["https://c.org/prevision?region=nz", "https://c.org/prevision?region=nz&lista=1", "https://c.org/prevision?region=nz&clave=mala"]) {
    const r = await onRequestGet(e.contexto(url, { env: { VISTA_PREVIA_CLAVE: "buena-clave-larga" } }));
    assert.equal(r.status, 404, url);
  }
  // Con un token que no es de admin, tampoco.
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz", { headers: { Authorization: "Bearer token-cualquiera" } }));
  assert.equal(r.status, 404);
  assert.equal(e.llamadas.openMeteo.length, 0);
  // Región inventada.
  assert.equal((await onRequestGet(e.contexto("https://c.org/prevision?region=au"))).status, 404);
});

test("/prevision?region=nz como admin: solo los 60 de NZ, hora de Auckland, marea LINZ y normativa", async () => {
  const e = montarEntorno({ admin: true });
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz", { headers: { Authorization: "Bearer token-admin" } }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  const datos = await r.json();
  assert.equal(datos.region, "nz");
  assert.equal(datos.spots.length, 60);
  assert.deepEqual(datos.boyas, []);
  // Open-Meteo: una consulta por API, solo coordenadas de NZ, sin la marea del modelo.
  assert.equal(e.llamadas.openMeteo.length, 2);
  for (const u of e.llamadas.openMeteo) {
    assert.match(u, /timezone=Pacific%2FAuckland/);
    assert.equal(lats(u).length, 60);
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
  assert.equal(leigh.revisarUbicacion, true);
  assert.equal(datos.atribuciones.mareaDisponible, true);
  // Ningún spot de España en la respuesta.
  assert.ok(datos.spots.every((s) => s.slug.startsWith("nz-")));
  // La vista previa se guarda con su propia clave, nunca con la pública.
  await e.esperar();
  assert.ok(e.guardado.has("https://c.org/prevision?region=nz&vista-previa=1"));
  assert.ok(!e.guardado.has("https://c.org/prevision?region=nz"));
});

test("la caché de la vista previa no se sirve a quien no está autorizado", async () => {
  const e = montarEntorno({ admin: true });
  await onRequestGet(e.contexto("https://c.org/prevision?region=nz", { headers: { Authorization: "Bearer token-admin" } }));
  await e.esperar();
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz"));
  assert.equal(r.status, 404);
});

test("/prevision?region=nz con la clave secreta (y lista=1 sin gastar Open-Meteo)", async () => {
  const e = montarEntorno();
  const env = { VISTA_PREVIA_CLAVE: "buena-clave-larga" };
  const r = await onRequestGet(e.contexto("https://c.org/prevision?region=nz&lista=1&clave=buena-clave-larga", { env }));
  assert.equal(r.status, 200);
  const datos = await r.json();
  assert.equal(datos.spots.length, 60);
  assert.equal(e.llamadas.openMeteo.length, 0);
  assert.deepEqual(Object.keys(datos.spots[0]).sort(), ["lat", "lon", "modalidades", "nombre", "pais", "region", "slug", "zona", "zonaGeografica"]);
  assert.equal(datos.spots[0].zona, "Pacific/Auckland");
  // Sin secret configurado, la vía de la clave siempre rechaza.
  const sin = await onRequestGet(e.contexto("https://c.org/prevision?region=nz&lista=1&clave=buena-clave-larga"));
  assert.equal(sin.status, 404);
});

test("autorizarRegion: activa = pública; si no, admin o clave", async () => {
  const req = (h = {}, q = "") => new Request(`https://c.org/prevision?region=nz${q}`, { headers: h });
  assert.deepEqual(await autorizarRegion(req(), {}, "nz", { activas: ["es", "nz"] }), { ok: true, publica: true });
  assert.equal((await autorizarRegion(req(), {}, "nz")).ok, false);
  const admin = async () => ({ ok: true });
  assert.equal((await autorizarRegion(req({ Authorization: "Bearer x" }), {}, "nz", { comprobarAdmin: admin })).via, "admin");
  assert.equal((await autorizarRegion(req({}, "&clave=abc"), { VISTA_PREVIA_CLAVE: "abc" }, "nz")).via, "clave");
  assert.equal((await autorizarRegion(req({}, "&clave=abd"), { VISTA_PREVIA_CLAVE: "abc" }, "nz")).ok, false);
});

test("sin los datos de LINZ la marea sale null y el spot sigue", async () => {
  const s = SPOTS_NZ[0];
  const r = completarSpotNZ({ slug: s.slug, bloques: [] }, s, { catalogo: null, anios: [] });
  assert.equal(r.marea, null);
  assert.equal(r.normativa.region, s.region);
  assert.deepEqual(aniosNecesarios(Date.UTC(2026, 11, 31)), [2026, 2027]);
  assert.equal(typeof previsionRegionNZ, "function");
  assert.equal(listaSpotsRegion(SPOTS_NZ).length, 60);
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
  // La vista previa pide su región con el JWT y solo si hay ?region= en la URL.
  assert.match(html, /fetch\(`\/prevision\?\$\{params\}`/);
  assert.match(html, /Authorization: `Bearer \$\{token\}`/);
  const formato = new Function(`${html.match(/function formatoCoordenadas[\s\S]*?\n}/)[0]}; return formatoCoordenadas;`)();
  assert.equal(formato(-36.2904, 174.8043), "36.2904°S, 174.8043°E");
  assert.equal(formato(43.3647, -2.5089), "43.3647°N, 2.5089°W");
});

test("diario: la lista de NZ solo llega del servidor en la vista previa", () => {
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
