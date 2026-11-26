// scripts/avisos/enviar-invitacion.mjs — manda (o reenvía) el email de UNA
// invitación ya creada, el mismo de admin.html (2026-11-26, Mikel: «envía
// tú»). Para cuando Claude crea la invitación por SQL y no hay sesión de
// admin con la que llamar a /admin-invitaciones. Lo lanza el workflow manual
// enviar-invitacion.yml con el id de la invitación.
//
// Igual que admin-invitaciones.js: solo si sigue «enviada» (no canjeada,
// anulada ni caducada), helper único de email y email_enviado_en SOLO tras
// el 2xx de Resend (E8). Repo público: el log no lleva el email.
import { pathToFileURL } from "node:url";
import { enviarEmail } from "../../functions/_lib/email.js";
import { emailInvitacion, estadoInvitacion, uuidValido } from "../../functions/_lib/invitaciones.js";
import { SUPABASE_URL } from "../../functions/_lib/admin.js";

export async function enviarInvitacion({ id, env = process.env, fetchImpl = fetch }) {
  if (!uuidValido(id)) throw new Error("id de invitación no válido");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/invitaciones?id=eq.${id}&select=*`, { headers: cab });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
  const inv = (await r.json())?.[0];
  if (!inv) throw new Error("No existe esa invitación");
  const estado = estadoInvitacion(inv);
  if (estado !== "enviada") return { ok: false, motivo: `estado_${estado}` };
  const { asunto, texto, html } = emailInvitacion(inv, { contacto: env.ADMIN_EMAIL || null });
  const envio = await enviarEmail(env, { to: inv.email, subject: asunto, text: texto, html, replyTo: env.ADMIN_EMAIL || undefined });
  if (!envio.ok) return { ok: false, motivo: envio.error || "fallo_envio" };
  const p = await fetchImpl(`${SUPABASE_URL}/rest/v1/invitaciones?id=eq.${id}`, {
    method: "PATCH", headers: cab, body: JSON.stringify({ email_enviado_en: new Date().toISOString() }),
  });
  return { ok: true, marcada: p.ok };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  enviarInvitacion({ id: process.argv[2] })
    .then((res) => { console.log(JSON.stringify(res)); if (!res.ok) process.exit(1); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
