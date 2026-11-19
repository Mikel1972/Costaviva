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
