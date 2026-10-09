// Tests de 〰 Frentes y corrientes (2026-10-09): lo que calcula Python
// (scripts/fuentes/descargar-capas.py, fixture generado con él) lo lee igual
// el navegador (assets/js/frentes.js); rasgos de un punto, flechas, textos
// del mapa, y la evaluación en la sombra del aprendizaje semanal
// (scripts/aprendizaje/frentes-sombra.mjs) con sus barreras de muestra y
// privacidad. Lógica pura: sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as F from "../assets/js/frentes.js";
import {
  decodificarHistorico, rasgosCaso, ajustarEfecto, evaluarVariable, evaluarSombra, publicarSombra,
  VARIABLES_SOMBRA, RADIO_KM, CORRIENTE_FUERTE_MS,
} from "../scripts/aprendizaje/frentes-sombra.mjs";
import { comprobarPublicable } from "../scripts/aprendizaje/privacidad.mjs";
import { ejecutar, RUTAS } from "../scripts/aprendizaje/semanal.mjs";
import { validarPropuesta } from "../scripts/aprendizaje/propuestas.mjs";
import { fuenteEs } from "./i18n-html.js";

const X = JSON.parse(readFileSync("test/fixtures/frentes-mini.json", "utf8"));
const D = X.frentes;
const B = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));
const BYTES = B(D.datos);
const CU = B(D.corriente.u), CV = B(D.corriente.v);
const centro = (f, c) => [D.norte - (f + 0.5) * D.paso, D.oeste + (c + 0.5) * D.paso];
const DATOS = JSON.parse(readFileSync("assets/datos/especies.json", "utf8"));
const CONFIG = JSON.parse(readFileSync("aprendizaje/config.json", "utf8"));

// ---------------------------------------------------------------------------
test("frentes: los códigos de Python se leen igual en JS (y el histórico comprimido también)", () => {
  assert.equal(BYTES.length, D.filas * D.columnas);
  assert.deepEqual([...BYTES], X.codigos.flat());
  const h = decodificarHistorico(X.historico);
  assert.deepEqual([...h.bytes], X.codigos.flat());
  assert.equal(h.vel.length, D.filas * D.columnas);
  assert.equal(D.atribucion, "Generated using E.U. Copernicus Marine Service Information");
  assert.deepEqual(D.dois, ["10.48670/moi-00288", "10.48670/moi-00027"]);
  assert.equal(decodificarHistorico({ capa: "otra" }), null);
});

test("frentes: bits y clase de color de cada celda", () => {
  const x = F.decodificar(15); // frente clorofila + térmico + convergencia, nivel baja
  assert.deepEqual(x, { frenteClorofila: true, frenteTermico: true, convergencia: true, nivel: 1, costa: false, nubes: false });
  assert.equal(F.decodificar(255), null);
  assert.equal(F.claseCelda(D, BYTES, 5, 5), "doble"); // clorofila + térmico
  assert.equal(F.claseCelda(D, BYTES, 2, 5), "doble"); // borde de clorofila donde la corriente junta
  assert.equal(F.claseCelda(D, BYTES, 5, 2), "termico");
  assert.equal(F.claseCelda(D, BYTES, 0, 0), "sin_dato"); // nube
  assert.equal(F.claseCelda(D, BYTES, 10, 9), "sin_dato"); // franja costera
  assert.equal(F.claseCelda(D, BYTES, 3, 2), null); // nada que pintar
  assert.equal(F.claseCelda(D, BYTES, 10, 10), null); // tierra
  const px = F.pixelesFrentes(D, BYTES);
  assert.equal(px.length, D.filas * D.columnas * 4);
  assert.equal(px[(3 * D.columnas + 2) * 4 + 3], 0, "lo que no es frente queda transparente");
});

test("frentes: máscaras de Python (costa, nubes, tierra) y que la nube no inventa frente", () => {
  const cod = X.codigos;
  assert.equal(cod[0][0], 64, "nube: sin nivel ni frente de clorofila");
  assert.equal(cod[10][10], 255, "tierra");
  assert.ok(cod[10][9] & 32, "franja costera");
  assert.equal(cod[10][9] & 1, 0, "en la franja costera no hay frente de clorofila");
  assert.ok(X.estadisticas.pct_frente_clorofila > 0 && X.estadisticas.pct_frente_termico > 0 && X.estadisticas.pct_convergencia > 0);
});

test("frentes: rasgos de un punto (distancia, nivel de clorofila, corriente)", () => {
  const r = F.rasgosPunto(D, BYTES, ...centro(5, 5));
  assert.equal(r.frente_ambos, true);
  assert.equal(r.dist_frente_ambos_km, 0);
  assert.equal(r.nivel_clorofila, "baja");
  const lejos = F.rasgosPunto(D, BYTES, ...centro(3, 0), { radioKm: 10 });
  assert.equal(lejos.frente_clorofila, false, "el borde está a más de 10 km");
  const h = decodificarHistorico(X.historico);
  const cerca = F.rasgosPunto(h.d, h.bytes, ...centro(3, 0), { radioKm: 20, vel: h.vel });
  assert.equal(cerca.frente_termico, true);
  assert.ok(cerca.dist_frente_termico_km > 10 && cerca.dist_frente_termico_km <= 20);
  assert.equal(cerca.corriente_ms, 0.3);
  assert.equal(F.rasgosPunto(D, BYTES, 40, -4), null, "fuera de la malla");
  assert.equal(F.rasgosPunto(D, BYTES, ...centro(8, 9)).nivel_clorofila, "moderada");
});

test("frentes: flechas de corriente legibles y texto del toque sin jerga", () => {
  const todas = F.flechasVisibles(D, CU, CV, { norte: D.norte, sur: D.sur, oeste: D.oeste, este: D.este }, 12);
  assert.equal(todas.length, 16);
  assert.ok(F.flechasVisibles(D, CU, CV, { norte: D.norte, sur: D.sur, oeste: D.oeste, este: D.este }, 2).length <= 4);
  assert.equal(F.rumbo(0.3, 0), "E");
  assert.equal(F.rumbo(0, -0.3), "S");
  assert.equal(F.rumbo(-0.2, 0.2), "NO");
  assert.equal(F.textoCorriente(0.01, 0), "Corriente casi nula");
  const t = F.describirPunto(D, BYTES, ...centro(5, 5), F.corrienteEn(D, CU, CV, ...centro(5, 5)));
  assert.match(t, /lo más prometedor/);
  assert.match(t, /Corriente hacia el E: 1,1 km\/h \(0,6 nudos\)/);
  assert.match(F.describirPunto(D, BYTES, ...centro(0, 0)), /nubes/);
  assert.match(F.describirPunto(D, BYTES, ...centro(3, 1)), /^Sin frentes a menos de 10 km/);
  assert.match(F.describirPunto(D, BYTES, ...centro(10, 9)), /costa/);
  assert.match(F.describirPunto(D, BYTES, ...centro(11, 11)), /Tierra/);
  assert.doesNotMatch(t, /log10|gradiente|umbral|convergencia/i);
});

// ---------------------------------------------------------------------------
// Evaluación en la sombra
// ---------------------------------------------------------------------------
function semillaRng(s) { return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// Casos sintéticos de una modalidad y especie con un efecto escondido del
// rasgo `variable` (beta en log-odds; puede ser negativo).
function casosSinteticos({ n = 600, beta = 1.2, usuarios = 12, especie = "lubina", modalidad = "costa", variable = "frente_clorofila", semilla = 7 } = {}) {
  const rnd = semillaRng(semilla);
  const casos = [], rasgos = new Map();
  for (let i = 0; i < n; i++) {
    const x = rnd() < 0.4 ? 1 : 0;
    const p0 = 0.3;
    const p = 1 / (1 + Math.exp(-(Math.log(p0 / (1 - p0)) + beta * x)));
    const y = rnd() < p ? 1 : 0;
    const dia = String(1 + (i % 28)).padStart(2, "0"), mes = String(1 + Math.floor(i / 28) % 9).padStart(2, "0");
    const ref = `caso-${i}`;
    casos.push({ ref, usuario: `u${i % usuarios}`, propio: false, fecha: `2026-${mes}-${dia}`, modalidad, lat: 43.4, lon: -2.9,
      especies: y ? [especie] : [], y, indice: { p: p0, ranking: [{ id: especie, p: 30 }] },
      guardado: { p: p0, especie, terminos: [{ u: "temperatura", lo: 0 }], ranking: [{ id: especie, p: 30 }] } });
    const r = Object.fromEntries(VARIABLES_SOMBRA.map((v) => [v.id, 0]));
    r[variable] = x;
    rasgos.set(ref, r);
  }
  return { casos, rasgos };
}

test("sombra: el ajuste recupera el efecto escondido, positivo o negativo (sin signo supuesto)", () => {
  for (const beta of [1.2, -1.2]) {
    const { casos, rasgos } = casosSinteticos({ beta });
    const filas = casos.map((c) => ({ c, x: rasgos.get(c.ref).frente_clorofila, y: c.y, off: Math.log(0.3 / 0.7) }));
    const a = ajustarEfecto(filas);
    assert.ok(Math.sign(a.beta) === Math.sign(beta) && Math.abs(a.beta - beta) < 0.45, `beta ${a.beta} frente a ${beta}`);
    assert.ok(a.sd > 0 && a.sd < 0.3);
  }
  // Sin efecto: el prior en 0 lo deja cerca de 0.
  const { casos, rasgos } = casosSinteticos({ beta: 0, semilla: 3 });
  const filas = casos.map((c) => ({ c, x: rasgos.get(c.ref).frente_clorofila, y: c.y, off: Math.log(0.3 / 0.7) }));
  assert.ok(Math.abs(ajustarEfecto(filas).beta) < 0.35);
});

test("sombra: barreras de muestra, de 5 personas y de efecto claro", () => {
  const cfg = CONFIG.ajuste;
  const fuerte = casosSinteticos({ beta: 1.5 });
  const filas = (cs, r) => cs.map((c) => ({ c, x: r.get(c.ref).frente_clorofila, y: c.y, off: Math.log(0.3 / 0.7) }));
  const ok = evaluarVariable(filas(fuerte.casos, fuerte.rasgos), cfg, CONFIG.frentes);
  assert.equal(ok.supera, true, ok.motivos.join("; "));
  assert.ok(ok.publico.efecto_logodds > 0.8);
  const pocas = casosSinteticos({ n: 50, beta: 1.5 });
  const r1 = evaluarVariable(filas(pocas.casos, pocas.rasgos), cfg, CONFIG.frentes);
  assert.equal(r1.supera, false);
  assert.ok(r1.motivos.some((m) => /mínimo 80/.test(m)));
  const tres = casosSinteticos({ beta: 1.5, usuarios: 3 });
  const r2 = evaluarVariable(filas(tres.casos, tres.rasgos), cfg, CONFIG.frentes);
  assert.equal(r2.supera, false);
  assert.ok(r2.motivos.some((m) => /5 personas/.test(m)));
  assert.equal(r2.publico.oculto, true, "menos de 5 personas: nada publicable");
  const nada = casosSinteticos({ beta: 0, semilla: 3 });
  const r3 = evaluarVariable(filas(nada.casos, nada.rasgos), cfg, CONFIG.frentes);
  assert.equal(r3.supera, false);
  assert.ok(r3.motivos.some((m) => /efecto no claro/.test(m)));
});

test("sombra: todas las modalidades × especies, solo agregados y propuesta solo si supera", () => {
  const { casos, rasgos } = casosSinteticos({ beta: -1.5, especie: "bonito_norte", modalidad: "embarcacion", variable: "clorofila_alta" });
  const ev = evaluarSombra(casos, rasgos, DATOS, CONFIG.ajuste, CONFIG.frentes);
  assert.ok(ev.combinaciones.every((k) => Object.keys(k.variables).length === VARIABLES_SOMBRA.length));
  assert.ok(ev.combinaciones.some((k) => k.modalidad === "embarcacion" && k.especie === "bonito_norte"));
  assert.deepEqual(ev.superan.map((k) => [k.modalidad, k.especie, k.variable]), [["embarcacion", "bonito_norte", "clorofila_alta"]]);
  assert.ok(ev.superan[0].efecto_logodds < 0, "un bloom puede restar: el signo sale de los datos");
  const pub = publicarSombra(ev);
  assert.deepEqual(comprobarPublicable(pub), []);
  assert.ok(!JSON.stringify(pub).includes("caso-"));
  // Pasada completa: fichero público, sección del resumen y una sola propuesta (con sí).
  const r = ejecutar({ datos: DATOS, textoEspecies: readFileSync("assets/datos/especies.json", "utf8"), casosBase: [], hoy: "2026-10-12", config: CONFIG,
    panelOpciones: { puntos: [] }, rasgosFrentes: new Map(), hipotesisFrentes: JSON.parse(readFileSync("aprendizaje/frentes-hipotesis.json", "utf8")) });
  assert.ok(r.ficheros[RUTAS.frentesSombra]);
  assert.match(r.ficheros[RUTAS.resumen], /## Frentes, clorofila y corrientes \(en la sombra\)/);
  assert.match(r.ficheros[RUTAS.resumen], /acumulando/);
  assert.ok(!r.propuestas.some((p) => p.detalle?.tipo === "frentes"));
});

test("sombra: la propuesta de una combinación que supera es válida, pide sí y cita la hipótesis previa", () => {
  const { casos, rasgos } = casosSinteticos({ beta: 1.5, especie: "bonito_norte", modalidad: "embarcacion", variable: "frente_clorofila" });
  const base = casos.map(({ indice, ...c }) => c); // ejecutar rehace el índice con lo guardado
  const hip = JSON.parse(readFileSync("aprendizaje/frentes-hipotesis.json", "utf8"));
  const r = ejecutar({ datos: DATOS, textoEspecies: readFileSync("assets/datos/especies.json", "utf8"), casosBase: base, hoy: "2026-10-12", config: CONFIG,
    panelOpciones: { puntos: [] }, rasgosFrentes: rasgos, hipotesisFrentes: hip });
  const p = r.propuestas.find((x) => x.detalle?.tipo === "frentes");
  assert.ok(p, "hay propuesta");
  assert.equal(p.id, "costaviva-frentes-frente-clorofila-embarcacion-bonito-norte");
  assert.equal(p.requiere_si, true);
  assert.equal(p.estado, "propuesta");
  assert.deepEqual(validarPropuesta(p), []);
  assert.match(p.explicacion_llana, /Sagarminaga/, "cita la hipótesis previa del grupo");
  assert.match(p.titulo, /ayuda/);
  assert.equal(r.propuestas.filter((x) => x.detalle?.tipo === "frentes").length, 1);
  const fich = JSON.parse(r.ficheros[RUTAS.frentesSombra]);
  assert.deepEqual(comprobarPublicable(fich), []);
  assert.equal(fich.superan.length, 1);
  assert.match(hip.descripcion, /SOLO DOCUMENTADAS/);
});

test("sombra: rasgos de un caso con la capa de su día y radio por modalidad", () => {
  const h = decodificarHistorico(X.historico);
  const [lat, lon] = centro(3, 0);
  const costa = rasgosCaso(h, { lat, lon, modalidad: "costa" });
  const barco = rasgosCaso(h, { lat, lon, modalidad: "embarcacion" });
  assert.equal(RADIO_KM.costa, 10);
  assert.equal(RADIO_KM.embarcacion, 20);
  assert.equal(costa.frente_termico, 0);
  assert.equal(barco.frente_termico, 1, "en barco se llega más lejos");
  assert.equal(barco.clorofila_baja, 1);
  assert.equal(barco.clorofila_alta, 0);
  assert.equal(barco.corriente_fuerte, 0.3 >= CORRIENTE_FUERTE_MS ? 1 : 0);
  assert.equal(rasgosCaso(null, { lat, lon, modalidad: "costa" }), null);
});

// ---------------------------------------------------------------------------
test("frentes: Python usa la máscara de nubes del producto, corrientes sin marea y umbrales documentados", () => {
  const py = readFileSync("scripts/fuentes/descargar-capas.py", "utf8");
  assert.match(py, /\(fl & 2\) == 0/); // flags: máscara 2 = INTERPOLATED
  assert.match(py, /cmems_mod_ibi_phy-cur_anfc_detided-0\.027deg_P1D-m/);
  assert.match(py, /"uo_detided", "vo_detided"/);
  assert.match(py, /"umbral_chl_log10_km": 0\.03/);
  assert.match(py, /"umbral_temp_c_km": 0\.08/);
  assert.match(py, /"dias_clorofila": 5/);
  assert.match(py, /"min_celdas_frente": 3/);
  assert.match(py, /"umbral_convergencia_f": 0\.1/);
  assert.match(py, /"costa_km": 5\.0/);
  assert.match(py, /Belkin y O'Reilly 2009/);
  assert.match(py, /historico/);
});

test("frentes: index.html tiene el botón, la leyenda y los textos corregidos de la clorofila", () => {
  const html = fuenteEs(readFileSync("index.html", "utf8"));
  assert.match(html, /id="toggleFrentes"/);
  assert.match(html, /\.frentes-toggle \{ top: 384px; right: 74px; \}/);
  assert.match(html, /\.frentes-toggle \{ top: 346px; right: 66px; \}/);
  assert.match(html, /import \* as Frentes from "\/assets\/js\/frentes\.js"/);
  assert.match(html, /id="capaMarLeyenda"/);
  assert.match(html, /addEventListener\("click", \(\) => alternarCapaMar\("frentes"\)\)/);
  assert.match(html, /no dónde están los peces/);
  assert.match(html, /el borde entre agua verde y azul/);
  assert.match(html, /las nubes lo tapan/);
  assert.match(html, /map\.off\("moveend", alMoverCapasMar\)/, "al apagar todas se deja de redibujar flechas");
  // Ninguna cifra de umbral para el usuario.
  const def = html.slice(html.indexOf("  frentes: {"), html.indexOf("const COLORES_FRENTES"));
  assert.doesNotMatch(def, /0,03|0,05|0,08|log10|°C\/km/);
  // Clorofila de varios días: la tarjeta dice de qué días es.
  assert.match(def, /d\.fecha_clorofila_desde !== d\.fecha_clorofila/);
  assert.match(def, /lo último sin nubes/);
});
