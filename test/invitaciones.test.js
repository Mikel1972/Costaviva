// Invitaciones con descuento (admin.html, 2026-10-08). Lógica pura y
// handlers con fetch simulado: sin red, sin Stripe ni Resend de verdad.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generarCodigo, normalizarCodigo, codigoValido, formatearCodigo, ALFABETO_CODIGO,
  validarNuevaInvitacion, calcularFin, sumarMeses, finDelDiaMadrid, mesesHasta,
  estadoInvitacion, validarCanje, camposCanje, parametrosCupon, necesitaCupon,
  descuentoAplicaAPlan, emailInvitacion, emailFinInvitacion, enlaceInvitacion,
} from "../functions/_lib/invitaciones.js";
import * as cliente from "../assets/js/invitacion.js";
import { requireAdmin } from "../functions/_lib/admin.js";
import * as adminInv from "../functions/admin-invitaciones.js";
import * as canje from "../functions/canjear-invitacion.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const AHORA = new Date("2026-10-08T10:00:00Z");
const base = (extra = {}) => ({
  id: "11111111-2222-4333-8444-555555555555", codigo: "ABCDEFGHJKLM", email: "ana@ejemplo.com",
  descuento: 100, duracion_tipo: "meses", duracion_meses: 3, duracion_hasta: null,
  caduca_en: "2026-11-07T10:00:00Z", creada_en: "2026-10-08T10:00:00Z",
  email_enviado_en: "2026-10-08T10:00:01Z", user_id: null, inscrito_en: null, acceso_hasta: null,
  descuento_aplicado_en: null, descuento_hasta: null, anulada_en: null, stripe_coupon_id: null, ...extra,
});

// ---------------------------------------------------------------- código
test("código: 12 símbolos del alfabeto sin ambiguos, distinto cada vez", () => {
  assert.equal(ALFABETO_CODIGO.length, 32);
  assert.doesNotMatch(ALFABETO_CODIGO, /[IO01]/);
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const c = generarCodigo();
    assert.ok(codigoValido(c), c);
    vistos.add(c);
  }
  assert.equal(vistos.size, 500);
  assert.equal(generarCodigo(() => new Uint8Array(12).fill(255)), "999999999999");
});

test("código: normaliza lo que pegue la persona y rechaza lo raro", () => {
  assert.equal(normalizarCodigo("abcd-efgh-jklm"), "ABCDEFGHJKLM");
  assert.equal(normalizarCodigo(" ABCD EFGH JKLM "), "ABCDEFGHJKLM");
  for (const malo of ["ABCDEFGHJKL", "ABCDEFGHJKLMN", "ABCDEFGHJKL0", "ABCDEFGHJKLI", "ABC'); drop", "", null, undefined]) {
    assert.equal(normalizarCodigo(malo), null, String(malo));
  }
  assert.equal(formatearCodigo("ABCDEFGHJKLM"), "ABCD-EFGH-JKLM");
});

test("código: el cliente y el servidor aceptan exactamente lo mismo", () => {
  for (const t of ["abcd-efgh-jklm", "ABCDEFGHJKL0", "zzzz zzzz 2222", "x"]) {
    assert.equal(cliente.normalizarCodigo(t), normalizarCodigo(t), t);
  }
  const sql = readFileSync("supabase/migrations/20261008170000_invitaciones.sql", "utf8");
  assert.match(sql, /codigo ~ '\^\[A-HJ-NP-Z2-9\]\{12\}\$'/);
});

// ---------------------------------------------------------------- entrada
test("validación del modal: datos buenos", () => {
  const v = validarNuevaInvitacion({ email: " Ana@Ejemplo.COM ", descuento: 20, duracion_tipo: "meses", duracion_meses: 6, nota: "  club  " }, AHORA);
  assert.equal(v.ok, true);
  assert.deepEqual(v.datos, {
    email: "ana@ejemplo.com", descuento: 20, duracion_tipo: "meses", duracion_meses: 6, duracion_hasta: null,
    caduca_en: "2026-11-07T10:00:00.000Z", nota: "club",
  });
  const f = validarNuevaInvitacion({ email: "a@b.es", descuento: 100, duracion_tipo: "hasta_fecha", duracion_hasta: "2027-01-31", caducidad_dias: 7 }, AHORA);
  assert.equal(f.ok, true);
  assert.equal(f.datos.caduca_en, "2026-10-15T10:00:00.000Z");
  assert.equal(validarNuevaInvitacion({ email: "a@b.es", descuento: 0, duracion_tipo: "siempre" }, AHORA).ok, true);
});

test("validación del modal: rechaza lo que no cuadra", () => {
  const casos = [
    { email: "no-es-email", descuento: 10, duracion_tipo: "siempre" },
    { email: "a@b.es", descuento: 101, duracion_tipo: "siempre" },
    { email: "a@b.es", descuento: -1, duracion_tipo: "siempre" },
    { email: "a@b.es", descuento: 12.5, duracion_tipo: "siempre" },
    { email: "a@b.es", descuento: 10, duracion_tipo: "meses", duracion_meses: 2 },
    { email: "a@b.es", descuento: 10, duracion_tipo: "hasta_fecha", duracion_hasta: "2026-10-08" },
    { email: "a@b.es", descuento: 10, duracion_tipo: "hasta_fecha", duracion_hasta: "2099-01-01" },
    { email: "a@b.es", descuento: 10, duracion_tipo: "hasta_fecha", duracion_hasta: "mañana" },
    { email: "a@b.es", descuento: 10, duracion_tipo: "semanas" },
    { email: "a@b.es", descuento: 10, duracion_tipo: "siempre", caducidad_dias: 0 },
    { email: "a@b.es", descuento: 10, duracion_tipo: "siempre", caducidad_dias: 400 },
  ];
  for (const c of casos) assert.equal(validarNuevaInvitacion(c, AHORA).ok, false, JSON.stringify(c));
});

// ---------------------------------------------------------------- fechas
test("fin: meses como Postgres, para siempre, y hasta una fecha (fin del día en Madrid)", () => {
  assert.equal(sumarMeses(new Date("2026-01-31T09:00:00Z"), 1).toISOString(), "2026-02-28T09:00:00.000Z");
  assert.equal(sumarMeses(new Date("2026-10-08T10:00:00Z"), 12).toISOString(), "2027-10-08T10:00:00.000Z");
  assert.equal(calcularFin(base(), AHORA).toISOString(), "2027-01-08T10:00:00.000Z");
  assert.equal(calcularFin(base({ duracion_tipo: "siempre", duracion_meses: null }), AHORA), null);
  // Invierno (UTC+1) y verano (UTC+2).
  assert.equal(finDelDiaMadrid("2027-01-31").toISOString(), "2027-01-31T23:00:00.000Z");
  assert.equal(finDelDiaMadrid("2027-07-15").toISOString(), "2027-07-15T22:00:00.000Z");
  // Día del cambio de hora (31-10-2027 → el fin es la medianoche del 1-11, ya en invierno).
  assert.equal(finDelDiaMadrid("2027-10-31").toISOString(), "2027-10-31T23:00:00.000Z");
});

test("meses de cupón para 'hasta una fecha': redondeo hacia arriba, mínimo 1", () => {
  assert.equal(mesesHasta("2026-10-20", AHORA), 1);
  assert.equal(mesesHasta("2026-11-08", AHORA), 1);
  assert.equal(mesesHasta("2026-11-09", AHORA), 2);
  assert.equal(mesesHasta("2027-10-08", AHORA), 12);
  assert.equal(mesesHasta("2027-12-31", AHORA), 15);
});

// ---------------------------------------------------------------- estados
test("estados: enviada, caducada, inscrito, terminada, anulada", () => {
  assert.equal(estadoInvitacion(base(), AHORA), "enviada");
  assert.equal(estadoInvitacion(base({ caduca_en: "2026-10-01T00:00:00Z" }), AHORA), "caducada");
  const inscrita = base({ user_id: "u1", inscrito_en: "2026-10-08T09:00:00Z", acceso_hasta: "2027-01-08T09:00:00Z" });
  assert.equal(estadoInvitacion(inscrita, AHORA), "inscrito");
  assert.equal(estadoInvitacion(inscrita, new Date("2027-01-09T00:00:00Z")), "terminada");
  assert.equal(estadoInvitacion({ ...inscrita, acceso_hasta: null }, new Date("2040-01-01")), "inscrito");
  assert.equal(estadoInvitacion({ ...inscrita, anulada_en: "2026-10-08T09:30:00Z" }, AHORA), "anulada");
  // < 100 %: canjeada sin pagar a tiempo → caducada; pagada → terminada al acabar el descuento.
  const parcial = base({ descuento: 20, user_id: "u1", inscrito_en: "2026-10-08T09:00:00Z" });
  assert.equal(estadoInvitacion(parcial, AHORA), "inscrito");
  assert.equal(estadoInvitacion(parcial, new Date("2026-12-01")), "caducada");
  const pagada = { ...parcial, descuento_aplicado_en: "2026-10-09T00:00:00Z", descuento_hasta: "2027-01-09T00:00:00Z" };
  assert.equal(estadoInvitacion(pagada, new Date("2026-12-01")), "inscrito");
  assert.equal(estadoInvitacion(pagada, new Date("2027-02-01")), "terminada");
});

test("canje: solo el email invitado, una vez, sin caducar ni anular", () => {
  const ctx = { userId: "u1", email: "ANA@ejemplo.com", ahora: AHORA };
  assert.equal(validarCanje(null, ctx), "no_existe");
  assert.equal(validarCanje(base(), ctx), "ok");
  assert.equal(validarCanje(base(), { ...ctx, email: "otro@ejemplo.com" }), "otro_email");
  assert.equal(validarCanje(base({ user_id: "u2" }), ctx), "usada");
  assert.equal(validarCanje(base({ user_id: "u1" }), ctx), "ya_canjeada");
  assert.equal(validarCanje(base({ caduca_en: "2026-10-08T09:59:59Z" }), ctx), "caducada");
  assert.equal(validarCanje(base({ anulada_en: "2026-10-08T00:00:00Z", user_id: "u1" }), ctx), "anulada");
  assert.deepEqual(camposCanje(base(), { userId: "u1", ahora: AHORA }), {
    user_id: "u1", inscrito_en: AHORA.toISOString(), acceso_hasta: "2027-01-08T10:00:00.000Z",
  });
  assert.equal(camposCanje(base({ descuento: 50 }), { userId: "u1", ahora: AHORA }).acceso_hasta, null);
});

test("mensajes de canje en el cliente: claros y sin detalle interno", () => {
  for (const c of ["no_existe", "otro_email", "usada", "caducada", "anulada"]) {
    assert.ok(cliente.mensajeCanje(c).length > 20, c);
    assert.equal(cliente.esDefinitivo(c), true);
  }
  assert.match(cliente.mensajeCanje("caducada"), /caducado/);
  assert.match(cliente.mensajeCanje("otro_email"), /otro email/);
  assert.match(cliente.mensajeCanje("loquesea"), /No hemos podido/);
  assert.equal(cliente.esDefinitivo("fallo"), false);
  assert.match(cliente.mensajeExito({ descuento: 100, acceso_hasta: null }), /para siempre/);
  assert.match(cliente.mensajeExito({ descuento: 20 }), /20 %/);
});

// ---------------------------------------------------------------- Stripe
test("cupón de Stripe: un uso, caduca con la invitación, duración correcta", () => {
  assert.equal(necesitaCupon({ descuento: 100 }), false);
  assert.equal(necesitaCupon({ descuento: 0 }), false);
  assert.equal(necesitaCupon({ descuento: 30 }), true);
  const p = parametrosCupon(base({ descuento: 30 }), { id: "inv-1", ahora: AHORA });
  assert.equal(p.get("percent_off"), "30");
  assert.equal(p.get("duration"), "repeating");
  assert.equal(p.get("duration_in_months"), "3");
  assert.equal(p.get("max_redemptions"), "1");
  assert.equal(p.get("redeem_by"), String(Date.parse("2026-11-07T10:00:00Z") / 1000));
  assert.equal(p.get("metadata[invitacion_id]"), "inv-1");
  assert.match(p.get("name"), /^[\x20-\x7E]{1,40}$/);
  const siempre = parametrosCupon(base({ descuento: 30, duracion_tipo: "siempre", duracion_meses: null }), { id: "x", ahora: AHORA });
  assert.equal(siempre.get("duration"), "forever");
  assert.equal(siempre.has("duration_in_months"), false);
  const fecha = parametrosCupon(base({ descuento: 30, duracion_tipo: "hasta_fecha", duracion_meses: null, duracion_hasta: "2027-03-20" }), { id: "x", ahora: AHORA });
  assert.equal(fecha.get("duration_in_months"), "6");
});

test("plan anual: el descuento solo si es para siempre o de 12 meses o más", () => {
  assert.equal(descuentoAplicaAPlan(base({ descuento: 20 }), "monthly", AHORA), true);
  assert.equal(descuentoAplicaAPlan(base({ descuento: 20 }), "annual", AHORA), false);
  assert.equal(descuentoAplicaAPlan(base({ descuento: 20, duracion_meses: 12 }), "annual", AHORA), true);
  assert.equal(descuentoAplicaAPlan(base({ descuento: 20, duracion_tipo: "siempre", duracion_meses: null }), "annual", AHORA), true);
  assert.equal(descuentoAplicaAPlan(base({ descuento: 20 }), "otro", AHORA), false);
});

// ---------------------------------------------------------------- emails
test("email de invitación: quién invita, beneficio, botón con el código, pasos y pie", () => {
  const inv = base({ descuento: 25, duracion_meses: 6, email: "x@y.es" });
  const e = emailInvitacion(inv, { contacto: "admin@x" });
  const enlace = enlaceInvitacion("ABCDEFGHJKLM");
  assert.equal(enlace, "https://costaviva.org/login?alta=1&invitacion=ABCDEFGHJKLM");
  for (const t of [e.texto, e.html]) {
    assert.match(t, /Mikel(<\/strong>)? te invita a Costaviva/);
    assert.ok(t.includes("25 % de descuento"));
    assert.ok(t.includes("durante 6 meses"));
    assert.ok(t.includes("ABCD-EFGH-JKLM"));
    assert.ok(t.includes(enlace) || t.includes(enlace.replace("&", "&amp;")));
    assert.ok(t.includes("7 de noviembre de 2026"));
    assert.ok(t.includes("no te escribiremos más"));
    assert.ok(t.includes("responde a este email"));
    assert.ok(t.includes("precio normal"));
  }
  assert.match(e.html, /<a href="https:\/\/costaviva\.org\/login\?alta=1&amp;invitacion=ABCDEFGHJKLM"[^>]*>Crear mi cuenta<\/a>/);
  assert.match(e.html, /<ol[^>]*>(<li>[^<]+<\/li>){3}<\/ol>/);
  assert.match(e.asunto, /25 %/);
  const gratis = emailInvitacion(base({ duracion_tipo: "siempre", duracion_meses: null }));
  assert.match(gratis.texto, /gratis para siempre, sin tarjeta/);
  assert.match(gratis.texto, /escríbenos desde https:\/\/costaviva\.org/);
  const fecha = emailInvitacion(base({ duracion_tipo: "hasta_fecha", duracion_meses: null, duracion_hasta: "2027-01-31" }));
  assert.match(fecha.texto, /hasta el 31 de enero de 2027/);
});

test("email de invitación: escapa todo lo interpolado (E6)", () => {
  const e = emailInvitacion(base(), { quienInvita: '<b>"x"</b>' });
  assert.ok(!e.html.includes("<b>\"x\""));
  assert.ok(e.html.includes("&lt;b&gt;&quot;x&quot;&lt;/b&gt;"));
});

test("email de fin de acceso: antes y después, con el enlace de planes", () => {
  const antes = emailFinInvitacion({ acceso_hasta: "2026-10-15T22:00:00Z" }, AHORA);
  assert.match(antes.asunto, /termina el 15 de octubre de 2026/);
  assert.match(antes.texto, /costaviva\.org\/suscripcion/);
  const despues = emailFinInvitacion({ acceso_hasta: "2026-10-07T22:00:00Z" }, AHORA);
  assert.match(despues.asunto, /ha terminado/);
});

test("remitente ASCII (trampa 13)", async () => {
  const { REMITENTE_AVISOS } = await import("../functions/_lib/email.js");
  assert.match(REMITENTE_AVISOS, /^[\x20-\x7E]+$/);
});

// ---------------------------------------------------------------- handlers
let fetchOriginal;
let llamadas;
beforeEach(() => { fetchOriginal = globalThis.fetch; llamadas = []; });
afterEach(() => { globalThis.fetch = fetchOriginal; });

const respuesta = (cuerpo, status = 200) => new Response(cuerpo === undefined ? "" : JSON.stringify(cuerpo), { status });

// Simula Supabase, Stripe y Resend. `rutas` decide la respuesta por URL.
function simular(rutas) {
  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url);
    llamadas.push({ url: u, metodo: opciones.method || "GET", cuerpo: opciones.body, cabeceras: opciones.headers || {} });
    for (const [patron, fn] of rutas) if (patron.test(u)) return fn(u, opciones);
    throw new Error(`fetch no simulado: ${u}`);
  };
}
const sesion = (email = "admin@x.es") => [/\/auth\/v1\/user$/, (u, o) =>
  /Bearer (tok-admin|tok-user)$/.test(o.headers.Authorization) ? respuesta({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", email, email_confirmed_at: "2026-01-01" }) : respuesta({ msg: "bad" }, 401)];
const esAdmin = (valor) => [/\/rpc\/es_admin$/, () => respuesta(valor)];
const peticion = (metodo, cuerpo, token = "tok-admin") => new Request("https://costaviva.org/admin-invitaciones", {
  method: metodo,
  headers: token ? { Authorization: `Bearer ${token}`, "content-type": "application/json" } : {},
  body: cuerpo ? JSON.stringify(cuerpo) : undefined,
});
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "srk", RESEND_API_KEY: "re", STRIPE_SECRET_KEY: "sk_test", ADMIN_EMAIL: "admin@x.es" };

test("guard de admin: sin token, token malo o no admin → rechazado; solo `true` pasa", async () => {
  simular([sesion(), esAdmin(true)]);
  assert.equal((await requireAdmin(peticion("GET", null, null))).status, 401);
  assert.equal((await requireAdmin(peticion("GET", null, "otro"))).status, 401);
  assert.equal((await requireAdmin(peticion("GET"))).ok, true);
  for (const v of [false, null, "true", 1]) {
    simular([sesion(), esAdmin(v)]);
    assert.equal((await requireAdmin(peticion("GET"))).status, 403, String(v));
  }
  simular([sesion(), [/es_admin/, () => respuesta({ message: "x" }, 400)]]);
  assert.equal((await requireAdmin(peticion("GET"))).status, 403);
  simular([sesion(), [/es_admin/, () => { throw new Error("red"); }]]);
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    assert.equal((await requireAdmin(peticion("GET"))).status, 403);
  } finally {
    console.error = errorOriginal;
  }
});

test("admin-invitaciones: un no admin no llega a service_role, Stripe ni Resend", async () => {
  simular([sesion(), esAdmin(false)]);
  const r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "crear", email: "a@b.es", descuento: 100, duracion_tipo: "siempre" }), env: ENV });
  assert.equal(r.status, 403);
  assert.ok(llamadas.every((l) => !/stripe|resend|invitaciones/.test(l.url)));
  assert.ok(llamadas.every((l) => !JSON.stringify(l.cabeceras).includes("srk")));
});

test("admin-invitaciones crear (30 %): cupón con idempotencia, guarda, envía y marca después", async () => {
  let insertado;
  simular([
    sesion(), esAdmin(true),
    [/api\.stripe\.com\/v1\/coupons$/, () => respuesta({ id: "cup_1" })],
    [/rest\/v1\/invitaciones$/, (u, o) => { insertado = JSON.parse(o.body); return respuesta([{ ...insertado, creada_en: AHORA.toISOString() }], 201); }],
    [/api\.resend\.com/, () => respuesta({ id: "em_1" })],
    [/rest\/v1\/invitaciones\?id=eq\./, (u, o) => respuesta([{ ...insertado, ...JSON.parse(o.body) }])],
  ]);
  const r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "crear", email: "Ana@B.es", descuento: 30, duracion_tipo: "meses", duracion_meses: 3, nota: "club" }), env: ENV });
  assert.equal(r.status, 201);
  const cuerpo = await r.json();
  assert.equal(cuerpo.email_enviado, true);
  assert.equal(cuerpo.invitacion.estado, "enviada");
  assert.equal(insertado.email, "ana@b.es");
  assert.equal(insertado.stripe_coupon_id, "cup_1");
  assert.ok(codigoValido(insertado.codigo));
  const orden = llamadas.map((l) => (/stripe/.test(l.url) ? "stripe" : /resend/.test(l.url) ? "resend" : /invitaciones\?id/.test(l.url) ? "marcar" : /invitaciones$/.test(l.url) ? "insert" : "auth"));
  assert.deepEqual(orden.filter((x) => x !== "auth"), ["stripe", "insert", "resend", "marcar"]);
  const stripe = llamadas.find((l) => /stripe/.test(l.url));
  assert.equal(stripe.cabeceras["Idempotency-Key"], `invitacion-${insertado.id}`);
  const email = JSON.parse(llamadas.find((l) => /resend/.test(l.url)).cuerpo);
  assert.match(email.from, /^[\x20-\x7E]+$/);
  assert.equal(email.reply_to, "admin@x.es");
  assert.deepEqual(email.to, ["ana@b.es"]);
});

test("admin-invitaciones crear: si Resend falla, no se marca como enviada y no se filtra el detalle", async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    let insertado;
    simular([
      sesion(), esAdmin(true),
      [/rest\/v1\/invitaciones$/, (u, o) => { insertado = JSON.parse(o.body); return respuesta([insertado], 201); }],
      [/api\.resend\.com/, () => new Response("422 dominio no verificado para ana@b.es", { status: 422 })],
    ]);
    const r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "crear", email: "ana@b.es", descuento: 100, duracion_tipo: "siempre" }), env: ENV });
    const texto = await r.text();
    assert.equal(r.status, 201);
    assert.equal(JSON.parse(texto).email_enviado, false);
    assert.equal(JSON.parse(texto).email_error, "fallo_envio");
    assert.ok(!texto.includes("dominio no verificado"));
    assert.ok(!llamadas.some((l) => /invitaciones\?id=/.test(l.url)), "no debe marcar email_enviado_en");
    assert.ok(!llamadas.some((l) => /stripe/.test(l.url)), "100 % no usa Stripe");
  } finally {
    console.error = errorOriginal;
  }
});

test("admin-invitaciones crear: Stripe falla → nada guardado ni enviado, error genérico", async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    simular([sesion(), esAdmin(true), [/api\.stripe\.com/, () => new Response('{"error":{"message":"acct_123 logs https://dashboard"}}', { status: 400 })]]);
    const r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "crear", email: "a@b.es", descuento: 40, duracion_tipo: "siempre" }), env: ENV });
    const texto = await r.text();
    assert.equal(r.status, 502);
    assert.ok(!/acct_|dashboard/.test(texto));
    assert.ok(!llamadas.some((l) => /invitaciones|resend/.test(l.url)));
  } finally {
    console.error = errorOriginal;
  }
});

test("admin-invitaciones: reenviar solo si está 'enviada'; id validado como UUID", async () => {
  simular([sesion(), esAdmin(true), [/invitaciones\?id=eq\..*select/, () => respuesta([base({ caduca_en: "2020-01-01T00:00:00Z" })])]]);
  let r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "reenviar", id: base().id }), env: ENV });
  assert.equal(r.status, 409);
  r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "reenviar", id: "1 or 1=1" }), env: ENV });
  assert.equal(r.status, 400);
});

test("admin-invitaciones: anular borra el cupón sin usar y marca anulada_en", async () => {
  simular([
    sesion(), esAdmin(true),
    [/invitaciones\?id=eq\..*select/, () => respuesta([base({ descuento: 20, stripe_coupon_id: "cup_9" })])],
    [/api\.stripe\.com\/v1\/coupons\/cup_9$/, () => respuesta({ deleted: true })],
    [/invitaciones\?id=eq\..*anulada_en=is\.null/, (u, o) => respuesta([base({ descuento: 20, ...JSON.parse(o.body) })])],
  ]);
  const r = await adminInv.onRequestPost({ request: peticion("POST", { accion: "anular", id: base().id }), env: ENV });
  const c = await r.json();
  assert.equal(r.status, 200);
  assert.equal(c.invitacion.estado, "anulada");
  assert.equal(c.cupon_borrado, true);
  assert.ok(llamadas.some((l) => l.metodo === "DELETE" && /cup_9/.test(l.url)));
});

test("canjear-invitacion: otro email rechazado; el canje es condicionado (un solo uso)", async () => {
  const req = (codigo) => new Request("https://costaviva.org/canjear-invitacion", {
    method: "POST", headers: { Authorization: "Bearer tok-user", "content-type": "application/json" }, body: JSON.stringify({ codigo }),
  });
  simular([sesion("otra@b.es"), [/invitaciones\?codigo=eq\./, () => respuesta([base()])]]);
  let r = await canje.onRequestPost({ request: req("abcd-efgh-jklm"), env: ENV });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).codigo, "otro_email");

  // Carrera perdida: el PATCH condicionado no devuelve filas → "usada".
  simular([sesion("ana@ejemplo.com"), [/invitaciones\?codigo=eq\./, () => respuesta([base()])], [/invitaciones\?id=eq\..*user_id=is\.null/, () => respuesta([])]]);
  r = await canje.onRequestPost({ request: req("ABCDEFGHJKLM"), env: ENV });
  assert.equal((await r.json()).codigo, "usada");

  simular([
    sesion("ana@ejemplo.com"),
    [/invitaciones\?codigo=eq\./, () => respuesta([base()])],
    [/invitaciones\?id=eq\..*user_id=is\.null&anulada_en=is\.null/, (u, o) => respuesta([{ ...base(), ...JSON.parse(o.body) }])],
    [/perfiles\?id=eq\./, () => new Response(null, { status: 204 })],
  ]);
  r = await canje.onRequestPost({ request: req("ABCDEFGHJKLM"), env: ENV });
  const ok = await r.json();
  assert.equal(ok.ok, true);
  assert.equal(ok.descuento, 100);
  assert.ok(ok.acceso_hasta);

  r = await canje.onRequestPost({ request: req("no-vale"), env: ENV });
  assert.equal((await r.json()).codigo, "no_existe");
});

// ---------------------------------------------------------------- repo
test("migración: RLS sin policies, search_path con extensions y EXECUTE mínimo (D5-D10)", () => {
  const sql = readFileSync("supabase/migrations/20261008170000_invitaciones.sql", "utf8");
  assert.match(sql, /alter table public\.invitaciones enable row level security/);
  assert.match(sql, /revoke all on public\.invitaciones from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /disable row level security/i);
  const definer = (sql.match(/security definer/g) || []).length;
  assert.equal((sql.match(/security definer\s*\n\s*set search_path = public, extensions\n/g) || []).length, definer);
  for (const fn of ["invitacion_gratis_vigente", "fin_prueba_fuera_de_ciclo", "invitaciones_pendiente_aviso_fin", "marcar_invitacion_aviso_fin"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, (anon, authenticated|authenticated, anon)`), fn);
  }
  for (const fn of ["mi_estado_suscripcion", "mi_invitacion_descuento"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon`), fn);
  }
  const baseline = JSON.parse(readFileSync("supabase/baseline-seguridad.json", "utf8"));
  assert.deepEqual(baseline.tablas.find((t) => t.tablename === "invitaciones"), { tablename: "invitaciones", rls_enabled: true, policies: [] });
});

test("rutas: los dos endpoints nuevos pasan el middleware; sus librerías no", () => {
  assert.equal(esRutaPermitida("/admin-invitaciones"), true);
  assert.equal(esRutaPermitida("/canjear-invitacion"), true);
  assert.equal(esRutaPermitida("/functions/_lib/invitaciones.js"), false);
  assert.equal(esRutaPermitida("/assets/js/invitacion.js"), true);
});
