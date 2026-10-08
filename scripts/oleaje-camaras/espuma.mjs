// scripts/oleaje-camaras/espuma.mjs
// Métrica de ESPUMA (agua rompiendo) en una zona fija de mar de cada webcam,
// para calibrar sin IA cuánto oleaje de mar abierto llega a cada spot con
// cámara (2026-10-08, caso Hondarribia — ver CLAUDE.md "Oleaje costero").
//
// Módulo puro (sin red ni ficheros): lo usa medir-espuma.mjs en GitHub
// Actions y test/oleaje-camaras.test.js en node --test.
//
// LECCIÓN APRENDIDA (2026-09-15, "lectura visual" retirada): contar BORDES de
// alto contraste no sirve — un puerto lleno de barcos en calma puntuaba más
// que Bakio con espuma de verdad. Por eso aquí:
//   1. Solo se mira una zona (ROI) de MAR fijada a mano por cámara, mirando
//      la imagen: sin barcos amarrados, sin edificios, sin arena seca.
//   2. Se cuenta COLOR, no bordes: espuma = píxel claro y casi sin color
//      (blanco), por encima del brillo típico del propio recorte.
//   3. Nunca se compara una cámara con otra en valor absoluto (encuadre,
//      distancia y exposición son distintos): cada cámara se compara con su
//      propio histórico frente al oleaje de mar abierto. Mismo principio que
//      la turbidez.
//
// LIMITACIONES CONOCIDAS (por eso esto calibra, no se enseña en la app):
//   - Reflejo del sol en el agua: también es claro y sin color. Se mide
//     siempre a horas fijas y se descartan lecturas con el recorte casi
//     entero brillante (`dudosa`).
//   - Marea: con bajamar la rompiente se aleja o cambia de sitio. Por eso
//     cada lectura guarda el nivel del mar del modelo, para separar por marea.
//   - Niebla, lluvia, gotas en la lente y noche: lecturas `dudosa`/sin luz.
//   - Si el proveedor mueve la cámara, el ROI deja de valer: hay que
//     revisarlo (camaras-salud ya avisa de cámaras congeladas o caídas).

// ROI en fracciones del encuadre (x0, y0, x1, y1), fijadas mirando los
// frames reales del 2026-10-08 hacia las 11:57 (hora de Madrid). Solo las 6
// cámaras de vídeo de la Diputación Foral de Gipuzkoa por ahora: mismo
// proveedor, frames de 1280x720 o 1920x1080, y un tramo de costa con boya
// exterior (Pasaia II) para tener la referencia de mar abierto.
export const ROI_CAMARAS = {
  // Bahía de Txingudi, franja de agua bajo los barcos fondeados (los barcos
  // blancos cuentan como "espuma": el ROI empieza justo debajo) y lejos de
  // la orilla de la izquierda, que con la marea mete arena en el recorte. La
  // arena con bruma y la espuma con luz cálida tienen el MISMO color (medido
  // el 2026-10-08 en Hondarribia y Deba), así que la única defensa es que el
  // ROI no toque la orilla en ninguna marea: revisar con bajamar y pleamar.
  hondarribia: { x0: 0.56, y0: 0.375, x1: 0.98, y1: 0.42, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_hondarribia_169.stream/playlist.m3u8" },
  // Zurriola: mar a la derecha del encuadre, a la altura del rompiente.
  donostia: { x0: 0.78, y0: 0.38, x1: 1.0, y1: 0.48, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zurriola_169.stream/playlist.m3u8" },
  // Orio: desembocadura, mar a la derecha del monte y del espigón.
  orio: { x0: 0.46, y0: 0.55, x1: 1.0, y1: 0.68, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_orio_169.stream/playlist.m3u8" },
  // Zarautz: playa expuesta, toda la franja de rompiente bajo el horizonte.
  zarautz: { x0: 0.0, y0: 0.24, x1: 1.0, y1: 0.62, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_zarautz_169.stream/playlist.m3u8" },
  // Deba: rompiente entre el horizonte y las rocas (sin el mirador de la dcha.).
  deba: { x0: 0.0, y0: 0.41, x1: 0.86, y1: 0.56, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_deba_169.stream/playlist.m3u8" },
  // Mutriku: mar abierto a la derecha, por fuera del dique y de la escollera.
  mutriku: { x0: 0.60, y0: 0.37, x1: 1.0, y1: 0.44, url: "https://58f14c0895a20.streamlock.net/camaramar/GIP_mutrikukaia_169.stream/playlist.m3u8" },
};

// Umbrales probados con los 6 frames del 2026-10-08 11:57. La cámara de
// Zurriola tiene la lente velada: su espuma no pasa de brillo 0,6, pero sí se
// distingue por COLOR (saturación < 0,1 frente a 0,4 del agua). Por eso el
// criterio es "casi sin color Y más clara que el agua típica del recorte", con
// un mínimo absoluto bajo, y no un brillo absoluto alto.
export const UMBRAL_SATURACION_ESPUMA = 0.15; // espuma: casi sin color
export const UMBRAL_BRILLO_MIN = 0.45; // mínimo absoluto (descarta sombras grises)
export const MARGEN_SOBRE_MEDIANA = 0.08; // más clara que la mediana del recorte
export const UMBRAL_BRILLANTE = 0.62; // "blanco brillante", solo para detectar reflejo/niebla
export const BRILLO_MIN_CON_LUZ = 0.12; // por debajo: noche o imagen negra
export const FRACCION_BRILLANTE_DUDOSA = 0.6; // más de esto "blanco": sol/niebla/sobreexpuesta

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { s: max === 0 ? 0 : (max - min) / max, v: max / 255 };
}

function mediana(valores) {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// `data`: RGB planos (3 bytes por píxel, sin alfa), `width`x`height`.
// Devuelve { espuma (0-1), brilloMedio, medianaBrillo, pixeles, estado }
// con estado "ok" | "sin_luz" | "dudosa".
export function medirEspuma(data, width, height, roi) {
  const x0 = Math.max(0, Math.floor(roi.x0 * width)), x1 = Math.min(width, Math.ceil(roi.x1 * width));
  const y0 = Math.max(0, Math.floor(roi.y0 * height)), y1 = Math.min(height, Math.ceil(roi.y1 * height));
  const brillos = [];
  const sats = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 3;
      const { s, v } = hsv(data[p], data[p + 1], data[p + 2]);
      brillos.push(v);
      sats.push(s);
    }
  }
  const n = brillos.length;
  if (!n) return { espuma: null, brilloMedio: null, medianaBrillo: null, pixeles: 0, estado: "dudosa" };
  const brilloMedio = brillos.reduce((a, b) => a + b, 0) / n;
  const med = mediana(brillos);
  const umbral = Math.max(UMBRAL_BRILLO_MIN, med + MARGEN_SOBRE_MEDIANA);
  let blancos = 0, brillantes = 0;
  for (let i = 0; i < n; i++) {
    if (brillos[i] >= UMBRAL_BRILLANTE && sats[i] <= UMBRAL_SATURACION_ESPUMA) brillantes++;
    if (brillos[i] >= umbral && sats[i] <= UMBRAL_SATURACION_ESPUMA) blancos++;
  }
  let estado = "ok";
  if (brilloMedio < BRILLO_MIN_CON_LUZ) estado = "sin_luz";
  else if (brillantes / n > FRACCION_BRILLANTE_DUDOSA) estado = "dudosa";
  return {
    espuma: +(blancos / n).toFixed(4),
    brilloMedio: +brilloMedio.toFixed(3),
    medianaBrillo: +med.toFixed(3),
    pixeles: n,
    estado,
  };
}

// ---------------------------------------------------------------------------
// ¿Es el mismo encuadre? (2026-10-08) Las cámaras de la Diputación NO son
// fijas: hacen una ronda de posiciones (Hondarribia pasó de la bahía entera a
// un primer plano de la playa en 10 minutos; Deba barre la playa en
// segundos). Un ROI fijo solo vale en el encuadre en el que se dibujó. Por
// eso cada cámara tiene una imagen de referencia
// (scripts/oleaje-camaras/referencias/<spot>.jpg, el frame donde se fijó el
// ROI) y solo se mide un frame si se parece lo bastante a ella.
//
// Huella: miniatura en gris de 32x18 de la mitad INFERIOR del encuadre (el
// cielo y las nubes cambian; la costa, los edificios y la arena no).
export const HUELLA_ANCHO = 32;
export const HUELLA_ALTO = 18;
export const SIMILITUD_MINIMA = 0.8; // correlación mínima para "mismo encuadre" (ajustar con datos)

export function huella(data, width, height) {
  const y0 = Math.floor(height / 2);
  const out = new Array(HUELLA_ANCHO * HUELLA_ALTO).fill(0);
  const cnt = new Array(HUELLA_ANCHO * HUELLA_ALTO).fill(0);
  for (let y = y0; y < height; y++) {
    const hy = Math.min(HUELLA_ALTO - 1, Math.floor(((y - y0) / (height - y0)) * HUELLA_ALTO));
    for (let x = 0; x < width; x++) {
      const hx = Math.min(HUELLA_ANCHO - 1, Math.floor((x / width) * HUELLA_ANCHO));
      const p = (y * width + x) * 3;
      out[hy * HUELLA_ANCHO + hx] += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      cnt[hy * HUELLA_ANCHO + hx]++;
    }
  }
  return out.map((v, i) => (cnt[i] ? v / cnt[i] : 0));
}

// Correlación normalizada (-1..1) entre dos huellas: insensible a cambios
// globales de brillo y contraste (sol/nubes), sensible a que la escena se
// haya movido.
export function similitud(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (!da || !db) return null;
  return +(num / Math.sqrt(da * db)).toFixed(3);
}

// ---------------------------------------------------------------------------
// Calibración (para cuando haya semanas de datos; hoy solo se registra).
//
// Idea: el "umbral de rotura" de cada cámara. Con mar abierto pequeño no hay
// espuma en ningún sitio; a medida que crece el mar abierto, la espuma
// aparece antes en las playas expuestas que en las abrigadas. La altura de
// mar abierto a la que una cámara empieza a ver espuma de forma sostenida
// (`umbralRotura`) no depende de la escala ni del encuadre de la cámara, y
// el cociente entre el umbral de una cámara de referencia expuesta (Zarautz)
// y el de otra da su coeficiente de exposición relativo:
//
//   coef(spot) ≈ umbralRotura(referencia) / umbralRotura(spot)
//
// Se calcula por sector de dirección (NW y N por separado como mínimo) y
// solo con lecturas `ok` en el mismo tramo de marea.

// muestras: [{ hs (mar abierto, m), espuma (0-1) }]. Devuelve la altura de
// mar abierto a la que la MITAD de las lecturas ya ven espuma (por encima de
// la espuma de base + `margen`), con una ventana móvil centrada de lecturas
// ordenadas por altura; o null si no hay datos suficientes (nunca un número
// inventado).
export function umbralRotura(muestras, { margen = 0.01, proporcion = 0.5, minMuestras = 20 } = {}) {
  const v = (muestras || []).filter((m) => Number.isFinite(m?.hs) && Number.isFinite(m?.espuma)).sort((a, b) => a.hs - b.hs);
  if (v.length < minMuestras) return null;
  const nBase = Math.max(3, Math.floor(v.length * 0.2));
  const base = mediana(v.slice(0, nBase).map((m) => m.espuma));
  const medio = Math.max(2, Math.round(v.length * 0.075)); // ventana de ~15 % de las lecturas
  for (let i = medio; i < v.length - medio; i++) {
    const ventana = v.slice(i - medio, i + medio + 1);
    const con = ventana.filter((m) => m.espuma > base + margen).length;
    if (con / ventana.length > proporcion) return v[i].hs;
  }
  return null;
}

export function coeficienteRelativo(muestrasSpot, muestrasReferencia, opciones) {
  const u = umbralRotura(muestrasSpot, opciones);
  const r = umbralRotura(muestrasReferencia, opciones);
  if (!u || !r) return null;
  return +Math.min(1, r / u).toFixed(2);
}
