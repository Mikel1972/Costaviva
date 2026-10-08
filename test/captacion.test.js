// Captación (2026-10-09): origen de las altas, contador de visitas propio,
// métricas semanales e "Invita a un amigo". Lógica pura, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as O from "../assets/js/origen.js";
import * as V from "../functions/_lib/visitas.js";
import { lineasInforme, filasTabla, textoPct, textoPorFuente, textoSemana, semanaCerrada } from "../assets/js/metricas-captacion.js";
import { enlaceAmigo, enlaceWhatsapp, textoResumen } from "../assets/js/invitar-amigo.js";
import { diasExtraPorReferidos, idsDeMetadata, compartenTarjeta, hashHex, premiarReferido, CREDITO_MES_CENTIMOS } from "../functions/_lib/referidos.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
const SQL_ORIGEN = leer("supabase/migrations/20261009100000_captacion_origen_visitas.sql");

test("las listas de fuentes coinciden en el navegador, el servidor y la base de datos", () => {
  assert.deepEqual(O.FUENTES, V.FUENTES);
  const enSql = SQL_ORIGEN.match(/fuente in \(\s*([^)]*)\)/)[1].match(/'([a-z]+)'/g).map((x) => x.slice(1, -1));
  for (const f of O.FUENTES) assert.ok(enSql.includes(f), `${f} falta en la migración`);
  for (const p of V.PAGINAS_CONTADAS) assert.ok(SQL_ORIGEN.includes(`'${p}'`), `${p} falta en la migración`);
});

test("origen: UTM, alias, referrer y descarte de datos personales", () => {
  assert.deepEqual(O.origenDeVisita({ search: "?utm_source=IG&utm_medium=social&utm_campaign=20261013-condiciones-bakio", pathname: "/empieza" }),
    { fuente: "instagram", medio: "social", campana: "20261013-condiciones-bakio", pagina: "empieza" });
  // Un email metido en la campaña no pasa.
  assert.equal(O.origenDeVisita({ search: "?utm_source=facebook&utm_campaign=pepe@gmail.com" }).campana, null);
  assert.equal(O.normalizarFuente("tiktok"), "otro");
  assert.deepEqual(O.origenDeVisita({ referrer: "https://www.google.es/search?q=x", pathname: "/mareas/bakio" }),
    { fuente: "google", medio: "organico", campana: null, pagina: "mareas" });
  assert.equal(O.origenDeVisita({ referrer: "https://l.instagram.com/?u=x" }).fuente, "instagram");
  // Navegación interna o directa: no hay origen (no pisa el primer contacto).
  assert.equal(O.origenDeVisita({ referrer: "https://costaviva.org/mareas" }), null);
  assert.equal(O.origenDeVisita({}), null);
  // Con código de amigo, la fuente es "referido".
  assert.equal(O.origenDeVisita({ search: "?ref=ABCD2345" }).fuente, "referido");
  assert.equal(O.normalizarRef("abcd-2345"), "ABCD2345");
  assert.equal(O.normalizarRef("ABCD1234"), null); // 1 no está en el alfabeto
  assert.equal(O.limpiarOrigen({ fuente: "instagram", medio: "x", campana: "Hola Mundo", pagina: "admin", email: "a@b.c" }).campana, null);
  assert.equal("email" in O.limpiarOrigen({ fuente: "instagram", email: "a@b.c" }), false);
});

test("primer contacto: no se pisa en 90 días y caduca después", () => {
  const datos = {};
  const ls = { getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; } };
  const t0 = Date.UTC(2026, 9, 1);
  assert.equal(O.guardarPrimerContacto({ fuente: "instagram", campana: "a" }, t0, ls), true);
  assert.equal(O.guardarPrimerContacto({ fuente: "google" }, t0 + 86400000, ls), false);
  assert.equal(O.leerPrimerContacto(t0 + 86400000, ls).fuente, "instagram");
  assert.equal(O.leerPrimerContacto(t0 + 91 * 86400000, ls), null);
  assert.equal(O.guardarPrimerContacto({ fuente: "google" }, t0 + 91 * 86400000, ls), true);
  // Sin almacenamiento, nunca rompe.
  assert.equal(O.guardarPrimerContacto({ fuente: "google" }, t0, null), false);
});

function peticion(url, cab = {}) {
  return { method: "GET", url, headers: new Headers({ "user-agent": "Mozilla/5.0 (iPhone)", ...cab }) };
}
const html200 = { status: 200, headers: new Headers({ "content-type": "text/html; charset=utf-8" }) };

test("contador de visitas: qué cuenta y con qué datos", () => {
  assert.deepEqual(V.visitaAContar(peticion("https://costaviva.org/empieza?utm_source=instagram&utm_campaign=20261013-x"), html200),
    { p_pagina: "empieza", p_fuente: "instagram", p_campana: "20261013-x" });
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/mareas/bakio", { referer: "https://www.google.com/" }), html200).p_fuente, "google");
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/spots"), html200).p_fuente, "directo");
  // No cuentan: robots, navegación interna, páginas privadas, no-HTML, errores, precargas.
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/spots", { "user-agent": "Googlebot/2.1" }), html200), null);
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/spots", { referer: "https://costaviva.org/mareas" }), html200), null);
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/diario"), html200), null);
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/mareas"), { status: 404, headers: html200.headers }), null);
  assert.equal(V.visitaAContar(peticion("https://costaviva.org/mareas", { "sec-purpose": "prefetch" }), html200), null);
  assert.equal(V.visitaAContar({ ...peticion("https://costaviva.org/mareas"), method: "POST" }, html200), null);
});

test("el botón de alta de las páginas públicas lleva la fuente de quien llega de fuera", () => {
  const visita = { p_pagina: "mareas", p_fuente: "google", p_campana: null };
  assert.equal(V.hrefConOrigen("/login?alta=1", visita), "/login?alta=1&utm_source=google&utm_medium=organico&utm_campaign=web-mareas");
  assert.equal(V.hrefConOrigen("/login?alta=1", { ...visita, p_fuente: "directo" }), "/login?alta=1");
  assert.equal(V.hrefConOrigen("/otra", visita), "/otra");
});

test("contarVisita nunca lanza aunque Supabase falle", async () => {
  await V.contarVisita({ p_pagina: "mareas", p_fuente: "google" }, { url: "https://x", anonKey: "k", fetchImpl: async () => { throw new Error("red"); } });
  let cuerpo;
  await V.contarVisita({ p_pagina: "mareas", p_fuente: "google", p_campana: null }, { url: "https://x", anonKey: "k", fetchImpl: async (u, o) => { cuerpo = JSON.parse(o.body); return { ok: true }; } });
  assert.deepEqual(cuerpo, { p_pagina: "mareas", p_fuente: "google", p_campana: null });
});

test("/empieza es pública; login y empieza guardan el origen", () => {
  assert.equal(esRutaPermitida("/empieza"), true);
  assert.equal(esRutaPermitida("/empieza.html"), true);
  const login = leer("login.html");
  assert.match(login, /capturarOrigen\(\)/);
  assert.match(login, /origen: leerPrimerContacto\(\)/);
  assert.match(login, /ref: leerRef\(\)/);
  assert.match(leer("empieza.html"), /href="\/login\?alta=1"/);
  assert.match(leer("functions/_middleware.js"), /context\.waitUntil\(contarVisita/);
});

const METRICAS = {
  norte: { pruebas_terminadas: 8, pagan: 2, pct: 25 },
  semanas: [
    { semana: "2026-10-05", visitas: 10, visitas_por_fuente: { instagram: 7, google: 3 }, altas: 2, altas_confirmadas: 1, altas_por_fuente: { instagram: 1 }, invitaciones_canjeadas: 0, amigos_apuntados: 1, amigos_que_pagan: 0, pruebas_terminadas: 0, pagan: 0, base_s2: 0, activos_s2: 0, base_s4: 0, activos_s4: 0 },
    { semana: "2026-09-28", visitas: 40, visitas_por_fuente: { google: 30, instagram: 10 }, altas: 5, altas_confirmadas: 4, altas_por_fuente: { google: 3, desconocido: 1 }, invitaciones_canjeadas: 1, amigos_apuntados: 0, amigos_que_pagan: 1, pruebas_terminadas: 4, pagan: 1, base_s2: 0, activos_s2: 0, base_s4: 0, activos_s4: 0 },
    { semana: "2026-09-21", visitas: 0, visitas_por_fuente: {}, altas: 4, altas_confirmadas: 4, altas_por_fuente: {}, invitaciones_canjeadas: 0, amigos_apuntados: 0, amigos_que_pagan: 0, pruebas_terminadas: 4, pagan: 1, base_s2: 4, activos_s2: 3, base_s4: 0, activos_s4: 0 },
  ],
};

test("métricas: informe de los lunes y tabla de admin", () => {
  assert.equal(textoPct(1, 4), "25 % (1/4)");
  assert.equal(textoPct(0, 0), "—");
  assert.equal(textoPct(1, 3), "33,3 % (1/3)");
  assert.equal(textoPorFuente({ google: 3, instagram: 7, x: 0 }), "instagram 7 · google 3");
  assert.equal(textoSemana("2026-09-28"), "28/9–4/10");
  assert.equal(semanaCerrada(METRICAS).semana, "2026-09-28");
  const l = lineasInforme(METRICAS).join("\n");
  assert.match(l, /Prueba → pago \(últimas 3 semanas\): 25 % \(2\/8\)/);
  assert.match(l, /Visitas a páginas públicas: 40 \(google 30 · instagram 10\)/);
  assert.match(l, /semana 2: 75 % \(3\/4\), altas del 21\/9/);
  assert.match(l, /semana 4: aún sin cohortes/);
  assert.match(lineasInforme(null)[0], /Sin datos/);
  assert.equal(filasTabla(METRICAS).length, 3);
  assert.equal(filasTabla(METRICAS)[0].length, 10);
});

test("Invita a un amigo: enlace, textos y premio", async () => {
  const e = enlaceAmigo("ABCD2345");
  assert.equal(e, "https://costaviva.org/empieza?ref=ABCD2345&utm_source=referido&utm_medium=referido&utm_campaign=amigo");
  assert.equal(enlaceAmigo("<script>"), null);
  assert.match(enlaceWhatsapp(e), /^https:\/\/wa\.me\/\?text=/);
  assert.equal(textoResumen({ activo: true, apuntados: 1, meses_ganados: 2, meses_pendientes: 0 }), "1 amigo se ha apuntado con tu enlace · has ganado 2 meses gratis.");
  assert.equal(diasExtraPorReferidos(2), 60);
  assert.equal(diasExtraPorReferidos(9), 90);
  const u = "4531509f-a2a3-4aa1-9184-0ff9a2069d6d";
  assert.deepEqual(idsDeMetadata(`${u},nada,${u}`), [u, u]);
  assert.equal(compartenTarjeta(["a", "b"], ["c", "b"]), true);
  assert.equal(compartenTarjeta(["a"], [null, "c"]), false);
  assert.match(await hashHex("x"), /^[0-9a-f]{64}$/);
  assert.equal(CREDITO_MES_CENTIMOS, 399);
});

test("premio: saldo en Stripe con clave de idempotencia y misma tarjeta detectada", async () => {
  const u = "4531509f-a2a3-4aa1-9184-0ff9a2069d6d";
  const llamadas = [];
  const respuesta = (d) => ({ ok: true, json: async () => d, text: async () => JSON.stringify(d) });
  const falso = (decision) => async (url, o = {}) => {
    llamadas.push({ url, o });
    if (url.endsWith("/rpc/referido_pendiente_de")) return respuesta({ id: "r1", referidor_id: "x", referidor_customer: "cus_REF" });
    if (url.includes("/customers/cus_AMIGO/payment_methods")) return respuesta({ data: [{ card: { fingerprint: "F1" } }] });
    if (url.includes("/customers/cus_REF/payment_methods")) return respuesta({ data: [{ card: { fingerprint: decision.tarjetaRef } }] });
    if (url.endsWith("/rpc/referido_resolver_pago")) return respuesta(JSON.parse(o.body).p_misma_tarjeta ? { resultado: "rechazado", motivo: "misma_tarjeta" } : { resultado: "saldo", referidor_customer: "cus_REF" });
    if (url.includes("/balance_transactions")) return respuesta({ id: "cbtxn_1" });
    if (url.endsWith("/rpc/referido_marcar_recompensa")) return respuesta(true);
    throw new Error(`inesperado ${url}`);
  };
  const r = await premiarReferido({ serviceRoleKey: "k", stripeKey: "sk", userId: u, customerAmigo: "cus_AMIGO", fetchImpl: falso({ tarjetaRef: "F9" }) });
  assert.equal(r.resultado, "saldo");
  const saldo = llamadas.find((l) => l.url.includes("/balance_transactions"));
  assert.equal(saldo.o.headers["Idempotency-Key"], "costaviva-referido-r1");
  assert.match(saldo.o.body, /amount=-399/);
  llamadas.length = 0;
  const r2 = await premiarReferido({ serviceRoleKey: "k", stripeKey: "sk", userId: u, customerAmigo: "cus_AMIGO", fetchImpl: falso({ tarjetaRef: "F1" }) });
  assert.equal(r2.resultado, "rechazado");
  assert.equal(llamadas.some((l) => l.url.includes("/balance_transactions")), false);
});

test("migraciones de captación: RLS, search_path y EXECUTE mínimo", () => {
  const ficheros = ["20261009100000_captacion_origen_visitas", "20261009110000_invita_a_un_amigo", "20261009120000_metricas_captacion", "20261009130000_programador_marketing"];
  for (const f of ficheros) {
    const sql = leer(`supabase/migrations/${f}.sql`);
    assert.doesNotMatch(sql, /disable\s+row\s+level\s+security/i);
    assert.doesNotMatch(sql, /^\s*(begin|commit)\s*;/im, `${f}: sin BEGIN/COMMIT`);
    const definer = [...sql.matchAll(/create or replace function (public\.\w+)\(([^)]*)\)[\s\S]*?security definer\s*\n\s*set search_path/g)].map((m) => m[1]);
    const todas = [...sql.matchAll(/create or replace function (public\.\w+)\([\s\S]*?\$\$;/g)];
    for (const m of todas) {
      if (!/security definer/.test(m[0])) continue;
      assert.match(m[0], /set search_path/, `${m[1]} sin search_path`);
      assert.ok(new RegExp(`revoke all on function ${m[1].replace(".", "\\.")}\\([^)]*\\) from public`).test(sql), `${m[1]} sin revoke`);
    }
    assert.ok(definer.length >= 0);
    for (const t of sql.matchAll(/create table if not exists (public\.\w+)/g)) {
      assert.match(sql, new RegExp(`alter table ${t[1].replace(".", "\\.")} enable row level security`), `${t[1]} sin RLS`);
    }
  }
  // Sin emails en claro en referidos; contar_visita_publica es la única anon.
  const amigo = leer("supabase/migrations/20261009110000_invita_a_un_amigo.sql");
  assert.doesNotMatch(amigo.match(/create table if not exists public\.referidos \(([\s\S]*?)\);/)[1], /\bemail text/);
  assert.match(SQL_ORIGEN, /anon-ok/);
  const baseline = JSON.parse(leer("supabase/baseline-seguridad.json"));
  for (const t of ["origen_altas", "visitas_publicas", "ajustes_app", "codigos_referido", "referidos"]) {
    const fila = baseline.tablas.find((x) => x.tablename === t);
    assert.ok(fila && fila.rls_enabled && fila.policies.length === 0, `${t} en el baseline del vigía`);
  }
});
