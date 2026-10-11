#!/usr/bin/env node
// scripts/stripe/crear-precios.mjs — sin IA. Lo lanza .github/workflows/precios-stripe.yml.
//
// Crea en Stripe, de forma IDEMPOTENTE, los productos y precios de
// functions/_lib/precios-zonas.json (ver functions/_lib/precios.js):
//   - Productos "Costaviva Premium" (regional, se reutiliza el que ya existe)
//     y "Costaviva Premium Mundial".
//   - Un precio por ámbito y plan (mensual, anual, fundador anual), en EUR y
//     con currency_options para las monedas de las zonas activas (NZD...).
//     Impuestos INCLUIDOS (tax_behavior=inclusive): el precio que se anuncia
//     es el que se paga.
//   - Cada precio se busca por su lookup_key antes de crearlo. Si existe con
//     otros importes, NO se toca: se para con error (hay que subir
//     version_precios). Si le falta una moneda, se le añade.
//   - NUNCA borra ni archiva nada.
//
// Escribe los ids en functions/_lib/stripe-ids.json (por modo: test/live).
// Con --portal pone esos precios (salvo los de fundador, que tienen cupo) en
// la configuración por defecto del portal de cliente, para cambiar de plan.
//
// Variables: STRIPE_SECRET_KEY, MODO (test | live). Con --comprobar solo lee.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RAIZ, leerConfig } from "../precios/fuentes.mjs";
import { preciosStripe } from "../../functions/_lib/precios.js";

const RUTA_IDS = join(RAIZ, "functions", "_lib", "stripe-ids.json");
const API = "https://api.stripe.com/v1";
const clave = process.env.STRIPE_SECRET_KEY || "";
const modo = process.env.MODO || "";
const soloComprobar = process.argv.includes("--comprobar");
const conPortal = process.argv.includes("--portal");
// Código fiscal de Stripe Tax para el producto nuevo si el regional no tiene
// uno: "Software as a service (SaaS) - personal use".
const TAX_CODE_POR_DEFECTO = "txcd_10103000";

function salir(msg) { console.error(`::error::${msg}`); process.exit(1); }

if (!clave) salir("Falta STRIPE_SECRET_KEY (secreto de GitHub Actions). Ver PENDIENTES_MIKEL.md de comun.");
if (!["test", "live"].includes(modo)) salir("MODO debe ser test o live.");
const modoClave = /^(sk|rk)_live_/.test(clave) ? "live" : /^(sk|rk)_test_/.test(clave) ? "test" : "?";
if (modoClave !== modo) salir(`La clave es de modo ${modoClave} y se ha pedido ${modo}. No se ha tocado nada.`);

function form(obj, prefijo = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const nombre = prefijo ? `${prefijo}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x, `${nombre}[${i}]`, out) : out.append(`${nombre}[${i}]`, String(x))));
    else if (typeof v === "object") form(v, nombre, out);
    else out.append(nombre, String(v));
  }
  return out;
}

async function stripe(metodo, ruta, cuerpo, idempotencia) {
  const headers = { Authorization: `Bearer ${clave}` };
  if (cuerpo) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencia) headers["Idempotency-Key"] = idempotencia;
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers, body: cuerpo ? form(cuerpo).toString() : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${metodo} ${ruta.split("?")[0]} -> ${r.status}: ${j?.error?.message || "?"}`);
  return j;
}

async function todosLosProductos() {
  const out = [];
  let despues = null;
  for (;;) {
    const p = await stripe("GET", `/products?limit=100${despues ? `&starting_after=${despues}` : ""}`);
    out.push(...p.data);
    if (!p.has_more) return out;
    despues = p.data[p.data.length - 1].id;
  }
}

async function buscarPrecio(lookup) {
  const r = await stripe("GET", `/prices?lookup_keys[]=${encodeURIComponent(lookup)}&expand[]=data.currency_options&limit=1`);
  return r.data[0] || null;
}

const config = leerConfig();
const especificaciones = preciosStripe(config);
const resumen = [];
const ids = existsSync(RUTA_IDS) ? JSON.parse(readFileSync(RUTA_IDS, "utf8")) : {};
ids[modo] = ids[modo] || { productos: {}, precios: {} };

// Impuestos: solo se lee y se informa (Stripe Tax lo configura Mikel).
try {
  const t = await stripe("GET", "/tax/settings");
  const regs = await stripe("GET", "/tax/registrations?limit=100&status=active");
  resumen.push(`Stripe Tax: estado ${t.status}; registros activos: ${regs.data.map((r) => r.country).join(", ") || "ninguno"}; comportamiento por defecto: ${t.defaults?.tax_behavior || "sin fijar"}.`);
} catch (e) {
  resumen.push(`Stripe Tax: no se pudo leer (${e.message}).`);
}

// Productos.
const productos = await todosLosProductos();
const prodPorClave = {};
for (const [ambito, def] of Object.entries(config.productos)) {
  let p = productos.find((x) => x.metadata?.costaviva_clave === def.clave)
    || (ambito === "regional" ? productos.find((x) => x.active && x.name === def.nombre) : null);
  if (!p) {
    if (soloComprobar) { resumen.push(`Producto ${def.nombre}: NO existe (se crearía).`); continue; }
    const taxCode = prodPorClave.costaviva_premium?.tax_code;
    p = await stripe("POST", "/products", {
      name: def.nombre, description: def.descripcion,
      tax_code: (typeof taxCode === "string" ? taxCode : taxCode?.id) || TAX_CODE_POR_DEFECTO,
      metadata: { costaviva_clave: def.clave, costaviva_ambito: ambito },
    }, `cv-producto-${def.clave}-${modo}`);
    resumen.push(`Producto ${def.nombre}: creado ${p.id}.`);
  } else {
    if (!soloComprobar && p.metadata?.costaviva_clave !== def.clave) {
      await stripe("POST", `/products/${p.id}`, { metadata: { costaviva_clave: def.clave, costaviva_ambito: ambito } });
    }
    resumen.push(`Producto ${def.nombre}: ya existía ${p.id} (código fiscal: ${(typeof p.tax_code === "string" ? p.tax_code : p.tax_code?.id) || "ninguno"}).`);
  }
  prodPorClave[def.clave] = p;
  ids[modo].productos[def.clave] = p.id;
}

// Precios.
const errores = [];
for (const e of especificaciones) {
  const existente = await buscarPrecio(e.lookup_key);
  const opciones = Object.fromEntries(Object.entries(e.currency_options).map(([m, imp]) => [m, { unit_amount: imp, tax_behavior: "inclusive" }]));
  if (existente) {
    const distinto = existente.unit_amount !== e.importe || existente.currency !== e.moneda || existente.recurring?.interval !== e.intervalo;
    const faltan = {};
    for (const [m, o] of Object.entries(opciones)) {
      const actual = existente.currency_options?.[m]?.unit_amount;
      if (actual === undefined) faltan[m] = o;
      else if (actual !== o.unit_amount) errores.push(`${e.lookup_key}: ${m} existe con ${actual} y la config dice ${o.unit_amount}`);
    }
    if (distinto) errores.push(`${e.lookup_key}: existe con ${existente.unit_amount} ${existente.currency}/${existente.recurring?.interval} y la config dice ${e.importe} ${e.moneda}/${e.intervalo}`);
    if (Object.keys(faltan).length && !soloComprobar && !distinto) {
      await stripe("POST", `/prices/${existente.id}`, { currency_options: faltan });
      resumen.push(`${e.lookup_key}: ya existía ${existente.id}; añadidas monedas ${Object.keys(faltan).join(", ")}.`);
    } else {
      resumen.push(`${e.lookup_key}: ya existía ${existente.id}${Object.keys(faltan).length ? ` (le faltan ${Object.keys(faltan).join(", ")})` : ""}.`);
    }
    ids[modo].precios[e.lookup_key] = existente.id;
    continue;
  }
  const producto = prodPorClave[e.producto];
  if (soloComprobar || !producto) { resumen.push(`${e.lookup_key}: NO existe (se crearía: ${e.importe} ${e.moneda} + ${JSON.stringify(e.currency_options)}).`); continue; }
  const p = await stripe("POST", "/prices", {
    product: producto.id,
    currency: e.moneda,
    unit_amount: e.importe,
    tax_behavior: "inclusive",
    recurring: { interval: e.intervalo },
    lookup_key: e.lookup_key,
    nickname: `${e.ambito} ${e.plan} (${config.version_precios})`,
    currency_options: Object.keys(opciones).length ? opciones : undefined,
    metadata: { costaviva_ambito: e.ambito, costaviva_plan: e.plan, costaviva_fundador: String(e.fundador), costaviva_version: config.version_precios },
  }, `cv-precio-${e.lookup_key}-${modo}`);
  ids[modo].precios[e.lookup_key] = p.id;
  resumen.push(`${e.lookup_key}: creado ${p.id} (${e.importe} ${e.moneda}${Object.keys(opciones).length ? " + " + Object.entries(e.currency_options).map(([m, v]) => `${v} ${m}`).join(", ") : ""}).`);
}

// Portal de cliente: cambiar entre mensual y anual (y regional/Mundial) con
// los precios vigentes. Los de fundador fuera: tienen cupo.
if (conPortal && !soloComprobar && !errores.length) {
  try {
    const confs = await stripe("GET", "/billing_portal/configurations?is_default=true&limit=1");
    const conf = confs.data[0];
    const productosPortal = Object.values(config.productos).map((d) => ({
      product: ids[modo].productos[d.clave],
      prices: especificaciones.filter((e) => e.producto === d.clave && !e.fundador).map((e) => ids[modo].precios[e.lookup_key]).filter(Boolean),
    })).filter((x) => x.product && x.prices.length);
    const cuerpo = {
      features: {
        subscription_update: { enabled: true, default_allowed_updates: ["price"], products: productosPortal, proration_behavior: conf?.features?.subscription_update?.proration_behavior || "always_invoice" },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
      },
    };
    if (conf) await stripe("POST", `/billing_portal/configurations/${conf.id}`, cuerpo);
    else await stripe("POST", "/billing_portal/configurations", { ...cuerpo, business_profile: { headline: "Costaviva" } });
    resumen.push(`Portal de cliente: ${conf ? "actualizada" : "creada"} la configuración por defecto (cambio de plan + cancelación al final del periodo).`);
  } catch (e) {
    resumen.push(`Portal de cliente: NO actualizado (${e.message}).`);
  }
}

if (!soloComprobar) writeFileSync(RUTA_IDS, JSON.stringify(ids, null, 2) + "\n");
const texto = [`## Precios de Stripe (${modo}${soloComprobar ? ", solo comprobar" : ""})`, "", ...resumen.map((r) => `- ${r}`), ...(errores.length ? ["", "### Errores (no se ha cambiado nada de esto)", ...errores.map((x) => `- ${x}`)] : [])].join("\n");
console.log(texto);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, texto + "\n", { flag: "a" });
if (errores.length) salir(`${errores.length} precio(s) ya existen con otros importes: sube version_precios en precios-zonas.json.`);
