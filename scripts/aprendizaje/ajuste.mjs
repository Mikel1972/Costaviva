// scripts/aprendizaje/ajuste.mjs
//
// Ajuste automático de pesos del índice, con encogimiento bayesiano hacia
// el criterio experto (2026-10-09). Sin IA, sin red.
//
// Modelo: P = σ(b0 + Σ m_u · L_u), donde L_u es el log-odds que la unidad u
// (un factor base o una regla experta) aportó en ese caso y m_u un
// multiplicador. El criterio experto de hoy es m_u = 1. Se busca el m_u más
// probable con una "creencia previa" normal centrada en 1 (desviación
// TAU_PRIOR): con pocos datos m_u apenas se mueve de 1; solo muchos casos
// que apunten en la misma dirección lo mueven. La incertidumbre (± sd) sale
// de la curvatura (aproximación de Laplace).
//
// Las barreras de seguridad (cuánto puede moverse por semana, cuándo se
// aplica solo y cuándo se pregunta a Mikel) están en cambiosSeguros().

import { probTerminos, sumaPorUnidad } from "./rejugar.mjs";
import { logLoss, brier, auc } from "./metricas.mjs";

export const B0 = "__b0";

// Resuelve A x = b (Gauss con pivote parcial). Devuelve null si es singular.
export function resolver(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let f = c + 1; f < n; f++) if (Math.abs(M[f][c]) > Math.abs(M[piv][c])) piv = f;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let f = 0; f < n; f++) {
      if (f === c) continue;
      const k = M[f][c] / M[c][c];
      for (let j = c; j <= n; j++) M[f][j] -= k * M[c][j];
    }
  }
  return M.map((fila, i) => fila[n] / fila[i]);
}

function diagInversa(H) {
  const n = H.length;
  return H.map((_, i) => {
    const e = new Array(n).fill(0);
    e[i] = 1;
    const x = resolver(H, e);
    return x ? x[i] : Infinity;
  });
}

// casos: [{ y, terminos: [{u, lo}] }]. unidades: las que se ajustan; el
// resto queda fijo a 1. prior: { u: { centro, tau } }. b0: término fijo.
// conB0: ajusta también un desplazamiento del término independiente.
export function ajustarMultiplicadores(casos, unidades, { prior = {}, tauPorDefecto = 0.25, b0 = 0, conB0 = false, tauB0 = 0.5, iteraciones = 30 } = {}) {
  const us = [...unidades, ...(conB0 ? [B0] : [])];
  const k = us.length;
  const centro = us.map((u) => (u === B0 ? 0 : prior[u]?.centro ?? 1));
  const tau = us.map((u) => (u === B0 ? tauB0 : prior[u]?.tau ?? tauPorDefecto));
  const filas = casos.map((c) => {
    const s = sumaPorUnidad(c.terminos);
    const x = us.map((u) => (u === B0 ? 1 : s.get(u) || 0));
    let fijo = b0;
    for (const [u, lo] of s) if (!unidades.includes(u)) fijo += lo;
    return { y: c.y, x, fijo };
  });
  const m = [...centro];
  let H = null;
  for (let it = 0; it < iteraciones; it++) {
    const g = us.map((_, a) => (m[a] - centro[a]) / tau[a] ** 2);
    H = us.map((_, a) => us.map((__, b) => (a === b ? 1 / tau[a] ** 2 : 0)));
    for (const f of filas) {
      let z = f.fijo;
      for (let a = 0; a < k; a++) z += m[a] * f.x[a];
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p);
      for (let a = 0; a < k; a++) {
        if (!f.x[a]) continue;
        g[a] += (p - f.y) * f.x[a];
        for (let b = 0; b < k; b++) if (f.x[b]) H[a][b] += w * f.x[a] * f.x[b];
      }
    }
    const paso = resolver(H, g);
    if (!paso) break;
    let max = 0;
    for (let a = 0; a < k; a++) { m[a] -= paso[a]; max = Math.max(max, Math.abs(paso[a])); }
    if (max < 1e-7) break;
  }
  const varianzas = H ? diagInversa(H) : us.map(() => Infinity);
  const r = {};
  us.forEach((u, a) => { r[u] = { m: +m[a].toFixed(4), sd: +Math.sqrt(Math.max(0, varianzas[a])).toFixed(4) }; });
  return r;
}

// Recuento por unidad: en cuántos casos aportó algo, de cuántos usuarios y
// con qué resultado (tasa de pesca con aporte positivo / negativo).
export function estadisticasUnidades(casos) {
  const est = new Map();
  for (const c of casos) {
    for (const [u, lo] of sumaPorUnidad(c.terminos)) {
      if (!lo) continue;
      const e = est.get(u) || { u, n: 0, usuarios: new Set(), propios: 0, sumaLo: 0, pos: { n: 0, y: 0 }, neg: { n: 0, y: 0 } };
      e.n++; e.usuarios.add(c.usuario); if (c.propio) e.propios++;
      e.sumaLo += lo;
      const lado = lo > 0 ? e.pos : e.neg;
      lado.n++; lado.y += c.y;
      est.set(u, e);
    }
  }
  return est;
}

// Ablación: ¿cuánto empeora (o mejora) el log-loss si la unidad se quita?
// > 0 = la unidad ayuda; < 0 = estorba.
export function ablacion(casos, u, b0 = 0) {
  const ys = casos.map((c) => c.y);
  const base = casos.map((c) => probTerminos(c.terminos, {}, b0));
  const sin = casos.map((c) => probTerminos(c.terminos, { [u]: 0 }, b0));
  return +(logLoss(sin, ys) - logLoss(base, ys)).toFixed(5);
}

export function metricasCon(casos, mult = {}, b0 = 0) {
  const ys = casos.map((c) => c.y);
  const ps = casos.map((c) => probTerminos(c.terminos, mult, b0));
  return { n: ys.length, logloss: logLoss(ps, ys), brier: brier(ps, ys), auc: auc(ps, ys), ps, ys };
}

// ---------------------------------------------------------------------------
// Barreras de seguridad (config en aprendizaje/config.json, "ajuste")
// ---------------------------------------------------------------------------
export const CONFIG_POR_DEFECTO = {
  auto_aplicar: true,
  tau_prior: 0.25,
  min_casos_total: 80,
  min_positivos: 15,
  min_negativos: 15,
  min_casos_unidad: 30,
  min_usuarios_unidad: 5,
  paso_max_semana: 0.2,
  deriva_max_desde_experto: 0.5,
  max_cambios_semana: 3,
  mejora_min_logloss: 0.002,
  max_caida_auc: 0.01,
  panel_max_media_puntos: 3,
  panel_max_puntos: 10,
};

// Propuestas de cambio a partir del ajuste. Devuelve
// { automaticos: [...], a_preguntar: [...], descartados: [...] }.
// Solo `confianza` de reglas expertas puede ir en automático; los pesos
// base, el b0, retirar o especializar reglas siempre se preguntan.
export function cambiosSeguros({ ajuste, estadisticas, datos, config = CONFIG_POR_DEFECTO, bloqueadas = new Set(), totales }) {
  const cfg = { ...CONFIG_POR_DEFECTO, ...config };
  const automaticos = [], a_preguntar = [], descartados = [];
  const reglas = new Map(datos.reglas_expertas.reglas.map((r) => [`regla:${r.id}`, r]));
  const suficientesTotales = totales.n >= cfg.min_casos_total && totales.positivos >= cfg.min_positivos && totales.negativos >= cfg.min_negativos;
  for (const [u, { m, sd }] of Object.entries(ajuste)) {
    if (u === B0) {
      if (suficientesTotales && Math.abs(m) >= 0.2 && Math.abs(m) > 2 * sd) {
        a_preguntar.push({ u, tipo: "b0", actual: datos.indice?.b0_logodds ?? 0, propuesto: +((datos.indice?.b0_logodds ?? 0) + m).toFixed(2), m, sd, motivo: m < 0 ? "el índice promete más de lo que se pesca" : "el índice se queda corto" });
      }
      continue;
    }
    const e = estadisticas.get(u);
    const usuarios = e ? e.usuarios.size : 0;
    // Nunca con una sola persona como fuente (comun, aprendizaje.md L4): los
    // datos del dueño se publican agregados, pero no bastan para cambiar pesos.
    const evidencia = e && e.n >= cfg.min_casos_unidad && usuarios >= cfg.min_usuarios_unidad;
    const movimiento = m - 1;
    const claro = Math.abs(movimiento) >= 0.05 && Math.abs(movimiento) > sd;
    if (!evidencia || !suficientesTotales) { descartados.push({ u, m, sd, motivo: "pocos casos" }); continue; }
    if (!claro) { descartados.push({ u, m, sd, motivo: "los datos no se alejan del criterio experto" }); continue; }
    const regla = reglas.get(u);
    if (!regla) {
      // Factor base (luz, marea...): se pregunta siempre.
      a_preguntar.push({ u, tipo: "peso_defecto", factor: u, m, sd, actual: datos.reglas_por_defecto?.[u]?.peso_lo ?? null,
        propuesto: datos.reglas_por_defecto?.[u]?.peso_lo != null ? +(datos.reglas_por_defecto[u].peso_lo * Math.max(1 - cfg.paso_max_semana, Math.min(1 + cfg.paso_max_semana, m))).toFixed(3) : null });
      continue;
    }
    // Reglas de 〰 Frentes (`retirar_si_nulo`, 2026-10-09): entran con peso
    // pequeño "a prueba"; si con las barreras cumplidas los datos tiran hacia
    // abajo y no se distinguen de cero (m < 0,7 y m - 2·sd ≤ 0), se propone
    // desactivarla (sí/no de Mikel) en vez de irla rebajando semana a semana.
    if (regla.retirar_si_nulo === true && m > 0.3 && m < 0.7 && m - 2 * sd <= 0) {
      a_preguntar.push({ u, tipo: "retirar", regla: regla.id, m, sd, motivo: "con los datos del diario la regla no se distingue de no tenerla (efecto nulo)" });
      continue;
    }
    if (m <= 0.3) {
      // Los datos dicen que la regla casi no sirve (o va al revés): retirarla
      // o darle la vuelta no es un ajuste de peso, lo decide Mikel.
      a_preguntar.push({ u, tipo: "retirar", regla: regla.id, m, sd, motivo: m < 0 ? "los datos dicen lo contrario de la regla" : "la regla casi no explica nada" });
      continue;
    }
    const bloqueo = regla.tipo === "oficial" || regla.bloqueo_auto === true || bloqueadas.has(regla.id);
    const experta = regla.confianza_experta ?? regla.confianza;
    const factor = Math.max(1 - cfg.paso_max_semana, Math.min(1 + cfg.paso_max_semana, m));
    let nueva = +(regla.confianza * factor).toFixed(2);
    nueva = Math.max(experta * (1 - cfg.deriva_max_desde_experto), Math.min(experta * (1 + cfg.deriva_max_desde_experto), nueva));
    nueva = +Math.max(0.05, Math.min(1, nueva)).toFixed(2);
    if (nueva === regla.confianza) {
      a_preguntar.push({ u, tipo: "limite", regla: regla.id, m, sd, motivo: "el ajuste pide más de lo que permiten los límites (confianza 1 o ±50 % del criterio experto)" });
      continue;
    }
    const cambio = { u, tipo: "confianza", regla: regla.id, actual: regla.confianza, propuesto: nueva, experta, m, sd, n: e.n, usuarios };
    if (bloqueo) a_preguntar.push({ ...cambio, motivo: "regla bloqueada para el ajuste automático" });
    else automaticos.push(cambio);
  }
  automaticos.sort((a, b) => Math.abs(Math.log(b.m)) / (b.sd || 1) - Math.abs(Math.log(a.m)) / (a.sd || 1));
  const sobran = automaticos.splice(cfg.max_cambios_semana);
  for (const s of sobran) a_preguntar.push({ ...s, motivo: `más de ${cfg.max_cambios_semana} cambios en una semana: este espera` });
  return { automaticos, a_preguntar, descartados };
}

// Multiplicadores equivalentes a unos cambios de confianza (para rejugar).
export function multiplicadoresDeCambios(cambios) {
  const m = {};
  for (const c of cambios) if (c.tipo === "confianza") m[`regla:${c.regla}`] = c.propuesto / c.actual;
  return m;
}

// ¿Los cambios mejoran en los casos de PRUEBA (los más recientes, no usados
// para ajustar)? Criterios en config: log-loss baja al menos
// mejora_min_logloss, el Brier no empeora y el AUC no cae más de max_caida_auc.
export function validarEnPrueba(prueba, cambios, { b0 = 0, config = CONFIG_POR_DEFECTO } = {}) {
  const cfg = { ...CONFIG_POR_DEFECTO, ...config };
  const antes = metricasCon(prueba, {}, b0);
  const despues = metricasCon(prueba, multiplicadoresDeCambios(cambios), b0);
  const motivos = [];
  if (!prueba.length) motivos.push("sin casos de prueba");
  else {
    if (!(antes.logloss - despues.logloss >= cfg.mejora_min_logloss)) motivos.push("el log-loss no mejora lo suficiente");
    if (despues.brier > antes.brier + 1e-9) motivos.push("el Brier empeora");
    if (antes.auc !== null && despues.auc !== null && despues.auc < antes.auc - cfg.max_caida_auc) motivos.push("el AUC cae");
  }
  const r4 = (x) => (x === null || x === undefined ? null : +x.toFixed(4));
  return {
    ok: motivos.length === 0, motivos,
    antes: { n: antes.n, logloss: r4(antes.logloss), brier: r4(antes.brier), auc: r4(antes.auc) },
    despues: { n: despues.n, logloss: r4(despues.logloss), brier: r4(despues.brier), auc: r4(despues.auc) },
  };
}
