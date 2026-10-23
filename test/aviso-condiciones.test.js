// Aviso de las condiciones de 2026-10 (scripts/avisos/condiciones-2026-10.mjs):
// lo puro, sin red. Selección, fechas, los 3 idiomas y que nada imprima emails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  idiomaDe, fechaInclusion, fechaLarga, pendienteDeAviso, listoParaIncluir, limiteIncluir, cupoHoy,
  recuento, emailAviso, limpiar, log, main, DIAS_PREAVISO, LIMITE_DIA, IDIOMAS, FIRMA, REMITENTE,
} from "../scripts/avisos/condiciones-2026-10.mjs";

const AHORA = new Date("2026-10-23T09:00:00Z");
const dias = (n) => new Date(AHORA.getTime() - n * 24 * 3600 * 1000).toISOString();
const perfil = (extra = {}) => ({
  id: "u1",
  email: "pescador@ejemplo.com",
  consiente_uso_datos_capturas: false,
  aviso_condiciones_en: null,
  oposicion_estadisticas_en: null,
  ...extra,
});
const usuario = (extra = {}) => ({ email_confirmed_at: "2026-09-01T00:00:00Z", user_metadata: {}, ...extra });

test("idioma: user_metadata.idioma, luego el de la hoja del alta, luego español", () => {
  assert.equal(idiomaDe({ idioma: "en" }), "en");
  assert.equal(idiomaDe({ idioma: "pt" }), "pt");
  assert.equal(idiomaDe({ idioma: "pt-PT" }), "pt");
  assert.equal(idiomaDe({ condiciones_alta_idioma: "en" }), "en");
  assert.equal(idiomaDe({ idioma: "fr", condiciones_alta_idioma: "pt" }), "pt");
  assert.equal(idiomaDe({ idioma: "fr" }), "es");
  assert.equal(idiomaDe({}), "es");
  assert.equal(idiomaDe(undefined), "es");
});

test("fecha de inclusión = envío + 15 días, en hora de Madrid", () => {
  assert.equal(DIAS_PREAVISO, 15);
  assert.equal(fechaInclusion(AHORA).toISOString(), "2026-11-07T09:00:00.000Z");
  assert.equal(fechaLarga(fechaInclusion(AHORA), "es"), "7 de noviembre de 2026");
  assert.equal(fechaLarga(fechaInclusion(AHORA), "en"), "7 November 2026");
  assert.equal(fechaLarga(fechaInclusion(AHORA), "pt"), "7 de novembro de 2026");
  // 23:30 en Madrid del día 23 (21:30 UTC): la fecha es la de Madrid, 7 nov.
  assert.equal(fechaLarga(fechaInclusion("2026-10-23T21:30:00Z"), "es"), "7 de noviembre de 2026");
  // Cambio de hora (25 oct): siguen siendo 15 × 24 h.
  assert.equal(limiteIncluir(new Date("2026-11-07T09:00:00Z")).toISOString(), "2026-10-23T09:00:00.000Z");
});

test("selección del aviso: solo consiente=false, sin aviso, sin oposición, email confirmado y no de prueba", () => {
  assert.equal(pendienteDeAviso(perfil(), usuario()), true);
  assert.equal(pendienteDeAviso(perfil({ consiente_uso_datos_capturas: true }), usuario()), false);
  assert.equal(pendienteDeAviso(perfil({ consiente_uso_datos_capturas: null }), usuario()), false);
  assert.equal(pendienteDeAviso(perfil({ aviso_condiciones_en: dias(1) }), usuario()), false, "idempotente");
  assert.equal(pendienteDeAviso(perfil({ oposicion_estadisticas_en: dias(1) }), usuario()), false);
  assert.equal(pendienteDeAviso(perfil(), usuario({ email_confirmed_at: null })), false);
  assert.equal(pendienteDeAviso(perfil(), undefined), false, "sin cuenta en auth");
  assert.equal(pendienteDeAviso(perfil({ email: null }), usuario()), false);
  assert.equal(pendienteDeAviso(perfil({ email: "Prueba@Ejemplo.com" }), usuario(), new Set(["prueba@ejemplo.com"])), false);
});

test("selección de incluir: avisado hace ≥ 15 días, sin oposición y aún a false", () => {
  assert.equal(listoParaIncluir(perfil({ aviso_condiciones_en: dias(15) }), AHORA), true);
  assert.equal(listoParaIncluir(perfil({ aviso_condiciones_en: dias(20) }), AHORA), true);
  assert.equal(listoParaIncluir(perfil({ aviso_condiciones_en: dias(14.9) }), AHORA), false, "antes de tiempo, nunca");
  assert.equal(listoParaIncluir(perfil(), AHORA), false, "sin aviso, nunca");
  assert.equal(listoParaIncluir(perfil({ aviso_condiciones_en: dias(20), oposicion_estadisticas_en: dias(3) }), AHORA), false);
  assert.equal(listoParaIncluir(perfil({ aviso_condiciones_en: dias(20), consiente_uso_datos_capturas: true }), AHORA), false);
});

test("cupo diario: LIMITE_DIA menos lo enviado en las últimas 24 h", () => {
  assert.ok(LIMITE_DIA > 0 && LIMITE_DIA <= 100, "plan gratuito de Resend: 100 al día");
  const enviadosHoy = Array.from({ length: 30 }, (_, i) => perfil({ id: `h${i}`, aviso_condiciones_en: dias(0.5) }));
  const ayer = Array.from({ length: 50 }, (_, i) => perfil({ id: `a${i}`, aviso_condiciones_en: dias(1.5) }));
  assert.equal(cupoHoy([...enviadosHoy, ...ayer, perfil()], AHORA), LIMITE_DIA - 30);
  assert.equal(cupoHoy(Array.from({ length: 200 }, () => perfil({ aviso_condiciones_en: dias(0.1) })), AHORA), 0);
  assert.equal(cupoHoy([], AHORA, 10), 10);
});

test("recuento: por idioma, sin datos personales", () => {
  const perfiles = [
    perfil({ id: "1" }),
    perfil({ id: "2" }),
    perfil({ id: "3" }),
    perfil({ id: "4", consiente_uso_datos_capturas: true }),
    perfil({ id: "5", aviso_condiciones_en: dias(2) }),
    perfil({ id: "6", aviso_condiciones_en: dias(16) }),
    perfil({ id: "7", aviso_condiciones_en: dias(16), oposicion_estadisticas_en: dias(5) }),
    perfil({ id: "8" }),
  ];
  const usuarios = new Map([
    ["1", usuario({ user_metadata: { idioma: "en" } })],
    ["2", usuario({ user_metadata: { idioma: "pt" } })],
    ["3", usuario()],
    ["4", usuario()],
    ["5", usuario()],
    ["6", usuario()],
    ["7", usuario()],
    ["8", usuario({ email_confirmed_at: null })],
  ]);
  const r = recuento(perfiles, usuarios, new Set(), AHORA);
  assert.deepEqual(r.pendientes_aviso, { es: 1, en: 1, pt: 1, total: 3 });
  assert.equal(r.sin_consentimiento, 7);
  assert.equal(r.sin_confirmar_o_sin_cuenta, 1);
  assert.equal(r.avisados, 3);
  assert.equal(r.opuestos, 1);
  assert.equal(r.en_preaviso, 1);
  assert.equal(r.listos_para_incluir, 1);
  assert.doesNotMatch(JSON.stringify(r), /@/);
});

test("email en los 3 idiomas: asunto, fecha, enlaces, contacto y firma", () => {
  const esperado = {
    es: { asunto: "Cambios en las condiciones de Costaviva", fecha: "7 de noviembre de 2026", ruta: "Mi suscripción → «Tus datos»", base: "interés legítimo" },
    en: { asunto: "Changes to Costaviva's terms", fecha: "7 November 2026", ruta: "My subscription → “Your data”", base: "legitimate interest" },
    pt: { asunto: "Alterações às condições da Costaviva", fecha: "7 de novembro de 2026", ruta: "A minha subscrição → «Os seus dados»", base: "interesse legítimo" },
  };
  for (const i of IDIOMAS) {
    const c = emailAviso(i, AHORA);
    const e = esperado[i];
    assert.equal(c.idioma, i);
    assert.equal(c.asunto, e.asunto);
    for (const cuerpo of [c.texto, c.html]) {
      assert.ok(cuerpo.includes(e.fecha), `${i}: fecha`);
      assert.ok(cuerpo.includes(e.base), `${i}: base legal`);
      assert.ok(cuerpo.includes("https://costaviva.org/suscripcion#datos"), `${i}: enlace a Tus datos`);
      assert.ok(cuerpo.includes("https://costaviva.org/terminos"), `${i}: términos`);
      assert.ok(cuerpo.includes("https://costaviva.org/privacidad"), `${i}: privacidad`);
      assert.ok(cuerpo.includes("datos@costaviva.org"), `${i}: contacto`);
      assert.ok(cuerpo.includes(FIRMA), `${i}: firma`);
    }
    assert.ok(c.texto.includes(e.ruta), `${i}: ruta en la app`);
    assert.match(c.html, new RegExp(`<html lang="${i}">`));
    assert.doesNotMatch(c.html, /<script|on\w+=/i);
  }
  assert.equal(emailAviso("fr", AHORA).idioma, "es");
  assert.equal(FIRMA, "Mikel — Costaviva");
  assert.match(REMITENTE, /<avisos@costaviva\.org>$/);
});

test("portugués europeo: sin brasileñismos en el aviso", () => {
  const { texto } = emailAviso("pt", AHORA);
  assert.doesNotMatch(texto, /\bassinatura\b|\bvocê\b|\blink\b|\bcadastr/i);
  assert.match(texto, /subscrição/);
});

test("el registro tapa cualquier email que no sea de costaviva.org", () => {
  assert.equal(limpiar("fallo con pepe.perez+x@gmail.com y ana@ejemplo.es"), "fallo con [email] y [email]");
  assert.equal(limpiar("De: Costaviva <avisos@costaviva.org> · datos@costaviva.org"), "De: Costaviva <avisos@costaviva.org> · datos@costaviva.org");
  const original = console.log;
  const salida = [];
  console.log = (s) => salida.push(s);
  try {
    log("enviado a", "alguien@correo.com");
  } finally {
    console.log = original;
  }
  assert.deepEqual(salida, ["enviado a [email]"]);
});

test("--probar no usa la red y no imprime ningún email de usuario", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("--probar no debe usar la red"); };
  const original = console.log;
  const salida = [];
  console.log = (s) => salida.push(String(s));
  try {
    await main(["--probar"]);
  } finally {
    console.log = original;
    globalThis.fetch = fetchOriginal;
  }
  const todo = salida.join("\n");
  for (const a of IDIOMAS.map((i) => emailAviso(i).asunto)) assert.ok(todo.includes(a));
  const emails = todo.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  assert.ok(emails.length > 0);
  for (const e of emails) assert.match(e, /@costaviva\.org$/);
});

test("exactamente un modo", async () => {
  await assert.rejects(() => main([]), /exactamente uno/);
  await assert.rejects(() => main(["--contar", "--enviar"]), /exactamente uno/);
});

test("el código no imprime nada sin pasar por log()/limpiar()", () => {
  const src = readFileSync(new URL("../scripts/avisos/condiciones-2026-10.mjs", import.meta.url), "utf8");
  const lineas = src.split("\n").filter((l) => /console\.(log|error|warn|info)\(/.test(l));
  for (const l of lineas) assert.match(l, /console\.log\(limpiar\(|console\.error\(limpiar\(/, l.trim());
  // Ni el cuerpo de las respuestas de error de Resend ni de PostgREST.
  assert.doesNotMatch(src, /await r\.text\(\)/);
});

test("el workflow es solo manual, con palabra de confirmación y sin emails en el registro", () => {
  const wf = readFileSync(new URL("../.github/workflows/aviso-condiciones.yml", import.meta.url), "utf8");
  assert.match(wf, /workflow_dispatch:/);
  assert.doesNotMatch(wf, /^\s*schedule:/m);
  assert.doesNotMatch(wf, /^\s*(push|pull_request):/m);
  for (const m of ["contar", "probar", "enviar", "incluir"]) assert.match(wf, new RegExp(`\\b${m}\\b`));
  assert.match(wf, /confirmacion/);
  assert.match(wf, /RESEND_API_KEY/);
});

test("la migración pone y borra la fecha de oposición y conserva la seguridad de la RPC", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261023120000_aviso_condiciones_oposicion.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists oposicion_estadisticas_en timestamptz/);
  assert.match(sql, /add column if not exists aviso_condiciones_en timestamptz/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /where id = auth\.uid\(\)/);
  assert.match(sql, /oposicion_estadisticas_en = case when v_usar then null else now\(\) end/);
  assert.match(sql, /revoke execute on function public\.fijar_uso_capturas_estadisticas\(boolean\) from public, anon/);
  assert.match(sql, /grant execute on function public\.fijar_uso_capturas_estadisticas\(boolean\) to authenticated/);
  assert.doesNotMatch(sql, /\b(begin|commit);/i);
  assert.doesNotMatch(sql, /create policy|alter policy|disable row level security/i);
});
