// País de residencia obligatorio antes de pagar (2026-11-25, aprobado por
// Mikel; CLAUDE.md "País de residencia obligatorio antes de pagar").
// Validación, zona por residencia (no por IP), Bizum solo con España y
// pruebas de residencia para el IVA. Sin red: el checkout se prueba con un
// fetch falso (ni Stripe ni Supabase de verdad).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import {
  PAISES, paisResidenciaValido, motivoBizumResidencia, leerPaisResidencia, zonaPorResidencia,
  paisDeUso, pruebasResidencia,
} from "../functions/_lib/pais-residencia.js";
import { opcionesPaises } from "../assets/js/pais-residencia.js";
import { lineasInforme } from "../functions/_lib/pais-tarjeta.js";

const config = JSON.parse(readFileSync(new URL("../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("lista: los 249 códigos ISO 3166-1 alfa-2 y XK, sin repetir, con nombre en es/en/pt", () => {
  assert.equal(PAISES.length, 250);
  assert.equal(new Set(PAISES).size, 250);
  for (const c of ["ES", "PT", "NZ", "AU", "GB", "US", "XK"]) assert.ok(PAISES.includes(c), c);
  for (const idioma of ["es", "en", "pt"]) {
    const o = opcionesPaises(idioma);
    assert.equal(o.length, 250);
    assert.ok(o.every((x) => x.nombre && x.nombre !== x.codigo), `${idioma}: país sin nombre`);
  }
  assert.equal(opcionesPaises("es").find((x) => x.codigo === "NZ").nombre, "Nueva Zelanda");
  assert.equal(opcionesPaises("en").find((x) => x.codigo === "ES").nombre, "Spain");
  assert.equal(opcionesPaises("pt").find((x) => x.codigo === "ES").nombre, "Espanha");
  // Orden alfabético del idioma: Alemania antes que España en español.
  const es = opcionesPaises("es").map((x) => x.codigo);
  assert.ok(es.indexOf("DE") < es.indexOf("ES"));
});

test("validación: solo ISO-2 reales; vacío = falta, raro = inválido", () => {
  assert.equal(paisResidenciaValido("es"), "ES");
  assert.equal(paisResidenciaValido(" nz "), "NZ");
  for (const x of ["", "XX", "T1", "ESP", "E", "ZZ", "EU", null, undefined, 34]) assert.equal(paisResidenciaValido(x), null, String(x));
  assert.deepEqual(leerPaisResidencia({ pais_residencia: "pt" }), { pais: "PT" });
  assert.deepEqual(leerPaisResidencia({}), { error: "falta_pais_residencia" });
  assert.deepEqual(leerPaisResidencia({ pais_residencia: "  " }), { error: "falta_pais_residencia" });
  assert.deepEqual(leerPaisResidencia({ pais_residencia: "XX" }), { error: "pais_residencia_invalido" });
  assert.deepEqual(leerPaisResidencia({ pais_residencia: "Spain" }), { error: "pais_residencia_invalido" });
  assert.deepEqual(leerPaisResidencia(null), { error: "falta_pais_residencia" });
});

test("zona por residencia: misma lógica que zonaDePais", () => {
  assert.equal(zonaPorResidencia(config, "ES").id, "ue_eee");
  assert.equal(zonaPorResidencia(config, "NO").id, "ue_eee");
  assert.equal(zonaPorResidencia(config, "NZ").id, "nz");
  assert.equal(zonaPorResidencia(config, "NZ").moneda, "NZD");
  // Sin zona activa (o inválido): "resto".
  assert.equal(zonaPorResidencia(config, "AR").id, config.zona_por_defecto);
  assert.equal(zonaPorResidencia(config, "XX").id, config.zona_por_defecto);
});

test("Bizum: solo con residencia en España", () => {
  assert.equal(motivoBizumResidencia("ES"), null);
  assert.equal(motivoBizumResidencia("es"), null);
  for (const p of ["PT", "FR", "NZ", "", null, "XX"]) assert.equal(motivoBizumResidencia(p), "bizum_solo_residentes_espana", String(p));
});

test("uso: el país visto más días (desempate alfabético), sin XX/T1", () => {
  assert.equal(paisDeUso(null), null);
  assert.equal(paisDeUso({}), null);
  assert.equal(paisDeUso({ "2026-11-20": ["NZ"], "2026-11-21": ["NZ", "ES"], "2026-11-22": ["ES", "XX"], "2026-11-23": ["NZ"] }), "NZ");
  assert.equal(paisDeUso({ "2026-11-20": ["PT"], "2026-11-21": ["ES"] }), "ES");
  assert.equal(paisDeUso({ "2026-11-20": ["T1", "XX"] }), null);
});

test("pruebas IVA: 2 que coinciden bastan; una sola o contradictorias, no", () => {
  assert.deepEqual(pruebasResidencia({ residencia: "ES", tarjeta: "ES", uso: "ES" }),
    { suficiente: true, pais: "ES", coinciden: 3, pruebas: 3, contradice: false });
  assert.deepEqual(pruebasResidencia({ residencia: "ES", tarjeta: "ES" }),
    { suficiente: true, pais: "ES", coinciden: 2, pruebas: 2, contradice: false });
  // Dos coinciden y la tercera no: bastan, pero se marca.
  assert.deepEqual(pruebasResidencia({ residencia: "ES", tarjeta: "FR", uso: "ES" }),
    { suficiente: true, pais: "ES", coinciden: 2, pruebas: 3, contradice: true });
  // La tarjeta y el uso pueden ganar a la residencia declarada.
  assert.equal(pruebasResidencia({ residencia: "PT", tarjeta: "NZ", uso: "NZ" }).pais, "NZ");
  // Una sola prueba.
  assert.deepEqual(pruebasResidencia({ residencia: "ES" }),
    { suficiente: false, pais: null, coinciden: 1, pruebas: 1, contradice: false });
  // Tres países distintos o dos que se contradicen.
  assert.equal(pruebasResidencia({ residencia: "ES", tarjeta: "FR", uso: "PT" }).suficiente, false);
  assert.equal(pruebasResidencia({ residencia: "ES", tarjeta: "NZ" }).contradice, true);
  // Valores raros no cuentan como prueba.
  assert.equal(pruebasResidencia({ residencia: "XX", tarjeta: "T1", uso: "" }).pruebas, 0);
  assert.equal(pruebasResidencia().pruebas, 0);
});

test("informe: residencia ≠ tarjeta por zonas y pruebas del IVA, solo recuentos", () => {
  // Sin config ni residencia: igual que antes.
  assert.deepEqual(lineasInforme([]), lineasInforme([], config));
  const filas = [
    { zona_precio: "ue_eee", zona_tarjeta: "nz", pais_residencia: "ES", pais_tarjeta: "NZ", paises_uso: { "2026-11-24": ["NZ"] } },
    { zona_precio: "ue_eee", zona_tarjeta: "ue_eee", pais_residencia: "ES", pais_tarjeta: "ES", paises_uso: null },
    { zona_precio: "ue_eee", zona_tarjeta: "ue_eee", pais_residencia: "PT", pais_tarjeta: "ES", paises_uso: { "2026-11-24": ["FR"] } },
    { zona_precio: "nz", zona_tarjeta: null, pais_residencia: "NZ", pais_tarjeta: null, paises_uso: null },
  ];
  const txt = lineasInforme(filas, config).join("\n");
  assert.match(txt, /Residencia declarada ≠ tarjeta \(zona residencia → zona tarjeta\): ue_eee → nz: 1 · ue_eee → ue_eee: 1/);
  assert.match(txt, /\(4 con residencia declarada\): 2 con 2 o más que coinciden \(1 con una tercera que no coincide\) · 1 con una sola · 1 que se contradicen/);
  // Nunca países ni personas: solo zonas y números.
  assert.doesNotMatch(txt.replace(/ue_eee|nz|resto/g, ""), /\b(ES|PT|NZ|FR)\b|@|cus_|sub_/);
  // Sin filas con residencia, ninguna línea de residencia.
  assert.doesNotMatch(lineasInforme([{ zona_precio: "ue_eee", zona_tarjeta: "nz" }], config).join("\n"), /Residencia/);
});

test("migración: solo pais_residencia con check ISO-2, sin BEGIN/COMMIT ni tablas/policies", () => {
  const sql = leer("supabase/migrations/20261126090000_pais_residencia.sql");
  assert.match(sql, /add column if not exists pais_residencia text/);
  assert.match(sql, /check \(pais_residencia is null or pais_residencia ~ '\^\[A-Z\]\{2\}\$'\)/);
  const codigo = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(codigo, /\b(begin|commit)\s*;/i);
  assert.doesNotMatch(codigo, /create (table|policy)|grant|drop column/i);
  assert.equal((codigo.match(/add column/g) || []).length, 1);
});

test("página: selector obligatorio, nota, sin on*= y Bizum solo con España", () => {
  const h = leer("suscripcion.html");
  assert.match(h, /<select id="paisResidencia" required/);
  assert.match(h, /data-i18n="prec.nota_residencia">El precio depende de tu país de residencia \(impuestos y moneda locales\)\./);
  assert.match(h, /pais_residencia: paisResidencia\(\)/);
  assert.match(h, /motivoBizumResidencia\(paisResidencia\(\)\) === null/);
  assert.doesNotMatch(h, /\son[a-z]+\s*=/i);
  for (const f of ["privacidad.html", "en/privacidad.html", "pt/privacidad.html"]) {
    assert.match(leer(f), /país de residencia|country of residence|país de residência/, f);
  }
});

// --- Checkout y webhook con red simulada ---
register("data:text/javascript," + encodeURIComponent(`
import { readFileSync } from "node:fs";
export async function load(url, ctx, next) {
  if (url.startsWith("file:") && url.endsWith(".json")) return { format: "json", source: readFileSync(new URL(url)), shortCircuit: true };
  return next(url, ctx);
}`));

const USER = "11111111-2222-4333-8444-555555555555";
const { VERSION } = await import("../assets/js/consentimiento.js");
function simularCheckout() {
  const sesiones = [];
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) return json({ id: USER, email: "persona@example.com" });
    if (u.includes("/rest/v1/rpc/plazas_fundador_restantes")) return json(10);
    if (u.includes("/rest/v1/rpc/")) return json(null);
    if (u.includes("/rest/v1/eventos_uso")) return json(null, 201);
    if (u.includes("/rest/v1/suscripciones")) return json([]);
    if (u.startsWith("https://api.stripe.com/v1/prices")) return json({ data: [{ id: "price_falso" }] });
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      sesiones.push(Object.fromEntries(new URLSearchParams(init.body)));
      return json({ url: "https://checkout.stripe.test/s" });
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  return sesiones;
}
const ENV = { COBRO_ACTIVO: "true", BIZUM_ACTIVO: "true", STRIPE_SECRET_KEY: "sk_test_falsa" };
function peticion(cuerpo, paisIp) {
  return new Request("https://costaviva.test/crear-checkout-stripe", {
    method: "POST",
    headers: { Authorization: "Bearer token", "content-type": "application/json", "CF-IPCountry": paisIp },
    body: JSON.stringify({ idioma: "es", aceptacion: { version: VERSION, idioma: "es", aceptada: true }, ...cuerpo }),
  });
}

test("checkout: sin país de residencia, 400 falta_pais_residencia sin tocar Stripe", async () => {
  const { onRequestPost } = await import("../functions/crear-checkout-stripe.js");
  const sesiones = simularCheckout();
  for (const [cuerpo, codigo] of [[{}, "falta_pais_residencia"], [{ pais_residencia: "XX" }, "pais_residencia_invalido"]]) {
    const r = await onRequestPost({ request: peticion({ ambito: "regional", plan: "anual", ...cuerpo }, "ES"), env: ENV });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, codigo);
  }
  assert.equal(sesiones.length, 0);
});

test("checkout: la zona y el precio salen de la residencia, no de la IP; metadatos con los dos", async () => {
  const { onRequestPost } = await import("../functions/crear-checkout-stripe.js");
  const sesiones = simularCheckout();
  // Conexión desde España (o una VPN), residencia en Nueva Zelanda: NZD.
  const r = await onRequestPost({ request: peticion({ ambito: "regional", plan: "anual", pais_residencia: "nz" }, "ES"), env: ENV });
  assert.equal(r.status, 200);
  const s = sesiones[0];
  assert.equal(s.currency, "nzd");
  assert.equal(s["metadata[zona]"], "nz");
  assert.equal(s["metadata[pais_residencia]"], "NZ");
  assert.equal(s["metadata[pais_ip]"], "ES");
  assert.equal(s["subscription_data[metadata][pais_residencia]"], "NZ");
  assert.equal(s["subscription_data[metadata][zona]"], "nz");
  // Al revés: conexión desde NZ, residencia en Portugal: EUR, zona UE.
  await onRequestPost({ request: peticion({ ambito: "regional", plan: "mensual", pais_residencia: "PT" }, "NZ"), env: ENV });
  assert.equal(sesiones[1].currency, undefined);
  assert.equal(sesiones[1]["metadata[zona]"], "ue_eee");
  assert.equal(sesiones[1]["metadata[pais_ip]"], "NZ");
});

test("checkout Bizum: solo con residencia en España (aunque la conexión sea española)", async () => {
  const { onRequestPost } = await import("../functions/crear-checkout-stripe.js");
  const sesiones = simularCheckout();
  const no = await onRequestPost({ request: peticion({ metodo: "bizum", ambito: "regional", plan: "anual", pais_residencia: "PT" }, "ES"), env: ENV });
  assert.equal(no.status, 403);
  assert.equal((await no.json()).codigo, "bizum_solo_residentes_espana");
  assert.equal(sesiones.length, 0);
  // Residente en España conectado desde fuera: sí.
  const si = await onRequestPost({ request: peticion({ metodo: "bizum", ambito: "regional", plan: "anual", pais_residencia: "ES" }, "FR"), env: ENV });
  assert.equal(si.status, 200);
  assert.equal(sesiones[0]["payment_method_types[0]"], "bizum");
  assert.equal(sesiones[0]["metadata[pais_residencia]"], "ES");
  assert.equal(sesiones[0]["metadata[pais_ip]"], "FR");
  assert.equal(sesiones[0]["metadata[zona]"], "ue_eee");
});

test("/precios-zona: ?pais manda sobre la IP y devuelve pais_ip para el selector", async () => {
  const { onRequestGet } = await import("../functions/precios-zona.js");
  const pedir = async (q, ip) => (await onRequestGet({ request: new Request(`https://costaviva.test/precios-zona${q}`, { headers: { "CF-IPCountry": ip } }), env: ENV })).json();
  const a = await pedir("", "ES");
  assert.equal(a.pais_ip, "ES"); assert.equal(a.zona, "ue_eee"); assert.equal(a.bizum_activo, true);
  const b = await pedir("?pais=NZ", "ES");
  assert.equal(b.pais_ip, "ES"); assert.equal(b.zona, "nz"); assert.equal(b.moneda, "NZD"); assert.equal(b.bizum_activo, false);
  const c = await pedir("?pais=PT", "ES");
  assert.equal(c.zona, "ue_eee"); assert.equal(c.bizum_activo, false);
  const d = await pedir("?pais=XX", "XX");
  assert.equal(d.pais_ip, null); assert.equal(d.zona, config.zona_por_defecto);
});

test("webhook: guarda pais_residencia aparte y no rompe sin la migración", async () => {
  const { guardarPaisResidencia } = await import("../functions/stripe-webhook.js");
  const llamadas = [];
  let status = 204;
  globalThis.fetch = async (url, init = {}) => { llamadas.push({ url: String(url), init }); return new Response(null, { status }); };
  assert.equal(await guardarPaisResidencia("srk", USER, { pais_residencia: "nz" }), true);
  assert.equal(llamadas[0].init.method, "PATCH");
  assert.match(llamadas[0].url, new RegExp(`suscripciones\\?user_id=eq\\.${USER}$`));
  assert.deepEqual(JSON.parse(llamadas[0].init.body), { pais_residencia: "NZ" });
  status = 400; // columna sin crear
  assert.equal(await guardarPaisResidencia("srk", USER, { pais_residencia: "ES" }), false);
  assert.equal(await guardarPaisResidencia("srk", USER, { pais_residencia: "XX" }), false);
  assert.equal(await guardarPaisResidencia("srk", "no-uuid", { pais_residencia: "ES" }), false);
  assert.equal(llamadas.length, 2);
  const w = leer("functions/stripe-webhook.js");
  assert.equal((w.match(/await guardarPaisResidencia\(serviceRoleKey, userId, obj\.metadata\)/g) || []).length, 2);
});
