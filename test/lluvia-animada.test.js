// Tests de la lluvia animada (assets/js/lluvia-animada.js y
// functions/_lib/radar-opera.js): tomas de la ventana de 3 h, horas en
// Madrid, retraso, play/pausa, lectura del GeoTIFF de OPERA, proyección y
// composición radar + satélite.
// Lógica pura: sin red, sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duracionISOaMs, parsearDimensionTiempo, framesEnVentana, horaWms, ultimaEstimada,
  horaMadrid, estadoCarga, crearEstado, alternarReproduccion, siguienteIndice,
  ultimoIndiceListo, retardo, avanzar, RETARDO_FRAME_MS, RETARDO_ULTIMO_MS, ATRIBUCION,
  textoRetraso, satelitePara, laea, pixelOpera, REGIONES, altoRegion, indiceRegion, desempaquetar,
  inflar, rellenarRejilla, dbzAMmh, colorLluvia, componer, SIN_DATO, VENTANA_RADAR, sello as selloCliente,
} from "../assets/js/lluvia-animada.js";
import {
  VENTANA, sello, desdeSello, claveToma, prefijosDia, parsearListado, tomasVentana,
  parsearIfds, teselasVentana, empaquetar,
} from "../functions/_lib/radar-opera.js";
import { deflateSync } from "node:zlib";

// Recorte real del GetCapabilities de msg_fes:h60b (EUMETView, 2026-10-08).
const CAPS_INTERVALO = `<Layer queryable="1" opaque="0"><Name>msg_fes:h60b</Name>
<Dimension name="time" default="2026-10-08T09:45:00Z" units="ISO8601" nearestValue="1">2022-12-09T00:45:00.000Z/2026-10-08T09:45:00.000Z/PT15M</Dimension></Layer>`;

test("duraciones ISO 8601", () => {
  assert.equal(duracionISOaMs("PT15M"), 15 * 60000);
  assert.equal(duracionISOaMs("PT10M"), 10 * 60000);
  assert.equal(duracionISOaMs("PT1H"), 3600000);
  assert.equal(duracionISOaMs("PT1H30M"), 90 * 60000);
  assert.equal(duracionISOaMs("P1D"), null);
  assert.equal(duracionISOaMs(""), null);
});

test("lee la dimensión time en forma de intervalo", () => {
  const d = parsearDimensionTiempo(CAPS_INTERVALO);
  assert.equal(horaWms(d.ultima), "2026-10-08T09:45:00Z");
  assert.equal(d.pasoMs, 15 * 60000);
  assert.equal(d.lista, null);
});

test("lee la dimensión time en forma de lista", () => {
  const xml = `<Dimension name="time" default="2026-10-08T10:00:00Z">2026-10-08T09:40:00Z,2026-10-08T09:50:00Z,2026-10-08T10:00:00Z</Dimension>`;
  const d = parsearDimensionTiempo(xml);
  assert.equal(horaWms(d.ultima), "2026-10-08T10:00:00Z");
  assert.equal(d.pasoMs, 10 * 60000);
  assert.equal(d.lista.length, 3);
});

test("sin dimensión time -> null", () => {
  assert.equal(parsearDimensionTiempo("<Layer></Layer>"), null);
  assert.equal(parsearDimensionTiempo(""), null);
});

test("ventana de 3 h cada 15 min: 13 tomas, de la más antigua a la última", () => {
  const f = framesEnVentana(parsearDimensionTiempo(CAPS_INTERVALO));
  assert.equal(f.length, 13);
  assert.equal(f[0], "2026-10-08T06:45:00Z");
  assert.equal(f[12], "2026-10-08T09:45:00Z");
  for (let i = 1; i < f.length; i++) assert.equal(Date.parse(f[i]) - Date.parse(f[i - 1]), 15 * 60000);
});

test("ventana de 3 h con tomas cada 10 min: 19 tomas", () => {
  const f = framesEnVentana({ ultima: Date.parse("2026-10-08T10:00:00Z"), pasoMs: 10 * 60000 });
  assert.equal(f.length, 19);
  assert.equal(f[0], "2026-10-08T07:00:00Z");
});

test("con lista explícita solo entran las tomas que existen dentro de las 3 h", () => {
  const t = (s) => Date.parse(s);
  const lista = [t("2026-10-08T05:00:00Z"), t("2026-10-08T07:00:00Z"), t("2026-10-08T08:30:00Z"), t("2026-10-08T10:00:00Z")];
  const f = framesEnVentana({ ultima: lista[3], pasoMs: 0, lista });
  assert.deepEqual(f, ["2026-10-08T07:00:00Z", "2026-10-08T08:30:00Z", "2026-10-08T10:00:00Z"]);
});

test("sin última hora válida no hay tomas", () => {
  assert.deepEqual(framesEnVentana({ ultima: NaN, pasoMs: 900000 }), []);
});

test("respaldo sin capabilities: hace 45 min, redondeado a 15", () => {
  assert.equal(horaWms(ultimaEstimada(Date.parse("2026-10-08T10:32:15Z"))), "2026-10-08T09:45:00Z");
});

test("horas en Madrid: CEST en verano, CET en invierno", () => {
  assert.equal(horaMadrid("2026-10-08T09:45:00Z"), "11:45");
  assert.equal(horaMadrid("2026-12-01T09:45:00Z"), "10:45");
  assert.equal(horaMadrid("2026-10-08T22:05:00Z"), "00:05");
  // Cambio de hora del 25-10-2026 (03:00 CEST -> 02:00 CET a la 01:00 UTC).
  assert.equal(horaMadrid("2026-10-25T00:45:00Z"), "02:45");
  assert.equal(horaMadrid("2026-10-25T01:15:00Z"), "02:15");
  assert.equal(horaMadrid("no es una fecha"), "--:--");
});

test("estado de carga de una toma", () => {
  assert.equal(estadoCarga({ cargadas: 0, errores: 0, terminado: false }), "pendiente");
  assert.equal(estadoCarga({ cargadas: 3, errores: 1, terminado: true }), "ok");
  assert.equal(estadoCarga({ cargadas: 0, errores: 4, terminado: true }), "fallo");
  assert.equal(estadoCarga({ cargadas: 0, errores: 0, terminado: true }), "ok");
});

test("arranca reproduciendo en la última toma; play/pausa alterna", () => {
  const e = crearEstado(13);
  assert.equal(e.reproduciendo, true);
  assert.equal(e.indice, 12);
  const p = alternarReproduccion(e);
  assert.equal(p.reproduciendo, false);
  assert.equal(alternarReproduccion(p).reproduciendo, true);
  assert.equal(e.reproduciendo, true, "no muta el estado original");
});

test("avanza en bucle saltando las tomas que fallaron o no han cargado", () => {
  const listas = [true, false, true, true, false];
  assert.equal(siguienteIndice(0, listas), 2);
  assert.equal(siguienteIndice(3, listas), 0, "da la vuelta al llegar al final");
  assert.equal(siguienteIndice(4, listas), 0);
  assert.equal(siguienteIndice(2, [false, false, true]), 2, "si solo hay una lista, se queda en ella");
  assert.equal(siguienteIndice(0, [false, false]), -1);
});

test("en pausa no avanza; en marcha sí", () => {
  const listas = [true, true, true];
  let e = { ...crearEstado(3), indice: 0 };
  e = avanzar(e, listas);
  assert.equal(e.indice, 1);
  e = avanzar(alternarReproduccion(e), listas);
  assert.equal(e.indice, 1);
  assert.equal(avanzar({ ...crearEstado(2), indice: 0 }, [false, false]).indice, 0);
});

test("la última toma disponible dura más en pantalla", () => {
  const listas = [true, true, true, false];
  assert.equal(ultimoIndiceListo(listas), 2);
  assert.equal(retardo(2, listas), RETARDO_ULTIMO_MS);
  assert.equal(retardo(0, listas), RETARDO_FRAME_MS);
  assert.ok(RETARDO_ULTIMO_MS > RETARDO_FRAME_MS);
});

test("la atribución cita OPERA, EUMETSAT H SAF y CC BY 4.0", () => {
  assert.match(ATRIBUCION, /EUMETNET OPERA/);
  assert.match(ATRIBUCION, /EUMETSAT H SAF/);
  assert.match(ATRIBUCION, /CC BY 4\.0/);
  assert.doesNotMatch(ATRIBUCION, /\son[a-z]{3,}\s*=/i);
});

// --- Radar OPERA ---------------------------------------------------------------

test("retraso de la última toma en texto", () => {
  const ahora = Date.parse("2026-10-08T10:41:00Z");
  assert.equal(textoRetraso("2026-10-08T10:35:00Z", ahora), "hace 6 min");
  assert.equal(textoRetraso("2026-10-08T10:40:40Z", ahora), "ahora");
  assert.equal(textoRetraso("2026-10-08T09:36:00Z", ahora), "hace 1 h 5 min");
  assert.equal(textoRetraso("2026-10-08T08:41:00Z", ahora), "hace 2 h");
  assert.equal(textoRetraso("basura", ahora), "");
});

test("satélite de respaldo: su cuarto de hora, sin pasar de la última publicada", () => {
  const ult = Date.parse("2026-10-08T09:45:00Z");
  assert.equal(new Date(satelitePara(Date.parse("2026-10-08T09:20:00Z"), ult)).toISOString(), "2026-10-08T09:15:00.000Z");
  assert.equal(new Date(satelitePara(Date.parse("2026-10-08T10:35:00Z"), ult)).toISOString(), "2026-10-08T09:45:00.000Z");
});

test("sellos de toma y nombre del fichero en el bucket", () => {
  const ms = Date.parse("2026-10-08T10:35:00Z");
  assert.equal(sello(ms), "202610081035");
  assert.equal(selloCliente(ms), "202610081035");
  assert.equal(desdeSello("202610081035"), ms);
  assert.ok(Number.isNaN(desdeSello("202610081033")), "solo múltiplos de 5 min");
  assert.ok(Number.isNaN(desdeSello("202602310000")), "fecha imposible");
  assert.ok(Number.isNaN(desdeSello("../../x")));
  assert.equal(claveToma(ms), "2026/10/08/OPERA/COMP/OPERA@20261008T1035@0@DBZH.tiff");
});

test("prefijos de día: uno, o dos si la ventana cruza la medianoche UTC", () => {
  assert.deepEqual(prefijosDia(Date.parse("2026-10-08T10:40:00Z")), ["2026/10/08/OPERA/COMP/"]);
  assert.deepEqual(prefijosDia(Date.parse("2026-10-08T01:10:00Z")), ["2026/10/07/OPERA/COMP/", "2026/10/08/OPERA/COMP/"]);
});

test("listado del bucket: solo DBZH .tiff, ventana de 3 h hasta la última", () => {
  const k = (h) => `<Contents><Key>2026/10/08/OPERA/COMP/OPERA@20261008T${h}@0@DBZH.tiff</Key></Contents>`;
  const xml = "<ListBucketResult>" + ["0630", "0740", "0745", "1035", "1040"].map(k).join("") +
    "<Contents><Key>2026/10/08/OPERA/COMP/OPERA@20261008T1040@0@DBZH.h5</Key></Contents>" +
    "<Contents><Key>2026/10/08/OPERA/COMP/OPERA@20261008T1030@0@RATE.tiff</Key></Contents></ListBucketResult>";
  const horas = parsearListado(xml);
  assert.equal(horas.length, 5);
  const v = tomasVentana(horas).map((t) => sello(t));
  assert.deepEqual(v, ["202610080740", "202610080745", "202610081035", "202610081040"]);
  assert.deepEqual(tomasVentana([]), []);
});

// GeoTIFF sintético con la misma forma que el de OPERA: imagen completa
// (sin teselas útiles) + una vista reducida de factor 4, teselas de 4 px,
// float32, 2 bandas intercaladas, deflate.
function tiffSintetico({ ancho = 32, alto = 24, tw = 4, valor = (x, y) => x + 100 * y } = {}) {
  const w4 = Math.ceil(ancho / 4), h4 = Math.ceil(alto / 4);
  const nx = Math.ceil(w4 / tw), ny = Math.ceil(h4 / tw);
  const teselas = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const f = new Float32Array(tw * tw * 2);
    for (let y = 0; y < tw; y++) for (let x = 0; x < tw; x++) {
      f[(y * tw + x) * 2] = valor(i * tw + x, j * tw + y);
      f[(y * tw + x) * 2 + 1] = 0.5;
    }
    teselas.push(deflateSync(Buffer.from(f.buffer)));
  }
  // Disposición: cabecera | IFD0 | IFD1 | arrays | teselas
  const IFD_TAM = (n) => 2 + n * 12 + 4;
  const tags = (W, H, nT) => [
    [256, 3, 1, W], [257, 3, 1, H], [258, 3, 1, 32], [259, 3, 1, 8], [277, 3, 1, 2], [284, 3, 1, 1],
    [317, 3, 1, 1], [322, 3, 1, tw], [323, 3, 1, tw], [324, 4, nT, null], [325, 4, nT, null], [339, 3, 1, 3],
  ];
  const n0 = 1, n1 = nx * ny;
  const t0 = tags(ancho, alto, n0), t1 = tags(w4, h4, n1);
  const off0 = 8, off1 = off0 + IFD_TAM(t0.length);
  let p = off1 + IFD_TAM(t1.length);
  const reserva = (cnt) => { const o = p; p += cnt * 4; return o; };
  const a0o = reserva(n0), a0t = reserva(n0), a1o = reserva(n1), a1t = reserva(n1);
  const offs1 = teselas.map((b) => { const o = p; p += b.length; return o; });
  const buf = Buffer.alloc(p);
  buf.write("II", 0, "latin1"); buf.writeUInt16LE(42, 2); buf.writeUInt32LE(off0, 4);
  const escribeIfd = (off, ts, ao, at, sig) => {
    buf.writeUInt16LE(ts.length, off);
    ts.forEach(([tag, tipo, cnt, val], k) => {
      const e = off + 2 + 12 * k;
      buf.writeUInt16LE(tag, e); buf.writeUInt16LE(tipo, e + 2); buf.writeUInt32LE(cnt, e + 4);
      // La imagen completa (una tesela) queda vacía: offset y tamaño 0.
      if (tag === 324) buf.writeUInt32LE(cnt === 1 ? 0 : ao, e + 8);
      else if (tag === 325) buf.writeUInt32LE(cnt === 1 ? 0 : at, e + 8);
      else if (tipo === 3) buf.writeUInt16LE(val, e + 8);
      else buf.writeUInt32LE(val, e + 8);
    });
    buf.writeUInt32LE(sig, off + 2 + 12 * ts.length);
  };
  escribeIfd(off0, t0, a0o, a0t, off1);
  escribeIfd(off1, t1, a1o, a1t, 0);
  offs1.forEach((o, k) => { buf.writeUInt32LE(o, a1o + 4 * k); buf.writeUInt32LE(teselas[k].length, a1t + 4 * k); teselas[k].copy(buf, o); });
  return { buf: new Uint8Array(buf), w4, h4, nx, ny };
}

test("lee los IFD y elige las teselas de la ventana en la vista de 1/4", () => {
  const { buf, w4, h4 } = tiffSintetico();
  const ifds = parsearIfds(buf);
  assert.equal(ifds.length, 2);
  assert.equal(ifds[1].ancho, w4);
  assert.equal(ifds[1].alto, h4);
  const info = teselasVentana(ifds, { factor: 4, x0: 1, y0: 3, x1: 6, y1: 6 });
  assert.deepEqual(info.teselas.map((t) => [t.col, t.fila]), [[0, 0], [1, 0], [0, 1], [1, 1]]);
  assert.throws(() => parsearIfds(new Uint8Array([0x4d, 0x4d, 0, 42, 0, 0, 0, 8])), /little-endian/);
  assert.throws(() => parsearIfds(buf.subarray(0, 20)), /incompleta/);
});

test("paquete del servidor -> rejilla de dBZ en el navegador (ida y vuelta)", async () => {
  const { buf } = tiffSintetico();
  const ventana = { factor: 4, x0: 1, y0: 2, x1: 7, y1: 6 };
  const info = teselasVentana(parsearIfds(buf), ventana);
  const trozos = info.teselas.map((t) => buf.subarray(t.off, t.off + t.len));
  const paquete = empaquetar({ ...info, teselas: info.teselas.map(({ col, fila, len }) => ({ col, fila, len })) }, trozos);
  const { meta, trozos: tz } = desempaquetar(paquete);
  const crudas = await Promise.all(tz.map(inflar));
  const rej = rellenarRejilla(meta, crudas, ventana);
  const anchoV = ventana.x1 - ventana.x0;
  // Píxel (x=3, y=4) de la vista -> valor 3 + 100*4.
  assert.equal(rej[(4 - ventana.y0) * anchoV + (3 - ventana.x0)], 403);
  assert.equal(rej[0], 1 + 100 * 2);
  assert.throws(() => desempaquetar(paquete.subarray(0, paquete.length - 1)), /incompleto/);
});

test("proyección de OPERA igual que proj4 (+proj=laea lat0 55 lon0 10)", () => {
  const casos = [
    [43.4, -3.8, 833968.8028903699, -3281575.124237578],
    [36.0, -9.5, 190073.45423173858, -3969831.4436460817],
    [39.4289, -6.2853, 547768.9952237136, -3669961.9046954],
  ];
  for (const [lat, lon, x, y] of casos) {
    const [px, py] = laea(lat, lon);
    assert.ok(Math.abs(px - x) < 0.01 && Math.abs(py - y) < 0.01, `${lat},${lon}`);
  }
  const [cx, cy] = laea(55, 10);
  assert.ok(Math.abs(cx - 1950000) < 1e-6 && Math.abs(cy + 2100000) < 1e-6);
});

test("la región de la Península cabe en la ventana que manda el servidor", () => {
  assert.deepEqual(VENTANA_RADAR, VENTANA);
  const r = REGIONES.find((x) => x.radar);
  for (let i = 0; i <= 20; i++) {
    for (const [lat, lon] of [[r.sur, r.oeste + (i * (r.este - r.oeste)) / 20], [r.norte, r.oeste + (i * (r.este - r.oeste)) / 20],
      [r.sur + (i * (r.norte - r.sur)) / 20, r.oeste], [r.sur + (i * (r.norte - r.sur)) / 20, r.este]]) {
      const [px, py] = pixelOpera(lat, lon, VENTANA.factor);
      assert.ok(px >= VENTANA.x0 && px < VENTANA.x1 && py >= VENTANA.y0 && py < VENTANA.y1, `${lat},${lon}`);
    }
  }
  const idx = indiceRegion(r, VENTANA_RADAR);
  assert.equal(idx.length, r.ancho * altoRegion(r));
  assert.ok(idx.every((v) => v >= 0), "todo píxel de la región tiene celda de radar");
});

test("dBZ a mm/h (Marshall-Palmer) y escala de color", () => {
  assert.ok(Math.abs(dbzAMmh(23) - 1.0) < 0.1);
  assert.ok(Math.abs(dbzAMmh(40) - 11.5) < 0.2);
  assert.equal(colorLluvia(0.05), null);
  assert.equal(colorLluvia(NaN), null);
  assert.deepEqual(colorLluvia(1.5), [65, 182, 196]);
  assert.deepEqual(colorLluvia(80), [197, 27, 138]);
});

test("composición: radar donde hay cobertura, satélite tenue solo donde no", () => {
  // 4 píxeles: lluvia de radar, radar sin eco (NaN), sin cobertura con
  // satélite, y fuera de la ventana con satélite.
  const rejilla = new Float32Array([40, NaN, SIN_DATO]);
  const indice = new Int32Array([0, 1, 2, -1]);
  const sat = new Uint8ClampedArray([9, 9, 9, 200, 9, 9, 9, 200, 1, 2, 3, 200, 4, 5, 6, 100]);
  const { rgba, pxRadar, pxSatelite } = componer({ ancho: 4, alto: 1, indice, rejilla, satelite: sat });
  assert.equal(pxRadar, 2);
  assert.equal(pxSatelite, 2);
  assert.deepEqual([...rgba.slice(0, 3)], colorLluvia(dbzAMmh(40)));
  assert.equal(rgba[7], 0, "radar sin eco: transparente aunque el satélite vea lluvia");
  assert.deepEqual([...rgba.slice(8, 12)], [1, 2, 3, 120]);
  assert.deepEqual([...rgba.slice(12, 16)], [4, 5, 6, 60]);
  // Sin radar (modo satélite / Canarias): todo satélite.
  assert.equal(componer({ ancho: 4, alto: 1, indice: null, rejilla: null, satelite: sat }).pxSatelite, 4);
});
