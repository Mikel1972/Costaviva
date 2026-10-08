// scripts/fondo/geometria.mjs
//
// Geometría mínima (sin dependencias) para precalcular el tipo de fondo de
// cada spot (scripts/fondo/tipo-fondo.mjs). Proyección local equirectangular
// en metros alrededor de un punto: sobra para radios de 1-3 km.
// Pura, con tests en test/tipo-fondo.test.js.

const R = 6371008.8;
const RAD = Math.PI / 180;

// Proyector local: [lon, lat] -> [x, y] en metros respecto a (lat0, lon0).
export function proyector(lat0, lon0) {
  const kx = R * RAD * Math.cos(lat0 * RAD), ky = R * RAD;
  return {
    a: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky],
    de: ([x, y]) => [lon0 + x / kx, lat0 + y / ky],
  };
}

// Distancia de p a un segmento ab (en metros, ya proyectados) y el punto más cercano.
export function puntoEnSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}

// Punto más cercano a p sobre un conjunto de polilíneas (listas de [x, y]).
export function masCercanoEnLineas(p, lineas) {
  let mejor = { d: Infinity, q: null };
  for (const l of lineas) {
    for (let i = 1; i < l.length; i++) {
      const r = puntoEnSegmento(p, l[i - 1], l[i]);
      if (r.d < mejor.d) mejor = r;
    }
    if (l.length === 1) {
      const d = Math.hypot(p[0] - l[0][0], p[1] - l[0][1]);
      if (d < mejor.d) mejor = { d, q: l[0] };
    }
  }
  return mejor;
}

// ¿p dentro de un conjunto de anillos? Regla par-impar: los agujeros
// (anillos interiores) restan solos. Los anillos no tienen que venir cerrados.
export function dentroAnillos(p, anillos) {
  let dentro = false;
  for (const r of anillos) {
    const n = r.length;
    if (n < 3) continue;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

// Anillos de una geometría GeoJSON (Polygon o MultiPolygon), ya proyectados.
export function anillosGeoJSON(geom, proy) {
  if (!geom) return [];
  const polis = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polis.flatMap((poli) => poli.map((anillo) => anillo.map(proy)));
}

// Caja [xmin, ymin, xmax, ymax] de unos anillos (para descartar rápido).
export function caja(anillos) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of anillos) for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}

// Rejilla de puntos (x, y) cada `paso` m dentro de un círculo de `radio` m
// alrededor de `centro`, con la distancia al centro.
export function rejillaCirculo(centro, radio, paso) {
  const pts = [];
  const n = Math.floor(radio / paso);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * paso, y = j * paso, d = Math.hypot(x, y);
      if (d <= radio) pts.push({ p: [centro[0] + x, centro[1] + y], d });
    }
  }
  return pts;
}
