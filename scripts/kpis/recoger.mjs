// scripts/kpis/recoger.mjs — SIN IA. SOLO LECTURA de producción.
// Cada día (kpis.yml) añade a datos-robots/kpis/historico.jsonl una línea por
// cada día cerrado que falte (hora de España), con los flujos de ese día, y
// en la del último día el "stock" del momento (MRR, suscriptores, socios).
// El histórico NUNCA se reescribe: solo se añaden líneas (appendFileSync).
//
// Fuentes (todas de lectura):
//   - Supabase con SUPABASE_SERVICE_ROLE_KEY, solo GET por REST: perfiles,
//     origen_altas, visitas_publicas, eventos_uso, suscripciones,
//     administradores, accesos_permanentes, invitaciones y
//     /auth/v1/admin/users (email confirmado).
//   - Stripe con STRIPE_KPI_KEY, clave RESTRINGIDA de solo lectura
//     (Subscriptions, Invoices, Promotion codes y Coupons: Read). Solo GET.
//     Sin ella, el MRR sale de public.suscripciones a precio de lista y lo
//     dice (mrr_fuente "supabase"); facturado y cancelaciones exactas, N/D.
//
// Privacidad (el repo es público): solo recuentos e importes agregados.
// Nunca un user_id, un email ni un id de Stripe en el histórico.
//
// Uso: node scripts/kpis/recoger.mjs [--historico RUTA] [--hasta AAAA-MM-DD]

import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  diaMadrid, sumarDias, activado, activoSemana4, canalDe, mrrSuscripcionDetalle, codigoPromoDe, mrrDesdeSupabase, redondear, DIA,
} from "./lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RUTA_HISTORICO = join(RAIZ, "datos-robots", "kpis", "historico.jsonl");
// Primer día que se reconstruye (Stripe en live desde el 2026-09-15).
export const DESDE_INICIAL = "2026-09-15";
const MAX_DIAS_POR_PASADA = 60;

export function leerHistorico(ruta = RUTA_HISTORICO) {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Días cerrados que faltan: desde el siguiente al último apuntado hasta ayer.
export function diasPendientes(historico, ayer) {
  const ultimo = historico.reduce((m, l) => (l.fecha > m ? l.fecha : m), "");
  const desde = ultimo ? sumarDias(ultimo, 1) : DESDE_INICIAL;
  const out = [];
  for (let d = desde; d <= ayer && out.length < MAX_DIAS_POR_PASADA; d = sumarDias(d, 1)) out.push(d);
  return out;
}

// ── Exclusiones: las mismas que metricas_captacion() ────────────────────
export function idsExcluidos({ perfiles, admins, permanentes, invitaciones, emailsPrueba }) {
  const perm = new Set(permanentes.map((p) => String(p.email).toLowerCase()));
  const prueba = new Set(emailsPrueba.map((e) => e.toLowerCase()));
  const ex = new Set(admins.map((a) => a.user_id));
  for (const i of invitaciones) if (i.user_id && Number(i.descuento) === 100) ex.add(i.user_id);
  for (const p of perfiles) {
    const e = String(p.email ?? "").toLowerCase();
    if (e.startsWith("etxebe2005+") || prueba.has(e) || perm.has(e)) ex.add(p.id);
  }
  return ex;
}

// ── Cálculo puro de las líneas (lo prueban los tests) ───────────────────
// datos: { perfiles[{id,creado_en}], confirmados:Set|null, origen{user_id:{fuente,campana}},
//   visitas[{dia,fuente,visitas}], eventos[{user_id,tipo,creado_en}],
//   subsSupabase[{user_id,estado,periodo,primer_pago_en}], excluidos:Set,
//   stripe: null | { subs[], invoices[], codigosPorId{}, codigosSocio:Set, usuarioPorSub{} } }
export function calcularLineas(dias, datos, medidoEn = new Date().toISOString()) {
  const { perfiles, confirmados, origen, visitas, eventos, subsSupabase, excluidos, stripe } = datos;
  const validos = perfiles.filter((p) => !excluidos.has(p.id));
  const codigosSocio = stripe?.codigosSocio ?? new Set();
  const eventosPor = new Map();
  for (const e of eventos) { if (!eventosPor.has(e.user_id)) eventosPor.set(e.user_id, []); eventosPor.get(e.user_id).push(e); }
  const primerDiaVisitas = visitas.reduce((m, v) => (!m || v.dia < m ? v.dia : m), null);
  const altaDe = (d) => validos.filter((p) => diaMadrid(p.creado_en) === d);
  const lineas = [];
  for (const dia of dias) {
    const altas = altaDe(dia);
    const vis = visitas.filter((v) => v.dia === dia);
    const visitasCanal = {};
    for (const v of vis) { const c = canalDe({ fuente: v.fuente, campana: v.campana }, codigosSocio); visitasCanal[c] = (visitasCanal[c] ?? 0) + v.visitas; }
    const altasCanal = {}, altasSocio = {};
    for (const p of altas) {
      const o = origen[p.id];
      const c = canalDe(o, codigosSocio);
      altasCanal[c] = (altasCanal[c] ?? 0) + 1;
      if (c === "socios") { const k = String(o.campana).toUpperCase(); altasSocio[k] = (altasSocio[k] ?? 0) + 1; }
    }
    const cohA = altaDe(sumarDias(dia, -7));
    const cohR = altaDe(sumarDias(dia, -28));
    const pagos = subsSupabase.filter((s) => s.primer_pago_en && !excluidos.has(s.user_id) && diaMadrid(s.primer_pago_en) === dia);
    const pagosCanal = {};
    for (const s of pagos) {
      const sub = stripe?.subs.find((x) => stripe.usuarioPorSub[x.id] === s.user_id);
      // Código de promoción: el de Stripe; si no, el que guarde el webhook en
      // suscripciones.codigo_promocion (columna prevista por el cobro nuevo).
      const promo = (sub ? codigoPromoDe(sub, stripe.codigosPorId) : null) ?? (s.codigo_promocion ? String(s.codigo_promocion).toUpperCase() : null);
      const c = promo && codigosSocio.has(promo) ? "socios" : canalDe(origen[s.user_id], codigosSocio);
      pagosCanal[c] = (pagosCanal[c] ?? 0) + 1;
    }
    const checkout = new Set(eventos.filter((e) => e.tipo === "iniciar_checkout" && !excluidos.has(e.user_id) && diaMadrid(e.creado_en) === dia).map((e) => e.user_id));
    const linea = {
      v: 1,
      fecha: dia,
      medido_en: medidoEn,
      fuentes: { supabase: "ok", stripe: stripe ? "ok" : "sin_clave" },
      visitas: primerDiaVisitas && dia >= primerDiaVisitas ? vis.reduce((a, v) => a + v.visitas, 0) : null,
      visitas_canal: visitasCanal,
      altas: altas.length,
      altas_confirmadas: confirmados ? altas.filter((p) => confirmados.has(p.id)).length : altas.length,
      altas_canal: altasCanal,
      altas_socio: altasSocio,
      cohorte_activacion: { dia: sumarDias(dia, -7), altas: cohA.length, activadas: cohA.filter((p) => activado(eventosPor.get(p.id) ?? [], p.creado_en)).length },
      cohorte_retencion: { dia: sumarDias(dia, -28), altas: cohR.length, activas_s4: cohR.filter((p) => activoSemana4(eventosPor.get(p.id) ?? [], p.creado_en)).length },
      checkout_iniciado: checkout.size,
      nuevos_pagos: pagos.length,
      pagos_canal: pagosCanal,
      cancelaciones: stripe
        ? stripe.subs.filter((s) => s.canceled_at && !excluidos.has(stripe.usuarioPorSub[s.id]) && diaMadrid(s.canceled_at) === dia).length
        : null,
      facturado_eur: stripe
        ? redondear(stripe.invoices.filter((i) => i.status === "paid" && diaMadrid(i.status_transitions?.paid_at ?? i.created) === dia).reduce((a, i) => a + (i.amount_paid ?? 0) / 100, 0))
        : null,
      stock: null,
    };
    lineas.push(linea);
  }
  if (lineas.length) lineas.at(-1).stock = calcularStock(datos, medidoEn);
  return lineas;
}

export function calcularStock(datos, medidoEn) {
  const { perfiles, origen, eventos, subsSupabase, excluidos, stripe } = datos;
  const ahora = Date.parse(medidoEn);
  const activos7 = new Set(eventos.filter((e) => !excluidos.has(e.user_id) && ahora - Date.parse(e.creado_en) <= 7 * DIA).map((e) => e.user_id));
  const base = { activos_7d: activos7.size, perfiles: perfiles.filter((p) => !excluidos.has(p.id)).length };
  if (!stripe) {
    const s = mrrDesdeSupabase(subsSupabase.filter((x) => !excluidos.has(x.user_id)));
    return { ...base, ...s, mrr_fuente: "supabase", en_prueba_stripe: subsSupabase.filter((x) => x.estado === "trialing" && !excluidos.has(x.user_id)).length, cancelacion_programada: null, socios: null };
  }
  const subs = stripe.subs.filter((s) => !excluidos.has(stripe.usuarioPorSub[s.id]));
  let mrr = 0, mensual = 0, anual = 0;
  const sinConvertir = {};
  const socios = {};
  for (const c of stripe.codigosSocio) socios[c] = { altas: 0, suscriptores: 0, mrr_eur: 0, facturado_eur: 0 };
  for (const p of perfiles) {
    if (excluidos.has(p.id)) continue;
    const c = origen[p.id]?.campana ? String(origen[p.id].campana).toUpperCase() : null;
    if (c && socios[c]) socios[c].altas++;
  }
  const subPorId = {};
  for (const s of subs) {
    subPorId[s.id] = s;
    const d = mrrSuscripcionDetalle(s, ahora);
    const m = d.eur ?? 0;
    if (d.eur == null && d.importe > 0) sinConvertir[d.moneda] = redondear((sinConvertir[d.moneda] ?? 0) + d.importe);
    if (d.importe > 0) {
      mrr += m;
      const it = s.items?.data?.[0]?.price?.recurring?.interval ?? s.items?.data?.[0]?.plan?.interval;
      if (it === "year") anual++; else mensual++;
    }
    const promo = codigoPromoDe(s, stripe.codigosPorId);
    if (promo && socios[promo] && ["active", "past_due"].includes(s.status)) { socios[promo].suscriptores++; socios[promo].mrr_eur = redondear(socios[promo].mrr_eur + m); }
  }
  for (const i of stripe.invoices) {
    const subId = typeof i.subscription === "object" ? i.subscription?.id : i.subscription ?? i.parent?.subscription_details?.subscription;
    const s = subPorId[subId];
    const promo = s ? codigoPromoDe(s, stripe.codigosPorId) : null;
    if (promo && socios[promo] && i.status === "paid") socios[promo].facturado_eur = redondear(socios[promo].facturado_eur + (i.amount_paid ?? 0) / 100);
  }
  return {
    ...base,
    mrr_eur: redondear(mrr),
    mrr_fuente: "stripe",
    mrr_sin_convertir: sinConvertir,
    suscriptores: { mensual, anual },
    en_prueba_stripe: subs.filter((s) => s.status === "trialing").length,
    cancelacion_programada: subs.filter((s) => s.cancel_at_period_end && ["active", "trialing", "past_due"].includes(s.status)).length,
    socios,
  };
}

// ── Lectura de producción (solo GET) ────────────────────────────────────
async function supabaseTodo(tabla, select, filtro = "") {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/rest/v1/${tabla}?select=${select}${filtro}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${desde}-${desde + 999}` } });
    if (!r.ok) throw new Error(`${tabla}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    const p = await r.json();
    filas.push(...p);
    if (p.length < 1000) return filas;
  }
}
async function usuariosConfirmados() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ids = new Set();
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`auth admin users: HTTP ${r.status}`);
    const j = await r.json();
    const us = j.users ?? [];
    for (const u of us) if (u.email_confirmed_at) ids.add(u.id);
    if (us.length < 1000) return ids;
  }
  return ids;
}
async function stripeLista(ruta, params = "") {
  const key = process.env.STRIPE_KPI_KEY;
  const out = [];
  let tras = null;
  for (let i = 0; i < 100; i++) {
    const r = await fetch(`https://api.stripe.com/v1/${ruta}?limit=100${params}${tras ? `&starting_after=${tras}` : ""}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Stripe ${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    out.push(...j.data);
    if (!j.has_more) return out;
    tras = j.data.at(-1).id;
  }
  return out;
}
export async function leerStripe() {
  if (!process.env.STRIPE_KPI_KEY) return null;
  const desde = Math.floor(Date.parse(`${DESDE_INICIAL}T00:00:00Z`) / 1000);
  const [subs, invoices, promos] = await Promise.all([
    stripeLista("subscriptions", "&status=all&expand[]=data.discounts"),
    stripeLista("invoices", `&created[gte]=${desde}`),
    stripeLista("promotion_codes"),
  ]);
  const codigosPorId = {};
  const codigosSocio = new Set();
  for (const p of promos) {
    codigosPorId[p.id] = String(p.code).toUpperCase();
    if (p.metadata?.tipo === "socio") codigosSocio.add(String(p.code).toUpperCase());
  }
  const usuarioPorSub = {};
  for (const s of subs) usuarioPorSub[s.id] = s.metadata?.supabase_user_id ?? null;
  return { subs, invoices, codigosPorId, codigosSocio, usuarioPorSub };
}

async function principal() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const ruta = opt("--historico") ?? RUTA_HISTORICO;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("::error::Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY: no se pueden leer las métricas.");
    process.exit(1);
  }
  const ayer = opt("--hasta") ?? sumarDias(diaMadrid(new Date()), -1);
  const historico = leerHistorico(ruta);
  const dias = diasPendientes(historico, ayer);
  if (!dias.length) { console.log(`Histórico al día (último: ${historico.at(-1)?.fecha}).`); return; }

  const desdeEventos = `${sumarDias(dias[0], -40)}T00:00:00Z`;
  const [perfiles, admins, permanentes, invitaciones, origenFilas, visitas, eventos, subsSupabase] = await Promise.all([
    supabaseTodo("perfiles", "id,email,creado_en"),
    supabaseTodo("administradores", "user_id"),
    supabaseTodo("accesos_permanentes", "email"),
    supabaseTodo("invitaciones", "user_id,descuento", "&user_id=not.is.null"),
    supabaseTodo("origen_altas", "user_id,fuente,campana"),
    supabaseTodo("visitas_publicas", "dia,fuente,campana,visitas", `&dia=gte.${sumarDias(dias[0], -1)}`),
    supabaseTodo("eventos_uso", "user_id,tipo,creado_en", `&creado_en=gte.${desdeEventos}`),
    supabaseTodo("suscripciones", "user_id,estado,periodo,primer_pago_en"),
  ]);
  // Columna opcional (la añade el cobro nuevo): si aún no existe, se sigue sin ella.
  try {
    const promos = Object.fromEntries((await supabaseTodo("suscripciones", "user_id,codigo_promocion")).map((x) => [x.user_id, x.codigo_promocion]));
    for (const s of subsSupabase) s.codigo_promocion = promos[s.user_id] ?? null;
  } catch { /* sin suscripciones.codigo_promocion todavía */ }
  let confirmados = null;
  try { confirmados = await usuariosConfirmados(); } catch (e) { console.log(`::warning::Sin email confirmado (${e.message}): altas_confirmadas = altas.`); }
  let stripe = null;
  try { stripe = await leerStripe(); } catch (e) { console.log(`::warning::Stripe no responde (${e.message}): MRR desde public.suscripciones a precio de lista.`); }
  if (!process.env.STRIPE_KPI_KEY) console.log("::warning::Falta el secreto STRIPE_KPI_KEY (comun, PENDIENTES_MIKEL.md): MRR a precio de lista desde Supabase, sin facturado ni cancelaciones exactas.");

  const emailsPrueba = [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_B_EMAIL, process.env.SMOKE_TEST_EMAIL].filter(Boolean);
  const excluidos = idsExcluidos({ perfiles, admins, permanentes, invitaciones, emailsPrueba });
  const origen = Object.fromEntries(origenFilas.map((o) => [o.user_id, o]));
  const lineas = calcularLineas(dias, { perfiles, confirmados, origen, visitas, eventos, subsSupabase, excluidos, stripe });
  if (stripe === null && process.env.STRIPE_KPI_KEY) for (const l of lineas) l.fuentes.stripe = "error";
  mkdirSync(dirname(ruta), { recursive: true });
  appendFileSync(ruta, lineas.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const s = lineas.at(-1).stock;
  console.log(`Añadidas ${lineas.length} líneas (${dias[0]} → ${dias.at(-1)}). MRR ${s.mrr_eur} € (${s.mrr_fuente}), suscriptores ${s.suscriptores.mensual}+${s.suscriptores.anual}, perfiles válidos ${s.perfiles}, activos 7 d ${s.activos_7d}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  principal().catch((e) => { console.log(`::error::${e.message}`); process.exit(1); });
}
