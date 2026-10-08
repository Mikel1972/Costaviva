// scripts/batimetria/isobatas.mjs
//
// Isóbatas de 20, 50 y 100 m de la costa de España y Portugal (península,
// Baleares, Canarias, Madeira y Azores) a partir de EMODnet Bathymetry
// (DTM 2024, CC BY 4.0), sin IA. Se precalculan una vez y se guardan en
// assets/datos/isobatas.json (GeoJSON) para la capa del mapa
// (assets/js/capa-batimetria.js). El WMS de EMODnet (`emodnet:contours`) solo
// tiene 50, 100, 200... m: la de 20 m (la que importa desde embarcación)
// hay que calcularla.
//
// Cómo: 1) por cada cuadro de 1° x 1° se pide la rejilla reducida (1/16) y
// solo se siguen los que tienen costa o fondo de menos de 130 m; 2) de esos se
// pide la rejilla completa (~115 m) con una celda de solape; 3) marching
// squares a -20, -50 y -100 m, se encadena, se simplifica (Douglas-Peucker,
// ~60 m) y se descartan las líneas de menos de 2 km (ruido y bajos sueltos).
//
// Uso: node scripts/batimetria/isobatas.mjs   (~10 min)
import { writeFileSync } from "node:fs";
import { rejillaEmodnet, isolineas, simplificar, longitudM } from "./batimetria.mjs";

const SALIDA = new URL("../../assets/datos/isobatas.json", import.meta.url);
export const NIVELES = [20, 50, 100];
const TOLERANCIA = 0.0006; // grados (~60 m)
const LONGITUD_MIN_M = 2000;
const SOLAPE = 0.0011; // algo más de una celda (1/960°)
const ZONAS = [
  { nombre: "peninsula_baleares", oeste: -10, este: 5, sur: 35, norte: 44 },
  { nombre: "canarias", oeste: -19, este: -13, sur: 27, norte: 30 },
  { nombre: "madeira", oeste: -18, este: -16, sur: 32, norte: 34 },
  { nombre: "azores", oeste: -32, este: -24, sur: 36, norte: 40 },
];

function cuadros() {
  const out = [];
  for (const z of ZONAS) for (let lat = z.sur; lat < z.norte; lat++) for (let lon = z.oeste; lon < z.este; lon++) out.push({ lat, lon });
  return out;
}

async function enParalelo(lista, n, fn) {
  const res = [], cola = lista.map((x, i) => [x, i]);
  await Promise.all(Array.from({ length: n }, async () => {
    for (let t; (t = cola.shift());) res[t[1]] = await fn(t[0]);
  }));
  return res;
}

const redondear = (l) => l.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);

async function principal() {
  const todos = cuadros();
  const fallos = [];
  const utiles = (await enParalelo(todos, 4, async (q) => {
    let g;
    try { g = await rejillaEmodnet({ sur: q.lat, norte: q.lat + 1, oeste: q.lon, este: q.lon + 1 }, 0.0625); }
    catch (e) { return q; } // sin la vista reducida: se intenta igual a resolución completa
    let tierra = false, mar = false, somero = false;
    for (const e of g.v) {
      if (!Number.isFinite(e)) continue;
      if (e >= 0) tierra = true; else mar = true;
      if (e < 0 && e > -130) somero = true;
    }
    return (somero || (tierra && mar)) ? q : null;
  })).filter(Boolean);
  process.stderr.write(`${utiles.length} de ${todos.length} cuadros con costa o fondo somero\n`);
  const lineas = Object.fromEntries(NIVELES.map((n) => [n, []]));
  let hechos = 0;
  // Un cuadro de 1° (~8 MB de texto) a veces da error en el servidor: se
  // reintenta (batimetria.mjs) y, si sigue fallando, se parte en 4 de 0,5°.
  const procesar = async (q, lado) => {
    const g = await rejillaEmodnet({ sur: q.lat - SOLAPE, norte: q.lat + lado + SOLAPE, oeste: q.lon - SOLAPE, este: q.lon + lado + SOLAPE });
    for (const n of NIVELES) {
      for (const l of isolineas(g, -n)) {
        if (longitudM(l) < LONGITUD_MIN_M) continue;
        const s = redondear(simplificar(l, TOLERANCIA));
        if (s.length >= 2) lineas[n].push(s);
      }
    }
  };
  await enParalelo(utiles, 3, async (q) => {
    try { await procesar(q, 1); }
    catch (e) {
      for (const [a, b] of [[0, 0], [0, 0.5], [0.5, 0], [0.5, 0.5]]) {
        try { await procesar({ lat: q.lat + a, lon: q.lon + b }, 0.5); }
        catch (e2) { fallos.push(`${q.lat + a},${q.lon + b}: ${e2.message}`); }
      }
    }
    process.stderr.write(`${++hechos}/${utiles.length} (${q.lat}, ${q.lon})\n`);
  });
  if (fallos.length) process.stderr.write(`Cuadros sin datos (${fallos.length}):\n${fallos.join("\n")}\n`);
  if (fallos.length > utiles.length) throw new Error("demasiados fallos: no se escribe nada");
  const geo = {
    type: "FeatureCollection",
    generado: new Date().toISOString().slice(0, 10),
    fuente: "EMODnet Bathymetry Consortium (2024): EMODnet Digital Bathymetry (DTM 2024), https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1, CC BY 4.0. Isóbatas calculadas por Costaviva (scripts/batimetria/isobatas.mjs): simplificadas ~60 m, sin líneas de menos de 2 km. Orientativas: no sirven para navegar.",
    features: NIVELES.map((n) => ({ type: "Feature", properties: { profundidad_m: n }, geometry: { type: "MultiLineString", coordinates: lineas[n] } })),
  };
  const txt = JSON.stringify(geo);
  writeFileSync(SALIDA, txt + "\n");
  console.log(`\nEscrito ${SALIDA.pathname}: ${(txt.length / 1024).toFixed(0)} KB; líneas ${NIVELES.map((n) => `${n} m: ${lineas[n].length}`).join(", ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e); process.exit(1); });
