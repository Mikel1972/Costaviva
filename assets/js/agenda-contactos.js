// assets/js/agenda-contactos.js
// Dar de alta contactos de emergencia desde la agenda del teléfono
// (2026-10-08, pedido de Mikel: "cuando quiero dar de alta contactos,
// debiera poder acceder a la agenda directamente y que se carguen desde
// ahí"). Script clásico: deja window.AgendaContactos para alarma.html y los
// tests lo cargan con import() (test/agenda-contactos.test.js). Necesita
// assets/js/sos-whatsapp.js cargado antes (normalizarTelefono, E.164).
//
// Usa la Contact Picker API (navigator.contacts.select). Hoy solo existe en
// Chrome para Android (y navegadores Chromium de Android); iPhone/Safari y
// los navegadores de escritorio no la tienen, y ahí la página lo dice y deja
// el formulario a mano. Requisitos del navegador: contexto seguro (https),
// documento principal (no un iframe) y un gesto de la persona (un toque en
// el botón): no se puede abrir la agenda sola.
//
// Privacidad: la web no lee la agenda. El sistema abre su propio selector,
// la persona marca los contactos que quiere y solo esos (y solo nombre,
// email y teléfono) llegan a la página. Aquí solo se preparan las filas:
// nada se guarda hasta que la persona lo confirma, y solo el email y el
// WhatsApp que elija de cada contacto.
(function (raiz) {
  // Idiomas (2026-10-09): en inglés, assets/i18n/en.js; en español (y en
  // los tests sin I18n) el texto de aquí, idéntico a es.js (test/i18n.test.js).
  function tr(clave, es, vars) {
    var I = raiz.I18n;
    var s = I && I.idioma() !== "es" && I.existe(clave) ? I.t(clave) : es;
    return vars ? s.replace(/\{(\w+)\}/g, function (t, k) { return vars[k] === undefined ? t : String(vars[k]); }) : s;
  }

  var PROPIEDADES_DESEADAS = ["name", "email", "tel"];
  // Un email "con pinta de email": lo mismo que acepta <input type=email>,
  // sin pretender validar más (el servidor no lo exige más estricto).
  var PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_NOMBRE = 60; // maxlength del campo Nombre de alarma.html

  function sosWhatsapp() {
    var s = raiz.SosWhatsapp;
    if (!s || typeof s.normalizarTelefono !== "function") {
      throw new Error("agenda-contactos.js necesita sos-whatsapp.js cargado antes");
    }
    return s;
  }

  // ¿Se puede abrir la agenda en este navegador? entorno = { navigator,
  // window, isSecureContext } para poder probarlo sin navegador.
  function agendaDisponible(entorno) {
    var e = entorno || {};
    var nav = e.navigator;
    var win = e.window || {};
    if (!nav || !e.isSecureContext) return false;
    if (!("contacts" in nav) || !("ContactsManager" in win)) return false;
    return !!nav.contacts && typeof nav.contacts.select === "function";
  }

  // De las propiedades que soporta el teléfono (getProperties()), las que
  // pedimos. Sin "name" ni "email" ni "tel" no tiene sentido abrir la agenda.
  function propiedadesAPedir(soportadas) {
    var lista = Array.isArray(soportadas) ? soportadas : PROPIEDADES_DESEADAS;
    return PROPIEDADES_DESEADAS.filter(function (p) { return lista.indexOf(p) !== -1; });
  }

  function textos(valor) {
    if (valor == null) return [];
    var lista = Array.isArray(valor) ? valor : [valor];
    var vistos = {};
    var salida = [];
    lista.forEach(function (v) {
      var t = String(v == null ? "" : v).trim();
      if (!t) return;
      var clave = t.toLowerCase();
      if (vistos[clave]) return;
      vistos[clave] = true;
      salida.push(t);
    });
    return salida;
  }

  // Un contacto de la agenda ({ name: [], email: [], tel: [] }, cualquiera
  // puede faltar) -> fila para revisar antes de guardar:
  //   nombre: el primero no vacío (recortado a 60), o "" si no tiene.
  //   emails: los que tienen pinta de email, sin repetir (minúsculas).
  //   emailsDescartados: los que no.
  //   telefonos: [{ original, ok, e164, error }] sin repetir por E.164; los
  //     válidos primero y, entre ellos, los móviles antes que los fijos.
  //   email / whatsapp: lo que se marca por defecto (el primero de cada lista
  //     válida, o null).
  //   elegir: true si hay más de un email o más de un teléfono válido, para
  //     que la persona escoja.
  function contactoAFila(contacto, prefijoPais) {
    var s = sosWhatsapp();
    var c = contacto || {};
    var nombre = textos(c.name)[0] || "";
    if (nombre.length > MAX_NOMBRE) nombre = nombre.slice(0, MAX_NOMBRE).trim();

    var emails = [];
    var emailsDescartados = [];
    textos(c.email).forEach(function (e) {
      if (PATRON_EMAIL.test(e)) {
        var minus = e.toLowerCase();
        if (emails.indexOf(minus) === -1) emails.push(minus);
      } else {
        emailsDescartados.push(e);
      }
    });

    var validos = [];
    var invalidos = [];
    var vistos = {};
    textos(c.tel).forEach(function (t) {
      var r = s.normalizarTelefono(t, prefijoPais);
      if (r.ok) {
        if (vistos[r.e164]) return;
        vistos[r.e164] = true;
        validos.push({ original: t, ok: true, e164: r.e164, error: null });
      } else {
        invalidos.push({ original: t, ok: false, e164: null, error: r.error });
      }
    });
    // Orden estable: móviles españoles (o de otro país) antes que fijos +349/+348.
    validos.sort(function (a, b) {
      var pa = /^\+34[89]/.test(a.e164) ? 1 : 0;
      var pb = /^\+34[89]/.test(b.e164) ? 1 : 0;
      return pa - pb;
    });
    var telefonos = validos.concat(invalidos);

    return {
      nombre: nombre,
      emails: emails,
      emailsDescartados: emailsDescartados,
      telefonos: telefonos,
      email: emails[0] || null,
      whatsapp: validos.length ? validos[0].e164 : null,
      elegir: emails.length > 1 || validos.length > 1,
    };
  }

  function contactosAFilas(contactos, prefijoPais) {
    return (Array.isArray(contactos) ? contactos : []).map(function (c) {
      return contactoAFila(c, prefijoPais);
    });
  }

  // ¿Ya está en la lista? Mismo WhatsApp o mismo email que un contacto
  // guardado. Solo para avisar; no impide guardarlo.
  function yaGuardado(fila, guardados) {
    return (guardados || []).some(function (g) {
      if (!g) return false;
      if (fila.whatsapp && g.whatsapp === fila.whatsapp) return true;
      return !!(fila.email && g.email && String(g.email).toLowerCase() === fila.email);
    });
  }

  // Lo que la persona deja marcado en una fila -> fila de
  // contactos_emergencia, o el motivo por el que no se puede guardar.
  // eleccion = { nombre, email, whatsapp } (email/whatsapp null = ninguno).
  // Solo se aceptan un email y un WhatsApp que vinieran del contacto, para
  // que no se guarde nada que la persona no haya elegido de su agenda.
  function filaParaGuardar(fila, eleccion, userId) {
    var e = eleccion || {};
    var nombre = String(e.nombre == null ? fila.nombre : e.nombre).trim().slice(0, MAX_NOMBRE);
    var email = e.email === undefined ? fila.email : e.email;
    var whatsapp = e.whatsapp === undefined ? fila.whatsapp : e.whatsapp;
    if (email && fila.emails.indexOf(email) === -1) email = null;
    if (whatsapp && !fila.telefonos.some(function (t) { return t.ok && t.e164 === whatsapp; })) whatsapp = null;
    if (!nombre) return { ok: false, error: tr("alarma.escribe_nombre", "Escribe el nombre del contacto.") };
    if (!email && !whatsapp) {
      return {
        ok: false,
        error: fila.emails.length || fila.telefonos.some(function (t) { return t.ok; })
          ? tr("agenda.elige_uno", "Elige al menos un email o un WhatsApp.")
          : tr("agenda.no_valido", "Este contacto no tiene email ni un teléfono válido. Añádelo a mano."),
      };
    }
    var salida = { user_id: userId, nombre: nombre, email: email || null };
    if (whatsapp) salida.whatsapp = whatsapp;
    return { ok: true, fila: salida };
  }

  raiz.AgendaContactos = {
    PROPIEDADES_DESEADAS: PROPIEDADES_DESEADAS,
    agendaDisponible: agendaDisponible,
    propiedadesAPedir: propiedadesAPedir,
    contactoAFila: contactoAFila,
    contactosAFilas: contactosAFilas,
    yaGuardado: yaGuardado,
    filaParaGuardar: filaParaGuardar,
  };
})(typeof window !== "undefined" ? window : globalThis);
