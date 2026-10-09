// scripts/fuentes/linz-mareas.mjs
// Descarga las predicciones de marea oficiales de LINZ y las deja en
// datos/nz/ para los spots de Nueva Zelanda (fase 1 de NZ, 2026-10-09).
// Sin IA, sin claves. Lo lanza a mano el workflow linz-mareas.yml (o
// cualquiera en local); no escribe en producción ni en el bucket.
//
// Qué descarga (todo de linz.govt.nz, licencia CC BY 4.0 por la
// declaración general de LINZ, pendiente de confirmación escrita):
//   - La lista de tablas anuales de los 87 puertos (CSV por puerto y año).
//   - La tabla de puertos secundarios (diferencias de hora y alturas).
// Qué escribe:
//   - datos/nz/linz-puertos.json: catálogo (87 tablas con coordenadas y los
//     314 secundarios con sus diferencias y MHWS/MLWS) + puerto de cada spot.
//   - datos/nz/linz-mareas-AAAA.json: pleamares y bajamares en UTC, solo de
//     las tablas que usan los spots NZ (las propias y las de los puertos
//     estándar de los secundarios), en formato compacto (mareas-linz.js).
//
// Uso:
//   node scripts/fuentes/linz-mareas.mjs [--anios 2026,2027] [--salida datos/nz]
//        [--cache DIR] [--comprobar]
//   --cache DIR  guarda/lee ahí los CSV descargados (para repetir sin red).
//   --comprobar  solo dice si el puerto de cada spot cambiaría; sale con 1 si sí.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsearTablaLinz, parsearSecundariosLinz, comprimirEventos, asignarPuerto, distanciaKm,
  etiquetaLocal, ATRIBUCION_LINZ, AVISO_LINZ,
} from "../../functions/_lib/nz/mareas-linz.js";
import { SPOTS_NZ } from "../../functions/_lib/nz/spots-nz.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_LISTA = "https://www.linz.govt.nz/products-services/tides-and-tidal-streams/tide-predictions/tide-predictions-list-view";
const URL_PAGINA = "https://www.linz.govt.nz/products-services/tides-and-tidal-streams/tide-predictions";
const URL_SECUNDARIOS_RESPALDO = "https://www.linz.govt.nz/sites/default/files/2026-06/NZNA_Secondary-ports-2026-27.csv";
const UA = { "User-Agent": "Costaviva/1.0 mareas LINZ (sin IA; datos@costaviva.org)" };

function args() {
  const a = process.argv.slice(2);
  const valor = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const anioNZ = +etiquetaLocal(Date.now()).slice(0, 4);
  return {
    anios: (valor("--anios") || `${anioNZ},${anioNZ + 1}`).split(",").map(Number).filter(Boolean),
    salida: valor("--salida") || join(RAIZ, "datos", "nz"),
    cache: valor("--cache"),
    comprobar: a.includes("--comprobar"),
  };
}

async function descargar(url, cache) {
  const fichero = cache ? join(cache, encodeURIComponent(url)) : null;
  if (fichero && existsSync(fichero)) return readFileSync(fichero, "utf8");
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const texto = await r.text();
      if (fichero) { mkdirSync(cache, { recursive: true }); writeFileSync(fichero, texto); }
      return texto;
    } catch (e) {
      if (intento >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 2000 * intento));
    }
  }
}

// Nombre normalizado para casar "Riverton - Aparima" con "Riverton / Aparima"
// o "Whakatāne" con "Whakatane".
export const normalizar = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// { nombre: { anio: url } } a partir de la página de lista de LINZ.
export function urlsTablas(html) {
  const tablas = {};
  const re = /href="(https:\/\/static\.charts\.linz\.govt\.nz\/tide-tables\/maj-ports\/csv\/([^"]+?) (\d{4})\.csv)"/g;
  for (const m of html.matchAll(re)) {
    const nombre = m[2].replace(/&amp;/g, "&");
    (tablas[nombre] ||= {})[m[3]] = m[1].replace(/ /g, "%20");
  }
  return tablas;
}

// Une las 87 tablas con su secundario (mismo nombre, a menos de 5 km).
export function casarTablas(tablas, secundarios) {
  const porNombre = new Map(Object.values(secundarios).map((p) => [normalizar(p.nombre), p]));
  for (const [nombre, t] of Object.entries(tablas)) {
    const p = porNombre.get(normalizar(nombre));
    if (p && p.lat !== null && t.lat !== null && distanciaKm(p.lat, p.lon, t.lat, t.lon) < 5) {
      t.secundario = p.id;
      p.tabla = nombre;
    } else {
      t.secundario = null;
    }
  }
}

async function main() {
  const op = args();
  const lista = await descargar(URL_LISTA, op.cache);
  const urls = urlsTablas(lista);
  const nombres = Object.keys(urls).sort();
  if (nombres.length < 50) throw new Error(`solo ${nombres.length} tablas en la lista de LINZ: ¿ha cambiado la página?`);

  const pagina = await descargar(URL_PAGINA, op.cache).catch(() => "");
  const urlSec = (/https:\/\/www\.linz\.govt\.nz\/sites\/default\/files\/[^"]*Secondary-ports[^"]*\.csv/.exec(pagina) || [URL_SECUNDARIOS_RESPALDO])[0];
  const secundarios = parsearSecundariosLinz(await descargar(urlSec, op.cache));
  console.log(`LINZ: ${nombres.length} tablas, ${Object.keys(secundarios).length} puertos secundarios (${urlSec}).`);

  // Coordenadas de cada tabla: su cabecera (la del primer año pedido).
  const tablas = {};
  const crudos = {};
  const anioRef = String(op.anios[0]);
  for (const nombre of nombres) {
    const url = urls[nombre][anioRef] || Object.values(urls[nombre])[0];
    const texto = await descargar(url, op.cache);
    const t = parsearTablaLinz(texto);
    tablas[nombre] = { estacion: t.estacion, lat: +t.lat.toFixed(4), lon: +t.lon.toFixed(4), anios: Object.keys(urls[nombre]).sort().map(Number) };
    crudos[`${nombre}|${anioRef}`] = t;
  }
  casarTablas(tablas, secundarios);
  const catalogo = { tablas, secundarios };

  // Puerto de cada spot.
  const asignacion = {};
  const cambios = [];
  for (const s of SPOTS_NZ) {
    const p = asignarPuerto(s, catalogo);
    asignacion[s.slug] = p;
    const a = s.puerto_linz || {};
    if (!p || p.id !== a.id || p.tabla !== a.tabla) cambios.push(`${s.slug}: ${JSON.stringify(a)} -> ${JSON.stringify(p)}`);
  }
  if (cambios.length) console.log(`Puertos que cambiarían en spots-nz.js (${cambios.length}):\n  ${cambios.join("\n  ")}`);
  if (op.comprobar) process.exit(cambios.length ? 1 : 0);

  // Tablas necesarias: las propias y las de los estándar de los secundarios.
  const necesarias = new Set();
  for (const p of Object.values(asignacion)) {
    if (!p) continue;
    if (p.tabla) necesarias.add(p.tabla);
    else necesarias.add(secundarios[secundarios[p.id].estandar].tabla);
  }

  mkdirSync(op.salida, { recursive: true });
  const comun = {
    fuente: "Toitū Te Whenua Land Information New Zealand (LINZ), tide predictions",
    urls: [URL_PAGINA, urlSec],
    licencia: "CC BY 4.0 (declaración general de LINZ, https://www.linz.govt.nz/copyright; pendiente de confirmación escrita)",
    atribucion: ATRIBUCION_LINZ,
    aviso: AVISO_LINZ,
    script: "scripts/fuentes/linz-mareas.mjs",
    generado: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(join(op.salida, "linz-puertos.json"),
    JSON.stringify({ ...comun, alturas: "metros sobre el cero hidrográfico de la carta", tablas, secundarios, spots: asignacion }) + "\n");

  for (const anio of op.anios) {
    const puertos = {};
    for (const nombre of [...necesarias].sort()) {
      const url = urls[nombre]?.[anio];
      if (!url) { console.log(`  sin tabla ${nombre} ${anio}`); continue; }
      const t = crudos[`${nombre}|${anio}`] || parsearTablaLinz(await descargar(url, op.cache));
      puertos[nombre] = comprimirEventos(t.eventos);
    }
    const f = join(op.salida, `linz-mareas-${anio}.json`);
    writeFileSync(f, JSON.stringify({ ...comun, anio, formato: "t0 en minutos UTC; d = [minutos desde el anterior, altura en cm, ...]", puertos }) + "\n");
    console.log(`${f}: ${Object.keys(puertos).length} tablas.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
