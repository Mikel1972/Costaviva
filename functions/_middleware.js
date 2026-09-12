// functions/_middleware.js
// Cloudflare Pages sirve como archivo estático público cualquier cosa que
// exista en el árbol de git, sin build step, salvo lo que un middleware
// como este bloquee explícitamente (mismo patrón de incidente real ya
// visto en Pólizas.ai, 2026-09-09: un fichero interno quedó accesible sin
// autenticación por no estar bloqueado). Este middleware corre en TODA
// petición (páginas, funciones, estáticos) antes de que se resuelva —
// intentamos primero con un `_redirects` con solo el código de estado
// ("/ruta 404") y Cloudflare lo ignoraba en silencio por faltarle un
// destino; esto sí es un mecanismo documentado y fiable.
//
// Ninguno de estos ficheros contiene datos reales de usuarios (revisado
// 2026-09-12) — son ficheros internos/operativos, no parte de la app, y
// no tienen nada que hacer servidos en público.
const RUTAS_BLOQUEADAS = new Set([
  "/ROBOT.md",
  "/ROBOT_REGLAS.md",
  "/CALIBRACION.jsonl",
  "/README.md",
  "/start.ps1",
]);
const PREFIJOS_BLOQUEADOS = ["/supabase/", "/test/"];

export async function onRequest(context) {
  const { request, next } = context;
  const { pathname } = new URL(request.url);
  if (RUTAS_BLOQUEADAS.has(pathname) || PREFIJOS_BLOQUEADOS.some((p) => pathname.startsWith(p))) {
    return new Response("Not Found", { status: 404 });
  }
  return next();
}
