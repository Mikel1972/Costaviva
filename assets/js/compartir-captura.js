// assets/js/compartir-captura.js
// "Comparte tu captura" en el diario (2026-10-08, aprobado por Mikel).
//
// Casilla por captura, APAGADA por defecto: si se marca, la captura se copia
// de forma anónima (sin usuario, zona difuminada a ~5 km) para la comunidad y
// el índice. Desmarcarla la retira. Todo lo hace la base de datos (migración
// 20261008150000_capturas_compartidas.sql): aquí solo se inserta o se borra
// la marca propia en capturas_compartidas.
//
// Mientras la migración no esté aplicada, la tabla no existe: cargarCompartidas
// devuelve disponible=false y el diario no enseña la casilla (nada se rompe).
//
// Sin on*= (CSP con nonce): el diario engancha los eventos con
// addEventListener.

import { I18n } from "./i18n-modulo.js";

export const TEXTO_CASILLA = I18n.t("compartir.casilla");

export async function cargarCompartidas(supabase) {
  try {
    const { data, error } = await supabase.from("capturas_compartidas").select("captura_id");
    if (error) return { disponible: false, ids: new Set() };
    return { disponible: true, ids: new Set((data || []).map((x) => x.captura_id)) };
  } catch {
    return { disponible: false, ids: new Set() };
  }
}

function escaparAtributo(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function htmlCasillaCompartir(marcada = false) {
  return `
      <label class="checkbox" for="capturaCompartir" style="display:flex; gap:8px; align-items:flex-start; font-size:12px; color:#42585F; margin-top:10px;">
        <input type="checkbox" id="capturaCompartir" ${marcada ? "checked" : ""} style="width:auto; margin-top:2px;" />
        <span>${escaparAtributo(TEXTO_CASILLA)} <a href="/privacidad#comparte-tu-captura" target="_blank" rel="noopener">${I18n.t("compartir.que")}</a></span>
      </label>`;
}

export function htmlEtiquetaCompartida() {
  return `<div class="detalle" style="color:#2F6B5E;">${I18n.t("compartir.etiqueta")}</div>`;
}

// Deja la marca como pide la casilla. Devuelve { ok, error }.
export async function sincronizarCompartida(supabase, { capturaId, userId, compartir, yaCompartida }) {
  if (!capturaId || compartir === yaCompartida) return { ok: true };
  try {
    const { error } = compartir
      ? await supabase.from("capturas_compartidas").insert({ captura_id: capturaId, user_id: userId })
      : await supabase.from("capturas_compartidas").delete().eq("captura_id", capturaId);
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
