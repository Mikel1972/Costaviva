// scripts/kpis/evaluar-cambios.mjs — SIN IA y sin red.
// Registro y evaluación de los cambios que hace la rutina de KPIs
// (scripts/kpis/rutina-kpis.txt) para mejorar el paso del embudo más en rojo.
//
// kpis/costaviva/cambios.jsonl de comun (privado), solo se añaden líneas (nunca se reescribe):
//   {"tipo":"cambio","id":"kpi-2026-10-13-cta-precios","fecha":"2026-10-13","rama":"robot/diseno-...",
//    "pr":null,"paso":"nuevos_pagos","descripcion":"...","ficheros":["login.html"]}
//   {"tipo":"fusion","id":"...","fecha":"2026-10-14","pr":201}
//   {"tipo":"evaluacion","id":"...","fecha":"2026-10-28","antes":{...},"despues":{...},
//    "veredicto":"mejora|igual|empeora|sin_datos","accion":"mantener|revertir|reevaluar"}
//   {"tipo":"revertido","id":"...","fecha":"...","pr":215}
//
// Regla de Mikel: cada cambio se evalúa a las 2 semanas de fusionarse con su
// KPI (14 días antes contra 14 días después). Si empeora, se revierte por PR.
// Con muy pocos casos (< MIN_CASOS en cualquiera de las dos ventanas) no se
// decide: se reevalúa 2 semanas después, hasta 3 veces; después se mantiene
// y se dice que no hubo datos suficientes.
//
// Uso:
//   node scripts/kpis/evaluar-cambios.mjs            # JSON: evaluaciones que tocan hoy
//   node scripts/kpis/evaluar-cambios.mjs --anotar   # además las añade a cambios.jsonl

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sumarDias, diasEntre, diaMadrid, redondear } from "./lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export { RUTA_CAMBIOS } from "./rutas.mjs";
import { RUTA_CAMBIOS, RUTA_HISTORICO } from "./rutas.mjs";
export const DIAS_EVALUAR = 14;
export const MIN_CASOS = 10;
export const MAX_REEVALUACIONES = 3;

export function leerCambios(ruta = RUTA_CAMBIOS) {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Métrica de cada paso: numerador / denominador en una ventana de días.
const METRICAS = {
  visitas: { nombre: "visitas por día", num: (l) => l.visitas, den: () => 1 },
  altas: { nombre: "visita → alta", num: (l) => l.altas, den: (l) => l.visitas },
  activaciones: { nombre: "alta → activación (cohortes)", num: (l) => l.cohorte_activacion?.activadas, den: (l) => l.cohorte_activacion?.altas },
  nuevos_pagos: { nombre: "alta → pago", num: (l) => l.nuevos_pagos, den: (l) => l.altas_confirmadas },
  checkout: { nombre: "alta → abre el pago", num: (l) => l.checkout_iniciado, den: (l) => l.altas },
  retencion: { nombre: "retención semana 4", num: (l) => l.cohorte_retencion?.activas_s4, den: (l) => l.cohorte_retencion?.altas },
};

export function medir(historico, paso, desde, hasta) {
  const m = METRICAS[paso];
  if (!m) return null;
  let num = 0, den = 0, dias = 0;
  for (const l of historico) {
    if (l.fecha < desde || l.fecha > hasta) continue;
    const a = m.num(l), b = m.den(l);
    if (typeof a !== "number" || typeof b !== "number") continue;
    num += a; den += b; dias++;
  }
  return { metrica: m.nombre, desde, hasta, num, den, dias, tasa: den ? redondear(num / den, 4) : null };
}

export function veredicto(antes, despues) {
  if (!antes || !despues || antes.den < MIN_CASOS || despues.den < MIN_CASOS || antes.tasa == null || despues.tasa == null) return "sin_datos";
  if (despues.tasa < antes.tasa * 0.9) return "empeora";
  if (despues.tasa > antes.tasa * 1.1) return "mejora";
  return "igual";
}

// Estado de cada cambio a partir de sus líneas.
function porId(lineas) {
  const m = new Map();
  for (const l of lineas) {
    if (!m.has(l.id)) m.set(l.id, { cambio: null, fusion: null, evaluaciones: [], revertido: null });
    const x = m.get(l.id);
    if (l.tipo === "cambio") x.cambio = l;
    else if (l.tipo === "fusion") x.fusion = l;
    else if (l.tipo === "evaluacion") x.evaluaciones.push(l);
    else if (l.tipo === "revertido") x.revertido = l;
  }
  return m;
}

// Evaluaciones que tocan hoy.
export function pendientes(lineas, historico, hoy) {
  const out = [];
  for (const [id, x] of porId(lineas)) {
    if (!x.cambio || !x.fusion || x.revertido) continue;
    const ultima = x.evaluaciones.at(-1);
    if (ultima && ultima.accion !== "reevaluar") continue;
    const base = ultima ? ultima.fecha : x.fusion.fecha;
    if (diasEntre(base, hoy) < DIAS_EVALUAR) continue;
    const f = x.fusion.fecha;
    const antes = medir(historico, x.cambio.paso, sumarDias(f, -DIAS_EVALUAR), sumarDias(f, -1));
    const despues = medir(historico, x.cambio.paso, sumarDias(f, 1), sumarDias(hoy, -1));
    const v = veredicto(antes, despues);
    const reev = x.evaluaciones.length;
    const accion = v === "empeora" ? "revertir" : v === "sin_datos" ? (reev + 1 >= MAX_REEVALUACIONES ? "mantener" : "reevaluar") : "mantener";
    out.push({ tipo: "evaluacion", id, fecha: hoy, paso: x.cambio.paso, antes, despues, veredicto: v, accion,
      ...(v === "sin_datos" && accion === "mantener" ? { nota: `Sin datos suficientes tras ${MAX_REEVALUACIONES} intentos: se mantiene.` } : {}) });
  }
  return out;
}

// Para KPIS.md: una fila por cambio.
export function estadoCambios(lineas) {
  const out = [];
  for (const [, x] of porId(lineas)) {
    if (!x.cambio) continue;
    const e = x.evaluaciones.at(-1);
    const evaluacion = x.revertido ? `revertido el ${x.revertido.fecha}` : e ? `${e.veredicto} (${e.antes?.tasa ?? "—"} → ${e.despues?.tasa ?? "—"}) → ${e.accion}` : x.fusion ? `se evalúa desde el ${sumarDias(x.fusion.fecha, DIAS_EVALUAR)}` : "PR sin fusionar";
    out.push({ descripcion: x.cambio.descripcion, paso: x.cambio.paso, pr: x.fusion?.pr ?? x.cambio.pr, fusionado: x.fusion?.fecha ?? null, evaluacion });
  }
  return out;
}

function principal() {
  const hoy = diaMadrid(new Date());
  const lineas = leerCambios();
  const ruta = RUTA_HISTORICO;
  const historico = existsSync(ruta) ? readFileSync(ruta, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const p = pendientes(lineas, historico, hoy);
  console.log(JSON.stringify(p, null, 2));
  if (process.argv.includes("--anotar") && p.length) appendFileSync(RUTA_CAMBIOS, p.map((x) => JSON.stringify(x)).join("\n") + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) principal();
