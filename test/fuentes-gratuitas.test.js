// Test de las fuentes gratuitas (MET Norway y Copernicus Marine) y de los
// interruptores por variable (functions/_lib/fuentes.js), 2026-10-08.
//
// Lo que se fija aquí:
//   - Sin variables de entorno TODO sigue en Open-Meteo, con la misma URL de
//     siempre (producción no cambia hasta que se active un interruptor).
//   - Los adaptadores devuelven la forma de Open-Meteo: mismas etiquetas de
//     hora (con su desfase fijo), mismas unidades, null donde no hay dato.
//   - MET Norway: User-Agent con contacto obligatorio, coordenadas con 2
//     decimales, se respeta Expires y se usa If-Modified-Since.
//   - Copernicus: lee el formato que escribe scripts/fuentes/descargar-ibi.py
//     (fixtures generados con su modo --prueba).
//   - La atribución del navegador (assets/js/meteo.js) es la de fuentes.js.
//   - La comparativa contra boyas descarta medidas con marca de calidad != 1
//     y compara todas las fuentes en las mismas horas.
// Sin red: fetch se sustituye por dobles. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ejeHorario } from "../functions/_lib/eje-horario.js";
import {
  serieDesdeMet, serieAOpenMeteo, pedirMetNorway, userAgentMetNorway, urlMetNorway, interpolarSerie,
} from "../functions/_lib/met-norway.js";
import { puntoAOpenMeteo, pedirCopernicusMar, claveCaja } from "../functions/_lib/copernicus-mar.js";
import { vaciarMemoriaInstantaneas, leerInstantanea } from "../functions/_lib/instantaneas.js";
import { pedirDatosMeteo, fuenteDeVariable, firmaFuentes, ATRIBUCIONES_HTML } from "../functions/_lib/fuentes.js";
import { onRequestGet } from "../functions/meteo/[api].js";
import { puntosInstantanea } from "../scripts/fuentes/instantanea-met.mjs";
import { parsearBoya, estadisticas, cruzar } from "../scripts/fuentes/comparar-boyas.mjs";

const MET = JSON.parse(readFileSync("test/fixtures/metno-locationforecast.json", "utf8"));
const COP_SPOTS = JSON.parse(readFileSync("test/fixtures/copernicus-spots.json", "utf8"));
const COP_CELDAS = JSON.parse(readFileSync("test/fixtures/copernicus-celdas-86_-6.json", "utf8"));
const AHORA_MET = Date.parse("2026-10-08T00:30:00Z");
const CONTACTO = { METNO_CONTACTO: "https://costaviva.org/contacto" };

function respuestaJSON(obj, extra = {}) {
  return new Response(JSON.stringify(obj), { headers: { "content-type": "application/json", ...extra } });
}

// --- Interruptores --------------------------------------------------------

test("interruptores: por defecto todo en Open-Meteo", () => {
  for (const v of ["windspeed_10m", "pressure_msl", "cloudcover", "precipitation", "temperature_2m"]) {
    assert.equal(fuenteDeVariable("forecast", v, {}), "openmeteo");
  }
  for (const v of ["wave_height", "sea_surface_temperature", "sea_level_height_msl", "ocean_current_velocity"]) {
    assert.equal(fuenteDeVariable("marine", v, {}), "openmeteo");
  }
  assert.equal(firmaFuentes("forecast", {}), "");
  assert.equal(firmaFuentes("marine", {}), "");
});

test("interruptores: general, por grupo y valores raros", () => {
  const env = { FUENTE_ATMOSFERA: "metno", FUENTE_PRESION: "openmeteo", FUENTE_MAR: "copernicus", FUENTE_MAREA: "OpenMeteo" };
  assert.equal(fuenteDeVariable("forecast", "windspeed_10m", env), "metno");
  assert.equal(fuenteDeVariable("forecast", "pressure_msl", env), "openmeteo");
  assert.equal(fuenteDeVariable("marine", "wave_height", env), "copernicus");
  assert.equal(fuenteDeVariable("marine", "sea_level_height_msl", env), "openmeteo");
  // Fuente de otra API o inventada -> openmeteo.
  assert.equal(fuenteDeVariable("forecast", "windspeed_10m", { FUENTE_ATMOSFERA: "copernicus" }), "openmeteo");
  assert.equal(fuenteDeVariable("marine", "wave_height", { FUENTE_OLEAJE: "ecmwf" }), "openmeteo");
  assert.notEqual(firmaFuentes("forecast", env), "");
});

test("sin interruptores, pedirDatosMeteo hace la misma llamada a Open-Meteo de siempre", async () => {
  const pedidas = [];
  const fetchImpl = async (url) => {
    pedidas.push(String(url));
    return respuestaJSON([{ hourly: { time: ["2026-10-08T00:00"], wave_height: [1] } }, { hourly: { time: ["2026-10-08T00:00"], wave_height: [2] } }]);
  };
  const consulta = "latitude=43.1,43.2&longitude=-2.1,-2.2&timezone=Europe%2FMadrid&forecast_days=2&hourly=wave_height";
  const d = await pedirDatosMeteo("marine", consulta, { env: {}, fetchImpl });
  assert.deepEqual(pedidas, [`https://marine-api.open-meteo.com/v1/marine?${consulta}`]);
  assert.equal(d.length, 2);
  assert.deepEqual(d[0].fuentes_datos, ["openmeteo"]);
  // Con la key comercial, el host customer- como siempre.
  pedidas.length = 0;
  await pedirDatosMeteo("marine", consulta, { env: { OPEN_METEO_API_KEY: "k" }, fetchImpl });
  assert.match(pedidas[0], /^https:\/\/customer-marine-api\.open-meteo\.com\/.*&apikey=k$/);
});

// --- Eje horario ------------------------------------------------------------

test("eje horario: como Open-Meteo (desfase fijo, 24 h por día)", () => {
  const ahora = Date.parse("2026-10-08T01:00:00Z"); // CEST, +2
  const e = ejeHorario({ timezone: "Europe/Madrid", past_days: 1, forecast_days: 2 }, ahora);
  assert.equal(e.horas.length, 72);
  assert.equal(e.horas[0].etiqueta, "2026-10-07T00:00");
  assert.equal(new Date(e.horas[0].ms).toISOString(), "2026-10-06T22:00:00.000Z");
  assert.equal(e.utc_offset_seconds, 7200);
  // Pedido en octubre para marzo (cruza el cambio de hora): Open-Meteo usa el
  // desfase de AHORA para todo (comprobado en real el 2026-10-08).
  const m = ejeHorario({ timezone: "Europe/Madrid", start_date: "2026-03-28", end_date: "2026-03-30" }, ahora);
  assert.equal(m.horas.length, 72);
  assert.equal(new Date(m.horas[0].ms).toISOString(), "2026-03-27T22:00:00.000Z");
  assert.ok(m.horas.some((h) => h.etiqueta === "2026-03-29T02:00"));
  const g = ejeHorario({ timezone: "GMT", forecast_days: 2 }, ahora);
  assert.equal(g.horas[0].etiqueta, "2026-10-08T00:00");
  assert.equal(g.timezone, "GMT");
});

// --- MET Norway -------------------------------------------------------------

test("MET Norway: forma de Open-Meteo, unidades y precipitación de la hora anterior", () => {
  const serie = serieDesdeMet(MET);
  const sp = new URLSearchParams("timezone=GMT&forecast_days=3&windspeed_unit=kmh");
  const o = serieAOpenMeteo(serie, sp, {
    lat: 43.4, lon: -2.7, hourly: ["windspeed_10m", "winddirection_10m", "pressure_msl", "cloudcover", "precipitation", "temperature_2m"],
    current: ["pressure_msl", "cloud_cover"], ahora: AHORA_MET,
  });
  assert.equal(o.hourly.time.length, 72);
  assert.equal(o.hourly.time[0], "2026-10-08T00:00");
  assert.equal(o.hourly_units.windspeed_10m, "km/h");
  assert.equal(o.hourly.windspeed_10m[0], 40); // 11.1 m/s * 3.6 = 39.96
  assert.equal(o.hourly.winddirection_10m[0], 325);
  assert.equal(o.hourly.pressure_msl[1], 1021.4);
  // precipitation[T] = next_1_hours de T-1 (suma de la hora anterior, como Open-Meteo)
  assert.equal(o.hourly.precipitation[0], null);
  assert.equal(o.hourly.precipitation[3], 0.2);
  assert.equal(o.hourly.precipitation[4], 0.4);
  // Más allá del tramo horario de MET: solo cada 6 h, el resto null (sin inventar).
  const i12 = o.hourly.time.indexOf("2026-10-10T12:00");
  assert.equal(o.hourly.pressure_msl[i12], 1022);
  assert.equal(o.hourly.pressure_msl[i12 + 1], null);
  assert.equal(o.hourly.pressure_msl[10], null);
  assert.equal(o.current.time, "2026-10-08T00:00");
  assert.equal(o.current.pressure_msl, 1020.7);
  assert.equal(o.current.cloud_cover, 18.7);
  // m/s y nudos.
  const ms = serieAOpenMeteo(serie, new URLSearchParams("timezone=GMT&forecast_days=1&wind_speed_unit=ms"), { hourly: ["wind_speed_10m"], ahora: AHORA_MET });
  assert.equal(ms.hourly.wind_speed_10m[0], 11.1);
  assert.equal(ms.hourly_units.wind_speed_10m, "m/s");
  // Horas pasadas (diario retroactivo): MET no tiene histórico -> null.
  const pasado = serieAOpenMeteo(serie, new URLSearchParams("timezone=Europe/Madrid&start_date=2026-10-01&end_date=2026-10-01"), { hourly: ["pressure_msl"], ahora: AHORA_MET });
  assert.ok(pasado.hourly.pressure_msl.every((v) => v === null));
});

test("MET Norway: sin contacto no se llama; User-Agent y coordenadas de sus condiciones", async () => {
  assert.throws(() => userAgentMetNorway({}), /METNO_CONTACTO/);
  assert.equal(userAgentMetNorway(CONTACTO), "Costaviva/1.0 https://costaviva.org/contacto");
  assert.equal(urlMetNorway(43.40471, -2.69891), "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=43.40&lon=-2.70");
  let llamadas = 0;
  await assert.rejects(pedirMetNorway(43.4, -2.7, { env: {}, fetchImpl: async () => { llamadas++; return respuestaJSON(MET); } }), /METNO_CONTACTO/);
  assert.equal(llamadas, 0);
});

test("MET Norway: respeta Expires y repregunta con If-Modified-Since", async () => {
  const guardado = new Map();
  const cache = {
    match: async (req) => guardado.get(req.url)?.clone(),
    put: async (req, resp) => { guardado.set(req.url, resp.clone()); },
  };
  const llamadas = [];
  let modo = 200;
  const fetchImpl = async (url, init) => {
    llamadas.push({ url, headers: init.headers });
    if (modo === 304) return new Response(null, { status: 304, headers: { expires: "Thu, 08 Oct 2026 02:00:00 GMT" } });
    return respuestaJSON(MET, { expires: "Thu, 08 Oct 2026 01:00:00 GMT", "last-modified": "Thu, 08 Oct 2026 00:20:00 GMT" });
  };
  const o = { env: CONTACTO, fetchImpl, cache, origen: "https://costaviva.org" };
  await pedirMetNorway(43.4, -2.7, { ...o, ahora: AHORA_MET });
  assert.match(llamadas[0].headers["User-Agent"], /^Costaviva\/1\.0 /);
  await pedirMetNorway(43.4, -2.7, { ...o, ahora: AHORA_MET + 60e3 }); // antes de Expires
  assert.equal(llamadas.length, 1);
  modo = 304;
  const d = await pedirMetNorway(43.4, -2.7, { ...o, ahora: Date.parse("2026-10-08T01:05:00Z") });
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1].headers["If-Modified-Since"], "Thu, 08 Oct 2026 00:20:00 GMT");
  assert.equal(d.properties.timeseries.length, MET.properties.timeseries.length);
});

test("MET Norway: interpolación de la rejilla por componentes del viento", () => {
  const s = (ws, wd, p) => ({ inicio: 0, horas: 1, p: [p], t: [10], c: [50], ws: [ws], wd: [wd], pr: [0] });
  const r = interpolarSerie([s(10, 350, 1000), s(10, 10, 1010), s(10, 350, 1000), s(10, 10, 1010)], [0.25, 0.25, 0.25, 0.25]);
  // Norte-noroeste y norte-noreste -> norte (no 180°, que saldría promediando grados).
  assert.ok(r.wd[0] < 1 || r.wd[0] > 359);
  assert.ok(Math.abs(r.ws[0] - 10 * Math.cos((10 * Math.PI) / 180)) < 1e-9);
  assert.equal(r.p[0], 1005);
  // Falta una esquina: la más cercana disponible, sin inventar.
  const r2 = interpolarSerie([s(5, 90, 1000), null, null, null], [0.1, 0.9, 0, 0]);
  assert.equal(r2.ws[0], 5);
});

test("mezcla de fuentes: cada variable a su fuente y casadas por hora", async () => {
  const pedidas = [];
  const fetchImpl = async (url) => {
    pedidas.push(String(url));
    if (String(url).startsWith("https://api.met.no/")) return respuestaJSON(MET, { expires: "Thu, 08 Oct 2026 01:00:00 GMT" });
    const u = new URL(url);
    const time = Array.from({ length: 24 }, (_, i) => `2026-10-08T${String(i).padStart(2, "0")}:00`);
    return respuestaJSON({ latitude: 43.4, longitude: -2.7, utc_offset_seconds: 0, hourly_units: { time: "iso8601", pressure_msl: "hPa" }, hourly: { time, pressure_msl: time.map(() => 1000) }, _vars: u.searchParams.get("hourly") });
  };
  const env = { ...CONTACTO, FUENTE_ATMOSFERA: "metno", FUENTE_PRESION: "openmeteo" };
  const d = await pedirDatosMeteo("forecast", "latitude=43.40&longitude=-2.70&timezone=GMT&forecast_days=1&hourly=windspeed_10m,pressure_msl&windspeed_unit=kmh", { env, fetchImpl, ahora: AHORA_MET });
  const om = pedidas.find((u) => u.includes("open-meteo.com"));
  assert.match(om, /hourly=pressure_msl(&|$)/); // a Open-Meteo solo le pide lo suyo
  assert.ok(pedidas.some((u) => u.startsWith("https://api.met.no/")));
  assert.deepEqual(d.fuentes_datos, ["openmeteo", "metno"]);
  assert.equal(d.hourly.pressure_msl[0], 1000);
  assert.equal(d.hourly.windspeed_10m[0], 40);
  assert.equal(d.hourly.windspeed_10m.length, 24);
});

test("MET Norway con muchos puntos: instantánea (spot exacto y rejilla)", async () => {
  vaciarMemoriaInstantaneas();
  const serie = serieDesdeMet(MET);
  const inst = {
    generado_en: "2026-10-08T00:10:00Z",
    rejilla: { paso: 1 },
    puntos: [
      { id: "mundaka", tipo: "spot", lat: 43.4047, lon: -2.6989, serie },
      ...[[43, -3], [43, -2], [44, -3], [44, -2]].map(([la, lo]) => ({ id: `r${la}_${lo}`, tipo: "rejilla", lat: la, lon: lo, serie })),
    ],
  };
  const pedidas = [];
  const fetchImpl = async (url) => { pedidas.push(String(url)); return respuestaJSON(inst); };
  const d = await pedirDatosMeteo("forecast", "latitude=43.4047,43.5&longitude=-2.6989,-2.5&timezone=GMT&forecast_days=1&hourly=windspeed_10m&windspeed_unit=ms", {
    env: { ...CONTACTO, FUENTE_VIENTO: "metno" }, fetchImpl, ahora: AHORA_MET,
  });
  assert.equal(pedidas.length, 1);
  assert.match(pedidas[0], /\/fuentes-gratuitas\/atmosfera\/todos\.json$/);
  assert.ok(!pedidas.some((u) => u.includes("api.met.no")));
  assert.equal(d[0].hourly.windspeed_10m[0], 11.1);
  assert.ok(Math.abs(d[1].hourly.windspeed_10m[0] - 11.1) < 0.05); // las 4 esquinas iguales
});

// --- Copernicus Marine ------------------------------------------------------

function fetchCopernicus(pedidas = []) {
  return async (url) => {
    pedidas.push(String(url));
    if (String(url).endsWith("/mar/spots.json")) return respuestaJSON(COP_SPOTS);
    if (String(url).endsWith("/mar/celdas/86_-6.json")) return respuestaJSON(COP_CELDAS);
    return new Response("not found", { status: 404 });
  };
}
const AHORA_COP = Date.parse(COP_SPOTS.generado_en) + 3600e3;

test("Copernicus: formato de descargar-ibi.py -> forma de Open-Meteo Marine", () => {
  const p = COP_SPOTS.puntos.find((x) => x.id === "lekeitio");
  const sp = new URLSearchParams("timezone=GMT&start_date=2026-09-28&end_date=2026-09-29");
  const o = puntoAOpenMeteo(p, Date.parse(COP_SPOTS.inicio), sp, {
    hourly: ["wave_height", "wave_direction", "wave_period", "sea_surface_temperature", "sea_level_height_msl", "ocean_current_velocity", "ocean_current_direction"],
    ahora: AHORA_COP,
  });
  assert.equal(o.hourly.time.length, 48);
  assert.equal(o.hourly.time[0], "2026-09-28T00:00");
  assert.deepEqual(o.hourly.wave_height.slice(0, 3), p.wh.slice(0, 3));
  assert.deepEqual(o.hourly.sea_level_height_msl.slice(0, 3), p.sl.slice(0, 3));
  assert.equal(o.hourly_units.ocean_current_velocity, "km/h");
  assert.equal(o.hourly_units.wave_height, "m");
  // Fuera de lo descargado (72 h desde el inicio): null.
  const fuera = puntoAOpenMeteo(p, Date.parse(COP_SPOTS.inicio), new URLSearchParams("timezone=GMT&start_date=2026-10-05&end_date=2026-10-05"), { hourly: ["wave_height"], ahora: AHORA_COP });
  assert.ok(fuera.hourly.wave_height.every((v) => v === null));
});

test("Copernicus: un punto -> celda de mar más cercana; varios -> spots.json", async () => {
  vaciarMemoriaInstantaneas();
  const sp = new URLSearchParams("timezone=GMT&start_date=2026-09-28&end_date=2026-09-28&hourly=wave_height");
  const pedidas = [];
  const [uno] = await pedirCopernicusMar([{ lat: 43.36, lon: -2.52 }], sp, { hourly: ["wave_height"], fetchImpl: fetchCopernicus(pedidas), ahora: AHORA_COP });
  assert.equal(uno.latitude, 43.3616);
  assert.deepEqual(uno.hourly.wave_height.slice(0, 2), COP_CELDAS.puntos[0].wh.slice(0, 2));
  assert.ok(pedidas.every((u) => u.includes("/mar/celdas/")));
  assert.equal(claveCaja(43.3616, -2.5273), "86_-6");
  // Lejos de cualquier celda: null y aviso, nunca el dato de otro sitio.
  vaciarMemoriaInstantaneas();
  const [lejos] = await pedirCopernicusMar([{ lat: 40, lon: -20 }], sp, { hourly: ["wave_height"], fetchImpl: fetchCopernicus(), ahora: AHORA_COP });
  assert.ok(lejos.hourly.wave_height.every((v) => v === null));
  assert.match(lejos.aviso, /15 km/);
  // Varios spots (prevision.js): spots.json por coordenada.
  vaciarMemoriaInstantaneas();
  const d = await pedirDatosMeteo("marine", "latitude=43.3647,43.4047&longitude=-2.5089,-2.6989&timezone=GMT&start_date=2026-09-28&end_date=2026-09-28&hourly=wave_height,sea_level_height_msl", {
    env: { FUENTE_MAR: "copernicus" }, fetchImpl: fetchCopernicus(), ahora: AHORA_COP,
  });
  assert.equal(d.length, 2);
  assert.deepEqual(d[1].hourly.wave_height.slice(0, 2), COP_SPOTS.puntos.find((x) => x.id === "mundaka").wh.slice(0, 2));
  assert.deepEqual(d[0].fuentes_datos, ["copernicus"]);
});

test("instantánea caducada -> error (no se sirve una previsión vieja)", async () => {
  vaciarMemoriaInstantaneas();
  await assert.rejects(
    leerInstantanea("mar/spots.json", { fetchImpl: fetchCopernicus(), ahora: Date.parse(COP_SPOTS.generado_en) + 40 * 3600e3 }),
    /caducada/
  );
});

// --- Proxy ------------------------------------------------------------------

test("proxy /meteo con MET Norway: misma forma, fuentes_datos y clave de caché distinta", async () => {
  const original = globalThis.fetch;
  const pedidas = [];
  globalThis.fetch = async (url) => {
    pedidas.push(String(url));
    return respuestaJSON(MET, { expires: "Thu, 08 Oct 2026 01:00:00 GMT" });
  };
  try {
    const r = await onRequestGet({
      request: new Request("https://costaviva.org/meteo/forecast?latitude=43.4047&longitude=-2.6989&hourly=windspeed_10m,pressure_msl&windspeed_unit=kmh&timezone=Europe/Madrid&forecast_days=1"),
      env: { ...CONTACTO, FUENTE_ATMOSFERA: "metno" },
      params: { api: "forecast" },
      waitUntil: () => {},
    });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.deepEqual(d.fuentes_datos, ["metno"]);
    assert.equal(d.hourly.time.length, 24);
    assert.ok(pedidas.every((u) => u.startsWith("https://api.met.no/")));
    assert.match(pedidas[0], /lat=43\.40&lon=-2\.70$/);
  } finally {
    globalThis.fetch = original;
  }
});

// --- Atribución -------------------------------------------------------------

test("atribución del navegador = la de functions/_lib/fuentes.js, y se actualiza", () => {
  const nodos = [{ innerHTML: "" }, { innerHTML: "" }];
  const eventos = [];
  const ventana = {
    fetch: () => Promise.reject(new Error("sin red")),
    dispatchEvent: (e) => eventos.push(e),
  };
  const ctx = {
    window: ventana,
    document: { querySelectorAll: () => nodos },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o.detail; } },
    fetch: ventana.fetch,
  };
  vm.runInNewContext(readFileSync("assets/js/meteo.js", "utf8"), ctx);
  for (const f of Object.keys(ATRIBUCIONES_HTML)) assert.equal(ventana.ATRIBUCIONES_METEO_HTML[f], ATRIBUCIONES_HTML[f], f);
  assert.equal(ventana.ATRIBUCION_METEO_HTML, ATRIBUCIONES_HTML.openmeteo);
  ventana.registrarFuentesMeteo(["metno", "copernicus"]);
  assert.equal(nodos[0].innerHTML, `${ATRIBUCIONES_HTML.metno} · ${ATRIBUCIONES_HTML.copernicus}`);
  assert.equal(eventos.length, 1);
  assert.match(ATRIBUCIONES_HTML.copernicus, /Generated using E\.U\. Copernicus Marine Service Information/);
  assert.match(ATRIBUCIONES_HTML.metno, /MET Norway.*CC BY 4\.0/);
});

// --- Instantánea MET y comparativa ------------------------------------------

test("instantánea MET: ids de rejilla que encuentra fuentes.js y spots incluidos", () => {
  const p = puntosInstantanea([{ slug: "x", lat: 43.1, lon: -2.1 }]);
  assert.equal(p[0].id, "x");
  assert.ok(p.some((q) => q.id === "r43_-3" && q.tipo === "rejilla"));
  assert.ok(p.some((q) => q.id === "r28_-16"));
  assert.ok(p.length < 300); // < 20 peticiones/s de sobra y una pasada corta
});

test("comparativa: solo marca de calidad 1 y mismas horas para todas las fuentes", () => {
  const boya = parsearBoya([
    ["UTC", "Hm0 (m)", "WindSpeed (m/s)", "AirPressure (mb)"],
    [
      [1791331200, [1.5, 1], [8, 1], [950, 4]],
      [1791334800, [1.6, 1], [9, 1], [1012, 1]],
    ],
  ]);
  assert.equal(boya.get(1791331200000).p, undefined); // presión con marca 4 fuera
  assert.equal(boya.get(1791334800000).p, 1012);
  const desde = new Date(1791331200000).toISOString();
  const archivos = [{
    desde, horas: 2,
    fuentes: {
      openmeteo: { 2136: { wh: [1.0, 1.0], ws: [7, 7], p: [1010, 1010] } },
      metno: { 2136: { ws: [10, null], p: [1013, 1013] } },
    },
  }];
  const { pares } = cruzar(archivos, { 2136: boya }, 1791334800000);
  // Viento: MET no tiene la 2ª hora -> solo cuenta la 1ª para las dos.
  assert.equal(pares.openmeteo.ws.length, 1);
  assert.equal(pares.metno.ws.length, 1);
  assert.equal(pares.openmeteo.wh.length, 2); // ola: solo Open-Meteo la da
  assert.equal(pares.metno.p.length, 1);
  const e = estadisticas([[350, 10], [10, 350]], true); // circular: ±20°, no ±340°
  assert.equal(e.mae, 20);
  assert.equal(e.sesgo, 0);
});
