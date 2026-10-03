// Estaciones AEMET con reintento y respaldo (functions/prevision.js,
// 2026-10-03): AEMET OpenData daba 503 y la capa salía vacía 30 min.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { estacionesAemetConRespaldo } from "../functions/prevision.js";

const guardado = new Map();
globalThis.caches = {
  default: {
    put: async (k, r) => guardado.set(String(k), await r.text()),
    match: async (k) => (guardado.has(String(k)) ? new Response(guardado.get(String(k))) : undefined),
  },
};
const LECTURAS = [{ idema: "1082", fint: "2026-10-03T15:00:00", pres: 1010, prec: 0, ta: 18 }];
let modo;
globalThis.fetch = async (url) => {
  if (modo === "caido") return new Response("", { status: 503 });
  if (String(url).includes("/todas")) return new Response(JSON.stringify({ datos: "https://x/datos", estado: 200 }));
  return new Response(JSON.stringify(LECTURAS));
};
const sinEspera = globalThis.setTimeout;
beforeEach(() => { globalThis.setTimeout = (f) => sinEspera(f, 0); });

test("AEMET caído y sin lecturas guardadas: error (la app avisa)", async () => {
  guardado.clear();
  modo = "caido";
  const r = await estacionesAemetConRespaldo("clave");
  assert.match(r.error, /503/);
});

test("AEMET bien: devuelve las lecturas y las guarda de respaldo", async () => {
  guardado.clear();
  modo = "bien";
  const r = await estacionesAemetConRespaldo("clave");
  assert.equal(r["1082"].pres, 1010);
  assert.equal(guardado.size, 1);
});

test("AEMET caído después: sirve las últimas lecturas reales, marcadas como respaldo", async () => {
  modo = "caido";
  const r = await estacionesAemetConRespaldo("clave");
  assert.equal(r["1082"].pres, 1010);
  assert.equal(r["1082"].actualizado, "2026-10-03T15:00:00");
  assert.match(r._respaldo, /AEMET no responde/);
  assert.equal(r.error, undefined);
});
