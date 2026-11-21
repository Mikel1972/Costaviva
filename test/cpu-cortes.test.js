// Cortes por CPU de Cloudflare (error 1102) y excepciones de /mareas
// (2026-11-21): lecturas compartidas, memos y páginas que no rompen sin datos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerInstantanea, vaciarMemoriaInstantaneas } from "../functions/_lib/instantaneas.js";
import { cargarJson, vaciarMemoJson, huella } from "../functions/_lib/seo/base.js";
import { renderizarPagina } from "../functions/mareas/[slug].js";
import { TTL_PREVISION_CON_ERROR_S } from "../functions/prevision.js";

test("leerInstantanea: tres lecturas a la vez = una descarga y un parse", async () => {
  vaciarMemoriaInstantaneas();
  let bajadas = 0;
  const fetchImpl = async () => { bajadas++; await new Promise((r) => setTimeout(r, 5)); return new Response(JSON.stringify({ generado_en: new Date().toISOString(), x: 1 })); };
  const r = await Promise.all([1, 2, 3].map(() => leerInstantanea("mar/spots.json", { fetchImpl })));
  assert.equal(bajadas, 1);
  assert.deepEqual(r.map((d) => d.x), [1, 1, 1]);
  assert.strictEqual(r[0], r[2]);
  // Un fallo no se queda pegado: la siguiente lectura vuelve a intentarlo.
  vaciarMemoriaInstantaneas();
  let n = 0;
  const falla = async () => { n++; if (n === 1) return new Response("x", { status: 500 }); return new Response(JSON.stringify({ generado_en: new Date().toISOString() })); };
  await assert.rejects(leerInstantanea("a.json", { fetchImpl: falla }));
  assert.ok(await leerInstantanea("a.json", { fetchImpl: falla }));
  vaciarMemoriaInstantaneas();
});

test("cargarJson: con ASSETS, una sola lectura por fichero y por isolate", async () => {
  vaciarMemoJson();
  let lecturas = 0;
  const context = { request: new Request("https://costaviva.org/x"), env: { ASSETS: { fetch: async () => { lecturas++; return new Response('{"especies":[1]}'); } } } };
  const a = await cargarJson(context, "/assets/datos/especies.json");
  const b = await cargarJson(context, "/assets/datos/especies.json");
  assert.equal(lecturas, 1);
  assert.strictEqual(a, b);
  vaciarMemoJson();
});

test("huella: estable, distinta si cambian los datos, y memorizada por objeto", () => {
  const d = { fichas: [1] };
  assert.equal(huella([d, "css"]), huella([d, "css"]));
  assert.notEqual(huella([{ fichas: [1] }, "css"]), huella([{ fichas: [1, 2] }, "css"]));
  assert.notEqual(huella([d, "css"]), huella([d, "css2"]));
});

test("mareas: un spot en error (sin bloques ni marea) da página, no excepción", () => {
  const html = renderizarPagina({ slug: "cadiz", nombre: "Cádiz", lat: 36.5, lon: -6.3, error: "Open-Meteo 429", bloques: [], marea: null }, []);
  assert.match(html, /Tabla de mareas de Cádiz/);
  assert.match(html, /sin dato ahora mismo/);
  assert.doesNotThrow(() => renderizarPagina({ slug: "cadiz", nombre: "Cádiz", error: "x" }, []));
});

test("prevision en error: se guarda poco, no media hora ni nada", () => {
  assert.equal(TTL_PREVISION_CON_ERROR_S, 900);
});

test("assets de NZ: una lectura por isolate; un fallo no se memoriza", async () => {
  const { leerAssetJson, vaciarMemoAssets } = await import("../functions/_lib/assets-memo.js");
  vaciarMemoAssets();
  let n = 0;
  const env = { ASSETS: { fetch: async () => { n++; return n === 1 ? new Response("x", { status: 500 }) : new Response('{"ok":1}'); } } };
  assert.equal(await leerAssetJson(env, "https://costaviva.org/datos/nz/linz-puertos.json"), null);
  const a = await leerAssetJson(env, "https://costaviva.org/datos/nz/linz-puertos.json");
  const b = await leerAssetJson(env, "https://costaviva.org/datos/nz/linz-puertos.json");
  assert.deepEqual(a, { ok: 1 });
  assert.strictEqual(a, b);
  assert.equal(n, 2);
  assert.equal(await leerAssetJson({}, "https://costaviva.org/x.json"), null);
  vaciarMemoAssets();
});
