// scripts/oleaje-camaras/calibracion.mjs
// De "fracción de espuma en la zona medida" a "metros de ola en el spot"
// (2026-10-08, "Si hay cámara, utiliza nuestro cálculo"). Módulo puro, sin
// red ni ficheros: lo usan medir-espuma.mjs (GitHub Actions) y
// test/oleaje-camaras.test.js. Sin IA.
//
// MODELO, por cámara y encuadre (cada encuadre tiene su zona medida y su
// escala, nunca se mezclan):
//
//     altura = a · espuma^p
//
// Por qué así: en una zona fija que va desde fuera de la orilla hasta la
// rompiente exterior, la franja de espuma se ensancha al crecer la ola (la
// zona de rompientes es más ancha y rompe más lejos), así que la fracción de
// espuma crece más o menos en proporción a la altura (p ≈ 1) hasta que la
// zona se llena (entonces crece menos: p > 1). `a` es la escala propia de
// cada cámara (distancia, zoom, exposición): por eso nunca se compara una
// cámara con otra en absoluto (lección de 2026-09-15).
//
// MUESTRAS para ajustar a y p:
//   - Lecturas automáticas: altura de referencia = boya de mar abierto más
//     cercana (Copernicus Marine In Situ, < 4 h; peso 1) o, sin boya, el modelo con
//     su factor (peso 0,5), por el coeficiente de abrigo PREVIO del spot
//     (functions/_lib/oleaje-costero.js; 1 en las playas expuestas).
//   - Etiquetas de Mikel sobre fotos (etiquetar-olas.html): centro de la
//     banda, peso 5. Etiquetas "ola real que veo" desde el spot: peso 3.
//   Las etiquetas son la verdad de terreno: con unas pocas, mandan sobre el
//   coeficiente previo (que es una estimación por geometría).
//
// AJUSTE: mínimos cuadrados ponderados en logaritmos (el error que importa
// es relativo: 0,3 m de error no es lo mismo con 0,5 m que con 3 m). Con
// pocas lecturas, o todas del mismo estado de mar, p queda fijo en 1 y solo
// se ajusta a; p se ajusta solo con ≥ 12 muestras y alturas que varíen al
// menos ×1,8.
//
// INCERTIDUMBRE (honesta): error relativo típico = exp(rms de los residuos
// en log) - 1, con un MÍNIMO de ±50 % mientras no haya al menos 3 días
// distintos y alturas que varíen ×1,5: con un solo estado de mar, la escala
// `a` solo reproduce la referencia de ese día y no dice nada de otros.

export const ESPUMA_MINIMA = 0.003; // por debajo: "sin espuma" (ruido, brillos sueltos)
export const PESO_BOYA = 1;
export const PESO_MODELO = 0.5;
export const PESO_ETIQUETA_FOTO = 5;
export const PESO_ETIQUETA_SPOT = 3;
export const ERROR_MINIMO_POCOS_DATOS = 0.5;
export const VENTANA_BOYA_HORAS = 4; // Copernicus publica con 2-3 h de retraso

const ln = Math.log;

function sumaPonderada(v, w) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * w[i];
  return s;
}

// muestras: [{ espuma, altura, peso, dia?, etiqueta? }]
export function ajustarCalibracion(muestras) {
  const m = (muestras || []).filter(
    (x) => Number.isFinite(x?.espuma) && x.espuma > ESPUMA_MINIMA && Number.isFinite(x?.altura) && x.altura > 0 && (x.peso ?? 1) > 0
  );
  if (!m.length) return null;
  const X = m.map((x) => ln(x.espuma));
  const Y = m.map((x) => ln(x.altura));
  const W = m.map((x) => x.peso ?? 1);
  const sw = W.reduce((a, b) => a + b, 0);
  const hMin = Math.min(...m.map((x) => x.altura));
  const hMax = Math.max(...m.map((x) => x.altura));
  const rangoAlturas = hMax / hMin;
  let p = 1;
  let lnA;
  if (m.length >= 12 && rangoAlturas >= 1.8) {
    const mx = sumaPonderada(X, W) / sw, my = sumaPonderada(Y, W) / sw;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < m.length; i++) {
      sxy += W[i] * (X[i] - mx) * (Y[i] - my);
      sxx += W[i] * (X[i] - mx) ** 2;
    }
    p = sxx > 0 ? Math.min(2, Math.max(0.5, sxy / sxx)) : 1;
    lnA = my - p * mx;
  } else {
    lnA = sumaPonderada(Y.map((y, i) => y - p * X[i]), W) / sw;
  }
  const res = Y.map((y, i) => y - (lnA + p * X[i]));
  const rms = Math.sqrt(sumaPonderada(res.map((r) => r * r), W) / sw);
  const dias = new Set(m.map((x) => x.dia).filter(Boolean)).size;
  let errorRel = Math.exp(rms) - 1;
  const pocosDatos = m.length < 5 || dias < 3 || rangoAlturas < 1.5;
  if (pocosDatos) errorRel = Math.max(errorRel, ERROR_MINIMO_POCOS_DATOS);
  return {
    a: +Math.exp(lnA).toFixed(4),
    p: +p.toFixed(3),
    n: m.length,
    nEtiquetas: m.filter((x) => x.etiqueta).length,
    dias,
    hMin: +hMin.toFixed(2),
    hMax: +hMax.toFixed(2),
    errorRel: +Math.min(1, errorRel).toFixed(3),
    pocosDatos,
  };
}

// Altura estimada para una fracción de espuma con una calibración.
// Sin calibración, null (nunca un número inventado). Fuera del rango
// calibrado no se extrapola más de ×1,5 por arriba.
export function estimarAltura(espuma, cal) {
  if (!cal || !Number.isFinite(espuma) || !Number.isFinite(cal.a)) return null;
  const f = Math.max(espuma, ESPUMA_MINIMA);
  let h = cal.a * f ** cal.p;
  if (Number.isFinite(cal.hMax)) h = Math.min(h, cal.hMax * 1.5);
  const e = Number.isFinite(cal.errorRel) ? cal.errorRel : ERROR_MINIMO_POCOS_DATOS;
  if (espuma <= ESPUMA_MINIMA) {
    // No se ve romper nada en la zona medida. Eso no basta para decir
    // "0 m": la rompiente puede estar fuera del ROI (Castro, 2026-10-08:
    // bahía sin espuma y 2,8 m fuera). Ante la duda no se baja la ola (regla
    // de oleaje-costero.js): sin altura, el spot sigue con modelo ×
    // coeficiente. La lectura queda en el histórico para las etiquetas.
    return { altura: null, rangoMin: null, rangoMax: null, sinEspuma: true };
  }
  return {
    altura: +h.toFixed(2),
    rangoMin: +(h / (1 + e)).toFixed(2),
    rangoMax: +(h * (1 + e)).toFixed(2),
    sinEspuma: false,
  };
}

// Altura de referencia de una lectura automática (en el spot, no mar
// abierto): boya × coeficiente previo si hay boya de menos de 4 h; si no,
// modelo corregido × coeficiente (con menos peso).
export function referenciaLectura(l) {
  const coef = Number.isFinite(l?.coefPrior) ? l.coefPrior : 1;
  const t = Date.parse(l?.fecha);
  const b = l?.boya;
  if (b && Number.isFinite(b.hs) && Number.isFinite(Date.parse(b.hora)) && Math.abs(t - Date.parse(b.hora)) <= VENTANA_BOYA_HORAS * 3600e3) {
    return { altura: +(b.hs * coef).toFixed(2), peso: PESO_BOYA, fuente: `boya ${b.nombre || b.id}` };
  }
  const hs = l?.marAbierto?.hsCorregida;
  if (Number.isFinite(hs)) return { altura: +(hs * coef).toFixed(2), peso: PESO_MODELO, fuente: "modelo" };
  return null;
}

export const claveCalibracion = (camara, encuadre) => `${camara}/${encuadre || "principal"}`;

// Normaliza una línea del histórico (incluye las del formato de la primera
// versión, que llamaban `spot` a la cámara y no tenían encuadre).
export function normalizarLinea(l) {
  if (!l) return null;
  return { ...l, camara: l.camara || l.spot, encuadre: l.encuadre || "principal" };
}

// Construye las muestras por clave cámara/encuadre a partir del histórico y
// de las etiquetas. `etiquetas`: [{ origen: "foto"|"spot", banda, camara,
// encuadre, espuma, fecha }] (las de "spot" ya emparejadas con la lectura
// más cercana de la cámara propia del spot, ver emparejarEtiquetaSpot).
export function muestrasPorCamara(historial, etiquetas, centroBanda) {
  const out = {};
  const add = (k, x) => (out[k] ||= []).push(x);
  for (const raw of historial || []) {
    const l = normalizarLinea(raw);
    if (!l || l.estado !== "ok" || !Number.isFinite(l.espuma)) continue;
    const ref = referenciaLectura(l);
    if (!ref) continue;
    add(claveCalibracion(l.camara, l.encuadre), { espuma: l.espuma, altura: ref.altura, peso: ref.peso, dia: String(l.fecha).slice(0, 10) });
  }
  for (const e of etiquetas || []) {
    const h = centroBanda(e.banda);
    if (!Number.isFinite(h) || !Number.isFinite(e.espuma)) continue;
    add(claveCalibracion(e.camara, e.encuadre), {
      espuma: e.espuma, altura: h, peso: e.origen === "foto" ? PESO_ETIQUETA_FOTO : PESO_ETIQUETA_SPOT,
      dia: String(e.fecha).slice(0, 10), etiqueta: true,
    });
  }
  return out;
}

// Etiqueta "ola real que veo" (spot + hora) -> lectura ok de la cámara
// propia del spot más cercana en ±45 min, o null.
export function emparejarEtiquetaSpot(etiqueta, historial, camaraDelSpot, toleranciaMin = 45) {
  const t = Date.parse(etiqueta?.observado_en || etiqueta?.fecha);
  if (!Number.isFinite(t) || !camaraDelSpot) return null;
  let mejor = null, dMin = Infinity;
  for (const raw of historial || []) {
    const l = normalizarLinea(raw);
    if (!l || l.camara !== camaraDelSpot || l.estado !== "ok" || !Number.isFinite(l.espuma)) continue;
    const d = Math.abs(Date.parse(l.fecha) - t);
    if (d < dMin) { dMin = d; mejor = l; }
  }
  if (!mejor || dMin > toleranciaMin * 60e3) return null;
  return { origen: "spot", banda: etiqueta.banda, camara: mejor.camara, encuadre: mejor.encuadre, espuma: mejor.espuma, fecha: mejor.fecha };
}

export function calibrarTodo(historial, etiquetas, centroBanda) {
  const muestras = muestrasPorCamara(historial, etiquetas, centroBanda);
  const cal = {};
  for (const [k, m] of Object.entries(muestras)) {
    const c = ajustarCalibracion(m);
    if (c) cal[k] = c;
  }
  return cal;
}

// Elevación del sol en grados (fórmula aproximada de la NOAA, error < 1°:
// de sobra para decidir si hay luz). Las lecturas con el sol por debajo de
// ELEVACION_MINIMA no se hacen (oscuro, o sol rasante de cara a la cámara).
export const ELEVACION_MINIMA = 8;
export function elevacionSolar(fechaMs, lat, lon) {
  const d = new Date(fechaMs);
  const dia = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const horaUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dia - 1 + (horaUTC - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const tst = horaUTC * 60 + eqt + 4 * lon;
  const ha = ((tst / 4 - 180) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  return +(90 - (Math.acos(Math.min(1, Math.max(-1, cosZ))) * 180) / Math.PI).toFixed(2);
}

// ---------------------------------------------------------------------------
// ¿Puede la cámara SUSTITUIR al modelo en el panel? (2026-10-08, pedido de
// Mikel tras ver Bakio a 4,7 m con el modelo a 2 m: "no quiero enseñar eso
// sin calibrar"). Criterio automático, por cámara:
//   - RUIDO: entre lecturas `ok` del mismo encuadre separadas ≤ 45 min (el
//     mar no cambia tanto en ese tiempo), la variación típica de la espuma
//     (mediana de |ln(e2/e1)|, pasada a %). Si supera ±30 %, o si aún no
//     hay 3 pares de lecturas para medirlo, la cámara es "ruidosa".
//   - Una cámara ruidosa solo sustituye al modelo cuando su calibración
//     tiene ≥ 5 etiquetas de Mikel (fotos) o ≥ 3 días con alturas variadas
//     (`pocosDatos` = false). Hasta entonces se sigue midiendo y guardando
//     (calibra igual), pero /prevision enseña modelo × coeficiente y no la
//     usa para corregir la previsión ni a las vecinas.
export const RUIDO_MAXIMO = 0.3;
export const VENTANA_RUIDO_MIN = 45;
export const ETIQUETAS_PARA_FIARSE = 5;
export const PARES_MINIMOS_RUIDO = 3; // con menos pares, el ruido no está medido

export function ruidoCamara(historial, camara) {
  const porEnc = {};
  for (const raw of historial || []) {
    const l = normalizarLinea(raw);
    if (!l || l.camara !== camara || l.estado !== "ok" || !(l.espuma > ESPUMA_MINIMA)) continue;
    (porEnc[l.encuadre] ||= []).push({ t: Date.parse(l.fecha), e: l.espuma });
  }
  const difs = [];
  for (const v of Object.values(porEnc)) {
    v.sort((a, b) => a.t - b.t);
    for (let i = 1; i < v.length; i++) {
      if (v[i].t - v[i - 1].t <= VENTANA_RUIDO_MIN * 60e3 && v[i].t > v[i - 1].t) difs.push(Math.abs(Math.log(v[i].e / v[i - 1].e)));
    }
  }
  if (!difs.length) return { ruido: null, pares: 0 };
  difs.sort((a, b) => a - b);
  const m = difs.length % 2 ? difs[(difs.length - 1) / 2] : (difs[difs.length / 2 - 1] + difs[difs.length / 2]) / 2;
  return { ruido: +(Math.exp(m) - 1).toFixed(3), pares: difs.length };
}

// calibraciones: las de los encuadres de esa cámara (objetos de
// ajustarCalibracion). Devuelve { sustituye, motivo }.
export function camaraSustituyeModelo(ruido, calibraciones) {
  const cals = (calibraciones || []).filter(Boolean);
  const etiquetas = cals.reduce((a, c) => a + (c.nEtiquetas || 0), 0);
  const variada = cals.some((c) => c.pocosDatos === false);
  const ruidosa = !ruido || ruido.ruido === null || ruido.pares < PARES_MINIMOS_RUIDO || ruido.ruido > RUIDO_MAXIMO;
  if (!ruidosa) return { sustituye: true, motivo: `estable (±${Math.round(ruido.ruido * 100)} % entre lecturas cercanas)` };
  if (etiquetas >= ETIQUETAS_PARA_FIARSE) return { sustituye: true, motivo: `${etiquetas} etiquetas` };
  if (variada) return { sustituye: true, motivo: "≥ 3 días con alturas variadas" };
  return {
    sustituye: false,
    motivo: ruido?.ruido == null || ruido.pares < PARES_MINIMOS_RUIDO
      ? `ruido aún sin medir (${ruido?.pares || 0} pares de lecturas cercanas)`
      : `ruidosa (±${Math.round(ruido.ruido * 100)} %) y sin calibrar`,
  };
}
