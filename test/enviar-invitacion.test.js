// test/enviar-invitacion.test.js — scripts/avisos/enviar-invitacion.mjs
// (2026-11-26): manda el email de una invitación creada por SQL, marca
// email_enviado_en solo tras el 2xx de Resend y no toca las canjeadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enviarInvitacion } from "../scripts/avisos/enviar-invitacion.mjs";

const ID = "7f8bee56-273c-4914-9299-7ecaaa3e7f94";
const inv = (extra = {}) => ({ id: ID, codigo: "ABCDEFGHJKMN", email: "x@example.com", descuento: 100, duracion_tipo: "siempre", duracion_meses: null, duracion_hasta: null, caduca_en: new Date(Date.now() + 86400000).toISOString(), canjeada_en: null, anulada_en: null, ...extra });

function falso(fila, resendOk = true) {
  const llamadas = [];
  const f = async (url, op = {}) => {
    llamadas.push({ url: String(url), metodo: op.method || "GET", cuerpo: op.body });
    if (String(url).includes("resend")) return new Response(resendOk ? '{"id":"r1"}' : "no", { status: resendOk ? 200 : 500 });
    if ((op.method || "GET") === "GET") return new Response(JSON.stringify(fila ? [fila] : []), { status: 200 });
    return new Response(null, { status: 204 });
  };
  return { f, llamadas };
}

test("manda el email y marca email_enviado_en", async () => {
  const { f, llamadas } = falso(inv());
  const orig = globalThis.fetch; globalThis.fetch = f;
  try {
    const r = await enviarInvitacion({ id: ID, env: { SUPABASE_SERVICE_ROLE_KEY: "k", RESEND_API_KEY: "r" }, fetchImpl: f });
    assert.deepEqual(r, { ok: true, marcada: true });
  } finally { globalThis.fetch = orig; }
  const envio = llamadas.find((l) => l.url.includes("resend"));
  assert.ok(envio && JSON.parse(envio.cuerpo).text.includes("ABCD-EFGH-JKMN"));
  assert.ok(llamadas.some((l) => l.metodo === "PATCH" && /email_enviado_en/.test(l.cuerpo)));
});

test("si Resend falla, no marca nada", async () => {
  const { f, llamadas } = falso(inv(), false);
  const orig = globalThis.fetch; globalThis.fetch = f;
  try {
    const r = await enviarInvitacion({ id: ID, env: { SUPABASE_SERVICE_ROLE_KEY: "k", RESEND_API_KEY: "r" }, fetchImpl: f });
    assert.equal(r.ok, false);
  } finally { globalThis.fetch = orig; }
  assert.ok(!llamadas.some((l) => l.metodo === "PATCH"));
});

test("una canjeada no se reenvía; un id raro se rechaza", async () => {
  const { f, llamadas } = falso(inv({ inscrito_en: new Date().toISOString(), acceso_hasta: null }));
  const r = await enviarInvitacion({ id: ID, env: { SUPABASE_SERVICE_ROLE_KEY: "k", RESEND_API_KEY: "r" }, fetchImpl: f });
  assert.equal(r.ok, false);
  assert.ok(!llamadas.some((l) => l.url.includes("resend")));
  await assert.rejects(enviarInvitacion({ id: "1; drop", env: { SUPABASE_SERVICE_ROLE_KEY: "k" }, fetchImpl: f }));
});

test("el workflow es manual y no imprime el email", () => {
  const w = readFileSync(".github/workflows/enviar-invitacion.yml", "utf8");
  assert.match(w, /workflow_dispatch/);
  assert.doesNotMatch(w, /schedule:/);
  const s = readFileSync("scripts/avisos/enviar-invitacion.mjs", "utf8");
  assert.doesNotMatch(s, /console\.log\([^)]*email/);
});
