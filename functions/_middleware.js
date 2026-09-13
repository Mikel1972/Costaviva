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
  // CLAUDE.md quedó fuera de esta lista por descuido (nunca se añadió al
  // crearla) y se sirvió en público hasta que la auditoría del
  // 2026-09-13 lo detectó (200 en vivo) — el fichero más sensible de
  // todos: documenta el aviso de que el SOS probablemente no avisa a
  // nadie, emails de cuentas de prueba, nombres de secretos y detalle
  // interno de RLS/esquema. Mismo patrón de incidente que ya motivó
  // crear este middleware, esta vez con el propio fichero que lo explica.
  "/CLAUDE.md",
]);
// "/functions/" añadido en la misma auditoría del 2026-09-13: Cloudflare
// Pages sirve el CÓDIGO FUENTE de cada functions/*.js como archivo
// estático si se pide su ruta literal (ej. /functions/sos-alerta.js),
// aparte de ejecutarlo como Function en su ruta reescrita (/sos-alerta).
// Confirmado en vivo (200, código fuente completo servido) antes de este
// fix. Ningún fichero del frontend pide nunca "/functions/..." (solo las
// rutas ya reescritas), así que bloquear este prefijo no rompe nada real
// — solo cierra la fuga del propio código (lógica de auth, nombres de
// cabeceras de secreto, comentarios internos) que no tiene por qué ser
// público aunque no contenga secretos en sí.
const PREFIJOS_BLOQUEADOS = ["/supabase/", "/test/", "/functions/"];

export async function onRequest(context) {
  const { request, next } = context;
  const { pathname } = new URL(request.url);
  if (RUTAS_BLOQUEADAS.has(pathname) || PREFIJOS_BLOQUEADOS.some((p) => pathname.startsWith(p))) {
    return new Response("Not Found", { status: 404 });
  }
  return next();
}
