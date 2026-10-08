// Observaciones abiertas (GBIF/iNaturalist), concursos y "Comparte tu
// captura" (2026-10-08). Lógica pura, sin red ni Supabase: corre en tests.yml.
//
// Lo que se fija aquí:
//   - Licencias: solo CC0/CC BY/CC BY-SA son "comercial"; CC BY-NC(-SA) van
//     aparte como "no_comercial"; sin licencia o -ND, fuera.
//   - El mapeo nombre científico -> especie de especies.json (binomio, género
//     "spp.", familia) no se confunde entre especies del mismo género.
//   - Coordenadas ocultadas: nunca se afinan (se redondean más, no menos).
//   - El difuminado de capturas compartidas (rejilla ~5 km) da el centro de
//     la celda, igual en JS y en la fórmula SQL de la migración.
//   - k-anonimato: un grupo solo sale con >= 5 USUARIOS distintos, y la
//     migración lo exige en todas sus funciones de agregados.
//   - Concursos: sin datos personales y solo de fuentes reutilizables.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizarLicencia, clasificarLicencia, necesitaAtribucion, construirMapaEspecies, especieDeNombre,
  patronesDeEspecie, coordenadaOculta, coordenadasGuardables, celdaDifuminada, distanciaKm, spotCercano,
  filaDesdeGbif, fechaHora, valorEnSerie, valorOpenMeteo, agregarK, franjaHoraria, DATASET_INATURALIST,
} from "../scripts/observaciones/lib.mjs";
import { validarConcurso, validarTodo } from "../scripts/observaciones/concursos.mjs";
import { serializar } from "../scripts/observaciones/descargar.mjs";
import { htmlCasillaCompartir, sincronizarCompartida, cargarCompartidas } from "../assets/js/compartir-captura.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import { regionPorCoordenadas } from "../assets/js/ventana-actividad.js";

const ESPECIES = JSON.parse(readFileSync("assets/datos/especies.json", "utf8"));
const MAPA = construirMapaEspecies(ESPECIES);
const SPOTS = [
  { slug: "lekeitio", lat: 43.3647, lon: -2.5089 },
  { slug: "roses", lat: 42.2620, lon: 3.1760 },
  { slug: "las-americas", lat: 28.0560, lon: -16.7300 },
];
const MIGRACION = readFileSync("supabase/migrations/20261008150000_capturas_compartidas.sql", "utf8");

// ---------------------------------------------------------------------------
// Licencias
// ---------------------------------------------------------------------------

test("licencias: formas reales de GBIF e iNaturalist", () => {
  assert.equal(normalizarLicencia("http://creativecommons.org/publicdomain/zero/1.0/legalcode"), "cc0");
  assert.equal(normalizarLicencia("http://creativecommons.org/licenses/by/4.0/legalcode"), "cc-by");
  assert.equal(normalizarLicencia("http://creativecommons.org/licenses/by-nc/4.0/legalcode"), "cc-by-nc");
  assert.equal(normalizarLicencia("CC_BY_NC_4_0"), "cc-by-nc");
  assert.equal(normalizarLicencia("CC0_1_0"), "cc0");
  assert.equal(normalizarLicencia("cc-by-sa"), "cc-by-sa");
  assert.equal(normalizarLicencia("cc-by-nc-nd"), "cc-by-nc-nd");
  assert.equal(normalizarLicencia(null), null);
  assert.equal(normalizarLicencia("UNSPECIFIED"), null);
});

test("licencias: comercial / no comercial / descartar", () => {
  for (const l of ["cc0", "cc-by", "cc-by-sa", "CC_BY_4_0", "http://creativecommons.org/publicdomain/zero/1.0/legalcode"]) {
    assert.equal(clasificarLicencia(l), "comercial", l);
  }
  for (const l of ["cc-by-nc", "cc-by-nc-sa", "CC_BY_NC_4_0"]) assert.equal(clasificarLicencia(l), "no_comercial", l);
  // Todos los derechos reservados (null en iNaturalist) y las -ND: fuera.
  for (const l of [null, "", "cc-by-nd", "cc-by-nc-nd", "all rights reserved", "UNSPECIFIED"]) {
    assert.equal(clasificarLicencia(l), "descartar", String(l));
  }
  assert.equal(necesitaAtribucion("cc0"), false);
  assert.equal(necesitaAtribucion("cc-by"), true);
  assert.equal(necesitaAtribucion("cc-by-nc"), true);
});

// ---------------------------------------------------------------------------
// Especies
// ---------------------------------------------------------------------------

test("especies: patrones del campo cientifico", () => {
  const p = (c) => patronesDeEspecie({ id: "x", cientifico: c }).map((x) => `${x.tipo}:${x.nombre}`);
  assert.deepEqual(p("Dicentrarchus labrax"), ["especie:Dicentrarchus labrax"]);
  assert.deepEqual(p("Solea spp."), ["genero:Solea"]);
  assert.deepEqual(p("Mugilidae (Chelon labrosus, Mugil spp.)"), ["familia:Mugilidae", "especie:Chelon labrosus", "genero:Mugil"]);
  assert.deepEqual(p(null), []);
});

test("especies: mapeo con los nombres reales de especies.json", () => {
  const e = (n, o) => especieDeNombre(MAPA, n, o);
  assert.equal(e("Dicentrarchus labrax"), "lubina");
  assert.equal(e("Dicentrarchus labrax (Linnaeus, 1758)"), "lubina");
  assert.equal(e("Octopus vulgaris"), "pulpo");
  assert.equal(e("Solea senegalensis"), "lenguado"); // género "Solea spp."
  assert.equal(e("Chelon labrosus"), "lisa");
  assert.equal(e("Chelon auratus", { familiaObs: "Mugilidae" }), "lisa"); // por familia
  // Mismo género, dos especies nuestras: el binomio exacto manda.
  assert.equal(e("Trachurus trachurus", { region: "canarias" }), "jurel");
  assert.equal(e("Trachurus picturatus", { region: "canarias" }), "chicharro_canario");
  // Nada parecido: sin mapear (nunca adivinar).
  assert.equal(e("Dicentrarchus punctatus"), null);
  assert.equal(e("Homo sapiens"), null);
  assert.equal(e(null), null);
});

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

test("coordenadas ocultadas: se detectan y nunca se afinan", () => {
  const r = {
    decimalLatitude: 42.329991, decimalLongitude: 3.193609, coordinateUncertaintyInMeters: 27661,
    informationWithheld: "Coordinate uncertainty increased to 27661m to protect threatened taxon",
  };
  assert.equal(coordenadaOculta(r), true);
  assert.equal(coordenadaOculta({ geoprivacy: "obscured" }), true);
  assert.equal(coordenadaOculta({ taxon_geoprivacy: "obscured" }), true);
  assert.equal(coordenadaOculta({ coordinateUncertaintyInMeters: 30 }), false);
  const c = coordenadasGuardables(r.decimalLatitude, r.decimalLongitude, true);
  assert.equal(c.oculta, true);
  // Múltiplos de 0,2°: más gruesas que la publicada, nunca más finas.
  for (const v of [c.lat, c.lon]) assert.ok(Math.abs(v / 0.2 - Math.round(v / 0.2)) < 1e-6, String(v));
  const libre = coordenadasGuardables(43.36471234, -2.50891234, false);
  assert.deepEqual(libre, { lat: 43.36, lon: -2.51, oculta: false });
});

test("difuminado de capturas compartidas: rejilla de ~5 km, centro de la celda", () => {
  const a = celdaDifuminada(43.3657, -2.5089);
  const b = celdaDifuminada(43.3660, -2.5070); // a unos 150 m
  assert.equal(a.celda, b.celda);
  assert.deepEqual([a.lat, a.lon], [b.lat, b.lon]);
  assert.notEqual(a.lat, 43.3657);
  // El centro está a menos de media diagonal de la celda (~3,6 km).
  assert.ok(distanciaKm(43.3657, -2.5089, a.lat, a.lon) < 3.6);
  // Misma anchura en km al sur (Canarias) que al norte.
  const can = celdaDifuminada(28.05, -16.72);
  assert.ok(distanciaKm(28.05, -16.72, can.lat, can.lon) < 3.6);
  // Valores que da la función SQL public.celda_difuminada() de la migración
  // (comprobados en un Postgres 16 local el 2026-10-08).
  assert.deepEqual(a, { lat: 43.366, lon: -2.5022, celda: "965_-41" });
  assert.deepEqual(can, { lat: 28.0498, lon: -16.7185, celda: "624_-329" });
  assert.equal(celdaDifuminada(null, 1), null);
  // Y la migración usa la misma fórmula.
  assert.match(MIGRACION, /p_km \/ 111\.32/);
  assert.match(MIGRACION, /p_km \/ \(111\.32 \* cos\(radians\(lat_c\)\)\)/);
});

test("spot más cercano: solo a <= 25 km", () => {
  assert.equal(spotCercano(43.37, -2.50, SPOTS).slug, "lekeitio");
  assert.equal(spotCercano(40.4, -3.7, SPOTS), null); // Madrid
  assert.equal(spotCercano(44.5, -4.0, SPOTS), null); // alta mar
});

// ---------------------------------------------------------------------------
// Registro de GBIF -> fila
// ---------------------------------------------------------------------------

function registro(extra = {}) {
  return {
    key: 6179100286, datasetKey: DATASET_INATURALIST, basisOfRecord: "HUMAN_OBSERVATION", occurrenceStatus: "PRESENT",
    species: "Dicentrarchus labrax", family: "Moronidae",
    eventDate: "2026-03-04T16:00Z", decimalLatitude: 28.051815, decimalLongitude: -16.727345,
    coordinateUncertaintyInMeters: 32, license: "http://creativecommons.org/licenses/by/4.0/legalcode",
    rightsHolder: "Observadora Ejemplo", recordedBy: "Observadora Ejemplo",
    occurrenceID: "https://www.inaturalist.org/observations/341304548",
    ...extra,
  };
}
const opc = { mapa: MAPA, spots: SPOTS, regionDe: regionPorCoordenadas };

test("GBIF: CC BY -> comercial con autor; CC0 sin autor; NC aparte", () => {
  const r = filaDesdeGbif(registro(), opc);
  assert.equal(r.uso, "comercial");
  assert.equal(r.fila.e, "lubina");
  assert.equal(r.fila.src, "inat");
  assert.equal(r.fila.spot, "las-americas");
  assert.equal(r.fila.reg, "canarias");
  assert.equal(r.fila.autor, "Observadora Ejemplo");
  assert.equal(r.fila.h, 16);
  const cc0 = filaDesdeGbif(registro({ license: "http://creativecommons.org/publicdomain/zero/1.0/legalcode" }), opc);
  assert.equal(cc0.uso, "comercial");
  assert.equal("autor" in cc0.fila, false);
  const nc = filaDesdeGbif(registro({ license: "http://creativecommons.org/licenses/by-nc/4.0/legalcode" }), opc);
  assert.equal(nc.uso, "no_comercial");
});

test("GBIF: lo que no se guarda", () => {
  assert.equal(filaDesdeGbif(registro({ license: null }), opc), null);
  assert.equal(filaDesdeGbif(registro({ license: "http://creativecommons.org/licenses/by-nd/4.0/legalcode" }), opc), null);
  assert.equal(filaDesdeGbif(registro({ basisOfRecord: "MATERIAL_SAMPLE" }), opc), null); // eDNA / campañas de arrastre
  assert.equal(filaDesdeGbif(registro({ basisOfRecord: "PRESERVED_SPECIMEN" }), opc), null);
  assert.equal(filaDesdeGbif(registro({ occurrenceStatus: "ABSENT" }), opc), null);
  assert.equal(filaDesdeGbif(registro({ decimalLatitude: 40.4, decimalLongitude: -3.7 }), opc), null); // lejos de la costa
  assert.equal(filaDesdeGbif(registro({ species: "Homo sapiens", family: "Hominidae" }), opc), null);
});

test("GBIF: observación ocultada se guarda gruesa y marcada", () => {
  const r = filaDesdeGbif(registro({
    decimalLatitude: 42.329991, decimalLongitude: 3.193609, coordinateUncertaintyInMeters: 27661,
    informationWithheld: "Coordinate uncertainty increased to 27661m to protect threatened taxon",
  }), opc);
  assert.equal(r.fila.oc, true);
  assert.deepEqual([r.fila.lat, r.fila.lon], [42.4, 3.2]);
  assert.equal(r.fila.inc_km, 27.7);
});

test("fecha y hora UTC: con zona sí, sin zona solo el día", () => {
  assert.deepEqual(fechaHora("2026-01-18T10:17", "10:17:00+01:00"), { fecha: "2026-01-18", hora: 9 });
  assert.deepEqual(fechaHora("2026-03-04T16:00Z"), { fecha: "2026-03-04", hora: 16 });
  assert.deepEqual(fechaHora("2019-06-02T23:30", "23:30:00+01:00"), { fecha: "2019-06-02", hora: 22 });
  assert.deepEqual(fechaHora("2026-01-18T10:17"), { fecha: "2026-01-18", hora: null });
  assert.deepEqual(fechaHora("2019-06-02"), { fecha: "2019-06-02", hora: null });
  assert.equal(fechaHora("2019-06-02/2019-06-05"), null);
  assert.equal(fechaHora(null), null);
});

test("condiciones: valor a la hora, media del día solo con el día completo", () => {
  const inicio = "2026-10-01T00:00:00Z";
  const serie = Array.from({ length: 72 }, (_, i) => i);
  assert.equal(valorEnSerie(inicio, serie, "2026-10-02", 5), 29);
  assert.equal(valorEnSerie(inicio, serie, "2026-10-02", null), 35.5);
  assert.equal(valorEnSerie(inicio, serie.slice(0, 30), "2026-10-02", null), null); // día a medias
  assert.equal(valorEnSerie(inicio, serie, "2026-10-09", 5), null); // fuera de la ventana
  const hourly = { time: ["2026-10-02T05:00", "2026-10-02T06:00"], wave_height: [1.2, null] };
  assert.equal(valorOpenMeteo(hourly, "wave_height", "2026-10-02", 5), 1.2);
  assert.equal(valorOpenMeteo(hourly, "wave_height", "2026-10-02", 6), null);
  assert.equal(valorOpenMeteo(hourly, "wave_height", "2026-10-02", null), null);
});

test("ficheros de observaciones: una fila por línea y JSON válido", () => {
  const t = serializar({ v: 1, n: 2 }, [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(JSON.parse(t).filas, [{ id: "a" }, { id: "b" }]);
  assert.equal(t.split("\n").filter((l) => l.startsWith('{"id"')).length, 2);
  assert.deepEqual(JSON.parse(serializar({ v: 1 }, [])).filas, []);
});

// ---------------------------------------------------------------------------
// k-anonimato y migración
// ---------------------------------------------------------------------------

test("k-anonimato: cuenta usuarios distintos, no capturas", () => {
  const filas = [];
  for (let i = 0; i < 8; i++) filas.push({ usuario: "u1", especie: "lubina", celda: "A", mes: 9 });
  for (let u = 1; u <= 4; u++) filas.push({ usuario: `v${u}`, especie: "sargo", celda: "B", mes: 9 });
  for (let u = 1; u <= 5; u++) filas.push({ usuario: `w${u}`, especie: "sargo", celda: "C", mes: 9 });
  const r = agregarK(filas, ["especie", "celda", "mes"]);
  assert.deepEqual(r, [{ especie: "sargo", celda: "C", mes: 9, capturas: 5 }]);
  for (const g of r) assert.equal("usuario" in g, false);
  assert.equal(franjaHoraria(7), "manana");
  assert.equal(franjaHoraria(null), null);
});

test("migración: anónima de verdad, sin lectura directa y con k >= 5", () => {
  const tabla = MIGRACION.match(/create table if not exists public\.capturas_comunidad \(([\s\S]*?)\n\);/)[1];
  for (const col of ["user_id", "captura_id", "salida_id", "notas", "cebo", "senuelo", "lat double", "lon double"]) {
    assert.equal(tabla.includes(col), false, `capturas_comunidad no debe tener ${col}`);
  }
  assert.match(MIGRACION, /alter table public\.capturas_comunidad enable row level security/);
  assert.equal(/create policy[^;]*on public\.capturas_comunidad/.test(MIGRACION), false, "capturas_comunidad sin policies");
  assert.match(MIGRACION, /revoke all on public\.capturas_comunidad from anon, authenticated/);
  // Cada función de agregados exige 5 usuarios distintos.
  const agregados = MIGRACION.match(/create or replace function public\.comunidad_[\s\S]*?\$\$;/g);
  assert.equal(agregados.length, 2);
  for (const f of agregados) assert.match(f, /having count\(distinct x\.user_id\) >= 5/);
  // Nada de anon; marcas solo propias; sin UPDATE.
  assert.equal(/to anon/.test(MIGRACION), false);
  assert.match(MIGRACION, /for insert to authenticated[\s\S]*?auth\.uid\(\) = user_id[\s\S]*?c\.user_id = auth\.uid\(\)/);
  assert.equal(/for update/.test(MIGRACION), false);
  assert.equal(/disable row level security/i.test(MIGRACION), false);
  // comun D9/D10: search_path fijo y EXECUTE revocado.
  for (const f of MIGRACION.match(/security definer\s*\n\s*set search_path = public/g) || []) assert.ok(f);
  assert.equal((MIGRACION.match(/security definer/g) || []).length, (MIGRACION.match(/security definer\s*\n\s*set search_path = public/g) || []).length);
  for (const fn of ["copiar_captura_a_comunidad", "al_compartir_captura", "al_retirar_captura_compartida", "al_editar_captura_compartida"]) {
    assert.match(MIGRACION, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`));
  }
});

// ---------------------------------------------------------------------------
// Diario: casilla "Comparte tu captura"
// ---------------------------------------------------------------------------

test("casilla de compartir: apagada por defecto, sin on*=", () => {
  const h = htmlCasillaCompartir();
  assert.equal(/\bchecked\b/.test(h), false);
  assert.match(htmlCasillaCompartir(true), /\bchecked\b/);
  assert.equal(/\son[a-z]+\s*=/i.test(h), false);
  assert.match(h, /href="\/privacidad#comparte-tu-captura"/);
});

test("compartir/retirar: inserta o borra solo la marca propia", async () => {
  const llamadas = [];
  const cliente = {
    from(t) {
      return {
        insert: async (fila) => { llamadas.push(["insert", t, fila]); return { error: null }; },
        delete: () => ({ eq: async (c, v) => { llamadas.push(["delete", t, c, v]); return { error: null }; } }),
        select: async () => ({ data: null, error: { message: 'relation "capturas_compartidas" does not exist' } }),
      };
    },
  };
  assert.deepEqual(await sincronizarCompartida(cliente, { capturaId: "c1", userId: "u1", compartir: false, yaCompartida: false }), { ok: true });
  assert.equal(llamadas.length, 0);
  await sincronizarCompartida(cliente, { capturaId: "c1", userId: "u1", compartir: true, yaCompartida: false });
  await sincronizarCompartida(cliente, { capturaId: "c1", userId: "u1", compartir: false, yaCompartida: true });
  assert.deepEqual(llamadas, [
    ["insert", "capturas_compartidas", { captura_id: "c1", user_id: "u1" }],
    ["delete", "capturas_compartidas", "captura_id", "c1"],
  ]);
  // Sin la migración aplicada: la casilla no se ofrece.
  const r = await cargarCompartidas(cliente);
  assert.equal(r.disponible, false);
});

test("privacidad: página pública y enlazada desde el diario", () => {
  assert.equal(esRutaPermitida("/privacidad"), true);
  assert.equal(esRutaPermitida("/privacidad.html"), true);
  const pag = readFileSync("privacidad.html", "utf8");
  assert.match(pag, /id="comparte-tu-captura"/);
  assert.match(pag, /al menos 5 personas distintas/);
  assert.match(pag, /5 km/);
  const diario = readFileSync("diario.html", "utf8");
  assert.match(diario, /from "\/assets\/js\/compartir-captura\.js"/);
});

// ---------------------------------------------------------------------------
// Concursos
// ---------------------------------------------------------------------------

const FUENTES_OK = [
  { id: "abierta", reutilizacion: "permitida" },
  { id: "con-permiso", reutilizacion: "permiso", permiso: { fecha: "2027-01-01", de: "Junta directiva", alcance: "resultados de mar" } },
  { id: "cerrada", reutilizacion: "no_permitida_sin_permiso" },
];
const IDS = new Set(ESPECIES.especies.map((e) => e.id));
function concurso(extra = {}) {
  return {
    id: "x-2027-1", fuente: "abierta", url: "https://ejemplo.org/r", fecha: "2027-05-15", modalidad: "costa",
    zona: { lugar: "Playa", lat: 41.15, lon: -8.68 }, capturas: [{ especie: "sargo", piezas: 10, peso_kg: 3.2 }],
    fecha_revision: "2027-05-20", ...extra,
  };
}

test("concursos: válido solo con fuente reutilizable y sin datos personales", () => {
  assert.deepEqual(validarConcurso(concurso(), { fuentes: FUENTES_OK, idsEspecies: IDS }), []);
  assert.deepEqual(validarConcurso(concurso({ fuente: "con-permiso" }), { fuentes: FUENTES_OK, idsEspecies: IDS }), []);
  const cerrada = validarConcurso(concurso({ fuente: "cerrada" }), { fuentes: FUENTES_OK, idsEspecies: IDS });
  assert.ok(cerrada.some((e) => e.includes("no permite reutilizar")));
  const conNombres = validarConcurso(concurso({ ganador: "Fulano", clasificacion: [{ deportista: "Mengano" }] }), { fuentes: FUENTES_OK, idsEspecies: IDS });
  assert.ok(conNombres.filter((e) => e.startsWith("dato personal")).length >= 3);
  const especieInventada = validarConcurso(concurso({ capturas: [{ especie: "pez_raro", piezas: 1 }] }), { fuentes: FUENTES_OK, idsEspecies: IDS });
  assert.ok(especieInventada.some((e) => e.includes("especie desconocida")));
  const precisa = validarConcurso(concurso({ zona: { lat: 41.15123, lon: -8.68 } }), { fuentes: FUENTES_OK, idsEspecies: IDS });
  assert.ok(precisa.some((e) => e.includes("decimales")));
});

test("concursos: los ficheros del repo son válidos", () => {
  const leer = (p) => JSON.parse(readFileSync(p, "utf8"));
  const fuentes = leer("datos-robots/concursos/fuentes.json");
  assert.deepEqual(validarTodo(leer("datos-robots/concursos/concursos.json"), fuentes, ESPECIES), []);
  // FEPyC y FPPD reservan derechos: no pueden figurar como reutilizables sin permiso.
  for (const id of ["fepyc", "fppd"]) {
    const f = fuentes.fuentes.find((x) => x.id === id);
    assert.ok(f.reutilizacion !== "permitida" && (f.reutilizacion !== "permiso" || f.permiso), id);
  }
});
