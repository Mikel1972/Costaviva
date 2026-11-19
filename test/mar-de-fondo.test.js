// Mar de fondo y resaca en la orilla (assets/js/mar-de-fondo.js), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { energiaOla, subidaAgua, nivelResaca, marDeFondo, VALOR_RESACA, UMBRALES_RESACA } from "../assets/js/mar-de-fondo.js";
import { calcularVentana } from "../assets/js/ventana-actividad.js";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const lubina = DATOS.especies.find((e) => e.id === "lubina");

test("energía: con la misma altura, el periodo largo lleva más", () => {
  assert.equal(+energiaOla(1, 14).toFixed(2), 6.86);
  assert.ok(energiaOla(1, 14) / energiaOla(1, 8) > 1.7);
  assert.equal(energiaOla(0, 10), null);
  assert.equal(energiaOla(null, 10), null);
});

test("subida del agua (Stockdon 2006): manda el periodo", () => {
  assert.ok(subidaAgua(1.2, 14) / subidaAgua(1.2, 6) > 2);
  assert.equal(+subidaAgua(1.2, 14).toFixed(2), 1.77);
  assert.equal(subidaAgua(0, 10), null);
});

test("niveles de resaca por subida del agua en la orilla", () => {
  assert.equal(nivelResaca(0.5), "suave");
  assert.equal(nivelResaca(UMBRALES_RESACA.moderada), "moderada");
  assert.equal(nivelResaca(1.5), "fuerte");
  assert.equal(nivelResaca(2.5), "muy_fuerte");
  assert.equal(nivelResaca(null), null);
});

test("caso de Mikel: poca ola pero mar de fondo largo tira fuerte en la orilla", () => {
  // 1,2 m de fondo con 14 s, costa expuesta: desde el barco, una ondulación.
  const f = marDeFondo(1.2, 14, 1);
  assert.equal(f.nivel, "fuerte");
  assert.equal(f.periodoLargo, true);
  // La misma altura con periodo corto (mar de viento): mucho menos.
  assert.equal(marDeFondo(1.2, 6, 1).nivel, "suave");
  // Con el coeficiente de orilla de una playa abrigada, baja.
  assert.equal(marDeFondo(1.2, 14, 0.3).nivel, "moderada");
  assert.equal(marDeFondo(null, 14, 1), null);
});

test("la nota del spot resta con mar de fondo fuerte (costa y submarina, no embarcación)", () => {
  const serie = (fondo) => Array.from({ length: 24 }, (_, i) => ({
    hora: `2026-11-20T${String(i).padStart(2, "0")}:00`, nivelMar: Math.sin(i / 2), ola: 1, viento: 10, tempAgua: 14, presion: 1015,
    ...fondo,
  }));
  const ctx = (modalidad) => ({ lat: 43.4, lon: -2.9, modalidad, reglasModalidad: DATOS.reglas_por_modalidad });
  const fuerte = { fondoAltura: 2.5, fondoPeriodo: 14, fondoCoef: 0.6 };
  const calma = { fondoAltura: 0.5, fondoPeriodo: 8, fondoCoef: 0.6 };
  const i = 12;
  const costaF = calcularVentana(lubina, DATOS.reglas_por_defecto, serie(fuerte), ctx("costa"))[i];
  const costaC = calcularVentana(lubina, DATOS.reglas_por_defecto, serie(calma), ctx("costa"))[i];
  const sinDato = calcularVentana(lubina, DATOS.reglas_por_defecto, serie({}), ctx("costa"))[i];
  assert.ok(costaF.puntuacion < costaC.puntuacion, `${costaF.puntuacion} < ${costaC.puntuacion}`);
  assert.equal(costaC.puntuacion, sinDato.puntuacion);
  const todos = (r) => [...(r.razones || []), ...(r.notas || [])].map((x) => x.textoEs || x.texto).join(" | ");
  assert.match(todos(costaF), /tira muy fuerte|Mar de fondo/);
  const barcoF = calcularVentana(lubina, DATOS.reglas_por_defecto, serie(fuerte), ctx("embarcacion"))[i];
  const barcoC = calcularVentana(lubina, DATOS.reglas_por_defecto, serie(calma), ctx("embarcacion"))[i];
  assert.equal(barcoF.puntuacion, barcoC.puntuacion);
});

test("los valores del factor solo restan", () => {
  for (const v of Object.values(VALOR_RESACA)) assert.ok(v <= 0 && v >= -1);
});

test("la regla de resaca tiene criterio y peso en especies.json", () => {
  const r = DATOS.reglas_por_defecto.resaca;
  assert.ok(r.peso_lo > 0 && r.criterio && r.tipo);
  assert.equal(DATOS.reglas_por_modalidad.embarcacion.resaca.peso_lo, 0);
  assert.ok(DATOS.reglas_por_modalidad.submarina.resaca.peso_lo > r.peso_lo);
});

import { factoresPeriodo, periodoFondoPico } from "../assets/js/mar-de-fondo.js";
import PERIODO from "../functions/_lib/periodo-boyas-datos.js";
import { cocientesBoya, tablaPeriodo, cambioMaterial, textoDatos, leerDatos } from "../scripts/fuentes/periodo-boyas.mjs";

test("periodo calibrado con las boyas: el de pico casi clava la boya y el medio se queda corto", () => {
  assert.ok(PERIODO.boyas.length >= 20);
  assert.ok(PERIODO.global.pico > 0.9 && PERIODO.global.pico < 1.1, `pico ${PERIODO.global.pico}`);
  assert.ok(PERIODO.global.medio > 1.15, `medio ${PERIODO.global.medio}`);
  // Bakio usa la boya más cercana (Bilbao-Vizcaya o AP Bilbao); NZ, la global.
  const bakio = factoresPeriodo(PERIODO, 43.43, -2.81);
  assert.ok([2136, 1103].includes(bakio.boya), String(bakio.boya));
  const nz = factoresPeriodo(PERIODO, -36.8, 174.8);
  assert.equal(nz.boya, null);
  assert.equal(nz.medio, PERIODO.global.medio);
  assert.deepEqual(factoresPeriodo(null, 43, -3), { pico: 1, medio: 1, boya: null });
});

test("periodoFondoPico: el de pico si lo hay; si no, el medio corregido", () => {
  const f = { pico: 0.98, medio: 1.28 };
  assert.equal(periodoFondoPico(12, 9, f), 12 * 0.98);
  assert.equal(periodoFondoPico(null, 10, f), 12.8);
  assert.equal(periodoFondoPico(null, null, f), null);
  assert.equal(periodoFondoPico(11, null), 11);
});

test("la copia de periodoFondoPico() de index.html no se desvía", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const m = html.match(/function periodoFondoPico\(pico, medio, f = null\) \{[\s\S]*?\n\}/);
  assert.ok(m, "no está periodoFondoPico en index.html");
  const copia = new Function(`${m[0]}; return periodoFondoPico;`)();
  for (const a of [[12, 9, { pico: 0.9, medio: 1.3 }], [null, 9, { pico: 0.9, medio: 1.3 }], [null, null, null], [10, 8, undefined]]) {
    assert.equal(copia(...a), periodoFondoPico(...a));
  }
});

test("robot del periodo: cociente por boya con 48 horas o más, global = mediana, y solo reescribe con cambios > 3 %", () => {
  const obs = new Map(), time = [], pico = [], medio = [];
  for (let k = 0; k < 60; k++) {
    const ms = Date.UTC(2026, 10, 1) + k * 3600e3;
    obs.set(ms, 13);
    time.push(new Date(ms).toISOString().slice(0, 16));
    pico.push(k % 2 ? 13 : 12.5); medio.push(10);
  }
  const c = cocientesBoya(obs, { time, swell_wave_peak_period: pico, swell_wave_period: medio });
  assert.equal(c.n, 60);
  assert.equal(c.medio, 1.3);
  assert.ok(c.pico >= 1 && c.pico <= 1.04);
  assert.equal(cocientesBoya(new Map([...obs].slice(0, 10)), { time, swell_wave_period: medio }).medio, null, "pocas horas: sin cociente");
  const t = tablaPeriodo([{ codigo: 1, lat: 43, lon: -3, ...c }, { codigo: 2, lat: 42, lon: -9, n: 0, pico: null, medio: null }], new Date("2026-11-19T00:00:00Z"));
  assert.equal(t.boyas.length, 1);
  assert.equal(t.global.medio, 1.3);
  assert.equal(cambioMaterial(t, JSON.parse(JSON.stringify(t))), false);
  const otro = JSON.parse(JSON.stringify(t)); otro.boyas[0].medio = 1.4;
  assert.equal(cambioMaterial(t, otro), true);
  assert.deepEqual(leerDatos(textoDatos(t)), t);
  assert.equal(readFileSync(new URL("../functions/_lib/periodo-boyas-datos.js", import.meta.url), "utf8"), textoDatos(PERIODO));
});
