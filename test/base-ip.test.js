// Base por IP (2026-11-25): /ubicacion-aproximada y la propuesta del mapa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ubicacionDeCf, onRequestGet } from "../functions/ubicacion-aproximada.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

test("ubicacionDeCf: solo ciudad, región, país y coordenadas de Cloudflare", () => {
  assert.deepEqual(ubicacionDeCf({ latitude: "43.2627", longitude: "-2.9253", city: "Bilbao", region: "Basque Country", country: "ES", asn: 3352, clientTcpRtt: 9 }),
    { lat: 43.2627, lon: -2.9253, ciudad: "Bilbao", region: "Basque Country", pais: "ES" });
  assert.equal(ubicacionDeCf({ city: "Bilbao" }), null);
  assert.equal(ubicacionDeCf(undefined), null);
  assert.equal(ubicacionDeCf({ latitude: "1", longitude: "2", city: " " }).ciudad, null);
});

test("/ubicacion-aproximada: sin caché, 404 sin datos y ruta pública", async () => {
  const r = onRequestGet({ request: { cf: { latitude: "-37.68", longitude: "176.17", city: "Tauranga", country: "NZ" } } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal((await r.json()).ciudad, "Tauranga");
  assert.equal(onRequestGet({ request: {} }).status, 404);
  assert.equal(esRutaPermitida("/ubicacion-aproximada"), true);
});

test("migración de la base: columnas, checks y permiso solo en esas columnas", () => {
  const sql = leer("supabase/migrations/20261125180000_perfiles_base.sql");
  for (const c of ["base_lat", "base_lon", "base_nombre", "base_origen", "base_fijada_en"]) assert.match(sql, new RegExp(`add column if not exists ${c}`));
  assert.match(sql, /grant update \(base_lat, base_lon, base_nombre, base_origen, base_fijada_en\) on public\.perfiles to authenticated/);
  assert.doesNotMatch(sql, /create policy|disable row level security|grant (all|update) on/i);
});

test("index.html: la base manda sobre el código postal y se pregunta sin ninguno de los dos", () => {
  const html = leer("index.html");
  assert.match(html, /select\("codigo_postal, base_lat, base_lon"\)/);
  assert.match(html, /if \(!perfil\.codigo_postal\) \{\s*proponerBase\(\);/);
  assert.match(html, /id="propuestaBase"/);
  for (const k of ["mapa.base.pregunta", "mapa.base.si", "mapa.base.otra", "mapa.base.no", "mapa.base.toca", "mapa.base.guardada", "mapa.base.error"]) {
    for (const l of ["es", "en", "pt"]) assert.ok(leer(`assets/i18n/${l}.js`).includes(`"${k}"`), `${k} en ${l}`);
  }
});

test("base: zonas de interior no se proponen (Madrid); menú «Que el mapa empiece aquí» (2026-11-26)", () => {
  const html = leer("index.html");
  assert.match(html, /if \(!baseCercaDeLaCosta\(u\.lat, u\.lon\)\) \{ mostrarPropuestaBase\(null, null\); return; \}/);
  assert.match(html, /const BASE_MAX_KM_SPOT = 40;/);
  assert.match(html, /caja\.querySelector\("#baseSi"\)\.hidden = !u;/);
  assert.match(html, /id="btnFijarInicio"/);
  assert.match(html, /getElementById\("btnFijarInicio"\)\.addEventListener\("click", async \(\) => \{\s*const c = map\.getCenter\(\);/);
  for (const k of ["comun.menu.fijar_inicio", "mapa.base.pregunta_elegir", "mapa.base.inicio_guardado"]) {
    for (const l of ["es", "en", "pt"]) assert.ok(leer(`assets/i18n/${l}.js`).includes(`"${k}"`), `${k} en ${l}`);
  }
});
