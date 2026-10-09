// assets/js/selector-fondo.js
//
// Un solo botón "Fondo" en la columna de capas (2026-10-08, pedido de Mikel:
// "tenemos una duplicidad. Fondos e Isób. muestran lo mismo"). Sustituye a
// los tres botones de antes:
//   - "Fondo": WMS emodnet:mean + emodnet:contours de EMODnet al 75 %. Era el
//     mismo DTM 2024 que el relieve del mapa base (mapa-base.js,
//     emodnet:mean_atlas_land), pero en tinte plano sin sombreado, y unas
//     isóbatas de EMODnet sin la de 20 m: no añadía nada. Quitado.
//   - "Isób.": isóbatas de 20 a 5000 m (capa-batimetria.js) -> "Profundidad".
//   - "Sustr.": sustrato de EMODnet Seabed Habitats (capa-tipo-fondo.js)
//     -> "Tipo de fondo".
// El botón abre un selector pequeño con dos casillas y "Ninguno". Las dos
// capas a la vez se leen bien (líneas finas encima de manchas de color al
// 60 %) y es justo lo que pregunta un pescador: "¿dónde hay roca a 30 m?".
//
// Lo puro (sin DOM) tiene tests en test/selector-fondo.test.js.

import { I18n } from "./i18n-modulo.js";

export const OPCIONES = [
  { id: "profundidad", icono: "〰", texto: I18n.t("selfondo.profundidad"), detalle: I18n.t("selfondo.profundidad_det") },
  { id: "tipo", icono: "🪨", texto: I18n.t("fondo.tipo"), detalle: I18n.t("selfondo.tipo_det") },
];

export const NINGUNO = Object.freeze({ profundidad: false, tipo: false });

// Nuevo estado tras tocar una opción: "ninguno" apaga las dos; las demás se
// alternan sin tocar la otra.
export function elegir(estado, opcion) {
  if (opcion === "ninguno") return { ...NINGUNO };
  if (!OPCIONES.some((o) => o.id === opcion)) return { ...estado };
  return { ...estado, [opcion]: !estado[opcion] };
}

// Qué enseña el botón: activo si hay alguna capa, y un texto para lectores de
// pantalla y el title que dice cuáles.
export function resumen(estado) {
  const activas = OPCIONES.filter((o) => estado[o.id]).map((o) => o.texto.toLowerCase());
  return {
    activo: activas.length > 0,
    texto: activas.length ? I18n.t("selfondo.resumen", { capas: activas.join(I18n.t("va.seg.y")) }) : I18n.t("selfondo.ninguna"),
  };
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
// boton: el botón "Fondo"; panel: el contenedor del selector (vacío);
// capas: { profundidad: { visible(), ponerVisible(v) }, tipo: { ... } };
// alEncender(id): para la analítica de uso. Devuelve { refrescar } para que
// las capas avisen si cambian solas (isóbatas en la pestaña Embarcación).
export function montarSelector({ boton, panel, capas, alEncender = () => {} }) {
  const estado = () => ({ profundidad: !!capas.profundidad?.visible(), tipo: !!capas.tipo?.visible() });
  const casillas = {};

  const tit = document.createElement("div");
  tit.className = "titulo";
  tit.textContent = I18n.t("selfondo.titulo");
  panel.appendChild(tit);
  for (const o of OPCIONES) {
    const label = document.createElement("label");
    label.className = "opcion";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = o.id;
    const ico = document.createElement("span");
    ico.className = "ico";
    ico.textContent = o.icono;
    ico.setAttribute("aria-hidden", "true");
    const txt = document.createElement("span");
    txt.className = "txt";
    const b = document.createElement("b");
    b.textContent = o.texto;
    const small = document.createElement("small");
    small.textContent = o.detalle;
    txt.append(b, small);
    label.append(input, ico, txt);
    panel.appendChild(label);
    casillas[o.id] = input;
    input.addEventListener("change", () => aplicar(elegir(estado(), o.id), o.id));
  }
  const ninguno = document.createElement("button");
  ninguno.type = "button";
  ninguno.className = "ninguno";
  ninguno.textContent = I18n.t("selfondo.ninguno");
  panel.appendChild(ninguno);
  ninguno.addEventListener("click", () => { aplicar(elegir(estado(), "ninguno")); cerrar(); });

  function aplicar(nuevo, tocada) {
    for (const o of OPCIONES) {
      if (!!nuevo[o.id] !== !!capas[o.id]?.visible()) capas[o.id]?.ponerVisible(nuevo[o.id]);
    }
    if (tocada && nuevo[tocada]) alEncender(tocada);
    refrescar();
  }

  function refrescar() {
    const e = estado();
    for (const o of OPCIONES) casillas[o.id].checked = e[o.id];
    const r = resumen(e);
    boton.classList.toggle("activo", r.activo);
    boton.setAttribute("title", r.texto);
    boton.setAttribute("aria-label", I18n.t("selfondo.aria", { texto: r.texto }));
    ninguno.disabled = !r.activo;
  }

  const abierto = () => !panel.hidden;
  function abrir() {
    refrescar();
    panel.hidden = false;
    boton.setAttribute("aria-expanded", "true");
    casillas[OPCIONES[0].id].focus({ preventScroll: true });
  }
  function cerrar() {
    if (!abierto()) return;
    panel.hidden = true;
    boton.setAttribute("aria-expanded", "false");
  }
  boton.setAttribute("aria-haspopup", "true");
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-controls", panel.id);
  boton.addEventListener("click", (ev) => { ev.stopPropagation(); if (abierto()) cerrar(); else abrir(); });
  // Tocar fuera o Escape lo cierra; tocar dentro no (se pueden marcar las dos).
  document.addEventListener("pointerdown", (ev) => {
    if (abierto() && !panel.contains(ev.target) && !boton.contains(ev.target)) cerrar();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && abierto()) { cerrar(); boton.focus(); }
  });
  refrescar();
  return { refrescar, cerrar };
}
