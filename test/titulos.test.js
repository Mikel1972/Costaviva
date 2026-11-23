// Títulos para buscadores sin « | Costaviva» (2026-11-23, aviso de Bing
// «Title too long»). Solo el <title>; og:title conserva la marca.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tituloBuscador, documento } from "../functions/_lib/seo/base.js";

test("tituloBuscador quita la marca del final y nada más", () => {
  assert.equal(tituloBuscador("Pesca de besugo: dónde y cuándo | Costaviva"), "Pesca de besugo: dónde y cuándo");
  assert.equal(tituloBuscador("Costaviva para clubes"), "Costaviva para clubes");
  assert.equal(tituloBuscador("| Costaviva"), "| Costaviva");
  assert.equal(tituloBuscador("Mareas | Costaviva en Bakio"), "Mareas | Costaviva en Bakio");
});

test("documento(): <title> sin marca, og:title con marca", () => {
  const html = documento({ titulo: "Pesca en Bakio hoy | Costaviva", descripcion: "x", ruta: "/spots/bakio", cuerpo: "" });
  assert.match(html, /<title>Pesca en Bakio hoy<\/title>/);
  assert.match(html, /og:title" content="Pesca en Bakio hoy \| Costaviva"/);
});
