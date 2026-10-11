#!/usr/bin/env node
// scripts/precios/multiplicadores.mjs — sin IA.
//
// Recalcula el multiplicador por renta de cada país y el tipo de cambio de los
// precios, y los escribe en functions/_lib/precios-zonas.json.
//
//   node scripts/precios/multiplicadores.mjs            recálculo ANUAL:
//       RNB Atlas (Banco Mundial) + BCE. Si algún importe de una zona activa
//       cambia, sube version_precios: el workflow de precios creará precios
//       nuevos en Stripe y los clientes existentes se quedan en los suyos.
//       Lo lanza multiplicadores-anual.yml, que abre una PR (nada cambia en
//       Stripe hasta que se fusiona).
//   node scripts/precios/multiplicadores.mjs --solo-cambio   SEMANAL:
//       solo refresca cambio_actual (equivalentes en EUR de PRECIOS.md y el
//       aviso de desvío > 10 %). No toca precios.
//
// Por qué RNB Atlas en USD y NO paridad de poder adquisitivo (PPA): con PPA,
// Nueva Zelanda y España quedan casi iguales porque la PPA ya corrige el
// nivel de precios; lo que importa aquí es cuánto paga la gente en su moneda
// por un servicio digital, y eso lo refleja la renta nominal.
//
// Valores manuales (multiplicador_manual de una zona, p. ej. NZ ×1,40) y los
// fijos (UE/EEE por ley, resto del mundo) no se tocan nunca.
import { leerConfig, guardarConfig, descargarBce, descargarRenta } from "./fuentes.mjs";
import { multiplicadorPorRenta, tablaZona } from "../../functions/_lib/precios.js";

const soloCambio = process.argv.includes("--solo-cambio");
const config = leerConfig();
const bce = await descargarBce();

if (soloCambio) {
  config.cambio_actual = bce;
  guardarConfig(config);
  console.log(`Cambio actual del BCE (${bce.fecha}) guardado. Precios sin tocar.`);
  process.exit(0);
}

const importes = (z) => { try { return JSON.stringify(tablaZona(config, z.id).planes); } catch { return null; } };
const antes = Object.fromEntries(config.zonas.filter((z) => z.activa).map((z) => [z.id, importes(z)]));

const r = config.renta;
const renta = await descargarRenta(r.indicador);
const ref = renta[r.pais_referencia];
const multiplicadores = {};
for (const [iso, d] of Object.entries(renta).sort()) {
  multiplicadores[iso] = {
    nombre: d.nombre,
    rnb_usd: d.rnb,
    anio: d.anio,
    multiplicador: multiplicadorPorRenta(d.rnb, ref.rnb, { min: r.minimo, max: r.maximo, paso: r.paso }),
  };
}
config.multiplicadores_pais = multiplicadores;
config.renta.referencia = { pais: r.pais_referencia, rnb_usd: ref.rnb, anio: ref.anio, fuente: "Banco Mundial, World Development Indicators (CC BY 4.0)" };
config.tipo_cambio = bce;
config.cambio_actual = bce;
// Información al lado de los manuales: lo que daría la fórmula.
for (const z of config.zonas) {
  if (typeof z.multiplicador_manual === "number") z.multiplicador_calculado_info = multiplicadores[z.paises[0]]?.multiplicador ?? null;
}

const cambian = config.zonas.filter((z) => z.activa).filter((z) => antes[z.id] !== null && importes(z) !== antes[z.id]);
if (cambian.length) {
  config.version_precios = bce.fecha.replaceAll("-", "_");
  console.log(`Cambian los importes de: ${cambian.map((z) => z.id).join(", ")} -> version_precios ${config.version_precios}`);
} else {
  console.log("Ningún importe de las zonas activas cambia.");
}
guardarConfig(config);
console.log(`Multiplicadores: ${Object.keys(multiplicadores).length} países (RNB ${ref.anio}). BCE ${bce.fecha}.`);
