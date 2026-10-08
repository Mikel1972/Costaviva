// scripts/aprendizaje/rejugar.mjs
//
// "Volver a jugar" un caso pasado con otros pesos o reglas. El motor del
// índice es determinista: con las mismas condiciones y el mismo
// especies.json sale el mismo número. Dos formas:
//
//   1. Con los TÉRMINOS (log-odds de cada factor y regla, los guarda el
//      diario en indice_factores o salen de recalcular): cambiar el peso de
//      una regla es multiplicar su término. Rápido y sin red; sirve para
//      ajustar pesos y para quitar reglas, no para reglas nuevas.
//   2. Con la SERIE horaria de condiciones (Open-Meteo, mismo formato que
//      el diario): se pasa por indiceSpot() con un especies.json cualquiera
//      (el campeón o un retador). Sirve para todo, también reglas nuevas.
//
// Puro, sin red: la serie la trae datos.mjs.

import { indiceSpot, sigmoide, regionPorCoordenadas } from "../../assets/js/ventana-actividad.js";
import { validarRegla } from "../../assets/js/reglas-expertas.js";
import { contextoFondo, entradaDeSpot } from "../../assets/js/capa-tipo-fondo.js";

// Probabilidad con multiplicadores por unidad (factor o "regla:<id>").
// mult[u] = 0 quita la unidad; b0 = término independiente (log-odds).
export function probTerminos(terminos, mult = {}, b0 = 0) {
  let x = b0;
  for (const t of terminos || []) x += (mult[t.u] ?? 1) * t.lo;
  return sigmoide(x);
}

// Unidades con log-odds sumados por caso (una regla puede salir una vez).
export function sumaPorUnidad(terminos) {
  const m = new Map();
  for (const t of terminos || []) m.set(t.u, (m.get(t.u) || 0) + t.lo);
  return m;
}

// Índice a la hora del caso con un especies.json dado. `serie` en el formato
// de calcularVentana (hora local "AAAA-MM-DDTHH:00"). `extras`: tipoFondo y
// profundidad (los JSON de assets/datos) para el contexto del spot.
export function recalcular(datos, caso, serie, extras = {}) {
  if (!serie?.length) return null;
  const etiqueta = `${caso.fecha}T${String(caso.hora).padStart(2, "0")}:00`;
  const i = serie.findIndex((h) => h.hora === etiqueta);
  if (i < 0) return null;
  const spot = { slug: caso.spot, lat: caso.lat, lon: caso.lon, esUsuario: !caso.spot };
  const fondo = extras.tipoFondo ? contextoFondo(entradaDeSpot(extras.tipoFondo, spot), caso.modalidad) : null;
  const batimetria = caso.spot && extras.profundidad?.spots?.[caso.spot] ? extras.profundidad.spots[caso.spot] : null;
  const ind = indiceSpot(datos, serie, i, {
    lat: caso.lat, lon: caso.lon, modalidad: caso.modalidad,
    region: caso.region || regionPorCoordenadas(caso.lat, caso.lon), fondo, batimetria,
  });
  if (!ind || ind.puntuacion === null) return null;
  const r = ind.resultado;
  return {
    p: r.probabilidad / 100, puntuacion: ind.puntuacion, especie: ind.especie.id,
    terminos: r.razones.filter((x) => typeof x.lo === "number" && x.factor !== "tope").map((x) => ({ u: x.factor, lo: x.lo })),
    ranking: ind.ranking.map((x) => ({ id: x.id, p: x.puntuacion })),
    tope: r.razones.some((x) => x.factor === "tope"),
  };
}

// ---------------------------------------------------------------------------
// Retadores: conjuntos de cambios sobre especies.json que se evalúan "en la
// sombra" (se calculan y se registran, no se enseñan). Formato en
// aprendizaje/retadores/LEEME.md.
// ---------------------------------------------------------------------------
export const OPS_RETADOR = ["anadir_regla", "modificar_regla", "retirar_regla", "peso_defecto", "b0", "anadir_fuente"];
// Campos de una regla que un retador puede tocar con modificar_regla.
const CAMPOS_MODIFICABLES = new Set(["confianza", "efecto.logodds", "efecto.escala", "efecto.atenua", "condiciones", "ambito", "texto", "nombre", "estado"]);
// Factores base que un retador puede repesar (nunca seguridad, legal ni topes).
const FACTORES_REPESABLES = new Set(["luz", "marea", "temperatura", "oleaje", "viento", "presion", "turbidez", "lluvia", "caudal_rio"]);

function ponerRuta(obj, ruta, valor) {
  const partes = ruta.split(".");
  let o = obj;
  for (const p of partes.slice(0, -1)) o = o[p] ??= {};
  o[partes[partes.length - 1]] = valor;
}

// Devuelve { datos (copia modificada), problemas: [] }. Nunca toca el original.
export function aplicarRetador(datosCampeon, retador) {
  const datos = structuredClone(datosCampeon);
  const problemas = [];
  const reglas = datos.reglas_expertas.reglas;
  for (const [k, c] of (retador.cambios || []).entries()) {
    const donde = `cambio ${k + 1} (${c.op})`;
    if (!OPS_RETADOR.includes(c.op)) { problemas.push(`${donde}: operación no permitida`); continue; }
    if (c.op === "anadir_fuente") {
      if (!c.id || !c.fuente?.licencia || !c.fuente?.url) problemas.push(`${donde}: la fuente necesita id, url y licencia`);
      else if (/\bNC\b|no comercial|non-?commercial/i.test(c.fuente.licencia)) problemas.push(`${donde}: licencia no comercial (Costaviva es comercial)`);
      else datos.fuentes[c.id] = c.fuente;
    } else if (c.op === "anadir_regla") {
      if (reglas.some((r) => r.id === c.regla?.id)) problemas.push(`${donde}: ya existe la regla ${c.regla?.id}`);
      else reglas.push({ estado: "por_validar", ...c.regla });
    } else if (c.op === "modificar_regla" || c.op === "retirar_regla") {
      const r = reglas.find((x) => x.id === c.id);
      if (!r) { problemas.push(`${donde}: no existe la regla ${c.id}`); continue; }
      if (r.tipo === "oficial") { problemas.push(`${donde}: las reglas oficiales no se tocan`); continue; }
      if (c.op === "retirar_regla") { r.estado = "retirada"; continue; }
      for (const [campo, v] of Object.entries(c.campos || {})) {
        if (!CAMPOS_MODIFICABLES.has(campo)) { problemas.push(`${donde}: campo no modificable ${campo}`); continue; }
        if (campo === "efecto.logodds" && Math.sign(v) !== Math.sign(r.efecto.logodds) && r.efecto.logodds !== 0) {
          problemas.push(`${donde}: cambia el signo de ${c.id} (eso es otra regla: retírala y añade otra)`);
          continue;
        }
        ponerRuta(r, campo, v);
      }
    } else if (c.op === "peso_defecto") {
      if (!FACTORES_REPESABLES.has(c.factor) || !datos.reglas_por_defecto[c.factor]) problemas.push(`${donde}: factor no repesable ${c.factor}`);
      else if (typeof c.peso_lo !== "number" || Math.abs(c.peso_lo) > 2) problemas.push(`${donde}: peso_lo fuera de ±2`);
      else datos.reglas_por_defecto[c.factor].peso_lo = c.peso_lo;
    } else if (c.op === "b0") {
      if (typeof c.valor !== "number" || Math.abs(c.valor) > 1) problemas.push(`${donde}: b0 fuera de ±1`);
      else datos.indice.b0_logodds = c.valor;
    }
  }
  // Toda regla tocada o nueva tiene que pasar la misma validación que los tests.
  const ctxVal = {
    fuentes: datos.fuentes, especies: datos.especies.map((e) => e.id),
    regiones: Array.isArray(datos.regiones) ? datos.regiones : Object.keys(datos.regiones || {}), grupos: datos.reglas_expertas.grupos_especies,
  };
  const tocadas = new Set((retador.cambios || []).map((c) => c.id || c.regla?.id).filter(Boolean));
  for (const r of reglas.filter((x) => tocadas.has(x.id))) {
    for (const p of validarRegla(r, ctxVal)) problemas.push(`regla ${r.id}: ${p}`);
  }
  return { datos, problemas };
}

// Validación de forma del fichero de un retador (sin aplicarlo).
export function validarRetador(r) {
  const p = [];
  if (!r || typeof r !== "object") return ["no es un objeto"];
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(r.id || "")) p.push("id vacío o con caracteres no permitidos (minúsculas, cifras y guiones)");
  if (!r.titulo) p.push("sin titulo");
  if (!r.explicacion_llana) p.push("sin explicacion_llana");
  if (!["sombra", "retirado", "promovido"].includes(r.estado)) p.push("estado debe ser sombra | retirado | promovido");
  if (!Array.isArray(r.cambios) || !r.cambios.length) p.push("sin cambios");
  if (!Array.isArray(r.fuentes)) p.push("sin lista de fuentes (puede ser vacía si es un ajuste de datos)");
  return p;
}
