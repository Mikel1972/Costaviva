// functions/_lib/coef-costa.js — cuánta ola de mar abierto llega a la orilla
// de cada cámara, APRENDIDO de las etiquetas (2026-11-19, Mikel: "debemos
// medir por la medición de cámara y en los spots en los que no hay, inferimos
// de los spots cercanos [...] aprender, aprender y aprender").
//
// Por qué: el modelo (Open-Meteo) acierta el mar abierto (boya AP Bilbao
// 2,74 m medidos, 2,76 m calculados el 18/11 a las 22 UTC), pero eso no es
// lo que ve el pescador en la playa: con 3,6 m fuera, la cámara de Sopela veía
// ~1,4 m. Con 379 etiquetas hechas mirando las cámaras, la orilla recibe de
// mediana entre el 30 y el 40 % del mar abierto, y cambia con el tamaño del
// mar. Aquí se aprende ese cociente por cámara y por condiciones, sin IA, y
// cada etiqueta nueva lo afina.
//
// Modelo jerárquico (encogimiento hacia el nivel de arriba, K muestras de peso):
//   global -> cámara -> cámara × tamaño del mar -> × periodo
// El cociente se promedia en logaritmos (media geométrica: un 0,5 y un 2 se
// compensan). Con pocos datos en un nivel, manda el de arriba.
import { FUENTE_POR_SPOT } from "./oleaje-camaras.js";
import { ABRIGO_SPOTS, coeficienteDesdeParametros } from "./oleaje-costero.js";

export const K_ENCOGIMIENTO = 8;
export const COEF_MIN = 0.15;
export const COEF_MAX = 1.2;

export function tamanoMar(hs) {
  if (!Number.isFinite(hs)) return null;
  return hs < 1.5 ? "pequeno" : hs < 3 ? "medio" : "grande";
}
export function tipoPeriodo(t) {
  if (!Number.isFinite(t)) return null;
  return t < 10 ? "corto" : "largo";
}

function nivel(logs, padreLog, k = K_ENCOGIMIENTO) {
  const n = logs.length;
  const media = n ? logs.reduce((a, b) => a + b, 0) / n : 0;
  const log = (n * media + k * padreLog) / (n + k);
  return { log, coef: +Math.exp(log).toFixed(3), n };
}

// muestras: [{ camara, orilla (m, centro de la banda etiquetada), hs (mar
// abierto en ese momento), periodo }]. Devuelve el modelo aprendido (JSON).
export function aprenderCoefCosta(muestras, { k = K_ENCOGIMIENTO, ahora = new Date() } = {}) {
  const validas = (muestras || []).filter((m) => m && m.camara && m.orilla > 0 && m.hs > 0.05);
  const log = (m) => Math.log(m.orilla / m.hs);
  const todas = validas.map(log);
  const g = todas.length ? todas.reduce((a, b) => a + b, 0) / todas.length : Math.log(0.4);
  const modelo = { generado: ahora.toISOString(), n: todas.length, k, global: { coef: +Math.exp(g).toFixed(3), n: todas.length }, camaras: {} };
  const porCam = {};
  for (const m of validas) (porCam[m.camara] ||= []).push(m);
  for (const [cam, ms] of Object.entries(porCam)) {
    const c = nivel(ms.map(log), g, k);
    const tamanos = {};
    for (const t of ["pequeno", "medio", "grande"]) {
      const mt = ms.filter((m) => tamanoMar(m.hs) === t);
      if (!mt.length) continue;
      const nt = nivel(mt.map(log), c.log, k);
      const periodos = {};
      for (const p of ["corto", "largo"]) {
        const mp = mt.filter((m) => tipoPeriodo(m.periodo) === p);
        if (mp.length) { const np = nivel(mp.map(log), nt.log, k); periodos[p] = { coef: np.coef, n: np.n }; }
      }
      tamanos[t] = { coef: nt.coef, n: nt.n, periodos };
    }
    modelo.camaras[cam] = { coef: c.coef, n: c.n, tamanos };
  }
  return modelo;
}

const acotar = (c) => +Math.min(COEF_MAX, Math.max(COEF_MIN, c)).toFixed(3);

// Coeficiente para una cámara y unas condiciones: el nivel más concreto que
// haya aprendido (ya encogido hacia los de arriba). Sin la cámara: null.
export function coefCostaDe(modelo, camara, hs, periodo) {
  const c = modelo?.camaras?.[camara];
  if (!c) return null;
  const t = c.tamanos?.[tamanoMar(hs)];
  const p = t?.periodos?.[tipoPeriodo(periodo)];
  const elegido = p || t || c;
  return { coef: acotar(elegido.coef), n: elegido.n, nivel: p ? "camara_tamano_periodo" : t ? "camara_tamano" : "camara" };
}

// Spots sin cámara propia (vecinas, FUENTE_POR_SPOT): el coeficiente de la
// cámara cercana, rebajado hacia 1 según `peso` (la cámara no ve ese spot).
export function coefParaSpot(modelo, fuente, hs, periodo) {
  if (!fuente) return null;
  const c = coefCostaDe(modelo, fuente.camara, hs, periodo);
  if (!c) return null;
  const peso = fuente.propia ? 1 : Math.min(1, Math.max(0, fuente.peso ?? 0.5));
  return { ...c, coef: acotar(Math.pow(c.coef, peso)), camara: fuente.camara, propia: !!fuente.propia, peso };
}

// Coeficiente "orilla / mar abierto" de un SPOT (no de una cámara):
//   - cámara propia: el aprendido de su cámara (la cámara ve ese sitio; si
//     el spot es abrigado, el aprendido ya lo incluye y manda sobre la tabla
//     estática de oleaje-costero.js);
//   - vecina (FUENTE_POR_SPOT, misma costa): el de la cámara rebajado hacia 1
//     según su peso, y si el spot es abrigado, el menor entre ese y el abrigo
//     geométrico (la bahía no recibe más que la playa expuesta de al lado).
// Sin cámara ni vecina: null (se queda el mar abierto o el abrigo estático:
// sin datos no se inventa).
export function coefOrillaSpot(modelo, slug, hs, periodo, dirGrados) {
  const fuente = FUENTE_POR_SPOT[slug];
  const c = coefParaSpot(modelo, fuente, hs, periodo);
  if (!c) return null;
  if (!c.propia && ABRIGO_SPOTS[slug]) {
    const abrigo = coeficienteDesdeParametros(ABRIGO_SPOTS[slug], dirGrados);
    if (abrigo < c.coef) return { ...c, coef: abrigo, nivel: "abrigo" };
  }
  return c;
}

// La misma información, en tabla, para el navegador (index.html aplica el
// coeficiente a la serie horaria de la ventana de actividad con
// coefOrillaDesdeTabla, copia literal de la de abajo).
export function tablaOrillaSpot(modelo, slug) {
  const fuente = FUENTE_POR_SPOT[slug];
  if (!fuente || !modelo?.camaras?.[fuente.camara]) return null;
  const hsTipo = { pequeno: 1, medio: 2, grande: 4 };
  const tabla = {};
  for (const [t, hs] of Object.entries(hsTipo)) {
    tabla[t] = {};
    for (const [p, per] of [["corto", 8], ["largo", 12], ["sin", null]]) tabla[t][p] = coefParaSpot(modelo, fuente, hs, per).coef;
  }
  return { camara: fuente.camara, propia: !!fuente.propia, n: modelo.camaras[fuente.camara].n, tabla };
}

export function coefOrillaDesdeTabla(t, hs, periodo) {
  if (!t || !t.tabla || !Number.isFinite(hs)) return null;
  const tam = hs < 1.5 ? "pequeno" : hs < 3 ? "medio" : "grande";
  const per = Number.isFinite(periodo) ? (periodo < 10 ? "corto" : "largo") : "sin";
  return t.tabla[tam]?.[per] ?? null;
}

// El cociente cámara/modelo se mide contra la ola EN LA ORILLA, no contra el
// mar abierto (2026-11-19): si no, el tope de seguridad del cociente
// (COCIENTE_POCOS_DATOS, 0,6) impedía bajar de un 60 % del mar abierto aunque
// la cámara viera mucho menos. Rehace `modeloCamara` de cada lectura con el
// coeficiente aprendido de su cámara (las filas antiguas lo traen con el
// coeficiente previo). Sin mar abierto o sin aprendizaje, la deja igual.
export function lecturasContraOrilla(modelo, lecturas) {
  const out = {};
  for (const [cam, l] of Object.entries(lecturas || {})) {
    const c = Number.isFinite(l?.marAbierto) ? coefCostaDe(modelo, cam, l.marAbierto, null) : null;
    out[cam] = c ? { ...l, modeloCamara: +(l.marAbierto * c.coef).toFixed(2), coefCosta: c.coef } : l;
  }
  return out;
}
