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
  const efecto = efectoTamano(validas, log);
  modelo.efectoTamano = Object.fromEntries(Object.entries(efecto).map(([t, e]) => [t, +Math.exp(e).toFixed(3)]));
  for (const [cam, ms] of Object.entries(porCam)) {
    const c = nivel(ms.map(log), g, k);
    // Efecto propio de la cámara, sin el tamaño de mar de sus muestras (una
    // cámara con casi todo mar pequeño tiene la media inflada).
    const base = nivel(ms.map((m) => log(m) - (efecto[tamanoMar(m.hs)] ?? 0)), g, k).log;
    const tamanos = {};
    for (const t of ["pequeno", "medio", "grande"]) {
      const mt = ms.filter((m) => tamanoMar(m.hs) === t);
      // Sin muestras de ese tamaño, el de la cámara con el efecto del tamaño
      // que se ve en todas las cámaras (2026-11-19, Mikel: "la ola en Bakio
      // es demasiado alta": Bakio no tenía ninguna etiqueta de mar grande y
      // usaba su media, 0,55, sacada de mar pequeño; con mar grande la orilla
      // recibe bastante menos en todas las cámaras).
      const nt = nivel(mt.map(log), base + (efecto[t] ?? 0), k);
      const periodos = {};
      for (const p of ["corto", "largo"]) {
        const mp = mt.filter((m) => tipoPeriodo(m.periodo) === p);
        if (mp.length) { const np = nivel(mp.map(log), nt.log, k); periodos[p] = { coef: np.coef, n: np.n }; }
      }
      tamanos[t] = { coef: nt.coef, n: nt.n, periodos };
    }
    ordenarPorTamano(tamanos);
    modelo.camaras[cam] = { coef: c.coef, n: c.n, tamanos };
  }
  // Lo típico de todas las cámaras por tamaño de mar (media geométrica, cada
  // cámara cuenta una vez): hacia aquí se acercan los spots que toman la
  // cámara de un vecino (coefParaSpot).
  modelo.globalTamanos = {};
  for (const t of TAMANOS) {
    const logs = Object.values(modelo.camaras).map((c) => Math.log(c.tamanos[t]?.coef)).filter(Number.isFinite);
    if (logs.length) modelo.globalTamanos[t] = +Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length).toFixed(3);
  }
  return modelo;
}

// REGLA (2026-11-19, Mikel: "pon en el robot una regla para que no vuelva a
// pasar"): con más mar, a la orilla nunca llega una parte MAYOR del mar
// abierto (la rompiente limita la ola que entra). Por cámara, pequeño ≥
// medio ≥ grande. Si los datos dicen otra cosa (pocas etiquetas), se juntan
// los tamaños que se cruzan en su media ponderada por etiquetas (regresión
// isótona, "pool adjacent violators"), en logaritmos. Los periodos de cada
// tamaño se mueven lo mismo que su tamaño.
export const TAMANOS = ["pequeno", "medio", "grande"];
export function ordenarPorTamano(tamanos) {
  const ts = TAMANOS.filter((t) => tamanos[t] && Number.isFinite(tamanos[t].coef) && tamanos[t].coef > 0);
  const bloques = ts.map((t) => ({ ts: [t], w: (tamanos[t].n || 0) + 1, v: Math.log(tamanos[t].coef) }));
  for (let i = 0; i < bloques.length - 1; ) {
    if (bloques[i].v < bloques[i + 1].v) {
      const a = bloques[i], b = bloques[i + 1];
      bloques.splice(i, 2, { ts: [...a.ts, ...b.ts], w: a.w + b.w, v: (a.v * a.w + b.v * b.w) / (a.w + b.w) });
      if (i > 0) i--;
    } else i++;
  }
  for (const bl of bloques) {
    for (const t of bl.ts) {
      const nuevo = +Math.exp(bl.v).toFixed(3);
      const f = nuevo / tamanos[t].coef;
      if (Math.abs(f - 1) > 1e-9) {
        for (const p of Object.values(tamanos[t].periodos || {})) p.coef = +(p.coef * f).toFixed(3);
        tamanos[t].coef = nuevo;
      }
    }
  }
  return tamanos;
}

// Comprobación del robot antes de publicar el modelo (y test del repo sobre
// coef-costa-datos.js): cada cámara con los tres tamaños, en orden, y dentro
// de [COEF_MIN, COEF_MAX]. Devuelve la lista de problemas (vacía = bien).
export function verificarCoefCosta(modelo, tolerancia = 0.005) {
  const problemas = [];
  for (const [cam, c] of Object.entries(modelo?.camaras || {})) {
    const v = TAMANOS.map((t) => c.tamanos?.[t]?.coef);
    TAMANOS.forEach((t, i) => { if (!Number.isFinite(v[i])) problemas.push(`${cam}: sin coeficiente para mar ${t}`); });
    for (let i = 0; i < 2; i++) {
      if (Number.isFinite(v[i]) && Number.isFinite(v[i + 1]) && v[i + 1] > v[i] * (1 + tolerancia)) {
        problemas.push(`${cam}: con mar ${TAMANOS[i + 1]} llega más (${v[i + 1]}) que con mar ${TAMANOS[i]} (${v[i]})`);
      }
    }
  }
  return problemas;
}

// Efecto del tamaño del mar en el cociente orilla/mar abierto, común a
// todas las cámaras: log(cociente) ≈ efecto de la cámara + efecto del
// tamaño (modelo aditivo en logaritmos, ajustado por medias alternas).
// CADA CÁMARA CUENTA LO MISMO en el efecto del tamaño: si no, una cámara muy
// abrigada y con muchas etiquetas (Hondarribia, 55 de mar grande, cae al
// 8 %) arrastraba a todas. Se encoge hacia 0 con K_EFECTO cámaras de peso y
// se centra en 0 (media de las cámaras), así que cada cámara conserva su
// nivel.
export const K_EFECTO = 2, K_MUESTRAS_EFECTO = 3;
export function efectoTamano(muestras, log, iter = 30, k = K_EFECTO) {
  const ef = { pequeno: 0, medio: 0, grande: 0 };
  if (!muestras.length) return ef;
  const grupos = {}; // cámara -> tamaño -> [suma log, n]
  for (const m of muestras) {
    const t = tamanoMar(m.hs);
    if (!t) continue;
    const g = ((grupos[m.camara] ||= {})[t] ||= [0, 0]);
    g[0] += log(m); g[1]++;
  }
  const cams = {};
  for (let it = 0; it < iter; it++) {
    for (const [c, porT] of Object.entries(grupos)) {
      let s = 0, n = 0;
      for (const [t, [sum, cnt]] of Object.entries(porT)) { s += sum - cnt * ef[t]; n += cnt; }
      cams[c] = s / n;
    }
    const st = {};
    for (const [c, porT] of Object.entries(grupos)) {
      // Lo de cada cámara también se encoge por sus etiquetas: una sola
      // etiqueta de mar grande no fija el efecto.
      for (const [t, [sum, cnt]] of Object.entries(porT)) { const a = (st[t] ||= [0, 0]); a[0] += (sum / cnt - cams[c]) * cnt / (cnt + K_MUESTRAS_EFECTO); a[1]++; }
    }
    const nuevos = {};
    for (const t of Object.keys(ef)) nuevos[t] = st[t] ? st[t][0] / (st[t][1] + k) : 0;
    const usados = Object.keys(st);
    const centro = usados.reduce((a, t) => a + nuevos[t] * st[t][1], 0) / usados.reduce((a, t) => a + st[t][1], 0);
    for (const t of Object.keys(ef)) ef[t] = st[t] ? nuevos[t] - centro : 0;
  }
  return ef;
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
// cámara cercana, acercado según `peso` a lo típico de todas las cámaras
// para ese tamaño de mar (modelo.globalTamanos), en logaritmos.
// Hasta el 2026-11-19 se acercaba a 1 (al mar abierto): con eso Plentzia
// (vecina de Bakio, peso 0,8) daba 2,6-3,2 m con 4-5 m fuera, más que
// Sopelana y Bakio a su lado (Mikel: "no puede haber tanta diferencia entre
// spots contiguos"). Sin globalTamanos (modelos antiguos), el global.
export function coefParaSpot(modelo, fuente, hs, periodo) {
  if (!fuente) return null;
  const c = coefCostaDe(modelo, fuente.camara, hs, periodo);
  if (!c) return null;
  const peso = fuente.propia ? 1 : Math.min(1, Math.max(0, fuente.peso ?? 0.5));
  const tipico = modelo?.globalTamanos?.[tamanoMar(hs)] ?? modelo?.global?.coef ?? c.coef;
  const coef = Math.exp(peso * Math.log(c.coef) + (1 - peso) * Math.log(tipico));
  return { ...c, coef: acotar(coef), camara: fuente.camara, propia: !!fuente.propia, peso };
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
