// functions/_lib/cambio-plan.js
// Cambios de plan de una suscripción (decisión de Mikel, 2026-10-11). Lógica
// pura, sin red: la usan functions/cambiar-plan.js, el script de prueba en
// modo test (scripts/stripe/probar-cambio-plan.mjs) y test/cambio-plan.test.js.
//
//   - SUBIDA (mensual -> anual, regional -> Mundial, o las dos): empieza YA.
//     billing_cycle_anchor=now, se abona lo no disfrutado del plan anterior y
//     se cobra la diferencia al momento (proration_behavior=always_invoice);
//     si el cobro no se puede hacer, el cambio falla
//     (payment_behavior=error_if_incomplete) y no se queda a medias.
//   - BAJADA (anual -> mensual, Mundial -> regional) o cambio MIXTO (sube una
//     cosa y baja otra): al final del periodo pagado, sin abono (coherente con
//     "el periodo pagado no se reembolsa"). Se hace con un subscription
//     schedule: fase 1 = precio actual hasta el fin del periodo; fase 2 =
//     precio nuevo, sin prorrateo.
//   - FUNDADOR: quien tiene precio de fundador y pasa a un anual (por ejemplo,
//     regional -> Mundial) conserva el precio de fundador del plan nuevo; su
//     plaza ya está contada.
//
// El portal de Stripe no permite el ancla "now" en cambios del mismo
// intervalo, así que el cambio de plan se hace aquí y el portal queda para la
// tarjeta, las facturas y la cancelación.

const RANGO_PERIODO = { mensual: 0, anual: 1 };
const RANGO_AMBITO = { regional: 0, mundial: 1 };

// Plan de precios -> periodo.
export function periodoDePlan(plan) {
  return plan === "mensual" ? "mensual" : "anual";
}

// { tipo: "subida" | "bajada" | "igual", ... }
export function clasificarCambio(actual, destino) {
  const dP = RANGO_PERIODO[periodoDePlan(destino.plan)] - RANGO_PERIODO[actual.periodo];
  const dA = RANGO_AMBITO[destino.ambito] - RANGO_AMBITO[actual.ambito || "regional"];
  if (dP === 0 && dA === 0) return { tipo: "igual" };
  if (dP >= 0 && dA >= 0) return { tipo: "subida" };
  // Bajada pura o mixta (sube una cosa y baja otra): al final del periodo.
  return { tipo: "bajada", mixto: dP > 0 || dA > 0 };
}

// Plan de precios real del destino: quien es fundador y va a un anual
// conserva el precio de fundador.
export function planDestino(actual, destino) {
  if (actual.fundador && periodoDePlan(destino.plan) === "anual") return "fundador_anual";
  return destino.plan;
}

// Parámetros (objeto plano clave -> valor, formato de formulario de Stripe).
export function paramsPreviewSubida({ customer, subscription, itemId, priceId, ahora }) {
  return {
    customer,
    subscription,
    "subscription_details[items][0][id]": itemId,
    "subscription_details[items][0][price]": priceId,
    "subscription_details[proration_behavior]": "always_invoice",
    "subscription_details[billing_cycle_anchor]": "now",
    "subscription_details[proration_date]": String(Math.floor((ahora ?? Date.now()) / 1000)),
  };
}

export function paramsSubida({ itemId, priceId, metadata = {}, ahora }) {
  const p = {
    "items[0][id]": itemId,
    "items[0][price]": priceId,
    proration_behavior: "always_invoice",
    billing_cycle_anchor: "now",
    payment_behavior: "error_if_incomplete",
    proration_date: String(Math.floor((ahora ?? Date.now()) / 1000)),
    cancel_at_period_end: "false",
  };
  for (const [k, v] of Object.entries(metadata)) p[`metadata[${k}]`] = String(v);
  return p;
}

// Bajada: fase 1 igual que ahora hasta el fin del periodo; fase 2 con el
// precio nuevo y sin prorrateo. end_behavior=release: al empezar la fase 2 la
// suscripción sigue sola.
export function paramsBajada({ precioActual, priceId, inicioFase, finPeriodo, moneda, metadata = {} }) {
  const p = {
    end_behavior: "release",
    "phases[0][items][0][price]": precioActual,
    "phases[0][start_date]": String(inicioFase),
    "phases[0][end_date]": String(finPeriodo),
    "phases[0][proration_behavior]": "none",
    "phases[1][items][0][price]": priceId,
    "phases[1][proration_behavior]": "none",
  };
  if (moneda) {
    p["phases[0][currency]"] = moneda;
    p["phases[1][currency]"] = moneda;
  }
  for (const [k, v] of Object.entries(metadata)) p[`phases[1][metadata][${k}]`] = String(v);
  return p;
}

// Del preview de la factura: lo que se paga hoy y lo que se descuenta por el
// tiempo no disfrutado (líneas de prorrateo negativas).
export function resumenPreview(factura) {
  const lineas = factura?.lines?.data || [];
  const descontado = lineas.reduce((s, l) => s + (l.amount < 0 ? -l.amount : 0), 0);
  return {
    pagar_hoy: Math.max(0, factura?.amount_due ?? factura?.total ?? 0),
    descontado,
    moneda: String(factura?.currency || "eur").toUpperCase(),
  };
}

// Cambio programado (bajada pendiente) de un subscription schedule: la
// primera fase que empieza después de ahora. null si no hay.
//   { fecha: ISO, plan, ambito, schedule }
export function cambioProgramado(schedule, ahora = Date.now()) {
  if (!schedule || typeof schedule !== "object" || !["active", "not_started"].includes(schedule.status)) return null;
  const t = Math.floor(ahora / 1000);
  const fase = (schedule.phases || []).find((f) => f.start_date > t);
  if (!fase) return null;
  return {
    fecha: new Date(fase.start_date * 1000).toISOString(),
    plan: fase.metadata?.plan || null,
    ambito: fase.metadata?.ambito || null,
    schedule: schedule.id,
  };
}
