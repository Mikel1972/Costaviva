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

test("acortarTitulo: máximo 70 caracteres recortando solo la cola (Bing, 2026-11-26)", async () => {
  const { acortarTitulo, TITULO_MAX } = await import("../functions/_lib/seo/base.js");
  assert.equal(TITULO_MAX, 70);
  const corto = "Pesca en Bakio hoy: qué se pesca, temporada, fondo y condiciones";
  assert.equal(acortarTitulo(corto), corto);
  assert.equal(acortarTitulo("Pesca en San Vicente de la Barquera hoy: qué se pesca, temporada, fondo y condiciones"), "Pesca en San Vicente de la Barquera hoy: qué se pesca, temporada");
  assert.equal(acortarTitulo("Fishing at Whangapoua Beach, Okiwi (Aotea / Great Barrier Island), NZ: species, season, tides and today's conditions"), "Fishing at Whangapoua Beach, Okiwi (Aotea / Great Barrier Island), NZ");
  assert.equal(acortarTitulo("Mareas hoy en Whangapoua Beach, Okiwi (Aotea / Great Barrier Island) (Nueva Zelanda): pleamar, bajamar y olas"), "Mareas hoy en Whangapoua Beach, Okiwi (Aotea / Great Barrier Island)");
  const largo = acortarTitulo("Un nombre larguísimo sin dos puntos ni paréntesis que no cabe de ninguna manera en setenta letras");
  assert.ok(largo.length <= 70 && !/\s$/.test(largo));
  assert.equal(tituloBuscador("Pesca en San Vicente de la Barquera hoy: qué se pesca, temporada, fondo y condiciones | Costaviva").length <= 70, true);
});

test("Aprende: títulos con sentido para normas, apnea, fondeo y material de submarina", async () => {
  const { SUFIJO_TEMA } = await import("../functions/_lib/seo/paginas-formacion.js");
  for (const l of ["es", "en", "pt"]) for (const tema of ["normas-submarina", "apnea-segura", "boya-seguridad", "fondeo-deriva", "traje-plomos-aletas", "fusil-varilla-punta"]) assert.ok(SUFIJO_TEMA[l][tema], `${l} ${tema}`);
  assert.doesNotMatch(SUFIJO_TEMA.en["normas-submarina"], /which to use/);
});
