// Color de cámara de cada spot (2026-10-11, Mikel: "Verde = cámara. Rojo =
// no cámara"). Regla en assets/js/camaras-externas.js (estadoCamaraSpot,
// camaraOculta, inicioSinSenal) y decisión del robot de salud en
// scripts/camaras/decidir-estado.mjs. Lógica pura, sin red.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  estadoCamaraSpot, camaraOculta, inicioSinSenal, externaFunciona, camarasExternasDeSpot, claveSalud,
} from "../assets/js/camaras-externas.js";
import { decidirEstado, esFalloDeServidor } from "../scripts/camaras/decidir-estado.mjs";

const AHORA = Date.parse("2026-10-11T12:20:00Z");
const hace = (h) => new Date(AHORA - h * 3600e3).toISOString();
const ok = { sinSenal: false, motivo: "ok", ultimaSenalEn: hace(0.1), congeladaDesde: hace(0.1) };

// Claves de salud reales de las externas de cada spot de prueba.
const ext = (slug) => camarasExternasDeSpot(slug).map(claveSalud);

test("principal funcionando: verde", () => {
  assert.equal(estadoCamaraSpot("zarautz", true, { zarautz: ok }), "verde");
});

test("principal caída pero el proxy sirve la reserva (Laredo): verde", () => {
  // El proxy cambia solo de fuente y el robot ve una imagen buena: sinSenal
  // false aunque haya servido la fuente 1.
  const r = decidirEstado({ ok: true, hash: "nuevo", desviacion: 40, fuenteUsada: 1 }, { hashFrame: "viejo", hashDesde: hace(1) }, hace(0));
  assert.equal(r.sinSenal, false);
  assert.equal(estadoCamaraSpot("laredo", true, { laredo: { sinSenal: r.sinSenal, motivo: r.motivo } }), "verde");
});

test("congelada más de 24 h (Pasaia): rojo y oculta", () => {
  const pasaia = { sinSenal: true, motivo: "frame_congelado", ultimaSenalEn: hace(0.05), congeladaDesde: "2026-10-07T14:51:20Z" };
  assert.equal(estadoCamaraSpot("pasaia", true, { pasaia }), "rojo");
  assert.equal(camaraOculta(pasaia, AHORA), true);
});

test("congelada que además falla a ratos (cantabria.es): cuenta desde que se congeló", () => {
  const comillas = { sinSenal: true, motivo: "origen_522", ultimaSenalEn: hace(0.3), congeladaDesde: hace(26) };
  assert.equal(inicioSinSenal(comillas), hace(26));
  assert.equal(camaraOculta(comillas, AHORA), true);
  assert.equal(estadoCamaraSpot("comillas", true, { comillas }), "rojo");
});

test("caída menos de 24 h: rojo pero sigue a la vista; más de 24 h (Alicante, 404): oculta", () => {
  const orio = { sinSenal: true, motivo: "sin_respuesta", ultimaSenalEn: hace(2), congeladaDesde: hace(2) };
  assert.equal(camaraOculta(orio, AHORA), false);
  assert.equal(estadoCamaraSpot("orio", true, { orio }), "rojo");
  const alicante = { sinSenal: true, motivo: "origen_404", ultimaSenalEn: "2026-10-07T02:31:27Z", congeladaDesde: "2026-10-07T02:31:27Z" };
  assert.equal(camaraOculta(alicante, AHORA), true);
  assert.equal(estadoCamaraSpot("alicante", true, { alicante }), "rojo");
});

test("retirada del código (Cala Millor, Son Bou): la fila vieja no cuenta, rojo", () => {
  const vieja = { sinSenal: false, motivo: "ok" }; // aunque la fila dijera ok
  assert.equal(estadoCamaraSpot("calamillor", false, { calamillor: vieja }), "rojo");
  assert.equal(estadoCamaraSpot("sonbou", false, {}), "rojo");
});

test("retirada con enlace de YouTube comprobado (Muro): verde", () => {
  const [clave] = ext("muro");
  assert.ok(clave, "Muro debe tener su enlace de YouTube");
  const camaras = { muro: { sinSenal: true, motivo: "http_502" }, [clave]: ok };
  assert.equal(estadoCamaraSpot("muro", false, camaras), "verde");
});

test("solo cámara de terceros funcionando (Santander, Skyline): verde", () => {
  const camaras = Object.fromEntries(ext("santander").map((k) => [k, ok]));
  assert.equal(estadoCamaraSpot("santander", false, camaras), "verde");
});

test("propia caída pero una de terceros funciona (Suances): verde", () => {
  const camaras = { suances: { sinSenal: true, motivo: "origen_522" }, ...Object.fromEntries(ext("suances").map((k) => [k, ok])) };
  assert.equal(estadoCamaraSpot("suances", true, camaras), "verde");
});

test("enlace caído de verdad: rojo; enlace que solo falló una vez: no cuenta como funcionando", () => {
  const [clave] = ext("nerja");
  assert.equal(estadoCamaraSpot("nerja", false, { [clave]: { sinSenal: true, motivo: "http_404" } }), "rojo");
  assert.equal(externaFunciona({ sinSenal: false, motivo: "http_500" }), false);
  assert.equal(externaFunciona(undefined), false);
});

test("solo enlaces que bloquean robots (MEO, 403): tercer estado no_verificable", () => {
  const camaras = Object.fromEntries(ext("nazare").map((k) => [k, { sinSenal: false, motivo: "no_verificable_403" }]));
  assert.equal(estadoCamaraSpot("nazare", false, camaras), "no_verificable");
  // Con uno comprobado al lado (Caparica tiene YouTube), verde.
  const cap = Object.fromEntries(ext("costadacaparica").map((k) => [k, k.startsWith("ext-yt-") ? ok : { sinSenal: false, motivo: "no_verificable_403" }]));
  assert.equal(estadoCamaraSpot("costadacaparica", false, cap), "verde");
});

test("sin ninguna cámara: rojo", () => {
  assert.equal(camarasExternasDeSpot("plentzia").length, 0);
  assert.equal(estadoCamaraSpot("plentzia", false, {}), "rojo");
});

// --- Robot de salud (decidir-estado.mjs) ---

test("un error del origen (522, 404) es sin señal desde la primera vez", () => {
  for (const motivo of ["origen_522", "origen_404", "http_502"]) {
    assert.equal(esFalloDeServidor(motivo), true, motivo);
    const r = decidirEstado({ ok: false, motivo }, { fallosSeguidos: 0, hashFrame: "a", hashDesde: hace(0.5) }, hace(0));
    assert.equal(r.sinSenal, true, motivo);
  }
});

test("un bache de red espera a la segunda pasada", () => {
  const r1 = decidirEstado({ ok: false, motivo: "sin_respuesta" }, { fallosSeguidos: 0, hashFrame: "a", hashDesde: hace(0.5) }, hace(0));
  assert.equal(r1.sinSenal, false);
  const r2 = decidirEstado({ ok: false, motivo: "sin_respuesta" }, { fallosSeguidos: 1, hashFrame: "a", hashDesde: hace(1) }, hace(0));
  assert.equal(r2.sinSenal, true);
});

test("un fallo no devuelve al verde a una cámara que ya estaba congelada", () => {
  const r = decidirEstado({ ok: false, motivo: "error_descarga" }, { fallosSeguidos: 0, hashFrame: "a", hashDesde: hace(11) }, hace(0));
  assert.equal(r.sinSenal, true);
  assert.equal(r.hashDesde, hace(11));
});

test("misma imagen más de 3 h: congelada; imagen nueva: ok", () => {
  const prev = { hashFrame: "a", hashDesde: hace(4), fallosSeguidos: 0 };
  assert.equal(decidirEstado({ ok: true, hash: "a", desviacion: 40 }, prev, hace(0)).motivo, "frame_congelado");
  const r = decidirEstado({ ok: true, hash: "b", desviacion: 40 }, prev, hace(0));
  assert.deepEqual([r.sinSenal, r.motivo], [false, "ok"]);
});

test("index.html pinta el punto con estadoCamaraSpot en todos los spots del catálogo", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /CE\.estadoCamaraSpot\(s\.slug, SPOTS_CON_WEBCAM\.includes\(s\.slug\), CAMARAS\)/);
  assert.match(html, /!s\.esUsuario \? `<span class="punto-webcam-viva" id="webcam-punto-/);
  assert.doesNotMatch(html, /const tieneWebcam = !s\.esUsuario && SPOTS_CON_WEBCAM/);
});
