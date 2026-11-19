// Hoja de previsión del spot (assets/js/hoja-prevision.js), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { I18n } from "../assets/js/i18n-modulo.js";
import {
  serieDesdeAhora, hitosMarea, notasPorHora, resumenTendencia, textoResumen, htmlTabla, HORAS_HOJA,
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
