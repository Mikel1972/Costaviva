// assets/js/meteo.js
// Única forma en que el navegador pide datos meteorológicos (2026-10-08).
//
// El navegador NUNCA habla con open-meteo.com ni con las otras fuentes: pide
// a nuestro proxy /meteo/<api> (functions/meteo/[api].js), que valida la
// consulta, la cachea en el edge y la sirve desde Open-Meteo (con la API key
// comercial si existe) o, si se activan los interruptores FUENTE_*, desde MET
// Norway / Copernicus Marine con la misma forma (functions/_lib/fuentes.js).
//
// Uso: pedirMeteo("marine", "latitude=43.4&longitude=-2.7&hourly=wave_height")
//      -> Promise con el JSON en formato Open-Meteo (igual que antes).
// APIs admitidas: "forecast" y "marine", UNA coordenada por petición. Si
// necesitas otra variable o parámetro, añádelo a PROXY_PERMITIDO en
// functions/_lib/open-meteo.js o el proxy devolverá 400.
//
// ATRIBUCIÓN: cada respuesta trae `fuentes_datos` (y /prevision trae
// `fuentesDatos`). registrarFuentesMeteo() junta las fuentes vistas y
// reescribe todos los elementos .atribucion-meteo y el texto del mapa, para
// que siempre se cite lo que de verdad se pinta (CC BY 4.0 de Open-Meteo y
// MET Norway; cláusula 2.4 de la licencia de Copernicus Marine). Los textos
// son los de functions/_lib/fuentes.js (ATRIBUCIONES_HTML): si cambias uno,
// cambia el otro (test/fuentes-gratuitas.test.js lo comprueba).
(function () {
  var CC_BY = '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  var ATRIBUCIONES = {
    openmeteo: 'Datos meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (' + CC_BY + ')',
    metno: 'Datos meteorológicos: <a href="https://www.met.no/en" target="_blank" rel="noopener">MET Norway</a> (' + CC_BY + ', adaptados)',
    copernicus: 'Datos de mar: <a href="https://marine.copernicus.eu/" target="_blank" rel="noopener">Generated using E.U. Copernicus Marine Service Information</a>; ' +
      '<a href="https://doi.org/10.48670/moi-00025" target="_blank" rel="noopener">10.48670/moi-00025</a>, ' +
      '<a href="https://doi.org/10.48670/moi-00027" target="_blank" rel="noopener">10.48670/moi-00027</a>',
  };
  var ORDEN = ["openmeteo", "metno", "copernicus"];
  // Hasta que llegue la primera respuesta se cita Open-Meteo, la fuente por
  // defecto (el HTML ya lo trae escrito así).
  var vistas = { openmeteo: true };
  var vistasReales = false;

  function htmlAtribucion() {
    return ORDEN.filter(function (f) { return vistas[f]; })
      .map(function (f) { return ATRIBUCIONES[f]; })
      .join(" · ");
  }

  function registrarFuentesMeteo(lista) {
    if (!lista || !lista.length) return;
    var antes = htmlAtribucion();
    if (!vistasReales) { vistas = {}; vistasReales = true; }
    lista.forEach(function (f) { if (ATRIBUCIONES[f]) vistas[f] = true; });
    var ahora = htmlAtribucion();
    if (!ahora) { vistas = { openmeteo: true }; ahora = htmlAtribucion(); }
    window.ATRIBUCION_METEO_HTML = ahora;
    if (ahora === antes) return;
    var nodos = document.querySelectorAll(".atribucion-meteo");
    for (var i = 0; i < nodos.length; i++) nodos[i].innerHTML = ahora;
    window.dispatchEvent(new CustomEvent("meteo-atribucion", { detail: { antes: antes, ahora: ahora } }));
  }

  function urlMeteo(api, consulta) {
    return "/meteo/" + api + "?" + String(consulta || "").replace(/^\?/, "");
  }
  function pedirMeteo(api, consulta) {
    return fetch(urlMeteo(api, consulta)).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.fuentes_datos) registrarFuentesMeteo(d.fuentes_datos);
      return d;
    });
  }
  window.urlMeteo = urlMeteo;
  window.pedirMeteo = pedirMeteo;
  window.registrarFuentesMeteo = registrarFuentesMeteo;
  window.ATRIBUCIONES_METEO_HTML = ATRIBUCIONES;
  // Texto y enlace de la atribución obligatoria, para reutilizar.
  window.ATRIBUCION_METEO_HTML = htmlAtribucion();
})();
