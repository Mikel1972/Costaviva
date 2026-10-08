// Tests de la batimetría (2026-10-08): lectura de las rejillas de EMODnet
// (WCS text/plain) y GEBCO (OPeNDAP ascii), estadísticas de profundidad de un
// spot, isolíneas, los datos generados (profundidad-spots.json e
// isobatas.json), las funciones puras de la capa del mapa y las reglas de
// profundidad por temporada de embarcación (pargo, dorada, dentón). Lógica
// pura: sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import {
  parsearWcsTexto, parsearDapAscii, estadisticasPunto, isolineas, encadenar, simplificar, longitudM,
  contextoReglas, cajaAlrededor, urlWcs,
} from "../scripts/batimetria/batimetria.mjs";
import {
  batimetriaDeSpot, capaVisible, ESTILO_ISOBATA, ATRIBUCION_ISOBATAS, RADIO_CAJA_PUNTO_M,
} from "../assets/js/capa-batimetria.js";
import { calcularVentana } from "../assets/js/ventana-actividad.js";
import { validarRegla, VARIABLES_CONTEXTO } from "../assets/js/reglas-expertas.js";
import { SPOTS } from "../functions/prevision.js";

const leer = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const DATOS = leer("../assets/datos/especies.json");
const PROF = leer("../assets/datos/profundidad-spots.json");
const ISO_URL = new URL("../assets/datos/isobatas.json", import.meta.url);
const ISO = JSON.parse(readFileSync(ISO_URL, "utf8"));

// Rejilla sintética: elevación = -(columna · 10) m (de la orilla hacia mar
// adentro, de oeste a este), celdas de 0,001°.
function rejilla({ filas = 21, cols = 21, lat0 = 43.01, lon0 = -3, f = (r, c) => -c * 10 } = {}) {
  const v = new Float64Array(filas * cols);
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) v[r * cols + c] = f(r, c);
  return { lat0, lon0, dlat: -0.001, dlon: 0.001, filas, cols, v };
}

// ---------------------------------------------------------------------------
// Lectura de los servicios
// ---------------------------------------------------------------------------
test("WCS text/plain de EMODnet: cabecera afín y valores (NaN incluido)", () => {
  const txt = `Grid bounds: GeneralBounds[(-2.95, 43.40), (-2.948, 43.401)]
Grid range: GridEnvelope2D[0..2, 1..2]
Grid to world: PARAM_MT["Affine",
  PARAMETER["num_row", 3],
  PARAMETER["num_col", 3],
  PARAMETER["elt_0_0", 0.0010416666666666667],
  PARAMETER["elt_0_2", -2.949479166666663],
  PARAMETER["elt_1_1", -0.0010416666666666667],
  PARAMETER["elt_1_2", 43.420312499999994]]
Contents:
Band 0:
46.5 29.2 -11.05
-1.06 NaN -20.5
`;
  const g = parsearWcsTexto(txt);
  assert.equal(g.filas, 2);
  assert.equal(g.cols, 3);
  assert.ok(Math.abs(g.lon0 + 2.949479) < 1e-6);
  assert.ok(g.dlat < 0);
  assert.equal(g.v[2], -11.05);
  assert.ok(Number.isNaN(g.v[4]));
  assert.throws(() => parsearWcsTexto("<html>error</html>"), /elt_0_0|Band 0/);
});

test("OPeNDAP ascii de GEBCO: lat, lon y elevación", () => {
  const txt = `Dataset {
} bodc/gebco/GEBCO_2026.nc;
---------------------------------------------
lon[3]
-2.8104166666666686, -2.8062500000000057, -2.802083333333343

lat[2]
43.4, 43.404166666666667

elevation.elevation[2][3]
[0], -12, -30, -55
[1], 4, -8, -21

elevation.lat[2]
43.4, 43.404166666666667
`;
  const g = parsearDapAscii(txt);
  assert.equal(g.filas, 2);
  assert.equal(g.cols, 3);
  assert.ok(g.dlat > 0, "GEBCO va de sur a norte");
  assert.deepEqual([...g.v], [-12, -30, -55, 4, -8, -21]);
});

// ---------------------------------------------------------------------------
// Estadísticas de un spot
// ---------------------------------------------------------------------------
test("estadisticasPunto: orilla, zona a 1 km de la orilla y distancia a cada isóbata", () => {
  // Columnas 0-2 tierra (+5 m); desde la 3, 2 m más hondo por celda (~81 m).
  const g = rejilla({ f: (r, c) => (c < 3 ? 5 : -(c - 2) * 2) });
  const st = estadisticasPunto(g, 43.0, -3.0); // celda (10, 0): tierra
  assert.equal(st.en_tierra, true);
  assert.equal(st.punto_m, null);
  assert.ok(st.dist_mar_m >= 200 && st.dist_mar_m <= 260, `dist_mar ${st.dist_mar_m}`);
  assert.ok(st.zona_m > 2 && st.zona_m < 30, `zona ${st.zona_m}`);
  assert.equal(st.dist_100m_m, null, "no hay 100 m en la caja");
  assert.ok(st.dist_20m_m > st.dist_10m_m);
  assert.ok(st.celdas_mar_1km > 0);
  // Alcance desde la orilla (columna 3): en 21 columnas el fondo llega a 36 m;
  // 10-30 m empieza en la columna 7 (~4 celdas = ~330 m de la orilla).
  assert.equal(st.prof_max_3km_m, 36);
  assert.ok(st.dist_10_30m_m >= 300 && st.dist_10_30m_m <= 360, `dist 10-30 ${st.dist_10_30m_m}`);
  assert.deepEqual(contextoReglas(st), { profundidad: st.zona_m, prof_max_3km: 36, dist_fondo_10_30m_km: st.dist_10_30m_m / 1000 });
});

test("estadisticasPunto: el alcance se cuenta desde la orilla y solo hasta 3 km", () => {
  // Rejilla de 0,005° (~400 m E-O): costa en la columna 2, 10 m más por celda.
  const g = rejilla({ cols: 31, f: (r, c) => (c < 2 ? 5 : -(c - 1) * 10) });
  g.dlon = 0.005;
  const st = estadisticasPunto(g, 43.0, -3.0);
  // 3 km desde la orilla = ~7 celdas de ~407 m: hasta la columna 9 (80 m).
  assert.equal(st.prof_max_3km_m, 80);
  // Punto propio en el mar: la orilla es el propio punto.
  const enMar = estadisticasPunto(g, 43.0, -3.0 + 0.005 * 20);
  assert.equal(enMar.en_tierra, false);
  assert.equal(enMar.dist_mar_m, 0);
  assert.equal(enMar.prof_max_3km_m, 260); // columna 27
});

test("estadisticasPunto: sin mar en la caja = todo null, sin inventar", () => {
  const st = estadisticasPunto(rejilla({ f: () => 12 }), 43.0, -2.99);
  assert.equal(st.zona_m, null);
  assert.equal(st.dist_mar_m, null);
  assert.equal(st.dist_20m_m, null);
  assert.equal(st.prof_max_3km_m, null);
  assert.deepEqual(contextoReglas(st), { profundidad: null, prof_max_3km: null, dist_fondo_10_30m_km: null });
  assert.deepEqual(contextoReglas(null), { profundidad: null, prof_max_3km: null, dist_fondo_10_30m_km: null });
});

test("cajaAlrededor y urlWcs: caja de ~radio metros y petición text/plain al WCS", () => {
  const c = cajaAlrededor(43.4, -2.8, 4000);
  assert.ok(Math.abs((c.norte - c.sur) * 111320 - 8000) < 30);
  assert.ok(Math.abs((c.este - c.oeste) * 111320 * Math.cos((43.4 * Math.PI) / 180) - 8000) < 30);
  assert.match(urlWcs(c), /^https:\/\/ows\.emodnet-bathymetry\.eu\/wcs\?.*COVERAGEID=emodnet__mean&SUBSET=Lat\(43\.36\d*,43\.43\d*\).*FORMAT=text\/plain$/);
  assert.ok(RADIO_CAJA_PUNTO_M >= 3000);
});

// ---------------------------------------------------------------------------
// Isolíneas
// ---------------------------------------------------------------------------
test("isolineas: una pendiente regular da una sola línea recta en su sitio", () => {
  const g = rejilla(); // elevación -10·columna: -20 m en la columna 2
  const ls = isolineas(g, -20);
  assert.equal(ls.length, 1);
  for (const [lon] of ls[0]) assert.ok(Math.abs(lon - (-3 + 0.002)) < 1e-9);
  assert.equal(ls[0].length, g.filas);
  const s = simplificar(ls[0], 0.0001);
  assert.equal(s.length, 2, "una recta se queda en sus extremos");
  assert.ok(Math.abs(longitudM(s) - 20 * 111.32) < 5);
});

test("isolineas: un bajo cerrado da un anillo; NaN corta la línea", () => {
  const bajo = rejilla({ f: (r, c) => (Math.hypot(r - 10, c - 10) < 4 ? -5 : -40) });
  const [anillo] = isolineas(bajo, -20);
  assert.deepEqual(anillo[0], anillo[anillo.length - 1], "anillo cerrado");
  const conHueco = rejilla({ f: (r, c) => (r === 10 ? NaN : -c * 10) });
  assert.equal(isolineas(conHueco, -20).length, 2);
});

test("encadenar: une segmentos en cualquier orden y sentido", () => {
  const ls = encadenar([[[1, 0], [2, 0]], [[0, 0], [1, 0]], [[3, 0], [2, 0]]]);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].length, 4);
});

// ---------------------------------------------------------------------------
// Datos generados
// ---------------------------------------------------------------------------
test("profundidad-spots.json: todos los SPOTS, con fuente, fecha y valores razonables", () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(PROF.generado));
  assert.match(PROF.fuentes.emodnet_dtm_2024.licencia, /CC BY 4\.0/);
  assert.match(PROF.fuentes.emodnet_dtm_2024.doi, /10\.12770\/cf51df64/);
  for (const s of SPOTS) {
    const p = PROF.spots[s.slug];
    assert.ok(p, `falta ${s.slug}`);
    assert.ok(p.zona_m === null || (p.zona_m >= 0 && p.zona_m < 500), `${s.slug}: ${p.zona_m}`);
    assert.ok(p.prof_max_3km_m === null || p.prof_max_3km_m >= (p.zona_m ?? 0), `${s.slug}: alcance < zona`);
    assert.ok("dist_10_30m_m" in p && "dist_40m_m" in p);
    if (p.zona_m !== null) assert.ok(["emodnet_dtm_2024", "gebco_2026"].includes(p.fuente));
  }
  // Bakio, a 1 km de la playa: fondo de arena de unos 15 m (carta náutica: 10-20 m).
  assert.ok(PROF.spots.bakio.zona_m > 8 && PROF.spots.bakio.zona_m < 25);
  // Mundaka: dentro de la ría, poco fondo delante; y desde su orilla (en la
  // ría) no hay más de 40 m en 3 km. Hondarribia y Pasaia: puerto o bahía con
  // poco fondo delante, pero más de 40 m a 3 km (embarcación).
  assert.ok(PROF.spots.mundaka.zona_m < 8);
  assert.ok(PROF.spots.mundaka.prof_max_3km_m <= 40);
  assert.ok(PROF.spots.hondarribia.zona_m < 8);
  assert.ok(PROF.spots.hondarribia.prof_max_3km_m > 40);
  assert.ok(PROF.spots.pasaia.prof_max_3km_m > 40);
});

test("isobatas.json: 20, 50 y 100 m, con fuente CC BY y tamaño contenido", () => {
  assert.equal(ISO.type, "FeatureCollection");
  assert.deepEqual(ISO.features.map((f) => f.properties.profundidad_m), [20, 50, 100]);
  for (const f of ISO.features) {
    assert.equal(f.geometry.type, "MultiLineString");
    assert.ok(f.geometry.coordinates.length > 50, `pocas líneas de ${f.properties.profundidad_m} m`);
  }
  assert.match(ISO.fuente, /EMODnet.*CC BY 4\.0/);
  assert.ok(statSync(ISO_URL).size < 4 * 1024 * 1024, "isobatas.json debe ser pequeño (< 4 MB)");
  // Pasa por delante de Bakio: hay algún punto de la de 20 m a menos de 3 km.
  const cerca = ISO.features[0].geometry.coordinates.flat().some(([lon, lat]) => Math.hypot((lon + 2.8103) * 0.727, lat - 43.4297) < 0.027);
  assert.ok(cerca, "la isóbata de 20 m debería pasar delante de Bakio");
});

// ---------------------------------------------------------------------------
// Capa del mapa (funciones puras)
// ---------------------------------------------------------------------------
test("capa: profundidad de un spot, de la API REST y visibilidad por pestaña", () => {
  assert.equal(batimetriaDeSpot(PROF, "bakio"), PROF.spots.bakio);
  assert.equal(batimetriaDeSpot(PROF, "no-existe"), null);
  assert.equal(batimetriaDeSpot(null, "bakio"), null);
  assert.equal(capaVisible({ manual: null, modalidad: "embarcacion" }), true);
  assert.equal(capaVisible({ manual: null, modalidad: "costa" }), false);
  assert.equal(capaVisible({ manual: false, modalidad: "embarcacion" }), false);
  assert.equal(capaVisible({ manual: true, modalidad: "submarina" }), true);
  assert.deepEqual(Object.keys(ESTILO_ISOBATA), ["20", "50", "100"]);
  assert.match(ATRIBUCION_ISOBATAS, /EMODnet Bathymetry Consortium.*CC BY 4\.0/);
});

// ---------------------------------------------------------------------------
// Reglas de profundidad por temporada (embarcación)
// ---------------------------------------------------------------------------
const especie = (id) => DATOS.especies.find((e) => e.id === id);
function serie(tempAgua, n = 72) {
  const h = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 6, 10) + i * 3600000);
    h.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.6 * Math.sin((2 * Math.PI * i) / 12.42), ola: 0.6, viento: 8, vientoDir: 270, tempAgua, presion: 1016, lluvia: 0,
    });
  }
  return h;
}
const BAKIO = { lat: 43.4297, lon: -2.8103, slug: "bakio" };
// fondo: { max3km, dist1030 } (m) -> estadísticas como las de profundidad-spots.json
function reglasProf(id, { tempAgua, max3km, dist1030 = 1000, batimetria, modalidad = "embarcacion", lugar = BAKIO }) {
  const h = serie(tempAgua);
  const b = batimetria !== undefined ? batimetria : { zona_m: 5, prof_max_3km_m: max3km, dist_10_30m_m: dist1030 };
  const r = calcularVentana(especie(id), DATOS.reglas_por_defecto, h, {
    ...lugar, modalidad, batimetria: b, reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas,
  })[48];
  return r.razones.filter((x) => String(x.factor).startsWith("regla:profundidad_"));
}

test("reglas de profundidad: bien formadas, de Mikel, activas y con variable de contexto", () => {
  for (const v of ["profundidad", "prof_max_3km", "dist_fondo_10_30m_km"]) assert.ok(VARIABLES_CONTEXTO.includes(v), v);
  const reglas = DATOS.reglas_expertas.reglas.filter((r) => r.variable === "profundidad");
  assert.deepEqual(reglas.map((r) => r.id).sort(), ["profundidad_invierno_profunda", "profundidad_invierno_somera", "profundidad_verano_somera"]);
  const opciones = {
    fuentes: DATOS.fuentes, especies: DATOS.especies.map((e) => e.id), regiones: DATOS.regiones, grupos: DATOS.reglas_expertas.grupos_especies,
  };
  for (const r of reglas) {
    assert.deepEqual(validarRegla(r, opciones), [], r.id);
    assert.equal(r.fuente, "mikel_campo_bizkaia");
    assert.notEqual(r.estado, "retirada");
    assert.ok(!/\d/.test(r.texto), `sin números para el usuario: ${r.texto}`);
    assert.ok(!/mikel|regla/i.test(r.texto));
  }
});

test("verano (agua ≥ 18 °C): fondo de 10-30 m a 3 km o menos suma a pargo, dorada y dentón", () => {
  for (const id of ["bocinegro", "dorada", "denton"]) {
    const rs = reglasProf(id, { tempAgua: 21, max3km: 60, dist1030: 1200 });
    assert.equal(rs.length, 1, id);
    assert.equal(rs[0].factor, "regla:profundidad_verano_somera");
    assert.ok(rs[0].aporte > 0);
    assert.equal(rs[0].texto, "profundidad adecuada para la época");
  }
  assert.equal(reglasProf("dorada", { tempAgua: 21, max3km: 60, dist1030: 3500 }).length, 0, "10-30 m demasiado lejos");
  assert.equal(reglasProf("dorada", { tempAgua: 21, max3km: 8, dist1030: null }).length, 0, "sin fondo de 10-30 m");
});

test("invierno (agua ≤ 15 °C): más de 40 m a 3 km suma, si no resta; transición no aplica", () => {
  const somero = reglasProf("denton", { tempAgua: 13, max3km: 27 });
  assert.equal(somero.length, 1);
  assert.equal(somero[0].factor, "regla:profundidad_invierno_somera");
  assert.ok(somero[0].aporte < 0);
  const profundo = reglasProf("bocinegro", { tempAgua: 13, max3km: 60 });
  assert.equal(profundo[0].factor, "regla:profundidad_invierno_profunda");
  assert.ok(profundo[0].aporte > 0);
  assert.equal(reglasProf("bocinegro", { tempAgua: 13, max3km: 40 })[0].factor, "regla:profundidad_invierno_somera", "40 m justos: no es > 40");
  assert.equal(reglasProf("bocinegro", { tempAgua: 16.5, max3km: 12 }).length, 0, "15-18 °C: transición");
});

test("invierno con los datos reales: Hondarribia y Pasaia ya no restan (hay > 40 m cerca); Mundaka sí", () => {
  const regla = (slug) => reglasProf("dorada", { tempAgua: 13, batimetria: PROF.spots[slug] })[0]?.factor;
  assert.equal(regla("hondarribia"), "regla:profundidad_invierno_profunda");
  assert.equal(regla("pasaia"), "regla:profundidad_invierno_profunda");
  assert.equal(regla("mundaka"), "regla:profundidad_invierno_somera");
  assert.equal(regla("bakio"), "regla:profundidad_invierno_profunda");
  // Verano: los cuatro tienen fondos de 10-30 m a menos de 3 km.
  for (const slug of ["hondarribia", "pasaia", "mundaka", "bakio"]) {
    assert.equal(reglasProf("dorada", { tempAgua: 21, batimetria: PROF.spots[slug] })[0]?.factor, "regla:profundidad_verano_somera", slug);
  }
});

test("reglas de profundidad: solo embarcación, solo esas especies, y sin dato no aplican", () => {
  assert.equal(reglasProf("dorada", { tempAgua: 21, max3km: 60, modalidad: "costa" }).length, 0);
  assert.equal(reglasProf("lubina", { tempAgua: 21, max3km: 60 }).length, 0);
  assert.equal(reglasProf("dorada", { tempAgua: 21, batimetria: null }).length, 0);
  assert.equal(reglasProf("dorada", { tempAgua: 13, batimetria: null }).length, 0);
  assert.equal(reglasProf("dorada", { tempAgua: 13, max3km: null }).length, 0);
  const tenerife = { lat: 28.46, lon: -16.25, slug: "santacruztenerife" };
  assert.equal(reglasProf("dorada", { tempAgua: 21, max3km: 60, lugar: tenerife }).length, 0, "fuera de Canarias");
});
