// Cámara como referencia (2026-10-08, aprobado por Mikel): mientras una
// cámara propia no sustituye al modelo, /prevision devuelve
// `camaraReferencia` y el panel lo enseña debajo, en secundario. Lógica pura,
// sin red (corre en tests.yml). Cubre la selección (vieja, de noche, sin
// espuma, sustituyendo o no, cámara vecina, otro encuadre), el agrupado de
// filas de oleaje_camara_lecturas, el texto del panel (copia de index.html)
// y que las piezas de Instagram no la usan.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  filasLecturas, camaraReferenciaDeSpot, aplicarReferenciasCamara, aplicarCamarasASpots,
  ESPUMA_MINIMA, ELEVACION_MINIMA, elevacionSolar,
} from "../functions/_lib/oleaje-camaras.js";
import * as calibracion from "../scripts/oleaje-camaras/calibracion.mjs";

const H = 3600e3;
// 16:40 en Madrid (14:40 UTC), a plena luz en octubre.
const AHORA = Date.parse("2026-10-08T14:40:00Z");

function spot(slug) {
  return {
    slug,
    bloques: [
      { hora: "15h", horaISO: "2026-10-08T15:00", altura: [1.8, 2.2] },
      { hora: "18h", horaISO: "2026-10-08T18:00", altura: [1.8, 2.2] },
    ],
  };
}
function fila(extra = {}) {
  return {
    camara: "sopelana", fecha: "2026-10-08T14:30:00Z", estado: "ok", encuadre: "principal",
    espuma: 0.21, estimacion_camara_m: 1.23, rango_min_m: 0.82, rango_max_m: 1.85,
    error_rel: 0.5, modelo_camara_m: 2, sustituye_modelo: false, ...extra,
  };
}
const medidaDe = (filas) => filasLecturas(filas).medidas.sopelana;

test("calibracion.mjs reexporta las constantes y la elevación solar del lib (una sola copia)", () => {
  assert.equal(calibracion.ESPUMA_MINIMA, ESPUMA_MINIMA);
  assert.equal(calibracion.ELEVACION_MINIMA, ELEVACION_MINIMA);
  assert.equal(calibracion.elevacionSolar, elevacionSolar);
});

test("filasLecturas: separa la que sustituye (para mandar) de la última medida (para la referencia)", () => {
  const { lecturas, medidas } = filasLecturas([
    fila({ fecha: "2026-10-08T13:30:00Z", sustituye_modelo: true, estimacion_camara_m: 1.6 }),
    fila(),
    fila({ camara: "zarautz", estado: "otro_encuadre" }),
  ]);
  assert.equal(lecturas.sopelana.estimacion, 1.6);
  assert.equal(lecturas.sopelana.fecha, "2026-10-08T13:30:00Z");
  assert.equal(medidas.sopelana.fecha, "2026-10-08T14:30:00Z");
  assert.equal(medidas.sopelana.sustituyeModelo, false);
  assert.equal(medidas.sopelana.sinEspuma, false);
  assert.equal(medidas.zarautz, undefined, "solo cuentan las filas ok (encuadre de referencia, sin orilla)");
});

test("filasLecturas: sin espuma solo si ningún encuadre de esa medida la ve", () => {
  const sinNada = medidaDe([fila({ encuadre: "a", espuma: 0, estimacion_camara_m: null }), fila({ encuadre: "b", espuma: ESPUMA_MINIMA, estimacion_camara_m: null })]);
  assert.equal(sinNada.sinEspuma, true);
  const unoVe = medidaDe([fila({ encuadre: "a", espuma: 0 }), fila({ encuadre: "b", espuma: 0.1 })]);
  assert.equal(unoVe.sinEspuma, false);
});

test("referencia: cámara propia que no sustituye, lectura reciente con luz y espuma → se enseña, redondeada", () => {
  const r = camaraReferenciaDeSpot(spot("sopelana"), medidaDe([fila()]), AHORA);
  assert.deepEqual(r, {
    altura: 1.2, rango: [0.8, 1.9], hora: "16:30", fecha: "2026-10-08T14:30:00Z", camara: "sopelana", nombre: "Sopela",
  });
});

test("referencia: lectura de más de 3 h → nada", () => {
  const m = medidaDe([fila({ fecha: new Date(AHORA - 3.2 * H).toISOString() })]);
  assert.equal(camaraReferenciaDeSpot(spot("sopelana"), m, AHORA), null);
  const vale = medidaDe([fila({ fecha: new Date(AHORA - 2.9 * H).toISOString() })]);
  assert.ok(camaraReferenciaDeSpot(spot("sopelana"), vale, AHORA));
});

test("referencia: lectura de noche (sol < ELEVACION_MINIMA) → nada", () => {
  const noche = Date.parse("2026-10-08T19:30:00Z"); // 21:30 en Madrid
  const m = medidaDe([fila({ fecha: "2026-10-08T19:00:00Z" })]);
  assert.ok(elevacionSolar(Date.parse("2026-10-08T19:00:00Z"), 43.39, -3) < ELEVACION_MINIMA);
  assert.equal(camaraReferenciaDeSpot(spot("sopelana"), m, noche), null);
});

test("referencia: sin espuma visible → nada (la rompiente puede estar fuera de la zona medida)", () => {
  const m = medidaDe([fila({ espuma: 0.001, estimacion_camara_m: null, rango_min_m: null, rango_max_m: null })]);
  assert.equal(m.sinEspuma, true);
  assert.equal(camaraReferenciaDeSpot(spot("sopelana"), m, AHORA), null);
});

test("referencia: sin estimación (cámara aún sin calibración) → nada", () => {
  const m = medidaDe([fila({ estimacion_camara_m: null, rango_min_m: null, rango_max_m: null })]);
  assert.equal(camaraReferenciaDeSpot(spot("sopelana"), m, AHORA), null);
});

test("referencia: si la cámara ya sustituye al modelo, manda ella y no hay referencia", () => {
  const filas = [fila({ sustituye_modelo: true })];
  const { lecturas, medidas } = filasLecturas(filas);
  const conCamara = aplicarCamarasASpots([spot("sopelana")], lecturas, AHORA);
  assert.equal(conCamara[0].bloques[0].fuenteAltura, "camara");
  const [s] = aplicarReferenciasCamara(conCamara, medidas, AHORA);
  assert.equal(s.camaraReferencia, undefined);
  // Y aunque la última medida no sustituya, si otra anterior vigente ya
  // sustituye en el spot, tampoco se duplica.
  const mezcla = filasLecturas([fila({ fecha: "2026-10-08T13:30:00Z", sustituye_modelo: true }), fila()]);
  const [s2] = aplicarReferenciasCamara(aplicarCamarasASpots([spot("sopelana")], mezcla.lecturas, AHORA), mezcla.medidas, AHORA);
  assert.equal(s2.camaraReferencia, undefined);
});

test("referencia: no sustituye → el modelo sigue siendo la cifra principal y la referencia va aparte", () => {
  const { lecturas, medidas } = filasLecturas([fila()]);
  assert.deepEqual(lecturas, {});
  const [s] = aplicarReferenciasCamara(aplicarCamarasASpots([spot("sopelana")], lecturas, AHORA), medidas, AHORA);
  assert.deepEqual(s.bloques[0].altura, [1.8, 2.2]);
  assert.equal(s.bloques[0].fuenteAltura, undefined);
  assert.equal(s.camaraReferencia.altura, 1.2);
});

test("referencia: nunca la cámara de un vecino (Getxo ← Sopela, Santoña ← Berria)", () => {
  const medidas = { sopelana: medidaDe([fila()]), berria: medidaDe([fila()]) };
  const salida = aplicarReferenciasCamara([spot("getxo"), spot("santona"), spot("cadiz")], medidas, AHORA);
  for (const s of salida) assert.equal(s.camaraReferencia, undefined, s.slug);
});

test("texto del panel (copia de index.html): ~ y una cifra decimal; vieja en el navegador → vacío", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const extraer = (nombre) => {
    const i = html.indexOf(`function ${nombre}(`);
    assert.ok(i >= 0, `falta ${nombre} en index.html`);
    let nivel = 0, j = html.indexOf("{", i);
    for (; j < html.length; j++) {
      if (html[j] === "{") nivel++;
      else if (html[j] === "}" && --nivel === 0) break;
    }
    return html.slice(i, j + 1);
  };
  const { textoReferenciaCamara } = new Function(
    `const VIGENCIA_REF_CAMARA_MS = 3 * 3600e3;\n${extraer("numeroOla")}\n${extraer("textoReferenciaCamara")}\nreturn { textoReferenciaCamara };`
  )();
  const ref = camaraReferenciaDeSpot(spot("sopelana"), medidaDe([fila()]), AHORA);
  assert.equal(textoReferenciaCamara(ref, AHORA), "La cámara apunta a ~1,2 m (0,8–1,9 m, sin calibrar · 16:30)");
  assert.equal(textoReferenciaCamara(ref, AHORA + 3 * H), "");
  assert.equal(textoReferenciaCamara(null, AHORA), "");
  assert.ok(!/\son[a-z]+=/.test(extraer("pintarReferenciaCamara")), "sin on*= (CSP)");
});

test("las piezas de Instagram no usan la referencia de cámara", () => {
  const dir = new URL("../scripts/marketing/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => /\.(m?js)$/.test(n))) {
    assert.ok(!readFileSync(new URL(f, dir), "utf8").includes("camaraReferencia"), f);
  }
});
