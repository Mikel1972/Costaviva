// test/kpis.test.js — KPIs de facturación (scripts/kpis/), sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OBJETIVOS, mrrObjetivo, quincenas, estado, alarmaBajoSuelo, mrrSuscripcion, mrrSuscripcionDetalle, codigoPromoDe,
  canalDe, activado, objetivosPeriodo, tasas, arpu, svgMrr, filasKpi, agregarPeriodo, pasoMasRojo, semanas, diaMadrid,
} from "../scripts/kpis/lib.mjs";
import { calcularLineas, diasPendientes, idsExcluidos, leerHistorico, DESDE_INICIAL } from "../scripts/kpis/recoger.mjs";
import { construir, markdown, resumenJson } from "../scripts/kpis/informe.mjs";
import { pendientes, veredicto, leerCambios } from "../scripts/kpis/evaluar-cambios.mjs";

test("objetivos.json: tres escenarios de 10 cierres, crecientes y en orden; objetivo ambicioso, suelo base", () => {
  assert.equal(OBJETIVOS.quincenas.length, 10);
  assert.equal(OBJETIVOS.objetivo, "ambicioso");
  assert.equal(OBJETIVOS.suelo_alarma, "base");
  assert.deepEqual(OBJETIVOS.escenarios.ambicioso.mrr, [10, 20, 40, 76, 137, 233, 372, 559, 782, 1017]);
  assert.deepEqual(OBJETIVOS.escenarios.base.mrr, [6, 12, 23, 41, 70, 112, 167, 234, 316, 411]);
  for (const e of ["prudente", "base", "ambicioso"]) {
    const v = OBJETIVOS.escenarios[e].mrr;
    assert.equal(v.length, 10, e);
    for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1], `${e} crece`);
  }
  for (let i = 0; i < 10; i++) assert.ok(OBJETIVOS.escenarios.prudente.mrr[i] <= OBJETIVOS.escenarios.base.mrr[i] && OBJETIVOS.escenarios.base.mrr[i] <= OBJETIVOS.escenarios.ambicioso.mrr[i]);
  assert.equal(OBJETIVOS.quincenas.at(-1).cierre, "2027-03-11");
  assert.equal(OBJETIVOS.referencia.mrr, 4000);
});

test("curva: valor exacto en cada cierre, interpolada dentro y sin estacionalidad", () => {
  OBJETIVOS.quincenas.forEach((q, i) => assert.equal(mrrObjetivo(q.cierre), OBJETIVOS.escenarios.ambicioso.mrr[i]));
  assert.equal(mrrObjetivo("2026-10-11"), 0);
  const medio = mrrObjetivo("2026-11-03");
  assert.ok(medio > 10 && medio < 20);
  assert.equal(mrrObjetivo("2027-06-01"), 1017);
  const q = quincenas("2027-12-31");
  assert.equal(q.length, 10);
  assert.deepEqual([q[0].desde, q[0].hasta, q[1].desde], ["2026-10-11", "2026-10-26", "2026-10-27"]);
});

test("semáforo: verde ≥ ambicioso, ámbar entre base y ambicioso, rojo < base", () => {
  assert.equal(estado(10, 10, 6).estado, "verde");
  assert.equal(estado(8, 10, 6).estado, "ambar");
  assert.equal(estado(6, 10, 6).estado, "ambar");
  assert.equal(estado(5.9, 10, 6).estado, "rojo");
  assert.equal(estado(null, 10, 6).estado, "sin_dato");
  assert.equal(estado(1, 2, null, true).estado, "verde");
  assert.equal(estado(5, 1, null, true).estado, "rojo");
});

test("aviso a Mikel: dos cierres seguidos por debajo del base", () => {
  assert.equal(alarmaBajoSuelo([{ id: "Q1", mrr: 5 }]).avisar, false);
  assert.deepEqual(alarmaBajoSuelo([{ id: "Q1", mrr: 5 }, { id: "Q2", mrr: 11 }]), { avisar: true, quincenas: ["Q1", "Q2"] });
  assert.equal(alarmaBajoSuelo([{ id: "Q1", mrr: 5 }, { id: "Q2", mrr: 12 }]).avisar, false);
  assert.equal(alarmaBajoSuelo([{ id: "Q1", mrr: 5 }, { id: "Q2", mrr: 11 }, { id: "Q3", mrr: 30 }]).avisar, false);
});

const sub = (o) => ({ status: "active", currency: "eur", items: { data: [{ quantity: 1, price: { unit_amount: 399, currency: "eur", recurring: { interval: "month", interval_count: 1 } } }] }, ...o });

test("MRR: mensual entero, anual a 1/12, descuento en %, otra moneda sin tipo de cambio aparte", () => {
  assert.equal(mrrSuscripcion(sub()), 3.99);
  const anual = sub({ items: { data: [{ price: { unit_amount: 3999, recurring: { interval: "year" } } }] } });
  assert.ok(Math.abs(mrrSuscripcion(anual) - 39.99 / 12) < 1e-9);
  assert.equal(mrrSuscripcion(sub({ status: "trialing" })), 0);
  assert.equal(mrrSuscripcion(sub({ status: "canceled" })), 0);
  const conCupon = sub({ discounts: [{ promotion_code: "promo_1", source: { coupon: { percent_off: 10 } } }] });
  assert.ok(Math.abs(mrrSuscripcion(conCupon) - 3.591) < 1e-9);
  assert.equal(codigoPromoDe(conCupon, { promo_1: "clubnauticobakio10" }), "CLUBNAUTICOBAKIO10");
  const caducado = sub({ discounts: [{ end: 1, coupon: { percent_off: 50 } }] });
  assert.equal(mrrSuscripcion(caducado), 3.99);
  const nzd = sub({ currency: "nzd" });
  assert.deepEqual(mrrSuscripcionDetalle(nzd, Date.now(), {}), { moneda: "nzd", importe: 3.99, eur: null });
  assert.ok(Math.abs(mrrSuscripcionDetalle(nzd, Date.now(), { nzd: 0.5 }).eur - 1.995) < 1e-9);
});

test("canales: socios por campaña = código; buscadores a Google; vacío a directo", () => {
  const socios = new Set(["CLUBNAUTICOBAKIO10"]);
  assert.equal(canalDe({ fuente: "otro", campana: "clubnauticobakio10" }, socios), "socios");
  assert.equal(canalDe({ fuente: "bing" }), "google");
  assert.equal(canalDe({ fuente: "facebook" }), "instagram");
  assert.equal(canalDe(undefined), "directo");
  assert.equal(canalDe({ fuente: "whatsapp" }), "otros");
});

test("activación: 2 días distintos y algo más que mirar el mapa, dentro de 7 días", () => {
  const alta = "2026-10-01T10:00:00Z";
  assert.equal(activado([{ tipo: "ver_mapa", creado_en: "2026-10-01T11:00:00Z" }, { tipo: "ver_mapa", creado_en: "2026-10-03T11:00:00Z" }], alta), false);
  assert.equal(activado([{ tipo: "ver_mapa", creado_en: "2026-10-01T11:00:00Z" }, { tipo: "crear_salida", creado_en: "2026-10-03T11:00:00Z" }], alta), true);
  assert.equal(activado([{ tipo: "ver_mapa", creado_en: "2026-10-01T11:00:00Z" }, { tipo: "crear_salida", creado_en: "2026-10-09T11:00:00Z" }], alta), false);
});

function datosSinteticos() {
  const perfiles = [
    { id: "u1", email: "a@x.es", creado_en: "2026-10-05T10:00:00Z" },
    { id: "u2", email: "b@x.es", creado_en: "2026-10-05T12:00:00Z" },
    { id: "adm", email: "admin@x.es", creado_en: "2026-10-05T12:00:00Z" },
    { id: "t1", email: "etxebe2005+smoke@gmail.com", creado_en: "2026-10-05T12:00:00Z" },
    { id: "p1", email: "perm@x.es", creado_en: "2026-10-05T12:00:00Z" },
    { id: "i1", email: "inv@x.es", creado_en: "2026-10-05T12:00:00Z" },
  ];
  const excluidos = idsExcluidos({ perfiles, admins: [{ user_id: "adm" }], permanentes: [{ email: "perm@x.es" }], invitaciones: [{ user_id: "i1", descuento: 100 }], emailsPrueba: [] });
  return {
    perfiles, excluidos, confirmados: new Set(["u1"]),
    origen: { u1: { fuente: "google" }, u2: { fuente: "otro", campana: "clubnauticobakio10" } },
    visitas: [{ dia: "2026-10-05", fuente: "google", campana: "", visitas: 30 }],
    eventos: [{ user_id: "u1", tipo: "ver_mapa", creado_en: "2026-10-05T10:05:00Z" }, { user_id: "u1", tipo: "crear_captura", creado_en: "2026-10-07T10:05:00Z" }],
    subsSupabase: [{ user_id: "u2", estado: "active", periodo: "mensual", primer_pago_en: "2026-10-06T09:00:00Z" }],
    stripe: {
      subs: [sub({ id: "sub_1", metadata: { supabase_user_id: "u2" }, discounts: [{ promotion_code: "promo_1", source: { coupon: { percent_off: 10 } } }] })],
      invoices: [{ status: "paid", amount_paid: 359, created: Date.parse("2026-10-06T09:00:00Z") / 1000, subscription: "sub_1" }],
      codigosPorId: { promo_1: "CLUBNAUTICOBAKIO10" }, codigosSocio: new Set(["CLUBNAUTICOBAKIO10"]), usuarioPorSub: { sub_1: "u2" },
    },
  };
}

test("líneas diarias: exclusiones, canales, socios, pagos, facturado y stock solo en la última", () => {
  const d = datosSinteticos();
  assert.equal(d.excluidos.size, 4);
  const dias = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-12"];
  const L = calcularLineas(dias, d, "2026-10-13T05:00:00Z");
  const [l4, l5, l6, l12] = L;
  assert.equal(l4.visitas, null, "antes del primer día con visitas no hay medida");
  assert.equal(l5.visitas, 30);
  assert.equal(l5.altas, 2);
  assert.equal(l5.altas_confirmadas, 1);
  assert.deepEqual(l5.altas_canal, { google: 1, socios: 1 });
  assert.deepEqual(l5.altas_socio, { CLUBNAUTICOBAKIO10: 1 });
  assert.equal(l6.nuevos_pagos, 1);
  assert.deepEqual(l6.pagos_canal, { socios: 1 });
  assert.equal(l6.facturado_eur, 3.59);
  assert.deepEqual(l12.cohorte_activacion, { dia: "2026-10-05", altas: 2, activadas: 1 });
  assert.equal(l5.stock, null);
  assert.equal(l12.stock.mrr_eur, 3.59);
  assert.deepEqual(l12.stock.suscriptores, { mensual: 1, anual: 0 });
  assert.deepEqual(l12.stock.socios.CLUBNAUTICOBAKIO10, { altas: 1, suscriptores: 1, mrr_eur: 3.59, facturado_eur: 3.59 });
  // Privacidad: el repo es público.
  const texto = JSON.stringify(L);
  for (const x of ["u1", "u2", "sub_1", "@x.es", "promo_1"]) assert.ok(!texto.includes(x), `no sale ${x}`);
});

test("sin clave de Stripe: MRR a precio de lista desde Supabase y N/D en facturado", () => {
  const d = { ...datosSinteticos(), stripe: null };
  const L = calcularLineas(["2026-10-06"], d, "2026-10-07T05:00:00Z");
  assert.equal(L[0].facturado_eur, null);
  assert.equal(L[0].cancelaciones, null);
  assert.equal(L[0].stock.mrr_fuente, "supabase");
  assert.equal(L[0].stock.mrr_eur, OBJETIVOS.precios_lista.eur.mensual);
});

test("días pendientes: desde el inicial y luego solo los que faltan", () => {
  assert.equal(diasPendientes([], "2026-09-16").join(), `${DESDE_INICIAL},2026-09-16`);
  assert.deepEqual(diasPendientes([{ fecha: "2026-10-10" }], "2026-10-12"), ["2026-10-11", "2026-10-12"]);
  assert.deepEqual(diasPendientes([{ fecha: "2026-10-12" }], "2026-10-12"), []);
});

test("objetivos del embudo con los supuestos de Mikel (4 %, 3 %, 3,25 €, +15 %)", () => {
  const t = tasas([]);
  assert.equal(t.visita_alta.valor, 0.04);
  assert.equal(t.alta_pago.valor, 0.03);
  assert.equal(arpu(null).valor, 3.25);
  const o = objetivosPeriodo({ desde: "2026-10-11", hasta: "2026-10-26" }, "ambicioso", t, arpu(null));
  // 10 € / 3,25 = 3,08 suscriptores; +15 % = 3,54 → 4 pagos; /3 % = 134 altas; /4 % = 3.350 visitas.
  assert.equal(o.nuevos_pagos, 4);
  assert.equal(o.altas, 134);
  assert.equal(o.visitas, 3350);
  assert.equal(o.mrr_eur, 10);
});

test("informe: markdown, resumen y SVG sin atributos on*= ni datos personales", () => {
  const d = datosSinteticos();
  const L = calcularLineas(["2026-10-11", "2026-10-12"], d, "2026-10-13T05:00:00Z");
  const r = construir(L, "2026-10-13", []);
  const md = markdown(r);
  assert.match(md, /# KPIs de Costaviva/);
  assert.match(md, /Paso del embudo más en rojo/);
  assert.match(md, /CLUBNAUTICOBAKIO10/);
  assert.match(md, /Ambicioso \(objetivo oficial\)/);
  const j = resumenJson(r);
  assert.equal(j.objetivo, "ambicioso");
  assert.equal(j.quincenas[0].id, "Q1");
  const svg = svgMrr([{ fecha: "2026-10-12", mrr: 3.59 }]);
  assert.ok(!/\son[a-z]+=/i.test(svg));
  assert.match(svg, /exigiría publicidad de pago/);
  assert.ok(semanas("2026-10-11", "2026-10-20").length >= 2);
  const filas = filasKpi(agregarPeriodo(L, { desde: "2026-10-11", hasta: "2026-10-26" }), { visitas: 100, altas: 10, activaciones: 4, nuevos_pagos: 1, mrr_eur: 10 });
  assert.ok(pasoMasRojo(filas));
});

test("evaluación de cambios: a los 14 días; empeora → revertir; pocos casos → reevaluar", () => {
  assert.equal(veredicto({ den: 50, tasa: 0.1 }, { den: 50, tasa: 0.05 }), "empeora");
  assert.equal(veredicto({ den: 50, tasa: 0.1 }, { den: 50, tasa: 0.2 }), "mejora");
  assert.equal(veredicto({ den: 5, tasa: 0.1 }, { den: 50, tasa: 0.2 }), "sin_datos");
  const hist = [];
  for (let i = 0; i < 40; i++) {
    const f = new Date(Date.parse("2026-10-01T00:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    hist.push({ fecha: f, visitas: 100, altas: f < "2026-10-15" ? 5 : 2 });
  }
  const cambios = [
    { tipo: "cambio", id: "kpi-x", fecha: "2026-10-13", paso: "altas", descripcion: "x" },
    { tipo: "fusion", id: "kpi-x", fecha: "2026-10-14", pr: 1 },
  ];
  assert.deepEqual(pendientes(cambios, hist, "2026-10-20"), []);
  const p = pendientes(cambios, hist, "2026-10-28");
  assert.equal(p.length, 1);
  assert.equal(p[0].veredicto, "empeora");
  assert.equal(p[0].accion, "revertir");
});

test("los ficheros del histórico y de cambios se pueden leer (jsonl válido)", () => {
  leerHistorico();
  leerCambios();
  const dir = mkdtempSync(join(tmpdir(), "kpis-"));
  writeFileSync(join(dir, "h.jsonl"), '{"fecha":"2026-10-11"}\n');
  assert.equal(leerHistorico(join(dir, "h.jsonl")).length, 1);
  assert.equal(diaMadrid("2026-10-11T22:30:00Z"), "2026-10-12");
});

test("kpis.yml solo lee producción: ni POST ni PATCH ni DELETE en recoger.mjs", () => {
  const src = readFileSync(new URL("../scripts/kpis/recoger.mjs", import.meta.url), "utf8");
  assert.ok(!/method:\s*["'](POST|PATCH|PUT|DELETE)/i.test(src));
  const wf = readFileSync(new URL("../.github/workflows/kpis.yml", import.meta.url), "utf8");
  assert.ok(!/ANTHROPIC_API_KEY|claude-code|claude -p/.test(wf), "sin IA en el workflow");
});
