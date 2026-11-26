// functions/crear-checkout-stripe.js
// Crea una Stripe Checkout Session (modo suscripción) para el usuario que
// llama. Alcanzable en /crear-checkout-stripe.
//
// Precios por zonas y ámbitos (2026-10-11, ver CLAUDE.md "Cobro"): el
// cliente solo manda { ambito: "regional"|"mundial", plan: "mensual"|"anual"|
// "fundador_anual", pais_residencia: "ES" } y aquí se decide el precio, nunca
// el price id crudo. Desde el 2026-11-25 (CLAUDE.md "País de residencia
// obligatorio antes de pagar") la zona sale del PAÍS DE RESIDENCIA que
// declara la persona (ISO-2, obligatorio: 400 "falta_pais_residencia"), no
// del país de la conexión (request.cf.country), que se sigue guardando como
// pais_ip. Los dos y la zona van en los metadatos del checkout. El checkout
// pide además la dirección de facturación y el webhook avisa en el log si su
// zona no coincide. Por compatibilidad se aceptan aún "monthly"/"annual"
// (= regional).
//
// Sin trial de Stripe (decisión de Mikel, 2026-10-11, tras ver una factura
// de 0,00 €): suscribirse termina la prueba gratis de la app y se cobra en
// ese momento; el periodo (mes o año) empieza el día del pago. Los meses
// ganados con "Invita a un amigo" se abonan como saldo en Stripe al
// completar el pago (stripe-webhook.js) y se descuentan de los cobros
// siguientes.
//
// Variables de entorno en Cloudflare Pages (Secret): STRIPE_SECRET_KEY.
// COBRO_ACTIVO = "true" para abrir los pagos (por defecto cerrados: 403
// codigo "cobro_no_activo", ver CLAUDE.md "Cobro").
// Opcionales (texto "1"): STRIPE_TAX_AUTOMATICO (automatic_tax, cuando Stripe
// Tax tenga los registros hechos) y STRIPE_TOS_EN_CHECKOUT (casilla de
// términos de Stripe; exige la URL de términos en el Dashboard).
//
// Bizum (2026-11-25, ver CLAUDE.md "Pagar 1 año con Bizum"): con
// { metodo: "bizum", ambito, plan: "anual" } se crea un pago ÚNICO (Stripe no
// admite Bizum en suscripciones) por el importe del anual de la zona UE/EEE,
// que el webhook convierte en 12 meses de Premium. Interruptor BIZUM_ACTIVO
// ("true"; por defecto apagado: 403 "bizum_no_activo" sin tocar Stripe).
// Solo para residentes en España (403 "bizum_solo_residentes_espana").

import { motivoCodigoBf, MARCA_BF } from "./_lib/black-friday.js";
import { descuentoAplicaAPlan } from "./_lib/invitaciones.js";
import { zonaDePais, precioParaZona, leerPlan, cobroActivo } from "./_lib/precios.js";
import { VERSION as VERSION_ACEPTACION, IDIOMAS as IDIOMAS_ACEPTACION, textoAceptacion, textoSiCerramos } from "../assets/js/consentimiento.js";
import { bizumActivo, precioBizum, tieneSuscripcionTarjeta } from "./_lib/bizum.js";
import { leerPaisResidencia, motivoBizumResidencia } from "./_lib/pais-residencia.js";
import CONFIG_PRECIOS from "./_lib/precios-zonas.json";
import STRIPE_IDS from "./_lib/stripe-ids.json";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

// Cláusula aceptada (decisión de Mikel, 2026-10-11): renuncia al
// desistimiento por contenido digital con ejecución inmediata (art. 103.m
// TRLGDCU) y no reembolso del periodo pagado. El texto y su versión viven en
// assets/js/consentimiento.js; aquí se exige que la casilla se haya marcado,
// se guarda la aceptación (eventos_uso + metadatos de Stripe) y se repite el
// texto en el propio checkout.
const ENLACE_TERMINOS = "https://costaviva.org/terminos";

// Guarda la aceptación con el token del propio usuario (RLS: solo inserta
// sus eventos). Sin SQL nuevo. Si falla, queda en el log y en Stripe.
async function guardarAceptacion(token, userId, detalle) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/eventos_uso`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, tipo: "acepta_condiciones_pago", detalle }),
    });
    if (!r.ok) console.error(`crear-checkout-stripe: no se pudo guardar la aceptación: HTTP ${r.status}`);
  } catch (e) {
    console.error("crear-checkout-stripe: no se pudo guardar la aceptación:", e);
  }
}

function modoDeClave(clave) {
  return /^(sk|rk)_live_/.test(clave) ? "live" : "test";
}

// Id del precio: el guardado por el workflow de precios o, si aún no está, el
// que Stripe tenga con ese lookup_key.
async function idDePrecio(stripeKey, lookupKey) {
  const guardado = STRIPE_IDS?.[modoDeClave(stripeKey)]?.precios?.[lookupKey];
  if (guardado) return guardado;
  const r = await fetch(`https://api.stripe.com/v1/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!r.ok) throw new Error(`Stripe prices HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data?.[0]?.id || null;
}

async function plazasFundador(token) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/plazas_fundador_restantes`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: "{}",
  });
  if (!resp.ok) throw new Error(`plazas_fundador_restantes HTTP ${resp.status}`);
  return Number(await resp.json());
}

async function usuarioDesdeToken(token) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("token de sesión inválido o caducado");
  return resp.json();
}

async function clienteStripeExistente(token, userId) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/suscripciones?select=stripe_customer_id&user_id=eq.${userId}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  const filas = await resp.json();
  return filas[0]?.stripe_customer_id || null;
}

// Descuento por invitación (< 100 %, 2026-10-08): lo decide Postgres con el
// token del propio usuario (mi_invitacion_descuento(): canjeada por él, sin
// anular, sin caducar y sin usar). El cliente nunca manda el cupón. Si la
// función no responde, se cobra sin descuento y queda en el log.
async function invitacionConDescuento(token) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mi_invitacion_descuento`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!resp.ok) {
      console.error(`crear-checkout-stripe: mi_invitacion_descuento HTTP ${resp.status}`);
      return null;
    }
    const inv = await resp.json();
    return inv && inv.stripe_coupon_id ? inv : null;
  } catch (e) {
    console.error("crear-checkout-stripe: mi_invitacion_descuento falló:", e);
    return null;
  }
}

// Meses ganados con "Invita a un amigo" que aún no se han usado (2026-10-09):
// los decide Postgres con el token de quien paga (solo los suyos, máx. 3).
// Si la función no responde, se cobra sin ellos (siguen pendientes).
async function mesesDeAmigosPendientes(token) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mis_recompensas_referido_pendientes`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!resp.ok) {
      if (resp.status !== 404) console.error(`crear-checkout-stripe: mis_recompensas_referido_pendientes HTTP ${resp.status}`);
      return [];
    }
    const ids = await resp.json();
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string").slice(0, 3) : [];
  } catch (e) {
    console.error("crear-checkout-stripe: mis_recompensas_referido_pendientes falló:", e);
    return [];
  }
}

// Mensaje único que ve el usuario cuando algo falla del lado de Stripe. El
// detalle real (que es lo que hace falta para diagnosticar) se queda en el
// log del Worker. Un error de configuración nuestro no debe presentarse como
// si el usuario hubiera hecho algo mal, ni exponer identificadores internos.
const MENSAJE_GENERICO = "No se ha podido abrir el pago ahora mismo. Vuelve a intentarlo en unos minutos; si sigue fallando, escríbenos.";

export async function onRequestPost(context) {
  const { request, env } = context;
  // Interruptor COBRO_ACTIVO (por defecto apagado): sin él no se crea
  // ninguna sesión de pago, ni en live ni en test.
  if (!cobroActivo(env)) {
    return new Response(JSON.stringify({
      error: "Todavía no hemos abierto los pagos. Mientras tanto, disfruta de los 14 días de Premium gratis.",
      codigo: "cobro_no_activo",
    }), { status: 403, headers: { "content-type": "application/json" } });
  }
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Pagos no configurados todavía (falta STRIPE_SECRET_KEY)" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "falta el token de sesión" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "cuerpo inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const pedido = leerPlan(body);
  if (!pedido) {
    return new Response(JSON.stringify({ error: "plan inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const idioma = body?.idioma === "en" ? "en" : "es";
  // Sin la casilla marcada con la versión vigente del texto, no hay pago.
  const aceptacion = body?.aceptacion;
  if (!aceptacion || aceptacion.aceptada !== true || aceptacion.version !== VERSION_ACEPTACION) {
    return new Response(JSON.stringify({
      error: idioma === "en" ? "Please tick the box to accept the conditions before paying." : "Marca la casilla de aceptación antes de pagar.",
      codigo: "falta_aceptacion",
    }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const idiomaAcept = IDIOMAS_ACEPTACION.includes(aceptacion.idioma) ? aceptacion.idioma : idioma;

  // País de residencia declarado (obligatorio): decide la zona y el precio.
  const residencia = leerPaisResidencia(body);
  if (residencia.error) {
    const TXT_RES = {
      es: { falta_pais_residencia: "Elige tu país de residencia antes de pagar.", pais_residencia_invalido: "El país de residencia no es válido." },
      en: { falta_pais_residencia: "Please choose your country of residence before paying.", pais_residencia_invalido: "The country of residence isn't valid." },
    };
    return new Response(JSON.stringify({ error: TXT_RES[idioma][residencia.error], codigo: residencia.error }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
  const paisResidencia = residencia.pais;

  // Pagar 1 año con Bizum: va por su propio camino (pago único).
  if (body?.metodo === "bizum") {
    if (!bizumActivo(env)) {
      return new Response(JSON.stringify({
        error: idioma === "en" ? "Bizum payments are coming soon. You can pay by card now." : "El pago con Bizum llega pronto. Ya puedes pagar con tarjeta.",
        codigo: "bizum_no_activo",
      }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return checkoutBizum({ request, stripeKey, env, token, body, pedido, idioma, idiomaAcept, paisResidencia });
  }

  try {
    const usuario = await usuarioDesdeToken(token);
    const clienteExistente = await clienteStripeExistente(token, usuario.id);
    const origen = new URL(request.url).origin;

    // Zona por el país de residencia declarado. El de la conexión
    // (Cloudflare) solo se guarda, como una prueba más para el IVA.
    const paisIp = String(request.cf?.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
    const zona = zonaDePais(CONFIG_PRECIOS, paisResidencia);
    const precio = precioParaZona(CONFIG_PRECIOS, zona.id, pedido.ambito, pedido.plan);
    const esFundador = pedido.plan === "fundador_anual";
    if (esFundador) {
      let plazas = 0;
      try { plazas = await plazasFundador(token); } catch (e) { console.error(`crear-checkout-stripe: ${String(e)}`); plazas = 0; }
      if (!(plazas > 0)) {
        return new Response(JSON.stringify({
          error: idioma === "en" ? "There are no founder places left. You can take the annual plan." : "Ya no quedan plazas de fundador. Puedes elegir el plan anual.",
          codigo: "sin_plazas_fundador",
        }), { status: 409, headers: { "content-type": "application/json" } });
      }
    }
    // Black Friday 2x1 (2026-11-19): el código solo vale del 27 al 30/11 y
    // con el plan anual; lo comprueba el servidor (functions/_lib/black-friday.js).
    const conBf = body?.codigo_bf !== undefined && String(body.codigo_bf).trim() !== "";
    if (conBf) {
      const motivo = motivoCodigoBf(body.codigo_bf, pedido.plan);
      if (motivo) {
        const TXT = {
          es: { no_existe: "Ese código no existe.", fuera_de_plazo: "El código BLACKFRIDAY solo vale del 27 al 30 de noviembre.", solo_anual: "El código BLACKFRIDAY solo vale con el plan anual." },
          en: { no_existe: "That code doesn't exist.", fuera_de_plazo: "The BLACKFRIDAY code is only valid from 27 to 30 November.", solo_anual: "The BLACKFRIDAY code only works with the annual plan." },
        };
        return new Response(JSON.stringify({ error: TXT[idioma][motivo], codigo: `bf_${motivo}` }), { status: 400, headers: { "content-type": "application/json" } });
      }
    }
    const priceId = await idDePrecio(stripeKey, precio.lookup_key);
    if (!priceId) throw new Error(`no existe en Stripe el precio ${precio.lookup_key} (¿falta lanzar precios-stripe.yml?)`);
    const regionContenido = pedido.ambito === "mundial" ? "todas" : zona.region_contenido;
    const plan = pedido.plan === "mensual" ? "monthly" : "annual"; // para el cupón de invitación

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    if (precio.moneda !== "EUR") params.append("currency", precio.moneda.toLowerCase());
    params.append("locale", idiomaAcept);
    params.append("billing_address_collection", "required");
    // El texto aceptado, también en el checkout. Con la URL de términos
    // puesta en el Dashboard de Stripe (STRIPE_TOS_EN_CHECKOUT=1), Stripe
    // pone una casilla obligatoria y este texto va a su lado; si no, junto al
    // botón de pagar.
    const textoAcept = `${textoAceptacion(pedido.plan, idiomaAcept)} ${textoSiCerramos(idiomaAcept)}`;
    if (env.STRIPE_TOS_EN_CHECKOUT === "1") {
      params.append("consent_collection[terms_of_service]", "required");
      params.append("custom_text[terms_of_service_acceptance][message]", `${textoAcept} [${ENLACE_TERMINOS.replace("https://", "")}](${ENLACE_TERMINOS})`);
    } else {
      params.append("custom_text[submit][message]", `${textoAcept} ${ENLACE_TERMINOS.replace("https://", "")}`);
    }
    if (env.STRIPE_TAX_AUTOMATICO === "1") params.append("automatic_tax[enabled]", "true");
    const datosPlan = {
      zona: zona.id, pais_residencia: paisResidencia, pais_ip: paisIp || "?", ambito: pedido.ambito, plan: pedido.plan,
      region_contenido: regionContenido, fundador: String(esFundador), lookup_key: precio.lookup_key,
      aceptacion_version: VERSION_ACEPTACION, aceptacion_idioma: idiomaAcept,
      aceptacion_fecha: new Date().toISOString(), idioma,
    };
    await guardarAceptacion(token, usuario.id, {
      version: VERSION_ACEPTACION, idioma: idiomaAcept, plan: pedido.plan, ambito: pedido.ambito,
      zona: zona.id, pais_residencia: paisResidencia, fecha: datosPlan.aceptacion_fecha,
    });
    if (conBf) datosPlan.black_friday = MARCA_BF;
    for (const [k, v] of Object.entries(datosPlan)) {
      params.append(`metadata[${k}]`, v);
      params.append(`subscription_data[metadata][${k}]`, v);
    }
    // Sin trial: se cobra hoy. Los meses de amigos pendientes viajan en el
    // metadata y el webhook los abona como saldo al confirmar el pago.
    const mesesAmigos = await mesesDeAmigosPendientes(token);
    if (mesesAmigos.length) params.append("metadata[referidos_dias]", mesesAmigos.join(","));
    // Imprescindible para que el user_id llegue a los eventos
    // customer.subscription.* del webhook — el objeto Subscription no
    // hereda el metadata/client_reference_id de nivel superior de la
    // Checkout Session.
    params.append("subscription_data[metadata][supabase_user_id]", usuario.id);
    params.append("success_url", `${origen}/suscripcion.html?exito=1`);
    params.append("cancel_url", `${origen}/suscripcion.html?cancelado=1`);
    params.append("client_reference_id", usuario.id);
    params.append("metadata[supabase_user_id]", usuario.id);
    // Permite introducir un código de cupón/promoción en la propia
    // pantalla de Checkout de Stripe — los cupones (% o importe fijo,
    // con caducidad o límite de usos) se crean y gestionan desde el
    // Dashboard de Stripe (Products → Coupons), no hace falta código
    // nuevo aquí para cada cupón.
    //
    // Con descuento de invitación, en su lugar va el cupón de esa invitación
    // (Stripe no admite las dos cosas a la vez). El webhook marca la
    // invitación como aplicada al completar el pago (metadata invitacion_id).
    const invitacion = await invitacionConDescuento(token);
    if (invitacion && descuentoAplicaAPlan(invitacion, plan)) {
      params.append("discounts[0][coupon]", invitacion.stripe_coupon_id);
      params.append("metadata[invitacion_id]", invitacion.id);
      params.append("subscription_data[metadata][invitacion_id]", invitacion.id);
    } else if (!conBf) {
      // Con BLACKFRIDAY no se suma otro código de Stripe: el 2x1 ya es la oferta.
      params.append("allow_promotion_codes", "true");
    }
    // "Managed Payments" (activado por defecto en cuentas nuevas de Stripe)
    // haría a Stripe vendedor de registro; seguimos vendiendo nosotros.
    params.append("managed_payments[enabled]", "false");
    if (clienteExistente) {
      params.append("customer", clienteExistente);
      params.append("customer_update[address]", "auto");
    } else {
      params.append("customer_email", usuario.email);
    }

    const crearSesion = (cuerpo) =>
      fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: cuerpo.toString(),
      });

    let resp = await crearSesion(params);

    // Cliente de Stripe guardado que ya no existe (añadido 2026-09-25, bug
    // real en producción). `suscripciones.stripe_customer_id` se rellenó
    // durante las pruebas en modo TEST; al pasar la cuenta a modo live ese
    // cliente dejó de existir, porque test y live son mundos separados en
    // Stripe. Resultado: "No such customer: 'cus_...'" y nadie podía
    // suscribirse, con la clave, la cuenta y los precios correctos.
    //
    // En vez de exigir limpiar la tabla a mano, se reintenta UNA vez sin el
    // customer: Stripe crea uno nuevo y el webhook guarda su id al confirmar
    // la suscripción, así que el problema se cura solo. Cubre además
    // cualquier otro caso en que el cliente desaparezca (borrado desde el
    // Dashboard, cambio de cuenta), no solo el de test-a-live.
    if (!resp.ok && clienteExistente) {
      const detalle = await resp.clone().text();
      let falloDeCliente = false;
      try {
        const cuerpo = JSON.parse(detalle);
        falloDeCliente =
          cuerpo?.error?.code === "resource_missing" && cuerpo?.error?.param === "customer";
      } catch (e) {
        falloDeCliente = false;
      }
      if (falloDeCliente) {
        console.error(
          `crear-checkout-stripe: el cliente guardado ${clienteExistente} no existe en esta cuenta de Stripe; reintentando sin él`
        );
        params.delete("customer");
        params.delete("customer_update[address]");
        params.append("customer_email", usuario.email);
        resp = await crearSesion(params);
      }
    }

    if (!resp.ok) {
      // El cuerpo de error de Stripe va SOLO al log del Worker, nunca al
      // cliente (añadido 2026-09-25). Antes se reenviaba tal cual y el
      // usuario veía en pantalla el id de cuenta (acct_...), la URL de los
      // logs del dashboard y el id de petición — detalle interno que no le
      // sirve de nada y que no tiene por qué ser público. Mismo criterio ya
      // aplicado hoy a /identificar-captura.
      const detalle = await resp.text();
      console.error(`crear-checkout-stripe: Stripe HTTP ${resp.status}: ${detalle}`);
      if (params.has("discounts[0][coupon]") && /discounts|coupon/i.test(detalle)) {
        return new Response(JSON.stringify({
          error: "El descuento de tu invitación ya no es válido en el pago. Escríbenos y lo revisamos.",
          codigo: "descuento_no_valido",
        }), { status: 409, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const sesion = await resp.json();
    return new Response(JSON.stringify({ url: sesion.url }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error(`crear-checkout-stripe: fallo inesperado: ${String(e)}`);
    return new Response(JSON.stringify({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// ---- Pagar 1 año con Bizum (2026-11-25) ----
// Pago único (mode=payment) solo con Bizum, por el anual de la zona UE/EEE
// (precioBizum de _lib/bizum.js: nunca otro importe). Sin códigos de
// descuento: ni Black Friday, ni códigos de Stripe, ni cupón de invitación,
// ni meses de "Invita a un amigo" (siguen pendientes para un pago con
// tarjeta). Se rechaza si ya paga con tarjeta (no cobrar dos veces).

async function filaSuscripcion(token, userId) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/suscripciones?select=*&user_id=eq.${userId}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`suscripciones HTTP ${resp.status}`);
  return (await resp.json())[0] || null;
}

const TXT_BIZUM = {
  es: { ya_suscrito_tarjeta: "Ya tienes Premium con tarjeta. Puedes gestionarlo desde Mi suscripción.", bizum_sin_codigo: "Los códigos de descuento se usan con el pago con tarjeta.", bizum_solo_anual: "Con Bizum se paga el plan anual.", bizum_solo_espana: "El pago con Bizum está disponible en España.", bizum_solo_residentes_espana: "El pago con Bizum es para residentes en España. Puedes pagar con tarjeta.", bizum_importe: MENSAJE_GENERICO, plan_invalido: "Plan no válido." },
  en: { ya_suscrito_tarjeta: "You already have Premium by card. You can manage it from My subscription.", bizum_sin_codigo: "Discount codes work with card payments.", bizum_solo_anual: "Bizum is for the annual plan.", bizum_solo_espana: "Bizum payments are available in Spain.", bizum_solo_residentes_espana: "Bizum is for residents of Spain. You can pay by card.", bizum_importe: "We couldn't open the payment right now. Please try again in a few minutes.", plan_invalido: "Invalid plan." },
};

async function checkoutBizum({ request, stripeKey, env, token, body, pedido, idioma, idiomaAcept, paisResidencia }) {
  const T = TXT_BIZUM[idioma] || TXT_BIZUM.es;
  const responder = (codigo, status) => new Response(JSON.stringify({ error: T[codigo], codigo }), { status, headers: { "content-type": "application/json" } });
  try {
    if (body?.codigo_bf !== undefined && String(body.codigo_bf).trim() !== "") return responder("bizum_sin_codigo", 400);
    // Bizum solo para residentes en España (por la residencia declarada,
    // no por la conexión, que solo se guarda).
    const motivoRes = motivoBizumResidencia(paisResidencia);
    if (motivoRes) return responder(motivoRes, 403);
    const paisIp = String(request.cf?.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
    const precio = precioBizum(CONFIG_PRECIOS, paisResidencia, pedido.ambito, pedido.plan);
    if (precio.error) return responder(precio.error, precio.error === "bizum_solo_espana" ? 403 : 400);

    const usuario = await usuarioDesdeToken(token);
    const fila = await filaSuscripcion(token, usuario.id);
    if (tieneSuscripcionTarjeta(fila)) return responder("ya_suscrito_tarjeta", 409);
    const clienteExistente = fila?.stripe_customer_id || null;
    const origen = new URL(request.url).origin;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[0]", "bizum");
    params.append("line_items[0][price_data][currency]", "eur");
    params.append("line_items[0][price_data][unit_amount]", String(precio.importe));
    params.append("line_items[0][price_data][tax_behavior]", "inclusive");
    params.append("line_items[0][price_data][product_data][name]",
      pedido.ambito === "mundial" ? "Costaviva Premium Mundial: 1 año" : "Costaviva Premium: 1 año");
    params.append("line_items[0][quantity]", "1");
    params.append("locale", idiomaAcept);
    params.append("billing_address_collection", "required");
    const textoAcept = `${textoAceptacion("anual", idiomaAcept, "bizum")} ${textoSiCerramos(idiomaAcept)}`;
    if (env.STRIPE_TOS_EN_CHECKOUT === "1") {
      params.append("consent_collection[terms_of_service]", "required");
      params.append("custom_text[terms_of_service_acceptance][message]", `${textoAcept} [${ENLACE_TERMINOS.replace("https://", "")}](${ENLACE_TERMINOS})`);
    } else {
      params.append("custom_text[submit][message]", `${textoAcept} ${ENLACE_TERMINOS.replace("https://", "")}`);
    }
    if (env.STRIPE_TAX_AUTOMATICO === "1") params.append("automatic_tax[enabled]", "true");
    const datos = {
      supabase_user_id: usuario.id, metodo: "bizum", periodo: "anual",
      zona: precio.zona, pais_residencia: paisResidencia, pais_ip: paisIp || "?", ambito: pedido.ambito, plan: "anual",
      region_contenido: precio.region_contenido, fundador: "false", lookup_key: precio.lookup_key,
      aceptacion_version: VERSION_ACEPTACION, aceptacion_idioma: idiomaAcept,
      aceptacion_fecha: new Date().toISOString(), idioma,
    };
    for (const [k, v] of Object.entries(datos)) {
      params.append(`metadata[${k}]`, v);
      params.append(`payment_intent_data[metadata][${k}]`, v);
    }
    await guardarAceptacion(token, usuario.id, {
      version: VERSION_ACEPTACION, idioma: idiomaAcept, plan: "anual", ambito: pedido.ambito,
      zona: precio.zona, pais_residencia: paisResidencia, fecha: datos.aceptacion_fecha, metodo: "bizum",
    });
    params.append("client_reference_id", usuario.id);
    params.append("success_url", `${origen}/suscripcion.html?exito=1`);
    params.append("cancel_url", `${origen}/suscripcion.html?cancelado=1`);
    params.append("managed_payments[enabled]", "false");
    if (clienteExistente) {
      params.append("customer", clienteExistente);
      params.append("customer_update[address]", "auto");
    } else {
      params.append("customer_email", usuario.email);
      params.append("customer_creation", "always");
    }

    const crearSesion = (cuerpo) => fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo.toString(),
    });
    let resp = await crearSesion(params);
    // Cliente guardado que ya no existe (trampa 2): un reintento sin él.
    if (!resp.ok && clienteExistente) {
      let falloDeCliente = false;
      try {
        const e = JSON.parse(await resp.clone().text());
        falloDeCliente = e?.error?.code === "resource_missing" && e?.error?.param === "customer";
      } catch { falloDeCliente = false; }
      if (falloDeCliente) {
        console.error(`crear-checkout-stripe (bizum): el cliente guardado ${clienteExistente} no existe; reintentando sin él`);
        params.delete("customer");
        params.delete("customer_update[address]");
        params.append("customer_email", usuario.email);
        params.append("customer_creation", "always");
        resp = await crearSesion(params);
      }
    }
    if (!resp.ok) {
      // El detalle de Stripe solo al log (trampa 3).
      console.error(`crear-checkout-stripe (bizum): Stripe HTTP ${resp.status}: ${await resp.text()}`);
      return new Response(JSON.stringify({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }), { status: 502, headers: { "content-type": "application/json" } });
    }
    const sesion = await resp.json();
    return new Response(JSON.stringify({ url: sesion.url }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error(`crear-checkout-stripe (bizum): fallo inesperado: ${String(e)}`);
    return new Response(JSON.stringify({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
