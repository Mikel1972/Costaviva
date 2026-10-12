// Guardas de migraciones (incidente del 2026-10-11: se aplicaron dos
// migraciones sin el sí de Mikel). Lógica pura: .github/scripts/migraciones.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as M from "../.github/scripts/migraciones.mjs";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

const APROBADA = "20261011230000_cobro_prueba_14_dias_plan_gratis.sql";
const VETO = "20261011200000_programador_publicar_veto.sql";
const VISITAS = "20261011220000_visitas_en.sql";
const VIEJA = "20261011180000_programador_espuma_nz.sql";

test("guardia: una PR sin migraciones pasa sin etiqueta", () => {
  const d = M.decidirGuardia({ ficheros: ["CLAUDE.md", ".github/workflows/tests.yml"], etiquetas: [] });
  assert.equal(d.ok, true);
  assert.deepEqual(d.tocadas, []);
});

test("guardia: una PR con migración y sin sql-aprobado falla", () => {
  const d = M.decidirGuardia({ ficheros: ["index.html", `supabase/migrations/${VETO}`], etiquetas: ["marketing"] });
  assert.equal(d.ok, false);
  assert.deepEqual(d.tocadas, [`supabase/migrations/${VETO}`]);
  assert.match(d.mensaje, /sql-aprobado/);
});

test("guardia: con la etiqueta sql-aprobado pasa", () => {
  const d = M.decidirGuardia({ ficheros: [`supabase/migrations/${APROBADA}`], etiquetas: ["sql-aprobado"] });
  assert.equal(d.ok, true);
});

test("guardia: fuera de supabase/migrations/ no cuenta (schema.sql, sql sueltos)", () => {
  const d = M.decidirGuardia({ ficheros: ["supabase/schema.sql", "supabase/baseline-seguridad.json"], etiquetas: [] });
  assert.equal(d.ok, true);
});

test("versión: lo que va antes del primer guion bajo", () => {
  assert.equal(M.version(APROBADA), "20261011230000");
  assert.equal(M.version("supabase/migrations/" + VETO), "20261011200000");
  assert.equal(M.version("README.md"), null);
});

test("aplicar: el caso real del 2026-10-11 falla sin tocar nada y lista las otras", () => {
  const d = M.decidirAplicar({
    migracion: APROBADA,
    enRepo: [VIEJA, VETO, VISITAS, APROBADA],
    aplicadas: ["20261011180000"],
  });
  assert.equal(d.ok, false);
  assert.deepEqual(d.pendientes, [VETO, VISITAS, APROBADA]);
  assert.match(d.mensaje, new RegExp(VETO));
  assert.match(d.mensaje, new RegExp(VISITAS));
  assert.match(d.mensaje, /No se ha tocado nada/);
});

test("aplicar: si solo está pendiente la aprobada, adelante", () => {
  const d = M.decidirAplicar({
    migracion: APROBADA,
    enRepo: [VIEJA, VETO, VISITAS, APROBADA],
    aplicadas: ["20261011180000", "20261011200000", "20261011220000", ""],
  });
  assert.equal(d.ok, true);
  assert.deepEqual(d.pendientes, [APROBADA]);
});

test("aplicar: también falla si la otra pendiente es más antigua que la aprobada", () => {
  const d = M.decidirAplicar({ migracion: APROBADA, enRepo: [VIEJA, APROBADA], aplicadas: [] });
  assert.equal(d.ok, false);
  assert.match(d.mensaje, new RegExp(VIEJA));
});

test("aplicar: sin nombre, con nombre inexistente o ya aplicada, no hace nada", () => {
  assert.equal(M.decidirAplicar({ migracion: "", enRepo: [APROBADA], aplicadas: [] }).ok, false);
  assert.equal(M.decidirAplicar({ migracion: "20261011230000", enRepo: [APROBADA], aplicadas: [] }).ok, false);
  const ya = M.decidirAplicar({ migracion: APROBADA, enRepo: [APROBADA], aplicadas: ["20261011230000"] });
  assert.equal(ya.ok, false);
  assert.match(ya.mensaje, /ya consta aplicada/);
});

test("workflows: el check se reevalúa al etiquetar y aplicar exige la migración", () => {
  const guardia = leer(".github/workflows/migraciones-aprobadas.yml");
  for (const t of ["opened", "synchronize", "labeled", "unlabeled"]) assert.match(guardia, new RegExp(`\\b${t}\\b`));
  assert.match(guardia, /^\s{2}migraciones-aprobadas:/m);

  const aplicar = leer(".github/workflows/aplicar-migraciones.yml");
  assert.match(aplicar, /migracion:\s*\n\s*description:[^\n]*\n\s*required: true/);
  // El filtro va ANTES del db push.
  const filtro = aplicar.indexOf("migraciones.mjs pendientes");
  const push = aplicar.indexOf("supabase db push");
  assert.ok(filtro > 0 && push > filtro, "el filtro tiene que ir antes de supabase db push");
});
