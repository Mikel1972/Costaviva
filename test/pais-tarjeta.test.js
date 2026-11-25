// test/pais-tarjeta.test.js — zona de precio por el país de la tarjeta y por
// el uso (2026-11-25, CLAUDE.md). Lógica pura de functions/_lib/pais-tarjeta.js
// y comprobaciones del código que la usa. Sin llamar a Stripe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  paisValido, paisDeTarjeta, zonaDePaisId, planDePrecio, decidirCorreccion, estadoCorreccion, yaCorregida,
  paramsCambioZona, apuntarPaisUso, zonaPorUso, emailCambioZona, idiomaEmail, lineasInforme,
  VENTANA_USO_DIAS, DIAS_OTRA_ZONA,
} from "../functions/_lib/pais-tarjeta.js";
import { precioParaZona, preciosStripe } from "../functions/_lib/precios.js";

const config = JSON.parse(readFileSync(new URL("../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const DIA = 86400000;
const AHORA = Date.parse("2026-11-25T12:00:00Z");
const SUB = "sub_123";

// Configuración de prueba con una zona activa más en EUR y precio propio
// (multiplicador < 1): el único caso en que el cambio es posible sin cambiar
// de moneda.
const configEur = structuredClone(config);
configEur.zonas.push({ id: "zz_eur", activa: true, paises: ["ZZ"], moneda: "EUR", multiplicador_fijo: 0.7, redondeo: "99" });

const base = (extra = {}) => ({
  config: configEur, fila: { metodo_pago: "tarjeta" }, subId: SUB, zonaCobrada: "zz_eur", zonaReal: "ue_eee",
  ambito: "regional", plan: "anual", moneda: "EUR", ...extra,
});

test("umbral de uso: constantes razonables", () => {
  assert.equal(VENTANA_USO_DIAS, 14);
  assert.equal(DIAS_OTRA_ZONA, 3);
});

test("país: 2 letras; XX y T1 de Cloudflare no cuentan", () => {
  assert.equal(paisValido("nz"), "NZ");
  assert.equal(paisValido("XX"), null);
  assert.equal(paisValido("T1"), null);
  assert.equal(paisValido("ESP"), null);
  assert.equal(paisValido(null), null);
});

test("país de la tarjeta: PaymentMethod, Charge, suscripción y cliente", () => {
  assert.equal(paisDeTarjeta({ type: "card", card: { country: "NZ" } }), "NZ");
  assert.equal(paisDeTarjeta({ payment_method_details: { type: "card", card: { country: "es" } } }), "ES");
  assert.equal(paisDeTarjeta({ default_payment_method: { type: "card", card: { country: "PT" } } }), "PT");
  assert.equal(paisDeTarjeta({ default_payment_method: null, customer: { invoice_settings: { default_payment_method: { type: "card", card: { country: "AU" } } } } }), "AU");
  // Sin país o sin tarjeta (Bizum, SEPA...): nada.
  assert.equal(paisDeTarjeta({ default_payment_method: { type: "card", card: { country: null } } }), null);
  assert.equal(paisDeTarjeta({ type: "bizum", bizum: {} }), null);
  assert.equal(paisDeTarjeta({ default_payment_method: "pm_123" }), null);
  assert.equal(paisDeTarjeta(null), null);
});

test("zona de un país: la activa o 'resto'", () => {
  assert.equal(zonaDePaisId(config, "ES"), "ue_eee");
  assert.equal(zonaDePaisId(config, "NZ"), "nz");
  assert.equal(zonaDePaisId(config, "US"), "resto"); // zona inactiva
  assert.equal(zonaDePaisId(config, ""), null);
});

test("plan de precios: mensual, anual y fundador", () => {
  assert.equal(planDePrecio({ periodo: "mensual", fundador: false }), "mensual");
  assert.equal(planDePrecio({ periodo: "anual", fundador: false }), "anual");
  assert.equal(planDePrecio({ periodo: "anual", fundador: true }), "fundador_anual");
  assert.equal(planDePrecio({ periodo: null }), null);
});

test("misma zona: nada", () => {
  assert.equal(decidirCorreccion(base({ zonaReal: "zz_eur" })).accion, "nada");
  assert.equal(decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "nz", zonaReal: "nz", ambito: "regional", plan: "anual", moneda: "NZD" }).motivo, "misma_zona");
});

test("zona distinta con el mismo precio (UE/EEE y resto, los dos a 1,0 en EUR): nada", () => {
  const d = decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "resto", zonaReal: "ue_eee", ambito: "regional", plan: "anual", moneda: "EUR" });
  assert.equal(d.accion, "nada");
  assert.equal(d.motivo, "mismo_precio");
});

test("zona distinta en la misma moneda: cambio al precio de la zona real (mismo plan)", () => {
  for (const [ambito, plan] of [["regional", "anual"], ["regional", "mensual"], ["mundial", "fundador_anual"]]) {
    const d = decidirCorreccion(base({ ambito, plan }));
    assert.equal(d.accion, "cambiar");
    assert.equal(d.zona, "ue_eee");
    assert.deepEqual(d.precio, precioParaZona(configEur, "ue_eee", ambito, plan));
    assert.equal(estadoCorreccion(d), "cambiada");
    // El lookup_key existe entre los precios de Stripe de la config.
    assert.ok(preciosStripe(configEur).some((p) => p.lookup_key === d.precio.lookup_key));
  }
});

test("cambio de moneda (EUR <-> NZD): no renovar al acabar lo pagado y avisar (sí de Mikel)", () => {
  const aNz = decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "ue_eee", zonaReal: "nz", ambito: "regional", plan: "anual", moneda: "EUR" });
  assert.equal(aNz.accion, "no_renovar");
  assert.equal(aNz.motivo, "moneda");
  assert.equal(aNz.precio.moneda, "NZD");
  assert.equal(estadoCorreccion(aNz), "no_renovar_moneda");
  const aUe = decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "nz", zonaReal: "ue_eee", ambito: "mundial", plan: "mensual", moneda: "NZD" });
  assert.equal(aUe.accion, "no_renovar");
  // La moneda la manda la suscripción aunque el precio sea multimoneda:
  // un NZ cobrado en EUR (moneda "EUR") hacia UE sería el mismo precio.
  assert.equal(decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "nz", zonaReal: "ue_eee", ambito: "regional", plan: "anual", moneda: "EUR" }).accion, "nada");
});

test("con un cambio de plan programado: revisar, no se pisa", () => {
  const d = decidirCorreccion(base({ programado: true }));
  assert.equal(d.accion, "revisar");
  assert.equal(estadoCorreccion(d), "revisar_programado");
});

test("Bizum, sin suscripción de Stripe, sin país o sin renovación: nada", () => {
  assert.equal(decidirCorreccion(base({ fila: { metodo_pago: "bizum" } })).motivo, "bizum");
  assert.equal(decidirCorreccion(base({ subId: null })).motivo, "sin_suscripcion"); // admin, permanente, invitación
  assert.equal(decidirCorreccion(base({ zonaReal: null })).motivo, "sin_zona");
  assert.equal(decidirCorreccion(base({ zonaCobrada: null })).motivo, "sin_zona_cobrada");
  assert.equal(decidirCorreccion(base({ renueva: false })).motivo, "no_renueva");
  assert.equal(decidirCorreccion(base({ plan: null })).motivo, "plan_desconocido");
});

test("idempotencia: una vez por suscripción", () => {
  const hecha = { metodo_pago: "tarjeta", zona_correccion: "cambiada", zona_correccion_sub: SUB };
  assert.equal(yaCorregida(hecha, SUB), true);
  assert.equal(decidirCorreccion(base({ fila: hecha })).motivo, "ya_corregida");
  // También si se marcó para revisar.
  assert.equal(decidirCorreccion(base({ fila: { ...hecha, zona_correccion: "revisar_moneda" } })).motivo, "ya_corregida");
  // Una suscripción nueva (otra alta) vuelve a mirarse.
  assert.equal(yaCorregida(hecha, "sub_otra"), false);
  assert.equal(decidirCorreccion(base({ fila: hecha, subId: "sub_otra" })).accion, "cambiar");
});

test("parámetros de Stripe: mismo item, precio nuevo, sin prorrateo y zona en metadatos", () => {
  const p = paramsCambioZona({ itemId: "si_1", priceId: "price_1", zona: "ue_eee", lookupKey: "cv_regional_anual_v2026_10b", origen: "tarjeta", regionContenido: "es" });
  assert.equal(p["items[0][id]"], "si_1");
  assert.equal(p["items[0][price]"], "price_1");
  assert.equal(p.proration_behavior, "none");
  assert.equal(p["metadata[zona]"], "ue_eee");
  assert.equal(p["metadata[zona_corregida_por]"], "tarjeta");
  assert.equal(p.billing_cycle_anchor, undefined); // nunca se mueve la renovación
  assert.equal(p.currency, undefined);
});

test("uso: apunta solo el país por día y olvida lo de fuera de la ventana", () => {
  const viejo = new Date(AHORA - 20 * DIA).toISOString().slice(0, 10);
  const u = apuntarPaisUso({ [viejo]: ["ES"], basura: ["NZ"] }, "nz", AHORA);
  assert.deepEqual(u, { "2026-11-25": ["NZ"] });
  // Mismo país el mismo día: sin cambios (no se escribe en cada apertura).
  assert.equal(apuntarPaisUso(u, "NZ", AHORA), null);
  assert.deepEqual(apuntarPaisUso(u, "AU", AHORA), { "2026-11-25": ["NZ", "AU"] });
  // País desconocido: no se apunta nada nuevo.
  assert.equal(apuntarPaisUso(u, "XX", AHORA), null);
  assert.equal(JSON.stringify(apuntarPaisUso(null, "ES", AHORA)).includes("."), false); // ni IP ni nada más
});

test("uso: 3 días en 14 desde otra zona y ninguno desde la pagada -> esa zona", () => {
  const dia = (n) => new Date(AHORA - n * DIA).toISOString().slice(0, 10);
  const nz3 = { [dia(0)]: ["NZ"], [dia(4)]: ["NZ"], [dia(9)]: ["NZ"] };
  assert.deepEqual(zonaPorUso(config, nz3, "ue_eee", AHORA), { zona: "nz", pais: "NZ", dias: 3 });
  // Solo 2 días (un viaje corto): nada.
  assert.equal(zonaPorUso(config, { [dia(0)]: ["NZ"], [dia(1)]: ["NZ"] }, "ue_eee", AHORA), null);
  // Algún día desde la zona pagada en la ventana: nada (está de viaje).
  assert.equal(zonaPorUso(config, { ...nz3, [dia(2)]: ["ES"] }, "ue_eee", AHORA), null);
  // Días fuera de la ventana no cuentan.
  assert.equal(zonaPorUso(config, { [dia(0)]: ["NZ"], [dia(1)]: ["NZ"], [dia(20)]: ["NZ"] }, "ue_eee", AHORA), null);
  // Misma zona que la pagada: nada.
  assert.equal(zonaPorUso(config, nz3, "nz", AHORA), null);
  assert.equal(zonaPorUso(config, nz3, null, AHORA), null);
});

test("uso desde otra zona sigue las mismas reglas de moneda e idempotencia", () => {
  const dia = (n) => new Date(AHORA - n * DIA).toISOString().slice(0, 10);
  const uso = zonaPorUso(config, { [dia(0)]: ["NZ"], [dia(3)]: ["NZ"], [dia(6)]: ["NZ"] }, "ue_eee", AHORA);
  const d = decidirCorreccion({ config, fila: {}, subId: SUB, zonaCobrada: "ue_eee", zonaReal: uso.zona, ambito: "regional", plan: "anual", moneda: "EUR" });
  assert.equal(d.accion, "no_renovar");
  assert.equal(d.motivo, "moneda");
});

test("email: es/en/pt, positivo, con importe y moneda nuevos y la fecha", () => {
  const precio = precioParaZona(config, "nz", "regional", "anual");
  const fin = Math.floor(Date.parse("2027-03-01T10:00:00Z") / 1000);
  for (const idioma of ["es", "en", "pt"]) {
    const e = emailCambioZona({ idioma, pais: "NZ", precio, finPeriodo: fin, periodo: "anual", origen: "tarjeta" });
    assert.ok(e.subject.length > 10);
    assert.match(e.text, /97[.,]99/);
    assert.match(e.text, /NZ\$|NZD/);
    assert.match(e.text, /2027/);
    assert.doesNotMatch(e.text, /VPN|fraude|fraud|engañ/i);
  }
  const es = emailCambioZona({ idioma: "es", pais: "NZ", precio, finPeriodo: fin, periodo: "anual", origen: "tarjeta" });
  assert.match(es.text, /Nueva Zelanda/);
  assert.match(es.text, /no tienes que hacer nada/);
  const uso = emailCambioZona({ idioma: "en", pais: "NZ", precio, finPeriodo: fin, periodo: "mensual", origen: "uso" });
  assert.match(uso.text, /using Costaviva from New Zealand/);
  assert.match(uso.text, /monthly/);
  assert.equal(idiomaEmail(undefined, "pt"), "pt");
  assert.equal(idiomaEmail("fr"), "es");
});

test("informe diario: solo recuentos y zonas", () => {
  assert.match(lineasInforme([])[0], /Ninguna/);
  const filas = [
    { zona_precio: "ue_eee", zona_tarjeta: "nz", zona_correccion: "revisar_moneda", zona_correccion_origen: "tarjeta", zona_corregir_a: "nz" },
    { zona_precio: "ue_eee", zona_tarjeta: "nz", zona_correccion: null },
    { zona_precio: "ue_eee", zona_tarjeta: "ue_eee", zona_correccion: "revisar_moneda", zona_correccion_origen: "uso", zona_corregir_a: "nz" },
    { zona_precio: "nz", zona_tarjeta: "nz" },
  ];
  const txt = lineasInforme(filas).join("\n");
  assert.match(txt, /ue_eee → nz: 2/);
  assert.match(txt, /revisar_moneda \(tarjeta\) → nz: 1/);
  assert.match(txt, /revisar_moneda \(uso\) → nz: 1/);
  assert.match(txt, /2 para revisar a mano/);
  assert.doesNotMatch(txt, /@|sub_|cus_/);
});

test("webhook, dispositivos y migración usan la lógica", () => {
  const w = leer("functions/stripe-webhook.js");
  assert.match(w, /evento\.type === "invoice\.paid"/);
  assert.match(w, /zonaTrasPagoConTarjeta/);
  const c = leer("functions/_lib/corregir-zona.js");
  assert.match(c, /Idempotency-Key/);
  assert.match(c, /expand\[\]=default_payment_method/);
  assert.doesNotMatch(c, /price_1[A-Za-z0-9]{10,}/); // ningún id de precio a mano
  assert.doesNotMatch(c, /\bcurrency\b\s*:/); // nunca se intenta cambiar la moneda
  const d = leer("functions/dispositivos.js");
  assert.match(d, /apuntarUsoYCorregir/);
  assert.doesNotMatch(d, /CF-Connecting-IP/);
  const sql = leer("supabase/migrations/20261125220000_pais_tarjeta.sql");
  for (const col of ["pais_tarjeta", "zona_tarjeta", "paises_uso", "zona_corregir_a", "zona_correccion", "zona_correccion_origen", "zona_correccion_sub", "zona_aviso_enviado_en"]) {
    assert.match(sql, new RegExp(`add column if not exists ${col}\\b`));
  }
  assert.doesNotMatch(sql, /\b(begin|commit)\s*;/i);
  assert.doesNotMatch(sql, /create (table|policy)/i);
  assert.match(leer(".github/workflows/daily-report.yml"), /informe-zonas-tarjeta\.mjs/);
});

// --- Flujo con red simulada (fetch falso: ni Stripe ni Supabase de verdad) ---
// corregir-zona.js importa JSON como las Functions de Cloudflare; aquí se
// carga con un hook que lo permite sin atributos de importación.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
import { readFileSync } from "node:fs";
export async function load(url, ctx, next) {
  if (url.startsWith("file:") && url.endsWith(".json")) return { format: "json", source: readFileSync(new URL(url)), shortCircuit: true };
  return next(url, ctx);
}`));

const USER = "11111111-2222-4333-8444-555555555555";
function simulador({ fila, sub, falloEmail = 0, falloStripe = 0 }) {
  const llamadas = { stripePost: [], emails: [], patches: [] };
  const responder = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const metodo = init.method || "GET";
    if (u.includes("/rest/v1/suscripciones")) {
      if (metodo === "GET") return responder([{ ...fila }]);
      const q = decodeURIComponent(u.split("?")[1]);
      const cuerpo = JSON.parse(init.body);
      const m1 = q.match(/zona_correccion_sub\.neq\.([^)]+)\)/);
      const m2 = q.match(/zona_correccion_sub=eq\.([^&]+)/);
      const aplica = m1 ? fila.zona_correccion_sub !== m1[1] : m2 ? fila.zona_correccion_sub === m2[1] : true;
      if (aplica) { Object.assign(fila, cuerpo); llamadas.patches.push(cuerpo); }
      return responder(aplica ? [{ ...fila }] : []);
    }
    if (u.startsWith("https://api.stripe.com/v1/subscriptions/") && metodo === "GET") return responder(structuredClone(sub));
    if (u.startsWith("https://api.stripe.com/v1/prices")) return responder({ data: [{ id: "price_fake_zz" }] });
    if (u.startsWith("https://api.stripe.com/v1/subscriptions/") && metodo === "POST") {
      if (falloStripe-- > 0) return responder({ error: { message: "fallo" } }, 500);
      const p = new URLSearchParams(init.body);
      llamadas.stripePost.push({ params: Object.fromEntries(p), clave: init.headers["Idempotency-Key"] });
      sub.metadata = { ...sub.metadata, zona: p.get("metadata[zona]"), zona_corregida_por: p.get("metadata[zona_corregida_por]") };
      return responder(sub);
    }
    if (u.startsWith("https://api.resend.com/")) {
      if (falloEmail-- > 0) return responder({}, 500);
      llamadas.emails.push(JSON.parse(init.body));
      return responder({ id: "em_1" });
    }
    throw new Error(`fetch inesperado: ${metodo} ${u}`);
  };
  return llamadas;
}
const subFalsa = (extra = {}) => ({
  id: SUB, status: "active", currency: "eur", cancel_at_period_end: false, schedule: null,
  metadata: { zona: "zz_eur", idioma: "es", supabase_user_id: USER },
  items: { data: [{ id: "si_1", current_period_end: 1800000000, price: { id: "price_x", lookup_key: "cv_regional_anual_v2026_10b_zzz_eur", metadata: { costaviva_ambito: "regional", costaviva_plan: "anual" }, recurring: { interval: "year" } } }] },
  default_payment_method: { type: "card", card: { country: "ES" } },
  ...extra,
});
const ENV = { STRIPE_SECRET_KEY: "sk_test_falsa", RESEND_API_KEY: "re_falsa" };

test("flujo: tarjeta de otra zona en la misma moneda -> un cambio en Stripe y un email, aunque se repita", async () => {
  const { zonaTrasPagoConTarjeta } = await import("../functions/_lib/corregir-zona.js");
  const fila = { user_id: USER, metodo_pago: "tarjeta", pais_tarjeta: null, zona_tarjeta: null, paises_uso: null, zona_precio: "zz_eur", zona_correccion: null, zona_correccion_sub: null };
  const ll = simulador({ fila, sub: subFalsa() });
  const args = { env: ENV, serviceRoleKey: "srk", userId: USER, subId: SUB, para: "x@example.com", idioma: "pt", config: configEur };
  const r1 = await zonaTrasPagoConTarjeta(args);
  assert.equal(r1.accion, "cambiar");
  assert.equal(fila.pais_tarjeta, "ES");
  assert.equal(fila.zona_tarjeta, "ue_eee");
  assert.equal(fila.zona_correccion, "cambiada");
  assert.ok(fila.zona_aviso_enviado_en);
  assert.equal(ll.stripePost.length, 1);
  assert.equal(ll.stripePost[0].params.proration_behavior, "none");
  assert.equal(ll.stripePost[0].params["items[0][id]"], "si_1");
  assert.equal(ll.stripePost[0].params["metadata[zona]"], "ue_eee");
  assert.ok(ll.stripePost[0].clave);
  assert.equal(ll.emails.length, 1);
  assert.match(ll.emails[0].text, /34,99/);
  assert.match(ll.emails[0].subject, /renovação/); // pt
  // Reintento del webhook / siguiente renovación: nada más.
  const r2 = await zonaTrasPagoConTarjeta(args);
  assert.equal(r2.accion, "nada");
  assert.equal(ll.stripePost.length, 1);
  assert.equal(ll.emails.length, 1);
});

test("flujo: si el email falla se lanza y el reintento solo manda el email", async () => {
  const { zonaTrasPagoConTarjeta } = await import("../functions/_lib/corregir-zona.js");
  const fila = { user_id: USER, metodo_pago: "tarjeta", pais_tarjeta: null, zona_tarjeta: null, paises_uso: null, zona_precio: "zz_eur", zona_correccion: null, zona_correccion_sub: null };
  const ll = simulador({ fila, sub: subFalsa(), falloEmail: 1 });
  const args = { env: ENV, serviceRoleKey: "srk", userId: USER, subId: SUB, para: "x@example.com", config: configEur };
  await assert.rejects(() => zonaTrasPagoConTarjeta(args), /aviso de cambio de zona/);
  assert.equal(fila.zona_aviso_enviado_en, null);
  const r = await zonaTrasPagoConTarjeta(args);
  assert.equal(r.accion, "aviso_reenviado");
  assert.equal(ll.stripePost.length, 1);
  assert.equal(ll.emails.length, 1);
  assert.ok(fila.zona_aviso_enviado_en);
});

test("flujo: si Stripe falla se suelta la reserva y el reintento lo hace", async () => {
  const { zonaTrasPagoConTarjeta } = await import("../functions/_lib/corregir-zona.js");
  const fila = { user_id: USER, metodo_pago: "tarjeta", pais_tarjeta: null, zona_tarjeta: null, paises_uso: null, zona_precio: "zz_eur", zona_correccion: null, zona_correccion_sub: null };
  const ll = simulador({ fila, sub: subFalsa(), falloStripe: 1 });
  const args = { env: ENV, serviceRoleKey: "srk", userId: USER, subId: SUB, para: "x@example.com", config: configEur };
  await assert.rejects(() => zonaTrasPagoConTarjeta(args), /Stripe/);
  assert.equal(fila.zona_correccion, null);
  assert.equal(ll.emails.length, 0);
  assert.equal((await zonaTrasPagoConTarjeta(args)).accion, "cambiar");
  assert.equal(ll.stripePost.length, 1);
  assert.equal(ll.emails.length, 1);
});

test("flujo: cambio de moneda (tarjeta NZ, suscripción en EUR) -> no renovar al acabar y email con el precio de NZ", async () => {
  const { zonaTrasPagoConTarjeta } = await import("../functions/_lib/corregir-zona.js");
  const fila = { user_id: USER, metodo_pago: "tarjeta", pais_tarjeta: null, zona_tarjeta: null, paises_uso: null, zona_precio: "ue_eee", zona_correccion: null, zona_correccion_sub: null };
  const sub = subFalsa({ metadata: { zona: "ue_eee" }, default_payment_method: { type: "card", card: { country: "NZ" } } });
  sub.items.data[0].price.lookup_key = "cv_regional_anual_v2026_10b";
  const ll = simulador({ fila, sub });
  const r = await zonaTrasPagoConTarjeta({ env: ENV, serviceRoleKey: "srk", userId: USER, subId: SUB, para: "x@example.com" });
  assert.equal(r.accion, "no_renovar");
  assert.equal(fila.zona_correccion, "no_renovar_moneda");
  assert.equal(fila.zona_corregir_a, "nz");
  assert.equal(fila.zona_tarjeta, "nz");
  assert.equal(ll.stripePost.length, 1);
  assert.match(JSON.stringify(ll.stripePost[0]), /cancel_at_period_end/);
  assert.doesNotMatch(JSON.stringify(ll.stripePost[0]), /items\[0\]\[price\]/);
  assert.equal(ll.emails.length, 1);
  assert.match(ll.emails[0].text, /NZD/);
  assert.match(ll.emails[0].text, /sin renovarse sola|without renewing|sem se renovar/);
  assert.ok(fila.zona_aviso_enviado_en);
});

test("flujo: Bizum, sin país de tarjeta o sin migración -> nada", async () => {
  const { zonaTrasPagoConTarjeta } = await import("../functions/_lib/corregir-zona.js");
  const args = { env: ENV, serviceRoleKey: "srk", userId: USER, subId: SUB, para: "x@example.com", config: configEur };
  let fila = { user_id: USER, metodo_pago: "bizum", pais_tarjeta: null, zona_precio: "zz_eur" };
  simulador({ fila, sub: subFalsa() });
  assert.equal((await zonaTrasPagoConTarjeta(args)).motivo, "bizum");
  fila = { user_id: USER, metodo_pago: "tarjeta", pais_tarjeta: null, zona_precio: "zz_eur" };
  let ll = simulador({ fila, sub: subFalsa({ default_payment_method: { type: "card", card: {} } }) });
  assert.equal((await zonaTrasPagoConTarjeta(args)).motivo, "sin_pais");
  assert.equal(ll.patches.length, 0);
  fila = { user_id: USER, metodo_pago: "tarjeta", zona_precio: "zz_eur" }; // sin columnas nuevas
  simulador({ fila, sub: subFalsa() });
  assert.equal((await zonaTrasPagoConTarjeta(args)).motivo, "sin_migracion");
});

test("flujo: uso desde otra zona 3 días -> mismo cambio con origen 'uso'; un viaje no", async () => {
  const { apuntarUsoYCorregir } = await import("../functions/_lib/corregir-zona.js");
  const dia = (n) => new Date(AHORA - n * DIA).toISOString().slice(0, 10);
  const fila = {
    user_id: USER, stripe_subscription_id: SUB, estado: "active", metodo_pago: "tarjeta", zona_precio: "zz_eur",
    ambito: "regional", periodo: "anual", fundador: false, moneda: "EUR",
    paises_uso: { [dia(5)]: ["ES"], [dia(9)]: ["FR"] }, zona_correccion: null, zona_correccion_sub: null,
  };
  const ll = simulador({ fila, sub: subFalsa() });
  const args = { env: ENV, serviceRoleKey: "srk", userId: USER, pais: "ES", para: "x@example.com", idioma: "en", ahora: AHORA, config: configEur };
  const r = await apuntarUsoYCorregir(args);
  assert.equal(r.accion, "cambiar");
  assert.deepEqual(fila.paises_uso[dia(0)], ["ES"]);
  assert.equal(fila.zona_correccion_origen, "uso");
  assert.equal(ll.stripePost[0].params["metadata[zona_corregida_por]"], "uso");
  assert.match(ll.emails[0].text, /using Costaviva from Spain/);
  assert.equal((await apuntarUsoYCorregir(args)).accion, "nada");
  assert.equal(ll.emails.length, 1);
  // Sin suscripción de tarjeta (admin, permanente, invitación, Bizum): ni se apunta.
  const otra = { user_id: USER, stripe_subscription_id: null, estado: null, paises_uso: null };
  const ll2 = simulador({ fila: otra, sub: subFalsa() });
  assert.equal((await apuntarUsoYCorregir(args)).motivo, "sin_suscripcion_tarjeta");
  assert.equal(ll2.patches.length, 0);
});
