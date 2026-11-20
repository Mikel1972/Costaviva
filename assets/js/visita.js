// assets/js/visita.js — cuenta UNA visita a la página pública cuando se carga
// en un navegador de verdad (2026-11-20). Manda solo la ruta y de dónde
// viene (document.referrer); el servidor lo reduce a página, fuente y
// campaña de listas cerradas (functions/_lib/visitas.js). Sin cookies, sin
// identificadores. Los navegadores automatizados (navigator.webdriver) no
// cuentan.
(() => {
  try {
    if (navigator.webdriver) return;
    const datos = JSON.stringify({ ruta: location.pathname + location.search, referer: document.referrer || "" });
    const enviado = navigator.sendBeacon && navigator.sendBeacon("/contar-visita", new Blob([datos], { type: "application/json" }));
    if (!enviado) fetch("/contar-visita", { method: "POST", body: datos, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch (e) {
    // El contador nunca rompe la página.
  }
})();
