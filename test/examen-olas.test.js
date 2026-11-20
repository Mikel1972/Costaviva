import test from "node:test";
import assert from "node:assert/strict";
import { errorContraBanda, capturas, etiquetasValidas, examinar, TOLERANCIA_M, RACHA_SUSPENSO } from "../scripts/oleaje-camaras/examen-olas.mjs";
import { aplicarCamarasASpots, FUENTE_POR_SPOT } from "../functions/_lib/oleaje-camaras.js";

const CAM = FUENTE_POR_SPOT.sopelana.camara;

test("error contra la banda: 0 dentro, distancia al borde fuera", () => {
  assert.equal(errorContraBanda([1.2, 1.5], "1-2"), 0);
  assert.equal(errorContraBanda([0.6, 2.6], "0.5-1"), 0.6);
  assert.equal(errorContraBanda([0.3, 0.5], "1-2"), 0.6);
  assert.equal(errorContraBanda([1, 1.2], "no_se_sabe"), null);
  assert.equal(TOLERANCIA_M, 0.3);
});

test("foto de /prevision: solo spots con cámara propia, bloque de ahora", () => {
  const f = capturas({ spots: [{ slug: "sopelana", bloques: [{ altura: [1.2, 1.5], fuenteAltura: "camara" }] }, { slug: "noexiste", bloques: [{ altura: [1, 1.2] }] }] }, Date.parse("2026-11-20T11:00:00Z"));
  assert.deepEqual(f, [{ fecha: "2026-11-20T11:00:00.000Z", camara: CAM, spot: "sopelana", altura: [1.2, 1.5], fuente: "camara" }]);
});

test("examen: suspensos, racha y cámara suspendida tras 3 seguidos", () => {
  const h = (i) => new Date(Date.parse("2026-11-20T08:00:00Z") + i * 3600e3).toISOString();
  const mostrados = [0, 1, 2, 3].map((i) => ({ fecha: h(i), camara: CAM, spot: "sopelana", altura: [2.2, 2.5], fuente: "camara" }));
  const etiquetas = etiquetasValidas([0, 1, 2].map((i) => ({ fecha: h(i), camara: CAM, banda: "0.5-1", confianza: "media", encuadre: "principal" })).concat([{ fecha: h(3), camara: CAM, banda: "1-2", confianza: "baja", encuadre: "principal" }]), []);
  assert.equal(etiquetas.length, 3, "la de confianza baja no cuenta");
  const r = examinar(etiquetas, mostrados, Date.parse(h(4)));
  assert.equal(r.resumen.suspensos, 3);
  assert.equal(r.camaras[CAM].racha, RACHA_SUSPENSO);
  assert.deepEqual(r.suspendidas, [CAM]);
  const ok = examinar(etiquetasValidas([{ fecha: h(3), camara: CAM, banda: "2-3", confianza: "alta", encuadre: "principal" }], []), mostrados, Date.parse(h(4)));
  assert.deepEqual(ok.suspendidas, []);
});

test("una cámara suspendida no se usa en /prevision", () => {
  const spots = [{ slug: "sopelana", bloques: [{ horaISO: "2026-10-08T12:00", altura: [1, 1.2] }] }];
  const lec = { [CAM]: { fecha: "2026-10-08T10:30:00Z", estado: "ok", estimacion: 2.5, rangoMin: 2, rangoMax: 3, modeloCamara: 1.1 } };
  const ahora = Date.parse("2026-10-08T11:00:00Z");
  assert.notDeepEqual(aplicarCamarasASpots(spots, lec, ahora, [])[0].bloques[0].altura, [1, 1.2]);
  assert.deepEqual(aplicarCamarasASpots(spots, lec, ahora, [CAM])[0].bloques[0].altura, [1, 1.2]);
});
