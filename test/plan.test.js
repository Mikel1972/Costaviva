// Plan de la cuenta en la app (2026-10-11): qué es Premium por región,
// avisos de fin de prueba y cosas del checkout. Sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { premiumEn, avisoPremium, avisoFinPrueba } from "../assets/js/plan.js";
import { leerPlan, diasDePruebaRestantes, DIAS_PRUEBA } from "../functions/_lib/precios.js";

const config = JSON.parse(readFileSync(new URL("../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));
const migracion = readFileSync(new URL("../supabase/migrations/20261011230000_cobro_prueba_14_dias_plan_gratis.sql", import.meta.url), "utf8");

test("prueba y Mundial: Premium en todas las regiones", () => {
  const prueba = { premium: true, ambito: "mundial", en_prueba: true };
  assert.equal(premiumEn(prueba, "es"), true);
  assert.equal(premiumEn(prueba, "nz"), true);
  assert.equal(avisoPremium(prueba, "nz"), null);
});

test("regional: Premium solo en su región; fuera, aviso del plan Mundial", () => {
  const nz = { premium: true, ambito: "regional", region_contenido: "nz" };
  assert.equal(premiumEn(nz, "nz"), true);
  assert.equal(premiumEn(nz, "es"), false);
  assert.equal(avisoPremium(nz, "es"), "mundial");
  // Suscripción antigua sin región: España.
  assert.equal(premiumEn({ premium: true, ambito: "regional", region_contenido: null }, "es"), true);
});

test("plan gratuito: aviso de Premium; sin estado (red), se deja ver", () => {
  assert.equal(avisoPremium({ premium: false, con_acceso: false }, "es"), "premium");
  assert.equal(premiumEn(null, "es"), true);
  // Estado antiguo (solo con_acceso) también vale.
  assert.equal(premiumEn({ con_acceso: true }, "nz"), true);
});

test("aviso de fin de prueba: 3 días antes y el último día", () => {
  const ahora = new Date("2026-10-11T10:00:00Z");
  const fin = (h) => ({ en_prueba: true, prueba_termina_en: new Date(ahora.getTime() + h * 3600000).toISOString() });
  assert.equal(avisoFinPrueba(fin(100), ahora), null);
  assert.equal(avisoFinPrueba(fin(72), ahora).tipo, "tres_dias");
  assert.equal(avisoFinPrueba(fin(30), ahora).tipo, "tres_dias");
  assert.equal(avisoFinPrueba(fin(20), ahora).tipo, "ultimo_dia");
  assert.equal(avisoFinPrueba(fin(-1), ahora), null);
  assert.equal(avisoFinPrueba({ ...fin(20), en_prueba: false }, ahora), null);
});

test("checkout: planes admitidos (y los antiguos monthly/annual)", () => {
  assert.deepEqual(leerPlan({ plan: "monthly" }), { ambito: "regional", plan: "mensual" });
  assert.deepEqual(leerPlan({ plan: "annual" }), { ambito: "regional", plan: "anual" });
  assert.deepEqual(leerPlan({ ambito: "mundial", plan: "fundador_anual" }), { ambito: "mundial", plan: "fundador_anual" });
  assert.equal(leerPlan({ ambito: "galaxia", plan: "mensual" }), null);
  assert.equal(leerPlan({ plan: "price_123" }), null);
});

test("checkout: días de prueba que quedan (14 desde el alta)", () => {
  const ahora = Date.parse("2026-10-11T12:00:00Z");
  assert.equal(DIAS_PRUEBA, 14);
  assert.equal(diasDePruebaRestantes("2026-10-11T12:00:00Z", ahora), 14);
  assert.equal(diasDePruebaRestantes("2026-10-01T12:00:00Z", ahora), 4);
  assert.equal(diasDePruebaRestantes("2026-09-01T12:00:00Z", ahora), 0);
  assert.equal(diasDePruebaRestantes("no es fecha", ahora), 0);
});

test("SQL y config dicen lo mismo: 14 días y 500 plazas de fundador", () => {
  assert.match(migracion, /v_creado_en \+ interval '14 days'/);
  assert.match(migracion, new RegExp(`greatest\\(0, ${config.plazas_fundador} - count\\(\\*\\)\\)`));
  assert.doesNotMatch(migracion, /\bbegin;|\bcommit;/i);
});

test("ninguna página enseña un price_ de Stripe (los precios se resuelven en el servidor)", () => {
  for (const f of ["suscripcion.html", "index.html", "terminos.html"]) {
    assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /price_[A-Za-z0-9]{8,}/, f);
  }
});
