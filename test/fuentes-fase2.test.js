// Test de la fase 2 de fuentes gratuitas (2026-10-08):
//   - Franja costera de Copernicus: cualquier punto de costa toma la celda de
//     mar más cercana (aunque esté en otra caja de 0,5°); lejos, null y aviso.
//   - Capas de clorofila / temperatura del agua: lo que escribe
//     scripts/fuentes/descargar-capas.py (fixture generado con sus propias
//     funciones) lo lee igual assets/js/capas-mar.js.
//   - Selector de administrador del proxy /meteo/: `fuente=` solo para
//     admins comprobados en el servidor; el resto, 403 sin mirar la caché ni
//     pedir datos a nadie.
//   - Pasado (ERA5): forma de Open-Meteo, días UTC correctos, lluvia
//     desplazada bien, null + aviso si el día aún no está.
// Sin red: fetch se sustituye por dobles. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pedirCopernicusMar, claveCaja, cajasCercanas, MAX_KM_CELDA } from "../functions/_lib/copernicus-mar.js";
import { vaciarMemoriaInstantaneas } from "../functions/_lib/instantaneas.js";
import { pedirDatosMeteo, envConFuenteForzada, ATRIBUCIONES_HTML } from "../functions/_lib/fuentes.js";
import { pedirEra5, ventanaPasada, celdaEra5, claveCajaEra5, serieDesdeEra5, MAX_FICHEROS_ERA5 } from "../functions/_lib/era5.js";
import { requireAdmin } from "../functions/_lib/admin.js";
import { onRequestGet } from "../functions/meteo/[api].js";
import { bytesDeBase64, valorByte, valorEnPunto, filaDeDatos, pixelesCapa, colorPaleta } from "../assets/js/capas-mar.js";
import { fuenteEs } from "./i18n-html.js";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const AHORA = Date.parse("2026-10-08T10:30:00Z");

// --- Franja costera ---------------------------------------------------------

function cajaSintetica(puntos) {
  const horas = 48;
  return {
    v: 1, fuente: "copernicus-ibi", generado_en: "2026-10-08T05:00:00Z", inicio: "2026-10-07T00:00:00Z", horas,
    puntos: puntos.map(([lat, lon, wh]) => ({
      id: `c${lat}_${lon}`, tipo: "celda", anillo: 1, lat, lon,
      wh: Array(horas).fill(wh), wd: Array(horas).fill(300), wp: Array(horas).fill(8), wpp: Array(horas).fill(11),
      sst: Array(horas).fill(18.5), sl: Array(horas).fill(0.4), cv: Array(horas).fill(0.5), cd: Array(horas).fill(90),
    })),
  };
}
// Dos cajas vecinas (Galicia): 85_-18 (42,5-43 N; 9-8,5 W) y 85_-17 (8,5-8 W).
const CAJAS = {
  "85_-18": cajaSintetica([[42.60, -8.95, 1.1], [42.95, -8.6, 1.3]]),
  "85_-17": cajaSintetica([[42.62, -8.48, 2.2]]),
};
function fetchCajas(pedidas = []) {
  return async (url) => {
    pedidas.push(String(url));
    const m = /\/mar\/celdas\/(.+)\.json$/.exec(String(url));
    if (m && CAJAS[m[1]]) return json(CAJAS[m[1]]);
    return new Response("not found", { status: 404 });
  };
}

test("costa: la celda más cercana aunque esté en la caja de al lado", async () => {
  vaciarMemoriaInstantaneas();
  const sp = new URLSearchParams("timezone=GMT&start_date=2026-10-07&end_date=2026-10-07&hourly=wave_height");
  // Punto en la caja 85_-18 pero a 1,7 km de la celda de 85_-17.
  const pedidas = [];
  const [o] = await pedirCopernicusMar([{ lat: 42.615, lon: -8.50 }], sp, { hourly: ["wave_height"], fetchImpl: fetchCajas(pedidas), ahora: AHORA });
  assert.equal(o.hourly.wave_height[0], 2.2);
  assert.equal(o.latitude, 42.62);
  assert.ok(pedidas.some((u) => u.endsWith("/85_-17.json")) && pedidas.some((u) => u.endsWith("/85_-18.json")));
  assert.ok(cajasCercanas(42.615, -8.5).length <= 4);
});

test("costa: un punto a ~18 km tiene dato; a más de 20 km, null y aviso", async () => {
  vaciarMemoriaInstantaneas();
  const sp = new URLSearchParams("timezone=GMT&start_date=2026-10-07&end_date=2026-10-07&hourly=wave_height");
  // 0,16° al norte de (42.95, -8.6) ≈ 17,8 km.
  const [cerca] = await pedirCopernicusMar([{ lat: 43.11, lon: -8.6 }], sp, { hourly: ["wave_height"], fetchImpl: fetchCajas(), ahora: AHORA });
  assert.equal(cerca.hourly.wave_height[0], 1.3);
  assert.equal(cerca.aviso, undefined);
  vaciarMemoriaInstantaneas();
  // 0,19° al norte ≈ 21 km: fuera.
  const [lejos] = await pedirCopernicusMar([{ lat: 43.14, lon: -8.6 }], sp, { hourly: ["wave_height"], fetchImpl: fetchCajas(), ahora: AHORA });
  assert.ok(lejos.hourly.wave_height.every((v) => v === null));
  assert.match(lejos.aviso, new RegExp(`${MAX_KM_CELDA} km`));
  assert.equal(claveCaja(42.62, -8.48), "85_-17");
});

test("costa: descargar-ibi.py usa la misma clave de caja y ya no tiene el submuestreo por spots", () => {
  const py = readFileSync("scripts/fuentes/descargar-ibi.py", "utf8");
  assert.match(py, /return f"\{math\.floor\(lat \* 2\)\}_\{math\.floor\(lon \* 2\)\}"/);
  assert.match(py, /def celdas_costeras\(/);
  assert.match(py, /RADIO_COSTA_KM = 20/);
  assert.match(py, /30 \* 1024 \* 1024/); // falla en rojo si una caja pasa del límite del bucket
});

// --- Capas de clorofila y temperatura ---------------------------------------

const MINI = JSON.parse(readFileSync("test/fixtures/capas-mar-mini.json", "utf8"));

test("capas: lo que cuantiza Python lo lee igual el navegador", () => {
  for (const nombre of ["clorofila", "temperatura-agua"]) {
    const d = MINI[nombre];
    const bytes = bytesDeBase64(d.datos, (b) => Buffer.from(b, "base64").toString("latin1"));
    assert.equal(bytes.length, d.filas * d.columnas);
    d.esperado.forEach((esp, i) => {
      const v = valorByte(bytes[i], d.escala);
      if (esp === null) return assert.equal(v, null, `${nombre}[${i}]`);
      const tol = d.escala.tipo === "log10" ? Math.max(esp, 0.01) * 0.04 : d.escala.paso / 2 + 1e-9;
      // Lo que se sale de la escala se recorta (no se inventa un valor mayor).
      const recortado = d.escala.tipo === "log10" ? Math.min(Math.max(esp, 0.01), 100) : Math.min(Math.max(esp, d.escala.min), d.escala.min + 254 * d.escala.paso);
      assert.ok(Math.abs(v - recortado) <= tol, `${nombre}[${i}]: ${v} frente a ${esp}`);
    });
    assert.equal(d.atribucion, "Generated using E.U. Copernicus Marine Service Information");
    assert.match(d.doi, /^10\.48670\/moi-\d+$/);
  }
  assert.equal(MINI.clorofila.doi, "10.48670/moi-00288");
});

test("capas: valor en un punto, fila Mercator y píxeles transparentes sin dato", () => {
  const d = MINI.clorofila;
  const bytes = bytesDeBase64(d.datos, (b) => Buffer.from(b, "base64").toString("latin1"));
  assert.ok(Math.abs(valorEnPunto(d, bytes, 43.2, -2.7) - 1.0) < 0.04);
  assert.equal(valorEnPunto(d, bytes, 43.2, -1.2), null); // sin dato
  assert.equal(valorEnPunto(d, bytes, 45, -2), null); // fuera de la rejilla
  // Filas de la imagen -> filas de datos: monótonas y dentro de rango.
  const filas = Array.from({ length: 20 }, (_, r) => filaDeDatos(d, r, 20));
  assert.equal(filas[0], 0);
  assert.equal(filas[19], 1);
  assert.ok(filas.every((f, i) => i === 0 || f >= filas[i - 1]));
  const px = pixelesCapa(d, bytes, ["#000000", "#FFFFFF"], (v) => (Math.log10(v) + 2) / 4);
  assert.equal(px.length, d.filas * d.columnas * 4);
  assert.equal(px[2 * 4 + 3], 0); // la celda sin dato, transparente
  assert.equal(px[0 * 4 + 3], 255);
  assert.deepEqual(colorPaleta(["#000000", "#FFFFFF"], 0.5), [128, 128, 128]);
});

test("capas: index.html las pinta con atribución de Copernicus y explicación", () => {
  const html = fuenteEs(readFileSync("index.html", "utf8"));
  assert.match(html, /id="toggleClorofila"/);
  assert.match(html, /id="toggleTempAgua"/);
  assert.match(html, /Generated using E\.U\. Copernicus Marine Service Information/);
  // Texto corregido (2026-10-09, Mikel): productividad, no peces; el borde importa.
  assert.match(html, /no dónde están los peces/);
  assert.doesNotMatch(html, /Más clorofila = más plancton = más alimento para peces/);
  assert.match(html, /\.clorofila-toggle \{ top: 260px; right: 74px; \}/);
  assert.match(html, /pane: "tilePane"/);
  assert.match(html, /capas\/" \+ nombre|URL_CAPAS_MAR \+ nombre/);
});

// --- Selector de administrador ------------------------------------------------

const TOKEN = "aaa.bbb.ccc";
function pedirProxy(qs, { auth = null } = {}) {
  const headers = auth ? { Authorization: auth } : {};
  return onRequestGet({
    request: new Request(`https://costaviva.org/meteo/forecast?${qs}`, { headers }),
    env: {},
    params: { api: "forecast" },
    waitUntil: () => {},
  });
}
async function conFetch(doble, fn) {
  const original = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const miradas = [];
  globalThis.fetch = doble;
  globalThis.caches = { default: { match: async (k) => { miradas.push(k.url); return undefined; }, put: async () => {} } };
  try {
    return await fn(miradas);
  } finally {
    globalThis.fetch = original;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
}
const QS = "latitude=43.40&longitude=-2.70&hourly=windspeed_10m&timezone=Europe/Madrid&forecast_days=1&fuente=gratuitas";

const ES_SUPABASE_AUTH = (u) => /\/auth\/v1\/user$|\/rest\/v1\/rpc\/es_admin$/.test(u);

test("admin: sin sesión o con token falso -> 403 sin pedir datos ni mirar la caché", async () => {
  for (const auth of [null, "Bearer", "Basic abc", "Bearer x"]) {
    const pedidas = [];
    // Supabase Auth rechaza el token (401).
    await conFetch(async (u) => { pedidas.push(String(u)); return json({ msg: "bad jwt" }, 401); }, async (miradas) => {
      const r = await pedirProxy(QS, { auth });
      assert.equal(r.status, 403, String(auth));
      assert.ok(pedidas.every(ES_SUPABASE_AUTH), pedidas.join());
      assert.ok(!pedidas.some((u) => u.includes("/rpc/es_admin")));
      assert.deepEqual(miradas, []);
    });
  }
});

test("admin: usuario normal (es_admin false) o token no válido (401) -> 403", async () => {
  for (const respuesta of [() => json(false), () => json({ message: "JWT expired" }, 401), () => json(null)]) {
    const pedidas = [];
    await conFetch(async (u, init) => {
      pedidas.push({ u: String(u), init });
      return String(u).endsWith("/auth/v1/user") ? json({ id: "u1" }) : respuesta();
    }, async (miradas) => {
      const r = await pedirProxy(QS, { auth: `Bearer ${TOKEN}` });
      assert.equal(r.status, 403);
      assert.equal(pedidas.length, 2);
      assert.match(pedidas[1].u, /\/rest\/v1\/rpc\/es_admin$/);
      assert.equal(pedidas[1].init.headers.Authorization, `Bearer ${TOKEN}`);
      assert.deepEqual(miradas, []);
    });
  }
});

test("admin: fuente desconocida o repetida -> 400", async () => {
  await conFetch(async () => json(true), async () => {
    assert.equal((await pedirProxy(QS.replace("gratuitas", "ecmwf"), { auth: `Bearer ${TOKEN}` })).status, 400);
    assert.equal((await pedirProxy(`${QS}&fuente=openmeteo`, { auth: `Bearer ${TOKEN}` })).status, 400);
  });
});

test("admin: con es_admin true se honra la fuente y no se cachea en el navegador", async () => {
  const MET = JSON.parse(readFileSync("test/fixtures/metno-locationforecast.json", "utf8"));
  const pedidas = [];
  await conFetch(async (u) => {
    pedidas.push(String(u));
    if (String(u).endsWith("/auth/v1/user")) return json({ id: "admin" });
    if (String(u).includes("/rpc/es_admin")) return json(true);
    if (String(u).includes("api.met.no")) return json(MET);
    if (String(u).includes("open-meteo.com")) return json({ hourly: { time: ["2026-10-08T00:00"], windspeed_10m: [5] } });
    return new Response("?", { status: 404 });
  }, async () => {
    const r = await pedirProxy(QS, { auth: `Bearer ${TOKEN}` });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    const d = await r.json();
    assert.deepEqual(d.fuentes_datos, ["metno"]);
    assert.ok(pedidas.some((u) => u.includes("api.met.no")));
    assert.ok(!pedidas.some((u) => u.includes("open-meteo.com")));
    // Forzar Open-Meteo con los interruptores de producción encendidos.
    pedidas.length = 0;
    const r2 = await pedirProxy(QS.replace("gratuitas", "openmeteo"), { auth: `Bearer ${TOKEN}` });
    assert.deepEqual((await r2.json()).fuentes_datos, ["openmeteo"]);
  });
  const e = envConFuenteForzada({ FUENTE_VIENTO: "openmeteo", FUENTE_MAREA: "openmeteo", OTRA: "x" }, "gratuitas");
  assert.deepEqual(e, { OTRA: "x", FUENTE_ATMOSFERA: "metno", FUENTE_MAR: "copernicus" });
  assert.throws(() => envConFuenteForzada({}, "todo"));
});

test("admin: sin `fuente` el proxy no llama a Supabase (usuarios normales, como siempre)", async () => {
  const pedidas = [];
  await conFetch(async (u) => { pedidas.push(String(u)); return json({ hourly: { time: [], windspeed_10m: [] } }); }, async () => {
    const r = await pedirProxy(QS.replace("&fuente=gratuitas", ""));
    assert.equal(r.status, 200);
    assert.ok(!pedidas.some((u) => u.includes("supabase")));
  });
  // Red caída al comprobar: nunca es admin (fail-closed).
  await conFetch(async () => { throw new Error("red"); }, async () => {
    const r = await requireAdmin(new Request("https://x/", { headers: { Authorization: `Bearer ${TOKEN}` } }));
    assert.equal(r.ok, false);
    assert.equal((await pedirProxy(QS, { auth: `Bearer ${TOKEN}` })).status, 403);
  });
});

test("admin: index.html solo enseña el selector si es_admin() lo dice, y manda el JWT", () => {
  const html = fuenteEs(readFileSync("index.html", "utf8"));
  assert.match(html, /<div class="admin-fuentes" id="adminFuentes" hidden>/);
  assert.match(html, /supabase\.rpc\("es_admin"\)/);
  const meteo = readFileSync("assets/js/meteo.js", "utf8");
  assert.match(meteo, /Authorization: "Bearer "/);
});

// --- Pasado: ERA5 -------------------------------------------------------------

function diaEra5(fecha, lat, lon, base) {
  const horas = 24;
  const serie = (f) => Array.from({ length: horas }, (_, h) => f(h));
  return {
    v: 1, fuente: "era5", fecha, inicio: `${fecha}T00:00:00Z`, horas, generado_en: "2026-10-05T08:00:00Z",
    puntos: [
      { lat: lat + 0.25, lon, ws: serie(() => 99), wd: serie(() => 0), p: serie(() => 999), t: serie(() => 0), c: serie(() => 0), pr: serie(() => 0) },
      { lat, lon, ws: serie((h) => base + h / 10), wd: serie(() => 270), p: serie((h) => 1015 + h / 10), t: serie(() => 18.5), c: serie(() => 40), pr: serie((h) => h / 100) },
    ],
  };
}

test("ERA5: día local de Madrid = dos días UTC, forma de Open-Meteo y lluvia bien desplazada", async () => {
  vaciarMemoriaInstantaneas();
  const celda = celdaEra5(43.41, -2.69);
  assert.deepEqual(celda, { lat: 43.5, lon: -2.75 });
  const caja = claveCajaEra5(celda.lat, celda.lon);
  assert.equal(caja, "43_-3");
  const pedidas = [];
  const fetchImpl = async (u) => {
    pedidas.push(String(u));
    const m = /\/pasado\/(\d{4}-\d{2}-\d{2})\/43_-3\.json$/.exec(String(u));
    if (m && m[1] === "2026-09-29") return json(diaEra5("2026-09-29", 43.5, -2.75, 1));
    if (m && m[1] === "2026-09-30") return json(diaEra5("2026-09-30", 43.5, -2.75, 5));
    return new Response("nf", { status: 404 });
  };
  const consulta = "latitude=43.41&longitude=-2.69&timezone=Europe%2FMadrid&start_date=2026-09-30&end_date=2026-09-30&hourly=windspeed_10m,winddirection_10m,pressure_msl,cloudcover,precipitation,temperature_2m&windspeed_unit=kmh";
  const d = await pedirDatosMeteo("forecast", consulta, { env: { FUENTE_ATMOSFERA: "metno" }, fetchImpl, ahora: AHORA });
  assert.deepEqual(d.fuentes_datos, ["era5"]);
  assert.ok(!pedidas.some((u) => u.includes("api.met.no")));
  assert.deepEqual(pedidas.map((u) => u.replace(/.*\/pasado\//, "")).sort(), ["2026-09-29/43_-3.json", "2026-09-30/43_-3.json"]);
  assert.equal(d.hourly.time.length, 24);
  assert.equal(d.hourly.time[0], "2026-09-30T00:00");
  assert.equal(d.utc_offset_seconds, 7200);
  // 00:00 de Madrid = 22:00 UTC del 29: viento 1 + 2,2 m/s -> km/h.
  assert.equal(d.hourly.windspeed_10m[0], Math.round((1 + 2.2) * 3.6 * 10) / 10);
  assert.equal(d.hourly_units.windspeed_10m, "km/h");
  assert.equal(d.hourly.winddirection_10m[0], 270);
  assert.equal(d.hourly.pressure_msl[2], 1015); // 02:00 Madrid = 00 UTC del 30
  assert.equal(d.hourly.temperature_2m[5], 18.5);
  // precipitation de Open-Meteo = acumulado de la hora que termina: el tp de
  // ERA5 de esa misma hora (22 UTC del 29 -> 0,22 mm).
  assert.equal(d.hourly.precipitation[0], 0.2);
  assert.equal(d.hourly.precipitation[3], 0); // 01 UTC del 30 -> 0,01 -> 0,0
  assert.equal(d.aviso, undefined);
});

test("ERA5: día aún no publicado -> null y aviso; hoy -> sigue en MET Norway", async () => {
  vaciarMemoriaInstantaneas();
  const sp = new URLSearchParams("timezone=GMT&start_date=2026-10-05&end_date=2026-10-05");
  const [o] = await pedirEra5([{ lat: 43.4, lon: -2.7 }], sp, { hourly: ["pressure_msl"], fetchImpl: async () => new Response("nf", { status: 404 }), ahora: AHORA });
  assert.equal(o.hourly.pressure_msl.length, 24);
  assert.ok(o.hourly.pressure_msl.every((v) => v === null));
  assert.match(o.aviso, /6 días/);
  assert.equal(ventanaPasada(new URLSearchParams("timezone=Europe/Madrid&forecast_days=1"), AHORA), false);
  assert.equal(ventanaPasada(new URLSearchParams("timezone=Europe/Madrid&past_days=1&forecast_days=1"), AHORA), false);
  assert.equal(ventanaPasada(new URLSearchParams("timezone=Europe/Madrid&start_date=2026-10-07&end_date=2026-10-07"), AHORA), true);
  // Ventana larguísima: error claro, no 60 subrequests.
  await assert.rejects(
    pedirEra5([{ lat: 43.4, lon: -2.7 }], new URLSearchParams("timezone=GMT&start_date=2026-08-01&end_date=2026-08-31"), { hourly: ["pressure_msl"], fetchImpl: async () => json({}), ahora: AHORA }),
    new RegExp(`máximo ${MAX_FICHEROS_ERA5}`)
  );
  assert.equal(serieDesdeEra5([{ dia: "x", fichero: null }], { lat: 1, lon: 1 }), null);
});

test("ERA5: atribución CC BY 4.0 con DOI en servidor y navegador", () => {
  assert.match(ATRIBUCIONES_HTML.era5, /10\.24381\/cds\.adbb2d47/);
  assert.match(ATRIBUCIONES_HTML.era5, /Copernicus/);
  assert.match(ATRIBUCIONES_HTML.era5, /CC BY 4\.0/);
});
