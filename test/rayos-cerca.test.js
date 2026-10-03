// Rayos en tiempo real (functions/rayos-cerca.js, 2026-10-03): celda
// compartida, caché de 60 s, tope mensual de consultas pagadas y respaldo
// sin romper nada cuando falta configuración.
import { test } from "node:test";
import assert from "node:assert/strict";
import { celdaDe, rayosDesdeXweather, onRequestGet } from "../functions/rayos-cerca.js";

const ENV = { XWEATHER_CLIENT_ID: "id", XWEATHER_CLIENT_SECRET: "secreto", SUPABASE_SERVICE_ROLE_KEY: "sr" };
const pedir = (q, conSesion = true, env = ENV) =>
  onRequestGet({
    request: new Request(`https://costaviva.org/rayos-cerca?${q}`, {
      headers: conSesion ? { Authorization: "Bearer tok" } : {},
    }),
    env,
  });

// Simula Supabase y Xweather; devuelve la lista de URLs llamadas.
function simular({ cache = [], reservaOk = true, xweather }) {
  const llamadas = [];
  globalThis.fetch = async (url, opt = {}) => {
    llamadas.push({ url: String(url), metodo: opt.method || "GET", cuerpo: opt.body });
    if (url.includes("/auth/v1/user")) return new Response("{}", { status: 200 });
    if (url.includes("rayos_xweather_cache?celda=eq")) return new Response(JSON.stringify(cache));
    if (url.includes("reservar_consulta_rayos")) return new Response(JSON.stringify(reservaOk));
    if (url.includes("api.xweather.com")) return new Response(JSON.stringify(xweather));
    return new Response(null, { status: 201 });
  };
  return llamadas;
}

test("la celda es el centro del cuadro de 0,5° que contiene el punto", () => {
  assert.deepEqual(celdaDe(43.40, -2.70), { lat: "43.25", lon: "-2.75", clave: "43.25,-2.75" });
  assert.equal(celdaDe(43.49, -2.51).clave, celdaDe(43.01, -2.99).clave);
});

test("convierte la respuesta de Xweather y trata warn_no_data como cero rayos", () => {
  const r = rayosDesdeXweather({
    success: true,
    response: [{ loc: { lat: 43.3, long: -2.6 }, ob: { timestamp: 1, pulse: { type: "cg" } } }, { loc: null }],
  });
  assert.deepEqual(r, [{ lat: 43.3, lon: -2.6, ts: 1, tipo: "cg" }]);
  assert.deepEqual(rayosDesdeXweather({ success: false, error: { code: "warn_no_data" }, response: [] }), []);
  assert.throws(() => rayosDesdeXweather({ success: false, error: { code: "invalid_client" } }));
});

test("sin sesión no se consulta nada", async () => {
  const llamadas = simular({});
  const r = await pedir("lat=43.4&lon=-2.7", false);
  assert.equal(r.status, 401);
  assert.equal(llamadas.length, 0);
});

test("sin claves de Xweather responde no_configurado (el mapa sigue con EUMETSAT)", async () => {
  simular({});
  const r = await (await pedir("lat=43.4&lon=-2.7", true, {})).json();
  assert.equal(r.fuente, "no_configurado");
});

test("con caché de menos de 60 s no gasta una consulta", async () => {
  const llamadas = simular({ cache: [{ datos: [{ lat: 1, lon: 2 }], consultado_en: new Date().toISOString() }] });
  const r = await (await pedir("lat=43.4&lon=-2.7")).json();
  assert.equal(r.fuente, "xweather");
  assert.equal(r.rayos.length, 1);
  assert.ok(!llamadas.some((l) => l.url.includes("xweather.com") || l.url.includes("reservar")));
});

test("con el tope mensual agotado no llama a Xweather", async () => {
  const llamadas = simular({ reservaOk: false });
  const r = await (await pedir("lat=43.4&lon=-2.7")).json();
  assert.equal(r.fuente, "limite");
  assert.ok(!llamadas.some((l) => l.url.includes("xweather.com")));
});

test("consulta el centro de la celda, guarda en caché y nunca devuelve las claves", async () => {
  const llamadas = simular({
    xweather: { success: true, response: [{ loc: { lat: 43.3, long: -2.6 }, ob: { timestamp: 9, pulse: { type: "ic" } } }] },
  });
  const res = await pedir("lat=43.4&lon=-2.7");
  const texto = await res.text();
  const r = JSON.parse(texto);
  assert.equal(r.fuente, "xweather");
  assert.equal(r.rayos[0].tipo, "ic");
  assert.ok(llamadas.find((l) => l.url.includes("xweather.com")).url.includes("p=43.25,-2.75&radius=100km"));
  assert.ok(llamadas.some((l) => l.metodo === "POST" && l.url.includes("rayos_xweather_cache")));
  assert.ok(!texto.includes("secreto"));
});

test("si Xweather falla responde 'error' sin romper", async () => {
  simular({ xweather: { success: false, error: { code: "invalid_client" } } });
  const r = await (await pedir("lat=43.4&lon=-2.7")).json();
  assert.equal(r.fuente, "error");
});
