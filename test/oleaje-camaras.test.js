// Oleaje por cámara (2026-10-08): lógica pura, sin red ni secretos (corre en
// tests.yml). Cubre: bandas, vigencia de las lecturas, cociente y su
// decaimiento, aplicación a /prevision (cámara propia, vecina, sin lectura),
// calibración (ajuste, incertidumbre, etiquetas), la guarda de la orilla y
// la zona dinámica de espuma.mjs, la elevación solar, el inventario de
// cámaras y que la copia de factorCamara() de index.html no se desvía.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  BANDAS_OLA, bandaDeAltura, lecturaVigente, cocienteCamaraModelo, factorCamara, aplicarCamarasASpots,
  CAMARAS_OLEAJE, FUENTE_POR_SPOT, DECAIMIENTO_HORAS, horasEntreLocales, isoLocalMadrid,
} from "../functions/_lib/oleaje-camaras.js";
import {
  ajustarCalibracion, estimarAltura, referenciaLectura, muestrasPorCamara, emparejarEtiquetaSpot, calibrarTodo,
  elevacionSolar, ERROR_MINIMO_POCOS_DATOS, PESO_ETIQUETA_FOTO, ruidoCamara, camaraSustituyeModelo,
} from "../scripts/oleaje-camaras/calibracion.mjs";
import { medirEspuma, zonasDinamicas, medirEspumaDinamica } from "../scripts/oleaje-camaras/espuma.mjs";
import { CAMARAS } from "../scripts/oleaje-camaras/camaras.mjs";
import { combinar } from "../scripts/oleaje-camaras/medir-espuma.mjs";
import { SPOTS, BOYAS, boyaDesdeCopernicus, ATRIBUCION_BOYAS } from "../functions/prevision.js";

const H = 3600e3;
const centro = (id) => BANDAS_OLA.find((b) => b.id === id)?.centro ?? null;

test("bandas de ola: cada altura cae en una sola banda", () => {
  assert.equal(bandaDeAltura(0.2).id, "<0.5");
  assert.equal(bandaDeAltura(0.5).id, "0.5-1");
  assert.equal(bandaDeAltura(1.99).id, "1-2");
  assert.equal(bandaDeAltura(2.5).id, "2-3");
  assert.equal(bandaDeAltura(7).id, ">3");
  assert.equal(bandaDeAltura(NaN), null);
});

test("lecturaVigente: ok, con estimación y de menos de 3 h", () => {
  const ahora = Date.parse("2026-10-08T12:00:00Z");
  const l = (h, extra = {}) => ({ fecha: new Date(ahora - h * H).toISOString(), estado: "ok", estimacion: 1.5, ...extra });
  assert.equal(lecturaVigente(l(0.5), ahora), true);
  assert.equal(lecturaVigente(l(2.9), ahora), true);
  assert.equal(lecturaVigente(l(3.2), ahora), false, "caducada");
  assert.equal(lecturaVigente(l(-1), ahora), false, "del futuro");
  assert.equal(lecturaVigente(l(1, { estado: "orilla" }), ahora), false);
  assert.equal(lecturaVigente(l(1, { estado: "otro_encuadre" }), ahora), false);
  assert.equal(lecturaVigente(l(1, { estimacion: null }), ahora), false);
  assert.equal(lecturaVigente(null, ahora), false);
});

test("cociente cámara/modelo acotado", () => {
  assert.equal(cocienteCamaraModelo(2, 1), 2);
  assert.equal(cocienteCamaraModelo(10, 1), 3);
  assert.equal(cocienteCamaraModelo(0.01, 1), 0.25);
  assert.equal(cocienteCamaraModelo(1, 0), null);
  assert.equal(cocienteCamaraModelo(null, 1), null);
  // Con calibración de pocos datos, más estrecho.
  assert.equal(cocienteCamaraModelo(4, 1, 0.5), 1.6);
  assert.equal(cocienteCamaraModelo(0.1, 1, 0.5), 0.6);
  assert.equal(cocienteCamaraModelo(4, 1, 0.2), 3);
});

test("factorCamara: entero al principio, se apaga en DECAIMIENTO_HORAS", () => {
  assert.equal(factorCamara(0.5, 0), 0.5);
  assert.equal(factorCamara(0.5, DECAIMIENTO_HORAS / 2), 0.75);
  assert.equal(factorCamara(0.5, DECAIMIENTO_HORAS), 1);
  assert.equal(factorCamara(0.5, 40), 1);
  assert.equal(factorCamara(2, 0, 0.5), 1.5, "vecina con peso 0,5");
  assert.equal(factorCamara(NaN, 0), 1);
  assert.ok(DECAIMIENTO_HORAS >= 12 && DECAIMIENTO_HORAS <= 24);
});

test("horas locales de Madrid", () => {
  assert.equal(isoLocalMadrid(Date.parse("2026-10-08T10:30:00Z")), "2026-10-08T12:30");
  assert.equal(isoLocalMadrid(Date.parse("2026-12-08T10:30:00Z")), "2026-12-08T11:30");
  assert.equal(horasEntreLocales("2026-10-08T12:00", "2026-10-09T00:00"), 12);
});

function spotPrueba(slug) {
  return {
    slug,
    bloques: [
      { hora: "12h", horaISO: "2026-10-08T12:00", altura: [2.7, 3.3] },
      { hora: "15h", horaISO: "2026-10-08T15:00", altura: [2.7, 3.3] },
      { hora: "06h", horaISO: "2026-10-09T06:00", altura: [2.7, 3.3] },
    ],
  };
}

test("aplicarCamarasASpots: cámara propia manda en el bloque de la lectura y corrige los siguientes", () => {
  const ahora = Date.parse("2026-10-08T10:40:00Z"); // 12:40 en Madrid
  const lecturas = { zarautz: { fecha: "2026-10-08T10:30:00Z", estado: "ok", estimacion: 1.5, rangoMin: 1, rangoMax: 2.25, modeloCamara: 3 } };
  const [s] = aplicarCamarasASpots([spotPrueba("zarautz")], lecturas, ahora);
  assert.equal(s.oleajeCamara.propia, true);
  assert.equal(s.oleajeCamara.horaLocal, "12:30");
  assert.equal(s.oleajeCamara.cociente, 0.5);
  assert.deepEqual(s.bloques[0].altura, [1, 2.3]);
  assert.equal(s.bloques[0].fuenteAltura, "camara");
  assert.deepEqual(s.bloques[0].alturaModelo, [2.7, 3.3]);
  // 15:00 está a 2,5 h de la lectura: factor 1 + (0,5 - 1)·(1 - 2,5/18).
  const f15 = 1 + (0.5 - 1) * (1 - 2.5 / DECAIMIENTO_HORAS);
  assert.equal(s.bloques[1].fuenteAltura, "modelo_corregido_camara");
  assert.deepEqual(s.bloques[1].altura, [+(3 * f15 * 0.9).toFixed(1), +(3 * f15 * 1.1).toFixed(1)]);
  // Mañana a las 06:00 (17,5 h): casi el modelo.
  assert.ok(s.bloques[2].factorCamara > 0.98);
});

test("aplicarCamarasASpots: sin lectura vigente, todo queda como el modelo", () => {
  const ahora = Date.parse("2026-10-08T15:00:00Z");
  const lecturas = { zarautz: { fecha: "2026-10-08T10:30:00Z", estado: "ok", estimacion: 1.5, modeloCamara: 3 } };
  const entrada = [spotPrueba("zarautz"), spotPrueba("cadiz")];
  const salida = aplicarCamarasASpots(entrada, lecturas, ahora);
  assert.deepEqual(salida, entrada);
});

test("aplicarCamarasASpots: spot sin cámara usa la vecina con su peso y no sustituye", () => {
  const ahora = Date.parse("2026-10-08T10:40:00Z");
  const lecturas = { mutriku: { fecha: "2026-10-08T10:30:00Z", estado: "ok", estimacion: 4, modeloCamara: 2, encuadre: "principal" } };
  const [s] = aplicarCamarasASpots([spotPrueba("ondarroa")], lecturas, ahora);
  assert.equal(s.oleajeCamara.propia, false);
  assert.equal(s.oleajeCamara.camara, "mutriku");
  assert.ok(!s.bloques.some((b) => b.fuenteAltura === "camara"));
  assert.equal(s.bloques[0].fuenteAltura, "modelo_ajustado_vecina");
  const f = 1 + (2 - 1) * (1 - 0.5 / DECAIMIENTO_HORAS) * FUENTE_POR_SPOT.ondarroa.peso;
  assert.deepEqual(s.bloques[0].altura, [+(3 * f * 0.9).toFixed(1), +(3 * f * 1.1).toFixed(1)]);
});

test("inventario: cámaras, referencias, ROIs y fuentes por spot coherentes", () => {
  const slugs = new Set(SPOTS.map((s) => s.slug));
  for (const [id, cam] of Object.entries(CAMARAS)) {
    assert.ok(CAMARAS_OLEAJE[id], `${id} sin metadatos`);
    assert.ok(slugs.has(CAMARAS_OLEAJE[id].spot), `${id}: spot desconocido`);
    assert.ok(cam.encuadres.length >= 1 || cam.dinamico, `${id}: sin encuadres ni zona dinámica`);
    for (const e of cam.encuadres) {
      assert.ok(existsSync(new URL(`../scripts/oleaje-camaras/referencias/${e.ref}.jpg`, import.meta.url)), `falta referencias/${e.ref}.jpg`);
      const r = e.roi;
      assert.ok(r.x0 >= 0 && r.y0 >= 0 && r.x1 <= 1 && r.y1 <= 1 && r.x0 < r.x1 && r.y0 < r.y1, `${id}/${e.id}: ROI fuera del encuadre`);
    }
  }
  for (const [spot, f] of Object.entries(FUENTE_POR_SPOT)) {
    assert.ok(slugs.has(spot), `FUENTE_POR_SPOT: spot ${spot} no existe`);
    assert.ok(CAMARAS[f.camara], `${spot}: cámara ${f.camara} no se mide`);
    if (!f.propia) {
      assert.equal(CAMARAS_OLEAJE[f.camara].expuesta, true, `${spot}: una vecina tiene que ser expuesta`);
      assert.ok(f.peso > 0 && f.peso < 1);
    } else {
      assert.equal(CAMARAS_OLEAJE[f.camara].spot, spot, `${spot}: la cámara propia es de otro spot`);
    }
  }
});

test("calibración con un solo estado de mar: escala exacta, p = 1 e incertidumbre mínima ±50 %", () => {
  const c = ajustarCalibracion([{ espuma: 0.2, altura: 3, peso: 1, dia: "2026-10-08" }]);
  assert.equal(c.p, 1);
  assert.ok(Math.abs(c.a - 15) < 1e-6);
  assert.equal(c.errorRel, ERROR_MINIMO_POCOS_DATOS);
  assert.equal(c.pocosDatos, true);
  const e = estimarAltura(0.1, c);
  assert.equal(e.altura, 1.5);
  assert.equal(e.rangoMin, 1);
  assert.equal(e.rangoMax, 2.25);
});

test("calibración con datos variados: recupera a y p", () => {
  const m = [];
  const dias = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
  for (let i = 0; i < 24; i++) {
    const h = 0.4 + i * 0.15;
    m.push({ espuma: (h / 8) ** (1 / 1.3), altura: h, peso: 1, dia: dias[i % 4] });
  }
  const c = ajustarCalibracion(m);
  assert.ok(Math.abs(c.p - 1.3) < 0.01, `p=${c.p}`);
  assert.ok(Math.abs(c.a - 8) < 0.05, `a=${c.a}`);
  assert.ok(c.errorRel < 0.01);
  assert.equal(c.pocosDatos, false);
  // No extrapola más de ×1,5 por arriba del máximo calibrado.
  assert.ok(estimarAltura(1, c).altura <= c.hMax * 1.5 + 0.01);
});

test("calibración: sin datos o sin espuma, no hay número", () => {
  assert.equal(ajustarCalibracion([]), null);
  assert.equal(ajustarCalibracion([{ espuma: 0, altura: 2 }]), null);
  assert.equal(estimarAltura(0.2, null), null);
  // Sin espuma visible no se da altura (podría ser 0 o romper fuera del ROI).
  const e = estimarAltura(0, { a: 15, p: 1, hMax: 3, errorRel: 0.5 });
  assert.equal(e.sinEspuma, true);
  assert.equal(e.altura, null);
});

test("referencia de una lectura: boya reciente × coeficiente; si no, modelo con menos peso", () => {
  const base = { fecha: "2026-10-08T10:30:00Z", coefPrior: 0.5, marAbierto: { hsCorregida: 3 } };
  const conBoya = referenciaLectura({ ...base, boya: { nombre: "Pasaia II", hs: 3.6, hora: "2026-10-08T08:00:00Z" } });
  assert.deepEqual(conBoya, { altura: 1.8, peso: 1, fuente: "boya Pasaia II" });
  const boyaVieja = referenciaLectura({ ...base, boya: { nombre: "Pasaia II", hs: 3.6, hora: "2026-10-08T06:00:00Z" } });
  assert.deepEqual(boyaVieja, { altura: 1.5, peso: 0.5, fuente: "modelo" });
  assert.equal(referenciaLectura({ fecha: base.fecha }), null);
});

test("etiquetas: pesan más que las lecturas y las del spot se emparejan con la lectura más cercana", () => {
  const historial = [
    { fecha: "2026-10-08T10:00:00Z", camara: "zarautz", encuadre: "principal", estado: "ok", espuma: 0.3, coefPrior: 1, boya: { hs: 3, hora: "2026-10-08T09:00:00Z" } },
    { fecha: "2026-10-08T11:00:00Z", camara: "zarautz", encuadre: "principal", estado: "ok", espuma: 0.2, coefPrior: 1, boya: { hs: 3, hora: "2026-10-08T10:00:00Z" } },
    { fecha: "2026-10-08T11:00:00Z", camara: "zarautz", encuadre: "principal", estado: "orilla", espuma: 0.5 },
  ];
  const e = emparejarEtiquetaSpot({ observado_en: "2026-10-08T11:20:00Z", banda: "1-2" }, historial, "zarautz");
  assert.equal(e.espuma, 0.2);
  assert.equal(emparejarEtiquetaSpot({ observado_en: "2026-10-08T14:00:00Z", banda: "1-2" }, historial, "zarautz"), null);
  const foto = { origen: "foto", banda: "2-3", camara: "zarautz", encuadre: "principal", espuma: 0.25, fecha: "2026-10-08T10:30:00Z" };
  const m = muestrasPorCamara(historial, [foto, e], centro)["zarautz/principal"];
  assert.equal(m.length, 4, "la lectura con la orilla dentro no cuenta");
  assert.equal(m.find((x) => x.etiqueta && x.altura === 2.5).peso, PESO_ETIQUETA_FOTO);
  const cal = calibrarTodo(historial, [foto], centro)["zarautz/principal"];
  assert.equal(cal.nEtiquetas, 1);
});

test("combinar encuadres: manda el mejor calibrado", () => {
  const c = combinar([
    { estado: "ok", estimacion: 2, errorRel: 0.1 },
    { estado: "ok", estimacion: 4, errorRel: 1 },
    { estado: "orilla", estimacion: 9, errorRel: 0.1 },
  ]);
  assert.ok(c.estimacion > 2 && c.estimacion < 2.1, `${c.estimacion}`);
  assert.equal(combinar([{ estado: "ok", estimacion: null }]), null);
});

// Imagen sintética 320x180: filas [0, cielo) cielo azul claro, [cielo, orilla)
// mar azul con rayas de espuma, [orilla, 180) arena.
function imagen({ cielo = 50, orilla = 130, espumaCada = 6 } = {}) {
  const w = 320, h = 180, d = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 3;
    let c;
    if (y < cielo) c = [150, 190, 235];
    else if (y < orilla) c = y % espumaCada === 0 ? [235, 238, 240] : [30, 70, 100];
    else c = [200, 160, 90];
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2];
  }
  return d;
}

test("espuma: cuenta las rayas blancas y la guarda de la orilla salta con arena", () => {
  const img = imagen();
  const mar = medirEspuma(img, 320, 180, { x0: 0, y0: 0.4, x1: 1, y1: 0.65 });
  assert.equal(mar.estado, "ok");
  assert.ok(mar.espuma > 0.1 && mar.espuma < 0.25, `${mar.espuma}`);
  const conOrilla = medirEspuma(img, 320, 180, { x0: 0, y0: 0.6, x1: 1, y1: 0.95 });
  assert.equal(conOrilla.estado, "orilla");
});

test("espuma: zona llena de espuma con textura no es 'dudosa'; blanco uniforme sí", () => {
  const w = 320, h = 180;
  const llena = Buffer.alloc(w * h * 3), uniforme = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = i % 7 === 0 ? 150 : 245;
    llena[i * 3] = llena[i * 3 + 1] = llena[i * 3 + 2] = v;
    uniforme[i * 3] = uniforme[i * 3 + 1] = uniforme[i * 3 + 2] = 240;
  }
  assert.equal(medirEspuma(llena, w, h, { x0: 0, y0: 0, x1: 1, y1: 1 }).estado, "ok");
  assert.equal(medirEspuma(uniforme, w, h, { x0: 0, y0: 0, x1: 1, y1: 1 }).estado, "dudosa");
});

test("zona dinámica: queda entre horizonte y orilla, sin tocar la arena", () => {
  const img = imagen({ cielo: 50, orilla: 130 });
  const zonas = zonasDinamicas(img, 320, 180);
  assert.ok(zonas.length >= 4);
  for (const z of zonas) {
    assert.ok(z.y0 * 180 >= 50, `empieza bajo el horizonte (${z.y0 * 180})`);
    assert.ok(z.y1 * 180 <= 130 - 0.25 * 80, `margen sobre la orilla (${z.y1 * 180})`);
  }
  assert.equal(medirEspumaDinamica(img, 320, 180).estado, "ok");
  // Sin arena abajo (solo mar), no hay orilla de referencia: no se mide.
  assert.equal(medirEspumaDinamica(imagen({ orilla: 180 }), 320, 180).estado, "otro_encuadre");
});

test("elevación solar: mediodía de octubre en Euskadi alto, medianoche bajo el horizonte", () => {
  const mediodia = elevacionSolar(Date.parse("2026-10-08T12:10:00Z"), 43.35, -2.5);
  assert.ok(mediodia > 38 && mediodia < 44, `${mediodia}`);
  assert.ok(elevacionSolar(Date.parse("2026-10-08T00:00:00Z"), 43.35, -2.5) < -30);
  assert.ok(elevacionSolar(Date.parse("2026-10-08T06:00:00Z"), 43.35, -2.5) < 0, "antes del amanecer");
});

test("la copia de factorCamara()/horasEntreLocales() de index.html se comporta igual", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const extraer = (nombre) => {
    const i = html.indexOf(`function ${nombre}(`);
    assert.ok(i >= 0, `falta ${nombre} en index.html`);
    let nivel = 0, j = html.indexOf("{", i);
    for (; j < html.length; j++) {
      if (html[j] === "{") nivel++;
      else if (html[j] === "}" && --nivel === 0) break;
    }
    return html.slice(i, j + 1);
  };
  const copia = new Function(`${extraer("factorCamara")}\n${extraer("horasEntreLocales")}\nreturn { factorCamara, horasEntreLocales };`)();
  for (const c of [0.25, 0.5, 1, 1.7, 3]) for (const h of [-3, 0, 2.5, 9, 17.9, 18, 30]) for (const p of [0.5, 0.8, 1]) {
    assert.equal(copia.factorCamara(c, h, p, DECAIMIENTO_HORAS), factorCamara(c, h, p), `c=${c} h=${h} p=${p}`);
  }
  assert.equal(copia.horasEntreLocales("2026-10-08T12:30", "2026-10-09T03:00"), horasEntreLocales("2026-10-08T12:30", "2026-10-09T03:00"));
});

test("cámara ruidosa sin calibrar (Bakio) no sustituye al modelo; con 5 etiquetas o 3 días variados, sí", () => {
  const l = (min, e) => ({ fecha: new Date(Date.parse("2026-10-08T10:00:00Z") + min * 60e3).toISOString(), camara: "bakio", encuadre: "principal", estado: "ok", espuma: e });
  // Caso real del 2026-10-08: 0,13 -> 0,41 en 30 min con el mismo mar.
  const ruidosa = [l(0, 0.13), l(30, 0.41), l(60, 0.15), l(90, 0.4)];
  const r = ruidoCamara(ruidosa, "bakio");
  assert.equal(r.pares, 3);
  assert.ok(r.ruido > 0.3);
  const sinCal = { nEtiquetas: 0, pocosDatos: true };
  assert.equal(camaraSustituyeModelo(r, [sinCal]).sustituye, false);
  assert.equal(camaraSustituyeModelo(r, [{ nEtiquetas: 5, pocosDatos: true }]).sustituye, true);
  assert.equal(camaraSustituyeModelo(r, [{ nEtiquetas: 0, pocosDatos: false }]).sustituye, true);
  // Estable (±10 %) con 3 pares: sustituye aunque esté sin calibrar.
  const estable = ruidoCamara([l(0, 0.3), l(30, 0.33), l(60, 0.3), l(90, 0.32)], "bakio");
  assert.equal(camaraSustituyeModelo(estable, [sinCal]).sustituye, true);
  // Sin pares suficientes: no se fía.
  assert.equal(camaraSustituyeModelo(ruidoCamara([l(0, 0.3), l(30, 0.31)], "bakio"), [sinCal]).sustituye, false);
  // Y /prevision no la usa: lectura con sustituyeModelo=false no es vigente.
  const ahora = Date.parse("2026-10-08T10:40:00Z");
  const lect = { bakio: { fecha: "2026-10-08T10:30:00Z", estado: "ok", estimacion: 4.7, modeloCamara: 2, sustituyeModelo: false } };
  const entrada = [spotPrueba("bakio"), spotPrueba("plentzia")];
  assert.deepEqual(aplicarCamarasASpots(entrada, lect, ahora), entrada);
});

test("boyas del mapa: todas vía Copernicus In Situ (no Puertos del Estado directo), con atribución", () => {
  const py = readFileSync(new URL("../scripts/oleaje-camaras/boyas-copernicus.py", import.meta.url), "utf8");
  for (const b of BOYAS) {
    assert.ok(b.copernicus, `${b.nombre} sin id de Copernicus`);
    assert.ok(py.includes(`"${b.copernicus}":`), `${b.copernicus} no se descarga en boyas-copernicus.py`);
  }
  const prev = readFileSync(new URL("../functions/prevision.js", import.meta.url), "utf8");
  assert.ok(!/fetch[^\n]*poem\.puertos\.es|`https:\/\/poem\.puertos\.es/.test(prev), "prevision.js no debe llamar a Puertos del Estado");
  const ahora = Date.parse("2026-10-08T12:00:00Z");
  const inst = { "PasaiaII-coast-buoy": { ultima: { hora: "2026-10-08T09:00:00Z", hs: 3.51, dir: 317, tp: 10.4, temp: 18.2 } } };
  const pasaia = BOYAS.find((b) => b.codigo === 1101);
  const r = boyaDesdeCopernicus(pasaia, inst, ahora);
  assert.equal(r.alturaSignificativa, 3.51);
  assert.equal(r.dirOla, "NW 317°");
  assert.equal(r.tempAgua, 18.2);
  assert.equal(r.fuente, ATRIBUCION_BOYAS);
  assert.match(ATRIBUCION_BOYAS, /Copernicus/);
  assert.throws(() => boyaDesdeCopernicus(pasaia, inst, Date.parse("2026-10-08T20:00:00Z")), /últimas 6 h/);
  assert.throws(() => boyaDesdeCopernicus(BOYAS.find((b) => b.codigo === 1117), inst, ahora));
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes("Generated using E.U. Copernicus Marine Service Information"), "atribución visible");
});

// El horario de espuma-camaras.yml (y el de pg_cron, que es el mismo) tiene
// que cubrir toda la luz del año: el primero era 08-15 UTC y se perdía las
// mañanas y tardes de primavera a otoño (2026-10-08).
test("espuma-camaras: el cron cubre toda la luz del año y pg_cron usa el mismo", () => {
  const yml = readFileSync(new URL("../.github/workflows/espuma-camaras.yml", import.meta.url), "utf8");
  const cron = yml.match(/cron:\s*"([^"]+)"/)[1];
  const [min, hora] = cron.split(/\s+/);
  const expandir = (campo) => campo.split(",").flatMap((p) => {
    const [a, b] = p.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
  const ejecuciones = expandir(hora).flatMap((h) => expandir(min).map((m) => h * 60 + m)).sort((x, y) => x - y);
  for (let i = 1; i < ejecuciones.length; i++) assert.ok(ejecuciones[i] - ejecuciones[i - 1] <= 30, "huecos de más de 30 min");
  for (let d = 0; d < 365; d += 3) {
    const dia = Date.UTC(2026, 0, 1) + d * 864e5;
    let primero = null, ultimo = null;
    for (let m = 0; m < 1440; m += 5) {
      if (elevacionSolar(dia + m * 6e4, 43.35, -2.5) >= 8) { primero ??= m; ultimo = m; }
    }
    const fecha = new Date(dia).toISOString().slice(0, 10);
    assert.ok(ejecuciones.some((t) => t >= primero && t <= primero + 30), `${fecha}: sin ejecución en la primera media hora de luz`);
    assert.ok(ejecuciones.some((t) => t <= ultimo && t >= ultimo - 30), `${fecha}: sin ejecución en la última media hora de luz`);
  }
  assert.ok(!/GITHUB_EVENT_NAME === "workflow_dispatch"/.test(yml), "workflow_dispatch (pg_cron) también respeta la luz");
  const sql = readFileSync(new URL("../supabase/migrations/20261008210000_programador_espuma_camaras.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`'lanzar-espuma-camaras', '${cron}'`), "pg_cron con el mismo horario que el schedule");
});
