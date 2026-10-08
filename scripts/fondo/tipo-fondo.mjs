#!/usr/bin/env node
// scripts/fondo/tipo-fondo.mjs
//
// Precalcula assets/datos/tipo-fondo.json: para cada spot de index.html,
//   - el punto de costa más cercano (línea de costa de OpenStreetMap) y el
//     tipo de orilla a 50 m o menos de ese punto (acantilado, roca,
//     escollera, playa de arena / de cantos, puerto), con OSM (ODbL);
//   - la composición del fondo a 500 m y a 1 km de ese punto (roca, arena,
//     grava, fango, Posidonia, pradera marina, y la roca somera con algas),
//     muestreando una rejilla cada 50 m sobre EUSeaMap 2025 (EMODnet Seabed
//     Habitats, CC BY 4.0) y las praderas de fanerógamas de EMODnet (CC BY 4.0);
//   - `primer_dato_m`: a qué distancia del punto de costa empieza el dato
//     del fondo (EUSeaMap tiene celdas de ~100 m y un hueco pegado a la orilla).
// Sin IA, sin dependencias (Node 20+, fetch nativo). Se ejecuta a mano
// cuando cambian los spots; no corre en producción.
//
// Uso:
//   node scripts/fondo/tipo-fondo.mjs                      # todos los spots
//   node scripts/fondo/tipo-fondo.mjs --solo bakio,mundaka # solo esos (fusiona con el JSON existente)
//   node scripts/fondo/tipo-fondo.mjs --punto "Armintza,43.4335,-2.8987"   # imprime, no guarda
// Variables: OVERPASS_URL (por defecto overpass-api.de; vale cualquier
// réplica pública), CACHE_DIR (caché de las respuestas crudas).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  proyector, masCercanoEnLineas, dentroAnillos, anillosGeoJSON, caja, rejillaCirculo,
} from "./geometria.mjs";
import {
  clasificarSustrato, esRocaConAlgas, clasificarOrilla, orillaPrincipal, fracciones, textoFondo, WMS_EMODNET_SEABED,
} from "../../assets/js/capa-tipo-fondo.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SALIDA = join(RAIZ, "assets", "datos", "tipo-fondo.json");
const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const WFS = WMS_EMODNET_SEABED.replace(/\/wms$/, "/wfs");
const CACHE = process.env.CACHE_DIR || join(tmpdir(), "costaviva-tipo-fondo");


const RADIO_BUSQUEDA_COSTA_M = 3000;
const RADIO_ORILLA_M = 50;
const RADIOS_FONDO_M = [500, 1000];
const PASO_M = 50;

// --- Spots de index.html (los fijos: objetos { slug, nombre, lat, lon } y
// tuplas ["slug", "Nombre", lat, lon] dentro de `const SPOTS = ...`).
export function spotsDeIndex(html) {
  const ini = html.indexOf("const SPOTS = [");
  if (ini < 0) throw new Error("no encuentro const SPOTS en index.html");
  const fin = html.indexOf("\nconst ", ini + 10);
  const bloque = html.slice(ini, fin);
  const spots = [];
  for (const m of bloque.matchAll(/\{\s*slug:\s*"([^"]+)",\s*nombre:\s*"([^"]+)",\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)/g)) {
    spots.push({ slug: m[1], nombre: m[2], lat: +m[3], lon: +m[4] });
  }
  for (const m of bloque.matchAll(/\[\s*"([a-z0-9_-]+)",\s*"([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g)) {
    spots.push({ slug: m[1], nombre: m[2], lat: +m[3], lon: +m[4] });
  }
  return spots;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, { intentos = 5, json = true } = {}) {
  const clave = createHash("sha1").update(url).digest("hex");
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, `${clave}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  let ultimo;
  for (let k = 0; k < intentos; k++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Costaviva tipo-fondo (precalculo puntual; contacto en costaviva.pages.dev)" } });
      if (r.ok) {
        const t = await r.text();
        const j = json ? JSON.parse(t) : t;
        writeFileSync(f, t);
        return j;
      }
      ultimo = new Error(`HTTP ${r.status} ${url.slice(0, 120)}`);
    } catch (e) { ultimo = e; }
    await espera(3000 * (k + 1));
  }
  throw ultimo;
}

function cajaGrados(lat, lon, m) {
  const dLat = m / 111320, dLon = m / (111320 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

// --- OpenStreetMap: costa y tipos de orilla alrededor del spot.
const FILTROS_OSM = [
  "way[natural=coastline]",
  ...["beach", "cliff", "bare_rock", "rock", "shingle", "sand", "reef"].map((v) => `nwr[natural=${v}]`),
  ...["breakwater", "groyne", "pier"].map((v) => `nwr[man_made=${v}]`),
  "nwr[harbour=yes]", "nwr[landuse=harbour]", "nwr[landuse=port]", "nwr[leisure=marina]",
];
async function osmAlrededor(lat, lon) {
  const b = cajaGrados(lat, lon, RADIO_BUSQUEDA_COSTA_M);
  const q = `[out:json][timeout:60][bbox:${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)}];(${FILTROS_OSM.join(";")};);out tags geom;`;
  const j = await pedir(`${OVERPASS}?data=${encodeURIComponent(q)}`, { intentos: 10 });
  await espera(1500);
  return j.elements || [];
}

// Líneas (en metros) de un elemento de Overpass con `out geom`.
function lineasElemento(el, proy) {
  const ll = (g) => g.filter(Boolean).map((p) => proy([p.lon, p.lat]));
  if (el.type === "node") return [[proy([el.lon, el.lat])]];
  if (el.type === "way") return el.geometry ? [ll(el.geometry)] : [];
  if (el.type === "relation") return (el.members || []).filter((m) => m.geometry).map((m) => ll(m.geometry));
  return [];
}
function esArea(el) {
  if (el.type === "relation") return true;
  if (el.type !== "way" || !el.geometry || el.geometry.length < 4) return false;
  const a = el.geometry[0], b = el.geometry[el.geometry.length - 1];
  return a.lat === b.lat && a.lon === b.lon && el.tags?.natural !== "cliff";
}

export function analizarOrilla(elementos, spot) {
  const proy = proyector(spot.lat, spot.lon);
  const costa = elementos.filter((e) => e.tags?.natural === "coastline").flatMap((e) => lineasElemento(e, proy.a));
  if (!costa.length) return { costa: null, dist_costa_m: null, orilla: null };
  const c = masCercanoEnLineas([0, 0], costa);
  const P = c.q;
  const candidatos = [];
  for (const el of elementos) {
    const tipo = clasificarOrilla(el.tags);
    if (!tipo) continue;
    const lineas = lineasElemento(el, proy.a);
    const d = esArea(el) && dentroAnillos(P, lineas) ? 0 : masCercanoEnLineas(P, lineas).d;
    candidatos.push({ tipo, d });
  }
  const [lon, lat] = proy.de(P);
  return { costa: [+lat.toFixed(5), +lon.toFixed(5)], dist_costa_m: Math.round(c.d), orilla: orillaPrincipal(candidatos, RADIO_ORILLA_M) };
}

// --- EMODnet: polígonos de EUSeaMap (EUNIS 2019) y praderas alrededor del punto de costa.
async function wfs(capa, lat, lon, m) {
  const b = cajaGrados(lat, lon, m);
  const u = `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=emodnet_view:${capa}`
    + `&outputFormat=application/json&srsName=CRS:84&bbox=${b.w.toFixed(5)},${b.s.toFixed(5)},${b.e.toFixed(5)},${b.n.toFixed(5)},CRS:84`;
  const j = await pedir(u);
  return j.features || [];
}

export function analizarFondo(eusm, praderas, centro) {
  const proy = proyector(centro.lat, centro.lon);
  const prep = (feats, f) => feats.map((x) => {
    const anillos = anillosGeoJSON(x.geometry, proy.a);
    return { anillos, caja: caja(anillos), ...f(x.properties || {}) };
  });
  const polis = prep(eusm, (p) => {
    const clase = clasificarSustrato(p.substrate, p.eunis2019c);
    return { clase, algas: esRocaConAlgas(clase, p.biozone) };
  });
  const prads = prep(praderas, (p) => ({ clase: /posidonia/i.test(`${p.habsubtype} ${p.hab_origin}`) ? "posidonia" : "pradera" }));
  const dentroDe = (p, lista) => lista.find((x) => p[0] >= x.caja[0] && p[0] <= x.caja[2] && p[1] >= x.caja[1] && p[1] <= x.caja[3] && dentroAnillos(p, x.anillos));
  const muestras = [];
  for (const { p, d } of rejillaCirculo([0, 0], Math.max(...RADIOS_FONDO_M), PASO_M)) {
    const e = dentroDe(p, polis);
    if (!e) continue; // tierra o fuera de EUSeaMap
    const pr = dentroDe(p, prads);
    muestras.push({ d, clase: pr ? pr.clase : e.clase, algas: !pr && e.algas });
  }
  const out = {};
  for (const r of RADIOS_FONDO_M) {
    const m = muestras.filter((x) => x.d <= r);
    out[`fondo_${r}`] = fracciones(m, m.length);
  }
  const conClase = muestras.filter((x) => x.clase).map((x) => x.d);
  out.primer_dato_m = conClase.length ? Math.round(Math.min(...conClase)) : null;
  return out;
}

async function calcularSpot(s) {
  const elementos = await osmAlrededor(s.lat, s.lon);
  const o = analizarOrilla(elementos, s);
  const centro = o.costa ? { lat: o.costa[0], lon: o.costa[1] } : s;
  const m = Math.max(...RADIOS_FONDO_M) + 150;
  const [eusm, prad] = [await wfs("eusm2025_eunis2019_full", centro.lat, centro.lon, m), await wfs("seagrass_eov_poly_2025", centro.lat, centro.lon, m)];
  const f = analizarFondo(eusm, prad, centro);
  return { spot: [s.lat, s.lon], costa: o.costa, dist_costa_m: o.dist_costa_m, orilla: o.orilla, ...f };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  if (opt("--punto")) {
    const [nombre, lat, lon] = opt("--punto").split(",");
    const e = await calcularSpot({ slug: nombre, nombre, lat: +lat, lon: +lon });
    console.log(JSON.stringify({ [nombre]: e }, null, 1));
    console.log(textoFondo(e));
    return;
  }
  const spots = spotsDeIndex(readFileSync(join(RAIZ, "index.html"), "utf8"));
  const solo = opt("--solo")?.split(",");
  const previo = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : null;
  const res = solo && previo ? { ...previo.spots } : {};
  const errores = [];
  // Unas pocas peticiones a la vez (CONCURRENCIA, por defecto 3): las
  // réplicas de Overpass tardan; más que eso sería abusar de un servicio gratuito.
  const cola = spots.filter((x) => !solo || solo.includes(x.slug));
  const trabajador = async () => {
    for (let s = cola.shift(); s; s = cola.shift()) {
      try {
        res[s.slug] = await calcularSpot(s);
        console.log(s.slug.padEnd(20), textoFondo(res[s.slug]) || "(sin dato)", `costa ${res[s.slug].dist_costa_m} m, primer dato ${res[s.slug].primer_dato_m} m`);
      } catch (e) {
        errores.push(s.slug);
        console.error(s.slug, "ERROR", e.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.CONCURRENCIA) || 3 }, trabajador));
  // Mismo orden que index.html, para que el diff sea estable.
  const ordenado = Object.fromEntries(spots.filter((x) => res[x.slug]).map((x) => [x.slug, res[x.slug]]));
  const salida = {
    version: 1,
    generado: new Date().toISOString().slice(0, 10),
    script: "scripts/fondo/tipo-fondo.mjs",
    metodo: `Punto de costa = el más cercano al spot sobre natural=coastline (OSM, búsqueda a ${RADIO_BUSQUEDA_COSTA_M} m). Orilla = elementos de OSM a ${RADIO_ORILLA_M} m o menos de ese punto (el más cercano manda). Fondo = rejilla cada ${PASO_M} m alrededor del punto de costa sobre EUSeaMap 2025 (EUNIS 2019, detalle completo) y las praderas de EMODnet; fracciones sobre los puntos con clase; cobertura = parte de los puntos de mar de EUSeaMap con clase; algas = roca infralitoral (somera, con luz); primer_dato_m = distancia del punto de costa al primer punto con dato.`,
    calidad: "EUSeaMap es un mapa predictivo de escala amplia (celdas de unos 100 m cerca de la costa, construido sobre los mapas de sustrato de EMODnet Geology de escalas 1:1 500 a 1:1 000 000 según la zona). Los primeros 50-100 m desde la orilla casi nunca están resueltos: para eso manda la orilla de OSM. Orientativo, no sirve para navegar.",
    fuentes: {
      orilla: {
        titulo: "OpenStreetMap (natural=coastline/beach/cliff/bare_rock/rock/shingle/sand/reef, man_made=breakwater/groyne/pier, harbour, landuse=harbour/port, leisure=marina)",
        url: "https://www.openstreetmap.org/copyright",
        licencia: "ODbL 1.0 — © OpenStreetMap contributors. Este fichero es una base de datos derivada: se ofrece bajo ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/).",
        fecha_consulta: new Date().toISOString().slice(0, 10),
      },
      fondo: {
        titulo: "EUSeaMap 2025 Broad-Scale Predictive Habitat Map for Europe (EUNIS 2019) + Seagrass cover (EOV) in European waters 2025, EMODnet Seabed Habitats",
        url: "https://emodnet.ec.europa.eu/geonetwork/srv/eng/catalog.search#/metadata/cec07b5e-3a9c-4492-b115-126a17c08697",
        licencia: "CC BY 4.0 — Licensed under CC-BY 4.0 from the European Marine Observation and Data Network (EMODnet) Seabed Habitats initiative (https://emodnet.ec.europa.eu/en/seabed-habitats), funded by the European Commission.",
        fecha_consulta: new Date().toISOString().slice(0, 10),
      },
    },
    spots: ordenado,
  };
  writeFileSync(SALIDA, JSON.stringify(salida));
  console.log(`\n${Object.keys(ordenado).length} spots -> ${SALIDA}${errores.length ? `; errores: ${errores.join(", ")}` : ""}`);
  if (errores.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
