// Waikato Regional Council por KiWIS (2026-11-09): parser de
// getTimeseriesValues (dajson y csv), unidades, tendencia, caché de 2 h por
// estación, mareógrafo de cada spot, /prevision?region=nz y la cita
// obligatoria (Waikato Regional Council + enlace + CC BY 4.0 + provisional).
// Los ejemplos de test/fixtures/kiwis/ siguen el formato documentado de
// KiWIS: falta contrastarlos con una respuesta real (el sandbox no llega al
// puerto 8080).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsearKiwis, horaKiwis, resumenSerie, normalizarUnidad, urlValoresKiwis, datosWaikato, mareografoDeSpot,
  ESTACIONES_WAIKATO, ATRIBUCION_WAIKATO, AVISO_WAIKATO, URL_WAIKATO, URL_LICENCIA_WAIKATO, CACHE_WAIKATO_S,
} from "../functions/_lib/nz/kiwis-waikato.js";
import { previsionRegionNZ } from "../functions/prevision.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { RIOS_SPOT } from "../functions/_lib/seo/datos.js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
const TAIRUA = leer("test/fixtures/kiwis/tairua-dajson.json");
const RAGLAN = leer("test/fixtures/kiwis/raglan.csv");
const AHORA = Date.parse("2026-11-09T09:20:00+13:00");

test("KiWIS: URL de valores con el ts_path, dajson, 1 día y la unidad en los metadatos", () => {
  const u = new URL(urlValoresKiwis("1257/2/S/Cmd.P"));
  assert.equal(u.origin, "http://envdata.waikatoregion.govt.nz:8080");
  assert.equal(u.pathname, "/KiWIS/KiWIS");
  assert.equal(u.searchParams.get("request"), "getTimeseriesValues");
  assert.equal(u.searchParams.get("ts_path"), "1257/2/S/Cmd.P");
  assert.equal(u.searchParams.get("format"), "dajson");
  assert.equal(u.searchParams.get("period"), "P1D");
  assert.equal(u.searchParams.get("datasource"), "0");
  assert.match(u.searchParams.get("md_returnfields"), /ts_unitsymbol/);
});

test("KiWIS: las 5 estaciones con los ts_path que dio Waikato Regional Council", () => {
  assert.deepEqual(
    Object.fromEntries(ESTACIONES_WAIKATO.map((e) => [e.clave, [e.tipo, e.tsPath]])),
    {
      waiwawa: ["caudal", "1257/2/S/Cmd.P"], tairua: ["caudal", "940/2/S/Cmd.P"],
      raglan: ["marea", "857/23/TideLVL/Cmd.P"], whitianga: ["marea", "1328/20/TideLVL/Cmd.P"],
      kawhia: ["marea", "1869/17/TideLVL/Cmd.P"],
    }
  );
  for (const e of ESTACIONES_WAIKATO) assert.ok(e.lat < -36 && e.lat > -38.5 && e.lon > 174 && e.lon < 176.5, e.clave);
});

test("KiWIS: horas con desfase, en UTC; sin desfase, hora de Auckland", () => {
  assert.equal(horaKiwis("2026-11-09T09:00:00.000+13:00"), Date.parse("2026-11-08T20:00:00Z"));
  assert.equal(horaKiwis("2026-11-09 09:00:00"), Date.parse("2026-11-08T20:00:00Z"), "noviembre: NZDT, +13");
  assert.equal(horaKiwis("2026-06-09 09:00:00"), Date.parse("2026-06-08T21:00:00Z"), "junio: NZST, +12");
  assert.equal(horaKiwis(""), null);
  assert.equal(horaKiwis("basura"), null);
});

test("KiWIS dajson: puntos ordenados, sin huecos, con la unidad", () => {
  const s = parsearKiwis(TAIRUA);
  assert.equal(s.unidad, "m³/s");
  assert.equal(s.puntos.length, 5, "el valor null no cuenta");
  assert.equal(s.puntos[0].v, 3.412);
  assert.equal(s.puntos.at(-1).t, Date.parse("2026-11-08T20:15:00Z"));
});

test("KiWIS csv: metadatos con #, separador ;, valores vacíos fuera", () => {
  const s = parsearKiwis(RAGLAN);
  assert.equal(s.unidad, "mm");
  assert.deepEqual(s.puntos.map((p) => p.v), [2810, 2655, 2490, 2150]);
  // También con coma y sin metadatos.
  const c = parsearKiwis("#Timestamp,Value\n2026-11-09T09:00:00.000+13:00,1.5\n");
  assert.deepEqual(c.puntos.map((p) => p.v), [1.5]);
});

test("KiWIS: un error del servicio o un JSON roto lanzan", () => {
  assert.throws(() => parsearKiwis('{"type":"error","code":"InvalidParameterValue","message":"ts_path not found"}'), /ts_path not found/);
  assert.throws(() => parsearKiwis("[{"), /ilegible/);
});

test("unidades: caudal en m³/s, nivel en metros (mm y cm convertidos)", () => {
  assert.equal(normalizarUnidad(2500, "l/s", "caudal"), 2.5);
  assert.equal(normalizarUnidad(4.1, "m³/s", "caudal"), 4.1);
  assert.equal(normalizarUnidad(2150, "mm", "marea"), 2.15);
  assert.equal(normalizarUnidad(215, "cm", "marea"), 2.15);
  assert.equal(normalizarUnidad(1.8, "m", "marea"), 1.8);
  assert.equal(normalizarUnidad(1800, null, "marea"), 1.8, "sin unidad y > 30: mm");
});

test("resumen: último valor, hora, tendencia de la última hora, máximo de 24 h y provisional", () => {
  const rio = resumenSerie(parsearKiwis(TAIRUA), "caudal", AHORA);
  assert.deepEqual(rio, {
    valor: 4.7, unidad: "m³/s", hora: "2026-11-08T20:15:00.000Z", tendencia: "sube", max24h: 4.7, provisional: true,
  });
  const marea = resumenSerie(parsearKiwis(RAGLAN), "marea", AHORA);
  assert.equal(marea.valor, 2.15);
  assert.equal(marea.unidad, "m");
  assert.equal(marea.tendencia, "baja");
  assert.equal(marea.max24h, undefined);
  assert.equal(marea.provisional, true);
  // Dato de hace más de 24 h: no se enseña.
  assert.equal(resumenSerie(parsearKiwis(RAGLAN), "marea", AHORA + 2 * 86400e3), null);
  assert.equal(resumenSerie({ puntos: [] }, "caudal", AHORA), null);
});

function cacheFalsa() {
  const guardado = new Map();
  return {
    guardado,
    match: async (k) => { const g = guardado.get(k.url); return g ? new Response(g.cuerpo) : undefined; },
    put: async (k, r) => { guardado.set(k.url, { cuerpo: await r.text(), cc: r.headers.get("cache-control") }); },
  };
}

test("datosWaikato: una petición por estación y, con caché, ninguna más; un fallo no rompe el resto", async () => {
  const pedidas = [];
  const fetchFn = async (url) => {
    pedidas.push(url);
    const ts = new URL(url).searchParams.get("ts_path");
    if (ts.startsWith("940/")) return new Response(TAIRUA);
    if (ts.startsWith("857/")) return new Response(RAGLAN);
    if (ts.startsWith("1328/")) return new Response("down", { status: 503 });
    if (ts.startsWith("1869/")) return new Response(RAGLAN);
    return new Response('[{"columns":"Timestamp,Value","data":[]}]');
  };
  const cache = cacheFalsa();
  const d = await datosWaikato({ fetchFn, cache, origen: "https://c.org", ahora: AHORA });
  assert.equal(pedidas.length, 5);
  assert.equal(d.caudales.tairua.valor, 4.7);
  assert.equal(d.caudales.tairua.nombre, "Tairua River");
  assert.equal(d.caudales.tairua.spotCosta, "nz-tairua");
  assert.equal(d.caudales.waiwawa.error, "sin dato reciente");
  assert.equal(d.nivelesMarea.raglan.valor, 2.15);
  assert.equal(d.nivelesMarea.kawhia.valor, 2.15);
  assert.equal(d.nivelesMarea.kawhia.nombre, "Kawhia");
  assert.match(d.nivelesMarea.whitianga.error, /503/);
  // Nada del servidor KiWIS en lo que se manda al navegador.
  assert.doesNotMatch(JSON.stringify(d), /8080|ts_path|Cmd\.P/);
  // Caché: 2 h el dato, 1 h el fallo.
  assert.equal(cache.guardado.get("https://c.org/__cache/kiwis-waikato/tairua").cc, `public, max-age=${CACHE_WAIKATO_S}`);
  assert.equal(cache.guardado.get("https://c.org/__cache/kiwis-waikato/whitianga").cc, "public, max-age=3600");
  const otra = await datosWaikato({ fetchFn, cache, origen: "https://c.org", ahora: AHORA });
  assert.equal(pedidas.length, 5, "segunda vez: todo de la caché");
  assert.deepEqual(otra, d);
});

test("datosWaikato: sin red ni caché, todas con error y sin lanzar", async () => {
  const d = await datosWaikato({ fetchFn: async () => { throw new Error("sin red"); }, cache: null, ahora: AHORA });
  assert.deepEqual(Object.keys(d.caudales), ["waiwawa", "tairua"]);
  assert.deepEqual(Object.keys(d.nivelesMarea), ["raglan", "whitianga", "kawhia"]);
  assert.ok(Object.values({ ...d.caudales, ...d.nivelesMarea }).every((x) => /sin red/.test(x.error)));
});

test("mareógrafo de cada spot: Raglan, Whitianga y Kawhia a ≤ 20 km; los demás, ninguno", () => {
  const niveles = {
    raglan: { nombre: "Raglan", valor: 2.15, hora: "x", provisional: true },
    whitianga: { nombre: "Whitianga", valor: 1.1, hora: "x", provisional: true },
    kawhia: { nombre: "Kawhia", valor: 1.7, hora: "x", provisional: true },
  };
  const spot = (slug) => SPOTS_NZ.find((s) => s.slug === slug);
  assert.equal(mareografoDeSpot(spot("nz-raglan"), niveles).clave, "raglan");
  assert.equal(mareografoDeSpot(spot("nz-whitianga"), niveles).clave, "whitianga");
  assert.equal(mareografoDeSpot(spot("nz-kawhia"), niveles).clave, "kawhia");
  assert.ok(mareografoDeSpot(spot("nz-kawhia"), niveles).km < 2);
  assert.equal(mareografoDeSpot(spot("nz-leigh"), niveles), null);
  // Raglan y Kawhia están a ~30 km: cada spot, solo el suyo.
  assert.equal(mareografoDeSpot(spot("nz-kawhia"), { raglan: niveles.raglan }), null);
  assert.equal(mareografoDeSpot(spot("nz-raglan"), { kawhia: niveles.kawhia }), null);
  assert.equal(mareografoDeSpot(spot("nz-raglan"), { raglan: { error: "x" } }), null);
});

test("/prevision?region=nz: caudales, nivelesMarea, mareaMedida en los spots cercanos y la atribución de Waikato", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]", { status: 404 });
  try {
    const waikato = async () => ({
      caudales: { tairua: { nombre: "Tairua River", valor: 4.7, unidad: "m³/s", provisional: true } },
      nivelesMarea: {
        raglan: { nombre: "Raglan", valor: 2.15, unidad: "m", provisional: true, hora: "2026-11-08T20:00:00.000Z" },
        kawhia: { nombre: "Kawhia", valor: 1.7, unidad: "m", provisional: true, hora: "2026-11-08T20:00:00.000Z" },
      },
    });
    const d = await previsionRegionNZ(SPOTS_NZ, {}, "https://c.org", AHORA, async () => ({}), async () => ({ lecturas: {}, medidas: {} }), waikato);
    assert.equal(d.caudales.tairua.valor, 4.7);
    assert.equal(d.nivelesMarea.raglan.valor, 2.15);
    assert.equal(d.spots.find((s) => s.slug === "nz-raglan").mareaMedida.valor, 2.15);
    assert.equal(d.spots.find((s) => s.slug === "nz-kawhia").mareaMedida.valor, 1.7);
    assert.equal(d.spots.find((s) => s.slug === "nz-leigh").mareaMedida, undefined);
    assert.equal(d.atribuciones.waikato.url, "https://www.waikatoregion.govt.nz");
    assert.equal(d.atribuciones.waikato.licencia, "https://creativecommons.org/licenses/by/4.0/");
    assert.match(d.atribuciones.waikato.aviso, /[Pp]rovisional/);
    // Si Waikato falla entero, la región sigue.
    const sin = await previsionRegionNZ(SPOTS_NZ, {}, "https://c.org", AHORA, async () => ({}), async () => ({ lecturas: {}, medidas: {} }), async () => { throw new Error("x"); });
    assert.deepEqual(sin.caudales, {});
    assert.equal(sin.spots.length, SPOTS_NZ.length);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

// Condiciones del permiso (comun, permisos/registro.json, waikato-rc):
// "Waikato Regional Council" con enlace a su web y a la CC BY 4.0, y aviso
// de dato provisional, en el servidor y en los tres idiomas de la app.
test("cita obligatoria: Waikato Regional Council, enlace a su web y a la CC BY 4.0, dato provisional", () => {
  assert.equal(URL_WAIKATO, "https://www.waikatoregion.govt.nz");
  assert.equal(URL_LICENCIA_WAIKATO, "https://creativecommons.org/licenses/by/4.0/");
  assert.match(ATRIBUCION_WAIKATO, /^Source: Waikato Regional Council, licensed under CC BY 4\.0$/);
  assert.match(AVISO_WAIKATO, /^Provisional data/);
  const provisional = { es: /provisional/, en: /provisional/, pt: /provisório/ };
  for (const idioma of ["es", "en", "pt"]) {
    const src = leer(`assets/i18n/${idioma}.js`);
    const linea = (k) => src.split("\n").find((l) => l.includes(`"${k}"`));
    const atrib = linea("mapa.atrib.waikato");
    assert.ok(atrib, idioma);
    assert.ok(atrib.includes('<a href=\\"https://www.waikatoregion.govt.nz\\" target=\\"_blank\\" rel=\\"noopener\\">Waikato Regional Council</a>'), idioma);
    assert.ok(atrib.includes('<a href=\\"https://creativecommons.org/licenses/by/4.0/\\" target=\\"_blank\\" rel=\\"noopener\\">CC BY 4.0</a>'), idioma);
    assert.match(atrib, provisional[idioma], idioma);
    assert.match(linea("mapa.waikato.cita_corta"), /Waikato Regional Council, CC BY 4\.0/, idioma);
    assert.match(linea("mapa.waikato.cita_corta"), provisional[idioma], idioma);
    assert.match(linea("mapa.waikato.provisional"), new RegExp(provisional[idioma].source, "i"), idioma);
  }
  const html = leer("index.html");
  // Ficha del spot: enlaces a la web y a la licencia + aviso.
  assert.match(html, /function pintarMareaMedida\(s\)/);
  assert.match(html, /enlace\("https:\/\/www\.waikatoregion\.govt\.nz", "Waikato Regional Council"\)/);
  assert.match(html, /enlace\("https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/", "CC BY 4\.0"\)/);
  assert.match(html, /I18n\.t\("mapa\.waikato\.provisional"\)/);
  // Créditos del mapa y tooltip de los ríos.
  assert.match(html, /addAttribution\(I18n\.t\("mapa\.atrib\.waikato"\)\)/);
  assert.match(html, /I18n\.t\("mapa\.waikato\.cita_corta"\)/);
});

test("ríos de NZ en el mapa: Waiwawa y Tairua con su clave de caudal; el spot de la desembocadura lo manda el servidor", () => {
  const html = leer("index.html");
  assert.match(html, /rio: "Waiwawa",\n/);
  assert.match(html, /rio: "Tairua",\n/);
  assert.match(html, /slugCaudal: "waiwawa"/);
  assert.match(html, /slugCaudal: "tairua"/);
  assert.match(html, /if \(c\.spotCosta && !r\.spotCosta\) r\.spotCosta = c\.spotCosta;/);
  assert.equal(ESTACIONES_WAIKATO.find((e) => e.clave === "waiwawa").spotCosta, "nz-whitianga");
  assert.equal(ESTACIONES_WAIKATO.find((e) => e.clave === "tairua").spotCosta, "nz-tairua");
  // RIOS_SPOT (páginas públicas de España) no lleva los de NZ.
  assert.ok(!Object.keys(RIOS_SPOT).some((k) => k.startsWith("nz-")));
  // El caudal de NZ llega con /prevision?region=nz y se vuelve a pintar la capa.
  assert.match(html, /aplicarCaudales\(datos\.caudales\);\n\s+if \(marcadoresListos\) pintarRios\(\);/);
});
