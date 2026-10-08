// Lista de WhatsApp de la alarma (assets/js/sos-whatsapp.js, 2026-10-08).
// Lógica pura: teléfono -> E.164, enlace wa.me con el texto bien codificado,
// texto del mensaje y coherencia con la migración y el baseline del vigía.
// Sin red ni secretos: corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../assets/js/sos-whatsapp.js");
const { PATRON_E164, esE164, normalizarTelefono, formatearTelefono, mensajeSOS, urlWhatsApp, contactosConWhatsapp } =
  globalThis.SosWhatsapp;

test("teléfono: sin prefijo se entiende España", () => {
  assert.deepEqual(normalizarTelefono("612 34 56 78"), { ok: true, e164: "+34612345678" });
  assert.deepEqual(normalizarTelefono("612-345-678"), { ok: true, e164: "+34612345678" });
  assert.deepEqual(normalizarTelefono("(612) 34.56.78"), { ok: true, e164: "+34612345678" });
  assert.deepEqual(normalizarTelefono("943123456"), { ok: true, e164: "+34943123456" });
  assert.deepEqual(normalizarTelefono("34612345678"), { ok: true, e164: "+34612345678" });
});

test("teléfono: con prefijo internacional (+ o 00)", () => {
  assert.deepEqual(normalizarTelefono("+34 612 34 56 78"), { ok: true, e164: "+34612345678" });
  assert.deepEqual(normalizarTelefono("0034612345678"), { ok: true, e164: "+34612345678" });
  assert.deepEqual(normalizarTelefono("+33 6 12 34 56 78"), { ok: true, e164: "+33612345678" });
  assert.deepEqual(normalizarTelefono("00351912345678"), { ok: true, e164: "+351912345678" });
  assert.deepEqual(normalizarTelefono("+44 7700 900123"), { ok: true, e164: "+447700900123" });
});

test("teléfono: otro país por defecto", () => {
  assert.deepEqual(normalizarTelefono("06 12 34 56 78", "33"), { ok: true, e164: "+33612345678" });
});

test("teléfono: se rechaza lo que no es un número válido", () => {
  for (const malo of ["", "   ", null, undefined, "abc", "612 34 56", "61234567890", "+34 512 345 678", "+34 612 345 67",
    "+0 612345678", "+1234", "+1234567890123456", "612+345678", "612;345678", "tel:612345678"]) {
    const r = normalizarTelefono(malo);
    assert.equal(r.ok, false, String(malo));
    assert.ok(typeof r.error === "string" && r.error.length > 10, String(malo));
  }
});

test("E.164: el patrón de JS es el del CHECK de la migración", () => {
  const sql = readFileSync("supabase/migrations/20261008200000_contactos_whatsapp.sql", "utf8");
  const m = /whatsapp ~ '([^']+)'/.exec(sql);
  assert.ok(m, "la migración tiene el CHECK de E.164");
  assert.equal(m[1], PATRON_E164.source);
  assert.equal(esE164("+34612345678"), true);
  assert.equal(esE164("34612345678"), false);
  assert.equal(esE164(null), false);
});

test("formato para enseñar", () => {
  assert.equal(formatearTelefono("+34612345678"), "+34 612 34 56 78");
  assert.equal(formatearTelefono("+33612345678"), "+33612345678");
});

test("wa.me: número sin + y texto codificado", () => {
  const texto = "🆘 SOS de Ana & Íker: ¿ayuda? #1\nhttps://maps.google.com/?q=43.1,-2.5";
  const url = urlWhatsApp("+34612345678", texto);
  assert.match(url, /^https:\/\/wa\.me\/34612345678\?text=/);
  const consulta = url.split("?text=")[1];
  assert.doesNotMatch(consulta, /[ &?#\n]/);
  assert.equal(decodeURIComponent(consulta), texto);
  assert.equal(new URL(url).searchParams.get("text"), texto);
});

test("wa.me sin número (grupos): deja elegir el chat", () => {
  assert.equal(urlWhatsApp(null, "hola mar"), "https://wa.me/?text=hola%20mar");
  assert.equal(urlWhatsApp("612345678", "x"), "https://wa.me/?text=x");
});

test("mensaje con ubicación, precisión y hora", () => {
  const texto = mensajeSOS({
    nombre: "Ana",
    posicion: { lat: 43.3623, lon: -1.79123456, precision: 12.4 },
    fecha: Date.UTC(2026, 9, 8, 7, 5),
    zonaHoraria: "Europe/Madrid",
  });
  assert.equal(
    texto,
    "🆘 SOS de Ana: necesito ayuda. Mi ubicación: https://maps.google.com/?q=43.362300,-1.791235 (precisión ±12 m, 09:05). Enviado desde Costaviva."
  );
});

test("mensaje: caída detectada, sin ubicación, sin nombre", () => {
  const caida = mensajeSOS({ nombre: "Iker", tipo: "caida_detectada", posicion: { lat: 43, lon: -2 }, fecha: Date.UTC(2026, 0, 1, 12, 0), zonaHoraria: "UTC" });
  assert.match(caida, /^🆘 SOS de Iker: mi teléfono ha detectado una posible caída y no he respondido\. Necesito ayuda\./);
  assert.match(caida, /q=43\.000000,-2\.000000 \(12:00\)/);
  const sinPos = mensajeSOS({ nombre: "", posicion: null, fecha: Date.UTC(2026, 0, 1, 12, 0), zonaHoraria: "UTC" });
  assert.equal(sinPos, "🆘 SOS de un usuario de Costaviva: necesito ayuda. No he podido obtener mi ubicación (12:00). Enviado desde Costaviva.");
});

test("lista de WhatsApp: solo contactos con número válido, en orden", () => {
  const lista = contactosConWhatsapp([
    { nombre: "Ana", email: "a@x.es", whatsapp: "+34612345678" },
    { nombre: "Bea", email: "b@x.es", whatsapp: null },
    { nombre: "Ciro", email: null, whatsapp: "+33612345678" },
    { nombre: "Malo", whatsapp: "612345678" },
  ]);
  assert.deepEqual(lista.map((c) => c.nombre), ["Ana", "Ciro"]);
  assert.deepEqual(contactosConWhatsapp(undefined), []);
});

test("migración: RLS solo del dueño, sin anon y baseline al día", () => {
  const sql = readFileSync("supabase/migrations/20261008200000_contactos_whatsapp.sql", "utf8");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(codigo, /disable row level security/i);
  assert.doesNotMatch(codigo, /\banon\b/i);
  assert.doesNotMatch(codigo, /\b(begin|commit)\s*;/i);
  assert.match(codigo, /check \(email is not null or whatsapp is not null\)/);
  assert.match(
    codigo,
    /for update\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)\s+with check \(\(select auth\.uid\(\)\) = user_id\)/
  );
  const baseline = JSON.parse(readFileSync("supabase/baseline-seguridad.json", "utf8"));
  const t = baseline.tablas.find((x) => x.tablename === "contactos_emergencia");
  assert.equal(t.rls_enabled, true);
  assert.deepEqual(
    t.policies.map((p) => `${p.cmd}:${p.name}`).sort(),
    [
      "a:cada usuario inserta solo sus contactos",
      "d:cada usuario borra solo sus contactos",
      "r:cada usuario ve solo sus contactos",
      "w:cada usuario actualiza solo sus contactos",
    ]
  );
});

test("alarma.html: carga el módulo, sin on*= y el email solo a contactos con email", () => {
  const html = readFileSync("alarma.html", "utf8");
  assert.match(html, /<script src="\/assets\/js\/sos-whatsapp\.js"><\/script>/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.match(html, /tienes que pulsar <b>Enviar<\/b>/);
  const fn = readFileSync("functions/sos-alerta.js", "utf8");
  assert.match(fn, /contactos_emergencia\?select=nombre,email&email=not\.is\.null/);
});
