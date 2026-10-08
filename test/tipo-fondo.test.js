// Tests del tipo de fondo y de orilla (2026-10-08): clasificación de
// EUSeaMap y de OpenStreetMap, fracciones, texto de la ficha, contexto de
// las reglas (nunca en embarcación), reglas nuevas del índice, geometría del
// precálculo y forma de assets/datos/tipo-fondo.json. Lógica pura: sin red,
// sin Supabase, sin secretos. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clasificarSustrato, esRocaConAlgas, clasificarOrilla, orillaPrincipal, fracciones, textoFondo,
  contextoFondo, entradaDeSpot, entradaDePunto, urlPunto, VARIABLES_FONDO, ZOOM_MIN_CAPA, CAPA_SUSTRATO,
  ATRIBUCION_SUSTRATO, LEYENDA_SUSTRATO,
} from "../assets/js/capa-tipo-fondo.js";
import {
  proyector, masCercanoEnLineas, dentroAnillos, anillosGeoJSON, rejillaCirculo,
} from "../scripts/fondo/geometria.mjs";
import { spotsDeIndex, analizarOrilla, analizarFondo } from "../scripts/fondo/tipo-fondo.mjs";
import { calcularVentana } from "../assets/js/ventana-actividad.js";
import { validarRegla, VARIABLES_CONTEXTO } from "../assets/js/reglas-expertas.js";

import * as TFmod from "../assets/js/capa-tipo-fondo.js";
const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const FONDO = JSON.parse(readFileSync(new URL("../assets/datos/tipo-fondo.json", import.meta.url), "utf8"));
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const regla = (id) => DATOS.reglas_expertas.reglas.find((r) => r.id === id);
const NUEVAS = ["orilla_roca_espuma", "orilla_playa_arena", "dorada_arena_con_roca", "fondo_roca_submarina", "posidonia_cerca"];

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------
test("sustrato de EUSeaMap: textos reales a clases llanas", () => {
  assert.equal(clasificarSustrato("Rock or other hard substrata", "MB12"), "roca");
  assert.equal(clasificarSustrato("SAND", "MB55"), "arena");
  assert.equal(clasificarSustrato("Sand"), "arena");
  assert.equal(clasificarSustrato("Muddy sand"), "arena");
  assert.equal(clasificarSustrato("Sandy mud"), "fango");
  assert.equal(clasificarSustrato("Fine mud or Sandy mud or Muddy sand "), "fango");
  assert.equal(clasificarSustrato("Fine mud"), "fango");
  assert.equal(clasificarSustrato("Coarse & mixed sediment"), "grava");
  assert.equal(clasificarSustrato("Mixed sediment"), "grava");
  assert.equal(clasificarSustrato("[Posidonia oceanica] meadows", "MB252"), "posidonia");
  assert.equal(clasificarSustrato("Posidonia oceanica meadows"), "posidonia");
  assert.equal(clasificarSustrato("Dead mattes of Posidonia oceanica"), "biogenico");
  assert.equal(clasificarSustrato("Coralligenous platforms"), "roca");
  assert.equal(clasificarSustrato("Mytilus edulis beds"), "biogenico");
  assert.equal(clasificarSustrato("Seabed"), null);
  assert.equal(clasificarSustrato("Sediment"), null);
  assert.equal(clasificarSustrato(null), null);
  assert.equal(esRocaConAlgas("roca", "Infralittoral"), true);
  assert.equal(esRocaConAlgas("roca", "Shallow circalittoral"), false);
  assert.equal(esRocaConAlgas("arena", "Infralittoral"), false);
});

test("orilla de OpenStreetMap por etiquetas", () => {
  assert.equal(clasificarOrilla({ natural: "cliff" }), "acantilado");
  assert.equal(clasificarOrilla({ natural: "bare_rock" }), "roca");
  assert.equal(clasificarOrilla({ natural: "beach", surface: "sand" }), "playa_arena");
  assert.equal(clasificarOrilla({ natural: "beach", surface: "pebbles" }), "playa_cantos");
  assert.equal(clasificarOrilla({ natural: "beach" }), "playa");
  assert.equal(clasificarOrilla({ natural: "shingle" }), "playa_cantos");
  assert.equal(clasificarOrilla({ man_made: "breakwater" }), "escollera");
  assert.equal(clasificarOrilla({ man_made: "groyne" }), "escollera");
  assert.equal(clasificarOrilla({ man_made: "pier" }), "puerto");
  assert.equal(clasificarOrilla({ leisure: "marina" }), "puerto");
  assert.equal(clasificarOrilla({ landuse: "harbour" }), "puerto");
  assert.equal(clasificarOrilla({ natural: "coastline" }), null);
  assert.equal(clasificarOrilla({ highway: "path" }), null);
});

test("orilla principal: la más cercana a 50 m; a igual distancia, la de más prioridad", () => {
  assert.equal(orillaPrincipal([{ tipo: "playa_arena", d: 0 }, { tipo: "acantilado", d: 30 }]).tipo, "playa_arena");
  assert.equal(orillaPrincipal([{ tipo: "puerto", d: 0 }, { tipo: "escollera", d: 1 }]).tipo, "escollera");
  assert.deepEqual(orillaPrincipal([{ tipo: "roca", d: 10 }, { tipo: "playa", d: 40 }, { tipo: "puerto", d: 80 }]).tipos, ["roca", "playa"]);
  assert.equal(orillaPrincipal([{ tipo: "roca", d: 60 }]), null);
  assert.equal(orillaPrincipal([]), null);
});

test("fracciones: solo las clases presentes, con cobertura y algas", () => {
  const m = [
    ...Array(6).fill({ clase: "roca", algas: true }),
    ...Array(3).fill({ clase: "arena" }),
    { clase: null },
  ];
  assert.deepEqual(fracciones(m, m.length), { roca: 0.67, arena: 0.33, algas: 0.67, cobertura: 0.9 });
  assert.deepEqual(fracciones([], 0), { cobertura: 0 });
});

// ---------------------------------------------------------------------------
// Texto de la ficha y contexto de las reglas
// ---------------------------------------------------------------------------
const ACANTILADO = { orilla: { tipo: "acantilado", tipos: ["acantilado"] }, fondo_500: { roca: 0.55, arena: 0.45, cobertura: 0.9 } };

test("texto de la ficha: palabras llanas, sin números", () => {
  assert.equal(textoFondo(ACANTILADO), "Fondo: roca y arena · orilla de acantilado");
  assert.equal(textoFondo({ orilla: { tipo: "playa_arena" }, fondo_500: { arena: 1, cobertura: 1 } }), "Fondo: arena · playa de arena");
  assert.equal(textoFondo({ orilla: null, fondo_500: { roca: 0.9, algas: 0.9, cobertura: 1 } }), "Fondo: roca con algas");
  assert.equal(textoFondo({ orilla: { tipo: "puerto" }, fondo_500: { cobertura: 0 } }), "Fondo: sin dato cerca · puerto");
  assert.equal(textoFondo({ orilla: null, fondo_500: { arena: 1, cobertura: 0.1 } }), null);
  assert.equal(textoFondo(null), null);
  for (const e of Object.values(FONDO.spots)) {
    const t = textoFondo(e);
    if (t) assert.doesNotMatch(t, /\d|_/, t);
  }
});

test("contexto de las reglas: nunca en embarcación; sin dato, null", () => {
  const c = contextoFondo(ACANTILADO, "costa");
  assert.equal(c.orilla_tipo, "acantilado");
  assert.equal(c.fondo_roca, 0.55);
  assert.equal(c.fondo_arena, 0.45);
  assert.equal(c.posidonia, 0);
  assert.deepEqual(Object.keys(c).sort(), [...VARIABLES_FONDO].sort());
  assert.ok(Object.values(contextoFondo(ACANTILADO, "embarcacion")).every((v) => v === null));
  assert.ok(Object.values(contextoFondo(null, "costa")).every((v) => v === null));
  const pobre = contextoFondo({ orilla: { tipo: "roca" }, fondo_500: { roca: 1, cobertura: 0.1 } }, "submarina");
  assert.equal(pobre.orilla_tipo, "roca");
  assert.equal(pobre.fondo_roca, null);
  for (const v of VARIABLES_FONDO) assert.ok(VARIABLES_CONTEXTO.includes(v), v);
});

test("punto propio: dato del spot fijo a menos de 1,5 km; si no, nada (se pide en vivo)", () => {
  const datos = { spots: { bakio: { ...ACANTILADO, spot: [43.4297, -2.8103] } } };
  assert.equal(entradaDeSpot(datos, { slug: "bakio", lat: 43.4297, lon: -2.8103 }).orilla.tipo, "acantilado");
  assert.equal(entradaDeSpot(datos, { slug: "u1", esUsuario: true, lat: 43.432, lon: -2.815 }).cercano, "bakio");
  assert.equal(entradaDeSpot(datos, { slug: "u2", esUsuario: true, lat: 43.50, lon: -2.815 }), null);
  const u = urlPunto(43.4365, -2.815);
  assert.match(u, /^https:\/\/ows\.emodnet-seabedhabitats\.eu\/geoserver\/emodnet_view\/wms\?/);
  assert.match(u, /request=GetFeatureInfo/);
  assert.match(u, /propertyName=substrate%2Cbiozone%2Ceunis2019c/);
  const e = entradaDePunto({ features: [{ properties: { substrate: "Rock or other hard substrata", biozone: "Infralittoral", eunis2019c: "MB12" } }] });
  assert.equal(e.fondo_500.roca, 1);
  assert.equal(e.fondo_500.algas, 1);
  assert.equal(e.orilla, null);
  assert.equal(entradaDePunto({ features: [] }), null);
  assert.equal(entradaDePunto({ features: [{ properties: { substrate: "Seabed" } }] }), null);
});

test("capa: grupo de todas las escalas, visible desde la plataforma, con atribución CC BY", () => {
  assert.equal(CAPA_SUSTRATO, "eusm_subs_group");
  assert.ok(ZOOM_MIN_CAPA <= 8, "Mikel: hasta donde tengamos (plataforma y talud)");
  assert.match(ATRIBUCION_SUSTRATO, /EMODnet Seabed Habitats/);
  assert.match(ATRIBUCION_SUSTRATO, /CC BY 4\.0/);
  assert.ok(LEYENDA_SUSTRATO.length >= 5);
  assert.match(HTML, /capas: \{ profundidad: B, tipo: TF \}/, "se enciende desde el selector del botón Fondo");
  assert.match(HTML, /id="panelFondo"/);
  // Sin mapa montado, ponerVisible no hace nada y no rompe.
  assert.equal(TFmod.visible(), false);
  assert.doesNotThrow(() => TFmod.ponerVisible(true));
  assert.equal(TFmod.visible(), false);
});

// ---------------------------------------------------------------------------
// Reglas del índice
// ---------------------------------------------------------------------------
test("reglas de fondo: bien formadas, solo costa/submarina, por validar, confianza moderada", () => {
  const ctx = {
    fuentes: DATOS.fuentes, especies: DATOS.especies.map((e) => e.id), regiones: DATOS.regiones,
    grupos: DATOS.reglas_expertas.grupos_especies,
  };
  for (const id of NUEVAS) {
    const r = regla(id);
    assert.ok(r, id);
    assert.deepEqual(validarRegla(r, ctx), [], id);
    assert.ok(r.ambito.modalidades.every((m) => m === "costa" || m === "submarina"), id);
    assert.equal(r.estado, "por_validar");
    assert.ok(r.confianza >= 0.5 && r.confianza <= 0.6, id);
    assert.ok(Math.abs(r.efecto.logodds) <= 0.5, id);
    assert.ok(VARIABLES_FONDO.includes(r.variable), id);
    assert.ok(r.texto.length <= 80, r.texto);
    assert.doesNotMatch(r.texto, /mikel|regla|fiabilidad|confianza|log-odds|puntos|\(|_|\d/i, id);
  }
  for (const f of ["cheminee_2021_nurseries", "marco_mendez_2016_salpa", "emodnet_euseamap_2025", "osm_orilla"]) {
    assert.ok(DATOS.fuentes[f]?.licencia, f);
    assert.doesNotMatch(DATOS.fuentes[f].licencia, /NC/, f);
  }
});

function serie(f = () => ({}), n = 48) {
  const h = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 9, 7) + i * 3600000);
    h.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.6 * Math.sin((2 * Math.PI * i) / 12.42), ola: 1.2, viento: 10, vientoDir: 0, tempAgua: 18,
      presion: 1016, lluvia: 0, ...f(i),
    });
  }
  return h;
}
const BAKIO = { lat: 43.4297, lon: -2.8103 };
const VALENCIA = { lat: 39.47, lon: -0.33 };
const ctx = (extra) => ({ ...BAKIO, reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas, ...extra });
const especie = (id) => DATOS.especies.find((e) => e.id === id);
const aplicadas = (res) => new Set(res.flatMap((r) => r?.reglasAplicadas || []));

test("orilla de roca suma a la lubina desde costa, nunca en embarcación", () => {
  const fondo = contextoFondo(ACANTILADO, "costa");
  const costa = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "costa", fondo }));
  assert.ok(aplicadas(costa).has("orilla_roca_espuma"));
  const sin = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "costa", fondo: null }));
  assert.ok(costa[14].puntuacion > sin[14].puntuacion);
  // Aunque llegue el contexto completo, en embarcación no aplica nada de fondo.
  const barco = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "embarcacion", fondo }));
  const deFondo = [...aplicadas(barco)].filter((id) => NUEVAS.includes(id));
  assert.deepEqual(deFondo, []);
});

test("playa de arena suma al rodaballo desde costa; roca submarina al sargo; posidonia solo en el Mediterráneo", () => {
  const playa = contextoFondo({ orilla: { tipo: "playa_arena" }, fondo_500: { arena: 0.8, roca: 0.2, cobertura: 1 } }, "costa");
  assert.ok(aplicadas(calcularVentana(especie("rodaballo"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "costa", fondo: playa }))).has("orilla_playa_arena"));
  const roca = contextoFondo({ orilla: { tipo: "roca" }, fondo_500: { roca: 0.7, arena: 0.3, cobertura: 1 } }, "submarina");
  assert.ok(aplicadas(calcularVentana(especie("sargo"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "submarina", fondo: roca }))).has("fondo_roca_submarina"));
  const pos = { orilla: { tipo: "playa_arena" }, fondo_500: { posidonia: 0.4, arena: 0.5, roca: 0.1, cobertura: 1 } };
  const med = calcularVentana(especie("sepia"), DATOS.reglas_por_defecto, serie(), { ...ctx({ modalidad: "costa", fondo: contextoFondo(pos, "costa") }), ...VALENCIA });
  assert.ok(aplicadas(med).has("posidonia_cerca"));
  const cant = calcularVentana(especie("sepia"), DATOS.reglas_por_defecto, serie(), ctx({ modalidad: "costa", fondo: contextoFondo(pos, "costa") }));
  assert.ok(!aplicadas(cant).has("posidonia_cerca"));
});

test("cada variable cuenta una sola vez por hora también con el fondo", () => {
  const fondos = [
    ACANTILADO,
    { orilla: { tipo: "playa_arena" }, fondo_500: { arena: 0.6, roca: 0.3, posidonia: 0.2, algas: 0.3, cobertura: 1 } },
    { orilla: { tipo: "escollera" }, fondo_500: { roca: 0.9, algas: 0.9, cobertura: 1 } },
  ];
  for (const lugar of [BAKIO, VALENCIA]) {
    for (const modalidad of ["costa", "embarcacion", "submarina"]) {
      for (const fe of fondos) {
        const fondo = contextoFondo(fe, modalidad);
        for (const e of DATOS.especies) {
          const res = calcularVentana(e, DATOS.reglas_por_defecto, serie(), { ...ctx({ modalidad, fondo }), ...lugar });
          for (const r of res) {
            const vars = r.razones.filter((x) => x.aporte !== 0 && x.variable).map((x) => x.variable);
            assert.equal(new Set(vars).size, vars.length, `${e.id}/${modalidad} ${r.hora}: ${vars.join(", ")}`);
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Geometría y precálculo
// ---------------------------------------------------------------------------
test("geometría: punto en anillos con agujero, punto más cercano, rejilla", () => {
  const fuera = [[0, 0], [10, 0], [10, 10], [0, 10]], agujero = [[4, 4], [6, 4], [6, 6], [4, 6]];
  assert.equal(dentroAnillos([2, 2], [fuera, agujero]), true);
  assert.equal(dentroAnillos([5, 5], [fuera, agujero]), false);
  assert.equal(dentroAnillos([12, 5], [fuera]), false);
  const c = masCercanoEnLineas([5, 3], [[[0, 0], [10, 0]]]);
  assert.equal(c.d, 3);
  assert.deepEqual(c.q, [5, 0]);
  const r = rejillaCirculo([0, 0], 100, 50);
  assert.equal(r.length, 13);
  const p = proyector(43.43, -2.81);
  const [x, y] = p.a([-2.81, 43.439]);
  assert.ok(Math.abs(x) < 1e-6 && Math.abs(y - 1000.8) < 2);
  assert.deepEqual(p.de(p.a([-2.8, 43.44])).map((v) => +v.toFixed(6)), [-2.8, 43.44]);
  assert.equal(anillosGeoJSON({ type: "MultiPolygon", coordinates: [[fuera, agujero], [fuera]] }, (q) => q).length, 3);
});

test("precálculo: spots de index.html, orilla y fondo con datos sintéticos", () => {
  const spots = spotsDeIndex(HTML);
  assert.ok(spots.length >= 100);
  assert.ok(spots.find((s) => s.slug === "bakio" && s.lat === 43.4297));
  assert.ok(spots.find((s) => s.slug === "hondarribia"));
  // Costa recta este-oeste a ~111 m al norte del spot, playa encima y acantilado a 300 m.
  const lat = 43.43, lon = -2.81, dLat = 0.001;
  const costa = { type: "way", tags: { natural: "coastline" }, geometry: [{ lat: lat + dLat, lon: lon - 0.01 }, { lat: lat + dLat, lon: lon + 0.01 }] };
  const playa = { type: "way", tags: { natural: "beach", surface: "sand" }, geometry: [
    { lat: lat + 0.0008, lon: lon - 0.001 }, { lat: lat + 0.0012, lon: lon - 0.001 }, { lat: lat + 0.0012, lon: lon + 0.001 },
    { lat: lat + 0.0008, lon: lon + 0.001 }, { lat: lat + 0.0008, lon: lon - 0.001 }] };
  const acantilado = { type: "way", tags: { natural: "cliff" }, geometry: [{ lat: lat + dLat, lon: lon + 0.004 }, { lat: lat + dLat, lon: lon + 0.006 }] };
  const o = analizarOrilla([costa, playa, acantilado], { lat, lon });
  assert.equal(o.orilla.tipo, "playa_arena");
  assert.deepEqual(o.orilla.tipos, ["playa_arena"]);
  assert.ok(Math.abs(o.dist_costa_m - 111) < 2);
  assert.deepEqual(analizarOrilla([playa], { lat, lon }), { costa: null, dist_costa_m: null, orilla: null });
  // Fondo: mitad este roca, mitad oeste arena; una pradera de Posidonia al oeste.
  const caja = (w, s, e, n) => ({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
  const eusm = [
    { geometry: caja(lon, lat, lon + 0.02, lat + 0.02), properties: { substrate: "Rock or other hard substrata", biozone: "Infralittoral" } },
    { geometry: caja(lon - 0.02, lat, lon, lat + 0.02), properties: { substrate: "Sand", biozone: "Infralittoral" } },
  ];
  const prad = [{ geometry: caja(lon - 0.02, lat, lon - 0.0065, lat + 0.02), properties: { habsubtype: "Posidonia oceanica" } }];
  const f = analizarFondo(eusm, prad, { lat, lon });
  assert.ok(Math.abs(f.fondo_500.roca - 0.5) < 0.05, JSON.stringify(f));
  assert.ok(f.fondo_500.arena > 0.4 && !f.fondo_500.posidonia);
  assert.ok(f.fondo_1000.posidonia > 0.05);
  assert.equal(f.fondo_500.algas, f.fondo_500.roca);
  assert.equal(f.primer_dato_m, 0);
});

test("tipo-fondo.json: todos los spots, ligero, con fuentes, licencias y fecha", () => {
  const spots = spotsDeIndex(HTML);
  const texto = readFileSync(new URL("../assets/datos/tipo-fondo.json", import.meta.url), "utf8");
  assert.ok(texto.length < 60000, `pesa ${texto.length} bytes`);
  assert.match(FONDO.generado, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(FONDO.fuentes.orilla.licencia, /ODbL/);
  assert.match(FONDO.fuentes.orilla.licencia, /OpenStreetMap contributors/);
  assert.match(FONDO.fuentes.fondo.licencia, /CC.BY 4\.0/);
  assert.ok(FONDO.calidad && FONDO.metodo);
  const faltan = spots.filter((s) => !FONDO.spots[s.slug]).map((s) => s.slug);
  assert.deepEqual(faltan, []);
  for (const [slug, e] of Object.entries(FONDO.spots)) {
    assert.ok(Array.isArray(e.spot) && e.spot.length === 2, slug);
    if (e.orilla) assert.ok(["acantilado", "roca", "escollera", "playa_arena", "playa_cantos", "playa", "puerto"].includes(e.orilla.tipo), slug);
    for (const k of ["fondo_500", "fondo_1000"]) {
      const f = e[k];
      assert.ok(f && f.cobertura >= 0 && f.cobertura <= 1, `${slug} ${k}`);
      const suma = ["roca", "arena", "grava", "fango", "posidonia", "pradera", "biogenico"].reduce((s, c) => s + (f[c] || 0), 0);
      if (f.cobertura > 0) assert.ok(Math.abs(suma - 1) < 0.05, `${slug} ${k} suma ${suma}`);
    }
  }
});
