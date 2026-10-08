// scripts/seo/generar-estilos.mjs
// Escribe functions/_lib/seo/estilos.js: assets/css/costaviva.css (sin sus
// @font-face) + assets/css/publico.css en una cadena, sin comentarios, para
// meterla en línea en el <head> de las páginas públicas (/spots, /especies, 404).
// Motivo (2026-10-08, PageSpeed de /spots/bakio en móvil: 87): las dos hojas
// y la de Google Fonts bloqueaban el pintado ~1,8 s. En línea no hay ninguna
// petición que esperar antes de pintar. Una Function de Pages no puede leer
// ficheros del repo, por eso se genera un módulo.
//
//   node scripts/seo/generar-estilos.mjs          # reescribe estilos.js
//   node scripts/seo/generar-estilos.mjs --check  # falla si está desfasado
//
// generar-sitemap.mjs lo llama antes de escribir 404.html, y
// test/rendimiento-publico.test.js falla si alguien toca un CSS y no lo
// regenera.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RUTA_ESTILOS = "functions/_lib/seo/estilos.js";
export const HOJAS = ["assets/css/costaviva.css", "assets/css/publico.css"];

// Minificado prudente: quita comentarios y espacios sobrantes, sin tocar
// selectores (no se quitan espacios alrededor de ":" ni de combinadores).
export function minificarCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

// Las @font-face de costaviva.css son las de la app (rangos de peso); las
// páginas públicas usan las de publico.css (pesos sueltos, como pedían a
// Google). Si se juntaran, un 700 en Manrope dejaría de verse a 800.
export const sinFontFace = (css) => css.replace(/@font-face\s*\{[^}]*\}/g, "");

export function cssEnLinea(leer = (r) => readFileSync(join(RAIZ, r), "utf8")) {
  const [app, publico] = HOJAS.map(leer);
  return minificarCss(sinFontFace(app)) + minificarCss(publico);
}

export function moduloEstilos(css = cssEnLinea()) {
  return `// GENERADO por scripts/seo/generar-estilos.mjs: no editar a mano.
// ${HOJAS.join(" + ")}, minificado, para el <style> de las páginas públicas.
export const CSS_PUBLICO = ${JSON.stringify(css)};
`;
}

// Devuelve true si estilos.js ya estaba al día.
export function escribirEstilos({ comprobar = false } = {}) {
  const ruta = join(RAIZ, RUTA_ESTILOS);
  const nuevo = moduloEstilos();
  let actual = "";
  try { actual = readFileSync(ruta, "utf8"); } catch { /* aún no existe */ }
  if (actual === nuevo) return true;
  if (!comprobar) writeFileSync(ruta, nuevo);
  return false;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const comprobar = process.argv.includes("--check");
  const alDia = escribirEstilos({ comprobar });
  if (comprobar && !alDia) {
    console.error(`${RUTA_ESTILOS} desfasado: node scripts/seo/generar-estilos.mjs`);
    process.exit(1);
  }
  console.log(alDia ? `${RUTA_ESTILOS} ya estaba al día` : `${RUTA_ESTILOS} reescrito`);
}
