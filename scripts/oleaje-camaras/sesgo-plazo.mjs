// scripts/oleaje-camaras/sesgo-plazo.mjs — lo que dijimos frente a lo que
// pasó (2026-11-19, Mikel: "el robot debe aprender sobre nuestras
// predicciones y la realidad, por ejemplo con los cálculos propios de la
// cámara o con validaciones de usuarios, para ir afinando nuestro propio
// modelo").
//
// Sin IA. Cada día medir-espuma.mjs archiva la ola en la orilla que
// PREVEÍAMOS para cada cámara las próximas 72 h
// (datos-robots/oleaje-camaras/pronosticos/AAAA-MM-DD.json). Aquí se cruza
// cada hora prevista con la realidad de esa hora y de esa cámara:
//   - etiquetas de fotos (Mikel) y "ola real que veo" de los usuarios: la
//     verdad buena (centro de su banda);
//   - la estimación propia de la cámara, solo cuando su calibración ya es
//     fiable (error relativo < ERROR_MAX_CAMARA) y con menos peso.
// Se aprende, por cámara y plazo (horas entre que lo dijimos y la hora
// prevista), el cociente real / previsto en logaritmos, encogido hacia 1
// con K_PLAZO de peso: con pocos datos no corrige nada. La app lo aplica a
// la ola en la orilla de los spots de esa cámara (functions/_lib/
// sesgo-plazo.js) solo con N_MIN_PLAZO comparaciones o más.
export const PLAZOS = [[0, 6], [6, 24], [24, 48], [48, 72]];
export const K_PLAZO = 10;
export const N_MIN_PLAZO = 20;
export const ERROR_MAX_CAMARA = 0.6;
export const PESO_CAMARA = 0.3;
export const TOLERANCIA_MIN = 45;
const HORA = 3600e3;

export const tramoPlazo = (h) => {
  const i = PLAZOS.findIndex(([a, b]) => h >= a && h < b);
  return i < 0 ? null : `${PLAZOS[i][0]}-${PLAZOS[i][1]}`;
};

// Verdades: [{ camara, fecha (ISO), altura (m), peso, origen }]
export function verdades(etiquetas, historial, centroBanda) {
  const out = [];
  for (const e of etiquetas || []) {
    const h = centroBanda(e.banda);
    if (e.camara && Number.isFinite(h) && Number.isFinite(Date.parse(e.fecha))) out.push({ camara: e.camara, fecha: e.fecha, altura: h, peso: 1, origen: e.origen || "foto" });
  }
  for (const l of historial || []) {
    const est = l?.estimacionCamara;
    if (!l?.camara || !est || !Number.isFinite(est.estimacion) || !Number.isFinite(Date.parse(l.fecha))) continue;
    const err = l.calibracion?.errorRel;
    if (!(Number.isFinite(err) && err < ERROR_MAX_CAMARA)) continue;
    out.push({ camara: l.camara, fecha: l.fecha, altura: est.estimacion, peso: PESO_CAMARA, origen: "camara" });
  }
  return out;
}

// archivos: [{ generado (ISO), desde (ISO, hora 0), camaras: { id: { orilla: [m por hora] } } }]
// Devuelve pares { camara, plazo (h), previsto, real, peso, origen }.
export function parear(archivos, verdadesLista) {
  const porCam = {};
  for (const v of verdadesLista) (porCam[v.camara] ||= []).push({ ...v, t: Date.parse(v.fecha) });
  const pares = [];
  for (const a of archivos || []) {
    const gen = Date.parse(a.generado), desde = Date.parse(a.desde);
    for (const [cam, serie] of Object.entries(a.camaras || {})) {
      for (const v of porCam[cam] || []) {
        if (v.t < gen) continue; // solo lo que estaba en el futuro al decirlo
        const k = Math.round((v.t - desde) / HORA);
        const prev = serie.orilla?.[k];
        if (!Number.isFinite(prev) || prev <= 0.05) continue;
        if (Math.abs(v.t - (desde + k * HORA)) > TOLERANCIA_MIN * 60e3) continue;
        pares.push({ camara: cam, plazo: (v.t - gen) / HORA, previsto: prev, real: v.altura, peso: v.peso, origen: v.origen });
      }
    }
  }
  return pares;
}

// Modelo: { generado, k, camaras: { cam: { "0-6": { factor, n, mae, maeCorregido }, ... } }, global: {...} }
export function aprenderSesgo(pares, { k = K_PLAZO, ahora = new Date() } = {}) {
  const celdas = {};
  for (const p of pares) {
    const tr = tramoPlazo(p.plazo);
    if (!tr || !(p.real > 0)) continue;
    for (const clave of [`${p.camara}|${tr}`, `*|${tr}`]) (celdas[clave] ||= []).push(p);
  }
  const modelo = { generado: ahora.toISOString(), k, nMin: N_MIN_PLAZO, camaras: {}, global: {} };
  for (const [clave, ps] of Object.entries(celdas)) {
    const [cam, tr] = clave.split("|");
    const w = ps.reduce((a, p) => a + p.peso, 0);
    const media = ps.reduce((a, p) => a + p.peso * Math.log(p.real / p.previsto), 0) / w;
    const log = (w * media) / (w + k); // encogido hacia 0 (factor 1)
    const factor = +Math.exp(log).toFixed(3);
    const mae = ps.reduce((a, p) => a + p.peso * Math.abs(p.real - p.previsto), 0) / w;
    const maeCorregido = ps.reduce((a, p) => a + p.peso * Math.abs(p.real - p.previsto * factor), 0) / w;
    const celda = { factor, n: ps.length, peso: +w.toFixed(1), mae: +mae.toFixed(2), maeCorregido: +maeCorregido.toFixed(2) };
    if (cam === "*") modelo.global[tr] = celda;
    else (modelo.camaras[cam] ||= {})[tr] = celda;
  }
  return modelo;
}
