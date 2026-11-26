// Hoja de previsión del spot (assets/js/hoja-prevision.js), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { I18n } from "../assets/js/i18n-modulo.js";
import {
  serieDesdeAhora, hitosMarea, notasPorHora, resumenTendencia, textoResumen, htmlTabla, HORAS_HOJA,
  medidoAhora, distanciaKm, ajustarMareaATabla,
} from "../assets/js/hoja-prevision.js";

function horas(n = 48, f = () => ({})) {
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(Date.UTC(2026, 10, 19, 0) + k * 3600e3);
    return { hora: d.toISOString().slice(0, 16), ...f(k) };
  });
}

test("la serie empieza en la hora actual y dura 24 h", () => {
  const s = serieDesdeAhora(horas(), "2026-11-19T13:20");
  assert.equal(s[0].hora, "2026-11-19T13:00");
  assert.equal(s.length, HORAS_HOJA + 1);
  assert.deepEqual(serieDesdeAhora(horas(5), "2026-11-25T00:00"), []);
});

test("pleamar y bajamar como máximo y mínimo locales", () => {
  const s = horas(26, (k) => ({ nivelMar: 2 * Math.sin((2 * Math.PI * k) / 12.4) }));
  const h = hitosMarea(s);
  assert.equal(h.indexOf("pleamar"), 3);
  assert.equal(h.indexOf("bajamar"), 9);
  assert.equal(h[0], null);
});

test("nota de cada hora: la del pez elegido o la mejor especie; de noche en submarina, 0", () => {
  const s = horas(3);
  const r = {
    lubina: s.map((h, i) => ({ hora: h.hora, puntuacion: [60, 70, 50][i] })),
    sargo: s.map((h, i) => ({ hora: h.hora, puntuacion: [65, 40, 55][i], prohibida: i === 2 })),
  };
  assert.deepEqual(notasPorHora(s, r).map((n) => `${n.especie}:${n.nota}`), ["sargo:65", "lubina:70", "lubina:50"]);
  assert.deepEqual(notasPorHora(s, r, "sargo").map((n) => n.nota), [65, 40, 0]);
  assert.equal(notasPorHora(s, r, "sargo")[2].prohibida, true);
});

test("resumen: la ola baja, el viento sube, la resaca afloja y el mejor momento", () => {
  const s = horas(25, (k) => ({
    ola: 1.8 - k * 0.03, viento: k < 8 ? 15 : 28, vientoDir: 315,
    fondoAltura: 3 - k * 0.1, fondoPeriodo: 14, fondoCoef: 0.6,
  }));
  const notas = s.map((h, i) => ({ nota: i === 20 ? 80 : 50, especie: "lubina", prohibida: false }));
  const r = resumenTendencia(s, notas);
  const claves = r.map((x) => x.clave);
  assert.deepEqual(claves, ["hoja.res.ola_baja", "hoja.res.viento_sube", "hoja.res.resaca_hasta", "hoja.res.mejor_hoy"]);
  assert.equal(r[0].tono, "mejora");
  assert.equal(r[1].tono, "empeora");
  assert.equal(r[3].vars.desde, "20");
  const txt = r.map((x) => textoResumen(x, () => "lubina"));
  for (const x of txt) assert.ok(!/\{[a-z]+\}/.test(x), x);
  assert.match(txt[0], /baja de 1,8 m a 1,1 m/);
});

test("resumen sin cambios: se mantiene", () => {
  const s = horas(25, () => ({ ola: 1, viento: 10, vientoDir: 0, fondoAltura: 0.3, fondoPeriodo: 8, fondoCoef: 0.5 }));
  assert.deepEqual(resumenTendencia(s).map((x) => x.clave), ["hoja.res.ola_igual", "hoja.res.viento_igual", "hoja.res.resaca_poca"]);
  assert.deepEqual(resumenTendencia([]), []);
});

test("tabla: horas en columnas, esenciales visibles, el resto oculto hasta 'Ver todos'", () => {
  const s = horas(25, (k) => ({ ola: 1, viento: 10, vientoDir: 270, nivelMar: Math.sin(k / 2), fondoAltura: 1, fondoPeriodo: 12, fondoCoef: 0.5, olaMarAbierto: 2, periodo: 11, dirOla: 300, presion: 1012, lluvia: 0, tempAgua: 15, luz: k > 6 ? "noche" : "dia" }));
  const notas = s.map(() => ({ nota: 70, especie: "lubina" }));
  const html = htmlTabla(s, notas, { nombreEspecie: () => "Lubina" });
  assert.equal((html.match(/<th scope="col"/g) || []).length, 26);
  assert.match(html, /Ahora/);
  assert.match(html, /Nota del spot/);
  assert.equal((html.match(/class="hp-extra ?" hidden/g) || []).length, 6);
  assert.ok(!/hidden/.test(htmlTabla(s, notas, { todos: true })));
  assert.match(html, /hp-noche/);
  assert.ok(!/undefined|NaN/.test(html));
});

test("los textos de la hoja existen en es, en y pt sin «algo»", () => {
  const es = readFileSync(new URL("../assets/i18n/es.js", import.meta.url), "utf8");
  for (const k of ["hoja.res.ola_baja", "hoja.resaca.moderada", "hoja.f.nota", "hoja.boton"]) {
    for (const l of ["es", "en", "pt"]) assert.notEqual(I18n.t(k, {}, l), k, `${l} ${k}`);
  }
  assert.ok(!/"hoja\.[^"]+": "[^"]*\balgo\b/i.test(es));
});

test("sin Premium la fila de la nota va con candado y no enseña notas", () => {
  const s = horas(25, () => ({ ola: 1, viento: 10, nivelMar: 0 }));
  const notas = s.map(() => ({ nota: 77, especie: "lubina" }));
  const html = htmlTabla(s, notas, { bloqueada: true });
  assert.match(html, /hp-candado" href="\/suscripcion"/);
  assert.ok(!/>77</.test(html));
});

// «Medido, ahora» (fase 2): solo datos reales, recientes y cercanos.
const AHORA = Date.UTC(2026, 10, 19, 18, 0);
const haceMin = (m) => new Date(AHORA - m * 60e3).toISOString();
const SOPELANA = { lat: 43.385, lon: -2.99 };

test("medido: cámara propia reciente, boya y estación cercanas", () => {
  const m = medidoAhora({
    ...SOPELANA, ahoraMs: AHORA,
    camara: { propia: true, nombre: "Sopela", fecha: haceMin(40), estimacion: 0.9 },
    boyas: [
      { nombre: "AP Bilbao", lat: 43.40, lon: -3.13, alturaSignificativa: 2.1, periodoPico: 12.4, dirOla: "NW", tempAgua: 15.8, actualizado: haceMin(60) },
      { nombre: "Gijón", lat: 43.62, lon: -5.66, alturaSignificativa: 3, actualizado: haceMin(60) },
    ],
    estaciones: [{ nombre: "Bilbao Aeropuerto", lat: 43.298, lon: -2.906, vv: 5, dv: 290, pres: 1014, prec: 0, actualizado: haceMin(30) }],
  });
  assert.equal(m.ola.valor, 0.9);
  assert.equal(m.boya.nombre, "AP Bilbao");
  assert.equal(m.boya.hs, 2.1);
  assert.equal(m.estacion.viento, 18);
  assert.equal(m.estacion.presion, 1014);
});

test("medido: nada viejo, lejano, de cámara vecina ni inventado", () => {
  const m = medidoAhora({
    ...SOPELANA, ahoraMs: AHORA,
    camara: { propia: false, nombre: "Vecina", fecha: haceMin(10), estimacion: 1 },
    boyas: [{ nombre: "Vieja", lat: 43.40, lon: -3.13, alturaSignificativa: 2, actualizado: haceMin(4 * 60) },
            { nombre: "Lejos", lat: 43.62, lon: -5.66, alturaSignificativa: 3, actualizado: haceMin(10) }],
    estaciones: [{ nombre: "Sin datos", lat: 43.3, lon: -2.9, actualizado: haceMin(10) }],
  });
  assert.equal(m, null);
  assert.ok(Math.abs(distanciaKm(43.385, -2.99, 43.40, -3.13) - 11.4) < 1);
});

test("tabla con medido: columna antes de la de ahora, con su fuente; sin medida, «—»", () => {
  const s = horas(25, (k) => ({ ola: 1, viento: 10, vientoDir: 270, nivelMar: Math.sin(k / 2), olaMarAbierto: 2, periodo: 11, dirOla: 300, presion: 1012, lluvia: 0, tempAgua: 15 }));
  const medido = { boya: { nombre: "AP Bilbao", hora: "17:00", hs: 2.1, periodo: 12.4, dir: "NW", agua: 15.8 } };
  const html = htmlTabla(s, [], { todos: true, medido });
  assert.equal((html.match(/<th scope="col"/g) || []).length, 27);
  assert.ok(html.indexOf("Medido") < html.indexOf("Ahora"));
  assert.match(html, /⚓ AP Bilbao · 17:00/);
  assert.equal((html.match(/<td class="hp-medido">—<\/td>/g) || []).length, 8);
  assert.ok(!/undefined|NaN/.test(html));
  assert.ok(!/hp-medido/.test(htmlTabla(s, [])));
});

test("marea con las alturas de la tabla del puerto, no las del nivel medio (Mikel, 2026-11-19)", () => {
  // Curva del modelo de −1,1 a +0,8 m; pleamar a las 06:00 y bajamar a las 12:00.
  const s = horas(25, (k) => ({ nivelMar: +(-0.15 + 0.95 * Math.cos(((k - 6) / 12.4) * 2 * Math.PI)).toFixed(2) }));
  const marea = { altura: 1.3, proximas: [{ tipo: "pleamar", hora: "06:00", altura: 2.2, manana: false }, { tipo: "bajamar", hora: "12:15", altura: 0.3, manana: false }] };
  const r = ajustarMareaATabla(s, marea);
  assert.ok(r.ajustada);
  const max = Math.max(...r.serie.map((h) => h.nivelMar)), min = Math.min(...r.serie.map((h) => h.nivelMar));
  assert.ok(Math.abs(max - 2.2) < 0.15, `pleamar ${max}`);
  assert.ok(Math.abs(min - 0.3) < 0.15, `bajamar ${min}`);
  assert.ok(r.serie.every((h) => h.nivelMar > 0));
  // Sin tabla, sin tocar.
  assert.equal(ajustarMareaATabla(s, null).ajustada, false);
  assert.equal(ajustarMareaATabla(s, null).serie, s);
});

test("7 días (Premium): 24 h seguidas y luego cada 3 h; sin pleamar en columnas de 3 h; días con nombre", async () => {
  const HP = await import("../assets/js/hoja-prevision.js");
  const horas = [];
  const t0 = Date.parse("2026-11-26T00:00:00Z");
  for (let k = 0; k < 9 * 24; k++) {
    const iso = new Date(t0 + k * 3600e3).toISOString().slice(0, 16);
    horas.push({ hora: iso, ola: 1, viento: 10, nivelMar: Math.sin(k / 2), luz: "dia" });
  }
  const s = HP.serieSemana(horas, "2026-11-26T10:20");
  assert.equal(s[0].hora, "2026-11-26T10:00");
  assert.equal(s[24].hora, "2026-11-27T10:00");
  // Después de las 24 primeras, solo horas múltiplo de 3.
  assert.ok(s.slice(25).every((h) => Number(h.hora.slice(11, 13)) % 3 === 0));
  assert.equal(s.at(-1).hora, "2026-12-03T09:00");
  const hitos = HP.hitosMarea(s);
  assert.ok(hitos.slice(26).every((x) => x === null));
  const html = HP.htmlTabla(s, [], {});
  assert.match(html, /hp-nuevo-dia/);
  // La vista de 24 h sigue igual.
  assert.equal(HP.serieDesdeAhora(horas, "2026-11-26T10:20").length, 25);
});
