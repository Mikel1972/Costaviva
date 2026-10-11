// assets/js/consentimiento.js
// Cláusula de aceptación antes de pagar Premium (decisión de Mikel,
// 2026-10-11: "el anual no se reembolsa, se pierde todo el año").
//
// Vía legal: suministro de contenido digital sin soporte material con
// ejecución inmediata, con consentimiento previo y expreso del consumidor y
// reconocimiento de que pierde el desistimiento (art. 103.m TRLGDCU; art.
// 16.m de la Directiva 2011/83/UE). La cláusula NO excluye las devoluciones
// que imponga la ley (servicio no prestado o defectuoso): ver terminos.html.
//
// Fuente única del texto: la casilla de suscripcion.html, el texto del
// checkout de Stripe (crear-checkout-stripe.js), el email de confirmación
// del webhook y los tests leen de aquí. Si cambia el texto, sube VERSION:
// cada aceptación se guarda con la versión que se aceptó.
//
// Módulo ES puro, sin dependencias.

export const VERSION = "2026-10-11";

export const IDIOMAS = Object.freeze(["es", "en", "pt"]);

export const TEXTOS = Object.freeze({
  es: {
    anual: "Solicito el acceso inmediato a Premium y acepto que, al empezar, pierdo mi derecho de desistimiento. El plan anual no se reembolsa: si cancelas, sigue activo hasta el final del periodo pagado y no se renueva.",
    mensual: "Solicito el acceso inmediato a Premium y acepto que, al empezar, pierdo mi derecho de desistimiento. El mes pagado no se reembolsa: si cancelas, sigue activo hasta el final del mes pagado y no se renueva.",
  },
  en: {
    anual: "I request immediate access to Premium and accept that, once it starts, I lose my right of withdrawal. The annual plan is non-refundable: if you cancel, it stays active until the end of the paid period and does not renew.",
    mensual: "I request immediate access to Premium and accept that, once it starts, I lose my right of withdrawal. The paid month is non-refundable: if you cancel, it stays active until the end of the paid month and does not renew.",
  },
  pt: {
    anual: "Solicito o acesso imediato ao Premium e aceito que, ao começar, perco o meu direito de livre resolução. O plano anual não é reembolsável: se cancelares, continua ativo até ao fim do período pago e não se renova.",
    mensual: "Solicito o acesso imediato ao Premium e aceito que, ao começar, perco o meu direito de livre resolução. O mês pago não é reembolsável: se cancelares, continua ativo até ao fim do mês pago e não se renova.",
  },
});

// Compromiso si Costaviva deja de prestar el servicio (añadido de Mikel,
// 2026-10-11): va junto a la casilla y en el email de confirmación.
export const SI_CERRAMOS = Object.freeze({
  es: "Si dejamos de prestar el servicio, te devolveremos la parte proporcional del periodo no disfrutado.",
  en: "If we stop providing the service, we will refund the proportional part of the period not used.",
  pt: "Se deixarmos de prestar o serviço, devolvemos-te a parte proporcional do período não usufruído.",
});

export function textoSiCerramos(idioma = "es") {
  return SI_CERRAMOS[IDIOMAS.includes(idioma) ? idioma : "es"];
}

// Plan de precios -> texto: el fundador es anual.
export function tipoDePlan(plan) {
  return plan === "mensual" ? "mensual" : "anual";
}

export function textoAceptacion(plan, idioma = "es") {
  const t = TEXTOS[IDIOMAS.includes(idioma) ? idioma : "es"];
  return t[tipoDePlan(plan)];
}

// Idioma del texto legal: el de la app (es/en/pt) y, con la app en español,
// portugués si el navegador lo pide.
export function idiomaAceptacion(idiomaApp, idiomasNavegador = []) {
  if (idiomaApp === "en" || idiomaApp === "pt") return idiomaApp;
  if ((idiomasNavegador[0] || "").toLowerCase().startsWith("pt")) return "pt";
  return "es";
}
