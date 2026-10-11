// Cambios de plan y checkout sin prueba (decisiones de Mikel, 2026-10-11). Sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clasificarCambio, planDestino, paramsPreviewSubida, paramsSubida, paramsBajada, resumenPreview, cambioProgramado,
} from "../functions/_lib/cambio-plan.js";

const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("checkout sin trial: se cobra hoy y el periodo empieza hoy", () => {
  const c = leer("functions/crear-checkout-stripe.js");
  assert.doesNotMatch(c, /trial_period_days/);
  assert.doesNotMatch(c, /diasDePruebaRestantes/);
  // Los meses de amigos pendientes se abonan como saldo al pagar.
  assert.match(leer("functions/stripe-webhook.js"), /abonarMesesPendientes\(/);
});

test("clasificar: subidas, bajadas, mixtos e igual", () => {
  const mR = { periodo: "mensual", ambito: "regional" };
  const aR = { periodo: "anual", ambito: "regional" };
  const mM = { periodo: "mensual", ambito: "mundial" };
  const aM = { periodo: "anual", ambito: "mundial" };
  assert.equal(clasificarCambio(mR, { ambito: "regional", plan: "anual" }).tipo, "subida");
  assert.equal(clasificarCambio(mR, { ambito: "mundial", plan: "mensual" }).tipo, "subida");
  assert.equal(clasificarCambio(mR, { ambito: "mundial", plan: "anual" }).tipo, "subida");
  assert.equal(clasificarCambio(aR, { ambito: "mundial", plan: "fundador_anual" }).tipo, "subida");
  assert.equal(clasificarCambio(aR, { ambito: "regional", plan: "mensual" }).tipo, "bajada");
  assert.equal(clasificarCambio(aM, { ambito: "regional", plan: "anual" }).tipo, "bajada");
  const mixto = clasificarCambio(aR, { ambito: "mundial", plan: "mensual" });
  assert.deepEqual(mixto, { tipo: "bajada", mixto: true });
  assert.equal(clasificarCambio(mM, { ambito: "mundial", plan: "mensual" }).tipo, "igual");
});

test("fundador: conserva el precio de fundador al pasar a otro anual", () => {
  assert.equal(planDestino({ fundador: true }, { ambito: "mundial", plan: "anual" }), "fundador_anual");
  assert.equal(planDestino({ fundador: true }, { ambito: "regional", plan: "mensual" }), "mensual");
  assert.equal(planDestino({ fundador: false }, { ambito: "mundial", plan: "anual" }), "anual");
});

test("subida: periodo nuevo desde ahora, prorrateo cobrado al momento y falla si no se cobra", () => {
  const p = paramsSubida({ itemId: "si_1", priceId: "price_n", metadata: { ambito: "mundial" }, ahora: 1_800_000_000_000 });
  assert.equal(p.billing_cycle_anchor, "now");
  assert.equal(p.proration_behavior, "always_invoice");
  assert.equal(p.payment_behavior, "error_if_incomplete");
  assert.equal(p["items[0][id]"], "si_1");
  assert.equal(p["items[0][price]"], "price_n");
  assert.equal(p["metadata[ambito]"], "mundial");
  const v = paramsPreviewSubida({ customer: "cus_1", subscription: "sub_1", itemId: "si_1", priceId: "price_n" });
  assert.equal(v["subscription_details[billing_cycle_anchor]"], "now");
  assert.equal(v["subscription_details[proration_behavior]"], "always_invoice");
});

test("bajada: programada al final del periodo pagado, sin prorrateo", () => {
  const p = paramsBajada({ precioActual: "price_a", priceId: "price_m", inicioFase: 100, finPeriodo: 500, moneda: "eur", metadata: { plan: "mensual" } });
  assert.equal(p["phases[0][items][0][price]"], "price_a");
  assert.equal(p["phases[0][end_date]"], "500");
  assert.equal(p["phases[0][proration_behavior]"], "none");
  assert.equal(p["phases[1][items][0][price]"], "price_m");
  assert.equal(p["phases[1][proration_behavior]"], "none");
  assert.equal(p.end_behavior, "release");
  assert.equal(p["phases[1][metadata][plan]"], "mensual");
});

test("bajada programada: se ve, se anula y se aplica al renovar", () => {
  const ahora = 1_800_000_000_000;
  const fin = ahora / 1000 + 86400 * 30;
  const schedule = {
    id: "sub_sched_1", status: "active",
    phases: [{ start_date: ahora / 1000 - 1000, end_date: fin }, { start_date: fin, metadata: { plan: "mensual", ambito: "regional" } }],
  };
  // Programada: "Tu plan cambiará a ... el ...".
  const prog = cambioProgramado(schedule, ahora);
  assert.equal(prog.plan, "mensual");
  assert.equal(prog.fecha, new Date(fin * 1000).toISOString());
  assert.equal(prog.schedule, "sub_sched_1");
  // Anulada (schedule liberado): ya no hay cambio programado.
  assert.equal(cambioProgramado({ ...schedule, status: "released" }, ahora), null);
  // Al renovar (pasada la fecha) la fase nueva ya está en curso: nada pendiente.
  assert.equal(cambioProgramado(schedule, (fin + 60) * 1000), null);
  assert.equal(cambioProgramado(null, ahora), null);
  const ep = leer("functions/cambiar-plan.js");
  assert.match(ep, /\/release`/);
  assert.match(ep, /paramsBajada\(/);
  assert.match(ep, /cambioProgramado\(/);
});

test("preview: lo que se paga hoy y lo descontado", () => {
  const r = resumenPreview({ amount_due: 2650, currency: "eur", lines: { data: [{ amount: -399 + 50 }, { amount: 2999 }] } });
  assert.deepEqual(r, { pagar_hoy: 2650, descontado: 349, moneda: "EUR" });
});

test("portal sin cambio de plan; la página lo hace con /cambiar-plan", () => {
  assert.match(leer("scripts/stripe/crear-precios.mjs"), /subscription_update: \{ enabled: false \}/);
  const html = leer("suscripcion.html");
  assert.match(html, /fetch\("\/cambiar-plan"/);
  assert.match(html, /cambio\.programado/);
  assert.match(html, /<input type="checkbox" id="checkCambio" \/>/);
  assert.match(html, /<button type="button" id="btnConfirmarCambio" disabled/);
});

test("términos: sin devoluciones salvo compensación al subir, en es, en y pt", () => {
  const t = leer("terminos.html");
  assert.match(t, /No hay devoluciones sobre lo ya comprado\. Solo se compensa la parte no disfrutada cuando se sube de plan\./);
  assert.match(t, /There are no refunds on what you have already bought\. The unused part is only credited when you upgrade\./);
  assert.match(t, /Não há devoluções sobre o que já foi comprado\. Só se compensa a parte não usufruída quando se sobe de plano\./);
  assert.match(t, /Al suscribirte, la prueba gratis termina en ese momento/);
  assert.match(t, /aunque falten meses/);
  for (const dic of ["es", "en", "pt"]) assert.doesNotMatch(leer(`assets/i18n/${dic}.js`), /no pierdes días|don't lose any days|não perde dias/);
});
