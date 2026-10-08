// scripts/aprendizaje/propuestas.mjs
//
// Contrato común de las 4 apps: Mikel1972/comun, estandares/aprendizaje.md
// ("algoritmos que aprenden solos"). Principio de Mikel: "meros opinadores
// de las ideas, frente a generadores netos": el sistema genera, prueba y
// prioriza; Mikel solo dice sí o no, una vez por semana, en el Issue de comun.
//
//   aprendizaje/senales.json     { app, generado, ventana_dias, estado, metricas: { clave: número } }
//   aprendizaje/propuestas.json  LISTA de propuestas (abajo)
//   aprendizaje/decisiones.json  [{ id, fecha, propuesta_id, decision: si|no|comentario, motivo, issue }]
//                                (la escriben registrar-decisiones.yml de comun, su rutina o una sesión)
//   aprendizaje/RESUMEN.md       una página en castellano llano
//
// Propuesta (obligatorios): id (ESTABLE, sin fecha), fecha (primera vez que
// se propuso), app, tipo (dato|peso|regla|interfaz|coste|esquema), titulo,
// explicacion_llana, evidencia (UNA línea con números), riesgo ("bajo|medio|
// alto, y por qué"), requiere_si, estado (propuesta|aceptada|rechazada|
// aplicada), pr. Opcionales: impacto (1-5), esfuerzo (bajo|medio|alto),
// origen, metrica { clave (de senales.json.metricas), valor_antes, objetivo:
// subir|bajar }, evidencia_n. Costaviva añade `clave` (qué se propone, para no
// repetir) y `detalle` (los números completos).

export const APP = "Costaviva";
export const TIPOS = ["dato", "peso", "regla", "interfaz", "coste", "esquema"];
export const ESTADOS = ["propuesta", "aceptada", "rechazada", "aplicada"];
export const OBLIGATORIOS = ["id", "fecha", "app", "tipo", "titulo", "explicacion_llana", "evidencia", "riesgo", "requiere_si", "estado", "pr"];
export const MAX_NUEVAS_SEMANA = 5;

export function validarPropuesta(p) {
  const e = [];
  if (!p || typeof p !== "object") return ["no es un objeto"];
  const falta = OBLIGATORIOS.filter((k) => !(k in p));
  if (falta.length) e.push(`faltan ${falta.join(", ")}`);
  if (!/^[a-z0-9][a-z0-9._-]{2,120}$/.test(p.id || "")) e.push("id inválido");
  if (/\d{8}|\d{4}-\d{2}-\d{2}/.test(p.id || "")) e.push("el id no lleva fecha (debe ser estable)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "")) e.push("fecha AAAA-MM-DD");
  if (!TIPOS.includes(p.tipo)) e.push(`tipo debe ser ${TIPOS.join(" | ")}`);
  if (!p.explicacion_llana || p.explicacion_llana.length < 20) e.push("explicacion_llana vacía o demasiado corta");
  if (typeof p.evidencia !== "string" || !p.evidencia || /\n/.test(p.evidencia)) e.push("evidencia: una línea de texto con números");
  if (!/^(bajo|medio|alto)\b/.test(p.riesgo || "")) e.push("riesgo empieza por bajo, medio o alto");
  if (typeof p.requiere_si !== "boolean") e.push("requiere_si debe ser true o false");
  if (!ESTADOS.includes(p.estado)) e.push(`estado debe ser ${ESTADOS.join(" | ")}`);
  if (!(p.pr === null || Number.isInteger(p.pr) || typeof p.pr === "string")) e.push("pr: número, url o null");
  if (p.impacto !== undefined && !(Number.isInteger(p.impacto) && p.impacto >= 1 && p.impacto <= 5)) e.push("impacto 1-5");
  if (p.esfuerzo !== undefined && !["bajo", "medio", "alto"].includes(p.esfuerzo)) e.push("esfuerzo bajo|medio|alto");
  if (p.metrica !== undefined && (!p.metrica?.clave || !["subir", "bajar"].includes(p.metrica.objetivo))) e.push("metrica { clave, valor_antes, objetivo: subir|bajar }");
  return e;
}

export const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

export function propuesta({
  clave, fecha, tipo, titulo, explicacion_llana, evidencia, evidencia_n, riesgo, deshacer, requiere_si = true, estado = "propuesta",
  pr = null, origen = "aprendizaje-semanal", impacto = 2, esfuerzo = "bajo", metrica, retador, detalle,
}) {
  return {
    id: `costaviva-${slug(clave)}`, fecha, app: APP, tipo, titulo,
    explicacion_llana: deshacer ? `${explicacion_llana} Para deshacerlo: ${deshacer}` : explicacion_llana,
    evidencia, riesgo, requiere_si, estado, pr, impacto, esfuerzo, origen,
    ...(metrica ? { metrica } : {}), ...(Number.isFinite(evidencia_n) ? { evidencia_n } : {}),
    clave, ...(retador ? { retador } : {}), ...(detalle ? { detalle } : {}),
  };
}

const idDe = (d) => d.propuesta_id ?? d.id;

// Fusiona las propuestas existentes con las de esta pasada y aplica las
// decisiones. Barandillas de comun (L4):
//   - "si" -> aceptada (o se queda aplicada); "no" -> rechazada; "comentario"
//     no cambia el estado;
//   - lo rechazado (mismo id) no vuelve salvo que la evidencia se haya
//     DUPLICADO (evidencia_n); entonces se reabre diciendo cuándo y por qué
//     se rechazó y cuánto ha crecido la evidencia;
//   - como mucho MAX_NUEVAS_SEMANA propuestas nuevas por semana (las de más
//     impacto); los cambios aplicados solos no cuentan, no piden decisión;
//   - las propuestas de este mismo origen que ya no se generan y siguen sin
//     decidir se retiran: la condición que las motivó ya no se da.
export function fusionar(existentes = [], nuevas = [], decisiones = [], { hoy, origen = "aprendizaje-semanal", maxNuevas = MAX_NUEVAS_SEMANA } = {}) {
  const porId = new Map(existentes.map((p) => [p.id, { ...p }]));
  const decs = new Map();
  for (const d of [...decisiones].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) if (d.decision === "si" || d.decision === "no") decs.set(idDe(d), d);
  for (const p of porId.values()) {
    const d = decs.get(p.id);
    if (!d) continue;
    if (p.reabierta && p.fecha_reapertura && d.fecha < p.fecha_reapertura) continue; // decisión vieja: la reapertura espera otra
    if (d.decision === "si") { if (p.estado !== "aplicada") p.estado = "aceptada"; }
    else { p.estado = "rechazada"; p.reabierta = false; }
    p.fecha_decision = d.fecha;
  }
  const regeneradas = new Set();
  const silenciadas = [];
  const candidatas = [];
  for (const n of nuevas) {
    const previa = porId.get(n.id);
    if (!previa) { candidatas.push(n); continue; }
    regeneradas.add(n.id);
    if (previa.estado === "rechazada") {
      const d = decs.get(n.id);
      const antes = previa.evidencia_n_al_rechazar ?? previa.evidencia_n ?? null;
      if (n.estado !== "aplicada" && antes && n.evidencia_n >= 2 * antes) {
        porId.set(n.id, {
          ...previa, ...n, fecha: previa.fecha, estado: "propuesta", reabierta: true, fecha_reapertura: hoy, evidencia_n_al_rechazar: antes,
          explicacion_llana: `Ya rechazada el ${d?.fecha || previa.fecha_decision || "?"}${d?.motivo ? ` por "${d.motivo}"` : ""}; la evidencia ha pasado de ${antes} a ${n.evidencia_n}. ${n.explicacion_llana}`,
        });
      } else {
        silenciadas.push(n.id);
        if (previa.evidencia_n_al_rechazar == null && previa.evidencia_n != null) porId.set(n.id, { ...previa, evidencia_n_al_rechazar: previa.evidencia_n });
      }
      continue;
    }
    if (previa.estado === "propuesta") porId.set(n.id, { ...previa, ...n, fecha: previa.fecha, ultima_revision: hoy });
    // Un cambio automático que se repite (otro paso de la misma regla) se
    // actualiza en la misma entrada: Mikel ve una sola, con el último valor.
    else if (n.estado === "aplicada") porId.set(n.id, { ...previa, ...n, fecha: previa.fecha, fecha_aplicada: hoy });
  }
  const decidir = candidatas.filter((n) => n.estado === "propuesta").sort((a, b) => (b.impacto ?? 2) - (a.impacto ?? 2));
  const aplicadas = candidatas.filter((n) => n.estado !== "propuesta");
  const enEspera = decidir.slice(maxNuevas).map((n) => n.id);
  for (const n of aplicadas) { porId.set(n.id, { ...n, fecha_aplicada: hoy }); regeneradas.add(n.id); }
  for (const n of decidir.slice(0, maxNuevas)) { porId.set(n.id, n); regeneradas.add(n.id); }
  for (const [id, p] of porId) {
    if (p.origen === origen && p.estado === "propuesta" && !regeneradas.has(id)) porId.delete(id);
  }
  const lista = [...porId.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
  return { propuestas: lista, silenciadas, enEspera };
}

// Tasa de aceptación por tipo con suavizado (aceptadas + 1) / (decididas + 2),
// la misma de comun: los tipos que Mikel acepta suben y los que rechaza bajan.
export function tasasAceptacion(decisiones = [], propuestas = []) {
  const tipoDe = new Map(propuestas.map((p) => [p.id, p.tipo]));
  const t = {};
  for (const d of decisiones) {
    if (d.decision !== "si" && d.decision !== "no") continue;
    const tipo = d.tipo || tipoDe.get(idDe(d)) || "desconocido";
    t[tipo] ||= { si: 0, no: 0 };
    t[tipo][d.decision]++;
  }
  for (const v of Object.values(t)) v.tasa = +((v.si + 1) / (v.si + v.no + 2)).toFixed(2);
  return t;
}

// Reglas que el ajuste automático no vuelve a tocar: las de un cambio
// automático al que Mikel dijo que no.
export function reglasBloqueadas(decisiones = [], propuestas = []) {
  const porId = new Map(propuestas.map((p) => [p.id, p]));
  const s = new Set();
  for (const d of decisiones) {
    if (d.decision !== "no") continue;
    const p = porId.get(idDe(d));
    if (p?.detalle?.tipo === "confianza" && p.detalle.regla) s.add(p.detalle.regla);
  }
  return s;
}
