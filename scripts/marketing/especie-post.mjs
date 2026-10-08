// scripts/marketing/especie-post.mjs
// Elección de la especie del post de Instagram de los miércoles y su texto,
// a partir de assets/datos/especies.json (2026-10-08: sustituye a leer la
// lista ESPECIES de index.html, ya retirada). Sin dependencias (ni sharp ni
// red) para poder probarlo en test/especie-post.test.js.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  especiesDeTemporada, tallasParaRegion, estadoFreza, cebosParaRegion, textoMeses, NOMBRE_REGION,
} from "../../assets/js/ventana-actividad.js";

// Región de las fichas de especies para el post: la de la última zona del
// ciclo de rotación (rotacion-zonas.json); por defecto el Cantábrico (posts
// vascos). REGION_POST en el entorno la fuerza.
const REGION_POR_ZONA = {
  "País Vasco — Bizkaia": "cantabrico", "País Vasco — Gipuzkoa": "cantabrico", "Cantabria": "cantabrico",
  "Galicia": "atlantico_norte", "Castellón": "mediterraneo", "Valencia": "mediterraneo",
  "Alicante": "mediterraneo", "Murcia y Baleares": "mediterraneo",
};
export function regionDelPost(rotacion, env = process.env) {
  if (env.REGION_POST && NOMBRE_REGION[env.REGION_POST]) return env.REGION_POST;
  return REGION_POR_ZONA[rotacion?.ultimaZona] || "cantabrico";
}
// ¿El post es de la costa vasca? (para usar la talla del Gobierno Vasco).
// Sin zona conocida se asume que sí: el post por defecto es vasco.
export function postEnEuskadi(rotacion, env = process.env) {
  if (env.REGION_POST) return false;
  return !rotacion?.ultimaZona || rotacion.ultimaZona.startsWith("País Vasco");
}

export function leerEspeciesJson(raizRepo) {
  return JSON.parse(readFileSync(join(raizRepo, "assets", "datos", "especies.json"), "utf8"));
}

// Elige la especie y compone el texto. Exportada para los tests.
// Prioriza las especies cuya temporada en esa región está verificada con
// fuente (no heredada de la lista antigua); nunca devuelve una en veda.
export function elegirEspeciePost(datos, region, mes, dia, { euskadi = false } = {}) {
  const candidatas = especiesDeTemporada(datos, region, mes);
  const verificadas = candidatas.filter((e) => e.presencia[region].verificado !== false);
  const lista = verificadas.length ? verificadas : candidatas;
  if (!lista.length) return null;
  const e = lista[dia % lista.length];
  const p = e.presencia[region];
  const fuenteTemporada = p.fuentes?.map((f) => datos.fuentes[f]).find((f) => f?.tipo === "oficial" || f?.tipo === "cientifico");
  const talla = tallasParaRegion(e, region, euskadi && region === "cantabrico").find((t) => t.valor_cm !== null || t.peso_g !== undefined);
  const freza = estadoFreza(e, region, mes);
  const cebos = cebosParaRegion(e, region, 3).map((c) => c.nombre.toLowerCase());
  const lineas = [
    `Temporada en ${NOMBRE_REGION[region]}: ${textoMeses(p.meses)}${fuenteTemporada ? ` (${fuenteTemporada.editor.split(",")[0]})` : ""}.`,
  ];
  if (e.actividad?.valor) lineas.push(e.actividad.valor);
  const nota = lineas.join(" ");
  return { especie: e, nota, talla, freza, cebos };
}

