// Zona horaria por región (2026-10-09, fase 0 de Nueva Zelanda).
//
// 1. No regresión: en España y Portugal todo da EXACTAMENTE lo mismo que con
//    "Europe/Madrid" fijo (índices, sol, luna, mareas, /prevision, eje, SEO).
// 2. Canarias va en su hora (Atlantic/Canary): antes salía en la de Madrid.
// 3. Pacific/Auckland: cambio de hora NZDT/NZST y fechas que cruzan el día
//    respecto a UTC.
// 4. Ningún "Europe/Madrid" nuevo en el código sin decir por qué.
// Lógica pura, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

import * as R from "../assets/js/regiones.js";
import * as VA from "../assets/js/ventana-actividad.js";
import { lunaDeFecha } from "../assets/js/condiciones-salida.js";
import { SPOTS, procesarSpot, pedirPorZona } from "../functions/prevision.js";
import { ejeHorario, ventanaDeConsulta } from "../functions/_lib/eje-horario.js";
import { validarConsultaProxy } from "../functions/_lib/open-meteo.js";
import { isoLocalSpot } from "../functions/_lib/oleaje-camaras.js";
import { consultasMeteo } from "../functions/_lib/seo/indice-hoy.js";
import { foto } from "./fixtures/escenarios-zona.mjs";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";

const RAIZ = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const AUCKLAND = { lat: -36.85, lon: 174.76 };
const LAS_PALMAS = SPOTS.find((s) => s.slug === "laspalmas");

// ---------------------------------------------------------------------------
// 1. No regresión en España y Portugal
// ---------------------------------------------------------------------------
// El fixture salió de main con Madrid fijo; desde el 2026-10-09 (Portugal en
// su hora) solo cambian en él los dos casos de Peniche: sus pleamares y
// bajamares, una hora antes en hora de Lisboa (y "mañana" a las 23:40 de
// Lisboa, que en Madrid ya eran las 00:40 del día siguiente).
test("España: mismo sol, luna, eje, mareas y horas de /prevision que con Madrid fijo", async () => {
  const antes = JSON.parse(readFileSync(new URL("./fixtures/zona-horaria-espana.json", import.meta.url), "utf8"));
  const ahora = await foto(RAIZ, { soloHora: true });
  assert.deepEqual(ahora, antes);
});

const ZONA_ESPERADA = { peniche: "Europe/Lisbon", azores: "Atlantic/Azores", madeira: "Atlantic/Madeira" };
test("índice hora a hora: España igual que con Madrid fijo; Portugal en su zona", async () => {
  const deducida = await foto(RAIZ);
  const madrid = await foto(RAIZ, { zona: "Europe/Madrid" });
  const esperada = await foto(RAIZ, { zona: (n) => ZONA_ESPERADA[n] || "Europe/Madrid" });
  assert.deepEqual(deducida.indices, esperada.indices);
  for (const k of Object.keys(madrid.indices)) {
    const nom = k.split("|")[0];
    if (!ZONA_ESPERADA[nom]) assert.equal(deducida.indices[k], madrid.indices[k], k);
  }
  assert.equal(deducida.ventanaLubina, madrid.ventanaLubina);
  // Y con otra zona sí cambia (el test no es trivial).
  const canarias = await foto(RAIZ, { zona: "Atlantic/Canary" });
  assert.notDeepEqual(canarias.indices, madrid.indices);
});

const SPOTS_PT = ["aveiro", "cascais", "costadacaparica", "ericeira", "faro", "figueiradafoz", "lagos", "matosinhos", "milfontes",
  "moledo", "nazare", "peniche", "povoadevarzim", "sagres", "sines", "troia", "vianadocastelo"];
test("todos los spots fijos: Madrid, salvo Canarias (Atlantic/Canary) y Portugal (Europe/Lisbon)", () => {
  const porZona = {};
  for (const s of SPOTS) (porZona[R.zonaDeSpot(s)] ||= []).push(s.slug);
  assert.deepEqual(Object.keys(porZona).sort(), ["Atlantic/Canary", "Europe/Lisbon", "Europe/Madrid"]);
  assert.deepEqual(porZona["Atlantic/Canary"].sort(), ["corralejo", "elmedano", "laspalmas", "santacruztenerife"]);
  assert.deepEqual(porZona["Europe/Lisbon"].sort(), SPOTS_PT);
  // Los de la raya se quedan en España.
  for (const slug of ["aguarda", "baiona", "puntaumbria"]) {
    const s = SPOTS.find((x) => x.slug === slug);
    if (s) assert.equal(R.zonaDeSpot(s), "Europe/Madrid", slug);
  }
  assert.deepEqual(["portugal", "azores", "madeira"].map((id) => R.REGIONES[id].zona), ["Europe/Lisbon", "Atlantic/Azores", "Atlantic/Madeira"]);
});

// ---------------------------------------------------------------------------
// Portugal en su hora (Lisboa, Azores, Madeira)
// ---------------------------------------------------------------------------
test("Lisboa: una hora menos que Madrid todo el año, también en los cambios de hora", () => {
  // Los dos cambian a la vez (último domingo de marzo y de octubre, a la 01:00 UTC).
  for (const [t, lis, mad] of [
    [Date.UTC(2026, 2, 29, 0, 59), "2026-03-29T00", "2026-03-29T01"], // WET / CET
    [Date.UTC(2026, 2, 29, 1, 0), "2026-03-29T02", "2026-03-29T03"], // WEST / CEST
    [Date.UTC(2026, 9, 25, 0, 59), "2026-10-25T01", "2026-10-25T02"], // WEST / CEST
    [Date.UTC(2026, 9, 25, 1, 0), "2026-10-25T01", "2026-10-25T02"], // WET / CET: la 01 se repite
    [Date.UTC(2026, 9, 9, 22, 40), "2026-10-09T23", "2026-10-10T00"], // aún es el 9 en Lisboa
  ]) {
    assert.equal(R.horaLocalISO("Europe/Lisbon", new Date(t)), lis, new Date(t).toISOString());
    assert.equal(R.horaLocalISO("Europe/Madrid", new Date(t)), mad, new Date(t).toISOString());
  }
  assert.equal(R.desfaseEstandarMinutos("Europe/Lisbon"), 0);
  assert.equal(R.desfaseEstandarMinutos("Atlantic/Madeira"), 0);
  // Madeira lleva la hora de Lisboa.
  for (const t of [Date.UTC(2026, 0, 15, 12), Date.UTC(2026, 6, 15, 12), Date.UTC(2026, 9, 25, 1)]) {
    assert.equal(R.horaLocalISO("Atlantic/Madeira", new Date(t)), R.horaLocalISO("Europe/Lisbon", new Date(t)));
  }
});

test("Azores: UTC-1 en invierno y UTC+0 en verano, cambiando a la misma hora UTC que Lisboa", () => {
  assert.equal(R.zonaPorCoordenadas(37.74, -25.67), "Atlantic/Azores"); // Ponta Delgada
  assert.equal(R.zonaPorCoordenadas(32.64, -16.92), "Atlantic/Madeira"); // Funchal
  assert.equal(R.zonaPorCoordenadas(38.72, -9.14), "Europe/Lisbon"); // Lisboa
  assert.equal(R.horaLocalISO("Atlantic/Azores", new Date(Date.UTC(2026, 2, 29, 0, 59))), "2026-03-28T23");
  assert.equal(R.horaLocalISO("Atlantic/Azores", new Date(Date.UTC(2026, 2, 29, 1, 0))), "2026-03-29T01");
  assert.equal(R.horaLocalISO("Atlantic/Azores", new Date(Date.UTC(2026, 9, 25, 0, 59))), "2026-10-25T00");
  assert.equal(R.horaLocalISO("Atlantic/Azores", new Date(Date.UTC(2026, 9, 25, 1, 0))), "2026-10-25T00"); // la 00 se repite
  assert.equal(R.desfaseMinutos(Date.UTC(2026, 9, 25, 0, 59), "Atlantic/Azores"), 0);
  assert.equal(R.desfaseMinutos(Date.UTC(2026, 9, 25, 1, 0), "Atlantic/Azores"), -60);
  assert.equal(R.desfaseEstandarMinutos("Atlantic/Azores"), -60);
  // Etiqueta local de las 00:00 del 10 en Azores (desfase estándar -1) = 01:00 UTC.
  assert.equal(R.msAproxDeEtiqueta("2026-10-10T00:00", "Atlantic/Azores"), Date.UTC(2026, 9, 10, 1));
  const sol = VA.solDelDia("2026-10-09", 37.74, -25.67);
  const am = R.minutosLocales(sol.amanecer, "Atlantic/Azores");
  assert.ok(am > 7 * 60 + 15 && am < 7 * 60 + 50, `amanecer en Ponta Delgada ${am}`); // ~07:30
});

test("Peniche: /prevision da las mareas en hora de Lisboa (una hora menos que antes)", () => {
  const peniche = SPOTS.find((s) => s.slug === "peniche");
  assert.equal(R.zonaDeSpot(peniche), "Europe/Lisbon");
  assert.match(consultasMeteo(peniche).marine, /timezone=Europe%2FLisbon/);
  // Mismo mar (valores por instante), pedido en las dos zonas.
  const ahora = Date.UTC(2026, 9, 9, 10, 17);
  const serie = (zona) => {
    const eje = ejeHorario({ timezone: zona, start_date: "2026-10-09", end_date: "2026-10-10" }, ahora);
    const k = eje.horas.map((h) => Math.round((h.ms - Date.UTC(2026, 9, 8, 22)) / 3600000));
    const f = (g) => k.map(g);
    return {
      marino: { hourly: { time: eje.horas.map((h) => h.etiqueta), wave_height: f(() => 1), wave_period: f(() => 9), wave_direction: f(() => 300), sea_surface_temperature: f(() => 18), ocean_current_velocity: f(() => 0.1), ocean_current_direction: f(() => 0), sea_level_height_msl: f((i) => 1.5 * Math.sin((2 * Math.PI * i) / 12.42)) } },
      viento: { hourly: { time: eje.horas.map((h) => h.etiqueta), windspeed_10m: f(() => 10), winddirection_10m: f(() => 0), precipitation: f(() => 0), cloudcover: f(() => 0), pressure_msl: f((i) => 1000 + i) } },
    };
  };
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(ahora); }
    static now() { return ahora; }
  };
  let lisboa, madrid;
  try {
    const sl = serie("Europe/Lisbon"), sm = serie("Europe/Madrid");
    lisboa = procesarSpot(peniche, sl.marino, sl.viento, {}, {}, "openmeteo");
    madrid = procesarSpot({ ...peniche, zona: "Europe/Madrid" }, sm.marino, sm.viento, {}, {}, "openmeteo");
  } finally {
    globalThis.Date = RealDate;
  }
  assert.equal(lisboa.zona, "Europe/Lisbon");
  assert.deepEqual(madrid.marea.proximas.map((e) => e.hora), ["16:00", "22:00"]);
  assert.deepEqual(lisboa.marea.proximas.map((e) => e.hora), ["15:00", "21:00"]);
  assert.equal(lisboa.marea.altura, madrid.marea.altura); // mismo instante, misma agua
  assert.equal(lisboa.presion.valor, madrid.presion.valor);
});


test("regionPorCoordenadas sigue igual en la Península e islas", () => {
  const casos = [[43.407, -2.698, "cantabrico"], [42.26, -8.78, "atlantico_norte"], [36.53, -6.3, "golfo_cadiz"],
    [39.47, -0.33, "mediterraneo"], [39.55, 2.63, "baleares"], [28.1, -15.42, "canarias"], [39.36, -9.38, "portugal"],
    [37.74, -25.67, "azores"], [32.64, -16.92, "madeira"], [50, 10, "cantabrico"]];
  for (const [lat, lon, r] of casos) assert.equal(VA.regionPorCoordenadas(lat, lon), r, `${lat},${lon}`);
});

test("horaLocalISO de Madrid = la antigua horaActualMadridISO (verano, invierno, cambio de hora)", () => {
  const vieja = (d) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}`;
  };
  for (let t = Date.UTC(2026, 2, 28, 20); t < Date.UTC(2026, 2, 29, 6); t += 15 * 60000) {
    assert.equal(R.horaLocalISO("Europe/Madrid", new Date(t)), vieja(new Date(t)));
  }
  for (const t of [Date.UTC(2026, 9, 9, 22, 30), Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30), Date.UTC(2026, 0, 1, 23, 59)]) {
    assert.equal(R.horaLocalISO("Europe/Madrid", new Date(t)), vieja(new Date(t)));
  }
});

test("el proxy /meteo/ admite las zonas de las regiones y nada más", () => {
  const q = (tz) => validarConsultaProxy("marine", new URLSearchParams(`latitude=28.1&longitude=-15.42&timezone=${encodeURIComponent(tz)}&forecast_days=1&hourly=wave_height`), { hoy: "2026-10-09" });
  for (const tz of ["Europe/Madrid", "Atlantic/Canary", "Pacific/Auckland", "UTC", "GMT"]) assert.equal(q(tz).ok, true, tz);
  assert.equal(q("America/New_York").ok, false);
  assert.match(q("Atlantic/Canary").consulta, /timezone=Atlantic%2FCanary/);
});

// ---------------------------------------------------------------------------
// 2. Canarias en su hora
// ---------------------------------------------------------------------------
test("Canarias: la serie se pide y se lee en Atlantic/Canary", () => {
  assert.equal(R.zonaDeSpot(LAS_PALMAS), "Atlantic/Canary");
  assert.match(consultasMeteo(LAS_PALMAS).marine, /timezone=Atlantic%2FCanary/);
  assert.match(consultasMeteo(SPOTS.find((s) => s.slug === "mundaka")).marine, /timezone=Europe%2FMadrid/);
  // 9/10 10:17 UTC = 11:17 en Canarias (WEST) y 12:17 en Madrid (CEST).
  const t = new Date(Date.UTC(2026, 9, 9, 10, 17));
  assert.equal(R.horaLocalISO("Atlantic/Canary", t), "2026-10-09T11");
  assert.equal(R.horaLocalISO("Europe/Madrid", t), "2026-10-09T12");
  // Hora de la cámara/lectura en hora del spot.
  assert.equal(isoLocalSpot(t.getTime(), "Atlantic/Canary"), "2026-10-09T11:17");
});

test("Canarias: /prevision coge el bloque y la marea de la hora de Canarias", () => {
  const ahora = Date.UTC(2026, 9, 9, 10, 17);
  const eje = ejeHorario({ timezone: "Atlantic/Canary", start_date: "2026-10-09", end_date: "2026-10-10" }, ahora);
  const time = eje.horas.map((h) => h.etiqueta);
  const f = (g) => time.map((_, i) => g(i));
  const marino = { hourly: { time, wave_height: f((i) => i / 10), wave_period: f(() => 9), wave_direction: f(() => 300), sea_surface_temperature: f(() => 20), ocean_current_velocity: f(() => 0.1), ocean_current_direction: f(() => 0), sea_level_height_msl: f((i) => Math.sin((2 * Math.PI * i) / 12.42)) } };
  const viento = { hourly: { time, windspeed_10m: f((i) => i), winddirection_10m: f(() => 0), precipitation: f(() => 0), cloudcover: f(() => 0), pressure_msl: f((i) => 1000 + i) } };
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(ahora); }
    static now() { return ahora; }
  };
  let p;
  try {
    p = procesarSpot(LAS_PALMAS, marino, viento, {}, {}, "openmeteo");
  } finally {
    globalThis.Date = RealDate;
  }
  assert.equal(p.zona, "Atlantic/Canary");
  // "Ahora" = 11:00 local (índice 11): presión 1011, y el primer bloque de 3 h
  // a partir de ahí es el de las 12:00 locales (con Madrid habría sido 15:00).
  assert.equal(p.presion.valor, 1011);
  assert.equal(p.bloques[0].horaISO, "2026-10-09T12:00");
});

test("pedirPorZona: una consulta por zona y la respuesta en el orden de los spots", async () => {
  const lista = [SPOTS.find((s) => s.slug === "mundaka"), LAS_PALMAS, SPOTS.find((s) => s.slug === "cadiz"), SPOTS.find((s) => s.slug === "corralejo"), SPOTS.find((s) => s.slug === "nazare")];
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    const sp = new URL(url).searchParams;
    const lats = sp.get("latitude").split(",");
    return new Response(JSON.stringify(lats.map((lat) => ({ latitude: +lat, timezone: sp.get("timezone"), hourly: { time: [] } }))), { status: 200, headers: { "content-type": "application/json" } });
  };
  const r = await pedirPorZona(lista, "marine", "forecast_days=2&hourly=wave_height", { env: {}, fetchImpl });
  assert.equal(urls.length, 3);
  assert.deepEqual(r.map((x) => x.timezone), ["Europe/Madrid", "Atlantic/Canary", "Europe/Madrid", "Atlantic/Canary", "Europe/Lisbon"]);
  assert.deepEqual(r.map((x) => x.latitude), lista.map((s) => s.lat));
});

// ---------------------------------------------------------------------------
// 3. Nueva Zelanda (Pacific/Auckland)
// ---------------------------------------------------------------------------
test("Auckland: región, hemisferio sur, NZD, inglés", () => {
  assert.equal(R.regionPorCoordenadas(AUCKLAND.lat, AUCKLAND.lon), "nueva_zelanda");
  // La de ventana-actividad.js es la región de PESCA (fase 2 de NZ): en NZ,
  // el área de MPI de las especies.
  assert.equal(VA.regionPorCoordenadas(AUCKLAND.lat, AUCKLAND.lon), "nz_auckland_kermadec");
  assert.equal(R.hemisferioDeRegion("nz_auckland_kermadec"), "sur");
  assert.equal(R.zonaDeRegion("nz_southland"), "Pacific/Auckland");
  assert.equal(R.zonaPorCoordenadas(AUCKLAND.lat, AUCKLAND.lon), "Pacific/Auckland");
  // Bluff (Southland) y Cabo Reinga también.
  assert.equal(R.zonaPorCoordenadas(-46.6, 168.35), "Pacific/Auckland");
  assert.equal(R.zonaPorCoordenadas(-34.43, 172.68), "Pacific/Auckland");
  const nz = R.REGIONES.nueva_zelanda;
  assert.deepEqual([nz.hemisferio, nz.moneda, nz.idioma, nz.pais], ["sur", "NZD", "en", "NZ"]);
  assert.equal(R.hemisferioDeRegion("cantabrico"), "norte");
});

test("Auckland: cambio de hora NZDT → NZST (primer domingo de abril)", () => {
  // 5/4/2026 03:00 NZDT (+13) pasa a 02:00 NZST (+12): las 02 se repiten.
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 3, 4, 12, 30))), "2026-04-05T01");
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 3, 4, 13, 59))), "2026-04-05T02");
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 3, 4, 14, 0))), "2026-04-05T02");
  assert.equal(R.desfaseMinutos(Date.UTC(2026, 3, 4, 13, 59), "Pacific/Auckland"), 780);
  assert.equal(R.desfaseMinutos(Date.UTC(2026, 3, 4, 14, 0), "Pacific/Auckland"), 720);
});

test("Auckland: cambio de hora NZST → NZDT (último domingo de septiembre)", () => {
  // 27/9/2026 02:00 NZST (+12) pasa a 03:00 NZDT (+13): las 02 no existen.
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 8, 26, 13, 59))), "2026-09-27T01");
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 8, 26, 14, 0))), "2026-09-27T03");
  assert.equal(R.desfaseEstandarMinutos("Pacific/Auckland"), 720);
  assert.equal(R.desfaseEstandarMinutos("Europe/Madrid"), 60);
  assert.equal(R.desfaseEstandarMinutos("Atlantic/Canary"), 0);
});

test("Auckland: la fecha local va un día por delante de UTC", () => {
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 9, 9, 10, 59))), "2026-10-09T23");
  assert.equal(R.horaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 9, 9, 11, 0))), "2026-10-10T00");
  assert.equal(R.fechaLocalISO("Pacific/Auckland", new Date(Date.UTC(2026, 9, 9, 12))), "2026-10-10");
  // El "hoy" de Open-Meteo con past_days=0: empieza a las 00:00 locales del 10.
  const eje = ejeHorario({ timezone: "Pacific/Auckland", past_days: 0, forecast_days: 1 }, Date.UTC(2026, 9, 9, 12));
  assert.equal(eje.horas[0].etiqueta, "2026-10-10T00:00");
  assert.equal(eje.horas[0].ms, Date.UTC(2026, 9, 9, 11));
  assert.equal(eje.horas.length, 24);
  assert.equal(eje.utc_offset_seconds, 13 * 3600);
  assert.equal(eje.timezone, "Pacific/Auckland");
  assert.equal(eje.timezone_abbreviation, "GMT+13");
});

test("Auckland: eje con fechas que cruzan el cambio de hora = un solo desfase, 24 h por día", () => {
  const sp = new URLSearchParams("timezone=Pacific%2FAuckland&start_date=2026-04-04&end_date=2026-04-06");
  const eje = ejeHorario(ventanaDeConsulta(sp), Date.UTC(2026, 9, 9, 12));
  assert.equal(eje.horas.length, 72);
  assert.equal(new Set(eje.horas.map((h) => h.etiqueta)).size, 72);
  assert.equal(eje.horas[0].etiqueta, "2026-04-04T00:00");
  assert.equal(eje.horas[71].etiqueta, "2026-04-06T23:00");
});

test("Auckland: sol, luz y luna en hora local", () => {
  const sol = VA.solDelDia("2026-10-10", AUCKLAND.lat, AUCKLAND.lon);
  const am = R.minutosLocales(sol.amanecer, "Pacific/Auckland");
  const an = R.minutosLocales(sol.anochecer, "Pacific/Auckland");
  // Hacia las 06:40 y las 19:30 (NZDT).
  assert.ok(am > 6 * 60 + 25 && am < 7 * 60, `amanecer ${am}`);
  assert.ok(an > 19 * 60 + 15 && an < 19 * 60 + 45, `anochecer ${an}`);
  assert.equal(VA.estadoLuz(2 * 60 + 30, sol, "Pacific/Auckland"), "noche");
  assert.equal(VA.estadoLuz(13 * 60 + 30, sol, "Pacific/Auckland"), "dia");
  // Con la zona de Madrid ese mismo sol caería a deshoras.
  assert.notEqual(VA.estadoLuz(13 * 60 + 30, sol, "Europe/Madrid"), "dia");
  // 01:00 del 10 en Auckland (desfase estándar +12) = 13:00 UTC del 9.
  assert.equal(R.msAproxDeEtiqueta("2026-10-10T01:00", "Pacific/Auckland"), Date.UTC(2026, 9, 9, 13));
  assert.deepEqual(lunaDeFecha("2026-10-10", "01:00", "Pacific/Auckland"), lunaDeFecha("2026-10-09", "13:00", "UTC"));
});

test("Auckland: la ventana de actividad usa la luz local (submarina solo de día)", () => {
  const horas = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, 9, 10) + i * 3600000);
    horas.push({ hora: `${d.toISOString().slice(0, 13)}:00`, nivelMar: Math.sin(i / 2), ola: 0.4, viento: 8, tempAgua: 17, presion: 1016, lluvia: 0 });
  }
  const lubina = DATOS.especies.find((e) => e.id === "lubina");
  const res = VA.calcularVentana(lubina, DATOS.reglas_por_defecto, horas, {
    ...AUCKLAND, modalidad: "submarina", reglasModalidad: DATOS.reglas_por_modalidad, region: "cantabrico",
  });
  const h = (hh) => res.find((r) => r.hora === `2026-10-10T${hh}:00`);
  assert.equal(h("02").puntuacion, 0); // noche en Auckland: prohibida
  assert.ok(h("12").puntuacion > 0); // mediodía en Auckland
});

test("hemisferio sur: la freza y las vedas 'general' de la Península no se aplican", () => {
  // Hoy ninguna especie trae freza "general" (todas por región), pero el
  // motor la admite como respaldo: en el sur no debe usarse.
  const conFrezaGeneral = { freza: { por_region: { general: { meses: [3, 4] } } } };
  const mes = 3;
  assert.notEqual(VA.estadoFreza(conFrezaGeneral, "cantabrico", mes), null);
  assert.equal(VA.estadoFreza(conFrezaGeneral, "nueva_zelanda", mes), null);
  const veda = { vedas: [{ meses: [1, 2], texto: "veda sin regiones" }] };
  assert.notEqual(VA.vedaActiva(veda, "cantabrico", 1), null);
  assert.equal(VA.vedaActiva(veda, "nueva_zelanda", 1), null);
  // Sin datos de NZ todavía: ninguna especie de temporada (nunca las de España desplazadas).
  for (let m = 1; m <= 12; m++) assert.deepEqual(VA.especiesDeTemporada(DATOS, "nueva_zelanda", m), []);
});

test("los 60 spots NZ (fase 1, ocultos) caen en Pacific/Auckland y en la región nueva_zelanda", () => {
  assert.ok(SPOTS_NZ.length >= 60);
  for (const s of SPOTS_NZ) {
    assert.equal(R.zonaDeSpot(s), "Pacific/Auckland", s.slug);
    assert.equal(R.zonaPorCoordenadas(s.lat, s.lon), "Pacific/Auckland", s.slug);
  }
});

test("agruparPorZona conserva el orden y los índices", () => {
  const g = R.agruparPorZona([{ lat: 43.4, lon: -2.7 }, AUCKLAND, LAS_PALMAS, { lat: 39.4, lon: -0.3 }]);
  assert.deepEqual(g.map((x) => [x.zona, x.indices]), [
    ["Europe/Madrid", [0, 3]], ["Pacific/Auckland", [1]], ["Atlantic/Canary", [2]],
  ]);
  assert.equal(R.paramZona("Pacific/Auckland"), "timezone=Pacific%2FAuckland");
  assert.equal(R.zonaDeSpot(null), "Europe/Madrid");
  assert.equal(R.zonaDeSpot({ zona: "America/New_York", lat: 28.1, lon: -15.42 }), "Atlantic/Canary");
  // Spots NZ de la fase 1: `zona` es geográfica ("Northland") y la horaria va en `tz`.
  assert.equal(R.zonaDeSpot({ zona: "Northland", tz: "Pacific/Auckland", lat: -34.42, lon: 172.68 }), "Pacific/Auckland");
});

// ---------------------------------------------------------------------------
// 4. Ningún Madrid fijo nuevo sin explicar
// ---------------------------------------------------------------------------
test("cada 'Europe/Madrid' que queda en el código dice que es a propósito", () => {
  const raices = ["assets/js", "functions", "scripts", ".github/workflows"];
  const sueltos = readdirSync(RAIZ).filter((f) => f.endsWith(".html"));
  const ficheros = [...sueltos.map((f) => join(RAIZ, f))];
  const recorrer = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "node_modules") recorrer(p); } else if (/\.(js|mjs|html|yml)$/.test(f)) ficheros.push(p);
    }
  };
  for (const r of raices) recorrer(join(RAIZ, r));
  const USO = /["'`]Europe\/Madrid["'`]|Europe%2FMadrid|TZ="?Europe\/Madrid/;
  const fallos = [];
  for (const p of ficheros) {
    const rel = relative(RAIZ, p);
    if (rel === "assets/js/regiones.js") continue;
    const lineas = readFileSync(p, "utf8").split("\n");
    lineas.forEach((l, i) => {
      if (!USO.test(l)) return;
      const contexto = lineas.slice(Math.max(0, i - 4), i + 1).join("\n");
      if (!/a propósito/.test(contexto)) fallos.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(fallos, [], "usa la zona del spot (assets/js/regiones.js) o explica por qué va en Madrid");
});
