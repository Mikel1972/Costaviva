// functions/contar-visita.js — baliza del contador de visitas (2026-11-20).
// La manda assets/js/visita.js al cargar una página pública en un navegador.
// Siempre 204: no dice nada a quien la llama. Ver functions/_lib/visitas.js.
import { visitaDeBaliza, contarVisita } from "./_lib/visitas.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_middleware.js";

export async function onRequestPost(context) {
  try {
    const texto = await context.request.text();
    if (texto.length <= 2000) {
      const visita = visitaDeBaliza(JSON.parse(texto), context.request);
      if (visita) context.waitUntil(contarVisita(visita, { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }));
    }
  } catch { /* nunca falla hacia fuera */ }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
