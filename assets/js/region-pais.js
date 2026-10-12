// assets/js/region-pais.js
// Lo que cambia por país en el SOS y en el alta (fase 2 de NZ, 2026-10-09):
// número de emergencias (112 en España y Portugal, 111 en Nueva Zelanda),
// prefijo de los teléfonos escritos sin + (34 / 351 / 64) y forma del
// código postal (5 cifras en España; 4 en Nueva Zelanda y en Portugal, donde
// se piden las 4 primeras del CP4-CP3, desde el 2026-10-11). Script clásico: deja window.RegionPais para
// alarma.html y login.html; los tests lo cargan con import().
//
// La región es la de assets/js/regiones.js (ids "nueva_zelanda", "cantabrico"...)
// o las de pesca de MPI ("nz_auckland_kermadec"...). La que conoce la app
// en este navegador la da I18n.region() (último spot o GPS; si no, la zona
// horaria del dispositivo). Sin región conocida, España: nunca cambia nada
// para quien ya usaba la app.
(function (raiz) {
  function esNZ(region) {
    var r = String(region || "");
    return r === "nueva_zelanda" || r === "nz" || r.indexOf("nz_") === 0;
  }

  // Portugal continental, Azores y Madeira (regiones de assets/js/regiones.js).
  function esPT(region) {
    var r = String(region || "");
    return r === "portugal" || r === "azores" || r === "madeira" || r === "pt";
  }

  function regionActual() {
    try { return raiz.I18n && raiz.I18n.region ? raiz.I18n.region() : null; } catch (e) { return null; }
  }

  // Región de un punto, si regiones.js ya está cargado (window.Regiones).
  function regionDePosicion(lat, lon) {
    var R = raiz.Regiones;
    if (!R || !R.regionPorCoordenadas || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return R.regionPorCoordenadas(lat, lon);
  }

  function numeroEmergencia(region) { return esNZ(region) ? "111" : "112"; }
  function prefijoTelefono(region) { return esNZ(region) ? "64" : esPT(region) ? "351" : "34"; }
  function patronCodigoPostal(region) { return esNZ(region) || esPT(region) ? /^[0-9]{4}$/ : /^[0-9]{5}$/; }
  function cifrasCodigoPostal(region) { return esNZ(region) || esPT(region) ? 4 : 5; }
  function codigoPostalValido(cp, region) { return patronCodigoPostal(region).test(String(cp == null ? "" : cp).trim()); }

  raiz.RegionPais = {
    esNZ: esNZ,
    esPT: esPT,
    regionActual: regionActual,
    regionDePosicion: regionDePosicion,
    numeroEmergencia: numeroEmergencia,
    prefijoTelefono: prefijoTelefono,
    patronCodigoPostal: patronCodigoPostal,
    cifrasCodigoPostal: cifrasCodigoPostal,
    codigoPostalValido: codigoPostalValido,
  };
})(typeof window !== "undefined" ? window : globalThis);
