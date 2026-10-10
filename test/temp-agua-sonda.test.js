// Temperatura del agua: celda vacía junto a la costa y sonda del diario
// (2026-10-10, medida de Mikel frente a Armintza: 19,55 °C con la sonda,
// 20,3 °C de Open-Meteo y la celda IBI del punto enmascarada por la costa).
//   1. capas-mar.js valorCercano: la celda de mar más cercana a ≤ 5 km.
//   2. Textos del toque ("a N km, el modelo no llega a la orilla").
//   3. assets/js/temp-agua-sonda.js: campo con coma, registro y diferencias.
//   4. scripts/aprendizaje/sesgo-temp-agua.mjs: sesgo por zona, privacidad
//      (5 personas; lo del dueño solo, nunca en público) y barreras.
//   5. El punto de calibración sembrado y el diario/admin enganchados.
// Sin red ni DOM: corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { valorCercano, valorEnPunto, MAX_KM_CELDA_CERCANA, pixelesCapa } from "../assets/js/capas-mar.js";
import { textoTemperatura, lineasGlobo } from "../assets/js/capas-combinadas.js";
import {
  leerTempSonda, textoCampo, registroSonda, diferencias, ibiParaSalida, muestraDeSalida, muestraDeCalibracion, sesgoPorZona,
} from "../assets/js/temp-agua-sonda.js";
import { muestrasTempAgua, evaluarSesgo, publicarSesgo, propuestasSesgo } from "../scripts/aprendizaje/sesgo-temp-agua.mjs";
import { validarPropuesta } from "../scripts/aprendizaje/propuestas.mjs";
import { comprobarPublicable } from "../scripts/aprendizaje/privacidad.mjs";
import { ejecutar } from "../scripts/aprendizaje/semanal.mjs";
import { PUNTOS_PANEL } from "../scripts/aprendizaje/deriva.mjs";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

// Malla como la de capas/temperatura-agua.json (1/18°, escala lineal 0,125 °C).
function malla(valores, { norte = 43.5, oeste = -3, paso = 1 / 18 } = {}) {
  const filas = valores.length, columnas = valores[0].length;
  const escala = { tipo: "lineal", min: 0, paso: 0.125 };
  const bytes = new Uint8Array(filas * columnas);
  valores.forEach((fila, f) => fila.forEach((v, c) => { bytes[f * columnas + c] = v === null ? 255 : Math.round(v / 0.125); }));
  return { d: { norte, sur: norte - filas * paso, oeste, este: oeste + columnas * paso, paso, filas, columnas, escala, fecha: "2026-10-10" }, bytes };
}
const centro = (d, f, c) => [d.norte - (f + 0.5) * d.paso, d.oeste + (c + 0.5) * d.paso];

test("celda con dato: su valor, a 0 km", () => {
  const { d, bytes } = malla([[20, 20.5], [null, 19.5]]);
  assert.deepEqual(valorCercano(d, bytes, ...centro(d, 0, 1)), { v: 20.5, km: 0 });
});

test("celda vacía junto a la costa: la de mar más cercana a ≤ 5 km", () => {
  // Fila 1 de tierra salvo una celda; el punto cae en tierra pegado al mar.
  const { d, bytes } = malla([
    [20.75, 20.625, 20.5],
    [null, null, 19.875],
    [null, null, null],
  ]);
  const [la, lo] = centro(d, 1, 1);
  assert.equal(valorEnPunto(d, bytes, la, lo), null, "el punto en sí no tiene dato");
  const r = valorCercano(d, bytes, la, lo);
  // Al este ~4,5 km (1/18° de longitud a 43,4°N) y al norte ~6,2 km: gana el este.
  assert.equal(r.v, 19.875);
  assert.ok(r.km > 4 && r.km < 5, `km ${r.km}`);
});

test("más allá de 5 km, sin dato; fuera de la malla con mar dentro, la del borde", () => {
  const { d, bytes } = malla([[20, null, null, null], [null, null, null, null]]);
  const [la, lo] = centro(d, 1, 3); // a ~14 km de la única celda de mar
  assert.equal(valorCercano(d, bytes, la, lo), null);
  assert.equal(MAX_KM_CELDA_CERCANA, 5);
  // Un radio mayor sí la encuentra (el parámetro manda).
  assert.equal(valorCercano(d, bytes, la, lo, 20).v, 20);
  // Un punto justo al norte de la malla, a < 5 km de la fila 0: la usa.
  const r = valorCercano(d, bytes, d.norte + 0.01, d.oeste + d.paso / 2);
  assert.equal(r.v, 20);
});

test("el pintado del mapa no rellena tierra", () => {
  const { d, bytes } = malla([[20, null], [null, null]]);
  const px = pixelesCapa(d, bytes, ["#000000", "#ffffff"], () => 0.5);
  const opacos = [];
  for (let i = 3; i < px.length; i += 4) opacos.push(px[i]);
  assert.equal(opacos.filter((a) => a > 0).length, 1, "solo la celda con dato");
});

test("textos del toque: 'a N km, el modelo no llega a la orilla'", () => {
  assert.equal(textoTemperatura(19.875, 0), "19,9 °C en superficie");
  assert.equal(textoTemperatura(19.875, 3.4), "19,9 °C a 3 km, el modelo no llega a la orilla");
  assert.equal(textoTemperatura(20.75, 0.3), "20,8 °C a 1 km, el modelo no llega a la orilla", "nunca 'a 0 km'");
  assert.doesNotMatch(textoTemperatura(null), /km|°C/, "más allá de 5 km: sin dato");
  assert.deepEqual(lineasGlobo({ "temperatura-agua": textoTemperatura(19.9, 3) }), ["🌡 19,9 °C a 3 km, el modelo no llega a la orilla"]);
  const html = leer("index.html");
  assert.match(html, /CM\.valorCercano\(d, d\.bytes, lat, lng\)/, "globo de varias capas");
  assert.match(html, /window\.CapasMar\.valorCercano\(d, d\.bytes, lat, lng\)/, "toque con una capa");
});

test("campo de sonda: coma o punto, opcional, entre 0 y 35 °C", () => {
  assert.deepEqual(leerTempSonda(""), { ok: true, valor: null });
  assert.deepEqual(leerTempSonda("  "), { ok: true, valor: null });
  assert.deepEqual(leerTempSonda("19,55"), { ok: true, valor: 19.55 });
  assert.deepEqual(leerTempSonda("19.5"), { ok: true, valor: 19.5 });
  assert.deepEqual(leerTempSonda("19,5 °C"), { ok: true, valor: 19.5 });
  assert.deepEqual(leerTempSonda("8"), { ok: true, valor: 8 });
  for (const malo of ["abc", "19,5,2", "-1", "36", "195", "1e1"]) assert.equal(leerTempSonda(malo).ok, false, malo);
  assert.equal(textoCampo(19.55), "19,55");
  assert.equal(textoCampo(19.55, false), "19.55");
  assert.equal(textoCampo(undefined), "");
});

test("registro de la sonda junto al modelo de esa hora y ese punto", () => {
  assert.equal(registroSonda({ medida: null }), null);
  const { d, bytes } = malla([[20.75, 20.625], [null, null]]);
  // En tierra, justo al sur del borde de la fila 0 (~3,4 km de su centro).
  const la = d.norte - d.paso * 1.05, lo = centro(d, 1, 0)[1];
  assert.equal(ibiParaSalida(d, bytes, la, lo, "2026-10-09"), null, "capa de otro día: nada");
  const ibi = ibiParaSalida(d, bytes, la, lo, "2026-10-10");
  assert.deepEqual(Object.keys(ibi).sort(), ["c", "fecha", "hora_utc", "km"]);
  assert.equal(ibi.c, 20.75);
  const reg = registroSonda({ medida: 19.55, horaSerie: "2026-10-10T18:00", openMeteo: 20.3, fuenteSerie: ["openmeteo"], ibi, boya: { nombre: "Bilbao", c: 19.9 } });
  assert.equal(reg.v, 1);
  assert.equal(reg.medida_c, 19.55);
  assert.equal(reg.open_meteo_c, 20.3);
  assert.deepEqual(diferencias(reg), { open_meteo: -0.75, ibi: -1.2, boya: -0.35 });
  const sinModelo = registroSonda({ medida: 18 });
  assert.deepEqual(diferencias(sinModelo), { open_meteo: null, ibi: null, boya: null });
});

const reg = (medida, om) => ({ v: 1, medida_c: medida, open_meteo_c: om, ibi: null, boya: null });
const salida = (u, fecha, medida, om, lat = 43.44, lon = -2.9) => ({ user_id: u, fecha, lat, lon, indice_factores: { temp_agua_sonda: reg(medida, om) } });

test("muestras: de las salidas y de la calibración; fuera cuentas de prueba", () => {
  const propios = new Set(["mikel"]);
  const m = muestraDeSalida(salida("mikel", "2026-10-10", 19.55, 20.3), { propios, zonaDe: () => "cantabrico" });
  assert.equal(m.usuario, "dueño");
  assert.equal(m.propio, true);
  assert.equal(m.dif.open_meteo, -0.75);
  assert.equal(muestraDeSalida({ user_id: "x", indice_factores: { razones: [] } }), null, "sin sonda");
  assert.equal(muestraDeSalida(salida("prueba", "2026-10-10", 19, 20), { excluir: new Set(["prueba"]) }), null);
  const lista = muestrasTempAgua({ salidas: [salida("a", "2026-10-10", 19, 20), { user_id: "b", indice_factores: null }], calibracion: [{ fecha: "2026-10-10", lat: 43.44, lon: -2.9, medida_c: 19.55, open_meteo_c: 20.3, ibi: { mas_cercana_5km: { c: 20.75, km: 3.6 } } }] });
  assert.equal(lista.length, 2);
  assert.equal(lista[0].zona, "cantabrico");
  assert.deepEqual(lista[1].dif, { open_meteo: -0.75, ibi: -1.2, boya: null });
});

test("el punto de calibración sembrado: dato del dueño, sin nombre y redondeado a 0,01°", () => {
  const lineas = leer("datos-robots/calibracion-temp-agua.jsonl").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(lineas.length >= 1);
  const p = lineas[0];
  assert.equal(p.fecha, "2026-10-10");
  assert.equal(p.hora_utc, "16:26");
  assert.equal(p.medida_c, 19.55);
  assert.equal(p.open_meteo_c, 20.3);
  assert.equal(p.ibi.en_punto, null);
  assert.equal(p.ibi.mas_cercana_5km.c, 20.75);
  for (const l of lineas) {
    assert.equal(Math.round(l.lat * 100) / 100, l.lat);
    assert.equal(Math.round(l.lon * 100) / 100, l.lon);
    assert.doesNotMatch(JSON.stringify(l), /mikel|etxe|@/i, "sin nombre ni email");
  }
  const m = muestraDeCalibracion(p, { zonaDe: () => "cantabrico" });
  assert.equal(m.propio, true);
  assert.equal(m.dif.open_meteo, -0.75);
});

// n medidas de `personas` personas, sesgo ~`media` con algo de ruido.
function muestrasSinteticas({ personas, n, media, zona = "cantabrico", propio = false }) {
  return Array.from({ length: n }, (_, i) => ({
    usuario: propio ? "dueño" : `u${i % personas}`, propio, zona,
    fecha: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
    dif: { open_meteo: Math.round((media + ((i % 5) - 2) * 0.1) * 100) / 100, ibi: null, boya: null },
  }));
}

test("sesgo por zona: media, n y personas", () => {
  const g = sesgoPorZona(muestrasSinteticas({ personas: 3, n: 10, media: -0.5 }));
  assert.equal(g.length, 1);
  assert.equal(g[0].modelo, "open_meteo");
  assert.equal(g[0].n, 10);
  assert.equal(g[0].personas, 3);
  assert.equal(g[0].media, -0.5);
});

test("privacidad: en público solo zonas de 5 personas o más; lo del dueño, nunca", () => {
  const solo = evaluarSesgo(muestrasSinteticas({ personas: 1, n: 40, media: -0.7, propio: true }));
  const pub = publicarSesgo(solo);
  assert.equal(pub[0].oculto, true);
  assert.match(pub[0].motivo, /dueño.*admin/);
  assert.equal(solo[0].supera, false, "una sola persona nunca basta, tampoco el dueño");
  const cuatro = publicarSesgo(evaluarSesgo(muestrasSinteticas({ personas: 4, n: 40, media: -0.7 })));
  assert.equal(cuatro[0].oculto, true);
  const cinco = publicarSesgo(evaluarSesgo(muestrasSinteticas({ personas: 5, n: 40, media: -0.7 })));
  assert.equal(cinco[0].oculto, undefined);
  assert.equal(cinco[0].personas, 5);
  assert.deepEqual(comprobarPublicable(cinco), []);
  assert.ok(!JSON.stringify(cinco).includes("u0"), "sin ids de usuario");
});

test("barreras: muestra, personas, tamaño, errores típicos y lo reciente", () => {
  const ok = evaluarSesgo(muestrasSinteticas({ personas: 6, n: 40, media: -0.7 }));
  assert.equal(ok[0].supera, true, JSON.stringify(ok[0].motivos));
  assert.equal(evaluarSesgo(muestrasSinteticas({ personas: 6, n: 20, media: -0.7 }))[0].supera, false, "pocas medidas");
  assert.equal(evaluarSesgo(muestrasSinteticas({ personas: 6, n: 40, media: -0.1 }))[0].supera, false, "sesgo pequeño");
  // El sesgo desaparece en lo reciente: no se propone.
  const viejas = muestrasSinteticas({ personas: 6, n: 40, media: -0.9 });
  viejas.slice(-12).forEach((m) => { m.dif.open_meteo = 0.3; });
  assert.equal(evaluarSesgo(viejas)[0].supera, false);
  const props = propuestasSesgo(ok, { hoy: "2026-10-12" });
  assert.equal(props.length, 1);
  assert.deepEqual(validarPropuesta(props[0]), []);
  assert.equal(props[0].requiere_si, true);
  assert.equal(props[0].estado, "propuesta");
  assert.equal(props[0].detalle.correccion_c, -0.7);
  assert.equal(props[0].id, "costaviva-sesgo-temp-agua-open-meteo-cantabrico");
  assert.deepEqual(propuestasSesgo(evaluarSesgo(muestrasSinteticas({ personas: 4, n: 40, media: -0.7 })), { hoy: "2026-10-12" }), []);
});

test("aprendizaje semanal: fichero público, métrica y propuesta solo con barreras", () => {
  const DATOS = JSON.parse(leer("assets/datos/especies.json"));
  const CONFIG = JSON.parse(leer("aprendizaje/config.json"));
  assert.ok(CONFIG.sesgo_temp_agua && CONFIG.sesgo_temp_agua.min_personas === 5);
  const base = { datos: DATOS, config: CONFIG, hoy: "2026-10-12", panelOpciones: { puntos: PUNTOS_PANEL.slice(0, 1) } };
  const r1 = ejecutar({ ...base, muestrasSonda: muestrasSinteticas({ personas: 1, n: 3, media: -0.75, propio: true }) });
  const f1 = JSON.parse(r1.ficheros["datos-robots/aprendizaje/sesgo-temp-agua.json"]);
  assert.equal(f1.medidas, 3);
  assert.equal(f1.grupos[0].oculto, true);
  assert.equal(JSON.parse(r1.ficheros["aprendizaje/senales.json"]).metricas.temp_agua_medidas_sonda, 3);
  assert.ok(!r1.propuestas.some((p) => p.detalle?.tipo === "sesgo_temp_agua"));
  assert.match(r1.ficheros["aprendizaje/RESUMEN.md"], /Temperatura del agua: sonda frente al modelo/);
  const r2 = ejecutar({ ...base, muestrasSonda: muestrasSinteticas({ personas: 6, n: 40, media: -0.7 }) });
  assert.ok(r2.propuestas.some((p) => p.detalle?.tipo === "sesgo_temp_agua" && p.requiere_si));
});

test("diario y admin enganchados", () => {
  const diario = leer("diario.html");
  assert.match(diario, /id="salidaTempSonda" inputmode="decimal"/);
  assert.match(diario, /contexto\.indice_factores = \{ \.\.\.\(contexto\.indice_factores \|\| \{\}\), temp_agua_sonda: reg \}/);
  assert.match(diario, /enumerable: false/, "el modelo no viaja como columna");
  assert.match(diario, /TempSonda\.textoCampo\(salida\.indice_factores\?\.temp_agua_sonda\?\.medida_c/, "al editar se rellena");
  const admin = leer("admin.html");
  assert.match(admin, /cargarSondaPropia\(\)/);
  assert.match(admin, /\.eq\("user_id", session\.user\.id\)\.not\("indice_factores"/);
});
