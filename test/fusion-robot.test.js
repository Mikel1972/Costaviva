// Fusión automática de las PR del robot de SEO (Mikel, 2026-10-11): lista
// blanca por tipo de rama, lista negra que gana siempre, límite semanal y
// checks. Lógica pura: scripts/seo/fusion-automatica.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { tipoRama, clasificar, cabeEnSemana, estadoChecks, MAX_PALABRAS_SEMANA } from "../scripts/seo/fusion-automatica.mjs";

test("tipo de rama: solo palabras y etiquetas de olas", () => {
  assert.equal(tipoRama("robot/palabras-2026-10-14-marea-bakio"), "palabras");
  assert.equal(tipoRama("robot/etiquetas-olas-2026-10-14"), "etiquetasOlas");
  for (const r of ["robot/diseno-2026-10-14-cta", "robot/especies-2026-10-14", "robot/aprendizaje-2026-10-14", "main", "claude/palabras-x"]) assert.equal(tipoRama(r), null, r);
});

test("palabras: páginas públicas, metadatos, datos-robots y seo se fusionan", () => {
  const ok = [
    "functions/mareas/[slug].js", "functions/mareas/region/[region].js", "functions/mareas/_regiones.js", "functions/spots/index.js",
    "functions/especies/[slug].js", "functions/en/tides/[slug].js", "functions/tecnicas/jigging.js",
    "functions/_lib/seo/paginas.js", "functions/_lib/seo/paginas-en.js", "functions/_lib/seo/datos.js", "functions/_lib/seo/sitemap.js",
    "sitemap.xml", "robots.txt", "datos-robots/seo/palabras-es.json", "seo/palabras/costaviva-cambios.json",
  ];
  assert.deepEqual(clasificar("palabras", ok), { ok: true, fuera: [] });
});

test("palabras: cualquier fichero fuera de la lista deja la PR abierta", () => {
  const casos = [
    ".github/workflows/robot-diseno-pr.yml", "supabase/migrations/20261012000000_x.sql", "functions/_middleware.js",
    "functions/_lib/rutas-publicas.js", "functions/_lib/email.js", "functions/_lib/seo/indexnow.js",
    "functions/crear-checkout-stripe.js", "functions/stripe-webhook.js", "functions/mareas/login.js", "functions/spots/suscripcion.js",
    "functions/_lib/referidos.js", "login.html", "index.html", "suscripcion.html", "assets/js/common.js", "test/seo-paginas.test.js",
    "datos-robots/../functions/_middleware.js", "package.json",
  ];
  for (const f of casos) {
    const c = clasificar("palabras", ["functions/mareas/[slug].js", f]);
    assert.equal(c.ok, false, f);
    assert.deepEqual(c.fuera, [f], f);
  }
});

test("etiquetas de olas: solo datos-robots/oleaje-camaras", () => {
  assert.equal(clasificar("etiquetasOlas", ["datos-robots/oleaje-camaras/etiquetas-claude.jsonl", "datos-robots/oleaje-camaras/calibracion.json"]).ok, true);
  for (const f of ["datos-robots/seo/palabras-es.json", "scripts/oleaje-camaras/medir-espuma.mjs", "functions/_lib/oleaje-camaras.js", "sitemap.xml"]) {
    assert.equal(clasificar("etiquetasOlas", ["datos-robots/oleaje-camaras/calibracion.json", f]).ok, false, f);
  }
});

test("sin ficheros o rama sin tipo: no se fusiona", () => {
  assert.equal(clasificar("palabras", []).ok, false);
  assert.equal(clasificar(null, ["sitemap.xml"]).ok, false);
});

test("como mucho 3 fusiones automáticas de palabras por semana", () => {
  const ahora = new Date("2026-10-20T12:00:00Z");
  const f = (d, rama = "robot/palabras-x") => ({ headRefName: rama, mergedAt: d });
  assert.equal(MAX_PALABRAS_SEMANA, 3);
  assert.equal(cabeEnSemana([f("2026-10-19T00:00:00Z"), f("2026-10-18T00:00:00Z")], ahora).cabe, true);
  assert.equal(cabeEnSemana([f("2026-10-19T00:00:00Z"), f("2026-10-18T00:00:00Z"), f("2026-10-15T00:00:00Z")], ahora).cabe, false);
  // Las de hace más de 7 días y las de etiquetas de olas no cuentan.
  assert.equal(cabeEnSemana([f("2026-10-19T00:00:00Z"), f("2026-10-18T00:00:00Z"), f("2026-10-10T00:00:00Z"), f("2026-10-19T00:00:00Z", "robot/etiquetas-olas-x")], ahora).cabe, true);
});

test("checks: verde solo si todos acaban bien; el propio run no cuenta", () => {
  const ok = { name: "test", status: "completed", conclusion: "success", runId: "1" };
  assert.equal(estadoChecks([ok, { name: "Cloudflare Pages", status: "completed", conclusion: "neutral" }], []), "verde");
  assert.equal(estadoChecks([ok, { name: "x", status: "completed", conclusion: "failure" }], []), "rojo");
  assert.equal(estadoChecks([ok, { name: "x", status: "in_progress", conclusion: null }], []), "esperando");
  assert.equal(estadoChecks([ok], [{ context: "cf", state: "pending" }]), "esperando");
  assert.equal(estadoChecks([ok], [{ context: "cf", state: "failure" }]), "rojo");
  assert.equal(estadoChecks([ok, { name: "fusionar", status: "in_progress", runId: "99" }], [], "99"), "verde");
  assert.equal(estadoChecks([], []), "esperando");
});

test("workflow: tras los tests, solo esas ramas, código de main", () => {
  const yml = readFileSync(new URL("../.github/workflows/fusion-robot-seo.yml", import.meta.url), "utf8");
  assert.match(yml, /workflows: \["Tests"\]/);
  assert.match(yml, /"robot\/palabras-\*\*"/);
  assert.match(yml, /"robot\/etiquetas-olas-\*\*"/);
  assert.match(yml, /ref: main/);
  assert.match(yml, /RAMA: \$\{\{ github\.event\.workflow_run\.head_branch/);
  assert.doesNotMatch(yml, /ANTHROPIC_API_KEY|claude -p/);
  const tests = readFileSync(new URL("../.github/workflows/tests.yml", import.meta.url), "utf8");
  assert.match(tests, /^name: Tests$/m);
});
