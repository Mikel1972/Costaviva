// assets/js/batimetria-calculo.js
//
// Cálculo de batimetría puro (sin DOM ni red), compartido por los scripts de
// scripts/batimetria/ (Node) y el navegador (capa-batimetria.js, puntos
// propios). Fuente: EMODnet Bathymetry DTM 2024 (CC BY 4.0), WCS público
// https://ows.emodnet-bathymetry.eu/wcs, cobertura `emodnet__mean`, formato
// text/plain (CORS abierto). Licencias: datos-robots/fuentes/BATIMETRIA.md.
// Convención del servicio: ELEVACIÓN en metros (negativo = mar).
// Tests: test/batimetria.test.js.

export const EMODNET_WCS = "https://ows.emodnet-bathymetry.eu/wcs";
export const M_POR_GRADO = 111320;

// ---------------------------------------------------------------------------
// Rejilla: { lat0, lon0, dlat, dlon, filas, cols, v: Float64Array (fila mayor) }
// lat0/lon0 = centro de la celda [0][0]; dlat suele ser negativo (de N a S).
// ---------------------------------------------------------------------------
export function valorRejilla(g, f, c) {
  if (f < 0 || c < 0 || f >= g.filas || c >= g.cols) return NaN;
  return g.v[f * g.cols + c];
}
export const latFila = (g, f) => g.lat0 + f * g.dlat;
export const lonCol = (g, c) => g.lon0 + c * g.dlon;

// Respuesta text/plain del WCS de EMODnet (GeoServer): cabecera con
// "Grid range: GridEnvelope2D[0..C, 0..F]" y la transformación afín
// (elt_0_0 = dlon, elt_0_2 = lon del centro de la primera columna,
// elt_1_1 = dlat, elt_1_2 = lat del centro de la primera fila), luego
// "Band 0:" y una fila de valores por línea.
export function parsearWcsTexto(texto) {
  const num = (k) => {
    const m = texto.match(new RegExp(`"${k}",\\s*(-?[\\d.eE+-]+)`));
    if (!m) throw new Error(`WCS: falta ${k} en la cabecera`);
    return Number(m[1]);
  };
  const dlon = num("elt_0_0"), lon0 = num("elt_0_2"), dlat = num("elt_1_1"), lat0 = num("elt_1_2");
  const i = texto.indexOf("Band 0:");
  if (i < 0) throw new Error("WCS: respuesta sin 'Band 0:' (" + texto.slice(0, 120).replace(/\s+/g, " ") + ")");
  const lineas = texto.slice(i + 7).split("\n").map((l) => l.trim()).filter(Boolean);
  const filas = lineas.length;
  const cols = lineas[0].split(/\s+/).length;
  const v = new Float64Array(filas * cols);
  lineas.forEach((l, f) => {
    const p = l.split(/\s+/);
    if (p.length !== cols) throw new Error(`WCS: fila ${f} con ${p.length} valores (esperados ${cols})`);
    for (let c = 0; c < cols; c++) v[f * cols + c] = p[c] === "NaN" ? NaN : Number(p[c]);
  });
  return { lat0, lon0, dlat, dlon, filas, cols, v };
}

// ---------------------------------------------------------------------------
// Estadísticas de profundidad alrededor de un punto de la costa.
// Profundidades en metros positivos; celdas de tierra (elevación >= 0) o sin
// dato no cuentan. El punto de un spot suele caer en la playa, el puerto o
// incluso tierra adentro (algunos, a 1-4 km del agua), así que todo se mide
// desde la ORILLA: la celda de mar más cercana al punto (para un punto propio
// en el mar, el propio punto).
//   zona_m: mediana del fondo a 1 km de la orilla (el fondo de delante).
//   prof_max_3km_m: el fondo más profundo a 3 km o menos de la orilla.
//   dist_10_30m_m: distancia de la orilla al fondo de 10-30 m más cercano.
// Las dos últimas son la "profundidad alcanzable" desde embarcación que usan
// las reglas por temporada (decisión de Mikel, 2026-10-08: "usa la
// profundidad alcanzable"): un barco que sale de Mundaka pesca fuera de la
// ría, no en su puerto.
// ---------------------------------------------------------------------------
export const RADIO_ZONA_M = 1000;
export const RADIO_ALCANCE_M = 3000;
export const ISOBATAS_DISTANCIA = [10, 20, 30, 40, 50, 100];

function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);

export function estadisticasPunto(g, lat, lon) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const fPunto = Math.round((lat - g.lat0) / g.dlat), cPunto = Math.round((lon - g.lon0) / g.dlon);
  const elevPunto = valorRejilla(g, fPunto, cPunto);
  const distDesde = (la, lo, f, c) => Math.hypot((lonCol(g, c) - lo) * M_POR_GRADO * cosLat, (latFila(g, f) - la) * M_POR_GRADO);
  // 1) Orilla: celda de mar más cercana al punto; distancias a cada isóbata.
  let distMar = Infinity, orilla = null;
  const distIso = Object.fromEntries(ISOBATAS_DISTANCIA.map((p) => [p, Infinity]));
  for (let f = 0; f < g.filas; f++) {
    for (let c = 0; c < g.cols; c++) {
      const e = g.v[f * g.cols + c];
      if (!(e < 0)) continue; // tierra o NaN
      const d = distDesde(lat, lon, f, c);
      if (d < distMar) { distMar = d; orilla = [f, c]; }
      for (const p of ISOBATAS_DISTANCIA) if (-e >= p && d < distIso[p]) distIso[p] = d;
    }
  }
  // 2) Desde la orilla: zona (500 m y 1 km) y alcance (3 km).
  const r500 = [], r1k = [];
  let maxAlcance = null, dist1030 = Infinity;
  if (orilla) {
    const [la, lo] = [latFila(g, orilla[0]), lonCol(g, orilla[1])];
    for (let f = 0; f < g.filas; f++) {
      for (let c = 0; c < g.cols; c++) {
        const e = g.v[f * g.cols + c];
        if (!(e < 0)) continue;
        const d = distDesde(la, lo, f, c), p = -e;
        if (d <= 500) r500.push(p);
        if (d <= RADIO_ZONA_M) r1k.push(p);
        if (d <= RADIO_ALCANCE_M && (maxAlcance === null || p > maxAlcance)) maxAlcance = p;
        if (p >= 10 && p <= 30 && d < dist1030) dist1030 = d;
      }
    }
  }
  const dist = (d) => (Number.isFinite(d) ? Math.round(d / 10) * 10 : null);
  return {
    punto_m: Number.isFinite(elevPunto) && elevPunto < 0 ? r1(-elevPunto) : null,
    en_tierra: Number.isFinite(elevPunto) ? elevPunto >= 0 : null,
    dist_mar_m: dist(distMar),
    zona_m: r1(mediana(r1k)),
    prof_max_3km_m: r1(maxAlcance),
    dist_10_30m_m: dist(dist1030),
    min_500m_m: r500.length ? r1(Math.min(...r500)) : null,
    media_500m_m: r500.length ? r1(r500.reduce((s, x) => s + x, 0) / r500.length) : null,
    max_500m_m: r500.length ? r1(Math.max(...r500)) : null,
    max_1km_m: r1k.length ? r1(Math.max(...r1k)) : null,
    ...Object.fromEntries(ISOBATAS_DISTANCIA.map((p) => [`dist_${p}m_m`, dist(distIso[p])])),
    celdas_mar_1km: r1k.length,
  };
}

// Variables de contexto de las reglas expertas a partir de las estadísticas
// (o null sin dato): profundidad (zona_m), prof_max_3km (m) y
// dist_fondo_10_30m_km (km).
export function contextoReglas(st) {
  const num = (x) => (Number.isFinite(x) ? x : null);
  return {
    profundidad: num(st?.zona_m),
    prof_max_3km: num(st?.prof_max_3km_m),
    dist_fondo_10_30m_km: Number.isFinite(st?.dist_10_30m_m) ? st.dist_10_30m_m / 1000 : null,
  };
}

// Caja centrada en un punto, en grados, que cubre `radioM` metros.
export function cajaAlrededor(lat, lon, radioM) {
  const dLat = radioM / M_POR_GRADO, dLon = radioM / (M_POR_GRADO * Math.cos((lat * Math.PI) / 180));
  const r = (x) => Math.round(x * 1e4) / 1e4;
  return { sur: r(lat - dLat), norte: r(lat + dLat), oeste: r(lon - dLon), este: r(lon + dLon) };
}

export function urlWcs(caja, escala = 1) {
  return `${EMODNET_WCS}?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=emodnet__mean`
    + `&SUBSET=Lat(${caja.sur},${caja.norte})&SUBSET=Long(${caja.oeste},${caja.este})`
    + (escala !== 1 ? `&SCALEFACTOR=${escala}` : "") + "&FORMAT=text/plain";
}

