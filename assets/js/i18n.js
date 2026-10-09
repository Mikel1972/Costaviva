// assets/js/i18n.js
// Idiomas de la app (2026-10-09, base para abrir Nueva Zelanda en inglés).
// Ligero, sin dependencias: diccionarios planos en assets/i18n/es.js y
// assets/i18n/en.js (clave -> texto) y esta función t(clave, vars).
//
// Script clásico: deja window.I18n. Los módulos ES lo usan a través de
// assets/js/i18n-modulo.js (que importa los diccionarios y este fichero) y
// los tests lo cargan con import(). Ejecutarlo dos veces no hace nada.
//
// Qué idioma (el primero que haya):
//   1. el elegido en el selector de este navegador (localStorage, try/catch);
//   2. el del perfil (user_metadata.idioma de la sesión de Supabase, que se
//      lee de su propia entrada de localStorage sin esperar a la red);
//   3. el de la región (España, Portugal, Canarias: es; Nueva Zelanda: en),
//      de la última posición conocida o de la zona horaria del dispositivo;
//   4. navigator.languages (el primero que sea es o en);
//   5. español.
// En Node (tests) no hay document: siempre español salvo que se fije a mano.
//
// En la página:
//   - texto fijo del HTML: data-i18n="clave" (textContent),
//     data-i18n-html="clave" (innerHTML, solo textos nuestros),
//     data-i18n-title / -aria-label / -placeholder / -alt (atributos).
//     El HTML conserva el texto en español: en español no se toca nada.
//   - texto que pinta el JS: I18n.t("clave", { n: 3, nombre: "..." }).
//   - números y unidades: I18n.num, I18n.temp, I18n.metros, I18n.velocidad,
//     I18n.fecha, I18n.locale().
// Nada de on*= (CSP con nonce): el selector usa addEventListener.
(function (raiz) {
  if (raiz.I18n && raiz.I18n.__costaviva) return;

  var IDIOMAS = ["es", "en"];
  var NOMBRES = { es: "Español", en: "English" };
  var LOCALES = { es: "es-ES", en: "en-NZ" };
  var CLAVE_LS = "costaviva.idioma";
  var CLAVE_SESION = "sb-imncbmizxkorotpeisic-auth-token";
  var ATRIBUTOS = ["title", "aria-label", "placeholder", "alt"];
  var hayDom = typeof document !== "undefined" && !!document.documentElement;

  function textos() {
    return raiz.I18N_TEXTOS || {};
  }
  function normaliza(x) {
    var c = String(x || "").toLowerCase().slice(0, 2);
    return IDIOMAS.indexOf(c) >= 0 ? c : null;
  }
  function almacen() {
    try { return raiz.localStorage || null; } catch (e) { return null; }
  }
  function guardado() {
    try { var a = almacen(); return a ? normaliza(a.getItem(CLAVE_LS)) : null; } catch (e) { return null; }
  }
  function dePerfil() {
    try {
      var a = almacen();
      var s = a && a.getItem(CLAVE_SESION);
      if (!s) return null;
      var o = JSON.parse(s);
      var u = o && (o.user || (o.currentSession && o.currentSession.user));
      return normaliza(u && u.user_metadata && u.user_metadata.idioma);
    } catch (e) { return null; }
  }
  function deNavegador() {
    if (!hayDom || !raiz.navigator) return null;
    var lista = raiz.navigator.languages && raiz.navigator.languages.length ? raiz.navigator.languages : [raiz.navigator.language];
    for (var i = 0; i < lista.length; i++) {
      var c = normaliza(lista[i]);
      if (c) return c;
    }
    return null;
  }
  // ---- Región (2026-10-09, decisión de Mikel) ---------------------------
  // Sin idioma elegido a mano ni en el perfil, manda la REGIÓN: España,
  // Portugal y Canarias en español; Nueva Zelanda en inglés. Así un español
  // con el móvil en inglés sigue viendo la app en español. El idioma de cada
  // región es el de assets/js/regiones.js (REGIONES[id].idioma; el test
  // comprueba que estas tablas no se separan de allí).
  // La región sale, por orden: de la última que conoció la app en este
  // navegador (spot abierto o ubicación del usuario, I18n.recordarPosicion)
  // y, si no, de la zona horaria del dispositivo. Sin región conocida, el
  // idioma del navegador.
  var CLAVE_REGION = "costaviva.region";
  var IDIOMA_POR_REGION = {
    cantabrico: "es", atlantico_norte: "es", golfo_cadiz: "es", mediterraneo: "es", baleares: "es",
    canarias: "es", portugal: "es", azores: "es", madeira: "es", nueva_zelanda: "en",
  };
  // Zona horaria del DISPOSITIVO -> región, solo para elegir idioma (no para
  // calcular horas): "Europe/Madrid" aquí va a propósito.
  var REGION_POR_ZONA = {
    "Europe/Madrid": "cantabrico", "Africa/Ceuta": "mediterraneo", "Atlantic/Canary": "canarias",
    "Europe/Lisbon": "portugal", "Atlantic/Azores": "azores", "Atlantic/Madeira": "madeira",
    "Pacific/Auckland": "nueva_zelanda", "Pacific/Chatham": "nueva_zelanda",
  };
  function regionGuardada() {
    try {
      var a = almacen();
      var r = a ? a.getItem(CLAVE_REGION) : null;
      return r && IDIOMA_POR_REGION[r] ? r : null;
    } catch (e) { return null; }
  }
  function zonaDispositivo() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  }
  // Exportada para el test: región conocida a partir de lo guardado y de la zona.
  function regionInicial(o) {
    o = o || {};
    if (o.guardada && IDIOMA_POR_REGION[o.guardada]) return o.guardada;
    return REGION_POR_ZONA[o.zona] || null;
  }
  function idiomaDeRegion(id) {
    return IDIOMA_POR_REGION[id] || null;
  }

  // Exportada para el test: el orden de preferencia, sin tocar nada.
  //   elegido a mano > perfil > región > navegador > español
  function elegirIdioma(o) {
    o = o || {};
    return normaliza(o.guardado) || normaliza(o.perfil) || idiomaDeRegion(o.region) || normaliza(o.navegador) || "es";
  }

  var actual = hayDom
    ? elegirIdioma({
      guardado: guardado(), perfil: dePerfil(),
      region: regionInicial({ guardada: regionGuardada(), zona: zonaDispositivo() }),
      navegador: deNavegador(),
    })
    : "es";

  // La app avisa de dónde está el usuario (spot abierto, GPS): se recuerda la
  // región para la próxima vez que se abra (no cambia el idioma en marcha).
  function recordarRegion(id) {
    if (!IDIOMA_POR_REGION[id]) return;
    try { var a = almacen(); if (a) a.setItem(CLAVE_REGION, id); } catch (e) { /* nada */ }
  }
  function recordarPosicion(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return;
    var con = function (R) { if (R && R.regionPorCoordenadas) recordarRegion(R.regionPorCoordenadas(Number(lat), Number(lon))); };
    if (raiz.Regiones) { con(raiz.Regiones); return; }
    try { import("/assets/js/regiones.js").then(con, function () {}); } catch (e) { /* nada */ }
  }

  function plural(v, n, idioma) {
    if (n === 0 && v.zero !== undefined) return v.zero;
    var cat = "other";
    try { cat = new Intl.PluralRules(LOCALES[idioma] || idioma).select(n); } catch (e) { cat = n === 1 ? "one" : "other"; }
    return v[cat] !== undefined ? v[cat] : v.other;
  }
  function interpola(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (todo, k) {
      return vars[k] === undefined || vars[k] === null ? todo : String(vars[k]);
    });
  }
  // t("clave", { n, ... }, idioma?). Sin traducción en el idioma, la de
  // español; sin ninguna, la propia clave (se ve y el test la caza).
  function t(clave, vars, idioma) {
    var id = normaliza(idioma) || actual;
    var todos = textos();
    var v = (todos[id] || {})[clave];
    if (v === undefined && id !== "es") v = (todos.es || {})[clave];
    if (v === undefined) return clave;
    if (v && typeof v === "object") {
      var n = vars && typeof vars.n === "number" ? vars.n : NaN;
      v = plural(v, n, id);
    }
    return interpola(String(v), vars);
  }
  // Textos que vienen de los datos (especies.json, normativa...): en inglés,
  // obj[campo + "_en"] si existe; si no, el de siempre. Así la fase de datos
  // de cada región solo tiene que añadir "texto_en", "nota_en"... Para los
  // nombres de especie: I18n.nombre(especie) -> especie.nombres[idioma].
  function dato(obj, campo, idioma) {
    if (!obj) return obj;
    var id = normaliza(idioma) || actual;
    if (id !== "es") {
      var v = obj[campo + "_" + id];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return obj[campo];
  }
  function nombre(especie, idioma) {
    var n = especie && especie.nombres;
    if (!n) return especie && especie.nombre;
    var id = normaliza(idioma) || actual;
    return n[id] || n.es;
  }
  function existe(clave, idioma) {
    return (textos()[normaliza(idioma) || actual] || {})[clave] !== undefined;
  }

  // ---- Números, fechas y unidades -------------------------------------
  // num(1.25, 1) -> "1,3" en español, "1.3" en inglés. Sin decimales
  // fijos, como String(+x.toFixed(1)) (sin ceros de sobra).
  function num(x, decimales, idioma) {
    if (x === null || x === undefined || Number.isNaN(Number(x))) return "";
    var s = decimales === undefined ? String(+Number(x).toFixed(1)) : Number(x).toFixed(decimales);
    return (normaliza(idioma) || actual) === "es" ? s.replace(".", ",") : s;
  }
  // Un número ya escrito con punto ("0.3", "12.5"): coma en español.
  function decimal(texto, idioma) {
    var s = String(texto == null ? "" : texto);
    return (normaliza(idioma) || actual) === "es" ? s.replace(".", ",") : s;
  }
  function temp(c, decimales, idioma) {
    return num(c, decimales === undefined ? 1 : decimales, idioma) + " °C";
  }
  function metros(m, decimales, idioma) {
    return num(m, decimales, idioma) + " m";
  }
  // Viento: km/h por defecto; nudos si se pide (1 kn = 1,852 km/h).
  function velocidad(kmh, unidad, idioma) {
    if (kmh === null || kmh === undefined || Number.isNaN(Number(kmh))) return "";
    if (unidad === "nudos" || unidad === "kn") {
      var id = normaliza(idioma) || actual;
      return Math.round(kmh / 1.852) + (id === "es" ? " nudos" : " kn");
    }
    return Math.round(kmh) + " km/h";
  }
  // ["ene", "feb", ...] / ["Jan", "Feb", ...] (comun.meses_cortos del diccionario).
  function mesesCortos(idioma) {
    return t("comun.meses_cortos", null, idioma).split(",");
  }
  function locale(idioma) {
    return LOCALES[normaliza(idioma) || actual];
  }
  function fecha(d, opciones, idioma) {
    return new Date(d).toLocaleDateString(locale(idioma), opciones);
  }
  function hora(d, opciones, idioma) {
    return new Date(d).toLocaleTimeString(locale(idioma), opciones || { hour: "2-digit", minute: "2-digit" });
  }

  // ---- HTML fijo -------------------------------------------------------
  function limpio(s) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  }
  function textoDeHtml(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    return limpio(tpl.content.textContent);
  }
  // Solo cambia lo que sigue en español tal cual está en el HTML: si el JS
  // ya ha puesto otro texto (p. ej. "actualizado a las..."), no se pisa.
  function aplicar(contenedor) {
    if (!hayDom || actual === "es") return;
    var raizDom = contenedor || document;
    var es = textos().es || {};
    var sel = "[data-i18n],[data-i18n-html]," + ATRIBUTOS.map(function (a) { return "[data-i18n-" + a + "]"; }).join(",");
    var lista = Array.prototype.slice.call(raizDom.querySelectorAll(sel));
    if (raizDom.matches && raizDom.matches(sel)) lista.unshift(raizDom);
    lista.forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (k && es[k] !== undefined && limpio(el.textContent) === limpio(es[k])) el.textContent = t(k);
      k = el.getAttribute("data-i18n-html");
      if (k && es[k] !== undefined && limpio(el.textContent) === textoDeHtml(es[k])) el.innerHTML = t(k);
      ATRIBUTOS.forEach(function (a) {
        var ka = el.getAttribute("data-i18n-" + a);
        if (ka && es[ka] !== undefined && el.getAttribute(a) === es[ka]) el.setAttribute(a, t(ka));
      });
    });
  }

  // ---- Selector de idioma (menú de cuenta) ------------------------------
  function guardar(idioma) {
    var id = normaliza(idioma);
    if (!id) return false;
    try { var a = almacen(); if (a) a.setItem(CLAVE_LS, id); } catch (e) { /* sin almacenamiento */ }
    return true;
  }
  function cambiar(idioma) {
    var id = normaliza(idioma);
    if (!id) return;
    guardar(id);
    // Al perfil también, para que un móvil nuevo empiece en su idioma. Si
    // falla (sin sesión, sin red), se queda en este navegador y basta.
    var hecho = Promise.resolve();
    try {
      var cliente = raiz.supabaseCliente;
      if (cliente && cliente.auth && cliente.auth.updateUser) {
        hecho = cliente.auth.updateUser({ data: { idioma: id } }).catch(function () {});
      }
    } catch (e) { /* nada */ }
    var recargar = function () { try { raiz.location.reload(); } catch (e) { /* nada */ } };
    var plazo = new Promise(function (ok) { setTimeout(ok, 1500); });
    Promise.race([hecho, plazo]).then(recargar, recargar);
  }
  // Estilo del selector aquí y no en costaviva.css: esa hoja se copia en
  // línea en las páginas públicas (functions/_lib/seo/estilos.js) y el
  // selector solo existe en la app.
  var CSS_SELECTOR = ".i18n-selector{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;padding:8px 12px 6px;border-top:1px solid var(--linea,#EBD9CC);font-size:13px;font-weight:600;color:var(--tinta-2,#5A4E6B)}"
    + ".i18n-selector__etq{white-space:nowrap}.i18n-selector__opciones{display:flex;gap:4px}"
    + ".i18n-selector .i18n-selector__opcion{display:inline-flex;width:auto;padding:6px 10px;font-size:13px;font-weight:700;border:1px solid var(--linea,#EBD9CC);border-radius:999px;background:none;color:var(--tinta,#1A1533);cursor:pointer}"
    + ".i18n-selector .i18n-selector__opcion[aria-pressed=\"true\"]{background:var(--mar,#0B1E3F);border-color:var(--mar,#0B1E3F);color:var(--blanco,#fff)}";
  function estiloSelector() {
    if (document.getElementById("i18n-estilo-selector")) return;
    var st = document.createElement("style");
    st.id = "i18n-estilo-selector";
    st.textContent = CSS_SELECTOR;
    (document.head || document.documentElement).appendChild(st);
  }
  function montarSelector(contenedor) {
    if (!contenedor || contenedor.getAttribute("data-i18n-montado")) return;
    estiloSelector();
    contenedor.setAttribute("data-i18n-montado", "1");
    contenedor.classList.add("i18n-selector");
    contenedor.setAttribute("role", "group");
    contenedor.setAttribute("aria-label", t("comun.idioma.etiqueta"));
    var etq = document.createElement("span");
    etq.className = "i18n-selector__etq";
    etq.textContent = "🌐 " + t("comun.idioma.etiqueta");
    contenedor.appendChild(etq);
    var fila = document.createElement("span");
    fila.className = "i18n-selector__opciones";
    IDIOMAS.forEach(function (id) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "i18n-selector__opcion";
      b.setAttribute("lang", id);
      b.setAttribute("aria-pressed", id === actual ? "true" : "false");
      b.textContent = NOMBRES[id];
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (id !== actual) cambiar(id);
      });
      fila.appendChild(b);
    });
    contenedor.appendChild(fila);
  }

  // ---- Arranque en la página --------------------------------------------
  // En inglés, el cuerpo se oculta hasta traducir el HTML fijo (sin destello
  // de español). La pantalla de inicio se traduce antes con
  // I18n.aplicarInicio() justo después de su HTML, y se deja ver.
  function aplicarInicio(id) {
    if (!hayDom || actual === "es") return;
    aplicar(document.getElementById(id || "comprobandoAcceso"));
    document.documentElement.classList.add("i18n-inicio");
  }
  function alCargar() {
    aplicar(document);
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-selector]"), montarSelector);
    document.documentElement.classList.remove("i18n-pendiente");
  }
  if (hayDom) {
    document.documentElement.setAttribute("lang", actual);
    if (actual !== "es") {
      document.documentElement.classList.add("i18n-pendiente");
      try {
        var estilo = document.createElement("style");
        estilo.textContent = "html.i18n-pendiente body{visibility:hidden}html.i18n-pendiente.i18n-inicio #comprobandoAcceso{visibility:visible}";
        (document.head || document.documentElement).appendChild(estilo);
      } catch (e) { /* nada */ }
      // Por si algo falla: nunca más de 3 s con la página oculta.
      setTimeout(function () { document.documentElement.classList.remove("i18n-pendiente"); }, 3000);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", alCargar);
    else alCargar();
  }

  raiz.I18n = {
    __costaviva: true,
    IDIOMAS: IDIOMAS,
    NOMBRES: NOMBRES,
    CLAVE_LS: CLAVE_LS,
    idioma: function () { return actual; },
    // Solo para tests y herramientas: no guarda nada.
    fijarIdioma: function (id) { actual = normaliza(id) || "es"; return actual; },
    elegirIdioma: elegirIdioma,
    regionInicial: regionInicial,
    idiomaDeRegion: idiomaDeRegion,
    IDIOMA_POR_REGION: IDIOMA_POR_REGION,
    REGION_POR_ZONA: REGION_POR_ZONA,
    recordarRegion: recordarRegion,
    recordarPosicion: recordarPosicion,
    t: t,
    existe: existe,
    dato: dato,
    nombre: nombre,
    num: num,
    decimal: decimal,
    temp: temp,
    metros: metros,
    velocidad: velocidad,
    locale: locale,
    mesesCortos: mesesCortos,
    fecha: fecha,
    hora: hora,
    aplicar: aplicar,
    aplicarInicio: aplicarInicio,
    montarSelector: montarSelector,
    cambiar: cambiar,
    guardar: guardar,
  };
})(typeof window !== "undefined" ? window : globalThis);
