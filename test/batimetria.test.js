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
} from "../scripts/batimetria/batimetria.mjs";
import {
  profundidadDeSpot, profundidadDeRest, urlDepthSample, capaVisible, ESTILO_ISOBATA, ATRIBUCION_ISOBATAS,
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
});

test("estadisticasPunto: sin mar en la caja = todo null, sin inventar", () => {
  const st = estadisticasPunto(rejilla({ f: () => 12 }), 43.0, -2.99);
  assert.equal(st.zona_m, null);
  assert.equal(st.dist_mar_m, null);
  assert.equal(st.dist_20m_m, null);
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
    if (p.zona_m !== null) assert.ok(["emodnet_dtm_2024", "gebco_2026"].includes(p.fuente));
  }
  // Bakio, a 1 km de la playa: fondo de arena de unos 15 m (carta náutica: 10-20 m).
  assert.ok(PROF.spots.bakio.zona_m > 8 && PROF.spots.bakio.zona_m < 25);
  // Mundaka: dentro de la ría, poco fondo.
  assert.ok(PROF.spots.mundaka.zona_m < 8);
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
  assert.equal(profundidadDeSpot(PROF, "bakio"), PROF.spots.bakio.zona_m);
  assert.equal(profundidadDeSpot(PROF, "no-existe"), null);
  assert.equal(profundidadDeSpot(null, "bakio"), null);
  assert.equal(profundidadDeRest({ avg: -936.2 }), 936.2);
  assert.equal(profundidadDeRest({ avg: 4.6 }), null, "tierra");
  assert.equal(profundidadDeRest({}), null);
  assert.match(urlDepthSample(43.43, -2.81), /depth_sample\?geom=POINT\(-2\.81000%2043\.43000\)$/);
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
function reglasProf(id, { tempAgua, profundidad, modalidad = "embarcacion", lugar = BAKIO }) {
  const h = serie(tempAgua);
  const r = calcularVentana(especie(id), DATOS.reglas_por_defecto, h, {
    ...lugar, modalidad, profundidad, reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas,
  })[48];
  return r.razones.filter((x) => String(x.factor).startsWith("regla:profundidad_"));
}

test("reglas de profundidad: bien formadas, de Mikel, activas y con variable de contexto", () => {
  assert.ok(VARIABLES_CONTEXTO.includes("profundidad"));
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

test("verano (agua ≥ 18 °C): fondo de 10-30 m suma a pargo, dorada y dentón", () => {
  for (const id of ["bocinegro", "dorada", "denton"]) {
    const rs = reglasProf(id, { tempAgua: 21, profundidad: 18 });
    assert.equal(rs.length, 1, id);
    assert.equal(rs[0].factor, "regla:profundidad_verano_somera");
    assert.ok(rs[0].aporte > 0);
    assert.equal(rs[0].texto, "profundidad adecuada para la época");
  }
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: 45 }).length, 0, "verano y fondo hondo: no dice nada");
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: 5 }).length, 0);
});

test("invierno (agua ≤ 15 °C): poco fondo resta, más de 40 m suma; transición no aplica", () => {
  const somero = reglasProf("denton", { tempAgua: 13, profundidad: 12 });
  assert.equal(somero.length, 1);
  assert.equal(somero[0].factor, "regla:profundidad_invierno_somera");
  assert.ok(somero[0].aporte < 0);
  const profundo = reglasProf("bocinegro", { tempAgua: 13, profundidad: 60 });
  assert.equal(profundo[0].factor, "regla:profundidad_invierno_profunda");
  assert.ok(profundo[0].aporte > 0);
  assert.equal(reglasProf("bocinegro", { tempAgua: 13, profundidad: 30 }).length, 0, "25-40 m: nada");
  assert.equal(reglasProf("bocinegro", { tempAgua: 16.5, profundidad: 12 }).length, 0, "15-18 °C: transición");
});

test("reglas de profundidad: solo embarcación, solo esas especies, y sin dato no aplican", () => {
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: 18, modalidad: "costa" }).length, 0);
  assert.equal(reglasProf("lubina", { tempAgua: 21, profundidad: 18 }).length, 0);
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: null }).length, 0);
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: undefined }).length, 0);
  const tenerife = { lat: 28.46, lon: -16.25, slug: "santacruztenerife" };
  assert.equal(reglasProf("dorada", { tempAgua: 21, profundidad: 18, lugar: tenerife }).length, 0, "fuera de Canarias");
});
