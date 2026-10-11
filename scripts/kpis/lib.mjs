// scripts/kpis/lib.mjs — SIN IA y sin red.
// KPIs de facturación de Costaviva (2026-10-11). Objetivos de MRR en
// datos-robots/kpis/objetivos.json (tres escenarios; manda el base). Lógica pura:
// objetivos, periodos, estados, tablas de KPIS.md y gráfico SVG. La usan
// recoger.mjs (cada día), informe.mjs (cada lunes), evaluar-cambios.mjs y
// test/kpis.test.js. Explicación completa en CLAUDE.md, "KPIs de facturación".

import { readFileSync } from "node:fs";

// El negocio va en hora de España (CLAUDE.md, "Zona horaria por región"):
export const ZONA = "Europe/Madrid"; // a propósito: días y semanas del negocio


// Objetivos: datos-robots/kpis/objetivos.json (aprobado por Mikel el
// 2026-10-11). Tres escenarios de MRR por cierre de quincena: el objetivo
// oficial es el ambicioso, el base es el suelo de alarma y el prudente solo
// referencia. 4.000 € queda como referencia (exigiría publicidad de pago).
// Sin ajustes estacionales (decisión de Mikel).
const RUTA_OBJETIVOS = new URL("../../datos-robots/kpis/objetivos.json", import.meta.url);
export const OBJETIVOS = JSON.parse(readFileSync(RUTA_OBJETIVOS, "utf8"));
export const INICIO = OBJETIVOS.inicio;
export const META = { fecha: OBJETIVOS.referencia.fecha, mrr: OBJETIVOS.referencia.mrr };
export const DIA = 86400000;
// Precios de lista (solo para el MRR de reserva sin Stripe) y cambio a euros:
// de functions/_lib/precios-zonas.json (el cobro por zonas, 2026-10-11; su
// tipo_cambio es el del BCE que escribe scripts/precios/multiplicadores.mjs).
// Si no está, objetivos.json. Un tipo puesto a mano en objetivos.json manda.
const PRECIOS_ZONAS = (() => {
  try { return JSON.parse(readFileSync(new URL("../../functions/_lib/precios-zonas.json", import.meta.url), "utf8")); } catch { return null; }
})();
export const PRECIO_MENSUAL = PRECIOS_ZONAS?.planes?.mensual?.eur_cent ? PRECIOS_ZONAS.planes.mensual.eur_cent / 100 : OBJETIVOS.precios_lista.eur.mensual;
export const PRECIO_ANUAL = PRECIOS_ZONAS?.planes?.anual?.eur_cent ? PRECIOS_ZONAS.planes.anual.eur_cent / 100 : OBJETIVOS.precios_lista.eur.anual;
export const CAMBIO_A_EUR = {
  ...Object.fromEntries(Object.entries(PRECIOS_ZONAS?.tipo_cambio?.eur_a ?? {}).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => [k.toLowerCase(), 1 / v])),
  ...OBJETIVOS.cambio_a_eur.tipos,
};

export function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
}
export function sumarDias(f, n) {
  return new Date(Date.parse(`${f}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
}

// Día (AAAA-MM-DD) en hora de España de un instante.
const FMT_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
export function diaMadrid(instante) {
  const d = instante instanceof Date ? instante : new Date(typeof instante === "number" && instante < 1e11 ? instante * 1000 : instante);
  return Number.isNaN(d.getTime()) ? null : FMT_DIA.format(d);
}

// MRR objetivo de un escenario a una fecha: el valor del cierre de su
// quincena; entre el inicio y el cierre de Q1, interpolado desde 0 (no había
// suscriptores el 2026-10-11). Después de Q10, el de Q10.
export function mrrObjetivo(fecha, escenario = OBJETIVOS.objetivo, obj = OBJETIVOS) {
  const v = obj.escenarios[escenario].mrr;
  const q = obj.quincenas;
  if (fecha <= obj.inicio) return 0;
  for (let i = 0; i < q.length; i++) {
    if (fecha <= q[i].cierre) {
      const ini = i ? q[i - 1].cierre : obj.inicio, prev = i ? v[i - 1] : 0;
      return prev + ((v[i] - prev) * diasEntre(ini, fecha)) / diasEntre(ini, q[i].cierre);
    }
  }
  return v.at(-1);
}
export const ESCENARIOS = ["prudente", "base", "ambicioso"];

// ── Países (objetivos.json, "paises") ───────────────────────────────────
// La curva de cada país = escenario × (MRR de marzo del país / MRR de marzo
// del escenario objetivo). ES 550 + PT 100 + NZ 367 = 1.017 €.
export const PAISES = Object.keys(OBJETIVOS.paises).filter((k) => k !== "nota");
export function partePais(pais, obj = OBJETIVOS) {
  return obj.paises[pais].mrr_marzo / obj.escenarios[obj.objetivo].mrr.at(-1);
}
export function mrrObjetivoPais(fecha, pais, escenario = OBJETIVOS.objetivo) {
  return mrrObjetivo(fecha, escenario) * partePais(pais);
}
// Objetivos de un país en un periodo (con su ARPU y los mismos supuestos).
export function objetivosPais(p, pais, escenario, tasasActuales) {
  const ini = mrrObjetivoPais(sumarDias(p.desde, -1), pais, escenario);
  const fin = mrrObjetivoPais(p.hasta, pais, escenario);
  const neto = Math.max(0, fin - ini) / OBJETIVOS.paises[pais].arpu_eur;
  const pagos = Math.ceil(neto * (1 + tasasActuales.margen_bajas.valor));
  const altas = Math.ceil(pagos / tasasActuales.alta_pago.valor);
  return { mrr_eur: redondear(fin), nuevos_pagos: pagos, altas, visitas: Math.ceil(altas / tasasActuales.visita_alta.valor) };
}
// País de un punto: el de su región (assets/js/regiones.js).
export function paisDeCoordenadas(lat, lon, regionPorCoordenadas, REGIONES) {
  const r = regionPorCoordenadas(lat, lon);
  return String(REGIONES[r]?.pais ?? "ES").toLowerCase();
}
// País de cada usuario: Stripe (facturación o moneda) > el más frecuente de
// sus spots > ES. paisStripe: {user_id: "es"|"pt"|"nz"}; slugs: [{user_id, slug}].
export function paisesUsuarios(ids, { paisStripe = {}, slugs = [], paisPorSlug = {} } = {}) {
  const cuenta = new Map();
  for (const { user_id, slug } of slugs) {
    const p = paisPorSlug[slug] ?? (String(slug ?? "").startsWith("nz-") ? "nz" : null);
    if (!p) continue;
    if (!cuenta.has(user_id)) cuenta.set(user_id, {});
    const c = cuenta.get(user_id);
    c[p] = (c[p] ?? 0) + 1;
  }
  const out = {};
  for (const id of ids) {
    if (PAISES.includes(paisStripe[id])) { out[id] = paisStripe[id]; continue; }
    const c = cuenta.get(id);
    out[id] = c ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : "es";
    if (!PAISES.includes(out[id])) out[id] = "es";
  }
  return out;
}
// País de una suscripción de Stripe: moneda NZD → nz; si no, país de la
// dirección de facturación de sus facturas; si no, el del usuario.
export function paisSuscripcion(sub, paisFactura, paisUsuario) {
  if (String(sub?.currency ?? "").toLowerCase() === "nzd") return "nz";
  const f = String(paisFactura ?? "").toLowerCase();
  if (PAISES.includes(f)) return f;
  return PAISES.includes(paisUsuario) ? paisUsuario : "es";
}

// Aviso a Mikel (objetivos.json, reglas.avisar_bajo_base): el MRR real por
// debajo del suelo de alarma al cierre de dos quincenas seguidas.
export function alarmaBajoSuelo(cierres, obj = OBJETIVOS) {
  let bajo = 0, avisar = false, quincenas = [];
  for (const c of cierres) {
    const i = obj.quincenas.findIndex((q) => q.id === c.id);
    if (c.mrr != null && c.mrr < obj.escenarios[obj.suelo_alarma].mrr[i]) { bajo++; quincenas.push(c.id); } else { bajo = 0; quincenas = []; }
    avisar = bajo >= 2;
  }
  return { avisar, quincenas: avisar ? quincenas.slice(-2) : [] };
}

// Supuestos de planificación (objetivos.json). NO son datos: valen hasta que
// el real tenga min_n casos en el denominador; entonces manda el real.
export const SUPUESTOS = OBJETIVOS.supuestos_embudo;
export const MIN_N = SUPUESTOS.min_n;

// Activación v1 (2026-10-11): en sus 7 primeros días, el usuario abre la app
// al menos 2 días distintos y hace algo más que mirar el mapa o la pantalla
// de pago. Con 6 usuarios no se puede validar contra el pago; se revisa al
// llegar a 30 pruebas terminadas (CLAUDE.md).
export const EVENTOS_PASIVOS = new Set(["ver_mapa", "ver_suscripcion", "iniciar_checkout"]);
export function activado(eventos, altaISO) {
  const t0 = Date.parse(altaISO);
  const dentro = eventos.filter((e) => { const t = Date.parse(e.creado_en); return t >= t0 && t < t0 + 7 * DIA; });
  const dias = new Set(dentro.map((e) => diaMadrid(e.creado_en)));
  return dias.size >= 2 && dentro.some((e) => !EVENTOS_PASIVOS.has(e.tipo));
}
// Retención: activo en su semana 4 (días 21-27), igual que metricas_captacion().
export function activoSemana4(eventos, altaISO) {
  const t0 = Date.parse(altaISO);
  return eventos.some((e) => { const t = Date.parse(e.creado_en); return t >= t0 + 21 * DIA && t < t0 + 28 * DIA; });
}

// ── Canales ─────────────────────────────────────────────────────────────
// Fuente de origen_altas -> canal del árbol de KPIs. Socios va aparte: una
// campaña igual a un código de socio (utm_campaign=<código en minúsculas>).
export const CANALES = ["google", "instagram", "socios", "directo", "otros"];
export function canalDe(origen, codigosSocio = new Set()) {
  if (origen?.campana && codigosSocio.has(String(origen.campana).toUpperCase())) return "socios";
  const f = origen?.fuente;
  if (["google", "bing", "duckduckgo", "ecosia", "yahoo"].includes(f)) return "google";
  if (["instagram", "facebook"].includes(f)) return "instagram";
  if (!f || f === "directo" || f === "desconocido") return "directo";
  return "otros";
}

// ── MRR ─────────────────────────────────────────────────────────────────
// Mensual de una suscripción de Stripe (los anuales cuentan 1/12), con su
// descuento en % si sigue vigente. Solo active y past_due. Devuelve
// { moneda, importe (en su moneda), eur (null si no hay tipo de cambio) }.
export function mrrSuscripcionDetalle(sub, ahora = Date.now(), cambio = CAMBIO_A_EUR) {
  const moneda = String(sub?.currency ?? sub?.items?.data?.[0]?.price?.currency ?? "eur").toLowerCase();
  if (!["active", "past_due"].includes(sub?.status)) return { moneda, importe: 0, eur: 0 };
  let total = 0;
  for (const it of sub.items?.data ?? []) {
    const p = it.price ?? it.plan ?? {};
    const r = p.recurring ?? { interval: p.interval, interval_count: p.interval_count };
    const importe = ((p.unit_amount ?? p.amount ?? 0) / 100) * (it.quantity ?? 1);
    const n = r?.interval_count || 1;
    const meses = r?.interval === "year" ? 12 * n : r?.interval === "month" ? n : r?.interval === "week" ? n / 4.345 : r?.interval === "day" ? n / 30.44 : null;
    if (meses) total += importe / meses;
  }
  const importe = total * (1 - descuentoPct(sub, ahora) / 100);
  const factor = moneda === "eur" ? 1 : typeof cambio?.[moneda] === "number" ? cambio[moneda] : null;
  return { moneda, importe, eur: factor == null ? null : importe * factor };
}
export function mrrSuscripcion(sub, ahora = Date.now(), cambio = CAMBIO_A_EUR) {
  return mrrSuscripcionDetalle(sub, ahora, cambio).eur;
}
function descuentoPct(sub, ahora) {
  let pct = 0;
  const lista = [...(Array.isArray(sub.discounts) ? sub.discounts : []), ...(sub.discount ? [sub.discount] : [])];
  for (const d of lista) {
    if (!d || typeof d !== "object") continue;
    if (d.end && d.end * 1000 < ahora) continue;
    const c = d.coupon ?? d.source?.coupon;
    if (c && typeof c === "object" && c.percent_off) pct = Math.max(pct, c.percent_off);
  }
  return pct;
}
export function codigoPromoDe(sub, codigosPorId = {}) {
  const lista = [...(Array.isArray(sub.discounts) ? sub.discounts : []), ...(sub.discount ? [sub.discount] : [])];
  for (const d of lista) {
    const pc = d?.promotion_code;
    if (!pc) continue;
    const code = typeof pc === "object" ? pc.code : codigosPorId[pc];
    if (code) return String(code).toUpperCase();
  }
  return null;
}
// Sin clave de Stripe: MRR a precio de lista desde public.suscripciones.
export function mrrDesdeSupabase(filas) {
  let mensual = 0, anual = 0;
  for (const s of filas) {
    if (!["active", "past_due"].includes(s.estado)) continue;
    if (s.periodo === "anual") anual++; else mensual++;
  }
  return { mrr_eur: redondear(mensual * PRECIO_MENSUAL + (anual * PRECIO_ANUAL) / 12), suscriptores: { mensual, anual } };
}
export const redondear = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

// ── Periodos ────────────────────────────────────────────────────────────
// Quincenas de objetivos.json (Q1 = 11-oct a 26-oct...) y semanas de lunes a domingo.
export function quincenas(hasta, obj = OBJETIVOS) {
  const out = [];
  let desde = obj.inicio;
  for (const q of obj.quincenas) {
    if (desde > hasta) break;
    out.push({ id: q.id, desde, hasta: q.cierre });
    desde = sumarDias(q.cierre, 1);
  }
  return out;
}
export function lunesDe(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 domingo
  return sumarDias(fecha, -((d + 6) % 7));
}
export function semanas(desde, hasta) {
  const out = [];
  for (let a = lunesDe(desde); a <= hasta; a = sumarDias(a, 7)) out.push({ id: `S ${a}`, desde: a, hasta: sumarDias(a, 6) });
  return out;
}

// ── Agregar el histórico en un periodo ──────────────────────────────────
const FLUJOS = ["visitas", "altas", "altas_confirmadas", "nuevos_pagos", "cancelaciones", "facturado_eur", "checkout_iniciado"];
export function agregarPeriodo(lineas, p) {
  const dentro = lineas.filter((l) => l.fecha >= p.desde && l.fecha <= p.hasta);
  const r = { dias_con_datos: dentro.length };
  for (const k of FLUJOS) {
    const vals = dentro.map((l) => l[k]).filter((v) => typeof v === "number");
    r[k] = vals.length ? redondear(vals.reduce((a, b) => a + b, 0)) : null;
  }
  r.cohorte_altas = sumar(dentro, (l) => l.cohorte_activacion?.altas);
  r.cohorte_activadas = sumar(dentro, (l) => l.cohorte_activacion?.activadas);
  r.retencion_base = sumar(dentro, (l) => l.cohorte_retencion?.altas);
  r.retencion_activas = sumar(dentro, (l) => l.cohorte_retencion?.activas_s4);
  r.altas_canal = sumarMapas(dentro.map((l) => l.altas_canal));
  r.pagos_canal = sumarMapas(dentro.map((l) => l.pagos_canal));
  r.altas_socio = sumarMapas(dentro.map((l) => l.altas_socio));
  r.altas_pais = sumarMapas(dentro.map((l) => l.altas_pais));
  r.pagos_pais = sumarMapas(dentro.map((l) => l.pagos_pais));
  r.visitas_pais = sumarMapas(dentro.map((l) => (l.visitas_pais ? Object.fromEntries(Object.entries(l.visitas_pais).filter(([, v]) => typeof v === "number")) : null)));
  const ultimo = [...dentro].reverse().find((l) => l.stock);
  r.stock = ultimo?.stock ?? null;
  r.stock_fecha = ultimo?.fecha ?? null;
  return r;
}
function sumar(lineas, f) {
  const v = lineas.map(f).filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
function sumarMapas(mapas) {
  const out = {};
  for (const m of mapas) for (const [k, v] of Object.entries(m ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

// Último stock conocido hasta una fecha (para el MRR de inicio de periodo).
export function stockHasta(lineas, fecha) {
  return [...lineas].reverse().find((l) => l.fecha <= fecha && l.stock)?.stock ?? null;
}

// Tasas: reales con MIN_N casos o más; si no, el supuesto (y se dice).
export function tasas(lineas) {
  const t = agregarPeriodo(lineas, { desde: "0000-00-00", hasta: "9999-99-99" });
  const visDias = lineas.filter((l) => typeof l.visitas === "number");
  const altasConVisitas = visDias.reduce((a, l) => a + (l.altas ?? 0), 0);
  const visitas = visDias.reduce((a, l) => a + l.visitas, 0);
  const elegir = (num, den, sup) => (den >= MIN_N ? { valor: num / den, real: true, n: den } : { valor: sup, real: false, n: den });
  return {
    visita_alta: elegir(altasConVisitas, visitas, SUPUESTOS.visita_alta),
    alta_activacion: elegir(t.cohorte_activadas ?? 0, t.cohorte_altas ?? 0, SUPUESTOS.alta_activacion),
    alta_pago: elegir(t.nuevos_pagos ?? 0, t.altas_confirmadas ?? 0, SUPUESTOS.alta_pago),
    margen_bajas: { valor: SUPUESTOS.margen_bajas, real: false, n: 0 },
  };
}
export function arpu(stock) {
  const s = stock?.suscriptores;
  const n = s ? (s.mensual ?? 0) + (s.anual ?? 0) : 0;
  return n >= MIN_N && stock.mrr_eur ? { valor: stock.mrr_eur / n, real: true, n } : { valor: SUPUESTOS.arpu_eur, real: false, n };
}

// Objetivos de un periodo [desde, hasta] con el escenario vigente. Pagos
// nuevos = MRR a ganar / ARPU, +15 % para reponer bajas; altas y visitas,
// hacia atrás con las tasas.
export function objetivosPeriodo(p, escenario, tasasActuales, arpuActual) {
  const len = diasEntre(p.desde, p.hasta) + 1;
  const mrrIni = mrrObjetivo(sumarDias(p.desde, -1), escenario);
  const mrrFin = mrrObjetivo(p.hasta, escenario);
  const a = arpuActual.valor;
  const neto = Math.max(0, mrrFin - mrrIni) / a;
  const nuevos = Math.ceil(neto * (1 + tasasActuales.margen_bajas.valor));
  const altas = Math.ceil(nuevos / tasasActuales.alta_pago.valor);
  return {
    mrr_eur: redondear(mrrFin),
    suscriptores: Math.ceil(mrrFin / a),
    nuevos_pagos: nuevos,
    altas,
    activaciones: Math.ceil(altas * tasasActuales.alta_activacion.valor),
    visitas: Math.ceil(altas / tasasActuales.visita_alta.valor),
    cancelaciones_max: redondear(neto * tasasActuales.margen_bajas.valor, 1),
    facturado_eur: redondear(((mrrIni + mrrFin) / 2) * (len / 30)),
  };
}

// ── Estado y desviación ─────────────────────────────────────────────────
// Semáforo de Mikel: verde si llega al objetivo (ambicioso), ámbar si está
// entre el suelo (base) y el objetivo, rojo por debajo del suelo. Para lo que
// debe ser bajo (cancelaciones): verde hasta el máximo previsto, ámbar hasta
// un 30 % más (+0,5), rojo por encima.
export function estado(real, objetivo, suelo = null, menosEsMejor = false) {
  if (real == null || objetivo == null) return { estado: "sin_dato", ratio: null };
  if (menosEsMejor) {
    if (real <= objetivo) return { estado: "verde", ratio: 1 };
    return { estado: real <= objetivo * 1.3 + 0.5 ? "ambar" : "rojo", ratio: objetivo / real };
  }
  if (objetivo <= 0) return { estado: "verde", ratio: 1 };
  const ratio = real / objetivo;
  if (real >= objetivo) return { estado: "verde", ratio };
  return { estado: suelo != null && real >= suelo ? "ambar" : "rojo", ratio };
}
export const ICONO = { verde: "🟢 verde", ambar: "🟠 ámbar", rojo: "🔴 rojo", sin_dato: "⚪ sin dato" };
export function desviacion(real, objetivo) {
  if (real == null || objetivo == null) return "—";
  if (objetivo === 0) return real === 0 ? "= 0 %" : "▲ —";
  const d = ((real - objetivo) / objetivo) * 100;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)} %`;
}

// Filas de KPI de un periodo: [{clave, nombre, real, objetivo, suelo, estado, desv}].
// obj = objetivos con el escenario objetivo; suelo = con el de alarma. En un
// periodo en curso, los flujos se comparan con el objetivo prorrateado.
export const PASOS_EMBUDO = ["visitas", "altas", "activaciones", "nuevos_pagos", "retencion"];
export function filasKpi(agg, obj, { fraccion = 1, suelo = null } = {}) {
  const pr = (x) => (x == null ? null : redondear(x * fraccion, 1));
  const act = agg.cohorte_altas ? agg.cohorte_activadas : null;
  const ret = agg.retencion_base ? redondear((100 * agg.retencion_activas) / agg.retencion_base, 0) : null;
  const sl = suelo ?? {};
  const def = [
    ["mrr", "MRR (€/mes, anuales a 1/12)", agg.stock?.mrr_eur ?? null, obj.mrr_eur, sl.mrr_eur, false],
    ["suscriptores", "Suscriptores de pago", agg.stock ? (agg.stock.suscriptores?.mensual ?? 0) + (agg.stock.suscriptores?.anual ?? 0) : null, obj.suscriptores, sl.suscriptores, false],
    ["facturado", "Facturado (€ cobrados)", agg.facturado_eur, pr(obj.facturado_eur), pr(sl.facturado_eur), false],
    ["visitas", "Visitas a páginas públicas", agg.visitas, pr(obj.visitas), pr(sl.visitas), false],
    ["altas", "Altas (pruebas gratis)", agg.altas, pr(obj.altas), pr(sl.altas), false],
    ["activaciones", "Activaciones (cohortes que cumplen 7 días)", act, pr(obj.activaciones), pr(sl.activaciones), false],
    ["nuevos_pagos", "Pagos nuevos", agg.nuevos_pagos, pr(obj.nuevos_pagos), pr(sl.nuevos_pagos), false],
    ["cancelaciones", "Cancelaciones (máximo)", agg.cancelaciones, pr(obj.cancelaciones_max), null, true],
    ["retencion", "Retención semana 4 (%)", ret, ret == null ? null : SUPUESTOS.retencion_s4_pct, null, false],
  ];
  return def.map(([clave, nombre, real, objetivo, s, menos]) => ({ clave, nombre, real, objetivo, suelo: s ?? null, ...estado(real, objetivo, s ?? null, menos), desv: desviacion(real, objetivo) }));
}

// País en foco: el que va más por debajo de su objetivo de MRR (menor
// real/objetivo); empate (p. ej. todos a 0) → el de mayor hueco en euros.
export function paisMasBajo(filasPais) {
  const c = filasPais.filter((f) => f.objetivo > 0);
  if (!c.length) return null;
  return c.sort((a, b) => (a.real ?? 0) / a.objetivo - (b.real ?? 0) / b.objetivo || (b.objetivo - (b.real ?? 0)) - (a.objetivo - (a.real ?? 0)))[0].pais;
}

// El paso del embudo más en rojo: el de menor ratio entre los que tienen dato
// y objetivo > 0. Si ninguno tiene dato, el primero sin dato (hay que medirlo).
export function pasoMasRojo(filas) {
  const pasos = filas.filter((f) => PASOS_EMBUDO.includes(f.clave));
  const conDato = pasos.filter((f) => f.ratio != null && f.objetivo > 0);
  if (conDato.length) return conDato.sort((a, b) => a.ratio - b.ratio)[0];
  return pasos.find((f) => f.estado === "sin_dato") ?? null;
}

// ── Markdown ────────────────────────────────────────────────────────────
const n = (x, d = 0) => (x == null ? "—" : Number(x).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const eur = (x) => (x == null ? "—" : `${n(x, 2)} €`);
export function tablaKpi(filas) {
  const L = ["| KPI | Real | Objetivo (ambicioso) | Suelo (base) | Desviación | Estado |", "|---|---|---|---|---|---|"];
  for (const f of filas) {
    const fmt = (v) => (["mrr", "facturado"].includes(f.clave) ? eur(v) : n(v, Number.isInteger(v) || v == null ? 0 : 1));
    L.push(`| ${f.nombre} | ${fmt(f.real)} | ${fmt(f.objetivo)} | ${fmt(f.suelo)} | ${f.desv} | ${ICONO[f.estado]} |`);
  }
  return L.join("\n");
}

// ── SVG: MRR real contra los tres escenarios (escala logarítmica) ──────
const COLORES = { prudente: "#64748b", base: "#c2410c", ambicioso: "#7c3aed" };
export function svgMrr(puntosReales, obj = OBJETIVOS) {
  const W = 760, H = 380, m = { l: 64, r: 16, t: 20, b: 44 };
  const ini = obj.inicio, fin = obj.quincenas.at(-1).cierre;
  const total = diasEntre(ini, fin);
  const x = (f) => m.l + (diasEntre(ini, f) / total) * (W - m.l - m.r);
  const yMin = 1, yMax = obj.referencia.mrr * 1.3;
  const y = (v) => { const vv = Math.max(yMin, v); return H - m.b - (Math.log10(vv / yMin) / Math.log10(yMax / yMin)) * (H - m.t - m.b); };
  const curva = (e) => obj.quincenas.map((q, i) => `${x(q.cierre).toFixed(1)},${y(obj.escenarios[e].mrr[i]).toFixed(1)}`).join(" ");
  const reales = puntosReales.filter((p) => p.fecha >= ini && p.fecha <= fin && p.mrr != null);
  const lineaReal = reales.map((p) => `${x(p.fecha).toFixed(1)},${y(p.mrr).toFixed(1)}`).join(" ");
  const ticksY = [1, 10, 100, 1000, 4000].map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#d9dee5"/><text x="${m.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#4a5563">${n(v)} €</text>`).join("");
  const ticksX = obj.quincenas.map((q) => `<text x="${x(q.cierre).toFixed(1)}" y="${H - m.b + 16}" text-anchor="middle" font-size="10" fill="#4a5563">${q.id}</text>`).join("");
  const yRef = y(obj.referencia.mrr).toFixed(1);
  const ultimo = reales.at(-1);
  const leyenda = ESCENARIOS.map((e, i) => `<text x="${m.l + 8}" y="${m.t + 28 + i * 16}" font-size="12" fill="${COLORES[e]}">- - ${obj.escenarios[e].nombre}: ${eur(obj.escenarios[e].mrr.at(-1))} el ${fin}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" role="img" aria-label="MRR real contra los escenarios objetivo">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${ticksY}${ticksX}
<line x1="${m.l}" x2="${W - m.r}" y1="${yRef}" y2="${yRef}" stroke="#991b1b" stroke-width="1.5" stroke-dasharray="10 6"/>
<text x="${W - m.r - 4}" y="${(Number(yRef) - 6).toFixed(1)}" text-anchor="end" font-size="11" fill="#991b1b">Referencia ${eur(obj.referencia.mrr)}: exigiría publicidad de pago</text>
${ESCENARIOS.map((e) => `<polyline fill="none" stroke="${COLORES[e]}" stroke-width="${e === OBJETIVOS.objetivo ? 2.5 : 1.5}" stroke-dasharray="6 4" points="${x(ini).toFixed(1)},${y(0).toFixed(1)} ${curva(e)}"/>`).join("\n")}
${lineaReal ? `<polyline fill="none" stroke="#0f766e" stroke-width="3" points="${lineaReal}"/>` : ""}
${ultimo ? `<circle cx="${x(ultimo.fecha).toFixed(1)}" cy="${y(ultimo.mrr).toFixed(1)}" r="4" fill="#0f766e"/>` : ""}
<text x="${m.l + 8}" y="${m.t + 12}" font-size="12" fill="#0f766e">— MRR real${ultimo ? ` (${eur(ultimo.mrr)} el ${ultimo.fecha})` : " (sin datos aún)"}</text>
${leyenda}
<text x="${W - m.r}" y="${H - 8}" text-anchor="end" font-size="10" fill="#4a5563">Escala logarítmica (por debajo de 1 € se dibuja en 1 €). Generado sin IA por scripts/kpis/informe.mjs</text>
</svg>
`;
}
