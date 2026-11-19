// Alarma de la regla de vecinos (scripts/oleaje-camaras/avisos-vecinos.mjs, 2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { acumular, registros, repetidos } from "../scripts/oleaje-camaras/avisos-vecinos.mjs";
import { etiquetarCamaras } from "../scripts/aprendizaje/senales.mjs";

const AHORA = Date.UTC(2026, 10, 19, 21);
const aviso = (slug, tipo, h) => ({ slug, tipo, horaISO: `2026-11-19T${h}:00`, antes: [2.4, 2.9], tope: 2.2 });

test("se acumulan sin repetir y se olvidan a los 7 días", () => {
  const r1 = registros([aviso("bakio", "alto", "21"), aviso("bakio", "alto", "21")], AHORA);
  assert.equal(r1[0].camara, "bakio");
  const lista = acumular([{ ...r1[0], horaISO: "2026-11-01T00:00", visto: "2026-11-01T00:00:00Z" }], r1, AHORA);
  assert.equal(lista.length, 1);
});

test("cámaras con avisos repetidos en 24 h; la del spot vecino cuenta para su cámara", () => {
  const lista = acumular([], registros([aviso("bakio", "alto", "18"), aviso("bakio", "alto", "21"), aviso("plentzia", "alto", "21"), aviso("sopelana", "bajo", "21")], AHORA), AHORA);
  const rep = repetidos(lista, AHORA);
  assert.deepEqual(rep.map((r) => r.clave), ["bakio"]);
  assert.deepEqual(rep[0].spots.sort(), ["bakio", "plentzia"]);
});

test("las cámaras con avisos suben en la lista de fotos a etiquetar", () => {
  const linea = (camara) => ({ camara, encuadre: "a", fecha: "2026-11-19T10:00:00Z", estado: "ok", espuma: 0.5, estimacion: 1, modeloCamara: 1 });
  const avisos = { avisos: [1, 2, 3, 4].map((i) => ({ camara: "bakio", visto: "2026-11-19T12:00:00Z", slug: "bakio", tipo: "alto", horaISO: `2026-11-19T0${i}:00` })) };
  const sin = etiquetarCamaras([linea("zarautz"), linea("bakio")], {}, {});
  const con = etiquetarCamaras([linea("zarautz"), linea("bakio")], {}, { avisosVecinos: avisos });
  assert.equal(con[0].camara, "bakio");
  assert.match(con[0].motivo, /vecinos/);
  assert.ok(sin.length === 2);
});
