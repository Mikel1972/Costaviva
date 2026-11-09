// Ajuste de una especie solo en una modalidad (reglas_modalidad), 2026-11-09:
// el sargo deja de perder puntos de noche desde costa; embarcación no cambia.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.I18n ??= { t: (k) => k, num: (x) => String(x), dato: (o, k) => o?.[k] };
const { reglasParaModalidad } = await import("../assets/js/ventana-actividad.js");

const datos = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const especies = datos.especies || datos;
const sargo = especies.find((e) => e.id === "sargo");
const defecto = datos.reglas_por_defecto;
const porModalidad = datos.reglas_por_modalidad;

test("sargo: la noche es neutra desde costa", () => {
  const r = reglasParaModalidad(defecto, sargo, "costa", porModalidad);
  assert.equal(r.luz.preferencia.noche, 0);
  assert.equal(r.luz.preferencia.alba, 1, "el resto de la luz no cambia");
});

test("sargo: desde embarcación la noche sigue restando", () => {
  const r = reglasParaModalidad(defecto, sargo, "embarcacion", porModalidad);
  assert.equal(r.luz.preferencia.noche, -0.6);
});

test("sin reglas_modalidad la especie queda igual que antes", () => {
  const sin = { ...sargo };
  delete sin.reglas_modalidad;
  const r = reglasParaModalidad(defecto, sin, "costa", porModalidad);
  assert.equal(r.luz.preferencia.noche, -0.6);
});
