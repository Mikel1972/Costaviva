// Aviso de talla mínima en el diario (2026-11-19). Usa la tabla verificada de
// especies.json y la misma elección por zona que la ficha del mapa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tallasParaRegion, enEuskadi } from "../assets/js/ventana-actividad.js";
import { regionPescaPorCoordenadas } from "../assets/js/regiones.js";

const datos = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const especie = (c) => datos.especies.find((e) => e.cientifico === c);
const minima = (c, lat, lon) => tallasParaRegion(especie(c), regionPescaPorCoordenadas(lat, lon), enEuskadi(lat, lon)).find((t) => t.valor_cm != null)?.valor_cm;

test("lubina: la norma más concreta de cada zona", () => {
  assert.equal(minima("Dicentrarchus labrax", 43.43, -2.81), 42); // Bakio, Gobierno Vasco
  assert.equal(minima("Dicentrarchus labrax", 43.46, -3.8), 42); // Santander, RD 347/2011
  assert.ok(minima("Dicentrarchus labrax", 38.7, -9.4) > 0); // Portugal
});

test("en Nueva Zelanda no hay cifra (solo el enlace de MPI): no se avisa", () => {
  const nz = datos.especies.find((e) => (e.talla_minima || []).some((t) => /^NZ-/.test(t.jurisdiccion)));
  const t = tallasParaRegion(nz, regionPescaPorCoordenadas(-36.85, 174.8), false).find((x) => x.valor_cm != null);
  assert.equal(t, undefined);
});

test("el diario avisa en la tarjeta y mientras se rellena el formulario", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /Number\(captura\.talla_cm\) < Number\(minima\.t\.valor_cm\)/);
  assert.match(html, /id="avisoTallaFormulario"/);
  assert.match(html, /getElementById\("capturaTalla"\)\.addEventListener\("input", actualizarAvisoTalla\)/);
});
