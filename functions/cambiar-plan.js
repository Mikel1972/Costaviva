// functions/cambiar-plan.js
// POST /cambiar-plan: cambio de plan de una suscripción activa (decisión de
// Mikel, 2026-10-11). Reglas en functions/_lib/cambio-plan.js:
//   - subida: empieza ya, abona lo no disfrutado y cobra la diferencia hoy;
//   - bajada (o mixto): al final del periodo pagado, sin abono.
//
// GET: el cambio programado que haya ({ cambio_programado: {fecha, plan, ambito} | null }).
// POST { anular: true }: anula la bajada programada (antes de su fecha).
// Cuerpo: { ambito, plan, confirmar, aceptacion: { version, idioma, aceptada }, idioma }
//   confirmar=false -> solo previsualiza (importe de hoy y descuento, o fecha
//   de la bajada); confirmar=true -> hace el cambio. Confirmar exige la
//   casilla de condiciones (assets/js/consentimiento.js), como el checkout.
//
// Auth: token de sesión del usuario (como crear-checkout-stripe.js). Solo
// toca SU suscripción (stripe_subscription_id leído con su token y RLS).
// Variables: STRIPE_SECRET_KEY y COBRO_ACTIVO.

import { precioParaZona, zonaPorId, datosDePrecio, cobroActivo, AMBITOS, PLANES } from "./_lib/precios.js";
import { clasificarCambio, planDestino, paramsPreviewSubida, paramsSubida, paramsBajada, resumenPreview, cambioProgramado } from "./_lib/cambio-plan.js";
import { VERSION as VERSION_ACEPTACION, IDIOMAS as IDIOMAS_ACEPTACION } from "../assets/js/consentimiento.js";
import CONFIG_PRECIOS from "./_lib/precios-zonas.json";
import STRIPE_IDS from "./_lib/stripe-ids.json";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

const MENSAJE_GENERICO = "No se ha podido cambiar el plan ahora mismo. Vuelve a intentarlo en unos minutos; si sigue fallando, escríbenos.";

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function form(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) p.append(k, String(v));
  return p;
}

async function stripe(clave, metodo, ruta, params) {
  const r = await fetch(`https://api.stripe.com/v1${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${clave}`, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: params ? form(params).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) {
    const e = new Error(`Stripe ${metodo} ${ruta.split("?")[0]} HTTP ${r.status}: ${j?.error?.message || "?"}`);
    e.stripe = j?.error;
    throw e;
  }
  return j;
}

async function supa(token, ruta, init = {}) {
  return fetch(`${SUPABASE_URL}${ruta}`, {
    ...init,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
}

async function idDePrecio(clave, lookupKey) {
  const modo = /^(sk|rk)_live_/.test(clave) ? "live" : "test";
  const guardado = STRIPE_IDS?.[modo]?.precios?.[lookupKey];
  if (guardado) return guardado;
  const j = await stripe(clave, "GET", `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
  return j.data?.[0]?.id || null;
}

async function suscripcionDelUsuario(token, clave) {
  const ru = await supa(token, "/auth/v1/user");
  if (!ru.ok) return { error: json({ error: "token de sesión inválido o caducado" }, 401) };
  const usuario = await ru.json();
  const rs = await supa(token, `/rest/v1/suscripciones?select=stripe_subscription_id,estado&user_id=eq.${usuario.id}`);
  const fila = rs.ok ? (await rs.json())[0] : null;
  if (!fila?.stripe_subscription_id || !["active", "trialing", "past_due"].includes(fila.estado)) {
    return { error: json({ error: "No tienes una suscripción activa que cambiar.", codigo: "sin_suscripcion" }, 400) };
  }
  const sub = await stripe(clave, "GET", `/subscriptions/${encodeURIComponent(fila.stripe_subscription_id)}?expand[]=schedule`);
  return { usuario, sub };
}

export async function onRequestGet({ request, env }) {
  const clave = env.STRIPE_SECRET_KEY;
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!clave || !token) return json({ cambio_programado: null });
  try {
    const r = await suscripcionDelUsuario(token, clave);
    if (r.error) return json({ cambio_programado: null });
    return json({ cambio_programado: cambioProgramado(r.sub.schedule) });
  } catch (e) {
    console.error(`cambiar-plan GET: ${String(e)}`);
    return json({ cambio_programado: null });
  }
}

export async function onRequestPost({ request, env }) {
  if (!cobroActivo(env)) return json({ error: "Todavía no hemos abierto los pagos.", codigo: "cobro_no_activo" }, 403);
  const clave = env.STRIPE_SECRET_KEY;
  if (!clave) return json({ error: MENSAJE_GENERICO, codigo: "sin_configurar" }, 501);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "falta el token de sesión" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  // Anular la bajada programada: se suelta el schedule y la suscripción
  // sigue con su plan actual.
  if (body?.anular === true) {
    try {
      const r = await suscripcionDelUsuario(token, clave);
      if (r.error) return r.error;
      const prog = cambioProgramado(r.sub.schedule);
      if (!prog) return json({ error: "No hay ningún cambio programado.", codigo: "sin_cambio" }, 400);
      await stripe(clave, "POST", `/subscription_schedules/${prog.schedule}/release`, {});
      return json({ ok: true, anulado: true });
    } catch (e) {
      console.error(`cambiar-plan anular: ${String(e)}`);
      return json({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }, 502);
    }
  }
  const ambito = body?.ambito;
  if (!AMBITOS.includes(ambito) || !PLANES.includes(body?.plan)) return json({ error: "plan inválido" }, 400);
  const confirmar = body?.confirmar === true;
  const idioma = body?.idioma === "en" ? "en" : body?.idioma === "pt" ? "pt" : "es";

  try {
    const r = await suscripcionDelUsuario(token, clave);
    if (r.error) return r.error;
    const { usuario, sub } = r;
    const item = sub.items?.data?.[0];
    const actualPrecio = datosDePrecio(item?.price);
    const actual = { periodo: actualPrecio.periodo, ambito: actualPrecio.ambito, fundador: actualPrecio.fundador };
    const plan = planDestino(actual, { ambito, plan: body.plan });
    const cambio = clasificarCambio(actual, { ambito, plan });
    if (cambio.tipo === "igual") return json({ error: "Ya tienes ese plan.", codigo: "mismo_plan" }, 400);

    // Precio fundador nuevo (no lo tenía): solo con plazas libres.
    if (plan === "fundador_anual" && !actual.fundador) {
      const rp = await supa(token, "/rest/v1/rpc/plazas_fundador_restantes", { method: "POST", body: "{}" });
      const plazas = rp.ok ? Number(await rp.json()) : 0;
      if (!(plazas > 0)) return json({ error: "Ya no quedan plazas de fundador.", codigo: "sin_plazas_fundador" }, 409);
    }

    const zonaId = zonaPorId(CONFIG_PRECIOS, sub.metadata?.zona) ? sub.metadata.zona : CONFIG_PRECIOS.zona_por_defecto;
    const precio = precioParaZona(CONFIG_PRECIOS, zonaId, ambito, plan);
    const priceId = await idDePrecio(clave, precio.lookup_key);
    if (!priceId) throw new Error(`no existe en Stripe el precio ${precio.lookup_key}`);
    const metadata = {
      ambito, plan, lookup_key: precio.lookup_key, fundador: String(plan === "fundador_anual"),
      region_contenido: ambito === "mundial" ? "todas" : (zonaPorId(CONFIG_PRECIOS, zonaId)?.region_contenido || "es"),
    };

    if (confirmar) {
      const a = body?.aceptacion;
      if (!a || a.aceptada !== true || a.version !== VERSION_ACEPTACION) {
        return json({ error: "Marca la casilla de aceptación antes de cambiar de plan.", codigo: "falta_aceptacion" }, 400);
      }
      await supa(token, "/rest/v1/eventos_uso", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: usuario.id, tipo: "acepta_condiciones_pago", detalle: {
          version: VERSION_ACEPTACION, idioma: IDIOMAS_ACEPTACION.includes(a.idioma) ? a.idioma : idioma,
          plan, ambito, cambio: cambio.tipo, fecha: new Date().toISOString(),
        } }),
      }).catch((e) => console.error("cambiar-plan: no se pudo guardar la aceptación", e));
    }

    if (cambio.tipo === "subida") {
      if (!confirmar) {
        const prev = await stripe(clave, "POST", "/invoices/create_preview", paramsPreviewSubida({
          customer: sub.customer, subscription: sub.id, itemId: item.id, priceId,
        }));
        return json({ tipo: "subida", plan, ambito, ...resumenPreview(prev) });
      }
      // Si había una bajada programada, se quita antes: la subida manda.
      if (sub.schedule) await stripe(clave, "POST", `/subscription_schedules/${typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id}/release`, {});
      const nueva = await stripe(clave, "POST", `/subscriptions/${sub.id}`, paramsSubida({ itemId: item.id, priceId, metadata }));
      return json({ ok: true, tipo: "subida", plan, ambito, estado: nueva.status });
    }

    // Bajada o mixto: al final del periodo pagado.
    const finPeriodo = item?.current_period_end;
    if (!confirmar) {
      return json({ tipo: "bajada", mixto: !!cambio.mixto, plan, ambito, fecha: finPeriodo ? new Date(finPeriodo * 1000).toISOString() : null, importe: precio.importe, moneda: precio.moneda });
    }
    let schedule = sub.schedule && typeof sub.schedule === "object" ? sub.schedule : null;
    if (!schedule) schedule = await stripe(clave, "POST", "/subscription_schedules", { from_subscription: sub.id });
    const inicioFase = schedule.phases?.[0]?.start_date || schedule.current_phase?.start_date;
    await stripe(clave, "POST", `/subscription_schedules/${schedule.id}`, paramsBajada({
      precioActual: item.price.id, priceId, inicioFase, finPeriodo, moneda: sub.currency, metadata,
    }));
    return json({ ok: true, tipo: "bajada", plan, ambito, fecha: finPeriodo ? new Date(finPeriodo * 1000).toISOString() : null });
  } catch (e) {
    console.error(`cambiar-plan: ${String(e)}`);
    if (e?.stripe?.code === "card_declined" || e?.stripe?.type === "card_error" || /payment/i.test(e?.stripe?.code || "")) {
      return json({ error: "No se ha podido cobrar la diferencia con tu tarjeta. Cámbiala en «Gestionar mi suscripción» y vuelve a intentarlo.", codigo: "cobro_fallido" }, 402);
    }
    return json({ error: MENSAJE_GENERICO, codigo: "fallo_stripe" }, 502);
  }
}
