// Test de assets/js/camaras-externas.js (2026-10-08): cada cámara de terceros
// lleva dueño, modo permitido por ese dueño y condiciones con fuente, y va a
// un spot que existe. Lógica pura, sin red: corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAMARAS_EXTERNAS, CONDICIONES, SKYLINE_EMBED_AUTORIZADO, camarasExternasDeSpot, claveSalud, nombreCamara,
  resultadoComprobacionExterna, lecturaSaludExterna, externaCuentaComoCaida,
} from "../assets/js/camaras-externas.js";

const MODOS = ["imagen_oficial", "iframe_oficial", "enlace"];
const spotsPrevision = new Set(
  [...readFileSync(new URL("../functions/prevision.js", import.meta.url), "utf8").matchAll(/slug: "([a-z0-9]+)", nombre:/g)].map((m) => m[1])
);
// Los spots de NZ (2026-10-11) no están en prevision.js: vienen de SPOTS_NZ.
for (const s of SPOTS_NZ) spotsPrevision.add(s.slug);
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
    if (c.modo === "iframe_oficial") assert.ok(c.iframe?.startsWith("https://"), `${c.id}: iframe_oficial sin iframe`);
    else assert.equal(c.iframe, undefined, `${c.id}: solo iframe_oficial lleva iframe`);
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

// --- Nueva Zelanda (assets/js/camaras-nz.js, 2026-10-11) ---
// Mismo formato y mismas reglas, pero cada cámara va a un spot de SPOTS_NZ y
// análisis de la ola según NZ_ANALISIS_AUTORIZADO. Embebidas por decisión de Mikel (2026-10-11, pendiente de la
// respuesta escrita de cada dueño) con un interruptor por dueño
// (NZ_EMBED_AUTORIZADO): el modo de cada una se deduce de él.
import { CAMARAS_NZ, CONDICIONES_NZ, NZ_EMBED_AUTORIZADO, NZ_ANALISIS_AUTORIZADO, ORIGENES_IFRAME_NZ, embedNZ } from "../assets/js/camaras-nz.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { MODOS_EXTERNAS, htmlCamaraIncrustada, textoAtribucion } from "../assets/js/camaras-externas.js";
import { construirCsp } from "../functions/_middleware.js";

const T = {
  es: { "mapa.cam.imagen_atrib": "Imagen", "mapa.cam.video_atrib": "Vídeo", "mapa.cam.cada_min": "(cambia cada {min} min; más en su web)", "mapa.cam.en_directo_su_web": "(en directo; más en su web)" },
  en: { "mapa.cam.imagen_atrib": "Image", "mapa.cam.video_atrib": "Video", "mapa.cam.cada_min": "(updated every {min} min; more on their website)", "mapa.cam.en_directo_su_web": "(live; more on their website)" },
};
const tPara = (idioma) => (clave, vars = {}) => T[idioma][clave].replace(/\{(\w+)\}/g, (_, k) => vars[k]);

test("NZ: Earth Sciences NZ (Cam-Era) prohíbe bots en sus términos: fuera del análisis", () => {
  assert.equal(NZ_ANALISIS_AUTORIZADO.earth_sciences_camera, false);
  assert.match(CONDICIONES_NZ.earth_sciences_camera.prohibicion, /web scraping tool/);
  assert.deepEqual(Object.keys(NZ_ANALISIS_AUTORIZADO).sort(), Object.keys(CONDICIONES_NZ).sort());
});

test("NZ: Primo denegó por escrito (2026-10-12): solo enlace a su página de webcams", () => {
  assert.equal(NZ_EMBED_AUTORIZADO.primo, false);
  assert.equal(NZ_ANALISIS_AUTORIZADO.primo, false);
  assert.equal(embedNZ("primo"), null);
  assert.deepEqual(CONDICIONES_NZ.primo.modos_permitidos, ["enlace"]);
  assert.equal(CONDICIONES_NZ.primo.analisis_permitido, false);
  assert.match(CONDICIONES_NZ.primo.denegacion, /^2026-10-12: /);
  const primo = CAMARAS_NZ.filter((c) => c.condiciones === "primo");
  assert.ok(primo.length >= 1);
  for (const c of primo) {
    assert.equal(c.modo, "enlace", c.id);
    assert.equal(c.url, "https://www.primo.nz/info/primo-webcams", `${c.id}: solo su página pública de webcams`);
    assert.equal(c.imagen, undefined);
    assert.equal(c.iframe, undefined);
    assert.equal(c.analisis_permitido, false);
  }
});

test("NZ: cada condición dice dueño, modos, análisis y fuente", () => {
  for (const [clave, c] of Object.entries(CONDICIONES_NZ)) {
    assert.ok(c.dueno, `${clave}: sin dueño`);
    assert.equal(typeof NZ_EMBED_AUTORIZADO[clave], "boolean", `${clave}: falta su interruptor en NZ_EMBED_AUTORIZADO`);
    const esperado = embedNZ(clave) ? [embedNZ(clave), "enlace"] : ["enlace"];
    assert.deepEqual(c.modos_permitidos, esperado, `${clave}: modos según su interruptor`);
    if (!embedNZ(clave) && NZ_EMBED_AUTORIZADO[clave]) assert.ok(c.motivo_sin_embed, `${clave}: con interruptor y sin embed, falta motivo_sin_embed`);
    assert.ok(c.licencia === null || (c.licencia.nombre && c.licencia.url.startsWith("https://")), `${clave}: licencia`);
    // Análisis de la ola: interruptor por dueño (decisión de Mikel, 2026-10-11).
    assert.equal(typeof NZ_ANALISIS_AUTORIZADO[clave], "boolean", `${clave}: falta en NZ_ANALISIS_AUTORIZADO`);
    assert.equal(c.analisis_permitido, NZ_ANALISIS_AUTORIZADO[clave], `${clave}: analisis_permitido sale del interruptor`);
    // Términos que prohíben expresamente bots/scraping: siempre en false.
    if (c.prohibicion) assert.equal(NZ_ANALISIS_AUTORIZADO[clave], false, `${clave}: sus términos prohíben el uso automatizado`);
    assert.ok(c.fuentes?.length && c.fuentes.every((u) => u.startsWith("https://")), `${clave}: sin fuente`);
    assert.ok(c.cita, `${clave}: sin cita`);
    assert.equal(CONDICIONES[clave], c, `${clave}: camaras-externas.js debe sumar las condiciones de NZ`);
    assert.ok(c.dueno_corto, `${clave}: falta el nombre corto del dueño (botón)`);
  }
});

test("NZ: cada cámara tiene dueño, enlace https, verificación y un spot NZ real", () => {
  const slugsNZ = new Set(SPOTS_NZ.map((s) => s.slug));
  const ids = CAMARAS_NZ.map((c) => c.id);
  assert.ok(CAMARAS_NZ.length > 0);
  assert.equal(new Set(ids).size, ids.length);
  const idsES = new Set(CAMARAS_EXTERNAS.filter((c) => !c.spot.startsWith("nz-")).map((c) => c.id));
  // Conectadas a la app y al robot (2026-10-11): todas están en CAMARAS_EXTERNAS.
  for (const c of CAMARAS_NZ) assert.ok(CAMARAS_EXTERNAS.includes(c), `${c.id}: no está en CAMARAS_EXTERNAS`);
  for (const c of CAMARAS_NZ) {
    assert.match(c.id, /^nz-[a-z0-9-]+$/, c.id);
    assert.ok(!idsES.has(c.id), `${c.id}: id repetido con España`);
    assert.ok(CONDICIONES_NZ[c.condiciones], `${c.id}: condiciones ${c.condiciones}`);
    assert.ok(c.dueno && c.nombre, `${c.id}: dueño/nombre`);
    assert.ok(c.nombre_en && !/[áéíóúñ¿¡]|\b(playa|puerto|desde|hacia|desembocadura|norte|barra|mar)\b/i.test(c.nombre_en.replace(/[āēīōū]/g, "")), `${c.id}: nombre_en en inglés`);
    assert.equal(nombreCamara(c, "en"), c.nombre_en);
    assert.equal(nombreCamara(c, "es"), c.nombre);
    assert.ok(CONDICIONES_NZ[c.condiciones].modos_permitidos.includes(c.modo), `${c.id}: modo ${c.modo} no permitido`);
    if (c.modo === "enlace") {
      assert.equal(c.imagen, undefined, `${c.id}: un enlace no lleva imagen`);
      assert.equal(c.iframe, undefined, `${c.id}: un enlace no lleva iframe`);
      assert.equal(c.atribucion, undefined, `${c.id}: un enlace no lleva atribución`);
    } else {
      assert.equal(c.atribucion?.dueno, c.dueno, `${c.id}: embebida sin atribución al dueño`);
    }
    assert.equal(c.analisis_permitido, CONDICIONES_NZ[c.condiciones].analisis_permitido, `${c.id}: análisis = interruptor de su dueño`);
    assert.equal(typeof c.rompiente, "boolean", `${c.id}: rompiente`);
    assert.ok(c.url?.startsWith("https://"), `${c.id}: url`);
    assert.ok(!/facebook\.com|instagram\.com|fb\.watch/i.test(c.url), `${c.id}: nada de Facebook ni Instagram`);
    if (/youtube\.com|youtu\.be/.test(c.url)) assert.match(c.url, /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/, c.id);
    assert.match(c.verificada || "", /^\d{4}-\d{2}-\d{2}: /, `${c.id}: falta cómo y cuándo se verificó`);
    if (c.km != null) assert.ok(c.km <= 15, `${c.id}: a más de 15 km`);
    assert.ok(slugsNZ.has(c.spot), `${c.id}: el spot ${c.spot} no es de NZ`);
    assert.match(claveSalud(c), /^ext-nz-/);
  }
});

// Modo esperado de cada cámara de NZ (2026-10-11). Si se apaga un
// interruptor, su fila pasa sola a "enlace" (lo calcula el test).
const MODO_NZ = {
  "nz-tairua-cam-era": "imagen_oficial",
  "nz-pauanui-norte-cam-era": "imagen_oficial",
  "nz-corolive-whitianga": "iframe_oficial",
  "nz-corolive-whangamata": "iframe_oficial",
  "nz-geonet-whakatane": "imagen_oficial",
  "nz-geonet-te-kaha": "imagen_oficial",
  "nz-napier-marine-parade": "imagen_oficial",
  "nz-primo-port-taranaki": "enlace", // denegado por escrito (2026-10-12): solo enlace
  "nz-port-otago-aramoana": "enlace", // sin URL estable de imagen
  "nz-southloop-riverton": "imagen_oficial",
  // Repaso de día del 2026-10-12: solo enlace hasta el permiso escrito.
  "nz-hauraki-whangamata-beach": "enlace",
  "nz-raglan-bar": "enlace",
  "nz-castlepoint-lighthouse": "enlace",
  "nz-gw-beacon-hill": "enlace",
  "nz-nelson-harbour": "enlace",
  "nz-southloop-ocean-beach": "enlace",
  "nz-southloop-oban": "enlace",
  "nz-sails-ashore": "enlace",
  "nz-motella-gisborne": "enlace",
};

// Repaso de día del 2026-10-12: las 15 pendientes de NZ, añadidas (solo
// enlace, sin análisis) o descartadas con motivo en NO_SIRVEN_NZ.
import { NO_SIRVEN_NZ } from "../scripts/oleaje-camaras/camaras.mjs";
const DUENOS_NUEVOS_NZ = ["hauraki_coromandel", "raglan_sport_fishing", "castlepoint_lighthouse", "greater_wellington", "nelson_cc", "sails_ashore"];
const REPASO_DIA_NZ = {
  "nz-hauraki-whangamata-beach": "nz-whangamata",
  "nz-raglan-bar": "nz-raglan",
  "nz-castlepoint-lighthouse": "nz-castlepoint",
  "nz-gw-beacon-hill": "nz-wellington-harbour",
  "nz-nelson-harbour": "nz-nelson",
  "nz-southloop-ocean-beach": "nz-bluff",
  "nz-southloop-oban": "nz-halfmoon-bay",
  "nz-sails-ashore": "nz-halfmoon-bay",
};
const DESCARTADAS_DIA_NZ = ["coromandel-harbour", "manu-bay", "plimmerton", "kaikoura-cubby-house", "waikanae-slsc", "coastguard-whakatane", "picton-harbour-view"];

test("NZ (repaso de día 2026-10-12): las 15 pendientes, añadidas solo como enlace o descartadas con motivo", () => {
  assert.equal(Object.keys(REPASO_DIA_NZ).length + DESCARTADAS_DIA_NZ.length, 15);
  for (const [id, spot] of Object.entries(REPASO_DIA_NZ)) {
    const c = CAMARAS_NZ.find((x) => x.id === id);
    assert.ok(c, `${id}: falta en camaras-nz.js`);
    assert.equal(c.spot, spot, id);
    assert.equal(c.modo, "enlace", `${id}: sin permiso escrito solo va como enlace`);
    assert.equal(c.imagen ?? c.iframe, undefined, id);
    assert.match(c.verificada, /^2026-10-12: /, `${id}: verificada de día el 2026-10-12`);
    assert.ok(!/youtube\.com|youtu\.be|facebook|instagram/.test(c.url), `${id}: se enlaza la web del dueño`);
    assert.ok(NO_SIRVEN_NZ[id], `${id}: no se analiza (motivo en NO_SIRVEN_NZ)`);
  }
  for (const id of DESCARTADAS_DIA_NZ) {
    assert.ok(!CAMARAS_NZ.some((c) => c.id === `nz-${id}`), id);
    assert.match(NO_SIRVEN_NZ[`nz-descartada-${id}`] || "", /^DESCARTADA /, `${id}: falta su motivo`);
  }
  // Dueños nuevos: ni embebido ni análisis hasta su respuesta, y un contacto.
  for (const k of DUENOS_NUEVOS_NZ) {
    assert.equal(NZ_EMBED_AUTORIZADO[k], false, k);
    assert.equal(NZ_ANALISIS_AUTORIZADO[k], false, k);
    assert.equal(embedNZ(k), null, k);
    assert.deepEqual(CONDICIONES_NZ[k].modos_permitidos, ["enlace"], k);
    assert.ok(CONDICIONES_NZ[k].contacto, `${k}: sin contacto`);
    assert.ok(CAMARAS_NZ.some((c) => c.condiciones === k), `${k}: dueño sin cámara`);
  }
});

test("NZ: modo por cámara según el interruptor de su dueño", () => {
  for (const c of CAMARAS_NZ) {
    assert.ok(c.id in MODO_NZ, `${c.id}: falta en MODO_NZ`);
    const esperado = MODO_NZ[c.id] !== "enlace" && embedNZ(c.condiciones) ? MODO_NZ[c.id] : "enlace";
    assert.equal(c.modo, esperado, c.id);
  }
});

test("NZ: con el interruptor apagado no se carga nada del dueño", () => {
  for (const c of CAMARAS_NZ.filter((c) => !embedNZ(c.condiciones))) {
    assert.equal(c.modo, "enlace", c.id);
    assert.equal(c.imagen ?? c.iframe, undefined, c.id);
  }
  // CoroLive solo entra en frame-src de la CSP si su interruptor está puesto.
  const frameSrc = construirCsp("x").split("; ").find((d) => d.startsWith("frame-src"));
  assert.equal(frameSrc.includes("https://corolive.nz"), embedNZ("corolive") === "iframe_oficial");
  assert.deepEqual(ORIGENES_IFRAME_NZ, embedNZ("corolive") ? ["https://corolive.nz"] : []);
});

test("NZ: las embebidas usan la imagen o el iframe que publica su dueño", () => {
  const hosts = {
    geonet: /^https:\/\/images\.geonet\.org\.nz\/volcano\/cameras\/latest\/(m-)?[a-z]+\.jpg$/,
    earth_sciences_camera: /^https:\/\/camerastorageoflalbwn\.blob\.core\.windows\.net\/\$web\/[A-Za-z]+\/latest\.jpg$/,
    napier_cc: /^https:\/\/data\.napier\.govt\.nz\/webcam\/thumbnail\.php\?ims=800$/,
    southloop: /^https:\/\/weathercam\.southloop\.net\.nz\/[a-z]+\/[A-Za-z0-9]+\.jpg$/,
    corolive: /^https:\/\/corolive\.nz\/embed\?camera=(whitianga|whangamata)$/,
  };
  for (const c of CAMARAS_NZ.filter((c) => c.modo !== "enlace")) {
    assert.match(c.imagen || c.iframe, hosts[c.condiciones], c.id);
    assert.ok(MODOS_EXTERNAS.includes(c.modo), c.id);
  }
  // CSP: img-src admite https: entero y frame-src el origen de cada iframe.
  const csp = construirCsp("x");
  assert.match(csp, /img-src [^;]*https:/);
  for (const c of CAMARAS_NZ.filter((c) => c.modo === "iframe_oficial")) {
    assert.ok(csp.includes(new URL(c.iframe).origin), `${c.id}: su origen no está en frame-src`);
  }
});

test("NZ: atribución visible, enlace al dueño y sin on*= en el HTML de la ficha", () => {
  const embebidas = CAMARAS_NZ.filter((c) => c.modo !== "enlace");
  assert.ok(embebidas.length >= 5);
  for (const c of embebidas) {
    for (const idioma of ["es", "en"]) {
      const html = htmlCamaraIncrustada(c, idioma, tPara(idioma));
      assert.doesNotMatch(html, /\son[a-z]{3,}\s*=/i, `${c.id}: manejador inline`);
      assert.doesNotMatch(html, /javascript:/i, c.id);
      assert.ok(html.includes(`<figcaption`), `${c.id}: sin pie`);
      const pie = html.slice(html.indexOf("<figcaption"));
      assert.ok(pie.includes(`href="${c.url.replace(/&/g, "&amp;")}"`), `${c.id}: el pie no enlaza a la web del dueño`);
      assert.ok(pie.includes(`>${c.dueno}</a>`), `${c.id}: el pie no nombra al dueño`);
      const nombre = idioma === "en" ? c.nombre_en : c.nombre;
      assert.ok(pie.includes(nombre.replace(/&/g, "&amp;")), `${c.id}: sin nombre en ${idioma}`);
      if (c.modo === "iframe_oficial") assert.match(html, /<iframe src="https:\/\/corolive\.nz\/embed\?camera=/, c.id);
      else assert.ok(html.includes(`<img src="${c.imagen.replace(/&/g, "&amp;")}"`), c.id);
    }
  }
  const whk = CAMARAS_NZ.find((c) => c.id === "nz-geonet-whakatane");
  assert.equal(textoAtribucion(whk, tPara("en")), "Image: GeoNet, CC BY 3.0 NZ");
  assert.equal(textoAtribucion(whk, tPara("es")), "Imagen: GeoNet, CC BY 3.0 NZ");
  const html = htmlCamaraIncrustada(whk, "en", tPara("en"));
  assert.match(html, /Image: <a href="https:\/\/www\.geonet\.org\.nz\/volcano\/cameras\/whakatane"[^>]*>GeoNet<\/a>, <a href="https:\/\/creativecommons\.org\/licenses\/by\/3\.0\/nz\/"[^>]*>CC BY 3\.0 NZ<\/a>/);
  assert.match(html, /updated every 10 min/);
});

test("NZ: el robot acepta octet-stream en imagen_oficial y un 403 en iframe es no verificable", () => {
  const img = { modo: "imagen_oficial" };
  assert.deepEqual(resultadoComprobacionExterna(img, 200, "application/octet-stream"), { ok: true });
  assert.deepEqual(resultadoComprobacionExterna(img, 200, "text/html; charset=utf-8"), { ok: false, motivo: "no_es_imagen" });
  const ifr = { modo: "iframe_oficial" };
  assert.equal(resultadoComprobacionExterna(ifr, 403).motivo, "no_verificable_403");
  assert.deepEqual(resultadoComprobacionExterna(ifr, 200, "text/html"), { ok: true });
  assert.equal(externaCuentaComoCaida(ifr, { sinSenal: true, motivo: "http_403" }), false);
  const robot = readFileSync(new URL("../scripts/camaras/comprobar-camaras.mjs", import.meta.url), "utf8");
  assert.match(robot, /camara\.modo === "iframe_oficial"\) url = camara\.iframe/);
});

test("NZ: index.html pinta las embebidas con htmlCamaraIncrustada y la atribución", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /CE\.htmlCamaraIncrustada\(c, I18n\.idioma\(\), I18n\.t\)/);
  for (const idioma of ["es", "en"]) {
    const textos = readFileSync(new URL(`../assets/i18n/${idioma}.js`, import.meta.url), "utf8");
    for (const k of Object.keys(T[idioma])) assert.ok(textos.includes(`"${k}": "${T[idioma][k]}"`), `${idioma}: ${k}`);
  }
});
