// Vigía de páginas (2026-11-21): lo que decide si una página falla.
import { test } from "node:test";
import assert from "node:assert/strict";
import { urlsDeSitemap, problema, estadoPrevision, agrupar } from "../scripts/vigia/paginas.mjs";

test("sitemap: saca las URL", () => {
  assert.deepEqual(urlsDeSitemap("<url><loc>https://costaviva.org/</loc></url><url><loc>https://costaviva.org/a?x=1&amp;y=2</loc></url>"), ["https://costaviva.org/", "https://costaviva.org/a?x=1&y=2"]);
});

test("problema: 200 bien; 1102 es CPU; el resto, el código", () => {
  assert.equal(problema(200), null);
  assert.equal(problema(503, "error code: 1102"), "Cloudflare 1102 (CPU)");
  assert.equal(problema(500, "No se pudo cargar la previsión"), "HTTP 500");
  assert.equal(problema(301), "HTTP 301");
});

test("prevision: proporción en error y motivo sin la URL larga", () => {
  const e = estadoPrevision({ spots: [{ error: "Error: Open-Meteo (forecast) HTTP 429 (https://api.open-meteo.com/v1/forecast?x=1)" }, { slug: "a" }] });
  assert.equal(e.proporcion, 0.5);
  assert.equal(e.motivo, "Error: Open-Meteo (forecast) HTTP 429");
  assert.equal(estadoPrevision(null).proporcion, 1);
});

test("agrupar por tipo de página y problema", () => {
  const g = agrupar([
    { url: "https://costaviva.org/mareas/cadiz", problema: "HTTP 500" },
    { url: "https://costaviva.org/mareas/vigo", problema: "HTTP 500" },
    { url: "https://costaviva.org/en/spots/nz-a", problema: "Cloudflare 1102 (CPU)" },
  ]);
  assert.deepEqual(g, [["/mareas/… · HTTP 500", 2], ["/en/spots/… · Cloudflare 1102 (CPU)", 1]]);
});

test("el vigía se identifica como robot: ve la portada como Google (sin el 302 al login)", async () => {
  const { UA_VIGIA } = await import("../scripts/vigia/paginas.mjs");
  const { redireccionPortada } = await import("../functions/_lib/portada-sesion.js");
  const pedir = (ua) => ({ method: "GET", url: "https://costaviva.org/", headers: new Headers({ "user-agent": ua }) });
  assert.equal(redireccionPortada(pedir(UA_VIGIA)), null);
  assert.equal(redireccionPortada(pedir("costaviva-vigia-paginas")), "/login");
});
