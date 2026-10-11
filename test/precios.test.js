// Precios por zonas y ámbitos (2026-10-11). Sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  redondear99, redondearLocal, multiplicadorPorRenta, zonaDePais, importeZona, tablaZona,
  preciosStripe, precioParaZona, ahorroAnual, datosDePrecio, regionesDelAmbito, PAISES_UE, PAISES_EEE_NO_UE,
  AMBITOS, PLANES,
} from "../functions/_lib/precios.js";
import { generarPreciosMd, generarResumen } from "../scripts/precios/generar-md.mjs";

const config = JSON.parse(readFileSync(new URL("../functions/_lib/precios-zonas.json", import.meta.url), "utf8"));

test("redondeo hacia arriba al .99", () => {
  assert.equal(redondear99(1115), 1199);
  assert.equal(redondear99(1199), 1199);
  assert.equal(redondear99(1200), 1299);
  assert.equal(redondear99(3748.5), 3799);
  assert.equal(redondearLocal(12340, "NOK"), 12900);
  assert.equal(redondearLocal(4110, "CHF"), 4190);
});

test("multiplicador por renta: RNB / España, entre 0,6 y 1,5, a 0,05", () => {
  assert.equal(multiplicadorPorRenta(46630, 37120), 1.25);
  assert.equal(multiplicadorPorRenta(110330, 37120), 1.5);
  assert.equal(multiplicadorPorRenta(2760, 37120), 0.6);
  assert.equal(multiplicadorPorRenta(54550, 37120), 1.45);
  assert.equal(multiplicadorPorRenta(0, 37120), null);
});

test("geobloqueo: todos los países de la UE/EEE pagan lo mismo, en EUR y a 1,0", () => {
  const ue = config.zonas.find((z) => z.id === "ue_eee");
  assert.equal(ue.multiplicador_fijo, 1);
  assert.equal(ue.moneda, "EUR");
  const referencia = JSON.stringify(tablaZona(config, "ue_eee").planes);
  for (const pais of [...PAISES_UE, ...PAISES_EEE_NO_UE]) {
    const zona = zonaDePais(config, pais);
    assert.equal(zona.id, "ue_eee", `${pais} debe ir en la zona UE/EEE`);
    assert.equal(JSON.stringify(tablaZona(config, zona.id).planes), referencia, `${pais} con otros precios`);
  }
  // Ninguna otra zona (activa o preparada) puede contener un país de la UE/EEE.
  for (const z of config.zonas.filter((x) => x.id !== "ue_eee")) {
    for (const p of z.paises) assert.ok(![...PAISES_UE, ...PAISES_EEE_NO_UE].includes(p), `${p} de la UE/EEE en la zona ${z.id}`);
  }
  // Y la UE no puede tener multiplicador calculado ni manual.
  assert.equal(ue.multiplicador_manual, undefined);
  assert.equal(ue.multiplicador_decision, undefined);
});

test("precios de España/UE: 3,99 / 29,99 / 24,99 y Mundial 5,99 / 44,99 / 37,99", () => {
  const t = tablaZona(config, "ue_eee").planes;
  assert.deepEqual([t.regional.mensual, t.regional.anual, t.regional.fundador_anual], [399, 2999, 2499]);
  assert.deepEqual([t.mundial.mensual, t.mundial.anual, t.mundial.fundador_anual], [599, 4499, 3799]);
  assert.equal(t.regional.ahorro_anual, 37);
});

test("Mundial = regional de la zona × 1,5 redondeado a .99, en todas las zonas", () => {
  for (const z of config.zonas.filter((x) => x.activa)) {
    const t = tablaZona(config, z.id).planes;
    for (const p of PLANES) assert.equal(t.mundial[p], redondear99(t.regional[p] * config.factor_mundial), `${z.id} ${p}`);
  }
});

test("Nueva Zelanda: ×1,40 manual (la renta daría 1,25) con el BCE 1,9961", () => {
  const nz = config.zonas.find((z) => z.id === "nz");
  assert.equal(nz.multiplicador_manual, 1.4);
  assert.equal(nz.multiplicador_calculado_info, 1.25);
  assert.equal(config.tipo_cambio.eur_a.NZD, 1.9961);
  const t = tablaZona(config, "nz").planes;
  assert.deepEqual([t.regional.mensual, t.regional.anual, t.regional.fundador_anual], [1199, 8399, 6999]);
  assert.deepEqual([t.mundial.mensual, t.mundial.anual, t.mundial.fundador_anual], [1799, 12599, 10499]);
  assert.equal(zonaDePais(config, "NZ").id, "nz");
});

test("zonas preparadas e inactivas: se cobran como el resto del mundo", () => {
  for (const p of ["AU", "US", "GB", "CA", "CH", "MA", "JP"]) assert.equal(zonaDePais(config, p).id, "resto");
  assert.equal(zonaDePais(config, "").id, "resto");
});

test("Stripe: un precio por ámbito y plan, en EUR con currency_options", () => {
  const lista = preciosStripe(config);
  assert.equal(lista.length, AMBITOS.length * PLANES.length);
  const reg = lista.find((p) => p.lookup_key === `cv_regional_mensual_v${config.version_precios}`);
  assert.equal(reg.moneda, "eur");
  assert.equal(reg.importe, 399);
  assert.deepEqual(reg.currency_options, { nzd: 1199 });
  assert.deepEqual(precioParaZona(config, "nz", "mundial", "anual"), { lookup_key: `cv_mundial_anual_v${config.version_precios}`, moneda: "NZD", importe: 12599 });
  assert.ok(lista.filter((p) => p.fundador).every((p) => p.intervalo === "year"));
});

test("una zona en EUR con otro importe lleva su propio precio", () => {
  const c = structuredClone(config);
  c.multiplicadores_pais.MA = { multiplicador: 0.6 };
  c.zonas.push({ id: "ma", activa: true, paises: ["MA"], moneda: "EUR", redondeo: "99", region_contenido: "es" });
  const lista = preciosStripe(c);
  const propio = lista.find((p) => p.lookup_key.endsWith("_zma") && p.ambito === "regional" && p.plan === "mensual");
  assert.ok(propio);
  assert.equal(propio.importe, 299);
});

test("ahorro del anual", () => {
  assert.equal(ahorroAnual(399, 2999), 37);
  assert.equal(ahorroAnual(1199, 8399), 41);
});

test("metadatos del precio: plan, ámbito y fundador; precios antiguos como regional", () => {
  assert.deepEqual(datosDePrecio({ id: "price_x", lookup_key: "k", metadata: { costaviva_plan: "fundador_anual", costaviva_ambito: "mundial", costaviva_fundador: "true" } }),
    { periodo: "anual", ambito: "mundial", fundador: true, lookup_key: "k" });
  assert.equal(datosDePrecio({ id: "price_1UG0hPGVID60u22a3GO1Cflj" }).periodo, "anual");
  assert.equal(datosDePrecio({ id: "price_y", recurring: { interval: "month" } }).periodo, "mensual");
});

test("ámbitos: regional = región de la zona; Mundial = todas las activas", () => {
  const nz = config.zonas.find((z) => z.id === "nz");
  assert.deepEqual(regionesDelAmbito(nz, "regional", ["es", "nz"]), ["nz"]);
  assert.deepEqual(regionesDelAmbito(nz, "mundial", ["es", "nz", "au"]), ["es", "nz", "au"]);
});

test("PRECIOS.md y resumen se generan sin red", () => {
  const { md } = generarPreciosMd(config);
  assert.match(md, /Plan Mundial · Fundador/);
  assert.match(md, /11,99 NZD/);
  assert.match(generarResumen(config), /Precios vigentes/);
});
