// scripts/aprendizaje/senales.mjs
//
// Señales que no son el ajuste de pesos pero hacen el índice más rico y
// autónomo (2026-10-09). Sin IA, sin red:
//
//   - reglasSinUso(): reglas que nunca se activan aunque hubo casos en su
//     ámbito (poda propuesta, nunca automática).
//   - estacionalidad(): meses con observaciones abiertas (GBIF/iNaturalist,
//     solo CC0/CC BY) que la ficha no da como temporada, corrigiendo por el
//     esfuerzo de observación de cada mes.
//   - etiquetarCamaras(): aprendizaje activo; qué fotogramas de las cámaras
//     conviene etiquetar primero (los que más enseñan a la calibración).
//   - especializacionRegional(): una regla que en una región se comporta
//     claramente distinto que en el resto.

import { enAmbito } from "../../assets/js/reglas-expertas.js";
import { ajustarMultiplicadores, estadisticasUnidades } from "./ajuste.mjs";

const ESPUMA_MINIMA = 0.003; // = functions/_lib/oleaje-camaras.js

export function reglasSinUso(datos, casos, { minEnAmbito = 40 } = {}) {
  const grupos = datos.reglas_expertas.grupos_especies;
  const activas = new Map();
  for (const c of casos) for (const t of c.terminos || []) if (t.u.startsWith("regla:") && t.lo) activas.set(t.u.slice(6), (activas.get(t.u.slice(6)) || 0) + 1);
  const r = [];
  for (const regla of datos.reglas_expertas.reglas) {
    if (regla.estado === "retirada") continue;
    const enSuAmbito = casos.filter((c) => c.indice?.especie && enAmbito(regla, { especieId: c.indice.especie, modalidad: c.modalidad, region: c.region, mes: c.mes }, grupos));
    const n = activas.get(regla.id) || 0;
    if (enSuAmbito.length >= minEnAmbito && n === 0) r.push({ regla: regla.id, en_ambito: enSuAmbito.length, activa: 0, casos: enSuAmbito });
  }
  return r;
}

// filasObs: filas de datos-robots/observaciones/comercial/*.json ({ e, f, reg }).
export function estacionalidad(datos, filasObs, { minEspecie = 30, minMes = 8, ratioMin = 0.8 } = {}) {
  const porRegMes = new Map(), porReg = new Map(), porEsp = new Map(), porEspMes = new Map();
  for (const f of filasObs) {
    if (!f.e || !f.reg || !f.f) continue;
    const mes = Number(f.f.slice(5, 7));
    const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    inc(porRegMes, `${f.reg}|${mes}`); inc(porReg, f.reg); inc(porEsp, `${f.e}|${f.reg}`); inc(porEspMes, `${f.e}|${f.reg}|${mes}`);
  }
  const hallazgos = [];
  for (const e of datos.especies) {
    for (const reg of Array.isArray(datos.regiones) ? datos.regiones : Object.keys(datos.regiones || {})) {
      const nE = porEsp.get(`${e.id}|${reg}`) || 0;
      if (nE < minEspecie) continue;
      const meses = e.presencia?.[reg]?.meses || null;
      const nR = porReg.get(reg) || 0;
      for (let mes = 1; mes <= 12; mes++) {
        const nEM = porEspMes.get(`${e.id}|${reg}|${mes}`) || 0;
        const nRM = porRegMes.get(`${reg}|${mes}`) || 0;
        if (nEM < minMes || !nRM) continue;
        // Cuota de la especie en ese mes frente a la cuota de TODAS las
        // observaciones de la región en ese mes (corrige que en verano hay
        // más gente buceando y mirando).
        const ratio = (nEM / nE) / (nRM / nR);
        if (ratio >= ratioMin && (!meses || !meses.includes(mes))) {
          hallazgos.push({ especie: e.id, region: reg, mes, observaciones: nEM, total_especie: nE, ratio: +ratio.toFixed(2), sin_presencia: !meses });
        }
      }
    }
  }
  return hallazgos;
}

// lineas: espuma.jsonl; calibracion: calibracion.json. Devuelve hasta `max`
// fotogramas: primero cámaras que aún no sustituyen al modelo y a las que
// les faltan etiquetas; dentro, los de espuma fuera del rango ya calibrado
// (lo que más amplía la escala) o donde cámara y modelo discrepan más.
export function etiquetarCamaras(lineas, calibracion, { desde = 0, max = 12 } = {}) {
  const cal = calibracion?.calibracion || {};
  const candidatas = [];
  for (const l of lineas) {
    if (Date.parse(l.fecha) < desde) continue;
    if (l.estado !== "ok" || !(l.espuma > ESPUMA_MINIMA) || l.sustituyeModelo === true) continue;
    const k = `${l.camara}/${l.encuadre}`;
    const c = cal[k];
    const etiquetas = (c?.nEtiquetas || 0) + (c?.nEtiquetasClaude || 0);
    let ganancia = 1 / (1 + etiquetas);
    let motivo = "pocas etiquetas en este encuadre";
    if (c && Number.isFinite(c.hMin) && Number.isFinite(c.hMax) && Number.isFinite(l.estimacion)) {
      if (l.estimacion > c.hMax * 1.2 || l.estimacion < c.hMin / 1.2) { ganancia += 1; motivo = "ola fuera del rango ya calibrado"; }
    }
    const modelo = l.modeloCamara ?? l.marAbierto?.modeloCamara;
    if (Number.isFinite(l.estimacion) && Number.isFinite(modelo) && modelo > 0) {
      const disc = Math.abs(Math.log(l.estimacion / modelo));
      if (disc > Math.log(1.6)) { ganancia += disc; motivo = "cámara y modelo discrepan mucho"; }
    }
    candidatas.push({ camara: l.camara, encuadre: l.encuadre, fecha: l.fecha, espuma: l.espuma, estimacion: l.estimacion ?? null, modelo: modelo ?? null, ganancia: +ganancia.toFixed(3), motivo });
  }
  // Uno por cámara y franja de 2 h: mirar dos veces el mismo mar no enseña más.
  const vistos = new Set();
  return candidatas.sort((a, b) => b.ganancia - a.ganancia).filter((c) => {
    const k = `${c.camara}|${c.fecha.slice(0, 11)}${Math.floor(Number(c.fecha.slice(11, 13)) / 2)}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, max);
}

// Para cada regla con casos suficientes en una región: su multiplicador en
// esa región, encogido hacia el global. Solo informa (y propone dividir la
// regla por región si la diferencia es clara).
export function especializacionRegional(casos, ajusteGlobal, { minCasos = 30, tau = 0.15 } = {}) {
  const r = [];
  const regiones = [...new Set(casos.map((c) => c.region))];
  for (const [u, g] of Object.entries(ajusteGlobal)) {
    if (!u.startsWith("regla:")) continue;
    for (const reg of regiones) {
      const sub = casos.filter((c) => c.region === reg);
      if (sub.length === casos.length) continue; // una sola región: no hay "resto" con el que comparar
      const est = estadisticasUnidades(sub).get(u);
      if (!est || est.n < minCasos) continue;
      const a = ajustarMultiplicadores(sub, [u], { prior: { [u]: { centro: g.m, tau } } })[u];
      if (Math.abs(a.m - g.m) > 0.2 && Math.abs(a.m - g.m) > 2 * a.sd) r.push({ unidad: u, region: reg, m_region: a.m, sd: a.sd, m_global: g.m, n: est.n, casos: sub.filter((c) => (c.terminos || []).some((t) => t.u === u && t.lo)) });
    }
  }
  return r;
}
