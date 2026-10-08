// scripts/batimetria/batimetria.mjs
//
// Lectura de batimetría gratuita, sin IA (2026-10-08, aprobado por Mikel).
// Fuente principal: EMODnet Bathymetry, DTM 2024 (CC BY 4.0, uso comercial
// permitido con atribución), servicio WCS público de
// https://ows.emodnet-bathymetry.eu/wcs, cobertura `emodnet__mean`
// (1/16 de minuto de arco, ~115 m), formato text/plain.
// Respaldo: GEBCO_2026 Grid (dominio público, atribución pedida) por
// OPeNDAP de CEDA, 15 segundos de arco (~460 m).
// Licencias, textos de atribución y URL: datos-robots/fuentes/BATIMETRIA.md.
//
// Convención de los dos servicios: ELEVACIÓN en metros (negativo = bajo el
// nivel del mar, positivo = tierra). Aquí se devuelve igual; quien lo use
// convierte a profundidad positiva (`-elevacion`).
//
// Las funciones de análisis (parsear, estadisticasPunto, isolineas,
// simplificar) son puras y tienen tests en test/batimetria.test.js.

export const GEBCO_DAP = "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc";
export const UA = "Costaviva-batimetria/1.0 (+https://costaviva.org; datos@costaviva.org)";

import {
  EMODNET_WCS, M_POR_GRADO, valorRejilla, latFila, lonCol, parsearWcsTexto, urlWcs,
} from "../../assets/js/batimetria-calculo.js";
// Lo puro vive en assets/js/batimetria-calculo.js (lo usa también el navegador).
export {
  EMODNET_WCS, valorRejilla, latFila, lonCol, parsearWcsTexto, urlWcs,
  estadisticasPunto, contextoReglas, cajaAlrededor, RADIO_ZONA_M, RADIO_ALCANCE_M, ISOBATAS_DISTANCIA,
} from "../../assets/js/batimetria-calculo.js";

// Respuesta .ascii de OPeNDAP (GEBCO): bloques "lon[n]", "lat[n]" y
// "elevation.elevation[F][C]" con filas "[k], v1, v2...". Latitudes de S a N.
export function parsearDapAscii(texto) {
  const bloque = (cab) => {
    const i = texto.indexOf(cab);
    if (i < 0) throw new Error(`OPeNDAP: falta ${cab}`);
    return texto.slice(i + cab.length).split("\n\n")[0];
  };
  const lista = (s) => s.trim().split(/,\s*/).map(Number);
  const lon = lista(bloque("\nlon[").replace(/^\d+\]\n/, ""));
  const lat = lista(bloque("\nlat[").replace(/^\d+\]\n/, ""));
  const filasTxt = bloque("elevation.elevation[").split("\n").slice(1).filter((l) => l.startsWith("["));
  const cols = lon.length, filas = lat.length;
  const v = new Float64Array(filas * cols);
  filasTxt.forEach((l, f) => {
    const p = l.replace(/^\[\d+\],\s*/, "").split(/,\s*/).map(Number);
    for (let c = 0; c < cols; c++) v[f * cols + c] = p[c];
  });
  return { lat0: lat[0], lon0: lon[0], dlat: lat[1] - lat[0], dlon: lon[1] - lon[0], filas, cols, v };
}

async function pedir(url, intentos = 4) {
  let ultimo;
  for (let k = 0; k < intentos; k++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      ultimo = e;
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** k));
    }
  }
  throw new Error(`${url.split("?")[0]}: ${ultimo.message}`);
}

// Caja { sur, norte, oeste, este } de EMODnet. escala (0-1) = SCALEFACTOR.
export async function rejillaEmodnet(caja, escala = 1) {
  return parsearWcsTexto(await pedir(urlWcs(caja, escala)));
}

// Misma caja en GEBCO_2026 (15", índices de celda: (lat+90)·240, (lon+180)·240).
export async function rejillaGebco(caja) {
  const f0 = Math.floor((caja.sur + 90) * 240), f1 = Math.ceil((caja.norte + 90) * 240);
  const c0 = Math.floor((caja.oeste + 180) * 240), c1 = Math.ceil((caja.este + 180) * 240);
  const r = `[${f0}:1:${f1}][${c0}:1:${c1}]`;
  const url = `${GEBCO_DAP}.ascii?elevation${encodeURIComponent(r)},lat${encodeURIComponent(`[${f0}:1:${f1}]`)},lon${encodeURIComponent(`[${c0}:1:${c1}]`)}`;
  return parsearDapAscii(await pedir(url));
}

// ---------------------------------------------------------------------------
// Isolíneas (marching squares) de una rejilla a un nivel de elevación.
// Devuelve polilíneas [[lon, lat], ...] ya encadenadas. Los NaN cortan la
// línea. Puro y determinista.
// ---------------------------------------------------------------------------
export function isolineas(g, nivel) {
  const segs = [];
  const P = (f, c) => [lonCol(g, c), latFila(g, f)];
  const interp = (fa, ca, va, fb, cb, vb) => {
    const t = (nivel - va) / (vb - va);
    const [xa, ya] = P(fa, ca), [xb, yb] = P(fb, cb);
    return [xa + t * (xb - xa), ya + t * (yb - ya)];
  };
  for (let f = 0; f < g.filas - 1; f++) {
    for (let c = 0; c < g.cols - 1; c++) {
      const a = valorRejilla(g, f, c), b = valorRejilla(g, f, c + 1);
      const d = valorRejilla(g, f + 1, c), e = valorRejilla(g, f + 1, c + 1);
      if (![a, b, d, e].every(Number.isFinite)) continue;
      // Bordes: arriba (a-b), derecha (b-e), abajo (d-e), izquierda (a-d)
      const pts = [];
      if ((a < nivel) !== (b < nivel)) pts.push(["t", interp(f, c, a, f, c + 1, b)]);
      if ((b < nivel) !== (e < nivel)) pts.push(["r", interp(f, c + 1, b, f + 1, c + 1, e)]);
      if ((d < nivel) !== (e < nivel)) pts.push(["b", interp(f + 1, c, d, f + 1, c + 1, e)]);
      if ((a < nivel) !== (d < nivel)) pts.push(["l", interp(f, c, a, f + 1, c, d)]);
      if (pts.length === 2) segs.push([pts[0][1], pts[1][1]]);
      else if (pts.length === 4) {
        // Punto de silla: se decide con la media del centro.
        const centro = (a + b + d + e) / 4;
        const m = Object.fromEntries(pts);
        if ((centro < nivel) === (a < nivel)) { segs.push([m.t, m.r], [m.b, m.l]); }
        else { segs.push([m.t, m.l], [m.b, m.r]); }
      }
    }
  }
  return encadenar(segs);
}

// Une segmentos que comparten extremo en polilíneas.
export function encadenar(segs) {
  const clave = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const porExtremo = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = clave(p);
      if (!porExtremo.has(k)) porExtremo.set(k, []);
      porExtremo.get(k).push(i);
    }
  });
  const usado = new Uint8Array(segs.length);
  const lineas = [];
  const siguiente = (p) => (porExtremo.get(clave(p)) || []).find((j) => !usado[j]);
  for (let i = 0; i < segs.length; i++) {
    if (usado[i]) continue;
    usado[i] = 1;
    const linea = [segs[i][0], segs[i][1]];
    for (const hacia of ["fin", "inicio"]) {
      for (;;) {
        const extremo = hacia === "fin" ? linea[linea.length - 1] : linea[0];
        const j = siguiente(extremo);
        if (j === undefined) break;
        usado[j] = 1;
        const [p, q] = segs[j];
        const otro = clave(p) === clave(extremo) ? q : p;
        if (hacia === "fin") linea.push(otro); else linea.unshift(otro);
      }
    }
    lineas.push(linea);
  }
  return lineas;
}

// Douglas-Peucker en grados (tolerancia en grados, con la longitud
// corregida por cos(lat)).
export function simplificar(linea, tol) {
  if (linea.length <= 2) return linea;
  const cosLat = Math.cos((linea[0][1] * Math.PI) / 180);
  const dist = (p, a, b) => {
    const ax = a[0] * cosLat, ay = a[1], bx = b[0] * cosLat, by = b[1], px = p[0] * cosLat, py = p[1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const guardar = new Uint8Array(linea.length);
  guardar[0] = guardar[linea.length - 1] = 1;
  const pila = [[0, linea.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let max = 0, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = dist(linea[m], linea[i], linea[j]);
      if (d > max) { max = d; k = m; }
    }
    if (max > tol && k > 0) { guardar[k] = 1; pila.push([i, k], [k, j]); }
  }
  return linea.filter((_, i) => guardar[i]);
}

export function longitudM(linea) {
  let s = 0;
  for (let i = 1; i < linea.length; i++) {
    const cosLat = Math.cos((linea[i][1] * Math.PI) / 180);
    s += Math.hypot((linea[i][0] - linea[i - 1][0]) * cosLat, linea[i][1] - linea[i - 1][1]) * M_POR_GRADO;
  }
  return s;
}

// Puntos para etiquetar una polilínea: uno cada `cadaM` metros a lo largo de
// ella, el primero a la mitad de ese paso (una línea más corta que el paso
// lleva uno, en su mitad). Devuelve [[lon, lat], ...].
export function puntosEtiqueta(linea, cadaM) {
  if (linea.length < 2) return [];
  const total = longitudM(linea);
  const objetivos = [];
  if (total < cadaM) objetivos.push(total / 2);
  else for (let d = cadaM / 2; d < total; d += cadaM) objetivos.push(d);
  const out = [];
  let acum = 0, k = 0;
  for (let i = 1; i < linea.length && k < objetivos.length; i++) {
    const tramo = longitudM([linea[i - 1], linea[i]]);
    while (k < objetivos.length && acum + tramo >= objetivos[k]) {
      const t = tramo ? (objetivos[k] - acum) / tramo : 0;
      out.push([linea[i - 1][0] + t * (linea[i][0] - linea[i - 1][0]), linea[i - 1][1] + t * (linea[i][1] - linea[i - 1][1])]);
      k++;
    }
    acum += tramo;
  }
  return out;
}
