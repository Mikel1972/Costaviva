// Datos extra de un momento de pesca (2026-11-16, Mikel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extrasMomento, extremosMarea } from "../assets/js/extras-momento.js";
import { agruparMomentos, tramos, normalizarEspecie } from "../scripts/aprendizaje/momentos.mjs";

const horas = Array.from({ length: 96 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 13, i));
  return d.toISOString().slice(0, 13) + ":00";
});
// Marea semidiurna (12,4 h), presión que baja 0,5 hPa/h, lluvia 1 mm/h el día 15.
const marino = { hourly: { time: horas, sea_level_height_msl: horas.map((_, i) => Math.cos((2 * Math.PI * i) / 12.4)),
  wave_period: horas.map(() => 9), wave_direction: horas.map(() => 315), swell_wave_height: horas.map(() => 1.6), swell_wave_period: horas.map(() => 10),
  sea_surface_temperature: horas.map((_, i) => 17 - i * 0.01) } };
const tiempo = { hourly: { time: horas, pressure_msl: horas.map((_, i) => 1030 - i * 0.5), precipitation: horas.map((h) => (h.startsWith("2026-11-15") ? 1 : 0)),
  temperature_2m: horas.map(() => 12), wind_gusts_10m: horas.map(() => 25), winddirection_10m: horas.map(() => 180) } };

test("cambios de presión, lluvia previa, ola y mar de fondo", () => {
  const e = extrasMomento({ etiqueta: "2026-11-16T01:57", marino, tiempo });
  assert.equal(e.presion_cambio_3h, -1.5);
  assert.equal(e.presion_cambio_24h, -12);
  assert.equal(e.lluvia_24h, 22, "las 22 horas del 15 que caen en las 24 h anteriores");
  assert.equal(e.lluvia_72h, 24);
  assert.equal(e.ola_periodo, 9);
  assert.equal(e.mar_fondo_altura, 1.6);
  assert.equal(e.viento_racha_kmh, 25);
  assert.equal(e.temp_agua_cambio_72h, -0.7);
});

test("punto del ciclo de marea: último extremo, minutos y rango", () => {
  const ext = extremosMarea(marino.hourly.sea_level_height_msl);
  assert.ok(ext.length > 4);
  const e = extrasMomento({ etiqueta: "2026-11-16T01:57", marino, tiempo });
  assert.ok(["pleamar", "bajamar"].includes(e.marea_ultimo_extremo));
  assert.ok(e.marea_min_desde_extremo >= 0 && e.marea_min_desde_extremo < 7 * 60);
  assert.ok(e.marea_min_a_siguiente > 0);
  assert.ok(e.marea_rango > 1.5);
});

test("sin series, nada (ni nulos)", () => {
  assert.deepEqual(extrasMomento({ etiqueta: "2026-11-16T01:57" }), {});
});

test("por especie: solo las pescadas por 3 personas o más", () => {
  assert.equal(normalizarEspecie("Pulpo común"), "pulpo comun");
  const m = (especie) => ({ tipo: "captura", hora: "01:28", especie, marea_tendencia: "subiendo", sol_momento: "noche",
    condiciones: { marea_ultimo_extremo: "bajamar", marea_min_desde_extremo: 130, presion_cambio_3h: -2, oleaje_altura_max: 0.4 } });
  assert.deepEqual(tramos(m("x")), { marea_ciclo: "bajamar+2h", presion_3h: "baja", lluvia_72h: null, ola: "<0.5", agua_72h: null });
  const r = agruparMomentos([
    { usuario: "a", momentos: [m("congrio"), m("sargo")] }, { usuario: "b", momentos: [m("congrio")] }, { usuario: "c", momentos: [m("congrio")] },
  ]);
  assert.deepEqual(r.por_especie.map((e) => e.especie), ["congrio"]);
  assert.equal(r.especies_retenidas, 1);
  assert.ok(r.por_especie[0].grupos.some((g) => g.variable === "marea_ciclo" && g.valor === "bajamar+2h" && g.capturas === 3));
});
