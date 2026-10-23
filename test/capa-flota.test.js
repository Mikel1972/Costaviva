// Capa de la flota pesquera faenando (assets/js/capa-flota.js, fase 2,
// 2026-10-22): lo puro (filtro por periodo y eslora, umbral de 3 barcos,
// colores, celdas), los textos en es/en/pt y cómo la monta index.html (solo
// en Embarcación, por el evento `modalidad`). Sin red ni DOM. Corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  zonasVisibles, colorCalor, intensidadFlota, alfaCalor, tablaCalor, radioBlobPx, metrosPorPixel, centroCelda,
  celdaCercana, gradienteCss, PARADAS, OPACIDAD_MAX, RADIO_MIN_PX, RADIO_MAX_PX,
  diasPlay, diaMadrid, paradosVisibles, posicionParado, textoParado, tamParado, ultimaEscucha, CADUCA_PARADOS_H, zonasDelDia, diasConDatos, fechaDia, DIAS_PLAY, MIN_DIAS_PLAY, limitesCelda, capaVisible, textoCelda, textoVacio, claveClase,
  MIN_BARCOS, CLASES, PERIODOS, CADUCA_H, empiezaPlegado, ANCHO_PLEGADO, modalidadInicial,
} from "../assets/js/capa-flota.js";
import { leerDiccionario } from "./i18n-html.js";

const AHORA = new Date("2026-10-22T12:30:00Z");
const RECIENTE = "2026-10-22T12:10:00Z";
const z = (periodo, clase, n, lat = 43.6, lon = -3.1, calculado = RECIENTE) => ({ periodo, clase, n_barcos: n, celda_lat: lat, celda_lon: lon, especie_probable: null, calculado });

test("solo en Embarcación", () => {
  assert.equal(capaVisible("embarcacion"), true);
  for (const m of ["costa", "submarina", undefined]) assert.equal(capaVisible(m), false);
});

test("modalidad al arrancar: <html data-modalidad> > localStorage va_modalidad > costa", () => {
  const doc = (m) => ({ documentElement: { dataset: m ? { modalidad: m } : {} } });
  const alm = (v) => ({ getItem: (k) => (k === "va_modalidad" ? v : null) });
  assert.equal(modalidadInicial(doc("embarcacion"), alm("costa")), "embarcacion");
  assert.equal(modalidadInicial(doc(), alm("embarcacion")), "embarcacion");
  assert.equal(modalidadInicial(doc("rara"), alm("submarina")), "submarina");
  assert.equal(modalidadInicial(doc(), { getItem: () => { throw new Error("bloqueado"); } }), "costa");
  assert.equal(modalidadInicial(undefined, undefined), "costa");
});

test("filtro por periodo (Hoy 24 h / Ayer) y por eslora", () => {
  const filas = [z("24h", "todas", 5), z("24h", "<24", 3), z("ayer", "todas", 4, 43.5), z("ayer", ">40", 3, 43.5)];
  assert.deepEqual(zonasVisibles(filas, { ahora: AHORA }).map((f) => f.n_barcos), [5]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "24h", clase: "<24", ahora: AHORA }).map((f) => f.n_barcos), [3]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "ayer", ahora: AHORA }).map((f) => f.celda_lat), [43.5]);
  assert.deepEqual(zonasVisibles(filas, { periodo: "ayer", clase: "24-40", ahora: AHORA }), []);
  assert.deepEqual(PERIODOS, ["24h", "ayer"]);
  assert.deepEqual(CLASES, ["todas", "<24", "24-40", ">40"]);
});

test("privacidad: aunque llegara una celda con menos de 3 barcos, no se pinta", () => {
  assert.equal(MIN_BARCOS, 3);
  assert.deepEqual(zonasVisibles([z("24h", "todas", 2), z("24h", "todas", 1), z("24h", "todas", "2")], { ahora: AHORA }), []);
  assert.equal(zonasVisibles([z("24h", "todas", "3")], { ahora: AHORA }).length, 1);
});

test("un cálculo caducado (el robot parado) no se enseña como 'últimas 24 h'", () => {
  assert.equal(CADUCA_H, 26);
  const viejo = new Date(AHORA.getTime() - 27 * 3600_000).toISOString();
  assert.deepEqual(zonasVisibles([z("24h", "todas", 9, 43.6, -3.1, viejo)], { ahora: AHORA }), []);
  assert.equal(zonasVisibles(null, { ahora: AHORA }).length, 0);
});

test("mapa de calor: gradiente amarillo -> naranja -> rojo, más intenso con más barcos (tope en 30)", () => {
  assert.deepEqual(colorCalor(0), [255, 224, 102]);
  assert.deepEqual(colorCalor(1), [127, 29, 29]);
  assert.deepEqual(colorCalor(0.45), [245, 158, 11]);
  assert.deepEqual(colorCalor(2), colorCalor(1));
  assert.equal(intensidadFlota(2), 0, "por debajo del umbral, nada");
  assert.equal(intensidadFlota(3), 0.35);
  assert.ok(intensidadFlota(6) > intensidadFlota(3) && intensidadFlota(12) > intensidadFlota(6));
  assert.equal(intensidadFlota(30), 1);
  assert.equal(intensidadFlota(300), 1, "tope: más barcos no satura más");
  assert.equal(alfaCalor(1), OPACIDAD_MAX);
  assert.equal(alfaCalor(0), 0);
  const t = tablaCalor();
  assert.equal(t.length, 1024);
  assert.equal(t[3], 0, "intensidad 0 = transparente");
  assert.deepEqual([...t.slice(255 * 4, 255 * 4 + 3)], PARADAS.at(-1)[1]);
  assert.match(gradienteCss(), /^linear-gradient\(90deg, rgb\(255,224,102\) 0%, .* rgb\(127,29,29\) 100%\)$/);
});

test("radio de la mancha: ~3,5 km según zoom y latitud, con mínimo y máximo", () => {
  assert.ok(Math.abs(metrosPorPixel(0, 0) - 156543.03) < 0.1);
  const r9 = radioBlobPx(9, 43.5), r11 = radioBlobPx(11, 43.5);
  assert.ok(r11 > r9 * 3.9 && r11 < r9 * 4.1, "el doble de zoom, el doble de radio (x4 en dos niveles)");
  assert.equal(radioBlobPx(4, 43.5), RADIO_MIN_PX, "a zoom bajo, mínimo");
  assert.equal(radioBlobPx(16, 43.5), RADIO_MAX_PX, "a zoom alto, máximo");
  // Una celda de 0,05° a zoom 10 mide ~36 px de ancho: la mancha (~2 radios) la cubre con borde suave.
  assert.ok(radioBlobPx(10, 43.5) >= 30 && radioBlobPx(10, 43.5) <= 50);
});

test("tooltip: la celda que contiene el punto, o la más cercana a menos de una celda", () => {
  const zs = [z("24h", "todas", 4, 43.6, -3.1), z("24h", "todas", 9, 43.65, -3.1)];
  assert.deepEqual(centroCelda(43.6, -3.1), [43.625, -3.075]);
  assert.equal(celdaCercana(zs, 43.61, -3.08).n_barcos, 4);
  assert.equal(celdaCercana(zs, 43.67, -3.08).n_barcos, 9);
  assert.equal(celdaCercana(zs, 43.0, -3.08), null);
  assert.equal(celdaCercana([], 43.6, -3.1), null);
});

test("móvil: el control empieza plegado (chip) en pantallas de 600 px o menos", () => {
  assert.equal(ANCHO_PLEGADO, 600);
  for (const w of [320, 390, 600]) assert.equal(empiezaPlegado(w), true, `${w}px`);
  for (const w of [601, 768, 1280]) assert.equal(empiezaPlegado(w), false, `${w}px`);
  assert.equal(empiezaPlegado(undefined), false);
  const JS = readFileSync(new URL("../assets/js/capa-flota.js", import.meta.url), "utf8");
  assert.match(JS, /setAttribute\("aria-expanded"/);
  assert.match(JS, /setAttribute\("aria-controls", "flotaCuerpo"\)/);
});

test("celda de 0,05° (~5 km): esquina sur-oeste + paso", () => {
  assert.deepEqual(limitesCelda(43.6, -3.1), [[43.6, -3.1], [43.65, -3.05]]);
  assert.deepEqual(limitesCelda("43.45", "-2.95"), [[43.45, -2.95], [43.5, -2.9]]);
});

test("textos: tooltip con barcos y eslora; vacío según el periodo; especie probable cuando llegue", () => {
  assert.equal(textoCelda(z("24h", "todas", 4)), "4 barcos faenando");
  assert.equal(textoCelda(z("24h", ">40", 3)), "3 barcos faenando · Más de 40 m");
  assert.equal(textoCelda({ ...z("24h", "todas", 6), especie_probable: "anchoa" }), "6 barcos faenando · Probablemente anchoa");
  assert.equal(textoVacio("24h"), "Sin flota faenando registrada en las últimas 24 h");
  assert.equal(textoVacio("ayer"), "Sin flota faenando registrada ayer");
});

test("▶️ 14 días: días de Madrid, un día cada fotograma (no acumulado), mismo filtro y umbral", () => {
  assert.equal(DIAS_PLAY, 14);
  assert.equal(MIN_DIAS_PLAY, 2);
  // 23:30 UTC del 22 de octubre ya es 23 en Madrid (horario de verano).
  assert.equal(diaMadrid(new Date("2026-10-22T23:30:00Z")), "2026-10-23");
  const d = diasPlay(new Date("2026-10-22T23:30:00Z"));
  assert.equal(d.length, 14);
  assert.equal(d.at(-1), "2026-10-23");
  assert.equal(d[0], "2026-10-10");
  // Cambio de hora (25 de octubre): sigue habiendo 14 días distintos y seguidos.
  const c = diasPlay(new Date("2026-11-02T10:00:00Z"));
  assert.equal(new Set(c).size, 14);
  assert.deepEqual(c.slice(-3), ["2026-10-31", "2026-11-01", "2026-11-02"]);
  const h = [
    { dia: "2026-10-21", clase: "todas", n_barcos: 5, celda_lat: 43.6, celda_lon: -3.1 },
    { dia: "2026-10-21", clase: "<24", n_barcos: 3, celda_lat: 43.6, celda_lon: -3.1 },
    { dia: "2026-10-22", clase: "todas", n_barcos: 4, celda_lat: 43.5, celda_lon: -3.1 },
    { dia: "2026-10-22", clase: "todas", n_barcos: 2, celda_lat: 43.4, celda_lon: -3.1 },
  ];
  assert.deepEqual(zonasDelDia(h, "2026-10-21").map((f) => f.n_barcos), [5]);
  assert.deepEqual(zonasDelDia(h, "2026-10-21", "<24").map((f) => f.n_barcos), [3]);
  assert.deepEqual(zonasDelDia(h, "2026-10-22").map((f) => f.celda_lat), [43.5], "la de 2 barcos no");
  assert.equal(diasConDatos(h), 2);
  assert.equal(diasConDatos(h.slice(0, 2)), 1, "con un solo día no hay play");
  assert.equal(diasConDatos([]), 0);
  assert.match(fechaDia("2026-10-22"), /22/);
});

test("🔴 parados: última escucha, >= 3 barcos, puerto o centro de la celda, y su texto", () => {
  const AH = new Date("2026-10-23T09:00:00Z");
  const e = "2026-10-23T08:20:00Z";
  const filas = [
    { tipo: "puerto", puerto: "Ondarroa", lat: 43.322, lon: -2.418, n_barcos: 14, escucha: e },
    { tipo: "mar", puerto: null, lat: 43.6, lon: -2.85, n_barcos: 3, escucha: e },
    { tipo: "mar", puerto: null, lat: 43.7, lon: -2.85, n_barcos: 2, escucha: e },
    { tipo: "puerto", puerto: "Bermeo", lat: 43.42, lon: -2.721, n_barcos: 5, escucha: "2026-10-22T20:00:00Z" },
    { tipo: "otro", lat: 43.7, lon: -2.85, n_barcos: 9, escucha: e },
  ];
  assert.equal(CADUCA_PARADOS_H, 6);
  const v = paradosVisibles(filas, AH);
  assert.deepEqual(v.map((f) => f.puerto ?? f.lat), ["Ondarroa", 43.6], "ni < 3, ni caducados, ni tipos raros");
  assert.deepEqual(posicionParado(v[0]), [43.322, -2.418]);
  assert.deepEqual(posicionParado(v[1]), [43.625, -2.825]);
  assert.equal(textoParado(v[0]), "Ondarroa · 14 parados");
  assert.equal(textoParado(v[1]), "3 parados en el mar");
  assert.equal(tamParado(3), 22);
  assert.equal(tamParado(400), 38);
  assert.ok(tamParado(14) > tamParado(5));
  assert.equal(ultimaEscucha(v).toISOString(), "2026-10-23T08:20:00.000Z");
  assert.equal(ultimaEscucha([]), null);
});

test("i18n: todas las claves flota.* en es, en y pt (también las compuestas)", () => {
  const dic = (i) => leerDiccionario(new URL(`../assets/i18n/${i}.js`, import.meta.url));
  const ES = dic("es"), EN = dic("en"), PT = dic("pt");
  const usadas = [...readFileSync(new URL("../assets/js/capa-flota.js", import.meta.url), "utf8").matchAll(/I18n\.t\("(flota\.[\w.]+)"/g)].map((m) => m[1]);
  const compuestas = CLASES.map((c) => `flota.clase.${claveClase(c)}`);
  for (const k of [...usadas, ...compuestas, "flota.vacio_24h", "flota.vacio_ayer", "flota.hoy", "flota.ayer", "flota.chip", "flota.pocos_dias", "flota.play_ayuda", "flota.vacio_dia", "lluvia.pausar", "lluvia.reproducir", "flota.parados", "flota.parados_puerto", "flota.parados_mar", "flota.ultima_escucha", "flota.sin_parados"]) {
    for (const [n, d] of [["es", ES], ["en", EN], ["pt", PT]]) assert.ok(k in d, `${k} en ${n}`);
  }
  assert.equal(ES["flota.hoy"], "Hoy (24 h)");
  assert.equal(ES["flota.ayer"], "Ayer");
  assert.equal(ES["flota.pocos_dias"], "Aún no hay días suficientes");
  assert.match(ES["flota.atribucion"], /Datos AIS: .*aisstream\.io/);
  assert.match(EN["flota.atribucion"], /AIS data: .*aisstream\.io/);
  assert.match(PT["flota.atribucion"], /Dados AIS: .*aisstream\.io/);
});

test("index.html: carga el módulo, lo monta con flota_zonas y avisa de la modalidad con un evento", () => {
  const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const JS = readFileSync(new URL("../assets/js/capa-flota.js", import.meta.url), "utf8");
  assert.match(HTML, /import \* as Flota from "\/assets\/js\/capa-flota\.js";/);
  assert.match(HTML, /\.from\("flota_zonas"\)/);
  assert.match(HTML, /\.from\("flota_zonas_dia"\)/);
  assert.match(HTML, /consultarDias:/);
  assert.match(HTML, /\.from\("flota_parados"\)/);
  // Sin librerías nuevas: el calor se pinta en un canvas propio.
  assert.doesNotMatch(HTML, /leaflet-heat|leaflet\.heat|heatmap\.js/i);
  assert.match(JS, /globalCompositeOperation = "lighten"/, "las manchas se juntan con el máximo, no sumando");
  assert.doesNotMatch(HTML, /\.from\("flota_faena"\)|\.from\("flota_barcos"\)/, "las tablas con barcos nunca desde el navegador");
  // La capa no depende de dónde esté el selector: ponerModalidad() (el único
  // setter) lanza el evento `modalidad` y marca <html data-modalidad>.
  const poner = HTML.slice(HTML.indexOf("function ponerModalidad"), HTML.indexOf("function elegirModalidad"));
  assert.match(poner, /new CustomEvent\("modalidad", \{ detail: \{ modalidad: m \} \}\)/);
  assert.match(poner, /document\.documentElement\.dataset\.modalidad = m/);
  assert.match(JS, /document\.addEventListener\("modalidad"/);
  assert.doesNotMatch(JS, /modTab-/);
  // Gratis para todos: nada de premium en la capa.
  assert.doesNotMatch(JS, /premium/i);
  assert.ok(!/\son[a-z]+=/i.test(JS), "sin on*= (CSP)");
});
