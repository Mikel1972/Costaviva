// scripts/batimetria/isobatas.mjs
//
// Isóbatas de la costa de España y Portugal (península, Baleares, Canarias,
// Madeira y Azores) a partir de EMODnet Bathymetry (DTM 2024, CC BY 4.0;
// respaldo GEBCO_2026, dominio público), sin IA. Se precalculan y se guardan
// como GeoJSON para la capa del mapa (assets/js/capa-batimetria.js). El WMS
// de EMODnet (`emodnet:contours`) no tiene la de 20 m (la que importa desde
// embarcación) y no deja etiquetar ni elegir colores.
//
// Dos juegos (Mikel, 2026-10-08: "si tenemos a mayor profundidad, hasta
// donde tengamos"), para no cargar de golpe un fichero enorme:
//   someras  -> assets/datos/isobatas.json: 20, 50 y 100 m, rejilla completa
//              (~115 m), solo los cuadros con costa o fondo de menos de 130 m,
//              simplificadas ~60 m, sin líneas de menos de 2 km. El mapa las
//              carga desde zoom 8.
//   profundas -> assets/datos/isobatas-profundas.json: 150 a 5000 m, rejilla
//              a 1/4 (~460 m), todos los cuadros (también mar abierto),
//              simplificadas ~400 m, sin líneas de menos de 15 km. Se cargan
//              a cualquier zoom.
// Cada línea larga lleva puntos de etiqueta (`etiquetas`: [lon, lat]) cada
// cierta distancia, para pintar "200 m" encima sin calcular nada en el móvil.
//
// Cómo: por cuadro de 1° x 1° (con una celda de solape) marching squares a
// cada nivel, se encadena, se simplifica (Douglas-Peucker) y se filtra.
//
// Uso: node scripts/batimetria/isobatas.mjs someras     (~10 min)
//      node scripts/batimetria/isobatas.mjs profundas   (~10 min)
import { writeFileSync } from "node:fs";
import { rejillaEmodnet, rejillaGebco, isolineas, simplificar, longitudM, puntosEtiqueta } from "./batimetria.mjs";

export const JUEGOS = {
  someras: {
    salida: "../../assets/datos/isobatas.json",
    niveles: [20, 50, 100],
    escala: 1, celda: 1 / 960, tolerancia: 0.0006, longitudMin: 2000, etiquetaCada: 15000,
    soloCosta: true,
    zonas: [
      { oeste: -10, este: 5, sur: 35, norte: 44 },
      { oeste: -19, este: -13, sur: 27, norte: 30 },
      { oeste: -18, este: -16, sur: 32, norte: 34 },
      { oeste: -32, este: -24, sur: 36, norte: 40 },
    ],
    nota: "simplificadas ~60 m, sin líneas de menos de 2 km",
  },
  profundas: {
    salida: "../../assets/datos/isobatas-profundas.json",
    niveles: [150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000],
    escala: 0.25, celda: 1 / 240, tolerancia: 0.004, longitudMin: 15000, etiquetaCada: 60000,
    soloCosta: false,
    // Mar abierto delante de la costa: golfo de Bizkaia, llanura abisal
    // ibérica, Alborán y Baleares, Canarias, Madeira y Azores.
    zonas: [
      { oeste: -15, este: 5, sur: 35, norte: 46 },
      { oeste: -20, este: -12, sur: 26, norte: 31 },
      { oeste: -19, este: -15, sur: 31, norte: 35 },
      { oeste: -33, este: -23, sur: 35, norte: 41 },
    ],
    nota: "rejilla de ~460 m, simplificadas ~400 m, sin líneas de menos de 15 km",
  },
};

function cuadros(zonas) {
  const vistos = new Set(), out = [];
  for (const z of zonas) for (let lat = z.sur; lat < z.norte; lat++) for (let lon = z.oeste; lon < z.este; lon++) {
    const k = `${lat},${lon}`;
    if (!vistos.has(k)) { vistos.add(k); out.push({ lat, lon }); }
  }
  return out;
}

async function enParalelo(lista, n, fn) {
  const res = [], cola = lista.map((x, i) => [x, i]);
  await Promise.all(Array.from({ length: n }, async () => {
    for (let t; (t = cola.shift());) res[t[1]] = await fn(t[0]);
  }));
  return res;
}

const redondear = (l, dec) => l.map(([x, y]) => [+x.toFixed(dec), +y.toFixed(dec)]);
const conDato = (g) => g.v.some(Number.isFinite);

async function generar(nombre) {
  const J = JUEGOS[nombre];
  if (!J) throw new Error(`juego desconocido: ${nombre} (someras | profundas)`);
  const fallos = [];
  let lista = cuadros(J.zonas);
  if (J.soloCosta) {
    lista = (await enParalelo(lista, 4, async (q) => {
      let g;
      try { g = await rejillaEmodnet({ sur: q.lat, norte: q.lat + 1, oeste: q.lon, este: q.lon + 1 }, 0.0625); }
      catch (e) { return q; } // sin la vista reducida: se intenta igual
      let tierra = false, mar = false, somero = false;
      for (const e of g.v) {
        if (!Number.isFinite(e)) continue;
        if (e >= 0) tierra = true; else mar = true;
        if (e < 0 && e > -130) somero = true;
      }
      return (somero || (tierra && mar)) ? q : null;
    })).filter(Boolean);
  }
  process.stderr.write(`${nombre}: ${lista.length} cuadros\n`);
  const lineas = Object.fromEntries(J.niveles.map((n) => [n, []]));
  const etiquetas = Object.fromEntries(J.niveles.map((n) => [n, []]));
  const solape = J.celda * 1.05;
  const dec = J.escala === 1 ? 4 : 3;
  const procesar = async (q, lado) => {
    const caja = { sur: q.lat - solape, norte: q.lat + lado + solape, oeste: q.lon - solape, este: q.lon + lado + solape };
    let g = null;
    try { g = await rejillaEmodnet(caja, J.escala); } catch (e) { /* GEBCO */ }
    // EMODnet no cubre algún cuadro de mar abierto (o falla): GEBCO.
    if (!g || !conDato(g)) g = await rejillaGebco(caja);
    for (const n of J.niveles) {
      for (const l of isolineas(g, -n)) {
        if (longitudM(l) < J.longitudMin) continue;
        const s = redondear(simplificar(l, J.tolerancia), dec);
        if (s.length < 2) continue;
        lineas[n].push(s);
        etiquetas[n].push(...redondear(puntosEtiqueta(s, J.etiquetaCada), dec));
      }
    }
  };
  let hechos = 0;
  await enParalelo(lista, 3, async (q) => {
    try { await procesar(q, 1); }
    catch (e) {
      for (const [a, b] of [[0, 0], [0, 0.5], [0.5, 0], [0.5, 0.5]]) {
        try { await procesar({ lat: q.lat + a, lon: q.lon + b }, 0.5); }
        catch (e2) { fallos.push(`${q.lat + a},${q.lon + b}: ${e2.message}`); }
      }
    }
    process.stderr.write(`${++hechos}/${lista.length} (${q.lat}, ${q.lon})\n`);
  });
  if (fallos.length) process.stderr.write(`Cuadros sin datos (${fallos.length}):\n${fallos.join("\n")}\n`);
  if (fallos.length > lista.length / 4) throw new Error("demasiados fallos: no se escribe nada");
  const geo = {
    type: "FeatureCollection",
    generado: new Date().toISOString().slice(0, 10),
    fuente: `EMODnet Bathymetry Consortium (2024): EMODnet Digital Bathymetry (DTM 2024), https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1, CC BY 4.0 (respaldo: GEBCO Compilation Group (2026) GEBCO_2026 Grid, doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa). Isóbatas calculadas por Costaviva (scripts/batimetria/isobatas.mjs ${nombre}): ${J.nota}. Orientativas: no sirven para navegar.`,
    features: J.niveles.map((n) => ({
      type: "Feature",
      properties: { profundidad_m: n, etiquetas: etiquetas[n] },
      geometry: { type: "MultiLineString", coordinates: lineas[n] },
    })),
  };
  const txt = JSON.stringify(geo);
  const salida = new URL(J.salida, import.meta.url);
  writeFileSync(salida, txt + "\n");
  console.log(`Escrito ${salida.pathname}: ${(txt.length / 1024).toFixed(0)} KB; ${J.niveles.map((n) => `${n} m: ${lineas[n].length}`).join(", ")}; ${fallos.length} cuadros sin datos`);
}

if (import.meta.url === `file://${process.argv[1]}`) generar(process.argv[2] || "someras").catch((e) => { console.error(e); process.exit(1); });
