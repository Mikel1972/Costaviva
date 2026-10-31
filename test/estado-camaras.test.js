// Color de cámara de cada spot (2026-10-11, Mikel: "Verde = cámara. Rojo =
// no cámara"). Regla en assets/js/camaras-externas.js (estadoCamaraSpot,
// camaraOculta, inicioSinSenal) y decisión del robot de salud en
// scripts/camaras/decidir-estado.mjs. Lógica pura, sin red.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  estadoCamaraSpot, enlaceCuentaVerde, camaraOculta, inicioSinSenal, externaFunciona, externaMarcadaCaida, camarasExternasDeSpot, claveSalud,
  CAMARAS_EXTERNAS,
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

test("enlaces que bloquean robots (MEO 403, CoroLive): verde, como una vista bien (Mikel, 2026-10-11)", () => {
  const nv = { sinSenal: false, motivo: "no_verificable_403" };
  const camaras = Object.fromEntries(ext("nazare").map((k) => [k, nv]));
  assert.equal(estadoCamaraSpot("nazare", false, camaras), "verde");
  assert.equal(externaFunciona(nv), true);
  assert.equal(externaFunciona({ sinSenal: false, motivo: "no_verificable_429" }), true);
});

test("los 15 spots de Portugal solo con MEO salen en verde", () => {
  const nv = { sinSenal: false, motivo: "no_verificable_403" };
  const soloMeo = [...new Set(CAMARAS_EXTERNAS.filter((c) => c.condiciones === "meo_beachcam").map((c) => c.spot))]
    .filter((slug) => camarasExternasDeSpot(slug).every((c) => c.condiciones === "meo_beachcam"));
  assert.equal(soloMeo.length, 15);
  const camaras = Object.fromEntries(CAMARAS_EXTERNAS.map((c) => [claveSalud(c), nv]));
  for (const slug of soloMeo) assert.equal(estadoCamaraSpot(slug, false, camaras), "verde", slug);
});

test("una no verificable marcada a mano como caída (caida_comprobada) no cuenta", () => {
  const camara = { ...camarasExternasDeSpot("sagres")[0], caida_comprobada: { fecha: "2026-11-01", nota: "su web dice offline" } };
  assert.equal(externaMarcadaCaida(camara), true);
  assert.equal(externaFunciona({ sinSenal: false, motivo: "no_verificable_403" }, camara), false);
});

test("caida_comprobada, si existe, lleva fecha y nota", () => {
  for (const c of CAMARAS_EXTERNAS.filter(externaMarcadaCaida)) {
    assert.match(c.caida_comprobada.fecha, /^\d{4}-\d{2}-\d{2}$/, c.id);
    assert.ok(c.caida_comprobada.nota, c.id);
  }
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

// --- Nueva Zelanda (2026-10-11, "no veo las cámaras de NZ") ---

test("NZ: los 16 spots con cámara salen en verde con el estado real de hoy; los demás, rojo", async () => {
  const { SPOTS_NZ } = await import("../functions/_lib/nz/spots-nz.js");
  // 9 del 2026-10-11 + 6 del repaso de día del 2026-10-12 (raglan, castlepoint,
  // wellington-harbour, nelson, bluff, halfmoon-bay; whangamata ya tenía).
  const conCamara = ["tairua", "whitianga", "whangamata", "whakatane", "te-kaha", "napier", "new-plymouth", "aramoana", "riverton",
    "raglan", "castlepoint", "wellington-harbour", "nelson", "bluff", "halfmoon-bay",
    // 2026-10-31: Gisborne, del buscador de cámaras (YouTube, enlace).
    "gisborne"].map((s) => `nz-${s}`);
  // Estado de camara_estado del 2026-10-11 12:17 UTC: CoroLive no verificable, el resto ok.
  const camaras = Object.fromEntries(
    CAMARAS_EXTERNAS.filter((c) => c.spot.startsWith("nz-")).map((c) => [claveSalud(c), c.id.startsWith("nz-corolive") ? { sinSenal: false, motivo: "no_verificable_403" } : ok])
  );
  for (const slug of conCamara) assert.equal(estadoCamaraSpot(slug, false, camaras), "verde", slug);
  const sin = SPOTS_NZ.filter((s) => !conCamara.includes(s.slug));
  assert.ok(sin.length > 40);
  for (const s of sin) assert.equal(estadoCamaraSpot(s.slug, false, camaras), "rojo", s.slug);
});

test("NZ: /prevision?region=nz manda solo el estado de las cámaras de NZ", async () => {
  const { camarasDeNZ } = await import("../functions/prevision.js");
  const todas = { "ext-nz-geonet-te-kaha": ok, "ext-meo-sagres": ok, zarautz: ok };
  assert.deepEqual(Object.keys(camarasDeNZ(todas)), ["ext-nz-geonet-te-kaha"]);
  const fuente = readFileSync(new URL("../functions/prevision.js", import.meta.url), "utf8");
  assert.match(fuente, /camaras: camarasDeNZ\(camaras\)/);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /s\.pais !== "nz" && Object\.keys\(CAMARAS\)/);
  assert.equal((html.match(/CAMARAS = \{ \.\.\.CAMARAS, \.\.\.datos\.camaras \}/g) || []).length, 2);
});

test("un spot con enlace a una cámara es punto verde aunque el robot no la haya visto aún (Mikel, 2026-10-12)", () => {
  const [clave] = ext("nerja");
  assert.ok(clave, "Nerja tiene un enlace");
  assert.equal(estadoCamaraSpot("nerja", false, {}), "verde", "sin fila de salud todavía");
  assert.equal(estadoCamaraSpot("nerja", false, { [clave]: { sinSenal: false, motivo: "http_500" } }), "verde", "un fallo suelto no lo apaga");
  assert.equal(estadoCamaraSpot("nerja", false, { [clave]: { sinSenal: true, motivo: "http_404" } }), "rojo", "roto de verdad: rojo");
  assert.equal(enlaceCuentaVerde({ modo: "imagen_oficial" }, undefined), false, "solo los enlaces");
  assert.equal(enlaceCuentaVerde({ modo: "enlace", caida_comprobada: { fecha: "2026-10-12" } }, undefined), false);
});
