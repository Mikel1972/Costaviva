// functions/_lib/rutas-publicas.js
// Lista BLANCA de rutas que _middleware.js deja pasar a next().
//
// Hasta el 2026-09-25 esto era una lista NEGRA: se bloqueaba lo que se
// sabía sensible y todo lo demás se servía. Ese diseño falló TRES veces en
// este repo, siempre igual — alguien añade un fichero o un directorio y
// nadie se acuerda de bloquearlo:
//   - 2026-09-13: CLAUDE.md y el código de functions/*.js, públicos.
//   - 2026-09-18: scripts/turbidez/ y scripts/camaras/, públicos.
//   - 2026-09-25: .github/workflows/*.yml, públicos — con los nombres de
//     todos los secrets, el email de la cuenta de servicio de Google Cloud,
//     la ruta del Workload Identity Provider y los prompts de los robots.
//
// El patrón viene de Pólizas.ai (functions/_lib/rutas-publicas.js allí),
// que migró a lista blanca el 2026-09-10 tras servir sin querer un JSON con
// datos reales de usuarios. Es estrictamente mejor porque **cambia el modo
// de fallar**: con lista negra, olvidarse expone datos en silencio; con
// lista blanca, olvidarse rompe una página y se nota enseguida.
//
// Un fichero o carpeta nuevo es PRIVADO por defecto. Si añades algo que
// deba verse desde fuera, tiene que entrar aquí explícitamente.
//
// OJO CON LAS DOS FORMAS DE CADA PÁGINA: Cloudflare Pages redirige (308)
// "/x.html" a "/x" (e "/index.html" a "/"). Hacen falta las DOS en la
// lista: la ".html" para que el middleware no corte la petición original
// antes de que Cloudflare pueda redirigirla, y la forma sin extensión
// porque es la que el navegador acaba pidiendo de verdad tras el redirect.
// Dejarse una de las dos rompe la página de formas difíciles de entender.

const ARCHIVOS_PUBLICOS = new Set([
  // Páginas de la app, en sus dos formas (ver el comentario de arriba).
  "/",
  "/index.html",
  "/login.html",
  "/login",
  "/diario.html",
  "/diario",
  "/alarma.html",
  "/alarma",
  "/grupos.html",
  "/grupos",
  "/suscripcion.html",
  "/suscripcion",
  // admin.html no es secreto: su seguridad real está en Supabase
  // (es_admin() y las funciones security definer), no en ocultar la URL.
  "/admin.html",
  "/admin",

  // Estáticos de la raíz.
  "/icon.svg",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",

  // Endpoints de functions/*.js. Listarlos aquí NO los hace públicos: cada
  // uno gestiona su propia autenticación (token de sesión en /sos-alerta o
  // /identificar-captura, X-Cron-Secret en /registrar-presion, firma de
  // Stripe en /stripe-webhook...). Esto solo permite que la petición llegue
  // hasta ese código.
  "/prevision",
  "/luna",
  "/rayos-imagen",
  "/geocodificar",
  "/sos-alerta",
  "/identificar-captura",
  "/viento-campo",
  "/crear-checkout-stripe",
  "/crear-portal-stripe",
  "/stripe-webhook",
  "/notificar-altas",
  "/registrar-presion",
  "/registrar-turbidez",
  "/registrar-estado-camaras",
  "/actualizar-euskalmet-rios",
  "/informe-diario-email",
  // Índice de las páginas SEO de mareas (functions/mareas/index.js).
  "/mareas",
]);

// Prefijos públicos:
//   /assets/  — vídeo de portada, JS de terceros (leaflet-velocity), QR e
//               imágenes del robot de marketing. Estas últimas TIENEN que
//               ser públicas: Instagram descarga la imagen por URL al crear
//               el borrador del post, así que bloquearlas rompería el robot.
//   /webcam/  — proxy de imagen por spot (functions/webcam/[slug].js).
//   /mareas/  — páginas SEO por spot y por región (functions/mareas/...).
const PREFIJOS_PUBLICOS = ["/assets/", "/webcam/", "/mareas/"];

export function esRutaPermitida(pathname) {
  if (ARCHIVOS_PUBLICOS.has(pathname)) return true;
  return PREFIJOS_PUBLICOS.some((prefijo) => pathname.startsWith(prefijo));
}

export { ARCHIVOS_PUBLICOS, PREFIJOS_PUBLICOS };
