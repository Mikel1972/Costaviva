// assets/js/isotermas.js
// 🌡 T. agua legible (2026-10-09, captura de Mikel en el iPhone: "La
// temperatura del agua no es intuitiva. ¿Se pueden poner algunas temperaturas
// en el agua (isoclinas, por ejemplo) manteniendo colores?"). Cálculo puro,
// sin DOM ni red: lo usan index.html (window.Isotermas) y
// test/isotermas.test.js. Sin IA y sin peticiones nuevas: trabaja sobre la
// misma malla de capas/temperatura-agua.json que ya pinta la capa
// (formato en assets/js/capas-mar.js).
//
// Dos piezas:
//   1. Escala de color ADAPTATIVA: la paleta de siempre, estirada al rango
//      del mar que se ve en pantalla (percentiles 2-98). Con la escala fija
//      de 10 a 28 °C, el Cantábrico de octubre (17-20 °C) salía todo del
//      mismo verde. Se eligió adaptativa y no fija por región porque la malla
//      va de Canarias al Golfo de Bizkaia y el usuario se mueve y hace zoom:
//      una escala por región obliga a trazar fronteras arbitrarias y deja sin
//      contraste un zoom a una ría (0,5 °C de diferencia). El precio, que el
//      mismo color no es la misma temperatura en dos vistas, lo pagan las
//      isotermas con su número y la leyenda con los extremos reales.
//   2. ISOTERMAS: marching squares sobre los centros de celda (campo
//      suavizado 3x3 para que la cuantización de 0,125 °C no dibuje
//      escaleras), solo lo visible, sin tierra ni celdas sin dato. Etiquetas
//      "18°" sobre la línea, separadas y como mucho 8 en pantalla.

import { valorByte } from "./capas-mar.js";

// Filas y columnas de la malla que cubren unos límites (con margen en
// celdas), recortadas a la malla. null si no se solapan.
export function ventanaMalla(d, lim, margen = 0) {
  const f0 = Math.max(0, Math.floor((d.norte - lim.norte) / d.paso) - margen);
  const f1 = Math.min(d.filas - 1, Math.floor((d.norte - lim.sur) / d.paso) + margen);
  const c0 = Math.max(0, Math.floor((lim.oeste - d.oeste) / d.paso) - margen);
  const c1 = Math.min(d.columnas - 1, Math.floor((lim.este - d.oeste) / d.paso) + margen);
  if (f0 > f1 || c0 > c1) return null;
  return { f0, f1, c0, c1 };
}

// Percentiles del mar visible a partir del histograma de bytes (255 valores
// posibles: es exacto y no hace falta ordenar). null si hay menos de
// `minCeldas` celdas con dato.
export function percentilesVisibles(d, bytes, lim, pInf = 0.02, pSup = 0.98, minCeldas = 30) {
  const v = ventanaMalla(d, lim);
  if (!v) return null;
  const hist = new Uint32Array(255);
  let n = 0;
  for (let f = v.f0; f <= v.f1; f++) {
    const o = f * d.columnas;
    for (let c = v.c0; c <= v.c1; c++) {
      const b = bytes[o + c];
      if (b !== 255) { hist[b]++; n++; }
    }
  }
  if (n < minCeldas) return null;
  const buscar = (p) => {
    const objetivo = p * (n - 1);
    let acum = 0;
    for (let b = 0; b < 255; b++) {
      acum += hist[b];
      if (acum > objetivo) return valorByte(b, d.escala);
    }
    return valorByte(254, d.escala);
  };
  return { bajo: buscar(pInf), alto: buscar(pSup), n };
}

// Extremos de la escala de color a partir de los percentiles: redondeados
// hacia fuera a medio grado (números limpios en la leyenda) y con un ancho
// mínimo para no exagerar diferencias de décimas como si fueran frentes.
export const ANCHO_MINIMO_ESCALA = 2;
export function escalaAdaptativa(pct, anchoMinimo = ANCHO_MINIMO_ESCALA) {
  if (!pct) return null;
  let min = Math.floor(pct.bajo * 2) / 2;
  let max = Math.ceil(pct.alto * 2) / 2;
  if (max - min < anchoMinimo) {
    const centro = (pct.bajo + pct.alto) / 2;
    min = Math.floor((centro - anchoMinimo / 2) * 2) / 2;
    max = min + anchoMinimo;
    if (max < pct.alto) { max = Math.ceil(pct.alto * 2) / 2; min = max - anchoMinimo; }
  }
  return { min, max };
}

// Intervalo entre isotermas (°C): 2 con el zoom muy alejado (5, el mínimo del mapa), 0,5 si el mar
// visible apenas cambia, 1 en el resto. Nunca más de `maxNiveles` líneas.
export function intervaloIsotermas(pct, zoom, maxNiveles = 10) {
  let paso = zoom <= 5 ? 2 : pct && pct.alto - pct.bajo < 2.5 ? 0.5 : 1;
  if (pct) while ((pct.alto - pct.bajo) / paso > maxNiveles) paso *= 2;
  return paso;
}

// Niveles dentro del rango visible (múltiplos del intervalo).
export function nivelesIsotermas(pct, paso) {
  if (!pct) return [];
  const out = [];
  for (let k = Math.ceil(pct.bajo / paso - 1e-9); k * paso <= pct.alto + 1e-9; k++) out.push(+(k * paso).toFixed(2));
  return out;
}

// Campo de temperatura de la ventana, suavizado 3x3 sobre las celdas con dato
// (NaN = tierra o sin dato, que no se suaviza ni se rellena).
export function campoVentana(d, bytes, v) {
  const W = v.c1 - v.c0 + 1, H = v.f1 - v.f0 + 1;
  const crudo = new Float32Array(W * H);
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      const b = bytes[(v.f0 + i) * d.columnas + v.c0 + j];
      crudo[i * W + j] = b === 255 ? NaN : valorByte(b, d.escala);
    }
  }
  const campo = new Float32Array(W * H);
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      const x = crudo[i * W + j];
      if (Number.isNaN(x)) { campo[i * W + j] = NaN; continue; }
      let s = 0, n = 0;
      for (let a = Math.max(0, i - 1); a <= Math.min(H - 1, i + 1); a++) {
        for (let b = Math.max(0, j - 1); b <= Math.min(W - 1, j + 1); b++) {
          const y = crudo[a * W + b];
          if (!Number.isNaN(y)) { s += y; n++; }
        }
      }
      campo[i * W + j] = s / n;
    }
  }
  return { campo, W, H };
}

// Marching squares de un nivel sobre un campo W x H (NaN = sin dato).
// Devuelve polilíneas en coordenadas de rejilla [fila, columna] (de los
// centros de celda), ya unidas. Un cuadrado con alguna esquina sin dato no
// se dibuja: las líneas mueren en la costa.
export function contornos(campo, W, H, nivel) {
  // Aristas: horizontal (i,j)-(i,j+1) = 2*(i*W+j); vertical (i,j)-(i+1,j) = 2*(i*W+j)+1.
  const punto = (arista) => {
    const k = arista >> 1, i = (k / W) | 0, j = k % W;
    const a = campo[k];
    const b = arista & 1 ? campo[k + W] : campo[k + 1];
    const t = Math.min(1, Math.max(0, (nivel - a) / (b - a)));
    return arista & 1 ? [i + t, j] : [i, j + t];
  };
  const segs = [];
  for (let i = 0; i < H - 1; i++) {
    for (let j = 0; j < W - 1; j++) {
      const k = i * W + j;
      const tl = campo[k], tr = campo[k + 1], bl = campo[k + W], br = campo[k + W + 1];
      if (Number.isNaN(tl) || Number.isNaN(tr) || Number.isNaN(bl) || Number.isNaN(br)) continue;
      const caso = (tl >= nivel ? 8 : 0) | (tr >= nivel ? 4 : 0) | (br >= nivel ? 2 : 0) | (bl >= nivel ? 1 : 0);
      if (caso === 0 || caso === 15) continue;
      const arriba = 2 * k, abajo = 2 * (k + W), izq = 2 * k + 1, der = 2 * (k + 1) + 1;
      const centroArriba = (tl + tr + bl + br) / 4 >= nivel;
      switch (caso) {
        case 1: case 14: segs.push([izq, abajo]); break;
        case 2: case 13: segs.push([abajo, der]); break;
        case 3: case 12: segs.push([izq, der]); break;
        case 4: case 11: segs.push([arriba, der]); break;
        case 6: case 9: segs.push([arriba, abajo]); break;
        case 7: case 8: segs.push([izq, arriba]); break;
        case 5: // tr y bl por encima
          if (centroArriba) segs.push([izq, arriba], [abajo, der]);
          else segs.push([arriba, der], [izq, abajo]);
          break;
        case 10: // tl y br por encima
          if (centroArriba) segs.push([arriba, der], [izq, abajo]);
          else segs.push([izq, arriba], [abajo, der]);
          break;
      }
    }
  }
  // Unir segmentos que comparten arista (cada arista la comparten 2 como mucho).
  const porArista = new Map();
  segs.forEach((s, n) => {
    for (const a of s) {
      const l = porArista.get(a);
      if (l) l.push(n); else porArista.set(a, [n]);
    }
  });
  const usado = new Uint8Array(segs.length);
  const siguiente = (arista, desde) => (porArista.get(arista) || []).find((n) => n !== desde && !usado[n]);
  const lineas = [];
  for (let n = 0; n < segs.length; n++) {
    if (usado[n]) continue;
    usado[n] = 1;
    const aristas = [segs[n][0], segs[n][1]];
    // Hacia delante y hacia atrás.
    for (const haciaDelante of [true, false]) {
      let actual = n;
      for (;;) {
        const extremo = haciaDelante ? aristas[aristas.length - 1] : aristas[0];
        const m = siguiente(extremo, actual);
        if (m === undefined) break;
        usado[m] = 1;
        const otra = segs[m][0] === extremo ? segs[m][1] : segs[m][0];
        if (haciaDelante) aristas.push(otra); else aristas.unshift(otra);
        actual = m;
      }
    }
    lineas.push(aristas.map(punto));
  }
  return lineas;
}

function largoRejilla(l) {
  let s = 0;
  for (let k = 1; k < l.length; k++) s += Math.hypot(l[k][0] - l[k - 1][0], l[k][1] - l[k - 1][1]);
  return s;
}

// Isotermas de la parte visible: [{ nivel, lineas: [[[lat, lon], ...], ...] }].
// Se descartan las líneas de menos de `largoMinimo` celdas (ruido, islas de
// una celda). `pct` y `paso` como los de percentilesVisibles/intervaloIsotermas.
export function isotermasVisibles(d, bytes, lim, niveles, largoMinimo = 3) {
  const v = ventanaMalla(d, lim, 2);
  if (!v || !niveles.length) return [];
  const { campo, W, H } = campoVentana(d, bytes, v);
  const aLatLon = ([i, j]) => [d.norte - (v.f0 + i + 0.5) * d.paso, d.oeste + (v.c0 + j + 0.5) * d.paso];
  return niveles.map((nivel) => ({
    nivel,
    lineas: contornos(campo, W, H, nivel).filter((l) => largoRejilla(l) >= largoMinimo).map((l) => l.map(aLatLon)),
  })).filter((x) => x.lineas.length);
}

// Etiquetas sobre las líneas ya pasadas a píxeles de pantalla:
// lineas = [{ nivel, puntos: [{x, y}, ...] }]. Candidatos cada `cadaPx` a lo
// largo de cada línea (el primero a media distancia), dentro de la pantalla
// con margen; se cogen primero los primeros candidatos de cada línea (de la
// más larga a la más corta) para repartir los números, y nunca dos a menos
// de `separacion` px ni más de `max` en total.
// `margenDerecha` deja libre la columna de botones de capas en el móvil.
export function etiquetasIsotermas(lineas, { ancho, alto, max = 8, separacion = 90, margen = 28, margenDerecha = margen, cadaPx = 200 } = {}) {
  const dentro = (p) => p.x >= margen && p.y >= margen && p.x <= ancho - margenDerecha && p.y <= alto - margen;
  const porLinea = [];
  for (const l of lineas) {
    const cand = [];
    let recorrido = 0, proximo = cadaPx / 2, largo = 0;
    for (let k = 1; k < l.puntos.length; k++) {
      const a = l.puntos[k - 1], b = l.puntos[k];
      const tramo = Math.hypot(b.x - a.x, b.y - a.y);
      // Solo cuenta lo que se ve (una línea larga fuera de pantalla no manda).
      if (dentro(a) || dentro(b)) largo += tramo;
      while (tramo > 0 && recorrido + tramo >= proximo) {
        const t = (proximo - recorrido) / tramo;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (dentro(p)) cand.push(p);
        proximo += cadaPx;
      }
      recorrido += tramo;
    }
    if (cand.length) porLinea.push({ nivel: l.nivel, cand, largo });
  }
  porLinea.sort((a, b) => b.largo - a.largo);
  const elegidas = [];
  const maxRondas = Math.max(0, ...porLinea.map((l) => l.cand.length));
  for (let r = 0; r < maxRondas && elegidas.length < max; r++) {
    for (const l of porLinea) {
      if (elegidas.length >= max) break;
      const p = l.cand[r];
      if (!p) continue;
      if (elegidas.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < separacion)) continue;
      elegidas.push({ x: p.x, y: p.y, nivel: l.nivel, texto: textoGrados(l.nivel) });
    }
  }
  return elegidas;
}

// "18°", "18,5°" (coma decimal).
export function textoGrados(n) {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")}°`;
}
// "16 °C", "16,5 °C" (leyenda).
export function textoExtremo(n) {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} °C`;
}
// "18,4 °C en superficie" (al tocar el mapa).
export function textoToque(v) {
  return `${v.toFixed(1).replace(".", ",")} °C en superficie`;
}
// "Líneas cada 1 °C", "cada 0,5 °C".
export function textoIntervalo(paso) {
  return `Líneas cada ${String(paso).replace(".", ",")} °C`;
}
