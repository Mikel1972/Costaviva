// Capas del mar de Nueva Zelanda (fase 2 de NZ, 2026-10-09): el job
// capas_nz de fuentes-gratuitas.yml solo corre a mano (nunca con el cron ni
// con "todo") mientras NZ esté oculta, y el mapa solo pide capas/nz/ en la
// vista previa (/?region=nz). El cálculo se prueba en test/capas_nz_test.py.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wf = readFileSync(".github/workflows/fuentes-gratuitas.yml", "utf8");
const job = wf.slice(wf.indexOf("\n  capas_nz:"), wf.indexOf("\n  comparativa:"));

test("capas_nz: solo a mano, respeta AUTOMATION_PAUSED y escribe capas/nz", () => {
  assert.ok(job.length > 100, "falta el job capas_nz");
  assert.match(job, /vars\.AUTOMATION_PAUSED != 'true'/);
  assert.match(job, /github\.event_name == 'workflow_dispatch' && inputs\.parte == 'capas_nz'/);
  assert.doesNotMatch(job, /schedule|'todo'/);
  assert.match(job, /descargar-capas\.py --region nz --salida \/tmp\/capas-nz/);
  assert.match(job, /subir-storage\.mjs \/tmp\/capas-nz/);
});

test("mapa: capas/nz/ solo con ?region=nz", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /\/fuentes-gratuitas\/capas\/" \+\n  \(\/\[\?&\]region=nz\(&\|\$\)\/i\.test\(window\.location\.search\) \? "nz\/" : ""\);/);
});
