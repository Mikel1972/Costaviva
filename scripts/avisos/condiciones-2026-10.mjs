// scripts/avisos/condiciones-2026-10.mjs
// Aviso de las nuevas condiciones (2026-10-22, decisión de Mikel). Sin IA.
//
// Las cuentas de antes de la hoja de condiciones del alta que no marcaron la
// casilla de capturas anónimas (perfiles.consiente_uso_datos_capturas =
// false) reciben UN email: a partir de <fecha de envío + 15 días> sus
// capturas entran en las estadísticas anónimas por interés legítimo (art.
// 6.1.f RGPD) salvo que se opongan en «Tus datos» (suscripcion.html, RPC
// fijar_uso_capturas_estadisticas, que pone oposicion_estadisticas_en).
//
// Modos (uno por ejecución; workflow manual .github/workflows/aviso-condiciones.yml):
//   --contar   solo recuentos: pendientes de aviso por idioma, avisados,
//              opuestos y listos para incluir. Solo lectura.
//   --probar   pinta el email en es/en/pt con un destinatario falso. Sin red.
//   --enviar   manda el aviso por Resend (remitente de siempre,
//              avisos@costaviva.org) a quien no lo tenga, como mucho
//              LIMITE_DIA en 24 h, con pausa entre envíos; tras cada envío
//              confirmado pone aviso_condiciones_en. Repetible sin duplicar.
//   --incluir  a quien recibió el aviso hace más de 15 días, no se ha opuesto
//              y sigue a false: consiente_uso_datos_capturas = true.
//
// REPO PÚBLICO: nada de emails ni ids en el registro, solo números. Todo lo
// que se imprime pasa por log(), que tapa cualquier dirección que no sea de
// costaviva.org (test/aviso-condiciones.test.js).
//
// NECESITA: la migración 20261023120000_aviso_condiciones_oposicion.sql
// aplicada; SUPABASE_SERVICE_ROLE_KEY; para enviar, RESEND_API_KEY.

import { pathToFileURL } from "node:url";

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
export const REMITENTE = "Costaviva <avisos@costaviva.org>";
export const RESPONDER_A = "datos@costaviva.org";
export const DIAS_PREAVISO = 15;
export const LIMITE_DIA = 90; // Resend gratis: 100/día (deja hueco a los avisos de siempre)
export const PAUSA_MS = 700; // Resend: máx. ~2 peticiones por segundo
export const IDIOMAS = ["es", "en", "pt"];
const DIA_MS = 24 * 60 * 60 * 1000;

// ── Registro sin datos personales ────────────────────────────────────────
const RE_EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
export function limpiar(texto) {
  return String(texto).replace(RE_EMAIL, (m, dominio) => (dominio.toLowerCase() === "costaviva.org" ? m : "[email]"));
}
export function log(...partes) {
  console.log(limpiar(partes.join(" ")));
}

// ── Idioma y fechas ──────────────────────────────────────────────────────
// Mismo orden que el resto de emails a usuarios: user_metadata.idioma; si no,
// el idioma en que aceptó la hoja del alta; si no, español.
export function idiomaDe(metadatos) {
  for (const v of [metadatos?.idioma, metadatos?.condiciones_alta_idioma]) {
    const i = String(v ?? "").toLowerCase().slice(0, 2);
    if (IDIOMAS.includes(i)) return i;
  }
  return "es";
}

export function fechaInclusion(enviadoEn) {
  return new Date(new Date(enviadoEn).getTime() + DIAS_PREAVISO * DIA_MS);
}

// Hora de Madrid a propósito (ZONA_NEGOCIO), como los demás emails de cuenta.
const LOCALE = { es: "es-ES", en: "en-GB", pt: "pt-PT" };
export function fechaLarga(fecha, idioma = "es") {
  return new Date(fecha).toLocaleDateString(LOCALE[idioma] || LOCALE.es, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid", // a propósito (ZONA_NEGOCIO)
  });
}

// ── Selección (pura) ─────────────────────────────────────────────────────
// perfil: { id, email, consiente_uso_datos_capturas, aviso_condiciones_en,
// oposicion_estadisticas_en }; usuario (auth): { email_confirmed_at,
// user_metadata } o undefined si ya no existe.
export function pendienteDeAviso(perfil, usuario, excluidos = new Set()) {
  if (!perfil || perfil.consiente_uso_datos_capturas !== false) return false;
  if (perfil.aviso_condiciones_en) return false;
  if (perfil.oposicion_estadisticas_en) return false; // ya se opuso: nada que avisar
  if (!usuario || !usuario.email_confirmed_at) return false;
  if (!perfil.email || excluidos.has(String(perfil.email).toLowerCase())) return false;
  return true;
}

export function listoParaIncluir(perfil, ahora = new Date()) {
  if (!perfil || perfil.consiente_uso_datos_capturas !== false) return false;
  if (perfil.oposicion_estadisticas_en) return false;
  if (!perfil.aviso_condiciones_en) return false;
  return new Date(perfil.aviso_condiciones_en).getTime() <= limiteIncluir(ahora).getTime();
}

export const limiteIncluir = (ahora = new Date()) => new Date(new Date(ahora).getTime() - DIAS_PREAVISO * DIA_MS);

// Cuántos caben hoy: LIMITE_DIA menos lo enviado en las últimas 24 h.
export function cupoHoy(perfiles, ahora = new Date(), limite = LIMITE_DIA) {
  const desde = new Date(ahora).getTime() - DIA_MS;
  const enviados = perfiles.filter((p) => p.aviso_condiciones_en && new Date(p.aviso_condiciones_en).getTime() > desde).length;
  return Math.max(0, limite - enviados);
}

export function recuento(perfiles, usuarios, excluidos = new Set(), ahora = new Date()) {
  const r = {
    sin_consentimiento: 0,
    pendientes_aviso: { es: 0, en: 0, pt: 0, total: 0 },
    sin_confirmar_o_sin_cuenta: 0,
    avisados: 0,
    opuestos: 0,
    en_preaviso: 0,
    listos_para_incluir: 0,
    cupo_hoy: cupoHoy(perfiles, ahora),
  };
  for (const p of perfiles) {
    if (p.oposicion_estadisticas_en) r.opuestos++;
    if (p.aviso_condiciones_en) r.avisados++;
    if (p.consiente_uso_datos_capturas !== false) continue;
    r.sin_consentimiento++;
    const u = usuarios.get(p.id);
    if (pendienteDeAviso(p, u, excluidos)) {
      const i = idiomaDe(u.user_metadata);
      r.pendientes_aviso[i]++;
      r.pendientes_aviso.total++;
    } else if (!p.aviso_condiciones_en && !p.oposicion_estadisticas_en && (!u || !u.email_confirmed_at)) {
      r.sin_confirmar_o_sin_cuenta++;
    }
    if (listoParaIncluir(p, ahora)) r.listos_para_incluir++;
    else if (p.aviso_condiciones_en && !p.oposicion_estadisticas_en) r.en_preaviso++;
  }
  return r;
}

// ── Email (puro) ─────────────────────────────────────────────────────────
const ENLACES = {
  datos: "https://costaviva.org/suscripcion#datos",
  terminos: "https://costaviva.org/terminos",
  privacidad: "https://costaviva.org/privacidad",
};

const TEXTOS = {
  es: {
    asunto: "Cambios en las condiciones de Costaviva",
    hola: "Hola,",
    p1: "Hemos actualizado nuestras condiciones y queremos contártelo.",
    p2: (f) => `A partir del ${f} usaremos las capturas de tu diario de forma anónima y agregada (especie, spot del catálogo y mes; nunca tu nombre, tu email ni tus ubicaciones personales) para mejorar el índice de pesca y nuestras estadísticas. Lo hacemos por interés legítimo (art. 6.1.f del RGPD).`,
    p3: "Si no te parece bien, puedes oponerte cuando quieras en 👤 → Mi suscripción → «Tus datos» (desmarca la casilla). Si lo haces antes de esa fecha, no usaremos ninguna de tus capturas.",
    enlace_datos: "Tus datos",
    terminos: "Términos y condiciones",
    privacidad: "Privacidad",
    dudas: "¿Dudas? Escríbenos a",
    gracias: "Gracias por pescar con nosotros.",
  },
  en: {
    asunto: "Changes to Costaviva's terms",
    hola: "Hi,",
    p1: "We've updated our terms and wanted to let you know.",
    p2: (f) => `From ${f} we'll use the catches in your log anonymously and in aggregate (species, catalogue spot and month; never your name, your email or your personal locations) to improve the fishing index and our statistics. We do this on the basis of legitimate interest (art. 6(1)(f) GDPR).`,
    p3: "If you'd rather we didn't, you can object at any time in 👤 → My subscription → “Your data” (untick the box). If you do so before that date, we won't use any of your catches.",
    enlace_datos: "Your data",
    terminos: "Terms and conditions",
    privacidad: "Privacy",
    dudas: "Questions? Write to us at",
    gracias: "Thanks for fishing with us.",
  },
  pt: {
    asunto: "Alterações às condições da Costaviva",
    hola: "Olá,",
    p1: "Atualizámos as nossas condições e queremos dar-lhe conhecimento.",
    p2: (f) => `A partir de ${f} vamos usar as capturas do seu diário de forma anónima e agregada (espécie, spot do catálogo e mês; nunca o seu nome, o seu email nem as suas localizações pessoais) para melhorar o índice de pesca e as nossas estatísticas. Fazemo-lo com base no interesse legítimo (art. 6.º, n.º 1, al. f, do RGPD).`,
    p3: "Se não concordar, pode opor-se quando quiser em 👤 → A minha subscrição → «Os seus dados» (desmarque a caixa). Se o fizer antes dessa data, não usaremos nenhuma das suas capturas.",
    enlace_datos: "Os seus dados",
    terminos: "Termos e condições",
    privacidad: "Privacidade",
    dudas: "Dúvidas? Escreva-nos para",
    gracias: "Obrigado por pescar connosco.",
  },
};
export const FIRMA = "Mikel — Costaviva";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailAviso(idioma, enviadoEn = new Date()) {
  const i = IDIOMAS.includes(idioma) ? idioma : "es";
  const t = TEXTOS[i];
  const fecha = fechaLarga(fechaInclusion(enviadoEn), i);
  const texto = [
    t.hola,
    "",
    t.p1,
    "",
    t.p2(fecha),
    "",
    t.p3,
    `${t.enlace_datos}: ${ENLACES.datos}`,
    "",
    `${t.terminos}: ${ENLACES.terminos}`,
    `${t.privacidad}: ${ENLACES.privacidad}`,
    `${t.dudas} ${RESPONDER_A}`,
    "",
    t.gracias,
    FIRMA,
  ].join("\n");
  const p = (s) => `<p style="margin:0 0 14px">${s}</p>`;
  const a = (href, txt) => `<a href="${esc(href)}" style="color:#0b6e8a">${esc(txt)}</a>`;
  const html = [
    `<!doctype html><html lang="${i}"><body style="margin:0;padding:24px;background:#f6f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2b36;font-size:15px;line-height:1.5">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;padding:24px">`,
    p(esc(t.hola)),
    p(esc(t.p1)),
    p(esc(t.p2(fecha))),
    p(`${esc(t.p3)}<br>${a(ENLACES.datos, `${t.enlace_datos} →`)}`),
    p(`${a(ENLACES.terminos, t.terminos)} · ${a(ENLACES.privacidad, t.privacidad)}<br>${esc(t.dudas)} ${a(`mailto:${RESPONDER_A}`, RESPONDER_A)}`),
    p(`${esc(t.gracias)}<br>${esc(FIRMA)}`),
    `</div></body></html>`,
  ].join("\n");
  return { idioma: i, asunto: t.asunto, texto, html, fecha };
}

// ── Producción ───────────────────────────────────────────────────────────
function clave() {
  const k = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!k) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  return k;
}
const cabeceras = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, "content-type": "application/json" });

async function leerPerfiles() {
  const k = clave();
  const filas = [];
  const select = "id,email,consiente_uso_datos_capturas,aviso_condiciones_en,oposicion_estadisticas_en";
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?select=${select}&order=id`, {
      headers: { ...cabeceras(k), Range: `${desde}-${desde + 999}` },
    });
    // Sin el cuerpo: podría citar valores. Solo el código.
    if (!r.ok) throw new Error(`perfiles: HTTP ${r.status} (¿migración 20261023120000 sin aplicar?)`);
    const p = await r.json();
    filas.push(...p);
    if (p.length < 1000) return filas;
  }
}

async function leerUsuarios() {
  const k = clave();
  const usuarios = new Map();
  for (let page = 1; page < 100; page++) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: cabeceras(k) });
    if (!r.ok) throw new Error(`auth admin users: HTTP ${r.status}`);
    const us = (await r.json()).users ?? [];
    for (const u of us) usuarios.set(u.id, { email_confirmed_at: u.email_confirmed_at, user_metadata: u.user_metadata || {} });
    if (us.length < 1000) break;
  }
  return usuarios;
}

// Cuentas de prueba (secrets del repo): ni se cuentan ni se avisan.
function excluidos() {
  return new Set(
    [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_B_EMAIL, process.env.SMOKE_TEST_EMAIL]
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase()),
  );
}

async function enviarResend(para, correo) {
  const k = (process.env.RESEND_API_KEY || "").trim();
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${k}` },
    body: JSON.stringify({ from: REMITENTE, to: [para], reply_to: RESPONDER_A, subject: correo.asunto, text: correo.texto, html: correo.html }),
  });
  // El cuerpo de error de Resend puede traer el destinatario: no se imprime.
  return r.ok ? { ok: true } : { ok: false, status: r.status };
}

async function marcarAvisado(id, cuando) {
  const k = clave();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${encodeURIComponent(id)}&aviso_condiciones_en=is.null`, {
    method: "PATCH",
    headers: { ...cabeceras(k), Prefer: "return=minimal" },
    body: JSON.stringify({ aviso_condiciones_en: cuando.toISOString() }),
  });
  return r.ok;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function contar() {
  const [perfiles, usuarios] = await Promise.all([leerPerfiles(), leerUsuarios()]);
  const r = recuento(perfiles, usuarios, excluidos());
  log(`Cuentas con consiente_uso_datos_capturas = false: ${r.sin_consentimiento}`);
  log(`Pendientes de aviso: ${r.pendientes_aviso.total} (es ${r.pendientes_aviso.es}, en ${r.pendientes_aviso.en}, pt ${r.pendientes_aviso.pt})`);
  log(`Sin email confirmado o sin cuenta (no se avisan): ${r.sin_confirmar_o_sin_cuenta}`);
  log(`Ya avisadas: ${r.avisados} · en preaviso: ${r.en_preaviso} · listas para incluir: ${r.listos_para_incluir}`);
  log(`Se han opuesto: ${r.opuestos}`);
  log(`Cupo de envío hoy: ${r.cupo_hoy} de ${LIMITE_DIA}`);
  return r;
}

function probar(ahora = new Date()) {
  for (const i of IDIOMAS) {
    const c = emailAviso(i, ahora);
    log(`===== ${i} · Para: pescador de prueba · De: ${REMITENTE} · Responder a: ${RESPONDER_A}`);
    log(`Asunto: ${c.asunto}`);
    log("--- texto ---");
    log(c.texto);
    log("--- html ---");
    log(c.html);
    log("");
  }
  log("Modo probar: no se ha enviado nada ni se ha leído la base de datos.");
}

async function enviar() {
  if (!(process.env.RESEND_API_KEY || "").trim()) throw new Error("Falta RESEND_API_KEY (secret del repo, el mismo valor que en Cloudflare Pages).");
  const [perfiles, usuarios] = await Promise.all([leerPerfiles(), leerUsuarios()]);
  const fuera = excluidos();
  const cupo = cupoHoy(perfiles);
  const pendientes = perfiles.filter((p) => pendienteDeAviso(p, usuarios.get(p.id), fuera));
  log(`Pendientes de aviso: ${pendientes.length} · cupo hoy: ${cupo} de ${LIMITE_DIA}`);
  const lote = pendientes.slice(0, cupo);
  const res = { enviados: 0, fallos_envio: 0, fallos_marcar: 0, por_idioma: { es: 0, en: 0, pt: 0 } };
  for (const p of lote) {
    const ahora = new Date();
    const correo = emailAviso(idiomaDe(usuarios.get(p.id).user_metadata), ahora);
    const e = await enviarResend(p.email, correo);
    if (!e.ok) {
      res.fallos_envio++;
      log(`Fallo de Resend (HTTP ${e.status}); se reintentará en otra pasada.`);
      if (e.status === 429) break; // cupo de Resend agotado: parar
    } else if (await marcarAvisado(p.id, ahora)) {
      res.enviados++;
      res.por_idioma[correo.idioma]++;
    } else {
      res.fallos_marcar++;
    }
    await dormir(PAUSA_MS);
  }
  log(`Enviados: ${res.enviados} (es ${res.por_idioma.es}, en ${res.por_idioma.en}, pt ${res.por_idioma.pt}) · fallos de envío: ${res.fallos_envio} · enviados sin marcar: ${res.fallos_marcar}`);
  log(`Quedan pendientes: ${pendientes.length - res.enviados}`);
  if (res.fallos_marcar) throw new Error("Algún email salió pero no se pudo marcar: podría repetirse en la próxima pasada.");
  return res;
}

async function incluir(ahora = new Date()) {
  const k = clave();
  // Un único PATCH con todas las condiciones en el filtro: si alguien se
  // opone entre medias, Postgres ya no le toca.
  const filtro = [
    "consiente_uso_datos_capturas=eq.false",
    "oposicion_estadisticas_en=is.null",
    `aviso_condiciones_en=lte.${encodeURIComponent(limiteIncluir(ahora).toISOString())}`,
  ].join("&");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/perfiles?${filtro}&select=id`, {
    method: "PATCH",
    headers: { ...cabeceras(k), Prefer: "return=representation" },
    body: JSON.stringify({ consiente_uso_datos_capturas: true }),
  });
  if (!r.ok) throw new Error(`incluir: HTTP ${r.status}`);
  const filas = await r.json();
  log(`Incluidas en las estadísticas anónimas (interés legítimo, ${DIAS_PREAVISO} días de preaviso cumplidos): ${filas.length}`);
  return filas.length;
}

export async function main(args = process.argv.slice(2)) {
  const modos = ["--contar", "--probar", "--enviar", "--incluir"].filter((m) => args.includes(m));
  if (modos.length !== 1) throw new Error("Usa exactamente uno: --contar, --probar, --enviar o --incluir.");
  if (modos[0] === "--probar") return probar();
  if (modos[0] === "--contar") return contar();
  if (modos[0] === "--enviar") return enviar();
  return incluir();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(limpiar(`::error::${e.message}`));
    process.exit(1);
  });
}
