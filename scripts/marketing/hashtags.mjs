// scripts/marketing/hashtags.mjs — hashtags de un texto (2026-11-19), para
// apuntarlos con las métricas de cada pieza y comparar cuáles funcionan.
export function hashtagsDeTexto(texto) {
  return [...new Set((String(texto).match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase()))];
}
