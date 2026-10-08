// functions/_lib/email.js
// Helper único de envío de emails vía Resend (Mikel1972/comun,
// estandares/emails.md E5/E6, 2026-10-07). Todos los endpoints envían por
// aquí en vez de repetir el fetch a api.resend.com.
//
// Nunca lanza: devuelve { ok: true, id } o { ok: false, status?, error } y
// deja el detalle de Resend en el log (console.error). Ese detalle NO debe
// llegar a ninguna respuesta HTTP: puede traer el email del destinatario.
//
// Remitente por defecto: avisos@costaviva.org (dominio propio verificado en
// Resend, ver CLAUDE.md). El SOS pasa el suyo (sos@costaviva.org).

const RESEND_URL = "https://api.resend.com/emails";
export const REMITENTE_AVISOS = "Costaviva <avisos@costaviva.org>";

export async function enviarEmail(env, { from = REMITENTE_AVISOS, to, subject, text, html, replyTo } = {}) {
  const apiKey = env?.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY no configurada; no se envía:", subject);
    return { ok: false, error: "sin_configurar" };
  }
  const payload = { from, to: Array.isArray(to) ? to : [to], subject };
  if (text) payload.text = text;
  if (html) payload.html = html;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let cuerpo = "";
      try { cuerpo = await res.text(); } catch { cuerpo = "(sin cuerpo)"; }
      console.error("[email] Resend respondió", res.status, cuerpo, "— asunto:", subject);
      return { ok: false, status: res.status, error: `Resend respondió ${res.status}` };
    }
    let id = null;
    try { id = (await res.json())?.id ?? null; } catch { /* respuesta ok sin JSON */ }
    return { ok: true, id };
  } catch (e) {
    console.error("[email] Error de red enviando a Resend:", e, "— asunto:", subject);
    return { ok: false, error: "error de red con Resend" };
  }
}

// Escapado de texto para interpolar en el HTML de un email (E6).
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
