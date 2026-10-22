// assets/js/hoja-condiciones.js
// Hoja de condiciones del alta (2026-10-22, diseño aprobado por Mikel).
//
// login.html enseña la hoja (protección de datos, estadísticas anónimas,
// condiciones de pago, datos de terceros) antes de crear la cuenta; sin
// marcar "He leído y acepto" no se pide el enlace del alta. La aceptación
// viaja en el metadato del alta (options.data de signInWithOtp): queda en
// auth.users.raw_user_meta_data con su versión, fecha e idioma, sin SQL nuevo.
//
// Las estadísticas anónimas ya no son una casilla opcional: van por interés
// legítimo (art. 6.1.f RGPD) con derecho de oposición en suscripcion.html
// ("Tus datos", RPC fijar_uso_capturas_estadisticas). Por eso el alta manda
// consiente_uso_datos_capturas = true y el trigger gestionar_alta_perfil()
// lo copia a perfiles, como siempre; oponerse lo pone a false.
//
// Si cambia el texto de la hoja (es.js/en.js/pt.js, claves hoja.*), sube
// VERSION_HOJA. Módulo ES puro, sin dependencias.

export const VERSION_HOJA = "2026-10-22";

export function metadatosAceptacion(fecha = new Date(), idioma = "es") {
  return {
    condiciones_alta_version: VERSION_HOJA,
    condiciones_alta_aceptadas_en: new Date(fecha).toISOString(),
    condiciones_alta_idioma: ["es", "en", "pt"].includes(idioma) ? idioma : "es",
    // Interés legítimo: activado por defecto, el usuario puede oponerse.
    consiente_uso_datos_capturas: true,
  };
}
