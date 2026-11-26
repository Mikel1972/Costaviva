// Black Friday 2x1 (functions/_lib/black-friday.js), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { motivoCodigoBf, enVentanaBf, puedeRegalar, invitacionRegalo, normalizarCodigoBf, BF_DESDE, BF_HASTA, REGALO_HASTA } from "../functions/_lib/black-friday.js";

test("ventana: del viernes 27/11 a las 00:00 al lunes 30/11 a las 23:59:59, hora de España", () => {
  assert.equal(BF_DESDE.toISOString(), "2026-11-26T23:00:00.000Z");
  assert.equal(BF_HASTA.toISOString(), "2026-11-30T23:00:00.000Z");
  assert.equal(enVentanaBf(new Date("2026-11-26T22:59:59Z")), false); // jueves 23:59 en Madrid
  assert.equal(enVentanaBf(new Date("2026-11-26T23:00:00Z")), true);
  assert.equal(enVentanaBf(new Date("2026-11-30T22:59:59Z")), true); // lunes 23:59:59
  assert.equal(enVentanaBf(new Date("2026-11-30T23:00:00Z")), false);
});

test("el código: solo BLACKFRIDAY, dentro de plazo y con el plan anual", () => {
  const dentro = new Date("2026-11-28T12:00:00Z");
  assert.equal(motivoCodigoBf(" black-friday ", "anual", dentro), null);
  assert.equal(normalizarCodigoBf("Black Friday"), "BLACKFRIDAY");
  assert.equal(motivoCodigoBf("OTRO", "anual", dentro), "no_existe");
  assert.equal(motivoCodigoBf("BLACKFRIDAY", "mensual", dentro), "solo_anual");
  assert.equal(motivoCodigoBf("BLACKFRIDAY", "fundador_anual", dentro), "solo_anual");
  assert.equal(motivoCodigoBf("BLACKFRIDAY", "anual", new Date("2026-12-01T10:00:00Z")), "fuera_de_plazo");
  assert.equal(motivoCodigoBf("BLACKFRIDAY", "anual", new Date("2026-11-20T10:00:00Z")), "fuera_de_plazo");
});

test("regalar: solo quien pagó el anual con el código, activo y hasta el 31/12", () => {
  const sub = { codigo_promocional: "BLACKFRIDAY", periodo: "anual", estado: "active" };
  assert.equal(puedeRegalar(sub, new Date("2026-12-15T10:00:00Z")), true);
  assert.equal(puedeRegalar(sub, new Date("2026-12-31T23:30:00Z")), false); // ya 1/1 en Madrid
  assert.equal(puedeRegalar({ ...sub, periodo: "mensual" }, new Date("2026-12-01T10:00:00Z")), false);
  assert.equal(puedeRegalar({ ...sub, codigo_promocional: "OTRO" }, new Date("2026-12-01T10:00:00Z")), false);
  assert.equal(puedeRegalar({ ...sub, estado: "canceled" }, new Date("2026-12-01T10:00:00Z")), false);
  assert.equal(puedeRegalar(null), false);
});

test("la invitación del amigo: 100 %, 12 meses, canjeable hasta el 31/12", () => {
  const inv = invitacionRegalo("amigo@ejemplo.com");
  assert.deepEqual([inv.descuento, inv.duracion_tipo, inv.duracion_meses, inv.caduca_en], [100, "meses", 12, "2026-12-31T22:59:59.000Z"]);
  assert.equal(REGALO_HASTA.toISOString(), "2026-12-31T23:00:00.000Z");
});

test("el servidor comprueba el código antes de cobrar y el webhook solo marca lo validado", () => {
  const checkout = readFileSync(new URL("../functions/crear-checkout-stripe.js", import.meta.url), "utf8");
  assert.match(checkout, /const motivo = motivoCodigoBf\(body\.codigo_bf, pedido\.plan\);/);
  assert.ok(checkout.indexOf("motivoCodigoBf(body.codigo_bf") < checkout.indexOf("await idDePrecio("));
  assert.match(checkout, /else if \(!conBf\) \{/); // sin sumar otro código de Stripe
  const webhook = readFileSync(new URL("../functions/stripe-webhook.js", import.meta.url), "utf8");
  assert.match(webhook, /obj\.metadata\?\.black_friday === MARCA_BF \? \{ codigo_promocional: CODIGO_BF \}/);
  const regalo = readFileSync(new URL("../functions/regalo-black-friday.js", import.meta.url), "utf8");
  // La sesión se valida antes de service_role; el email propio no vale.
  assert.ok(regalo.indexOf("requireSesion(request)") < regalo.indexOf("const db = rest(env)"));
  assert.match(regalo, /codigo: "email_propio"/);
  assert.match(readFileSync(new URL("../functions/_lib/rutas-publicas.js", import.meta.url), "utf8"), /"\/regalo-black-friday"/);
});

test("cinta del Black Friday: solo del 27 al 30/11 (hora de España), en la app solo a quien no paga", async () => {
  const P = await import("../assets/js/plan.js");
  const { cintaBfHtml } = await import("../functions/_lib/black-friday.js");
  const antes = new Date("2026-11-26T22:59:00Z"), dentro = new Date("2026-11-28T10:00:00Z"), ultimo = new Date("2026-11-30T20:00:00Z"), despues = new Date("2026-11-30T23:00:00Z");
  assert.equal(P.ventanaBf(antes), null);
  assert.deepEqual(P.ventanaBf(dentro), { ultimoDia: false });
  assert.deepEqual(P.ventanaBf(ultimo), { ultimoDia: true });
  assert.equal(P.ventanaBf(despues), null);
  assert.equal(P.mostrarCintaBf({ premium: false }, dentro), true);
  assert.equal(P.mostrarCintaBf({ premium: true, en_prueba: true }, dentro), true);
  assert.equal(P.mostrarCintaBf({ premium: true, en_prueba: false }, dentro), false);
  assert.equal(P.mostrarCintaBf(null, dentro), false);
  assert.equal(P.mostrarCintaBf({ premium: false }, despues), false);
  assert.equal(cintaBfHtml("es", antes), "");
  assert.match(cintaBfHtml("es", dentro), /hasta el lunes 30/);
  assert.match(cintaBfHtml("es", ultimo), /último día/);
  assert.match(cintaBfHtml("en", dentro), /2-for-1/);
  assert.match(cintaBfHtml("pt", dentro), /\/empieza\?utm_source=web/);
  assert.equal(cintaBfHtml("es", despues), "");
  // Las fechas del cliente son las mismas que las del servidor.
  const { BF_DESDE, BF_HASTA } = await import("../functions/_lib/black-friday.js");
  assert.equal(P.BF_DESDE_MS, BF_DESDE.getTime());
  assert.equal(P.BF_HASTA_MS, BF_HASTA.getTime());
});
