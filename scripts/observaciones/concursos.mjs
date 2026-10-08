// scripts/observaciones/concursos.mjs
// Validación de datos-robots/concursos/concursos.json (formato en el LEEME.md
// de esa carpeta). Sin red ni IA. La usan test/observaciones.test.js y la
// rutina de los viernes antes de subir un concurso (ROBOT_REGLAS.md,
// "Concursos de pesca").
//
// Uso: node scripts/observaciones/concursos.mjs   (sale con 1 si hay errores)

import { readFileSync } from "node:fs";

export const CAMPOS_PROHIBIDOS = new Set([
  "participante", "participantes_lista", "nombre", "nombres", "deportista", "deportistas",
  "pescador", "pescadores", "clasificacion", "clasificaciones", "ganador", "ganadores",
  "club_ganador", "puesto", "dni", "licencia_federativa", "email", "telefono",
]);

const REUTILIZABLE = new Set(["permitida", "permiso"]);

// Recorre el objeto y devuelve las rutas de campos con datos personales.
function camposPersonales(obj, ruta = "") {
  const malos = [];
  if (Array.isArray(obj)) obj.forEach((v, i) => malos.push(...camposPersonales(v, `${ruta}[${i}]`)));
  else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (CAMPOS_PROHIBIDOS.has(k.toLowerCase())) malos.push(`${ruta}.${k}`);
      malos.push(...camposPersonales(v, `${ruta}.${k}`));
    }
  }
  return malos;
}

function decimales(n) {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

// Devuelve la lista de errores (vacía si está bien).
export function validarConcurso(c, { fuentes, idsEspecies }) {
  const e = [];
  if (!c || typeof c !== "object") return ["no es un objeto"];
  if (!c.id) e.push("falta id");
  for (const r of camposPersonales(c)) e.push(`dato personal prohibido: ${r}`);
  const f = fuentes.find((x) => x.id === c.fuente);
  if (!f) e.push(`fuente desconocida: ${c.fuente}`);
  else if (!REUTILIZABLE.has(f.reutilizacion)) e.push(`la fuente ${f.id} no permite reutilizar (${f.reutilizacion})`);
  else if (f.reutilizacion === "permiso" && !f.permiso) e.push(`la fuente ${f.id} dice "permiso" pero no lo documenta`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fecha || "")) e.push("fecha no válida");
  if (!["costa", "embarcacion", "submarina"].includes(c.modalidad)) e.push("modalidad no válida");
  if (!c.url) e.push("falta url");
  if (!c.fecha_revision) e.push("falta fecha_revision");
  const z = c.zona || {};
  for (const k of ["lat", "lon"]) {
    if (z[k] != null && decimales(z[k]) > 2) e.push(`zona.${k} con más de 2 decimales`);
  }
  if (!Array.isArray(c.capturas)) e.push("capturas no es una lista");
  for (const [i, k] of (c.capturas || []).entries()) {
    if (k.especie != null && !idsEspecies.has(k.especie)) e.push(`capturas[${i}].especie desconocida: ${k.especie}`);
    if (k.especie == null && !k.nombre_publicado) e.push(`capturas[${i}] sin especie ni nombre_publicado`);
    for (const n of ["piezas", "peso_kg", "talla_max_cm"]) {
      if (k[n] != null && !(Number.isFinite(k[n]) && k[n] >= 0)) e.push(`capturas[${i}].${n} no válido`);
    }
  }
  return e;
}

export function validarTodo(datos, fuentesJson, especiesJson) {
  const idsEspecies = new Set((especiesJson.especies || []).map((x) => x.id));
  const fuentes = fuentesJson.fuentes || [];
  const errores = [];
  const vistos = new Set();
  for (const c of datos.concursos || []) {
    if (vistos.has(c.id)) errores.push(`${c.id}: id repetido`);
    vistos.add(c.id);
    for (const err of validarConcurso(c, { fuentes, idsEspecies })) errores.push(`${c.id || "?"}: ${err}`);
  }
  for (const f of fuentes) {
    if (!f.id || !f.url_resultados || !f.aviso_legal || !f.fecha_revision) errores.push(`fuente ${f.id || "?"}: faltan id/url_resultados/aviso_legal/fecha_revision`);
  }
  return errores;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const leer = (p) => JSON.parse(readFileSync(p, "utf8"));
  const errores = validarTodo(
    leer("datos-robots/concursos/concursos.json"),
    leer("datos-robots/concursos/fuentes.json"),
    leer("assets/datos/especies.json"),
  );
  if (errores.length) {
    for (const e of errores) console.error(`::error::${e}`);
    process.exit(1);
  }
  console.log("concursos.json correcto.");
}
