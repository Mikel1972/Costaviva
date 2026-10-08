// assets/js/meteo.js
// Única forma en que el navegador pide datos de Open-Meteo (2026-10-08).
//
// El navegador NUNCA habla con open-meteo.com: pide a nuestro proxy
// /meteo/<api> (functions/meteo/[api].js), que valida la consulta, la cachea
// en el edge y la reenvía con la API key comercial si existe (la key vive solo
// en el servidor). Motivo: Costaviva tiene suscripciones, y la API gratuita de
// Open-Meteo es solo para uso no comercial.
//
// Uso: pedirMeteo("marine", "latitude=43.4&longitude=-2.7&hourly=wave_height")
//      -> Promise con el JSON de Open-Meteo (igual que antes).
// APIs admitidas: "forecast" y "marine", UNA coordenada por petición. Si
// necesitas otra variable o parámetro, añádelo a PROXY_PERMITIDO en
// functions/_lib/open-meteo.js o el proxy devolverá 400.
(function () {
  function urlMeteo(api, consulta) {
    return "/meteo/" + api + "?" + String(consulta || "").replace(/^\?/, "");
  }
  function pedirMeteo(api, consulta) {
    return fetch(urlMeteo(api, consulta)).then(function (r) { return r.json(); });
  }
  window.urlMeteo = urlMeteo;
  window.pedirMeteo = pedirMeteo;
  // Texto y enlace de la atribución CC BY 4.0 (obligatoria) para reutilizar.
  window.ATRIBUCION_METEO_HTML =
    'Datos meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> ' +
    '(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)';
})();
