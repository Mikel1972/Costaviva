// functions/_lib/secreto.js
// Prefijo "_" a propósito: Cloudflare Pages Functions no expone como ruta
// nada bajo functions/_lib (y la lista blanca de rutas tampoco).
//
// Comparación en tiempo constante del secreto de las rutinas (X-Cron-Secret
// contra CRON_SECRET), Mikel1972/comun estandares/supabase.md D13 (2026-10-07).
// Un `!==` corta en el primer carácter distinto y en teoría filtra por
// tiempo cuántos acertó quien prueba. Sin secreto configurado, siempre
// rechaza (fail-closed).
export function secretoValido(recibido, esperado) {
  if (!esperado || typeof esperado !== "string" || typeof recibido !== "string") return false;
  if (recibido.length !== esperado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferencia === 0;
}
