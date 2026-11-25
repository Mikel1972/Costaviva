// test/bizum.test.js — "Pagar 1 año con Bizum" (2026-11-25, CLAUDE.md).
// Lógica pura de functions/_lib/bizum.js y comprobaciones del código que la usa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bizumActivo, bizumDisponible, precioBizum, sumarMeses, nuevoFinBizum, tieneSuscripcionTarjeta,
  esPagoBizum, filaPagoBizum, avisoQueToca, columnaAviso, idiomaAviso, emailAvisoBizum, MIN_CENT, MAX_CENT,
} from "../functions/_lib/bizum.js";
import { precioParaZona } from "../functions/_lib/precios.js";
import { textoAceptacion, TEXTOS, IDIOMAS } from "../assets/js/consentimiento.js";

const config = JSON.parse(readFileSync(new URL("../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const DIA = 24 * 60 * 60 * 1000;
const USER = "11111111-2222-4333-8444-555555555555";

test("interruptor: solo el texto 'true' lo enciende; por defecto apagado", () => {
  assert.equal(bizumActivo({}), false);
  assert.equal(bizumActivo(undefined), false);
  assert.equal(bizumActivo({ BIZUM_ACTIVO: "1" }), false);
  assert.equal(bizumActivo({ BIZUM_ACTIVO: "TRUE" }), false);
  assert.equal(bizumActivo({ BIZUM_ACTIVO: "true" }), true);
});

test("botón: con el interruptor, el cobro abierto y desde España", () => {
  const on = { BIZUM_ACTIVO: "true" };
  assert.equal(bizumDisponible(on, "ES", true), true);
  assert.equal(bizumDisponible(on, "es", true), true);
  assert.equal(bizumDisponible(on, "ES", false), false);
  assert.equal(bizumDisponible(on, "PT", true), false);
  assert.equal(bizumDisponible({}, "ES", true), false);
});

test("importe: exactamente el anual de la zona UE/EEE, en EUR", () => {
  const r = precioBizum(config, "ES", "regional", "anual");
  assert.equal(r.error, undefined);
  assert.equal(r.moneda, "EUR");
  assert.equal(r.importe, precioParaZona(config, "ue_eee", "regional", "anual").importe);
  assert.equal(r.importe, 3499);
  assert.equal(r.zona, "ue_eee");
  assert.equal(r.region_contenido, "es");
  const m = precioBizum(config, "ES", "mundial", "anual");
  assert.equal(m.importe, precioParaZona(config, "ue_eee", "mundial", "anual").importe);
  assert.equal(m.region_contenido, "todas");
  assert.ok(r.importe >= MIN_CENT && m.importe <= MAX_CENT);
});

test("importe: rechaza otros planes, ámbitos y zonas", () => {
  assert.equal(precioBizum(config, "ES", "regional", "mensual").error, "bizum_solo_anual");
  assert.equal(precioBizum(config, "ES", "regional", "fundador_anual").error, "bizum_solo_anual");
  assert.equal(precioBizum(config, "ES", "galaxia", "anual").error, "plan_invalido");
  assert.equal(precioBizum(config, "NZ", "regional", "anual").error, "bizum_solo_espana");
  // "resto" también cobra en EUR, pero no es la zona de Bizum.
  assert.equal(precioBizum(config, "BR", "regional", "anual").error, "bizum_solo_espana");
  assert.equal(precioBizum(config, "", "regional", "anual").error, "bizum_solo_espana");
});

test("meses: suma 12 en UTC sin desbordar el 29 de febrero", () => {
  assert.equal(sumarMeses("2026-11-25T10:00:00Z", 12).toISOString(), "2027-11-25T10:00:00.000Z");
  assert.equal(sumarMeses("2028-02-29T08:00:00Z", 12).toISOString(), "2029-02-28T08:00:00.000Z");
  assert.equal(sumarMeses("2027-01-31T00:00:00Z", 1).toISOString(), "2027-02-28T00:00:00.000Z");
});

test("periodo: 12 meses desde hoy, o desde el fin de Bizum aún vigente", () => {
  const ahora = Date.parse("2026-11-25T12:00:00Z");
  assert.equal(nuevoFinBizum(null, ahora).toISOString(), "2027-11-25T12:00:00.000Z");
  // Renovar antes alarga.
  const vigente = { metodo_pago: "bizum", periodo_actual_fin: "2026-12-01T12:00:00Z" };
  assert.equal(nuevoFinBizum(vigente, ahora).toISOString(), "2027-12-01T12:00:00.000Z");
  // Caducado: desde hoy.
  const caducado = { metodo_pago: "bizum", periodo_actual_fin: "2026-11-01T12:00:00Z" };
  assert.equal(nuevoFinBizum(caducado, ahora).toISOString(), "2027-11-25T12:00:00.000Z");
  // Un fin de tarjeta no se suma (lo gestiona Stripe).
  const tarjeta = { metodo_pago: null, periodo_actual_fin: "2027-05-01T12:00:00Z" };
  assert.equal(nuevoFinBizum(tarjeta, ahora).toISOString(), "2027-11-25T12:00:00.000Z");
});

test("doble cobro: con una suscripción de tarjeta en marcha no se ofrece Bizum", () => {
  assert.equal(tieneSuscripcionTarjeta(null), false);
  assert.equal(tieneSuscripcionTarjeta({ estado: "active", stripe_subscription_id: "sub_1" }), true);
  assert.equal(tieneSuscripcionTarjeta({ estado: "past_due", stripe_subscription_id: "sub_1" }), true);
  assert.equal(tieneSuscripcionTarjeta({ estado: "canceled", stripe_subscription_id: "sub_1" }), false);
  assert.equal(tieneSuscripcionTarjeta({ estado: "active", stripe_subscription_id: null }), false);
  assert.equal(tieneSuscripcionTarjeta({ estado: "active", metodo_pago: "bizum", stripe_subscription_id: null }), false);
});

function evento(type, objeto) {
  return { id: "evt_1", type, data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", client_reference_id: USER, metadata: { metodo: "bizum", ambito: "regional", zona: "ue_eee", region_contenido: "es", lookup_key: "cv_regional_anual_v2026_10b" }, currency: "eur", ...objeto } } };
}

test("webhook: solo cuenta un pago de Bizum cobrado", () => {
  assert.equal(esPagoBizum(evento("checkout.session.completed")), true);
  assert.equal(esPagoBizum(evento("checkout.session.completed", { payment_status: "unpaid" })), false);
  assert.equal(esPagoBizum(evento("checkout.session.async_payment_succeeded", { payment_status: "unpaid" })), true);
  assert.equal(esPagoBizum(evento("checkout.session.async_payment_failed")), false);
  assert.equal(esPagoBizum(evento("checkout.session.completed", { mode: "subscription" })), false);
  assert.equal(esPagoBizum(evento("checkout.session.completed", { metadata: {} })), false);
});

test("webhook: fila del pago y el mismo pago nunca suma dos años", () => {
  const ahora = Date.parse("2026-11-25T12:00:00Z");
  const sesion = evento("checkout.session.completed", { customer: "cus_1", customer_details: { address: { country: "ES" } } }).data.object;
  const fila = filaPagoBizum(sesion, null, ahora);
  assert.equal(fila.user_id, USER);
  assert.equal(fila.estado, "active");
  assert.equal(fila.periodo, "anual");
  assert.equal(fila.metodo_pago, "bizum");
  assert.equal(fila.bizum_sesion_id, "cs_1");
  assert.equal(fila.stripe_subscription_id, null);
  assert.equal(fila.stripe_customer_id, "cus_1");
  assert.equal(fila.pais_facturacion, "ES");
  assert.equal(fila.moneda, "EUR");
  assert.equal(fila.fundador, false);
  assert.equal(fila.region_contenido, "es");
  assert.equal(fila.periodo_actual_fin, "2027-11-25T12:00:00.000Z");
  // Reintento de Stripe del mismo pago, con la fila ya guardada: nada.
  assert.equal(filaPagoBizum(sesion, fila, ahora + 60000), null);
  // Un pago nuevo (otra sesión) alarga desde el fin vigente.
  const otra = { ...sesion, id: "cs_2" };
  assert.equal(filaPagoBizum(otra, fila, ahora + DIA).periodo_actual_fin, "2028-11-25T12:00:00.000Z");
  // Sin customer no se pisa el guardado.
  assert.equal("stripe_customer_id" in filaPagoBizum({ ...sesion, customer: null }, null, ahora), false);
  // Mundial: sin región.
  assert.equal(filaPagoBizum({ ...sesion, metadata: { ...sesion.metadata, ambito: "mundial" } }, null, ahora).region_contenido, null);
});

test("avisos: 7 días antes y el último día, una vez por periodo", () => {
  const fin = Date.parse("2027-11-25T12:00:00Z");
  const fila = { metodo_pago: "bizum", estado: "active", periodo_actual_fin: "2027-11-25T12:00:00+00:00" };
  assert.equal(avisoQueToca(fila, fin - 10 * DIA), null);
  assert.equal(avisoQueToca(fila, fin - 7 * DIA - 1000), null);
  assert.equal(avisoQueToca(fila, fin - 7 * DIA), "7_dias");
  assert.equal(avisoQueToca(fila, fin - 3 * DIA), "7_dias");
  assert.equal(avisoQueToca({ ...fila, renovacion_avisada_fin: "2027-11-25T12:00:00+00:00" }, fin - 3 * DIA), null);
  assert.equal(avisoQueToca(fila, fin - DIA), "ultimo_dia");
  assert.equal(avisoQueToca({ ...fila, renovacion_avisada_fin: "2027-11-25T12:00:00Z" }, fin - 2 * 3600e3), "ultimo_dia");
  assert.equal(avisoQueToca({ ...fila, renovacion_ultimo_dia_fin: "2027-11-25T12:00:00.000Z" }, fin - 2 * 3600e3), null);
  assert.equal(avisoQueToca(fila, fin), null, "ya terminó");
  assert.equal(avisoQueToca(fila, fin + DIA), null);
  // Un aviso de un periodo anterior no cuenta para el nuevo.
  assert.equal(avisoQueToca({ ...fila, renovacion_avisada_fin: "2026-11-25T12:00:00Z" }, fin - 3 * DIA), "7_dias");
  // Solo Bizum activo.
  assert.equal(avisoQueToca({ ...fila, metodo_pago: "tarjeta" }, fin - 3 * DIA), null);
  assert.equal(avisoQueToca({ ...fila, metodo_pago: null }, fin - 3 * DIA), null);
  assert.equal(avisoQueToca({ ...fila, estado: "canceled" }, fin - 3 * DIA), null);
  assert.equal(avisoQueToca({ ...fila, periodo_actual_fin: null }, fin - 3 * DIA), null);
  assert.equal(columnaAviso("7_dias"), "renovacion_avisada_fin");
  assert.equal(columnaAviso("ultimo_dia"), "renovacion_ultimo_dia_fin");
});

test("avisos: email en es/en/pt con la fecha y el enlace para renovar", () => {
  assert.equal(idiomaAviso({ idioma: "pt" }), "pt");
  assert.equal(idiomaAviso({ idioma: "en" }), "en");
  assert.equal(idiomaAviso({ idioma: "fr" }), "es");
  assert.equal(idiomaAviso(null), "es");
  const fin = "2027-11-25T12:00:00Z";
  const es = emailAvisoBizum("7_dias", fin, "es");
  assert.match(es.asunto, /25 de noviembre de 2027/);
  assert.match(es.cuerpo, /https:\/\/costaviva\.org\/suscripcion/);
  assert.match(es.cuerpo, /Bizum/);
  assert.match(emailAvisoBizum("ultimo_dia", fin, "es").asunto, /mañana/);
  assert.match(emailAvisoBizum("7_dias", fin, "en").asunto, /^Your Costaviva Premium year ends on/);
  assert.match(emailAvisoBizum("ultimo_dia", fin, "pt").asunto, /amanhã/);
  assert.match(emailAvisoBizum("7_dias", fin, "pt").cuerpo, /^Olá,/);
});

test("aceptación: texto propio de Bizum en los tres idiomas", () => {
  for (const i of IDIOMAS) {
    assert.ok(TEXTOS[i].bizum.length > 80, i);
    assert.equal(textoAceptacion("anual", i, "bizum"), TEXTOS[i].bizum);
    assert.equal(textoAceptacion("anual", i), TEXTOS[i].anual);
  }
  assert.match(TEXTOS.es.bizum, /no se renueva solo/);
});

test("checkout: con el interruptor apagado responde 403 antes de tocar Stripe", () => {
  const c = leer("functions/crear-checkout-stripe.js");
  const i = c.indexOf('body?.metodo === "bizum"');
  assert.ok(i > 0);
  const tramo = c.slice(i, c.indexOf("return checkoutBizum(", i));
  assert.match(tramo, /if \(!bizumActivo\(env\)\)/);
  assert.match(tramo, /codigo: "bizum_no_activo"/);
  assert.match(tramo, /status: 403/);
  assert.doesNotMatch(tramo, /api\.stripe\.com/);
  const f = c.slice(c.indexOf("async function checkoutBizum("));
  assert.match(f, /append\("mode", "payment"\)/);
  assert.match(f, /payment_method_types\[0\]", "bizum"/);
  assert.match(f, /price_data\]\[currency\]", "eur"/);
  assert.match(f, /String\(precio\.importe\)/);
  assert.match(f, /tieneSuscripcionTarjeta\(fila\)/);
  assert.match(f, /metodo: "bizum", periodo: "anual"/);
  assert.match(f, /supabase_user_id: usuario\.id/);
  assert.doesNotMatch(f, /allow_promotion_codes|discounts\[|setup_future_usage|subscription_data/);
});

test("webhook y página: Bizum conectado y sin handlers en línea", () => {
  const w = leer("functions/stripe-webhook.js");
  assert.match(w, /esPagoBizum\(evento\)/);
  assert.match(w, /filaPagoBizum\(obj, await filaSuscripcion/);
  const z = leer("functions/precios-zona.js");
  assert.match(z, /bizum_activo: bizumDisponible\(env, pais, cobroActivo\(env\)\)/);
  const h = leer("suscripcion.html");
  assert.match(h, /class="btn-comprar secundario btn-bizum"[^>]*hidden/);
  assert.match(h, /bizumAbierto = cobroAbierto && p\?\.bizum_activo === true/);
  const r = leer("functions/avisar-renovacion-bizum.js");
  assert.match(r, /secretoValido\(request\.headers\.get\("X-Cron-Secret"\), env\.CRON_SECRET\)/);
});

test("migración: una sola, sin BEGIN/COMMIT, con check y acceso hasta el fin con Bizum", () => {
  const sql = leer("supabase/migrations/20261125200000_bizum_anual.sql");
  assert.doesNotMatch(sql, /\bbegin;|\bcommit;/i);
  assert.match(sql, /check \(metodo_pago is null or metodo_pago in \('tarjeta', 'bizum'\)\)/);
  assert.match(sql, /v_bizum_caducado := coalesce\(v_sub\.metodo_pago = 'bizum', false\)\s+and coalesce\(v_sub\.periodo_actual_fin <= now\(\), true\)/);
  assert.match(sql, /v_pagando := coalesce\(v_sub\.estado in \('trialing', 'active'\), false\) and not v_bizum_caducado/);
  assert.match(sql, /security definer\s*\n\s*set search_path = public, extensions/);
  assert.match(sql, /revoke execute on function public\.mi_estado_suscripcion\(\) from public, anon/);
  assert.doesNotMatch(sql, /create table|create policy|row level security/i);
});
