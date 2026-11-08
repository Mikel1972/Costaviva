// assets/js/coordenadas.js
// Coordenadas al tocar el mapa en Embarcación (2026-11-07, Mikel: "Cuando
// esté en embarcación, el toque en pantalla debe permitir ver las
// coordenadas. Si quiero ir a un punto en concreto debo saber cuál es.").
//
// Dos formatos:
//   - grados y minutos decimales, el de los GPS y plotters:
//     "43° 24,123′ N · 2° 41,456′ W" (coma en es y pt, punto en en);
//   - grados decimales para pegar en otras apps: "43.40205, -2.69093"
//     (siempre con punto: es lo que entienden las apps al pegar).
// Letras N/S/E/W en los tres idiomas, como el resto de coordenadas de la app
// (formatoCoordenadas de index.html, puntos propios "🚤 43.4123°N, 2.6789°W"):
// la W es la de las cartas náuticas y los plotters también en España.
//
// Lo puro (formatoMinutos, formatoDecimal, normalizarLon, copiarTexto) se
// prueba en test/coordenadas.test.js; contenidoGlobo crea el globo (sin on*=,
// CSP: addEventListener).

import { I18n } from "./i18n-modulo.js";

// Leaflet da longitudes fuera de -180..180 al pasar el antimeridiano
// (Nueva Zelanda llega a 186°).
export function normalizarLon(lon) {
  const v = ((((lon + 180) % 360) + 360) % 360) - 180;
  return v === -180 && lon > 0 ? 180 : v + 0;
}

// Grados, minutos (redondeados a `decimales`) y letra de un valor. El
// redondeo se hace sobre el total en minutos para que 59,9995′ pase al grado
// siguiente (nunca "43° 60,000′").
export function partesMinutos(valor, positiva, negativa, decimales = 3) {
  const escala = 10 ** decimales;
  const total = Math.round(Math.abs(valor) * 60 * escala);
  const grados = Math.floor(total / (60 * escala));
  const minutos = (total - grados * 60 * escala) / escala;
  const letra = valor < 0 && total > 0 ? negativa : positiva;
  return { grados, minutos, letra };
}

function textoMinutos(min, decimales, coma) {
  const [ent, dec] = min.toFixed(decimales).split(".");
  const m = ent.padStart(2, "0") + (dec ? (coma ? "," : ".") + dec : "");
  return m;
}

// "43° 24,123′ N · 2° 41,456′ W". coma: separador decimal del idioma.
export function formatoMinutos(lat, lon, { coma = true, decimales = 3 } = {}) {
  const la = partesMinutos(lat, "N", "S", decimales);
  const lo = partesMinutos(normalizarLon(lon), "E", "W", decimales);
  return `${la.grados}° ${textoMinutos(la.minutos, decimales, coma)}′ ${la.letra} · ${lo.grados}° ${textoMinutos(lo.minutos, decimales, coma)}′ ${lo.letra}`;
}

// "43.40205, -2.69093": siempre punto y signo, para pegar.
export function formatoDecimal(lat, lon, decimales = 5) {
  const f = (v) => { const s = v.toFixed(decimales); return /^-0\.0*$/.test(s) ? s.slice(1) : s; };
  return `${f(lat)}, ${f(normalizarLon(lon))}`;
}

// Copia al portapapeles: la API moderna y, si no está o falla (http, iOS
// antiguo, permisos), un textarea con execCommand("copy"). true si copió.
export async function copiarTexto(texto, { nav = globalThis.navigator, doc = globalThis.document } = {}) {
  try {
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(texto); return true; }
  } catch { /* al respaldo */ }
  try {
    if (!doc?.createElement || !doc.execCommand) return false;
    const ta = doc.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    doc.body.appendChild(ta);
    ta.select();
    const ok = doc.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

// El contenido del globo: dos líneas, cada una con su botón "Copiar". Si no
// se puede copiar, se selecciona la línea para copiarla a mano.
export function contenidoGlobo(lat, lon, { doc = globalThis.document } = {}) {
  const caja = doc.createElement("div");
  caja.className = "globo-coords";
  caja.setAttribute("data-globo-coords", "");
  const titulo = doc.createElement("div");
  titulo.className = "globo-coords-titulo";
  titulo.textContent = I18n.t("coords.titulo");
  caja.appendChild(titulo);
  const lineas = [
    ["minutos", formatoMinutos(lat, lon, { coma: I18n.usaComa() }), "coords.copiar_minutos"],
    ["decimal", formatoDecimal(lat, lon), "coords.copiar_decimal"],
  ];
  for (const [tipo, texto, etiqueta] of lineas) {
    const fila = doc.createElement("div");
    fila.className = "globo-coords-fila";
    const valor = doc.createElement("span");
    valor.className = "globo-coords-valor";
    valor.setAttribute(`data-coords-${tipo}`, "");
    valor.textContent = texto;
    const boton = doc.createElement("button");
    boton.type = "button";
    boton.className = "globo-coords-copiar";
    boton.setAttribute("data-coords-copiar", tipo);
    boton.setAttribute("aria-label", I18n.t(etiqueta));
    boton.textContent = I18n.t("coords.copiar");
    let reloj = null;
    boton.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ok = await copiarTexto(texto, { doc });
      boton.textContent = I18n.t(ok ? "coords.copiado" : "coords.no_copiado");
      if (!ok) {
        try { const r = doc.createRange(); r.selectNodeContents(valor); const s = doc.defaultView.getSelection(); s.removeAllRanges(); s.addRange(r); } catch { /* nada */ }
      }
      clearTimeout(reloj);
      reloj = setTimeout(() => { boton.textContent = I18n.t("coords.copiar"); }, 1800);
    });
    fila.append(valor, boton);
    caja.appendChild(fila);
  }
  return caja;
}
