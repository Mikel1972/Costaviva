// Test de assets/js/camaras-externas.js (2026-10-08): cada cámara de terceros
// lleva dueño, modo permitido por ese dueño y condiciones con fuente, y va a
// un spot que existe. Lógica pura, sin red: corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAMARAS_EXTERNAS, CONDICIONES, SKYLINE_EMBED_AUTORIZADO, camarasExternasDeSpot, claveSalud,
  resultadoComprobacionExterna, lecturaSaludExterna, externaCuentaComoCaida,
} from "../assets/js/camaras-externas.js";

const MODOS = ["imagen_oficial", "enlace"];
const spotsPrevision = new Set(
  [...readFileSync(new URL("../functions/prevision.js", import.meta.url), "utf8").matchAll(/slug: "([a-z0-9]+)", nombre:/g)].map((m) => m[1])
);
const webcamsProxy = readFileSync(new URL("../functions/webcam/[slug].js", import.meta.url), "utf8");

test("hay cámaras externas y los ids no se repiten", () => {
  assert.ok(CAMARAS_EXTERNAS.length > 0);
  const ids = CAMARAS_EXTERNAS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("cada condición dice dueño, modos, si permite análisis y su fuente", () => {
  for (const [clave, c] of Object.entries(CONDICIONES)) {
    assert.ok(c.dueno, `${clave}: sin dueño`);
    assert.ok(Array.isArray(c.modos_permitidos) && c.modos_permitidos.length, `${clave}: sin modos`);
    for (const m of c.modos_permitidos) assert.ok(MODOS.includes(m), `${clave}: modo desconocido ${m}`);
    assert.equal(typeof c.analisis_permitido, "boolean", `${clave}: analisis_permitido`);
    assert.ok(c.fuentes?.length && c.fuentes.every((u) => u.startsWith("https://")), `${clave}: sin fuente`);
    assert.ok(c.cita, `${clave}: sin cita`);
  }
});

test("cada cámara tiene dueño, modo permitido por su dueño, fuente y spot real", () => {
  for (const c of CAMARAS_EXTERNAS) {
    const cond = CONDICIONES[c.condiciones];
    assert.ok(cond, `${c.id}: condiciones "${c.condiciones}" no existen`);
    assert.ok(c.dueno, `${c.id}: sin dueño`);
    assert.ok(c.nombre, `${c.id}: sin nombre`);
    assert.ok(MODOS.includes(c.modo), `${c.id}: modo ${c.modo}`);
    assert.ok(cond.modos_permitidos.includes(c.modo), `${c.id}: su dueño no permite el modo ${c.modo}`);
    assert.ok(c.url?.startsWith("https://"), `${c.id}: url`);
    assert.equal(typeof c.analisis_permitido, "boolean", `${c.id}: analisis_permitido`);
    assert.ok(!c.analisis_permitido || cond.analisis_permitido, `${c.id}: analiza fotogramas sin permiso del dueño`);
    assert.equal(typeof c.rompiente, "boolean", `${c.id}: rompiente`);
    assert.ok(spotsPrevision.has(c.spot), `${c.id}: el spot ${c.spot} no existe`);
    if (c.modo === "imagen_oficial") assert.ok(c.imagen?.startsWith("https://"), `${c.id}: imagen_oficial sin imagen`);
    else assert.equal(c.imagen, undefined, `${c.id}: un enlace no lleva imagen`);
  }
});

test("las de SkylineWebcams usan su código de inserción, nunca el CDN interno", () => {
  for (const c of CAMARAS_EXTERNAS.filter((c) => c.condiciones === "skyline")) {
    if (c.modo === "imagen_oficial") assert.match(c.imagen, /^https:\/\/embed\.skylinewebcams\.com\/img\/\d+\.jpg$/);
  }
  assert.doesNotMatch(webcamsProxy, /^\s*"https:\/\/cdn\.skylinewebcams\.com/m, "el proxy no debe servir imágenes de SkylineWebcams");
});

test("sin autorización escrita de Skyline, sus cámaras solo se enlazan", () => {
  const sky = CAMARAS_EXTERNAS.filter((c) => c.condiciones === "skyline");
  assert.ok(sky.length > 0);
  for (const c of sky) {
    assert.equal(c.modo, SKYLINE_EMBED_AUTORIZADO ? "imagen_oficial" : "enlace", c.id);
    assert.match(c.url, /^https:\/\/www\.skylinewebcams\.com\//, c.id);
  }
  if (!SKYLINE_EMBED_AUTORIZADO) {
    assert.ok(!JSON.stringify(CAMARAS_EXTERNAS).includes("embed.skylinewebcams.com"), "no se debe cargar embed.skylinewebcams.com");
  }
});

test("las de YouTube y MEO Beachcam solo se enlazan", () => {
  for (const c of CAMARAS_EXTERNAS.filter((c) => c.condiciones === "youtube" || c.condiciones === "meo_beachcam")) {
    assert.equal(c.modo, "enlace", c.id);
  }
});

test("ayudantes: por spot y clave de salud con prefijo", () => {
  assert.ok(camarasExternasDeSpot("nazare").length >= 1);
  assert.deepEqual(camarasExternasDeSpot("no-existe"), []);
  for (const c of CAMARAS_EXTERNAS) assert.match(claveSalud(c), /^ext-/);
});

// Caso real 2026-10-08 21:04 UTC: las 30 de MEO Beachcam salían sin_senal
// con http_403 porque MEO bloquea los runners de GitHub (anti-bots). A las
// 24 h la app habría escondido todos los enlaces de Portugal.
const meo = CAMARAS_EXTERNAS.find((c) => c.condiciones === "meo_beachcam");
const imagen = { modo: "imagen_oficial" };

test("un 403/429/401 en una cámara de enlace es 'no verificable', no caída", () => {
  for (const status of [401, 403, 429]) {
    const r = resultadoComprobacionExterna(meo, status);
    assert.equal(r.noVerificable, true, String(status));
    assert.equal(r.motivo, `no_verificable_${status}`);
  }
  assert.deepEqual(resultadoComprobacionExterna(meo, 200, "text/html"), { ok: true });
  assert.deepEqual(resultadoComprobacionExterna(meo, 404), { ok: false, motivo: "http_404" });
  assert.deepEqual(resultadoComprobacionExterna(meo, 0), { ok: false, motivo: "sin_respuesta" });
});

test("en imagen_oficial un 403 sí es fallo (la imagen la carga la app)", () => {
  assert.deepEqual(resultadoComprobacionExterna(imagen, 403), { ok: false, motivo: "http_403" });
  assert.deepEqual(resultadoComprobacionExterna(imagen, 200, "text/html"), { ok: false, motivo: "no_es_imagen" });
  assert.deepEqual(resultadoComprobacionExterna(imagen, 200, "image/jpeg"), { ok: true });
});

test("no verificable: sin_senal=false, sin fallos, conserva la última señal", () => {
  const previo = { ultimaSenalEn: "2026-10-08T10:00:00Z", fallosSeguidos: 5 };
  const l = lecturaSaludExterna("ext-x", resultadoComprobacionExterna(meo, 403), previo, "2026-10-08T21:04:00Z");
  assert.equal(l.sinSenal, false);
  assert.equal(l.fallosSeguidos, 0);
  assert.equal(l.motivo, "no_verificable_403");
  assert.equal(l.ultimaSenalEn, "2026-10-08T10:00:00Z");
  // Lo que lee el robot de cámaras caídas: sin_senal=true o fallos_seguidos>=1.
  assert.ok(!(l.sinSenal || l.fallosSeguidos >= 1), "el robot de cámaras caídas la tomaría por rota");
});

test("un fallo real sigue contando y a la 2.ª pasada marca sin señal", () => {
  const ahora = "2026-10-08T21:04:00Z";
  const l1 = lecturaSaludExterna("ext-x", resultadoComprobacionExterna(meo, 404), undefined, ahora);
  assert.equal(l1.sinSenal, false);
  assert.equal(l1.fallosSeguidos, 1);
  const l2 = lecturaSaludExterna("ext-x", resultadoComprobacionExterna(meo, 404), l1, ahora);
  assert.equal(l2.sinSenal, true);
  assert.equal(l2.motivo, "http_404");
  const ok = lecturaSaludExterna("ext-x", { ok: true }, l2, ahora);
  assert.deepEqual([ok.sinSenal, ok.fallosSeguidos, ok.motivo, ok.ultimaSenalEn], [false, 0, "ok", ahora]);
});

test("la app nunca esconde un enlace por un bloqueo anti-bots (ni con filas viejas)", () => {
  assert.equal(externaCuentaComoCaida(meo, { sinSenal: true, motivo: "http_403", ultimaSenalEn: null }), false);
  assert.equal(externaCuentaComoCaida(meo, { sinSenal: true, motivo: "http_429" }), false);
  assert.equal(externaCuentaComoCaida(meo, { sinSenal: false, motivo: "no_verificable_403" }), false);
  assert.equal(externaCuentaComoCaida(meo, { sinSenal: true, motivo: "http_404" }), true);
  assert.equal(externaCuentaComoCaida(imagen, { sinSenal: true, motivo: "http_403" }), true);
  assert.equal(externaCuentaComoCaida(meo, undefined), false);
});

test("index.html filtra las externas con externaCuentaComoCaida y el robot usa la lógica compartida", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /CE\.externaCuentaComoCaida\(c, CAMARAS\[clave\]\) && camaraRetirada\(clave\)/);
  const robot = readFileSync(new URL("../scripts/camaras/comprobar-camaras.mjs", import.meta.url), "utf8");
  assert.match(robot, /resultadoComprobacionExterna\(camara, status, tipo\)/);
  assert.match(robot, /lecturaSaludExterna\(clave,/);
});
