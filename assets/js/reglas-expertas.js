// assets/js/reglas-expertas.js
//
// Motor genérico de "reglas expertas" del índice de pesca (2026-10-08,
// pedido de Mikel). Las reglas NO están aquí: viven como datos en
// assets/datos/especies.json (bloque `reglas_expertas`), así que se pueden
// añadir cientos sin tocar código. Este módulo solo sabe:
//   1. decidir si una regla aplica a una especie/modalidad/región/mes/spot
//      (su `ambito`);
//   2. evaluar sus `condiciones` sobre la serie horaria (con retardos,
//      tendencias y agregados en ventanas de horas);
//   3. devolver su efecto en log-odds (la escala del índice v2, ver
//      ventana-actividad.js), con el texto que se enseña al usuario.
//
// Módulo ES puro (sin DOM ni red), con tests en test/indice-pesca-v2.test.js.
// Guía para añadir reglas: CLAUDE.md, "Cómo añadir una regla experta".
//
// FORMATO DE UNA REGLA (resumen; la referencia completa está en el propio
// JSON, `reglas_expertas.formato`):
// {
//   "id": "levante_cantabrico",            // único, sin espacios
//   "texto": "viento de levante: ...",     // lo que ve el usuario
//   "fuente": "mikel_experiencia_local",   // id de `fuentes`
//   "tipo": "heuristica_experta_local",
//   "confianza": 0.7,                      // 0-1: encoge el efecto
//   "estado": "por_validar",               // hasta calibrar con el diario
//   "ambito": { "regiones": [...], "modalidades": [...], "especies": [...],
//               "especies_excluidas": [...], "meses": [...] },
//   "condiciones": [ { "var": "viento", "op": ">=", "valor": 8 }, ... ],  // todas (Y)
//   "efecto": { "logodds": -0.4, "escala": { ...valor..., "de": x0, "a": x1, "minimo": 0.3 } },
//   "sustituye": ["presion"]               // factores base que esta regla reemplaza en su ámbito
// }
// Una condición sin dato (serie vacía, río desconocido...) hace que la regla
// NO aplique (nunca se inventa): queda en `sinDato` para la fiabilidad.

// Variables horarias (campo de cada hora de la serie) y de contexto.
export const VARIABLES_HORARIAS = {
  ola: "ola", viento: "viento", viento_dir: "vientoDir", presion: "presion",
  temp_agua: "tempAgua", lluvia: "lluvia", nivel_mar: "nivelMar",
};
export const VARIABLES_CONTEXTO = [
  "caudal_rio",            // "bajo" | "normal" | "alto" | null (río asociado al spot, solo con dato real)
  "rio_desembocadura_km",  // distancia del spot a la desembocadura de su río; null si el spot no tiene río asociado
  "turbidez",              // "no turbia" | "turbia" | "muy turbia" | null
  "mes", "hora_local", "luz",
];
export const AGREGADOS = ["media", "min", "max", "suma", "delta", "fraccion"];
export const OPERADORES = ["<", "<=", ">", ">=", "==", "!=", "en", "entre", "sector"];

// Mínimo de horas con dato en una ventana para que el agregado valga.
const MIN_COBERTURA = 0.6;

const esNulo = (x) => x === null || x === undefined || (typeof x === "number" && !Number.isFinite(x));

// Ángulo dentro de un sector circular [desde, hasta] en grados (admite
// sectores que cruzan el norte, p. ej. [315, 45]).
export function enSector(grados, [desde, hasta]) {
  if (esNulo(grados)) return null;
  const g = ((grados % 360) + 360) % 360;
  const a = ((desde % 360) + 360) % 360, b = ((hasta % 360) + 360) % 360;
  return a <= b ? g >= a && g <= b : g >= a || g <= b;
}

export function compara(v, op, valor) {
  if (esNulo(v)) return null;
  switch (op) {
    case "<": return v < valor;
    case "<=": return v <= valor;
    case ">": return v > valor;
    case ">=": return v >= valor;
    case "==": return v === valor;
    case "!=": return v !== valor;
    case "en": return Array.isArray(valor) && valor.includes(v);
    case "entre": return v >= valor[0] && v <= valor[1];
    case "sector": return enSector(v, valor);
    default: throw new Error(`operador desconocido: ${op}`);
  }
}

function valorHora(horas, k, nombre) {
  const campo = VARIABLES_HORARIAS[nombre];
  if (!campo) throw new Error(`variable horaria desconocida: ${nombre}`);
  const h = horas[k];
  return h ? h[campo] : undefined;
}

// Valor de una "expresión" { var, agregado?, desde_h?, hasta_h?, cumple? } en
// la hora i. Devuelve número/texto o null si no hay dato suficiente.
export function valorExpresion(expr, horas, i, ctx = {}) {
  const nombre = expr.var;
  if (!(nombre in VARIABLES_HORARIAS)) {
    if (!VARIABLES_CONTEXTO.includes(nombre)) throw new Error(`variable desconocida: ${nombre}`);
    const v = ctx[nombre];
    return esNulo(v) ? null : v;
  }
  if (!expr.agregado) {
    const v = valorHora(horas, i, nombre);
    return esNulo(v) ? null : v;
  }
  const desde = i + (expr.desde_h ?? 0), hasta = i + (expr.hasta_h ?? 0);
  if (desde < 0 || hasta >= horas.length || desde > hasta) return null;
  if (expr.agregado === "delta") {
    const a = valorHora(horas, desde, nombre), b = valorHora(horas, hasta, nombre);
    return esNulo(a) || esNulo(b) ? null : b - a;
  }
  const n = hasta - desde + 1;
  if (expr.agregado === "fraccion") {
    const tests = Array.isArray(expr.cumple) ? expr.cumple : [expr.cumple];
    let validas = 0, si = 0;
    for (let k = desde; k <= hasta; k++) {
      const r = tests.map((t) => compara(valorHora(horas, k, t.var ?? nombre), t.op, t.valor));
      if (r.some((x) => x === null)) continue;
      validas++;
      if (r.every(Boolean)) si++;
    }
    return validas / n >= MIN_COBERTURA ? si / validas : null;
  }
  const vals = [];
  for (let k = desde; k <= hasta; k++) {
    const v = valorHora(horas, k, nombre);
    if (!esNulo(v)) vals.push(v);
  }
  if (vals.length / n < MIN_COBERTURA) return null;
  switch (expr.agregado) {
    case "media": return vals.reduce((s, x) => s + x, 0) / vals.length;
    case "min": return Math.min(...vals);
    case "max": return Math.max(...vals);
    case "suma": return vals.reduce((s, x) => s + x, 0);
    default: throw new Error(`agregado desconocido: ${expr.agregado}`);
  }
}

// true / false / null (sin dato)
export function evaluarCondicion(cond, horas, i, ctx = {}) {
  return compara(valorExpresion(cond, horas, i, ctx), cond.op, cond.valor);
}

// Expande "@grupo" con `grupos` (reglas_expertas.grupos_especies).
function expandir(lista, grupos = {}) {
  if (!Array.isArray(lista)) return null;
  return lista.flatMap((x) => (typeof x === "string" && x.startsWith("@") ? grupos[x.slice(1)]?.especies || [] : [x]));
}

// ¿Aplica la regla a esta especie/modalidad/región/mes? (no mira la hora)
export function enAmbito(regla, { especieId, modalidad, region, mes }, grupos = {}) {
  const a = regla.ambito || {};
  const especies = expandir(a.especies, grupos);
  const excluidas = expandir(a.especies_excluidas, grupos) || [];
  if (a.regiones && !a.regiones.includes(region)) return false;
  if (a.modalidades && !a.modalidades.includes(modalidad)) return false;
  if (a.meses && !a.meses.includes(mes)) return false;
  if (especies && !especies.includes(especieId)) return false;
  if (excluidas.includes(especieId)) return false;
  return true;
}

// Reglas activas (no retiradas) en el ámbito, y los factores base que
// sustituyen.
export function reglasEnAmbito(bloque, ambito) {
  const reglas = (bloque?.reglas || []).filter((r) => r.estado !== "retirada" && enAmbito(r, ambito, bloque?.grupos_especies));
  const sustituidos = new Set(reglas.flatMap((r) => r.sustituye || []));
  return { reglas, sustituidos };
}

// Efecto de una regla en la hora i: { lo, intensidad } o null si no aplica
// y { sinDato: true } si alguna condición no tiene dato.
export function efectoRegla(regla, horas, i, ctx = {}) {
  for (const c of regla.condiciones || []) {
    const r = evaluarCondicion(c, horas, i, ctx);
    if (r === null) return { sinDato: true };
    if (!r) return null;
  }
  const ef = regla.efecto || {};
  let intensidad = 1;
  if (ef.escala) {
    const v = valorExpresion(ef.escala, horas, i, ctx);
    if (v !== null) {
      const t = (v - ef.escala.de) / (ef.escala.a - ef.escala.de);
      intensidad = Math.max(ef.escala.minimo ?? 0, Math.min(1, t));
    } else intensidad = ef.escala.minimo ?? 0;
  }
  const confianza = regla.confianza ?? 1;
  return { lo: (ef.logodds || 0) * intensidad * confianza, intensidad };
}

// Evalúa todas las reglas (ya filtradas por ámbito) en la hora i.
// Devuelve { terminos: [{ factor, texto, lo, regla }], sinDato: [ids], evaluadas: n }.
export function evaluarReglas(reglas, horas, i, ctx = {}) {
  const terminos = [], sinDato = [];
  for (const r of reglas) {
    const e = efectoRegla(r, horas, i, ctx);
    if (!e) continue;
    if (e.sinDato) { sinDato.push(r.id); continue; }
    if (!e.lo) continue;
    terminos.push({
      factor: `regla:${r.id}`, texto: r.texto, lo: e.lo,
      regla: { id: r.id, fuente: r.fuente, tipo: r.tipo, confianza: r.confianza, estado: r.estado },
    });
  }
  return { terminos, sinDato, evaluadas: reglas.length };
}

// Comprobación de forma (la usan los tests y la página de admin): lista de
// problemas de una regla, vacía si está bien.
export function validarRegla(r, { fuentes = {}, especies = [], regiones = [], grupos = {} } = {}) {
  const p = [];
  if (!r.id || /\s/.test(r.id)) p.push("id vacío o con espacios");
  if (!r.texto) p.push("sin texto para el usuario");
  if (!r.fuente || !fuentes[r.fuente]) p.push(`fuente desconocida: ${r.fuente}`);
  if (!r.tipo) p.push("sin tipo");
  if (!(r.confianza > 0 && r.confianza <= 1)) p.push("confianza fuera de (0, 1]");
  if (!r.estado) p.push("sin estado");
  if (typeof r.efecto?.logodds !== "number" || Math.abs(r.efecto.logodds) > 2) p.push("efecto.logodds ausente o mayor que ±2");
  const a = r.ambito || {};
  for (const reg of a.regiones || []) if (!regiones.includes(reg)) p.push(`región desconocida: ${reg}`);
  for (const m of a.modalidades || []) if (!["costa", "embarcacion", "submarina"].includes(m)) p.push(`modalidad desconocida: ${m}`);
  for (const m of a.meses || []) if (!(Number.isInteger(m) && m >= 1 && m <= 12)) p.push(`mes inválido: ${m}`);
  for (const e of [...(a.especies || []), ...(a.especies_excluidas || [])]) {
    if (typeof e === "string" && e.startsWith("@")) { if (!grupos[e.slice(1)]) p.push(`grupo desconocido: ${e}`); }
    else if (!especies.includes(e)) p.push(`especie desconocida: ${e}`);
  }
  const exprs = [...(r.condiciones || []), ...(r.efecto?.escala ? [r.efecto.escala] : [])];
  for (const c of exprs) {
    if (!(c.var in VARIABLES_HORARIAS) && !VARIABLES_CONTEXTO.includes(c.var)) p.push(`variable desconocida: ${c.var}`);
    if (c.agregado && !AGREGADOS.includes(c.agregado)) p.push(`agregado desconocido: ${c.agregado}`);
    if (c.op && !OPERADORES.includes(c.op)) p.push(`operador desconocido: ${c.op}`);
    if (c.agregado && (c.desde_h ?? 0) > (c.hasta_h ?? 0)) p.push(`ventana al revés en ${c.var}`);
    if (c.agregado === "fraccion" && !c.cumple) p.push("fraccion sin cumple");
  }
  for (const c of r.condiciones || []) if (!c.op) p.push(`condición sin op: ${c.var}`);
  return p;
}
