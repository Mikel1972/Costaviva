// scripts/marketing/campana-temporal.mjs — cinta y línea de texto de una
// campaña con fechas sobre los reels (2026-11-19, Mikel: "pon una cinta sobre
// el reel que lanzamos ya hoy"). Lógica pura: test/calendario-marketing.test.js.
// Black Friday 2x1: del 19 al 30/11/2026, según la FECHA DE PUBLICACIÓN.
export function campanaDe(fechaPublicacion) {
  const f = String(fechaPublicacion || "").slice(0, 10);
  if (f >= "2026-11-19" && f <= "2026-11-26") {
    return {
      cinta: "BLACK FRIDAY 2x1 · DEL 27 AL 30 NOV",
      texto: "🖤 Black Friday 2x1, del 27 al 30 de noviembre: paga el plan anual (34,99 €) con el código BLACKFRIDAY y regala otro año de Premium a tu compañero de pesca.",
    };
  }
  if (f >= "2026-11-27" && f <= "2026-11-30") {
    return {
      cinta: "BLACK FRIDAY 2x1 · CÓDIGO BLACKFRIDAY",
      texto: `🖤 Black Friday 2x1 ${f === "2026-11-30" ? "(¡último día!)" : "hasta el lunes 30"}: paga el plan anual (34,99 €) con el código BLACKFRIDAY y regala otro año de Premium a tu compañero de pesca. Él/ella se apunta gratis y sin tarjeta hasta el 31/12.`,
    };
  }
  return null;
}
