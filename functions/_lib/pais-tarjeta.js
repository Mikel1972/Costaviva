// functions/_lib/pais-tarjeta.js
// País de la tarjeta y zona de precio (2026-11-25, Mikel: «móntalo ya»;
// ampliado el mismo día: «si vemos una actividad relacionada con NZ, le
// avisaremos aunque sea después»). Lógica pura, sin red: la usan
// functions/_lib/corregir-zona.js (Stripe y Supabase), stripe-webhook.js,
// dispositivos.js, scripts/precios/informe-zonas-tarjeta.mjs y
// test/pais-tarjeta.test.js. Detalle en CLAUDE.md, "Zona de precio por el
// país de la tarjeta".
//
// La zona se cobra por el país de la conexión al pagar (crear-checkout-stripe.js).
// Con una VPN se puede pagar la zona más barata. Por eso:
//   1. En cada pago con TARJETA se guarda el país emisor de la tarjeta
//      (suscripciones.pais_tarjeta) y su zona (zona_tarjeta).
//   2. Si la zona de la tarjeta no es la cobrada, el pago de hoy se queda
//      como está y, desde la siguiente renovación, el mismo plan pasa al
//      precio de la zona de la tarjeta (proration_behavior=none), con un
//      email antes. Una vez por suscripción.
//   3. Lo mismo si la persona usa la app de forma continuada desde otra zona
//      (UMBRAL: DIAS_OTRA_ZONA días distintos en VENTANA_USO_DIAS y ninguno
//      desde la zona pagada). Solo se guarda el país de 2 letras por día,
//      nunca la IP.
//   4. Stripe no deja cambiar la moneda de una suscripción ya creada (la
//      API de actualizar una suscripción no tiene parámetro `currency`; solo
//      la de crearla). Si la zona nueva cobra en otra moneda (EUR <-> NZD),
//      NO se intenta: la suscripción no se renueva al acabar lo pagado
//      (cancel_at_period_end) y se le avisa para volver a suscribirse al precio
//      de su país ("no_renovar_moneda", sí de Mikel 2026-11-25); antes: 
//      sale en el informe diario.
//   5. Bizum (pago único, nunca con tarjeta), filas sin suscripción de
//      Stripe (admin, permanente, invitación) y pagos sin país: nada.

import { zonaDePais, zonaPorId, precioParaZona } from "./precios.js";

// Umbral de "uso continuado desde otra zona" (no castigar un viaje).
export const VENTANA_USO_DIAS = 14;
export const DIAS_OTRA_ZONA = 3;
// Países distintos que se guardan como mucho por día (cota de tamaño).
const MAX_PAISES_DIA = 4;

export const PAIS = /^[A-Z]{2}$/;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function paisValido(p) {
  const s = String(p || "").toUpperCase();
  // XX/T1 son los "desconocido"/Tor de Cloudflare: no cuentan.
  return PAIS.test(s) && s !== "XX" && s !== "T1" ? s : null;
}

// País emisor de la tarjeta a partir de lo que trae Stripe. Acepta un
// PaymentMethod (card.country), un Charge (payment_method_details.card) o una
// Subscription con default_payment_method expandido (o el del cliente en
// customer.invoice_settings.default_payment_method). null si no es tarjeta o
// no hay país.
export function paisDeTarjeta(obj) {
  if (!obj || typeof obj !== "object") return null;
  const candidatos = [
    obj.type === "card" ? obj.card : null,
    obj.payment_method_details?.type === "card" ? obj.payment_method_details.card : null,
    typeof obj.default_payment_method === "object" && obj.default_payment_method?.type === "card" ? obj.default_payment_method.card : null,
    typeof obj.customer === "object" && obj.customer?.invoice_settings?.default_payment_method?.type === "card"
      ? obj.customer.invoice_settings.default_payment_method.card : null,
  ];
  for (const c of candidatos) {
    const p = paisValido(c?.country);
    if (p) return p;
  }
  return null;
}

// Id de la zona de un país (las inactivas y los países sin zona, "resto").
export function zonaDePaisId(config, pais) {
  const p = paisValido(pais);
  return p ? zonaDePais(config, p)?.id || null : null;
}

// Plan de precios (precios-zonas.json) de lo que tiene contratado:
// { periodo, fundador } -> "mensual" | "anual" | "fundador_anual".
export function planDePrecio({ periodo, fundador }) {
  if (periodo === "mensual") return "mensual";
  if (periodo === "anual") return fundador ? "fundador_anual" : "anual";
  return null;
}

// ¿Esta suscripción ya tuvo su corrección de zona? (una vez por suscripción)
export function yaCorregida(fila, subId) {
  return !!(fila?.zona_correccion && subId && fila.zona_correccion_sub === subId);
}

// Decide qué hacer con una zona "real" (de la tarjeta o del uso) frente a la
// cobrada. Entrada:
//   config, fila (suscripciones), subId, zonaCobrada (id), zonaReal (id),
//   ambito, plan (planDePrecio), moneda (de la suscripción, "EUR"/"NZD"...),
//   programado (true si la suscripción tiene un subscription schedule: una
//   bajada pendiente que no se pisa), renueva (false si está cancelada o se
//   cancela al final del periodo: no hay "próxima renovación"), lookupActual
//   (lookup_key del precio que tiene hoy en Stripe, si se sabe).
// Devuelve { accion, motivo?, precio?, zona }:
//   "nada"     -> no hay nada que hacer (misma zona, mismo precio, Bizum...).
//   "cambiar"  -> pasar al precio `precio` desde la próxima factura + email.
//   "revisar"  -> no se toca Stripe; se marca para revisarlo a mano (motivo
//                 "moneda" o "programado").
export function decidirCorreccion({ config, fila, subId, zonaCobrada, zonaReal, ambito, plan, moneda, programado = false, renueva = true, lookupActual = null }) {
  const nada = (motivo) => ({ accion: "nada", motivo, zona: zonaReal || null });
  if (fila?.metodo_pago === "bizum") return nada("bizum");
  if (!subId) return nada("sin_suscripcion");
  if (!renueva) return nada("no_renueva");
  if (!zonaReal || !zonaPorId(config, zonaReal)) return nada("sin_zona");
  if (!zonaCobrada || !zonaPorId(config, zonaCobrada)) return nada("sin_zona_cobrada");
  if (zonaReal === zonaCobrada) return nada("misma_zona");
  if (yaCorregida(fila, subId)) return nada("ya_corregida");
  if (!plan || !["regional", "mundial"].includes(ambito)) return nada("plan_desconocido");
  let destino, actual;
  try {
    destino = precioParaZona(config, zonaReal, ambito, plan);
    actual = precioParaZona(config, zonaCobrada, ambito, plan);
  } catch {
    return nada("sin_precio");
  }
  const monedaSub = String(moneda || actual.moneda).toUpperCase();
  // Misma tarifa (p. ej. UE/EEE y "resto", las dos a 1,0 en EUR): nada que cambiar.
  // Mismo precio de Stripe en la misma moneda = mismo importe: nada que cambiar.
  if (destino.moneda === monedaSub && destino.lookup_key === (lookupActual || actual.lookup_key)) return nada("mismo_precio");
  // Otra moneda (2026-11-25, sí de Mikel): Stripe no deja cambiarla, así que
  // la suscripción no se renueva sola al acabar lo pagado y se le avisa para
  // que vuelva a suscribirse al precio de su país.
  if (destino.moneda !== monedaSub) return { accion: "no_renovar", motivo: "moneda", zona: zonaReal, precio: destino };
  if (programado) return { accion: "revisar", motivo: "programado", zona: zonaReal, precio: destino };
  return { accion: "cambiar", zona: zonaReal, precio: destino };
}

// Valor de suscripciones.zona_correccion para cada resultado.
export function estadoCorreccion(d) {
  if (d.accion === "cambiar") return "cambiada";
  if (d.accion === "no_renovar") return "no_renovar_moneda";
  if (d.accion === "revisar") return d.motivo === "moneda" ? "revisar_moneda" : "revisar_programado";
  return null;
}

// Parámetros de Stripe (POST /v1/subscriptions/{id}) para el cambio: el mismo
// plan con el precio de la zona nueva, sin prorrateo (se aplica en la
// siguiente factura; el periodo pagado no se toca) y la zona nueva en los
// metadatos (el webhook la copia a suscripciones.zona_precio).
export function paramsCambioZona({ itemId, priceId, zona, lookupKey, origen, regionContenido }) {
  const p = {
    "items[0][id]": itemId,
    "items[0][price]": priceId,
    proration_behavior: "none",
    "metadata[zona]": zona,
    "metadata[lookup_key]": lookupKey,
    "metadata[zona_corregida_por]": origen,
  };
  if (regionContenido) p["metadata[region_contenido]"] = regionContenido;
  return p;
}

// Parámetros de Stripe para no renovar (otra moneda): termina al acabar lo
// pagado; lo ya pagado no se toca.
export function paramsNoRenovar({ zona, origen }) {
  return {
    cancel_at_period_end: "true",
    "metadata[zona_no_renovar]": zona,
    "metadata[zona_corregida_por]": origen,
  };
}

// --- Uso desde otra zona -----------------------------------------------------

export function diaUTC(ahora = Date.now()) {
  return new Date(ahora).toISOString().slice(0, 10);
}

// paises_uso = { "AAAA-MM-DD": ["NZ", ...] }. Apunta el país de hoy y quita
// los días fuera de la ventana. Devuelve el objeto nuevo, o null si no cambia
// nada (así no se escribe en cada apertura de la app).
export function apuntarPaisUso(paisesUso, pais, ahora = Date.now()) {
  const p = paisValido(pais);
  const previo = paisesUso && typeof paisesUso === "object" && !Array.isArray(paisesUso) ? paisesUso : {};
  const desde = diaUTC(ahora - (VENTANA_USO_DIAS - 1) * 86400000);
  const nuevo = {};
  for (const [dia, lista] of Object.entries(previo)) {
    if (!DIA_ISO.test(dia) || dia < desde || !Array.isArray(lista)) continue;
    const limpios = [...new Set(lista.map(paisValido).filter(Boolean))].slice(0, MAX_PAISES_DIA);
    if (limpios.length) nuevo[dia] = limpios;
  }
  if (p) {
    const hoy = diaUTC(ahora);
    const lista = nuevo[hoy] || [];
    if (!lista.includes(p) && lista.length < MAX_PAISES_DIA) nuevo[hoy] = [...lista, p];
  }
  const ordenar = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  return ordenar(nuevo) === ordenar(previo) ? null : nuevo;
}

// Zona desde la que usa la app de forma continuada, distinta de la pagada:
// al menos DIAS_OTRA_ZONA días distintos en la ventana desde esa zona y
// NINGUNO desde la zona pagada. Devuelve { zona, pais, dias } (pais = el país
// de esa zona visto más días) o null si no se cumple.
export function zonaPorUso(config, paisesUso, zonaCobrada, ahora = Date.now()) {
  if (!paisesUso || typeof paisesUso !== "object" || !zonaCobrada) return null;
  const desde = diaUTC(ahora - (VENTANA_USO_DIAS - 1) * 86400000);
  const porZona = new Map(); // zona -> { dias: Set, paises: Map(pais -> días) }
  for (const [dia, lista] of Object.entries(paisesUso)) {
    if (!DIA_ISO.test(dia) || dia < desde || !Array.isArray(lista)) continue;
    for (const pais of lista) {
      const p = paisValido(pais);
      if (!p) continue;
      const z = zonaDePais(config, p)?.id;
      if (!z) continue;
      if (!porZona.has(z)) porZona.set(z, { dias: new Set(), paises: new Map() });
      const e = porZona.get(z);
      e.dias.add(dia);
      e.paises.set(p, (e.paises.get(p) || 0) + 1);
    }
  }
  if (porZona.has(zonaCobrada)) return null;
  let mejor = null;
  for (const [zona, e] of porZona) {
    if (e.dias.size < DIAS_OTRA_ZONA || (mejor && e.dias.size <= mejor.dias)) continue;
    const pais = [...e.paises.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    mejor = { zona, pais, dias: e.dias.size };
  }
  return mejor;
}

// --- Email -------------------------------------------------------------------

const TXT = {
  es: {
    asunto: "Tu precio de Costaviva Premium desde la próxima renovación",
    cuerpo: (o) => [
      "Hola,",
      "",
      o.origen === "uso"
        ? `Hemos visto que estos días usas Costaviva desde ${o.pais}. Para que pagues lo mismo que el resto de personas de allí, tu plan pasa al precio de esa zona.`
        : `Gracias por tu pago. Tu tarjeta es de ${o.pais}, así que tu plan pasa al precio de ese país, el mismo que paga allí todo el mundo.`,
      "",
      `Desde tu próxima renovación${o.fecha ? `, el ${o.fecha}` : ""}, ${o.plan} costará ${o.importe}${o.impuesto}.`,
      "Lo que ya has pagado no cambia y no tienes que hacer nada: todo sigue igual.",
      "",
      "Si crees que no es correcto, responde a este email y lo revisamos. También puedes cancelar cuando quieras en Mi suscripción: https://costaviva.org/suscripcion",
      "",
      "— Costaviva",
    ],
    mensual: "tu plan mensual", anual: "tu plan anual", impuesto: " (IVA incluido)",
    asuntoNoRenovar: "Tu Costaviva Premium al precio de tu país",
    noRenovar: (o) => [
      "Hola,",
      "",
      o.origen === "uso"
        ? `Hemos visto que estos días usas Costaviva desde ${o.pais}, donde Premium tiene su propio precio y su moneda.`
        : `Gracias por tu pago. Tu tarjeta es de ${o.pais}, donde Premium tiene su propio precio y su moneda.`,
      "",
      `Disfruta de todo lo que ya has pagado${o.fecha ? ` hasta el ${o.fecha}` : ""}. Ese día tu suscripción terminará sin renovarse sola, así que no habrá ningún cargo más.`,
      `Para seguir con Premium, suscríbete de nuevo desde Mi suscripción: ${o.plan} costará ${o.importe}${o.impuesto}. https://costaviva.org/suscripcion`,
      "",
      "Si crees que no es correcto, responde a este email y lo revisamos.",
      "",
      "— Costaviva",
    ],
  },
  en: {
    asunto: "Your Costaviva Premium price from your next renewal",
    cuerpo: (o) => [
      "Hi,",
      "",
      o.origen === "uso"
        ? `We've seen that you've been using Costaviva from ${o.pais} lately. So that you pay the same as everyone else there, your plan moves to that area's price.`
        : `Thanks for your payment. Your card is from ${o.pais}, so your plan moves to that country's price, the same one everybody pays there.`,
      "",
      `From your next renewal${o.fecha ? ` on ${o.fecha}` : ""}, ${o.plan} will cost ${o.importe}${o.impuesto}.`,
      "What you've already paid doesn't change and you don't need to do anything: everything else stays the same.",
      "",
      "If you think this isn't right, just reply to this email and we'll look into it. You can also cancel at any time from My subscription: https://costaviva.org/suscripcion",
      "",
      "— Costaviva",
    ],
    mensual: "your monthly plan", anual: "your annual plan", impuesto: " (tax included)",
    asuntoNoRenovar: "Your Costaviva Premium at your country's price",
    noRenovar: (o) => [
      "Hi,",
      "",
      o.origen === "uso"
        ? `We've seen that you've been using Costaviva from ${o.pais} lately, where Premium has its own price and currency.`
        : `Thanks for your payment. Your card is from ${o.pais}, where Premium has its own price and currency.`,
      "",
      `Enjoy everything you've already paid for${o.fecha ? ` until ${o.fecha}` : ""}. On that day your subscription will end without renewing, so there will be no further charge.`,
      `To keep Premium, subscribe again from My subscription: ${o.plan} will cost ${o.importe}${o.impuesto}. https://costaviva.org/suscripcion`,
      "",
      "If you think this isn't right, just reply to this email and we'll look into it.",
      "",
      "— Costaviva",
    ],
  },
  pt: {
    asunto: "O teu preço do Costaviva Premium a partir da próxima renovação",
    cuerpo: (o) => [
      "Olá,",
      "",
      o.origen === "uso"
        ? `Vimos que nestes dias usas o Costaviva a partir de ${o.pais}. Para pagares o mesmo que as outras pessoas daí, o teu plano passa para o preço dessa zona.`
        : `Obrigado pelo teu pagamento. O teu cartão é de ${o.pais}, por isso o teu plano passa para o preço desse país, o mesmo que todos pagam lá.`,
      "",
      `A partir da tua próxima renovação${o.fecha ? `, a ${o.fecha}` : ""}, ${o.plan} vai custar ${o.importe}${o.impuesto}.`,
      "O que já pagaste não muda e não tens de fazer nada: tudo o resto continua igual.",
      "",
      "Se achas que não está certo, responde a este email e vemos o caso. Também podes cancelar quando quiseres em A minha subscrição: https://costaviva.org/suscripcion",
      "",
      "— Costaviva",
    ],
    mensual: "o teu plano mensal", anual: "o teu plano anual", impuesto: " (IVA incluído)",
    asuntoNoRenovar: "O teu Costaviva Premium ao preço do teu país",
    noRenovar: (o) => [
      "Olá,",
      "",
      o.origen === "uso"
        ? `Vimos que nestes dias usas o Costaviva a partir de ${o.pais}, onde o Premium tem o seu próprio preço e moeda.`
        : `Obrigado pelo teu pagamento. O teu cartão é de ${o.pais}, onde o Premium tem o seu próprio preço e moeda.`,
      "",
      `Aproveita tudo o que já pagaste${o.fecha ? ` até ${o.fecha}` : ""}. Nesse dia a tua subscrição termina sem se renovar, por isso não haverá mais nenhum débito.`,
      `Para continuares com o Premium, subscreve de novo em A minha subscrição: ${o.plan} vai custar ${o.importe}${o.impuesto}. https://costaviva.org/suscripcion`,
      "",
      "Se achas que não está certo, responde a este email e vemos o caso.",
      "",
      "— Costaviva",
    ],
  },
};
const LOCALE = { es: "es-ES", en: "en-NZ", pt: "pt-PT" };

export function idiomaEmail(...candidatos) {
  for (const c of candidatos) if (TXT[c]) return c;
  return "es";
}

// { subject, text }. pais = código ISO del país (se escribe con su nombre),
// precio = { importe (céntimos), moneda }, finPeriodo = unix (segundos) de la
// próxima renovación, periodo = "mensual" | "anual", origen = "tarjeta" | "uso".
export function emailCambioZona({ idioma, pais, precio, finPeriodo, periodo, origen, noRenovar = false }) {
  const id = idiomaEmail(idioma);
  const T = TXT[id];
  const loc = LOCALE[id];
  let nombrePais = pais;
  try { nombrePais = new Intl.DisplayNames([loc], { type: "region" }).of(pais) || pais; } catch { /* sin Intl */ }
  // Con el código de la moneda (NZD 97.99, 34,99 EUR): sin ambigüedad con "$".
  const importe = new Intl.NumberFormat(loc, { style: "currency", currency: precio.moneda, currencyDisplay: "code" }).format(precio.importe / 100);
  const fecha = finPeriodo
    ? new Date(finPeriodo * 1000).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }) // a propósito (ZONA_NEGOCIO)
    : null;
  // «IVA incluido» solo en euros: con NZD no se cobra GST mientras no se pase
  // del umbral de registro de NZ (60.000 NZD/año, IRD), así que no se dice.
  const impuesto = precio.moneda === "EUR" ? T.impuesto : "";
  const datos = { origen, pais: nombrePais, fecha, importe, impuesto, plan: periodo === "mensual" ? T.mensual : T.anual };
  return noRenovar
    ? { subject: T.asuntoNoRenovar, text: T.noRenovar(datos).join("\n") }
    : { subject: T.asunto, text: T.cuerpo(datos).join("\n") };
}

// --- Informe diario (solo recuentos y zonas, sin datos personales) -----------

// filas: [{ zona_precio, zona_tarjeta, zona_correccion, zona_correccion_origen, zona_corregir_a }]
export function lineasInforme(filas = []) {
  const distintas = new Map();
  const correcciones = new Map();
  for (const f of filas) {
    if (f.zona_tarjeta && f.zona_precio && f.zona_tarjeta !== f.zona_precio) {
      const k = `${f.zona_precio} → ${f.zona_tarjeta}`;
      distintas.set(k, (distintas.get(k) || 0) + 1);
    }
    if (f.zona_correccion) {
      const k = `${f.zona_correccion} (${f.zona_correccion_origen || "?"}) → ${f.zona_corregir_a || "?"}`;
      correcciones.set(k, (correcciones.get(k) || 0) + 1);
    }
  }
  if (!distintas.size && !correcciones.size) return ["  - Ninguna: todas las tarjetas y el uso coinciden con la zona cobrada."];
  const lin = [];
  const orden = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (distintas.size) lin.push(`  - Tarjeta de otra zona hoy (cobrada → tarjeta): ${orden(distintas).map(([k, n]) => `${k}: ${n}`).join(" · ")}`);
  if (correcciones.size) lin.push(`  - Correcciones (estado (origen) → zona): ${orden(correcciones).map(([k, n]) => `${k}: ${n}`).join(" · ")}`);
  const revisar = filas.filter((f) => String(f.zona_correccion || "").startsWith("revisar")).length;
  if (revisar) lin.push(`  - ⚠️ ${revisar} para revisar a mano (cambio de plan programado, o otra moneda sin email configurado).`);
  const noRenovar = filas.filter((f) => f.zona_correccion === "no_renovar_moneda").length;
  if (noRenovar) lin.push(`  - ${noRenovar} con otra moneda: no se renuevan al acabar lo pagado y se les ha avisado para volver a suscribirse al precio de su país.`);
  return lin;
}
