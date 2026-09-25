// functions/_middleware.js
// Cloudflare Pages sirve TODO lo que hay en el árbol de git, incluidos los
// directorios que empiezan por punto. Este middleware decide qué se sirve.
//
// Desde el 2026-09-25 usa una lista BLANCA (ver functions/_lib/rutas-publicas.js
// para la lista y el razonamiento completo). Antes era una lista negra, y
// falló tres veces: CLAUDE.md y functions/ (2026-09-13), scripts/
// (2026-09-18) y .github/workflows/ (2026-09-25). Siempre el mismo patrón —
// se añade un fichero nuevo y nadie se acuerda de bloquearlo.
//
// La diferencia real no es cuánto bloquea cada enfoque, sino CÓMO FALLA
// cada uno cuando se te olvida algo: con lista negra, el olvido expone
// información en silencio y puede tardar meses en descubrirse; con lista
// blanca, el olvido rompe una página y se nota en la siguiente prueba.
//
// Patrón tomado de Pólizas.ai, que migró a esto el 2026-09-10 tras haber
// servido sin querer un JSON con datos reales de usuarios.
//
// SI AÑADES UNA PÁGINA, UN ENDPOINT O UNA CARPETA DE ASSETS: tiene que
// entrar en rutas-publicas.js o devolverá 404. Es deliberado.
import { esRutaPermitida } from "./_lib/rutas-publicas.js";

export async function onRequest(context) {
  const { request, next } = context;
  const { pathname } = new URL(request.url);
  if (!esRutaPermitida(pathname)) {
    return new Response("Not Found", { status: 404 });
  }
  return next();
}
