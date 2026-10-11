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

// Cláusula de aceptación antes de pagar (decisión de Mikel, 2026-10-11).
import { TEXTOS, IDIOMAS, VERSION, textoAceptacion, idiomaAceptacion, tipoDePlan } from "../assets/js/consentimiento.js";

test("aceptación: texto en es, en y pt, para el anual y el mensual", () => {
  assert.deepEqual([...IDIOMAS], ["es", "en", "pt"]);
  for (const i of IDIOMAS) {
    for (const t of ["anual", "mensual"]) assert.ok(TEXTOS[i][t].length > 80, `${i}/${t}`);
  }
  assert.equal(TEXTOS.es.anual, "Solicito el acceso inmediato a Premium y acepto que, al empezar, pierdo mi derecho de desistimiento. El plan anual no se reembolsa: si cancelas, sigue activo hasta el final del periodo pagado y no se renueva.");
  assert.match(TEXTOS.en.anual, /non-refundable/);
  assert.match(TEXTOS.pt.anual, /não é reembolsável/);
  assert.equal(tipoDePlan("fundador_anual"), "anual");
  assert.equal(textoAceptacion("mensual", "pt"), TEXTOS.pt.mensual);
  assert.equal(textoAceptacion("anual", "fr"), TEXTOS.es.anual);
  assert.equal(idiomaAceptacion("es", ["pt-PT"]), "pt");
  assert.equal(idiomaAceptacion("en", ["pt-PT"]), "en");
  assert.match(VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("aceptación: casilla sin marcar y botón de pago desactivado sin ella", () => {
  const html = readFileSync(new URL("../suscripcion.html", import.meta.url), "utf8");
  assert.match(html, /<input type="checkbox" id="checkLegal" \/>/, "la casilla no puede venir marcada");
  assert.match(html, /<button type="button" id="btnPagar" disabled/);
  assert.match(html, /btnPagar\.disabled = !checkLegal\.checked/);
  assert.match(html, /if \(!planElegido \|\| !checkLegal\.checked\) return;/);
  assert.match(html, /textoAceptacion\(plan, IDIOMA_ACEPTACION\)/);
  assert.match(html, /data-i18n="prec.prueba_antes"/);
});

test("aceptación: el servidor la exige y la repite en el checkout y en la confirmación", () => {
  const checkout = readFileSync(new URL("../functions/crear-checkout-stripe.js", import.meta.url), "utf8");
  assert.match(checkout, /aceptacion\.aceptada !== true \|\| aceptacion\.version !== VERSION_ACEPTACION/);
  assert.match(checkout, /codigo: "falta_aceptacion"/);
  assert.match(checkout, /tipo: "acepta_condiciones_pago"/);
  assert.match(checkout, /consent_collection\[terms_of_service\]/);
  const webhook = readFileSync(new URL("../functions/stripe-webhook.js", import.meta.url), "utf8");
  assert.match(webhook, /emailConfirmacionPago\(obj\)/);
  const terminos = readFileSync(new URL("../terminos.html", import.meta.url), "utf8");
  assert.match(terminos, /103\.m/);
  // Lo proporcional solo para el cierre del servicio, en los tres idiomas.
  assert.match(terminos, /Si Costaviva deja de prestar el servicio/);
  assert.match(terminos, /If Costaviva stops providing the service/);
  assert.match(terminos, /Se o Costaviva deixar de prestar o serviço/);
  assert.doesNotMatch(terminos, /parte proporcional del tiempo|minus the proportional/);
  assert.match(webhook, /textoSiCerramos\(idioma\)/);
});
