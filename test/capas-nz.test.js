// Capas del mar de Nueva Zelanda (fase 2 de NZ, 2026-10-09): el job
// capas_nz de fuentes-gratuitas.yml corre cada día con su cron propio (NZ
// activa desde el 2026-10-11) y a mano, nunca con "todo"; el mapa pide
// capas/nz/ al mirar NZ. El cálculo se prueba en test/capas_nz_test.py.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wf = readFileSync(".github/workflows/fuentes-gratuitas.yml", "utf8");
const job = wf.slice(wf.indexOf("\n  capas_nz:"), wf.indexOf("\n  comparativa:"));

test("capas_nz: cron diario propio y a mano, nunca con todo, respeta AUTOMATION_PAUSED", () => {
  // NZ activa desde el 2026-10-11 (PR #176): sin cron las capas caducaban.
  assert.ok(job.length > 100, "falta el job capas_nz");
  assert.match(job, /vars\.AUTOMATION_PAUSED != 'true'/);
  assert.match(job, /github\.event_name == 'workflow_dispatch' && inputs\.parte == 'capas_nz'/);
  assert.match(job, /github\.event\.schedule == '53 16 \* \* \*'/);
  assert.match(wf, /- cron: "53 16 \* \* \*"/);
  assert.doesNotMatch(job, /'todo'/);
  assert.match(job, /descargar-capas\.py --region nz --salida \/tmp\/capas-nz/);
  assert.match(job, /subir-storage\.mjs \/tmp\/capas-nz/);
});

test("mapa: capas/nz/ cuando se mira Nueva Zelanda, las de siempre en el resto", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /const prefijoCapasMarDe = \(region\) => \(region === "nz" \? "nz\/" : ""\);/);
  assert.match(html, /fetch\(URL_CAPAS_MAR_BASE \+ prefijo \+ nombre \+ "\.json"/);
  // Al pasar de una región a otra con capas encendidas, se piden las nuevas.
  assert.match(html, /map\.on\("moveend", cambioRegionCapasMar\)/);
});
