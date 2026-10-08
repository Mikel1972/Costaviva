// scripts/aprendizaje/probar-retador.mjs
//
// Banco de pruebas PÚBLICO de un retador (sin Supabase ni red). Lo usa la
// rutina "Costaviva - Investigador semanal" ANTES de proponer nada:
//
//   node scripts/aprendizaje/probar-retador.mjs aprendizaje/retadores/<id>.json [...]
//
// Comprueba, por cada retador:
//   1. forma del fichero (validarRetador) y que se puede aplicar a
//      especies.json sin romper nada (aplicarRetador + validarRegla: fuentes
//      con licencia comercial, signo de las reglas, campos permitidos);
//   2. cuánto movería el índice en el panel fijo de escenarios (media, máximo
//      y los escenarios que más cambian) y en cuántos escenarios cambia algo:
//      un retador que no mueve nada en ningún escenario no se puede evaluar;
//   3. que los tests de reglas seguirían pasando (cada variable una vez por
//      hora: lo comprueba test/indice-pesca-v2.test.js; aquí solo se avisa).
// La evaluación con los datos PRIVADOS del diario la hace el workflow
// aprendizaje-semanal.yml al subir la rama robot/aprendizaje-* (deja
// aprendizaje/evaluacion-retadores.json en la rama) y, cada lunes, la pasada
// semanal en la sombra.
//
// Sale con código 1 si algún retador tiene problemas.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { aplicarRetador, validarRetador } from "./rejugar.mjs";
import { panelReferencia, compararPaneles } from "./deriva.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function probarRetador(retador, datos, panelCampeon = null, opciones = {}) {
  panelCampeon ||= panelReferencia(datos, opciones);
  const problemas = validarRetador(retador);
  const { datos: d, problemas: p2 } = aplicarRetador(datos, retador);
  problemas.push(...p2);
  if (problemas.length) return { id: retador.id, ok: false, problemas };
  const panel = compararPaneles(panelCampeon, panelReferencia(d, opciones));
  const avisos = [];
  if (panel.max_abs === 0) avisos.push("no cambia ningún escenario del panel: o sus condiciones no se dan en el panel (río, turbidez, fondo...) o no hace nada; el banco de pruebas privado lo dirá");
  if (panel.media_abs > 3) avisos.push(`mueve mucho el índice (${panel.media_abs} puntos de media): explícalo bien en la propuesta`);
  return { id: retador.id, ok: true, problemas: [], avisos, panel };
}

function main() {
  const ficheros = process.argv.slice(2);
  if (!ficheros.length) { console.error("Uso: node scripts/aprendizaje/probar-retador.mjs aprendizaje/retadores/<id>.json [...]"); process.exit(2); }
  const datos = JSON.parse(readFileSync(join(RAIZ, "assets/datos/especies.json"), "utf8"));
  const panel = panelReferencia(datos);
  let mal = 0;
  const salida = ficheros.map((f) => {
    let r;
    try { r = JSON.parse(readFileSync(f, "utf8")); } catch (e) { mal++; return { fichero: f, ok: false, problemas: [`JSON inválido: ${e.message}`] }; }
    const res = { fichero: f, ...probarRetador(r, datos, panel) };
    if (!res.ok) mal++;
    return res;
  });
  console.log(JSON.stringify(salida, null, 1));
  process.exit(mal ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
