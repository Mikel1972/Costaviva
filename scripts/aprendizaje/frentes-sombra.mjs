// scripts/aprendizaje/frentes-sombra.mjs
//
// Evaluación EN LA SOMBRA de frentes, clorofila y corrientes (2026-10-09,
// decisión de Mikel: "hay que validar para todas las artes y especies").
// No toca el índice en vivo. Cada semana, para cada salida del diario, mira
// la capa 〰 Frentes de SU día (copia diaria capas/historico/frentes-AAAA-MM-DD.json
// que deja scripts/fuentes/descargar-capas.py) y saca unos rasgos binarios
// (¿frente a ≤ R km?, ¿clorofila baja/moderada/alta?, ¿corriente fuerte?).
// Para cada combinación modalidad × especie de especies.json y cada rasgo
// estima su efecto en log-odds SIN presuponer el signo (prior centrado en 0)
// por encima de lo que ya decía el índice de esa especie, con las mismas
// barreras de muestra y privacidad que el ajuste de reglas (config.json,
// `ajuste`) y validación fuera de muestra. Solo lo que las supera se
// propone (propuestas.json, sí/no de Mikel); el resto sigue acumulando.
//
// Puro salvo zlib (sin red): la descarga la hace datos.mjs.

import { inflateSync } from "node:zlib";
import { rasgosPunto } from "../../assets/js/frentes.js";
import { sigmoide } from "../../assets/js/ventana-actividad.js";
import { publicable } from "./privacidad.mjs";

// Rasgos que se evalúan (todos binarios: 1 = se da, 0 = no, null = sin dato).
export const VARIABLES_SOMBRA = [
  { id: "frente_clorofila", texto: "borde de clorofila cerca" },
  { id: "frente_termico", texto: "cambio brusco de temperatura del agua cerca" },
  { id: "frente_ambos", texto: "borde de clorofila y de temperatura a la vez cerca" },
  { id: "convergencia", texto: "corriente que junta el agua cerca" },
  { id: "frente_y_corriente", texto: "frente donde la corriente junta el agua cerca" },
  { id: "clorofila_baja", texto: "agua azul, poca clorofila" },
  { id: "clorofila_moderada", texto: "agua verdosa, clorofila moderada" },
  { id: "clorofila_alta", texto: "mucha clorofila (posible floración, agua turbia)" },
  { id: "corriente_fuerte", texto: "corriente fuerte en el spot" },
];
// "Cerca" según cómo se pesca: desde costa o buceando, lo que llega a la
// orilla; en barco, lo que se alcanza en una salida normal. Elección de
// Claude (2026-10-09), revisable con los datos.
export const RADIO_KM = { costa: 10, submarina: 10, embarcacion: 20 };
// 0,25 m/s ≈ medio nudo: corriente que ya se nota en el sedal y al bucear.
export const CORRIENTE_FUERTE_MS = 0.25;

export const CONFIG_SOMBRA = { z_min: 3, tau_beta: 0.5, tau_a: 1.5, fraccion_prueba: 0.3 };

// ---------------------------------------------------------------------------
// Histórico diario de la capa
// ---------------------------------------------------------------------------
export function decodificarHistorico(h) {
  if (!h || h.capa !== "frentes-historico") return null;
  const bytes = new Uint8Array(inflateSync(Buffer.from(h.codigos_zlib, "base64")));
  const vel = h.velocidad_zlib ? new Uint8Array(inflateSync(Buffer.from(h.velocidad_zlib, "base64"))) : null;
  if (bytes.length !== h.filas * h.columnas) return null;
  return { d: h, bytes, vel };
}

// Rasgos binarios de un caso con la capa de su día (null si no hay capa o
// el punto cae fuera de ella).
export function rasgosCaso(hist, caso) {
  if (!hist) return null;
  const r = rasgosPunto(hist.d, hist.bytes, caso.lat, caso.lon, { radioKm: RADIO_KM[caso.modalidad] ?? 10, vel: hist.vel });
  if (!r) return null;
  const b = (x) => (x === null || x === undefined ? null : x ? 1 : 0);
  const nivel = r.nivel_clorofila;
  return {
    frente_clorofila: b(r.frente_clorofila), frente_termico: b(r.frente_termico), frente_ambos: b(r.frente_ambos),
    convergencia: b(r.convergencia), frente_y_corriente: b(r.frente_y_corriente),
    clorofila_baja: nivel === null ? null : b(nivel === "baja"),
    clorofila_moderada: nivel === null ? null : b(nivel === "moderada"),
    clorofila_alta: nivel === null ? null : b(nivel === "alta"),
    corriente_fuerte: r.corriente_ms === null ? null : b(r.corriente_ms >= CORRIENTE_FUERTE_MS),
  };
}

// ---------------------------------------------------------------------------
// Ajuste de un efecto: y ~ σ(off + a + β·x), priors a ~ N(0, τa²) (desajuste
// de calibración de la especie) y β ~ N(0, τβ²) (sin signo supuesto).
// Newton + Laplace: devuelve β y su desviación.
// ---------------------------------------------------------------------------
const logit = (p) => Math.log(p / (1 - p));
export function ajustarEfecto(filas, { tauA = CONFIG_SOMBRA.tau_a, tauB = CONFIG_SOMBRA.tau_beta, conBeta = true } = {}) {
  let a = 0, b = 0, H = null;
  for (let it = 0; it < 40; it++) {
    let ga = -a / tauA ** 2, gb = conBeta ? -b / tauB ** 2 : 0;
    let haa = 1 / tauA ** 2, hab = 0, hbb = conBeta ? 1 / tauB ** 2 : 1;
    for (const f of filas) {
      const p = sigmoide(f.off + a + b * f.x);
      const w = p * (1 - p);
      ga += f.y - p; haa += w;
      if (conBeta) { gb += f.x * (f.y - p); hab += w * f.x; hbb += w * f.x * f.x; }
    }
    const det = haa * hbb - hab * hab;
    const da = (hbb * ga - hab * gb) / det, db = conBeta ? (haa * gb - hab * ga) / det : 0;
    a += da; b += db;
    H = { haa, hab, hbb, det };
    if (Math.abs(da) + Math.abs(db) < 1e-8) break;
  }
  const sd = conBeta ? Math.sqrt(H.haa / H.det) : null;
  return { a, beta: b, sd };
}

function logLossFilas(filas, a, b) {
  let s = 0;
  for (const f of filas) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, sigmoide(f.off + a + b * f.x)));
    s -= f.y ? Math.log(p) : Math.log(1 - p);
  }
  return filas.length ? s / filas.length : null;
}

// Probabilidad del índice para ESA especie a la hora del caso (su entrada
// del ranking; si no está, la del índice del spot).
function probEspecie(c, especie) {
  const r = c.indice?.ranking?.find((x) => x.id === especie);
  const p = r && Number.isFinite(r.p) ? r.p / 100 : c.indice?.p;
  return Number.isFinite(p) ? Math.min(0.98, Math.max(0.02, p)) : null;
}

// ---------------------------------------------------------------------------
// Evaluación de todas las combinaciones
// ---------------------------------------------------------------------------
const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);

export function evaluarSombra(casos, rasgosPorRef, datos, cfgAjuste = {}, cfgSombra = {}) {
  const cfg = { min_casos_total: 80, min_positivos: 15, min_negativos: 15, min_casos_unidad: 30, min_usuarios_unidad: 5, mejora_min_logloss: 0.002, ...cfgAjuste };
  const cs = { ...CONFIG_SOMBRA, ...cfgSombra };
  const conRasgos = casos.filter((c) => rasgosPorRef.get(c.ref));
  const modalidades = [...new Set([...Object.keys(RADIO_KM), ...conRasgos.map((c) => c.modalidad)])].sort();
  const combinaciones = [];
  for (const m of modalidades) {
    const deM = conRasgos.filter((c) => c.modalidad === m);
    for (const e of datos.especies) {
      // Población: salidas de esa modalidad en las que la especie contaba
      // (estaba en el ranking del índice) o se pescó.
      const pob = deM.filter((c) => c.especies.includes(e.id) || c.indice?.ranking?.some((x) => x.id === e.id));
      if (!pob.length) continue;
      const variables = {};
      for (const v of VARIABLES_SOMBRA) {
        const filas = [];
        for (const c of pob) {
          const x = rasgosPorRef.get(c.ref)?.[v.id];
          const off = probEspecie(c, e.id);
          if (x === null || x === undefined || off === null) continue;
          filas.push({ c, x, y: c.especies.includes(e.id) ? 1 : 0, off: logit(off) });
        }
        variables[v.id] = evaluarVariable(filas, cfg, cs);
      }
      combinaciones.push({ modalidad: m, especie: e.id, n: pob.length, variables });
    }
  }
  const superan = [];
  for (const k of combinaciones) for (const [v, r] of Object.entries(k.variables)) if (r.supera) superan.push({ modalidad: k.modalidad, especie: k.especie, variable: v, ...r.publico });
  return { casos_con_capa: conRasgos.length, casos: casos.length, combinaciones, superan };
}

export function evaluarVariable(filas, cfg, cs = CONFIG_SOMBRA) {
  const casosF = filas.map((f) => f.c);
  const n = filas.length;
  const con = filas.filter((f) => f.x === 1);
  const pos = filas.filter((f) => f.y === 1).length;
  const motivos = [];
  if (n < cfg.min_casos_total) motivos.push(`${n} salidas (mínimo ${cfg.min_casos_total})`);
  if (pos < cfg.min_positivos || n - pos < cfg.min_negativos) motivos.push(`faltan salidas con y sin captura (mínimo ${cfg.min_positivos} de cada)`);
  if (con.length < cfg.min_casos_unidad || n - con.length < cfg.min_casos_unidad) motivos.push(`faltan salidas con y sin el rasgo (mínimo ${cfg.min_casos_unidad} de cada)`);
  const usuariosCon = new Set(con.map((f) => f.c.usuario)).size;
  if (usuariosCon < cfg.min_usuarios_unidad && !con.every((f) => f.c.propio)) motivos.push(`menos de ${cfg.min_usuarios_unidad} personas con el rasgo`);
  const pub = publicable(casosF);
  let ajuste = null, validacion = null;
  if (n >= 10 && con.length >= 3 && n - con.length >= 3) {
    ajuste = ajustarEfecto(filas, { tauA: cs.tau_a, tauB: cs.tau_beta });
    const z = ajuste.sd ? ajuste.beta / ajuste.sd : 0;
    ajuste.z = z;
    if (Math.abs(z) < cs.z_min) motivos.push(`efecto no claro (${r3(Math.abs(z))} desviaciones; hacen falta ${cs.z_min})`);
    // Fuera de muestra: se ajusta con lo más antiguo y se mira lo reciente.
    const orden = [...filas].sort((a, b) => a.c.fecha.localeCompare(b.c.fecha));
    const corte = Math.round(orden.length * (1 - cs.fraccion_prueba));
    const train = orden.slice(0, corte), test = orden.slice(corte);
    if (train.length >= 10 && test.length >= 5) {
      const con1 = ajustarEfecto(train, { tauA: cs.tau_a, tauB: cs.tau_beta });
      const sin1 = ajustarEfecto(train, { tauA: cs.tau_a, conBeta: false });
      const llCon = logLossFilas(test, con1.a, con1.beta), llSin = logLossFilas(test, sin1.a, 0);
      validacion = { mejora_logloss: llSin - llCon, mismo_signo: Math.sign(con1.beta) === Math.sign(ajuste.beta) };
      if (!(validacion.mejora_logloss >= cfg.mejora_min_logloss)) motivos.push("no mejora en las salidas más recientes");
      if (!validacion.mismo_signo) motivos.push("el signo cambia entre lo antiguo y lo reciente");
    } else motivos.push("sin salidas suficientes para validar fuera de muestra");
  } else if (!motivos.length) motivos.push("muy pocas salidas para estimar");
  if (!pub.ok) motivos.push("datos de menos de 5 personas");
  const supera = motivos.length === 0;
  // Lo publicable: solo agregados y solo con k ≥ 5 personas (o solo del dueño).
  const publico = pub.ok
    ? {
      n, con_rasgo: con.length, con_captura: pos,
      ...(ajuste ? { efecto_logodds: r3(ajuste.beta), sd: r3(ajuste.sd), z: r3(ajuste.z) } : {}),
      ...(validacion ? { mejora_logloss_reciente: r3(validacion.mejora_logloss) } : {}),
    }
    : { oculto: true, motivo: pub.motivo };
  return { supera, estado: supera ? "supera_barreras" : "sombra", motivos, publico };
}

// Versión publicable (repo público): sin casos, solo agregados k ≥ 5.
export function publicarSombra(ev) {
  return {
    casos: ev.casos, casos_con_capa: ev.casos_con_capa,
    combinaciones: ev.combinaciones.map((k) => ({
      modalidad: k.modalidad, especie: k.especie,
      variables: Object.fromEntries(Object.entries(k.variables).map(([v, r]) => [v, { estado: r.estado, ...r.publico, ...(r.supera || r.publico.oculto ? {} : { motivos: r.motivos }) }])),
    })),
    superan: ev.superan,
  };
}
