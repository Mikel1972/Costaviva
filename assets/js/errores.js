// assets/js/errores.js
// Traduce los errores de Supabase (Auth, PostgREST, red) a un texto que el
// usuario pueda leer, sin enseñarle nunca el error.message crudo
// (Mikel1972/comun, estandares/auth.md A14 y trampa 3; 2026-10-07).
//
// Script clásico (no módulo) a propósito: se carga con
// <script src="/assets/js/errores.js"></script> antes del resto y deja
// window.traducirError disponible tanto para los <script type="module">
// como para el script clásico del mapa en index.html.
//
// Regla: las excepciones PROPIAS de nuestras funciones SQL (raise exception,
// código P0001, textos en español escritos por nosotros: "Código de
// invitación no válido o caducado"…) se muestran tal cual. Todo lo demás se
// traduce si se reconoce y, si no, se muestra el texto genérico que pasa
// quien llama. El original siempre va a la consola para diagnosticar.
(function () {
  function traducirError(error, generico) {
    console.error("[supabase]", error);
    const porDefecto = generico || "No se ha podido completar la operación. Inténtalo de nuevo.";
    if (!error) return porDefecto;
    const original = String(error.message || "");
    if (error.code === "P0001" && original) return original;
    const msg = original.toLowerCase();
    if (msg.includes("email not confirmed")) return "Todavía no has confirmado tu email: revisa tu bandeja de entrada (y spam) y pulsa el enlace que te enviamos.";
    if (msg.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
    if (msg.includes("rate limit") || msg.includes("too many requests") || error.status === 429) return "Demasiados intentos seguidos: espera un minuto y vuelve a intentarlo.";
    if (msg.includes("captcha")) return "La verificación de seguridad ha fallado o ha caducado. Vuelve a completarla e inténtalo de nuevo.";
    if (msg.includes("already registered") || msg.includes("already been registered")) return "No se ha podido crear la cuenta con ese email. Si ya tienes cuenta, entra o recupera la contraseña.";
    if (msg.includes("should be different") || msg.includes("same password")) return "La contraseña nueva debe ser distinta de la anterior.";
    if (msg.includes("password should be") || msg.includes("weak password")) return "La contraseña no cumple los requisitos.";
    if (msg.includes("invalid email") || msg.includes("unable to validate email")) return "Ese email no parece válido. Revísalo.";
    if (msg.includes("session") && (msg.includes("missing") || msg.includes("expired"))) return "La sesión ha caducado. Vuelve a entrar o pide un enlace nuevo.";
    if (msg.includes("jwt expired")) return "La sesión ha caducado. Vuelve a entrar.";
    if (msg.includes("failed to fetch") || msg.includes("network")) return "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.";
    if (error.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) return "No tienes permiso para hacer esto.";
    if (error.code === "23505" || msg.includes("duplicate key")) return "Eso ya existe.";
    return porDefecto;
  }
  window.traducirError = traducirError;
})();
