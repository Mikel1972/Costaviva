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
  // Pasos del embudo (2026-11-26, functions/_lib/visitas.js): mismo envío,
  // con «paso». El referer es el de ESTA página (de dónde llegó la persona).
  const paso = (nombre) => {
    try {
      if (navigator.webdriver) return;
      const d = JSON.stringify({ paso: nombre, ruta: location.pathname + location.search, referer: document.referrer || "" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/contar-visita", new Blob([d], { type: "application/json" })))) {
        fetch("/contar-visita", { method: "POST", body: d, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* nunca rompe la página */ }
  };
  const hechos = new Set();
  window.cvPaso = (nombre) => { if (!hechos.has(nombre)) { hechos.add(nombre); paso(nombre); } };
  // Clic en «Empieza gratis» (o la cinta / la entrada) de una página pública.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/login?alta=1"], a[href^="/empieza"]');
    if (a && !location.pathname.startsWith("/login")) window.cvPaso("cta");
  }, true);
})();
