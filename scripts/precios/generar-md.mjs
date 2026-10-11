#!/usr/bin/env node
// scripts/precios/generar-md.mjs — sin IA.
// Genera PRECIOS.md (todos los precios del mundo en un sitio) y
// datos/precios-resumen.md (tabla compacta "Precios vigentes" para el resumen
// de los lunes) a partir de functions/_lib/precios-zonas.json.
//
// Equivalente en EUR = precio local / cambio_actual del BCE (lo refresca cada
// semana precios-semanal.yml). Si ese equivalente se aleja más de un 10 % del
// que había con el cambio con el que se fijó el precio (tipo_cambio), la fila
// sale marcada como PROPUESTA de revisión: nada cambia solo.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RAIZ, leerConfig } from "./fuentes.mjs";
import { AMBITOS, PLANES, importeZona, multiplicadorPendiente } from "../../functions/_lib/precios.js";

export const UMBRAL_DESVIO = 0.10;

const NOMBRE_PLAN = { mensual: "Mensual", anual: "Anual", fundador_anual: "Fundador (anual)" };
const NOMBRE_AMBITO = { regional: "Plan regional", mundial: "Plan Mundial" };

const fmt = (cent, moneda) => `${(cent / 100).toFixed(2).replace(".", ",")} ${moneda}`;
const pct = (x) => `${x > 0 ? "+" : ""}${Math.round(x * 100)} %`;

// Multiplicador y su origen para una fila (también las zonas preparadas).
export function origenMultiplicador(config, zona) {
  if (typeof zona.multiplicador_fijo === "number") return { valor: zona.multiplicador_fijo, origen: zona.id === "ue_eee" ? "fijo por ley (geobloqueo UE)" : "fijo (resto del mundo)" };
  if (typeof zona.multiplicador_manual === "number") {
    const info = zona.multiplicador_calculado_info != null ? `; la renta daría ${String(zona.multiplicador_calculado_info).replace(".", ",")}` : "";
    return { valor: zona.multiplicador_manual, origen: `manual de Mikel (${zona.multiplicador_manual_fecha || "?"}${info})` };
  }
  const m = config.multiplicadores_pais?.[zona.paises[0]];
  if (!m) return { valor: null, origen: "sin dato del Banco Mundial" };
  return { valor: m.multiplicador, origen: `RNB Atlas ${m.anio} (${m.rnb_usd.toLocaleString("es-ES")} $) / España (${config.renta.referencia.rnb_usd.toLocaleString("es-ES")} $)` };
}

export function filasPrecios(config, ambito, plan) {
  const cambioHoy = config.cambio_actual?.eur_a || config.tipo_cambio?.eur_a || {};
  const cambioPrecio = config.tipo_cambio?.eur_a || {};
  const espana = importeZona(config, { moneda: "EUR", multiplicador_fijo: 1, redondeo: "99" }, ambito, plan);
  return config.zonas.map((z) => {
    const { valor, origen } = origenMultiplicador(config, z);
    let local = null;
    try { local = valor == null || multiplicadorPendiente(z) ? null : importeZona(config, { ...z, multiplicador_fijo: valor }, ambito, plan); } catch { local = null; }
    const tHoy = z.moneda === "EUR" ? 1 : cambioHoy[z.moneda];
    const tPrecio = z.moneda === "EUR" ? 1 : cambioPrecio[z.moneda];
    const eurHoy = local != null && tHoy ? Math.round(local / tHoy) : null;
    const eurAlFijar = local != null && tPrecio ? Math.round(local / tPrecio) : null;
    const desvio = eurHoy != null && eurAlFijar ? eurHoy / eurAlFijar - 1 : 0;
    return {
      zona: z, estado: z.activa ? "activa" : "preparada", moneda: z.moneda, multiplicador: valor, origen,
      local, eurHoy, difEspana: eurHoy != null ? eurHoy / espana - 1 : null,
      desvio, alerta: z.activa && Math.abs(desvio) > UMBRAL_DESVIO,
    };
  });
}

export function generarPreciosMd(config) {
  const L = [];
  L.push("# Precios de Costaviva Premium");
  L.push("");
  L.push("Generado sin IA por `scripts/precios/generar-md.mjs` a partir de `functions/_lib/precios-zonas.json`. No editar a mano.");
  L.push("");
  L.push(`Versión de precios: \`${config.version_precios}\` · Mundial = regional de la zona × ${String(config.factor_mundial).replace(".", ",")} · plazas de fundador: ${config.plazas_fundador} (compartidas entre regional y Mundial). Todos los precios con impuestos incluidos.`);
  const alertas = [];
  for (const ambito of AMBITOS) {
    for (const plan of PLANES) {
      L.push("");
      L.push(`## ${NOMBRE_AMBITO[ambito]} · ${NOMBRE_PLAN[plan]}`);
      L.push("");
      L.push("| Zona | Países | Estado | Moneda | Multiplicador | De dónde sale | Precio local | Equivalente EUR (BCE hoy) | Frente a España |");
      L.push("|---|---|---|---|---|---|---|---|---|");
      for (const f of filasPrecios(config, ambito, plan)) {
        const paises = f.zona.paises.length > 6 ? `${f.zona.paises.length} países` : f.zona.paises.join(", ") || "el resto";
        const marca = f.alerta ? ` ⚠ desvío ${pct(f.desvio)}` : "";
        if (f.alerta) alertas.push(`${f.zona.nombre} (${NOMBRE_AMBITO[ambito]}, ${NOMBRE_PLAN[plan]}): ${pct(f.desvio)}`);
        L.push(`| ${f.zona.nombre} | ${paises} | ${f.estado} | ${f.moneda} | ${f.multiplicador == null ? "—" : String(f.multiplicador).replace(".", ",")} | ${f.origen} | ${f.local == null ? "—" : fmt(f.local, f.moneda)} | ${f.eurHoy == null ? "—" : fmt(f.eurHoy, "EUR")}${marca} | ${f.difEspana == null ? "—" : pct(f.difEspana)} |`);
      }
    }
  }
  L.push("");
  L.push("## Desvíos del cambio (propuestas, no se aplican solas)");
  L.push("");
  L.push(alertas.length ? alertas.map((a) => `- ⚠ ${a} frente al cambio con el que se fijó el precio. Propuesta: revisar con el recálculo de precios.`).join("\n") : `- Ninguna zona activa se desvía más de un ${UMBRAL_DESVIO * 100} %.`);
  L.push("");
  L.push("## Multiplicador por renta de todos los países (informativo)");
  L.push("");
  L.push("Solo cuenta para las zonas activas. Acotado entre 0,6 y 1,5 y redondeado a 0,05. La UE/EEE va siempre a 1,0 por ley.");
  L.push("");
  L.push("| País | RNB Atlas (USD) | Año | Multiplicador |");
  L.push("|---|---|---|---|");
  for (const [iso, m] of Object.entries(config.multiplicadores_pais || {})) {
    L.push(`| ${m.nombre} (${iso}) | ${m.rnb_usd.toLocaleString("es-ES")} | ${m.anio} | ${String(m.multiplicador).replace(".", ",")} |`);
  }
  L.push("");
  L.push("## Fuentes");
  L.push("");
  L.push(`- Cambio con el que se fijaron los precios: ${config.tipo_cambio?.fuente} del ${config.tipo_cambio?.fecha}.`);
  L.push(`- Cambio de hoy (equivalentes en EUR): ${config.cambio_actual?.fuente || config.tipo_cambio?.fuente} del ${config.cambio_actual?.fecha || config.tipo_cambio?.fecha}.`);
  L.push(`- Renta: ${config.renta.descripcion}, ${config.renta.referencia?.fuente || "Banco Mundial"}. España ${config.renta.referencia?.anio}: ${config.renta.referencia?.rnb_usd?.toLocaleString("es-ES")} $.`);
  L.push("- Por qué renta nominal y no PPA: con paridad de poder adquisitivo Nueva Zelanda y España quedan casi iguales; lo que importa es cuánto paga la gente en su moneda.");
  L.push("");
  return { md: L.join("\n"), alertas };
}

export function generarResumen(config) {
  const L = ["### Precios vigentes", "", "| Zona | Moneda | Regional mes / año / fundador | Mundial mes / año / fundador | En EUR (regional mes) |", "|---|---|---|---|---|"];
  for (const z of config.zonas.filter((x) => x.activa)) {
    const f = (ambito) => PLANES.map((p) => fmt(filasPrecios(config, ambito, p).find((x) => x.zona.id === z.id).local, "").trim()).join(" / ");
    const eur = filasPrecios(config, "regional", "mensual").find((x) => x.zona.id === z.id);
    L.push(`| ${z.nombre} | ${z.moneda} | ${f("regional")} | ${f("mundial")} | ${fmt(eur.eurHoy, "€")}${eur.alerta ? ` ⚠ ${pct(eur.desvio)}` : ""} |`);
  }
  const { alertas } = generarPreciosMd(config);
  if (alertas.length) L.push("", "**Propuesta (no se aplica sola):** el cambio se ha movido más de un 10 % en: " + alertas.join("; ") + ".");
  L.push("", `Cambio BCE del ${config.cambio_actual?.fecha || config.tipo_cambio?.fecha}. Detalle: PRECIOS.md.`);
  return L.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = leerConfig();
  const { md, alertas } = generarPreciosMd(config);
  writeFileSync(join(RAIZ, "PRECIOS.md"), md);
  mkdirSync(join(RAIZ, "datos"), { recursive: true });
  writeFileSync(join(RAIZ, "datos", "precios-resumen.md"), generarResumen(config));
  console.log(`PRECIOS.md y datos/precios-resumen.md generados. Alertas de desvío: ${alertas.length}.`);
  if (alertas.length && process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Desvío de cambio > 10 %\n\n${alertas.map((a) => `- ${a}`).join("\n")}\n`);
  }
}
