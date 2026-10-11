#!/usr/bin/env node
// scripts/stripe/probar-cambio-plan.mjs — sin IA, SOLO modo test.
// Lo lanza .github/workflows/probar-cambio-plan.yml. Comprueba contra Stripe
// (modo test, tarjeta de prueba pm_card_visa: ninguna tarjeta real) las
// reglas de cobro del 2026-10-11:
//   1. Checkout sin prueba: la sesión cobra hoy (amount_total > 0).
//   2. Suscripción mensual: primera factura cobrada hoy.
//   3. Subida a anual: periodo nuevo desde ahora, se descuenta lo no
//      disfrutado y se cobra la diferencia (mismos parámetros que la app).
//   4. Bajada programada a mensual al final del periodo; 5. anulación.
// Al acabar cancela la suscripción y borra el cliente de prueba.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ } from "../precios/fuentes.mjs";
import { paramsPreviewSubida, paramsSubida, paramsBajada, resumenPreview, cambioProgramado } from "../../functions/_lib/cambio-plan.js";

const clave = process.env.STRIPE_SECRET_KEY || "";
if (!/^(sk|rk)_test_/.test(clave)) { console.error("::error::Hace falta una clave de TEST (STRIPE_SECRET_KEY_TEST)."); process.exit(1); }
const ids = JSON.parse(readFileSync(join(RAIZ, "functions", "_lib", "stripe-ids.json"), "utf8")).test;
const version = JSON.parse(readFileSync(join(RAIZ, "functions", "_lib", "precios-zonas.json"), "utf8")).version_precios;
const precio = (k) => ids.precios[`cv_${k}_v${version}`];

async function stripe(metodo, ruta, params) {
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : undefined;
  const r = await fetch(`https://api.stripe.com/v1${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${clave}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${metodo} ${ruta.split("?")[0]} -> ${r.status}: ${j?.error?.message}`);
  return j;
}

const resultados = [];
const ok = (cond, texto) => { resultados.push(`${cond ? "OK " : "MAL"} ${texto}`); if (!cond) process.exitCode = 1; };
let cliente = null, sub = null;
try {
  cliente = await stripe("POST", "/customers", { email: `prueba-cobro+${Date.now()}@example.com`, "metadata[prueba]": "probar-cambio-plan" });
  await stripe("POST", "/payment_methods/pm_card_visa/attach", { customer: cliente.id }).then((pm) =>
    stripe("POST", `/customers/${cliente.id}`, { "invoice_settings[default_payment_method]": pm.id }));

  // 1. Checkout sin trial (sin completar: solo la sesión).
  const ses = await stripe("POST", "/checkout/sessions", {
    mode: "subscription", customer: cliente.id, "line_items[0][price]": precio("regional_mensual"), "line_items[0][quantity]": 1,
    success_url: "https://costaviva.org/suscripcion?exito=1", cancel_url: "https://costaviva.org/suscripcion?cancelado=1",
  });
  ok(ses.amount_total === 399, `checkout sin prueba: total ${ses.amount_total} (esperado 399)`);
  await stripe("POST", `/checkout/sessions/${ses.id}/expire`, {});

  // 2. Suscripción mensual cobrada hoy.
  sub = await stripe("POST", "/subscriptions", { customer: cliente.id, "items[0][price]": precio("regional_mensual"), "expand[0]": "latest_invoice" });
  ok(sub.status === "active" && sub.latest_invoice?.amount_paid === 399, `mensual activa y cobrada hoy (${sub.status}, ${sub.latest_invoice?.amount_paid})`);
  const item = sub.items.data[0];

  // 3. Subida a anual.
  const prev = resumenPreview(await stripe("POST", "/invoices/create_preview", paramsPreviewSubida({ customer: cliente.id, subscription: sub.id, itemId: item.id, priceId: precio("regional_anual") })));
  ok(prev.pagar_hoy > 0 && prev.pagar_hoy < 3499 && prev.descontado > 0, `preview subida: pagar hoy ${prev.pagar_hoy}, descontado ${prev.descontado}`);
  sub = await stripe("POST", `/subscriptions/${sub.id}?expand[]=latest_invoice`, paramsSubida({ itemId: item.id, priceId: precio("regional_anual"), metadata: { plan: "anual" } }));
  const fin = sub.items.data[0].current_period_end;
  const ahora = Math.floor(Date.now() / 1000);
  ok(fin - ahora > 360 * 86400, `subida: el periodo anual empieza hoy (fin en ${Math.round((fin - ahora) / 86400)} días)`);
  ok(sub.latest_invoice?.amount_paid === prev.pagar_hoy, `subida: cobrado hoy ${sub.latest_invoice?.amount_paid} = preview ${prev.pagar_hoy}`);

  // 4. Bajada programada a mensual al final del periodo.
  const sch = await stripe("POST", "/subscription_schedules", { from_subscription: sub.id });
  const act = await stripe("POST", `/subscription_schedules/${sch.id}`, paramsBajada({
    precioActual: precio("regional_anual"), priceId: precio("regional_mensual"), inicioFase: sch.phases[0].start_date, finPeriodo: fin, moneda: sub.currency, metadata: { plan: "mensual", ambito: "regional" },
  }));
  const prog = cambioProgramado(act);
  ok(prog && prog.plan === "mensual" && Math.abs(Date.parse(prog.fecha) / 1000 - fin) < 5, `bajada programada para ${prog?.fecha}`);

  // 5. Anulación.
  const rel = await stripe("POST", `/subscription_schedules/${sch.id}/release`, {});
  ok(cambioProgramado(rel) === null, "bajada anulada: no queda nada programado");
} catch (e) {
  ok(false, `error: ${e.message}`);
} finally {
  if (sub) await stripe("DELETE", `/subscriptions/${sub.id}`).catch(() => {});
  if (cliente) await stripe("DELETE", `/customers/${cliente.id}`).catch(() => {});
}
const texto = ["## Prueba de cobro y cambios de plan (Stripe test)", "", ...resultados.map((r) => `- ${r}`)].join("\n");
console.log(texto);
if (process.env.GITHUB_STEP_SUMMARY) (await import("node:fs")).appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto + "\n");
