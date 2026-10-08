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

// ROI por cámara y encuadre: scripts/oleaje-camaras/camaras.mjs (desde el
// 2026-10-08 son 13 cámaras y varios encuadres por cámara). ROI_CAMARAS se
// mantiene (el encuadre principal de cada una) por compatibilidad.
import { CAMARAS } from "./camaras.mjs";
export const ROI_CAMARAS = Object.fromEntries(
  Object.entries(CAMARAS).filter(([, c]) => c.encuadres.length).map(([id, c]) => [id, { ...c.encuadres[0].roi, url: c.url }])
);

// Umbrales probados con los 6 frames del 2026-10-08 11:57. La cámara de
// Zurriola tiene la lente velada: su espuma no pasa de brillo 0,6, pero sí se
// distingue por COLOR (saturación < 0,1 frente a 0,4 del agua). Por eso el
// criterio es "casi sin color Y más clara que el agua típica del recorte", con
// un mínimo absoluto bajo, y no un brillo absoluto alto.
export const UMBRAL_SATURACION_ESPUMA = 0.15; // espuma: casi sin color
export const UMBRAL_BRILLO_MIN = 0.45; // mínimo absoluto (descarta sombras grises)
export const MARGEN_SOBRE_MEDIANA = 0.08; // más clara que la mediana del recorte...
// ...o que el cuartil bajo (agua entre la espuma) + MARGEN_SOBRE_AGUA, lo que
// sea MENOR (2026-10-08): con la zona llena de espuma (Bakio, Sopela con
// 3-4 m) la mediana ya ES espuma y "más clara que la mediana" dejaba fuera
// casi toda; el cuartil bajo sigue siendo agua.
export const MARGEN_SOBRE_AGUA = 0.15;
export const UMBRAL_BRILLANTE = 0.62; // "blanco brillante", solo para detectar reflejo/niebla
export const BRILLO_MIN_CON_LUZ = 0.12; // por debajo: noche o imagen negra
export const FRACCION_BRILLANTE_DUDOSA = 0.6; // más de esto "blanco": sol/niebla/sobreexpuesta...
// ...pero solo si además el recorte es casi UNIFORME: una zona llena de
// espuma de verdad (Bakio con 3-4 m, 2026-10-08: 97 % blanco) tiene textura
// (desviación del brillo ~0,09); un reflejo o una niebla, no.
export const DESVIACION_MAX_DUDOSA = 0.06;
// Guarda de la orilla (2026-10-08): la arena (seca o mojada) tiene tono
// cálido (amarillo-naranja, 15-55°) y algo de color; el agua del Cantábrico
// es azul-verde-gris. Si más de FRACCION_ARENA_MAX del ROI es "arena", la
// orilla ha entrado en la zona medida (bajamar fuerte, o la cámara se ha
// movido) y la lectura se marca `orilla` y no cuenta.
export const TONO_ARENA_MIN = 15;
export const TONO_ARENA_MAX = 55;
export const SATURACION_ARENA_MIN = 0.3;
export const BRILLO_ARENA_MIN = 0.25;
export const FRACCION_ARENA_MAX = 0.15;

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

function mediana(valores) {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// `data`: RGB planos (3 bytes por píxel, sin alfa), `width`x`height`.
// Devuelve { espuma (0-1), brilloMedio, medianaBrillo, arena, pixeles, estado }
// con estado "ok" | "sin_luz" | "dudosa" | "orilla".
export function medirEspuma(data, width, height, roi) {
  const x0 = Math.max(0, Math.floor(roi.x0 * width)), x1 = Math.min(width, Math.ceil(roi.x1 * width));
  const y0 = Math.max(0, Math.floor(roi.y0 * height)), y1 = Math.min(height, Math.ceil(roi.y1 * height));
  const brillos = [];
  const sats = [];
  let arena = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 3;
      const { h, s, v } = hsv(data[p], data[p + 1], data[p + 2]);
      brillos.push(v);
      sats.push(s);
      if (h >= TONO_ARENA_MIN && h <= TONO_ARENA_MAX && s >= SATURACION_ARENA_MIN && v >= BRILLO_ARENA_MIN) arena++;
    }
  }
  const n = brillos.length;
  if (!n) return { espuma: null, brilloMedio: null, medianaBrillo: null, arena: null, desviacion: null, pixeles: 0, estado: "dudosa" };
  const brilloMedio = brillos.reduce((a, b) => a + b, 0) / n;
  const desviacion = Math.sqrt(brillos.reduce((a, b) => a + (b - brilloMedio) ** 2, 0) / n);
  const ordenados = [...brillos].sort((a, b) => a - b);
  const med = ordenados.length % 2 ? ordenados[(ordenados.length - 1) / 2] : (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2;
  const p25 = ordenados[Math.floor(ordenados.length * 0.25)];
  const umbral = Math.max(UMBRAL_BRILLO_MIN, Math.min(med + MARGEN_SOBRE_MEDIANA, p25 + MARGEN_SOBRE_AGUA));
  let blancos = 0, brillantes = 0;
  for (let i = 0; i < n; i++) {
    if (brillos[i] >= UMBRAL_BRILLANTE && sats[i] <= UMBRAL_SATURACION_ESPUMA) brillantes++;
    if (brillos[i] >= umbral && sats[i] <= UMBRAL_SATURACION_ESPUMA) blancos++;
  }
  let estado = "ok";
  if (brilloMedio < BRILLO_MIN_CON_LUZ) estado = "sin_luz";
  else if (brillantes / n > FRACCION_BRILLANTE_DUDOSA && desviacion < DESVIACION_MAX_DUDOSA) estado = "dudosa";
  else if (arena / n > FRACCION_ARENA_MAX) estado = "orilla";
  return {
    espuma: +(blancos / n).toFixed(4),
    brilloMedio: +brilloMedio.toFixed(3),
    medianaBrillo: +med.toFixed(3),
    arena: +(arena / n).toFixed(3),
    desviacion: +desviacion.toFixed(3),
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

// ---------------------------------------------------------------------------
// Zona de medida DINÁMICA (2026-10-08), para cámaras que barren sin repetir
// encuadre. Caso real: la de Zarautz pasó por 15 planos distintos en 7
// minutos sin repetir ninguno, así que una imagen de referencia casi nunca
// coincide. En vez de un ROI fijo, en cada fotograma y en 8 franjas
// verticales se busca el tramo de MAR: filas seguidas de píxeles "de mar"
// (azul-verde-gris, o blancos de espuma) por encima de una orilla (filas que
// ya no son mar: arena seca o mojada), y por debajo del horizonte o de la
// tierra (el salto de brillo cielo/mar más fuerte dentro del tramo). Se mide
// entre ambos, dejando un 15 % de margen bajo el horizonte y un 30 % sobre
// la orilla: la zona se mueve con la marea y con la cámara y nunca toca la
// orilla. Con menos de 4 franjas válidas, el fotograma no se mide.
// Límite conocido: el agua verdosa al sol (Zurriola) tiene el tono de la
// arena mojada; por eso solo se usa en Zarautz.
export const FRANJAS_DINAMICO = 8;
export const MIN_FRANJAS_DINAMICO = 4;

function hsvPixel(data, p) {
  return hsv(data[p], data[p + 1], data[p + 2]);
}
// Píxel "de mar": espuma (casi sin color) o agua azul-verde-gris; nunca
// arena (seca o mojada: tono cálido con algo de color), vegetación ni sombra.
function esMar({ h, s, v }) {
  if (v < 0.22) return false;
  if (s <= UMBRAL_SATURACION_ESPUMA) return true;
  return h >= 150 && h <= 260;
}

export function zonasDinamicas(data, width, height) {
  const zonas = [];
  const anchoFranja = Math.floor(width / FRANJAS_DINAMICO);
  for (let k = 0; k < FRANJAS_DINAMICO; k++) {
    const xa = k * anchoFranja, xb = k === FRANJAS_DINAMICO - 1 ? width : xa + anchoFranja;
    const mar = [], brillo = [];
    for (let y = 0; y < height; y++) {
      let sm = 0, sv = 0;
      for (let x = xa; x < xb; x++) {
        const c = hsvPixel(data, (y * width + x) * 3);
        if (esMar(c)) sm++;
        sv += c.v;
      }
      mar.push(sm / (xb - xa) >= 0.85);
      brillo.push(sv / (xb - xa));
    }
    // Tramo de mar más bajo con orilla debajo (no puede llegar al borde).
    let fin = -1;
    for (let y = height - 1; y >= 0; y--) if (mar[y]) { fin = y; break; }
    if (fin < 0 || fin >= height - 3) continue;
    let ini = fin;
    while (ini > 0 && mar[ini - 1]) ini--;
    // Cielo y mar pueden quedar en el mismo tramo: se corta por el salto de
    // brillo más fuerte (horizonte) si lo hay.
    let corte = ini, salto = 0.06;
    for (let y = ini + 3; y < fin - 3; y++) {
      const d = (brillo[y - 1] + brillo[y - 2] + brillo[y - 3]) / 3 - (brillo[y + 1] + brillo[y + 2] + brillo[y + 3]) / 3;
      if (d > salto) { salto = d; corte = y; }
    }
    if (fin - corte < height * 0.12) continue;
    const y0 = Math.round(corte + 0.15 * (fin - corte)), y1 = Math.round(fin - 0.3 * (fin - corte));
    if (y1 - y0 < 3) continue;
    zonas.push({ x0: xa / width, y0: y0 / height, x1: xb / width, y1: y1 / height });
  }
  return zonas;
}

// Espuma en las zonas dinámicas: media ponderada por píxeles de cada franja.
export function medirEspumaDinamica(data, width, height) {
  const zonas = zonasDinamicas(data, width, height);
  if (zonas.length < MIN_FRANJAS_DINAMICO) return { espuma: null, zonas: zonas.length, estado: "otro_encuadre" };
  const medidas = zonas.map((z) => medirEspuma(data, width, height, z));
  const total = medidas.reduce((a, m) => a + m.pixeles, 0);
  const media = (k) => medidas.reduce((a, m) => a + (m[k] ?? 0) * m.pixeles, 0) / total;
  const estados = medidas.map((m) => m.estado);
  const estado = estados.includes("sin_luz") ? "sin_luz" : estados.filter((e) => e !== "ok").length > zonas.length / 2 ? "dudosa" : "ok";
  return {
    espuma: +media("espuma").toFixed(4),
    brilloMedio: +media("brilloMedio").toFixed(3),
    arena: +media("arena").toFixed(3),
    pixeles: total,
    zonas: zonas.length,
    estado,
  };
}
