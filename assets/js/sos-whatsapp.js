// assets/js/sos-whatsapp.js
// Lista de WhatsApp de emergencia de la alarma (2026-10-08, pedido de Mikel:
// "En las alarmas, también debiera haber una lista prefijada para los
// WhatsApp"). Script clásico: deja window.SosWhatsapp para alarma.html y los
// tests lo cargan con import() (test/sos-whatsapp.test.js).
//
// Coste cero a propósito: NO usa la API de WhatsApp Business (de pago y con
// aprobación de Meta). Usa los enlaces "click to chat" de WhatsApp
// (https://wa.me/<número>?text=<mensaje>), que abren WhatsApp con el mensaje
// ya escrito para ese contacto. El envío lo hace la persona pulsando "Enviar":
// una web no puede mandar un WhatsApp sola, y la pantalla lo dice así. El
// email del SOS sigue saliendo solo, como antes (functions/sos-alerta.js).
//
// Los grupos no tienen número: wa.me no puede apuntar a un grupo. Para ellos
// se comparte el mismo texto con la hoja de compartir del sistema
// (navigator.share) y, si no existe, con wa.me sin número, que deja elegir
// el chat o el grupo dentro de WhatsApp.
(function (raiz) {
  // Idiomas (2026-10-09): en inglés, assets/i18n/en.js; en español (y en
  // los tests sin I18n) el texto de aquí, idéntico a es.js (test/i18n.test.js).
  function tr(clave, es, vars) {
    var I = raiz.I18n;
    var s = I && I.idioma() !== "es" && I.existe(clave) ? I.t(clave) : es;
    return vars ? s.replace(/\{(\w+)\}/g, function (t, k) { return vars[k] === undefined ? t : String(vars[k]); }) : s;
  }

  // E.164: "+", prefijo de país (no empieza por 0) y hasta 15 cifras en total.
  // La misma expresión va en el CHECK de la migración
  // 20261008200000_contactos_whatsapp.sql (el test lo comprueba).
  var PATRON_E164 = /^\+[1-9][0-9]{7,14}$/;

  function esE164(valor) {
    return typeof valor === "string" && PATRON_E164.test(valor);
  }

  // Convierte lo que escribe la persona en E.164. Sin prefijo se entiende
  // España (+34), que es donde está casi todo el mundo que usa la app.
  // Devuelve { ok: true, e164 } o { ok: false, error } con un texto que se
  // puede enseñar tal cual.
  function normalizarTelefono(entrada, prefijoPais) {
    var prefijo = String(prefijoPais || "34").replace(/\D/g, "");
    var texto = String(entrada == null ? "" : entrada).trim();
    if (!texto) return { ok: false, error: tr("sos.tel_vacio", "Escribe un número de teléfono.") };
    if (/[a-z]/i.test(texto)) return { ok: false, error: tr("sos.tel_letras", "El teléfono solo puede llevar números (y el + del prefijo).") };
    var limpio = texto.replace(/[\s.\-()\/]/g, "");
    if (/[^\d+]/.test(limpio) || limpio.lastIndexOf("+") > 0) {
      return { ok: false, error: tr("sos.tel_letras", "El teléfono solo puede llevar números (y el + del prefijo).") };
    }
    if (limpio.indexOf("00") === 0) limpio = "+" + limpio.slice(2);
    var e164;
    if (limpio.charAt(0) === "+") {
      e164 = limpio;
    } else if (prefijo === "34" && /^34[6789]\d{8}$/.test(limpio)) {
      // "34612345678": prefijo español escrito sin el +.
      e164 = "+" + limpio;
    } else if (prefijo === "34" && /^\d{9}$/.test(limpio)) {
      e164 = "+34" + limpio;
    } else if (prefijo !== "34" && /^\d{6,12}$/.test(limpio)) {
      e164 = "+" + prefijo + limpio.replace(/^0+/, "");
    } else {
      return { ok: false, error: tr("sos.tel_incompleto", "Número incompleto. Si no es de España, escríbelo con su prefijo (por ejemplo +33…).") };
    }
    if (e164.indexOf("+34") === 0 && !/^\+34[6789]\d{8}$/.test(e164)) {
      return { ok: false, error: tr("sos.tel_espana", "Un teléfono de España tiene 9 cifras y empieza por 6, 7, 8 o 9.") };
    }
    if (!esE164(e164)) {
      return { ok: false, error: tr("sos.tel_invalido", "Ese número no parece válido. Revisa el prefijo del país y las cifras.") };
    }
    return { ok: true, e164: e164 };
  }

  // Solo para enseñarlo: "+34 612 34 56 78". Los demás países, tal cual.
  function formatearTelefono(e164) {
    var m = /^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(e164 || "");
    return m ? "+34 " + m[1] + " " + m[2] + " " + m[3] + " " + m[4] : String(e164 || "");
  }

  function hhmm(fecha, zonaHoraria) {
    var opciones = { hour: "2-digit", minute: "2-digit", hour12: false };
    if (zonaHoraria) opciones.timeZone = zonaHoraria;
    return new Date(fecha).toLocaleTimeString("es-ES", opciones);
  }

  // Texto del WhatsApp. posicion = { lat, lon, precision (m) } o null.
  // tipo "caida_detectada" lo dice, para que quien lo reciba sepa que puede
  // que la persona no esté en condiciones de contestar.
  function mensajeSOS(opciones) {
    var o = opciones || {};
    var nombre = String(o.nombre || "").trim() || tr("sos.un_usuario", "un usuario de Costaviva");
    var inicio = tr("sos.inicio", "🆘 SOS de {nombre}: ", { nombre: nombre });
    var motivo = o.tipo === "caida_detectada"
      ? tr("sos.caida", "mi teléfono ha detectado una posible caída y no he respondido. Necesito ayuda.")
      : tr("sos.ayuda", "necesito ayuda.");
    var p = o.posicion;
    var lugar;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      var detalles = [];
      if (Number.isFinite(p.precision)) detalles.push(tr("sos.precision", "precisión ±{m} m", { m: Math.max(1, Math.round(p.precision)) }));
      detalles.push(hhmm(o.fecha || Date.now(), o.zonaHoraria));
      lugar = tr("sos.mi_ubicacion", " Mi ubicación: {url} ({detalles}).", {
        url: "https://maps.google.com/?q=" + p.lat.toFixed(6) + "," + p.lon.toFixed(6), detalles: detalles.join(", "),
      });
    } else {
      lugar = tr("sos.sin_ubicacion", " No he podido obtener mi ubicación ({hora}).", { hora: hhmm(o.fecha || Date.now(), o.zonaHoraria) });
    }
    return inicio + motivo + lugar + tr("sos.firma", " Enviado desde Costaviva.");
  }

  // Enlace "click to chat". Sin número (o con uno no válido) abre WhatsApp
  // para elegir chat o grupo. encodeURIComponent cubre emoji, acentos, "&",
  // "?", "#" y saltos de línea.
  function urlWhatsApp(e164, texto) {
    var numero = esE164(e164) ? e164.slice(1) : "";
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(String(texto || ""));
  }

  // Solo los contactos que tienen WhatsApp válido, en el orden guardado.
  function contactosConWhatsapp(contactos) {
    return (contactos || []).filter(function (c) { return c && esE164(c.whatsapp); });
  }

  raiz.SosWhatsapp = {
    PATRON_E164: PATRON_E164,
    esE164: esE164,
    normalizarTelefono: normalizarTelefono,
    formatearTelefono: formatearTelefono,
    mensajeSOS: mensajeSOS,
    urlWhatsApp: urlWhatsApp,
    contactosConWhatsapp: contactosConWhatsapp,
  };
})(typeof window !== "undefined" ? window : globalThis);
