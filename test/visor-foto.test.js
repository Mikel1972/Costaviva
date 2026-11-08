// Visor de fotos del diario (assets/js/visor-foto.js), 2026-11-08.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.window = globalThis;
await import("../assets/js/visor-foto.js");
const { escalaPellizco, limitar, nombreFichero, ZOOM_MAX } = globalThis.VisorFoto;

test("visor de fotos: el pellizco escala entre 1 y el máximo", () => {
  assert.equal(escalaPellizco(1, 100, 200), 2);
  assert.equal(escalaPellizco(2, 100, 50), 1);
  assert.equal(escalaPellizco(1, 100, 10000), ZOOM_MAX);
  assert.equal(escalaPellizco(1.5, 0, 300), 1.5);
});

test("visor de fotos: ampliada, no se puede arrastrar más allá del borde", () => {
  assert.deepEqual(limitar(500, -500, 2, 400, 300), { x: 200, y: -150 });
  assert.deepEqual(limitar(10, 10, 1, 400, 300), { x: 0, y: 0 });
});

test("visor de fotos: nombre del fichero al guardar, sin acentos ni espacios", () => {
  assert.equal(nombreFichero("Foto de Lubina común", new Date("2026-11-08T10:00:00Z")), "costaviva-foto-de-lubina-comun-2026-11-08.jpg");
  assert.equal(nombreFichero("", new Date("2026-11-08T10:00:00Z")), "costaviva-captura-2026-11-08.jpg");
});

test("visor de fotos: el diario lo carga y sin on*= en el HTML", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /<script src="\/assets\/js\/visor-foto\.js"><\/script>/);
  const js = readFileSync(new URL("../assets/js/visor-foto.js", import.meta.url), "utf8");
  assert.doesNotMatch(js, /\son[a-z]+=/);
});
