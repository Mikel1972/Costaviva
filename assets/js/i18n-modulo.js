// assets/js/i18n-modulo.js
// Puerta de entrada de assets/js/i18n.js para los módulos ES (ventana de
// actividad, capas del mar...) y para los tests de node: importa los
// diccionarios y el núcleo (scripts clásicos que se cargan una sola vez) y
// exporta t(). En el navegador las páginas ya los cargan en el <head>;
// volver a evaluarlos aquí no cambia nada.
import "../i18n/es.js";
import "../i18n/en.js";
import "./i18n.js";

export const I18n = globalThis.I18n;
export const t = (clave, vars, idioma) => globalThis.I18n.t(clave, vars, idioma);
