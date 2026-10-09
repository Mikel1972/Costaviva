// scripts/observaciones/descargar.mjs
// Observaciones ABIERTAS de peces y cefalópodos en las costas de España y
// Portugal, casadas con nuestras especies (assets/datos/especies.json) y con
// las condiciones de mar del spot más cercano, para VALIDAR el índice de
// pesca más adelante. Sin IA. Lo lanza .github/workflows/observaciones.yml
// (semanal). Aprobado por Mikel el 2026-10-08 ("añade todo lo legal").
//
// FUENTE: la API de ocurrencias de GBIF (api.gbif.org/v1/occurrence/search).
// Incluye el conjunto "iNaturalist Research-grade Observations" (datasetKey
// 50c9509d-...), que es la exportación OFICIAL de iNaturalist: por eso las
// observaciones de iNaturalist se toman de GBIF y no de la API de
// iNaturalist, cuya documentación dice "The API is intended to support
// application development, not data scraping. For pre-generated data
// exports, see https://www.inaturalist.org/pages/developers" (cabecera de
// https://api.inaturalist.org/v1/swagger.json, consultada 2026-10-08).
//
// CONDICIONES DE USO comprobadas el 2026-10-08 (detalle y citas en
// datos-robots/observaciones/LEEME.md):
//   - GBIF API (techdocs.gbif.org/en/openapi/): User-Agent con URL o email;
//     un 429 significa "reduce el ritmo o usa la API de descargas"; si el
//     script tarda más de 15 min, mejor una descarga. Aquí: una petición
//     cada ~0,4 s, por especie y año, y se para ante un 429.
//   - Acuerdo de usuario de datos de GBIF: cumplir la licencia de cada
//     publicador y conservar con cada registro el identificador de propiedad
//     (aquí: gbifID + datasetKey, y el autor cuando la licencia es BY).
//   - Licencias: solo CC0 y CC BY para uso comercial; CC BY-NC aparte, solo
//     referencia interna. Ver clasificarLicencia() en lib.mjs.
//   - Coordenadas ocultadas (taxón amenazado, geoprivacidad): nunca se
//     afinan; se guardan aún más gruesas (lib.mjs, coordenadasGuardables).
//
// Uso:
//   node scripts/observaciones/descargar.mjs [--desde 2025] [--hasta 2026]
//        [--salida datos-robots/observaciones] [--sin-condiciones]
//        [--max-open-meteo 150]
// Variables: OBSERVACIONES_CONTACTO (User-Agent; por defecto el de
// METNO_CONTACTO o datos@costaviva.org), OPEN_METEO_API_KEY (sin ella NO se
// cruza con Open-Meteo: el plan gratuito es solo no comercial),
// FUENTES_GRATUITAS_URL (instantáneas de Copernicus, opcional).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  construirMapaEspecies, patronesDeEspecie, filaDesdeGbif, valorEnSerie, valorOpenMeteo,
  DATASET_INATURALIST,
} from "./lib.mjs";
import { regionPorCoordenadas } from "../../assets/js/ventana-actividad.js";
import { SPOTS } from "../../functions/prevision.js";
import { pedirOpenMeteo, claveOpenMeteo, ATRIBUCION_OPEN_METEO } from "../../functions/_lib/open-meteo.js";
import { leerInstantanea } from "../../functions/_lib/instantaneas.js";
import { ATRIBUCION_COPERNICUS, DOIS_COPERNICUS } from "../../functions/_lib/copernicus-mar.js";

const API = "https://api.gbif.org/v1";
const PAUSA_MS = 400;
const LIMITE = 300;
// La web de GBIF avisa de que las búsquedas con offset alto (>= 10.000)
// están limitadas: por encima, se parte por meses.
const MAX_OFFSET = 9000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function args(argv) {
  const a = { desde: null, hasta: null, salida: "datos-robots/observaciones", condiciones: true, maxOM: 150 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--desde") a.desde = Number(argv[++i]);
    else if (k === "--hasta") a.hasta = Number(argv[++i]);
    else if (k === "--salida") a.salida = argv[++i];
    else if (k === "--sin-condiciones") a.condiciones = false;
    else if (k === "--max-open-meteo") a.maxOM = Number(argv[++i]);
  }
  const ahora = new Date().getUTCFullYear();
  a.hasta = a.hasta || ahora;
  a.desde = a.desde || ahora - 1; // semanal: año actual y anterior (GBIF tarda en indexar)
  return a;
}

function userAgent() {
  const c = (process.env.OBSERVACIONES_CONTACTO || process.env.METNO_CONTACTO || "datos@costaviva.org").trim();
  return `Costaviva-observaciones/1.0 (+${c})`;
}

async function pedirJSON(url) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(url, { headers: { "User-Agent": userAgent(), Accept: "application/json" } });
    await espera(PAUSA_MS);
    if (r.status === 429) {
      // GBIF pide bajar el ritmo: no insistir en bucle.
      throw new Error(`GBIF devolvió 429 (rate limit) en ${url}. Bajar el ritmo o usar la API de descargas.`);
    }
    if (r.status >= 500) { await espera(5000 * (intento + 1)); continue; }
    if (!r.ok) throw new Error(`GBIF HTTP ${r.status} en ${url}`);
    return r.json();
  }
  throw new Error(`GBIF no responde (5xx) en ${url}`);
}

// Nombre -> taxonKey de la taxonomía de GBIF, con coincidencia EXACTA
// (strict): si GBIF no lo reconoce tal cual, no se adivina.
async function taxonKey(nombre, rango) {
  const u = `${API}/species/match?strict=true&kingdom=Animalia&rank=${rango}&name=${encodeURIComponent(nombre)}`;
  const j = await pedirJSON(u);
  if (!j || j.matchType !== "EXACT" || !j.usageKey) return null;
  return j.acceptedUsageKey || j.usageKey;
}

function filtrosComunes() {
  return [
    "country=ES", "country=PT",
    "hasCoordinate=true", "hasGeospatialIssue=false", "occurrenceStatus=PRESENT",
    "basisOfRecord=HUMAN_OBSERVATION", "basisOfRecord=OCCURRENCE", "basisOfRecord=MACHINE_OBSERVATION",
    // Solo las licencias que nos sirven para algo; el resto ni se descarga.
    "license=CC0_1_0", "license=CC_BY_4_0", "license=CC_BY_NC_4_0",
  ].join("&");
}

async function* paginas(base) {
  let offset = 0;
  for (;;) {
    const j = await pedirJSON(`${base}&limit=${LIMITE}&offset=${offset}`);
    yield j;
    offset += LIMITE;
    if (j.endOfRecords || offset >= j.count) return;
    if (offset > MAX_OFFSET) throw new Error("offset demasiado alto");
  }
}

async function descargarEspecieAnio(claves, anio) {
  const tax = claves.map((k) => `taxonKey=${k}`).join("&");
  const base = `${API}/occurrence/search?${tax}&${filtrosComunes()}&year=${anio}`;
  const primera = await pedirJSON(`${base}&limit=0`);
  const trozos = primera.count > MAX_OFFSET
    ? Array.from({ length: 12 }, (_, i) => `${base}&month=${i + 1}`)
    : [base];
  const registros = [];
  for (const t of trozos) {
    for await (const p of paginas(t)) registros.push(...(p.results || []));
  }
  return { total: primera.count, registros };
}

// Una fila por línea: el diff semanal en git es solo de las filas nuevas o
// cambiadas, no del fichero entero.
export function serializar(cabecera, filas) {
  const cab = JSON.stringify({ ...cabecera, filas: [] });
  if (!filas.length) return cab + "\n";
  return cab.slice(0, -2) + "\n" + filas.map((f) => JSON.stringify(f)).join(",\n") + "\n]}\n";
}

function leerPrevio(ruta) {
  try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Condiciones del spot en la fecha/hora de la observación
// ---------------------------------------------------------------------------

async function condicionesCopernicus(filas) {
  // Instantánea diaria de IBI (fuentes-gratuitas.yml): cubre ~10 días atrás.
  let inst = null;
  try {
    inst = await leerInstantanea("mar/spots.json", { env: process.env });
  } catch (e) {
    console.log(`Copernicus: sin instantánea utilizable (${e.message}).`);
    return 0;
  }
  if (!inst) return 0;
  let n = 0;
  for (const f of filas) {
    if (f.c) continue;
    const p = (inst.puntos || []).find((x) => x.id === f.spot);
    if (!p) continue;
    const c = {
      ola_m: valorEnSerie(inst.inicio, p.wh, f.f, f.h),
      periodo_s: valorEnSerie(inst.inicio, p.wp, f.f, f.h),
      sst_c: valorEnSerie(inst.inicio, p.sst, f.f, f.h),
      nivel_m: valorEnSerie(inst.inicio, p.sl, f.f, f.h),
    };
    if (Object.values(c).every((v) => v == null)) continue;
    f.c = { ...c, fuente: "copernicus-ibi" };
    n++;
  }
  return n;
}

async function condicionesOpenMeteo(filas, maxLlamadas) {
  const apiKey = claveOpenMeteo(process.env);
  if (!apiKey) {
    console.log("Open-Meteo: sin OPEN_METEO_API_KEY -> no se cruza (el plan gratuito es solo no comercial).");
    return 0;
  }
  const spots = new Map(SPOTS.map((s) => [s.slug, s]));
  // Agrupar por spot y mes: una petición por grupo y API.
  const grupos = new Map();
  for (const f of filas) {
    if (f.c) continue;
    const k = `${f.spot}|${f.f.slice(0, 7)}`;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(f);
  }
  let llamadas = 0;
  let n = 0;
  for (const [k, lista] of grupos) {
    if (llamadas + 2 > maxLlamadas) { console.log(`Open-Meteo: tope de ${maxLlamadas} llamadas; quedan grupos para la próxima semana.`); break; }
    const s = spots.get(k.split("|")[0]);
    if (!s) continue;
    const fechas = lista.map((f) => f.f).sort();
    // Un día antes para la tendencia de presión de 3 h a primera hora.
    const ini = new Date(Date.parse(fechas[0]) - 86400000).toISOString().slice(0, 10);
    const fin = fechas[fechas.length - 1];
    const comun = { latitude: s.lat, longitude: s.lon, start_date: ini, end_date: fin, timezone: "GMT" };
    let atm = null;
    let mar = null;
    try {
      atm = await pedirOpenMeteo("archive", { ...comun, hourly: "pressure_msl,wind_speed_10m,wind_direction_10m,temperature_2m,cloud_cover,precipitation" }, { apiKey });
    } catch (e) { console.log(`Open-Meteo archive ${k}: ${e.message}`); }
    llamadas++;
    try {
      mar = await pedirOpenMeteo("marine", { ...comun, hourly: "wave_height,wave_period,sea_surface_temperature" }, { apiKey });
    } catch (e) { console.log(`Open-Meteo marine ${k}: ${e.message}`); }
    llamadas++;
    await espera(300);
    for (const f of lista) {
      const h = atm?.hourly;
      const pres = valorOpenMeteo(h, "pressure_msl", f.f, f.h);
      let tend = null;
      if (f.h != null && pres != null) {
        const ant = new Date(Date.parse(`${f.f}T${String(f.h).padStart(2, "0")}:00:00Z`) - 3 * 3600000);
        const p3 = valorOpenMeteo(h, "pressure_msl", ant.toISOString().slice(0, 10), ant.getUTCHours());
        if (p3 != null) tend = Math.round((pres - p3) * 10) / 10;
      }
      const c = {
        presion_hpa: pres,
        presion_tend_3h: tend,
        viento_kmh: valorOpenMeteo(h, "wind_speed_10m", f.f, f.h),
        viento_dir: f.h != null ? valorOpenMeteo(h, "wind_direction_10m", f.f, f.h) : null,
        temp_aire_c: valorOpenMeteo(h, "temperature_2m", f.f, f.h),
        nubes_pct: valorOpenMeteo(h, "cloud_cover", f.f, f.h),
        lluvia_mm: valorOpenMeteo(h, "precipitation", f.f, f.h),
        ola_m: valorOpenMeteo(mar?.hourly, "wave_height", f.f, f.h),
        periodo_s: valorOpenMeteo(mar?.hourly, "wave_period", f.f, f.h),
        sst_c: valorOpenMeteo(mar?.hourly, "sea_surface_temperature", f.f, f.h),
      };
      if (Object.values(c).every((v) => v == null)) continue;
      f.c = { ...c, fuente: "open-meteo" };
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------

const AVISO_NC =
  "SOLO REFERENCIA INTERNA, NO COMERCIAL. Registros con licencia CC BY-NC: no se muestran en la app ni se usan " +
  "en nada que se venda. Se guardan aparte para contrastar, con su autor y licencia.";
const AVISO_COM =
  "Registros con licencia CC0 o CC BY (uso comercial permitido). Los CC BY exigen atribución: el autor va en " +
  "`autor` y el conjunto de datos en `ds` (ver ATRIBUCION.md).";

async function main() {
  const a = args(process.argv);
  const especies = JSON.parse(readFileSync("assets/datos/especies.json", "utf8"));
  const mapa = construirMapaEspecies(especies);
  mkdirSync(join(a.salida, "comercial"), { recursive: true });
  mkdirSync(join(a.salida, "no-comercial"), { recursive: true });

  // 1) Especies -> taxonKey de GBIF.
  const taxones = [];
  // Solo las de España y Portugal: las de NZ (fase 2c) no tienen spots aquí
  // y pedirlas a GBIF sería gastar consultas para nada.
  for (const e of especies.especies.filter((x) => (x.pais || "es") === "es")) {
    const claves = [];
    for (const p of patronesDeEspecie(e)) {
      const rango = p.tipo === "especie" ? "SPECIES" : p.tipo === "genero" ? "GENUS" : "FAMILY";
      const k = await taxonKey(p.nombre, rango);
      if (k) claves.push(k);
      else console.log(`GBIF no reconoce "${p.nombre}" (${e.id}) con coincidencia exacta: se omite.`);
    }
    if (claves.length) taxones.push({ id: e.id, claves: [...new Set(claves)] });
  }

  const recuento = {};
  for (let anio = a.desde; anio <= a.hasta; anio++) {
    const filas = { comercial: new Map(), no_comercial: new Map() };
    for (const t of taxones) {
      const { total, registros } = await descargarEspecieAnio(t.claves, anio);
      let guardadas = 0;
      for (const r of registros) {
        const res = filaDesdeGbif(r, { mapa, spots: SPOTS, regionDe: regionPorCoordenadas });
        if (!res) continue;
        filas[res.uso].set(res.fila.id, res.fila);
        guardadas++;
      }
      recuento[t.id] = recuento[t.id] || { gbif_total: 0, guardadas: 0 };
      recuento[t.id].gbif_total += total;
      recuento[t.id].guardadas += guardadas;
      console.log(`${anio} ${t.id}: ${total} en GBIF, ${guardadas} guardadas (a <= 25 km de un spot, licencia válida).`);
    }

    for (const [uso, carpeta, aviso] of [["comercial", "comercial", AVISO_COM], ["no_comercial", "no-comercial", AVISO_NC]]) {
      const ruta = join(a.salida, carpeta, `${anio}.json`);
      const previo = leerPrevio(ruta);
      const lista = [...filas[uso].values()].sort((x, y) => (x.f + x.id).localeCompare(y.f + y.id));
      // Conservar las condiciones ya calculadas en semanas anteriores.
      const previas = new Map((previo?.filas || []).map((f) => [f.id, f.c]));
      for (const f of lista) if (previas.get(f.id)) f.c = previas.get(f.id);
      if (a.condiciones && uso === "comercial") {
        const nc = await condicionesCopernicus(lista);
        const no = await condicionesOpenMeteo(lista, a.maxOM);
        console.log(`${anio}: condiciones nuevas — Copernicus ${nc}, Open-Meteo ${no}.`);
      }
      // Sin cambios en las filas -> no se reescribe (ni cambia generado_en):
      // así el commit semanal solo trae lo nuevo.
      if (previo && JSON.stringify(previo.filas) === JSON.stringify(lista)) continue;
      writeFileSync(ruta, serializar({
        v: 1,
        anio,
        uso,
        aviso,
        generado_en: new Date().toISOString(),
        fuente: "GBIF.org occurrence search API (incluye iNaturalist Research-grade Observations)",
        condiciones_fuentes: {
          "copernicus-ibi": `${ATRIBUCION_COPERNICUS} (${DOIS_COPERNICUS.join(", ")})`,
          "open-meteo": ATRIBUCION_OPEN_METEO,
        },
        n: lista.length,
      }, lista));
    }
  }

  // 2) Atribución de TODOS los conjuntos de datos guardados (todos los años,
  // no solo los de esta pasada), con su título y licencia reales.
  const datasets = new Map();
  for (const carpeta of ["comercial", "no-comercial"]) {
    for (const nombre of readdirSync(join(a.salida, carpeta)).filter((x) => x.endsWith(".json"))) {
      for (const f of leerPrevio(join(a.salida, carpeta, nombre))?.filas || []) {
        if (f.ds) datasets.set(f.ds, (datasets.get(f.ds) || 0) + 1);
      }
    }
  }
  const lineas = [
    "# Atribución de las observaciones abiertas",
    "",
    "Generado por `scripts/observaciones/descargar.mjs`. Cada registro guarda su `gbifID` (`id`), su conjunto de",
    "datos (`ds`), su licencia (`lic`) y, si la licencia lo exige (CC BY), su autor (`autor`).",
    "",
    "Cita general: GBIF.org — búsquedas de ocurrencias por especie, España y Portugal, " + new Date().toISOString().slice(0, 10) + ".",
    "Para una cita formal con DOI hay que pedir una descarga de GBIF (API de descargas, con cuenta).",
    "",
    "| Conjunto de datos | Publicador | Licencia del conjunto (cada registro lleva la suya en `lic`) | Registros guardados |",
    "|---|---|---|---|",
  ];
  for (const [k, n] of [...datasets.entries()].sort((x, y) => y[1] - x[1])) {
    let d = null;
    try { d = await pedirJSON(`${API}/dataset/${k}`); } catch { /* sin título */ }
    let pub = "";
    if (d?.publishingOrganizationKey) {
      try { pub = (await pedirJSON(`${API}/organization/${d.publishingOrganizationKey}`)).title || ""; } catch { /* nada */ }
    }
    const titulo = (d?.title || k).replace(/\|/g, "/");
    const doi = d?.doi ? ` (doi:${d.doi})` : "";
    lineas.push(`| [${titulo}](https://www.gbif.org/dataset/${k})${doi} | ${pub.replace(/\|/g, "/")} | ${d?.license || "?"} | ${n} |`);
  }
  if (datasets.has(DATASET_INATURALIST)) {
    lineas.push("", "Observaciones de iNaturalist: © de cada observador, con la licencia indicada en cada registro; " +
      "enlace a la observación en `url`.");
  }
  writeFileSync(join(a.salida, "ATRIBUCION.md"), lineas.join("\n") + "\n");
  writeFileSync(join(a.salida, "recuento.json"), JSON.stringify({ generado_en: new Date().toISOString(), desde: a.desde, hasta: a.hasta, por_especie: recuento }, null, 1) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
