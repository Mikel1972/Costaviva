// scripts/kpis/informe.mjs — SIN IA y sin red.
// Lee datos-robots/kpis/historico.jsonl (recoger.mjs) y escribe:
//   - KPIS.md (raíz del repo): árbol de KPIs, tablas por quincena y semana
//     con real, objetivo, desviación y estado, canales, socios y cambios;
//   - datos-robots/kpis/mrr.svg: MRR real contra los tres escenarios;
//   - datos-robots/kpis/resumen.json: lo mismo en datos, para comun (KPIS.md
//     agregado) y para la rutina que actúa sobre el paso más en rojo.
// Lo lanza kpis.yml los lunes (y a mano). Uso: node scripts/kpis/informe.mjs [--hoy AAAA-MM-DD]

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  OBJETIVOS, INICIO, ESCENARIOS, SUPUESTOS, PRECIO_MENSUAL, PRECIO_ANUAL, CANALES, MIN_N,
  diaMadrid, sumarDias, diasEntre, quincenas, semanas, agregarPeriodo, tasas, arpu, objetivosPeriodo,
  PAISES, mrrObjetivoPais, objetivosPais, paisMasBajo,
  filasKpi, pasoMasRojo, tablaKpi, svgMrr, mrrObjetivo, alarmaBajoSuelo, estado, desviacion, ICONO, eur, redondear,
} from "./lib.mjs";
import { leerHistorico, RUTA_HISTORICO } from "./recoger.mjs";
import { leerCambios, RUTA_CAMBIOS, estadoCambios } from "./evaluar-cambios.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(RAIZ, "datos-robots", "kpis");

const NOMBRE_PASO = {
  visitas: "Visitas a páginas públicas", altas: "Altas (visita → alta)", activaciones: "Activación en 7 días",
  nuevos_pagos: "Pago (prueba → pago)", retencion: "Retención semana 4",
};
const NOMBRE_CANAL = { google: "Google y buscadores", instagram: "Instagram y Facebook", socios: "Socios (códigos)", directo: "Directo o desconocido", otros: "Otros (WhatsApp, email, amigos...)" };

export function construir(lineas, hoy, cambios = []) {
  const ayer = sumarDias(hoy, -1);
  const ultimoStock = [...lineas].reverse().find((l) => l.stock);
  const t = tasas(lineas);
  const a = arpu(ultimoStock?.stock);
  // Cierres de quincena para las reglas de escenario.
  const qs = quincenas(ayer);
  const cierres = qs.filter((q) => q.hasta <= ayer).map((q) => ({ id: q.id, mrr: agregarPeriodo(lineas, q).stock?.mrr_eur ?? null }));
  const escenario = OBJETIVOS.objetivo, suelo = OBJETIVOS.suelo_alarma;
  const alarma = alarmaBajoSuelo(cierres);

  const periodo = (p) => {
    const agg = agregarPeriodo(lineas, p);
    const obj = objetivosPeriodo(p, escenario, t, a);
    const objSuelo = objetivosPeriodo(p, suelo, t, a);
    const len = diasEntre(p.desde, p.hasta) + 1;
    const transcurridos = Math.max(0, Math.min(len, diasEntre(p.desde, ayer) + 1));
    const enCurso = p.hasta > ayer;
    const fraccion = enCurso ? transcurridos / len : 1;
    // El MRR objetivo de un periodo en curso es el de ayer.
    const objAjustado = enCurso ? { ...obj, mrr_eur: redondear(mrrObjetivo(ayer, escenario)) } : obj;
    const sueloAjustado = enCurso ? { ...objSuelo, mrr_eur: redondear(mrrObjetivo(ayer, suelo)) } : objSuelo;
    const filas = filasKpi(agg, objAjustado, { fraccion, suelo: sueloAjustado });
    return { ...p, en_curso: enCurso, dias: `${transcurridos}/${len}`, agg, obj: objAjustado, filas, rojo: pasoMasRojo(filas) };
  };
  const Q = qs.map(periodo);
  const S = semanas(sumarDias(INICIO, -28), ayer).map(periodo);
  const actual = Q.at(-1) ?? null;
  // Por país (quincena en curso): visitas, altas, pagos y MRR contra su objetivo.
  const paises = actual ? PAISES.map((p) => {
    const o = objetivosPais(actual, p, escenario, t);
    const len = diasEntre(actual.desde, actual.hasta) + 1;
    const fr = actual.en_curso ? Math.max(0, Math.min(len, diasEntre(actual.desde, ayer) + 1)) / len : 1;
    const real = actual.agg.stock?.mrr_pais?.[p] ?? null;
    const objetivo = redondear(mrrObjetivoPais(actual.en_curso ? ayer : actual.hasta, p, escenario));
    const suelo = redondear(mrrObjetivoPais(actual.en_curso ? ayer : actual.hasta, p, OBJETIVOS.suelo_alarma));
    return {
      pais: p, nombre: OBJETIVOS.paises[p].nombre,
      visitas: p === "pt" ? null : actual.agg.visitas_pais?.[p] ?? null, visitas_obj: redondear(o.visitas * fr, 1),
      altas: actual.agg.altas_pais?.[p] ?? null, altas_obj: redondear(o.altas * fr, 1),
      pagos: actual.agg.pagos_pais?.[p] ?? null, pagos_obj: redondear(o.nuevos_pagos * fr, 1),
      real, objetivo, suelo, ...estado(real, objetivo, suelo), desv: desviacion(real, objetivo),
    };
  }) : [];
  const paisFoco = paisMasBajo(paises);
  const antes = agregarPeriodo(lineas, { desde: "2026-09-15", hasta: sumarDias(INICIO, -1) });
  return { hoy, ayer, lineas, ultimoStock, t, a, escenario, suelo, alarma, cierres, paises, paisFoco, Q, S, actual, antes, cambios };
}

const num = (v) => (v == null ? "—" : Number(v).toLocaleString("es-ES", { maximumFractionDigits: 1 }));
function fmtTasa(x) { return `${(x.valor * 100).toFixed(1)} % ${x.real ? `(real, n=${x.n})` : `(supuesto; real con n=${x.n}, hace falta ${MIN_N})`}`; }

export function markdown(r) {
  const { ultimoStock: u, actual } = r;
  const s = u?.stock;
  const L = [];
  L.push("# KPIs de Costaviva", "");
  L.push(`Generado sin IA por \`scripts/kpis/informe.mjs\` el ${r.hoy} con datos hasta el ${r.ayer} (\`datos-robots/kpis/historico.jsonl\`). No se edita a mano.`, "");
  const f = u?.fuentes ?? {};
  L.push(`**Fuentes:** Supabase ${f.supabase === "ok" ? "✅" : "❌"} · Stripe ${f.stripe === "ok" ? "✅ (API, solo lectura)" : f.stripe === "error" ? "❌ error" : "⚠️ sin clave `STRIPE_KPI_KEY`: MRR a precio de lista desde `suscripciones`, sin facturado ni cancelaciones"}${u ? ` · último dato ${u.fecha}` : " · sin datos todavía"}.`, "");
  L.push(`**Objetivo:** ${OBJETIVOS.escenarios[r.escenario].nombre} · **suelo de alarma:** ${OBJETIVOS.escenarios[r.suelo].nombre} · prudente solo como referencia. ${OBJETIVOS.reglas.semaforo} Sin ajustes estacionales.`, "");
  if (r.alarma.avisar) L.push(`> ⚠️ **Aviso a Mikel:** el MRR real ha quedado por debajo del suelo (escenario base) al cierre de ${r.alarma.quincenas.join(" y ")}. La causa y la propuesta van en el Issue de los lunes (rutina de KPIs).`, "");

  L.push("## Estrella polar: MRR", "");
  const objHoy = mrrObjetivo(r.ayer, r.escenario);
  const e = estado(s?.mrr_eur ?? null, objHoy, mrrObjetivo(r.ayer, r.suelo));
  L.push(`- **MRR real:** ${eur(s?.mrr_eur ?? null)} (${s?.mrr_fuente === "stripe" ? "Stripe, anuales a 1/12, con descuentos" : "precio de lista desde Supabase"}) · objetivo hoy ${eur(redondear(objHoy))} (suelo ${eur(redondear(mrrObjetivo(r.ayer, r.suelo)))}) · ${desviacion(s?.mrr_eur ?? null, objHoy)} · ${ICONO[e.estado]}`);
  L.push(`- **Suscriptores de pago:** ${s ? `${s.suscriptores.mensual} mensuales y ${s.suscriptores.anual} anuales` : "—"} · en prueba con tarjeta en Stripe: ${s?.en_prueba_stripe ?? "—"} · con baja programada: ${s?.cancelacion_programada ?? "—"}`);
  L.push(`- **ARPU:** ${eur(redondear(r.a.valor))} ${r.a.real ? "(real)" : "(supuesto de objetivos.json hasta tener datos)"} · precios de hoy ${eur(PRECIO_MENSUAL)}/mes y ${eur(PRECIO_ANUAL)}/año`);
  L.push(`- **Usuarios:** ${s?.perfiles ?? "—"} cuentas válidas (sin admin, pruebas ni accesos regalados) · activos en 7 días: ${s?.activos_7d ?? "—"}`);
  L.push(`- **Referencia de ${eur(OBJETIVOS.referencia.mrr)} el ${OBJETIVOS.referencia.fecha}:** ${OBJETIVOS.referencia.nota}`, "");
  L.push("![MRR real contra objetivo](datos-robots/kpis/mrr.svg)", "");

  if (actual) {
    L.push(`## Paso del embudo más en rojo (${actual.id}, ${actual.desde} → ${actual.hasta}${actual.en_curso ? `, en curso ${actual.dias} días` : ""})`, "");
    L.push(actual.rojo ? `**${NOMBRE_PASO[actual.rojo.clave]}**: real ${actual.rojo.real == null ? "sin dato" : num(actual.rojo.real)} contra ${num(actual.rojo.objetivo)} (${actual.rojo.desv}, ${ICONO[actual.rojo.estado]}). Es el que trabaja la rutina de KPIs (\`scripts/kpis/rutina-kpis.txt\`).` : "Sin datos para elegir.", "");
  }

  if (actual) {
    L.push(`## Por país (${actual.id}${actual.en_curso ? `, en curso ${actual.dias} días` : ""})`, "");
    L.push(`Objetivo de marzo de 2027: ${PAISES.map((p) => `${OBJETIVOS.paises[p].nombre} ${eur(OBJETIVOS.paises[p].mrr_marzo)}`).join(", ")}. Curva de cada país = escenario objetivo escalado a su parte; ARPU ${PAISES.map((p) => `${p.toUpperCase()} ${eur(OBJETIVOS.paises[p].arpu_eur)}`).join(", ")}. Visitas de España y Portugal juntas (no se separan por spot); NZ = páginas /en/.`, "");
    L.push("| País | Visitas | Altas | Pagos nuevos | MRR real | MRR objetivo | Suelo | Desv. | Estado |", "|---|---|---|---|---|---|---|---|---|");
    const tot = { visitas: 0, altas: 0, pagos: 0, real: 0, objetivo: 0, suelo: 0, vo: 0, ao: 0, po: 0, conReal: false };
    for (const f of r.paises) {
      L.push(`| ${f.nombre}${f.pais === r.paisFoco ? " ← foco" : ""} | ${f.pais === "pt" ? "(con ES)" : `${num(f.visitas)} / ${num(f.visitas_obj)}`} | ${num(f.altas)} / ${num(f.altas_obj)} | ${num(f.pagos)} / ${num(f.pagos_obj)} | ${eur(f.real)} | ${eur(f.objetivo)} | ${eur(f.suelo)} | ${f.desv} | ${ICONO[f.estado]} |`);
      tot.visitas += f.visitas ?? 0; tot.altas += f.altas ?? 0; tot.pagos += f.pagos ?? 0; tot.real += f.real ?? 0; tot.conReal ||= f.real != null;
      tot.objetivo += f.objetivo ?? 0; tot.suelo += f.suelo ?? 0; tot.vo += f.visitas_obj ?? 0; tot.ao += f.altas_obj ?? 0; tot.po += f.pagos_obj ?? 0;
    }
    const realT = tot.conReal ? redondear(tot.real) : null;
    const et = estado(realT, redondear(tot.objetivo), redondear(tot.suelo));
    L.push(`| **Total** | ${num(tot.visitas)} / ${num(redondear(tot.vo, 1))} | ${num(tot.altas)} / ${num(redondear(tot.ao, 1))} | ${num(tot.pagos)} / ${num(redondear(tot.po, 1))} | ${eur(realT)} | ${eur(redondear(tot.objetivo))} | ${eur(redondear(tot.suelo))} | ${desviacion(realT, tot.objetivo)} | ${ICONO[et.estado]} |`);
    L.push("", `Celdas: real / objetivo (prorrateado si la quincena está en curso). **País en foco** (el que va más por debajo de su objetivo; es donde actúa la rutina): ${r.paisFoco ? OBJETIVOS.paises[r.paisFoco].nombre : "—"}.`, "");
  }

  L.push("## Árbol de KPIs", "");
  L.push("```", "MRR (€/mes) = suscriptores de pago × ARPU", "├─ Pagos nuevos = altas × (prueba → pago)", "│  ├─ Altas = visitas × (visita → alta)      [canales: Google, Instagram, socios, directo, otros]", "│  ├─ Activación: usa la app 2 días distintos de su primera semana y hace algo más que mirar el mapa", "│  └─ Prueba gratis desde el alta (toda alta es una prueba)", "├─ − Cancelaciones (retención semana 4)", `└─ ARPU = MRR / suscriptores (lista: ${eur(PRECIO_MENSUAL)}/mes; ${eur(PRECIO_ANUAL)}/año = ${eur(redondear(PRECIO_ANUAL / 12))}/mes)`, "```", "");

  L.push("## Por quincena (acumulado de cada quincena)", "");
  L.push("| Quincena | Días | MRR real | MRR objetivo | Desv. | Estado | Visitas | Altas | Activ. | Pagos nuevos | Facturado |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const q of [...r.Q].reverse()) {
    const g = (k) => q.filas.find((x) => x.clave === k);
    const c = (k) => { const x = g(k); return `${num(x.real)} / ${num(x.objetivo)} ${ICONO[x.estado].split(" ")[0]}`; };
    const m = g("mrr");
    L.push(`| ${q.id} (${q.desde.slice(5)} → ${q.hasta.slice(5)})${q.en_curso ? " en curso" : ""} | ${q.dias} | ${eur(m.real)} | ${eur(m.objetivo)} | ${m.desv} | ${ICONO[m.estado]} | ${c("visitas")} | ${c("altas")} | ${c("activaciones")} | ${c("nuevos_pagos")} | ${eur(g("facturado").real)} |`);
  }
  L.push("", "Celdas: real / objetivo (prorrateado si la quincena está en curso).", "");
  if (actual) L.push(`### Detalle de ${actual.id}`, "", tablaKpi(actual.filas), "");

  L.push("## Por semana (lunes a domingo)", "");
  for (const w of [...r.S].reverse().slice(0, 4)) L.push(`### Semana del ${w.desde}${w.en_curso ? ` (en curso, ${w.dias} días)` : ""}`, "", tablaKpi(w.filas), "");

  L.push("## Línea base: antes del inicio (2026-09-15 → 2026-10-10)", "");
  const b = r.antes;
  L.push(`Altas ${b.altas ?? "—"} (confirmadas ${b.altas_confirmadas ?? "—"}) · visitas medidas ${b.visitas ?? "—"} (el contador empezó el 2026-10-10) · pagos nuevos ${b.nuevos_pagos ?? "—"} · personas que abrieron el pago ${b.checkout_iniciado ?? "—"} · cancelaciones ${b.cancelaciones ?? "—"} · facturado ${eur(b.facturado_eur)}.`, "");

  L.push("## Canales de origen", "");
  L.push("| Canal | Altas (quincena) | Pagos (quincena) | Altas (total) | Pagos (total) |", "|---|---|---|---|---|");
  const tot = agregarPeriodo(r.lineas, { desde: "0000", hasta: "9999" });
  for (const c of CANALES) L.push(`| ${NOMBRE_CANAL[c]} | ${actual?.agg.altas_canal[c] ?? 0} | ${actual?.agg.pagos_canal[c] ?? 0} | ${tot.altas_canal[c] ?? 0} | ${tot.pagos_canal[c] ?? 0} |`);
  L.push("");

  L.push("## Canal socios: ranking", "");
  const soc = s?.socios;
  if (!soc) L.push("Sin datos: hace falta `STRIPE_KPI_KEY` (los códigos de socio se leen de Stripe).", "");
  else if (!Object.keys(soc).length) L.push("Todavía no hay ningún código de socio en Stripe (los crea `scripts/socios/crear-codigos.mjs` de comun al pasar una entidad a \"acordado\").", "");
  else {
    const filas = Object.entries(soc).sort((x, y) => y[1].facturado_eur - x[1].facturado_eur || y[1].altas - x[1].altas);
    L.push("| # | Código | Altas | Suscriptores | MRR | Facturado |", "|---|---|---|---|---|---|");
    filas.forEach(([k, v], i) => L.push(`| ${i + 1} | ${k} | ${v.altas} | ${v.suscriptores} | ${eur(v.mrr_eur)} | ${eur(v.facturado_eur)} |`));
    L.push("");
  }

  L.push(`## Objetivos quincenales del embudo (${OBJETIVOS.escenarios[r.escenario].nombre}; entre paréntesis, el suelo)`, "");
  L.push(`Tasas usadas: visita → alta ${fmtTasa(r.t.visita_alta)}; alta → pago ${fmtTasa(r.t.alta_pago)}; alta → activación ${fmtTasa(r.t.alta_activacion)}; ARPU ${eur(r.a.valor)}; +${(SUPUESTOS.margen_bajas * 100).toFixed(0)} % de pagos para reponer bajas.`, "");
  L.push("| Quincena | Cierre | MRR ambicioso (objetivo) | MRR base (suelo) | MRR prudente (ref.) | Pagos nuevos | Altas | Activaciones | Visitas |", "|---|---|---|---|---|---|---|---|---|");
  let desde = INICIO;
  OBJETIVOS.quincenas.forEach((q, i) => {
    const o = objetivosPeriodo({ desde, hasta: q.cierre }, r.escenario, r.t, r.a);
    const b = objetivosPeriodo({ desde, hasta: q.cierre }, r.suelo, r.t, r.a);
    const E = OBJETIVOS.escenarios;
    L.push(`| ${q.id} | ${q.cierre} | ${eur(E[r.escenario].mrr[i])} | ${eur(E[r.suelo].mrr[i])} | ${eur(E[OBJETIVOS.referencia_escenario].mrr[i])} | ${o.nuevos_pagos} (${b.nuevos_pagos}) | ${o.altas} (${b.altas}) | ${o.activaciones} (${b.activaciones}) | ${o.visitas} (${b.visitas}) |`);
    desde = sumarDias(q.cierre, 1);
  });
  L.push("");

  L.push("## Cambios de la rutina y su evaluación", "");
  const ec = estadoCambios(r.cambios, r.hoy);
  if (!ec.length) L.push("Ninguno todavía.", "");
  else {
    L.push("| Cambio | Paso | Fusionado | Evaluación |", "|---|---|---|---|");
    for (const c of ec) L.push(`| ${c.descripcion}${c.pr ? ` (#${c.pr})` : ""} | ${NOMBRE_PASO[c.paso] ?? c.paso} | ${c.fusionado ?? "pendiente"} | ${c.evaluacion} |`);
    L.push("");
  }

  L.push("## Cómo se calcula", "");
  L.push("- **Datos:** `kpis.yml` cada mañana lee producción SOLO en lectura (Supabase por REST con la service_role; Stripe con una clave restringida de lectura) y añade al histórico una línea por día cerrado. El histórico nunca se reescribe.");
  L.push("- **Altas** excluyen al admin, las cuentas de pruebas automáticas, los accesos permanentes y las invitaciones del 100 % (igual que `metricas_captacion()`).");
  L.push("- **Estado:** 🟢 llega al objetivo (ambicioso); 🟠 entre el suelo (base) y el objetivo; 🔴 por debajo del suelo. Cancelaciones: 🟢 hasta el máximo previsto, 🟠 hasta un 30 % más. En una quincena o semana en curso los flujos se comparan con el objetivo prorrateado.");
  L.push("- **Objetivos:** `datos-robots/kpis/objetivos.json` (se cambian ahí, sin tocar código).");
  return L.join("\n") + "\n";
}

export function resumenJson(r) {
  const pick = (p) => ({
    id: p.id, desde: p.desde, hasta: p.hasta, en_curso: p.en_curso,
    kpis: Object.fromEntries(p.filas.map((x) => [x.clave, { real: x.real, objetivo: x.objetivo, suelo: x.suelo, estado: x.estado }])),
    altas_canal: p.agg.altas_canal, pagos_canal: p.agg.pagos_canal, paso_mas_rojo: p.rojo?.clave ?? null,
  });
  return {
    app: "Costaviva", generado: r.hoy, datos_hasta: r.ayer, objetivo: r.escenario, suelo: r.suelo, aviso_bajo_suelo: r.alarma,
    fuentes: r.ultimoStock?.fuentes ?? null, stock: r.ultimoStock?.stock ?? null,
    mrr_objetivo_hoy: redondear(mrrObjetivo(r.ayer, r.escenario)),
    pais_foco: r.paisFoco, paises: r.paises,
    quincenas: r.Q.map(pick), semanas: r.S.map(pick),
  };
}

function principal() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--hoy");
  const hoy = i >= 0 ? args[i + 1] : diaMadrid(new Date());
  const lineas = leerHistorico(RUTA_HISTORICO);
  const r = construir(lineas, hoy, leerCambios(RUTA_CAMBIOS));
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(RAIZ, "KPIS.md"), markdown(r));
  const puntos = lineas.filter((l) => l.stock).map((l) => ({ fecha: l.fecha, mrr: l.stock.mrr_eur }));
  writeFileSync(join(DIR, "mrr.svg"), svgMrr(puntos));
  writeFileSync(join(DIR, "resumen.json"), JSON.stringify(resumenJson(r), null, 1) + "\n");
  console.log(`KPIS.md escrito: objetivo ${r.escenario}, ${lineas.length} días de histórico, paso más en rojo: ${r.actual?.rojo?.clave ?? "—"}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) principal();
