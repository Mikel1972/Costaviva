// Test del acceso a Open-Meteo (functions/_lib/open-meteo.js y el proxy
// functions/meteo/[api].js), 2026-10-08.
//
// Lo que se fija aquí:
//   - Sin OPEN_METEO_API_KEY se usa el host gratuito; con ella, el host
//     "customer-" y &apikey= (plan comercial).
//   - La key nunca aparece en un error ni en la respuesta del proxy.
//   - El proxy no es abierto: APIs, parámetros, variables y valores fuera de
//     la lista blanca -> 400 sin llamar a Open-Meteo.
//   - Coordenadas redondeadas a 0,01° y consulta canónica: usuarios cercanos
//     comparten la misma clave de caché.
//   - Ninguna página ni JS del navegador llama a Open-Meteo directamente.
// Sin red: fetch se sustituye por un doble. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  urlOpenMeteo,
  urlSinClave,
  claveOpenMeteo,
  pedirOpenMeteo,
  validarConsultaProxy,
  claveCacheProxy,
  redondearCoordenada,
} from "../functions/_lib/open-meteo.js";
import { onRequestGet } from "../functions/meteo/[api].js";

const CLAVE = "clave-secreta-123";

test("sin key: host gratuito, sin apikey", () => {
  assert.equal(
    urlOpenMeteo("forecast", "latitude=43.4&longitude=-2.7&current=pressure_msl"),
    "https://api.open-meteo.com/v1/forecast?latitude=43.4&longitude=-2.7&current=pressure_msl"
  );
  assert.equal(
    urlOpenMeteo("marine", "latitude=1,2&longitude=3,4&hourly=wave_height"),
    "https://marine-api.open-meteo.com/v1/marine?latitude=1,2&longitude=3,4&hourly=wave_height"
  );
});

test("con key: host customer- y &apikey=", () => {
  assert.equal(
    urlOpenMeteo("forecast", "latitude=43.4&longitude=-2.7", CLAVE),
    `https://customer-api.open-meteo.com/v1/forecast?latitude=43.4&longitude=-2.7&apikey=${CLAVE}`
  );
  assert.match(urlOpenMeteo("marine", "latitude=1&longitude=2", CLAVE), /^https:\/\/customer-marine-api\.open-meteo\.com\/v1\/marine\?/);
  assert.match(urlOpenMeteo("archive", "latitude=1&longitude=2", CLAVE), /^https:\/\/customer-archive-api\.open-meteo\.com\/v1\/archive\?/);
});

test("una apikey que venga en la consulta se descarta: solo vale la del secret", () => {
  const u = urlOpenMeteo("forecast", "latitude=1&apikey=ajena&longitude=2");
  assert.ok(!u.includes("ajena"));
  const u2 = urlOpenMeteo("forecast", "latitude=1&APIKEY=ajena&longitude=2", CLAVE);
  assert.ok(!u2.includes("ajena"));
  assert.ok(u2.endsWith(`&apikey=${CLAVE}`));
});

test("API desconocida -> error", () => {
  assert.throws(() => urlOpenMeteo("ensemble", "latitude=1&longitude=2"));
  assert.throws(() => urlOpenMeteo("__proto__", "latitude=1&longitude=2"));
});

test("claveOpenMeteo: vacía o ausente = modo gratuito", () => {
  assert.equal(claveOpenMeteo(undefined), "");
  assert.equal(claveOpenMeteo({}), "");
  assert.equal(claveOpenMeteo({ OPEN_METEO_API_KEY: "   " }), "");
  assert.equal(claveOpenMeteo({ OPEN_METEO_API_KEY: ` ${CLAVE}\n` }), CLAVE);
});

test("urlSinClave tapa la key", () => {
  const u = urlOpenMeteo("forecast", "latitude=1&longitude=2", CLAVE);
  assert.ok(!urlSinClave(u).includes(CLAVE));
  assert.ok(urlSinClave(u).includes("apikey=***"));
});

test("pedirOpenMeteo: el error HTTP no lleva la key", async () => {
  let pedida = null;
  const fetchFalso = async (url) => {
    pedida = url;
    return new Response("{}", { status: 429 });
  };
  await assert.rejects(
    pedirOpenMeteo("forecast", "latitude=1&longitude=2", { apiKey: CLAVE, fetchImpl: fetchFalso }),
    (e) => {
      assert.equal(e.status, 429);
      assert.ok(!e.message.includes(CLAVE), e.message);
      return true;
    }
  );
  assert.ok(pedida.includes(`apikey=${CLAVE}`), "a Open-Meteo sí le llega la key");
});

test("redondeo de coordenadas a 0,01°", () => {
  assert.equal(redondearCoordenada("43.41234"), "43.41");
  assert.equal(redondearCoordenada("43.416"), "43.42");
  assert.equal(redondearCoordenada("-2.6849"), "-2.68");
  assert.equal(redondearCoordenada("-2.6851"), "-2.69");
  assert.equal(redondearCoordenada("43"), "43.00");
});

test("proxy: consulta canónica, misma clave para puntos cercanos y otro orden", () => {
  const a = validarConsultaProxy(
    "marine",
    new URLSearchParams("latitude=43.41234&longitude=-2.6849&timezone=Europe%2FMadrid&forecast_days=2&hourly=wave_height,sea_surface_temperature")
  );
  const b = validarConsultaProxy(
    "marine",
    new URLSearchParams("hourly=sea_surface_temperature,wave_height&forecast_days=2&timezone=Europe/Madrid&longitude=-2.6801&latitude=43.4149")
  );
  assert.ok(a.ok && b.ok, JSON.stringify([a, b]));
  assert.equal(a.consulta, b.consulta);
  assert.equal(claveCacheProxy("https://costaviva.org", "marine", a.consulta), claveCacheProxy("https://costaviva.org", "marine", b.consulta));
  assert.match(a.consulta, /latitude=43\.41&longitude=-2\.68/);
  assert.equal(a.ttlSeg, 3600);
  // La caché distingue la API: misma consulta en forecast es otra clave.
  assert.notEqual(claveCacheProxy("https://x", "marine", a.consulta), claveCacheProxy("https://x", "forecast", a.consulta));
});

test("proxy: TTL 30 min forecast, 24 h si todo es pasado", () => {
  const f = validarConsultaProxy("forecast", new URLSearchParams("latitude=1&longitude=2&hourly=pressure_msl&windspeed_unit=kmh"));
  assert.ok(f.ok);
  assert.equal(f.ttlSeg, 1800);
  assert.match(f.consulta, /wind_speed_unit=kmh/);
  const p = validarConsultaProxy(
    "marine",
    new URLSearchParams("latitude=1&longitude=2&hourly=sea_level_height_msl&start_date=2026-09-01&end_date=2026-09-02"),
    { hoy: "2026-10-08" }
  );
  assert.ok(p.ok);
  assert.equal(p.ttlSeg, 86400);
  const hoy = validarConsultaProxy(
    "marine",
    new URLSearchParams("latitude=1&longitude=2&hourly=sea_level_height_msl&start_date=2026-10-07&end_date=2026-10-08"),
    { hoy: "2026-10-08" }
  );
  assert.equal(hoy.ttlSeg, 3600, "si incluye ayer/hoy, caché normal");
});

test("proxy: acepta exactamente lo que piden index.html y diario.html", () => {
  const casos = [
    ["marine", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&forecast_days=2&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity,ocean_current_direction"],
    ["forecast", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&forecast_days=1&hourly=windspeed_10m,winddirection_10m,pressure_msl,cloudcover,precipitation&windspeed_unit=kmh"],
    ["marine", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&start_date=2026-09-22&end_date=2026-10-08&hourly=wave_height,sea_level_height_msl,sea_surface_temperature"],
    ["forecast", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&start_date=2026-09-30&end_date=2026-09-30&hourly=windspeed_10m,winddirection_10m,pressure_msl,cloudcover,precipitation&windspeed_unit=kmh"],
    ["marine", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&forecast_days=1&hourly=sea_level_height_msl"],
    // Ventana de actividad (rama claude/fichas-especies-ventana).
    ["marine", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&past_days=1&forecast_days=2&hourly=wave_height,sea_surface_temperature,sea_level_height_msl"],
    ["forecast", "latitude=43.41&longitude=-2.68&timezone=Europe%2FMadrid&past_days=1&forecast_days=2&hourly=windspeed_10m,pressure_msl&windspeed_unit=kmh"],
  ];
  for (const [api, q] of casos) {
    const r = validarConsultaProxy(api, new URLSearchParams(q));
    assert.ok(r.ok, `${api}?${q} -> ${r.error}`);
  }
});

test("proxy: rechaza todo lo que no está en la lista blanca", () => {
  const base = "latitude=43.4&longitude=-2.7&hourly=wave_height";
  const malos = [
    ["archive", base],
    ["air-quality", base],
    ["../forecast", base],
    ["__proto__", base],
    ["constructor", base],
    ["marine", `${base}&apikey=x`],
    ["marine", `${base}&models=foo`],
    ["marine", `${base}&format=csv`],
    ["marine", `${base}&cell_selection=sea`],
    ["marine", "latitude=43.4,43.5&longitude=-2.7,-2.8&hourly=wave_height"], // varias coordenadas
    ["marine", "latitude=43.4&latitude=1&longitude=-2.7&hourly=wave_height"], // repetido
    ["marine", "latitude=abc&longitude=-2.7&hourly=wave_height"],
    ["marine", "latitude=95&longitude=-2.7&hourly=wave_height"],
    ["marine", "longitude=-2.7&hourly=wave_height"],
    ["marine", "latitude=43.4&longitude=-2.7"], // sin hourly/current
    ["marine", "latitude=43.4&longitude=-2.7&hourly=temperature_2m"], // variable de otra API
    ["forecast", "latitude=43.4&longitude=-2.7&hourly=windspeed_10m,soil_moisture_0_1cm"],
    ["forecast", "latitude=43.4&longitude=-2.7&hourly="],
    ["marine", `${base}&timezone=America/New_York`],
    ["marine", `${base}&forecast_days=17`],
    ["marine", `${base}&forecast_days=0`],
    ["marine", `${base}&past_days=60`],
    ["marine", `${base}&start_date=2026-01-01&end_date=2026-12-31`], // ventana enorme
    ["marine", `${base}&start_date=2026-10-08`], // falta end_date
    ["marine", `${base}&start_date=2026-10-09&end_date=2026-10-08`], // al revés
    ["marine", `${base}&start_date=2026-10-08&end_date=2026-10-09&forecast_days=2`],
    ["marine", `${base}&windspeed_unit=kmh`], // unidad de viento solo en forecast
    ["forecast", "latitude=43.4&longitude=-2.7&hourly=pressure_msl&windspeed_unit=mph"],
  ];
  for (const [api, q] of malos) {
    const r = validarConsultaProxy(api, new URLSearchParams(q));
    assert.equal(r.ok, false, `${api}?${q} debería rechazarse`);
  }
});

function contexto(url, env = {}) {
  const pendientes = [];
  const api = new URL(url).pathname.split("/").pop();
  return {
    request: new Request(url),
    env,
    params: { api },
    waitUntil: (p) => pendientes.push(p),
  };
}

test("endpoint /meteo: 400 sin llamar a Open-Meteo si la consulta no vale", async () => {
  const original = globalThis.fetch;
  let llamadas = 0;
  globalThis.fetch = async () => {
    llamadas++;
    return new Response("{}");
  };
  try {
    const r = await onRequestGet(contexto("https://costaviva.org/meteo/archive?latitude=1&longitude=2&hourly=x"));
    assert.equal(r.status, 400);
    const r2 = await onRequestGet(contexto("https://costaviva.org/meteo/marine?latitude=1&longitude=2&hourly=wave_height&format=csv"));
    assert.equal(r2.status, 400);
    assert.equal(llamadas, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("endpoint /meteo: con key usa el host comercial y la key no llega al navegador", async () => {
  const original = globalThis.fetch;
  const pedidas = [];
  globalThis.fetch = async (url) => {
    pedidas.push(String(url));
    return new Response(JSON.stringify({ hourly: { time: ["2026-10-08T10:00"], wave_height: [1.2] } }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const r = await onRequestGet(
      contexto("https://costaviva.org/meteo/marine?latitude=43.4123&longitude=-2.6849&hourly=wave_height&forecast_days=2", {
        OPEN_METEO_API_KEY: CLAVE,
      })
    );
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /max-age=3600/);
    const cuerpo = await r.text();
    assert.ok(!cuerpo.includes(CLAVE));
    assert.equal(pedidas.length, 1);
    assert.match(pedidas[0], /^https:\/\/customer-marine-api\.open-meteo\.com\/v1\/marine\?latitude=43\.41&longitude=-2\.68&/);
    assert.ok(pedidas[0].endsWith(`&apikey=${CLAVE}`));
  } finally {
    globalThis.fetch = original;
  }
});

test("endpoint /meteo: error de Open-Meteo -> 502/503 sin key ni URL", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limit", { status: 429 });
  try {
    const r = await onRequestGet(
      contexto("https://costaviva.org/meteo/forecast?latitude=1&longitude=2&current=pressure_msl", { OPEN_METEO_API_KEY: CLAVE })
    );
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("cache-control"), "no-store");
    const cuerpo = await r.text();
    assert.ok(!cuerpo.includes(CLAVE));
    assert.ok(!cuerpo.includes("open-meteo.com/v1"));
  } finally {
    globalThis.fetch = original;
  }
});

test("ninguna página ni JS del navegador llama a Open-Meteo directamente", () => {
  // Si este test falla: usa pedirMeteo() de assets/js/meteo.js (proxy /meteo/).
  const ficheros = [
    ...readdirSync(".").filter((f) => f.endsWith(".html")),
    ...readdirSync("assets/js").filter((f) => f.endsWith(".js")).map((f) => `assets/js/${f}`),
  ];
  const directo = /https:\/\/[a-z-]*api\.open-meteo\.com/;
  for (const f of ficheros) {
    assert.ok(!directo.test(readFileSync(f, "utf8")), `${f} llama a Open-Meteo sin pasar por /meteo/`);
  }
});
