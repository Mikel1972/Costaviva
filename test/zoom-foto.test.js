// test/zoom-foto.test.js
// Foto ampliada de la cámara (2026-10-12): se puede mover una vez ampliada,
// sin dejar huecos, y el zoom crece desde el punto tocado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { limitar, desplazamientoParaFijar, ZOOM_TOQUE, ZOOM_MAX } from "../assets/js/zoom-foto.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(RAIZ, "index.html"), "utf8");

test("limitar: sin zoom no se mueve; ampliada, solo hasta el borde", () => {
  assert.deepEqual(limitar(50, -30, 1, 400, 300, 400, 800), [0, 0]);
  // 400x300 a x2.5 = 1000x750 en una vista 400x800: sobra 300 a cada lado en x, nada en y.
  assert.deepEqual(limitar(500, 100, 2.5, 400, 300, 400, 800), [300, 0]);
  assert.deepEqual(limitar(-500, 0, 2.5, 400, 300, 400, 800), [-300, 0]);
  assert.deepEqual(limitar(120, 0, 2.5, 400, 300, 400, 800), [120, 0]);
});

test("el punto tocado se queda bajo el dedo al ampliar", () => {
  const c = 200, p = 300;
  const t1 = desplazamientoParaFijar(p, c, 0, 1, ZOOM_TOQUE);
  // Punto de la imagen que estaba en p: (p - c) desde el centro, ahora en c + (p - c)*s + t1.
  assert.equal(c + (p - c) * ZOOM_TOQUE + t1, p);
  // Y desde un estado ya movido y ampliado.
  const t0 = -40, s0 = 2;
  const u = (p - c - t0) / s0; // coordenada de la imagen bajo p
  const t2 = desplazamientoParaFijar(p, c, t0, s0, 4);
  assert.ok(Math.abs(c + u * 4 + t2 - p) < 1e-9);
  assert.ok(ZOOM_MAX > ZOOM_TOQUE);
});

test("index.html: el pop-up usa zoom-foto.js y ya no el scale con scroll", () => {
  assert.match(html, /import \* as ZoomFoto from "\/assets\/js\/zoom-foto\.js";/);
  assert.match(html, /window\.ZoomFoto\.montarZoom\(vista, media/);
  assert.doesNotMatch(html, /scale\(2\.2\)/);
  assert.match(html, /#contenidoZoomWebcam \{\s*width: 100%; height: 100%; overflow: hidden;/);
  assert.ok(esRutaPermitida("/assets/js/zoom-foto.js"));
});
