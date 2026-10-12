// scripts/fuentes/zonas-sin-pesca.mjs
// Ficheros PÚBLICOS de la capa "Zonas sin pesca" del mapa (2026-10-12, Mikel:
// "las zonas de no pesca deben aparecer marcadas, en su totalidad, con una
// trama de líneas rojas, en todo el mundo en el que ofrezcamos servicios").
// Sin IA ni red: se generan a partir de los datos oficiales ya descargados.
//
//   assets/datos/zonas-sin-pesca/nz.geojson  <- datos/nz/reservas-marinas-doc.geojson
//     (DOC: reservas marinas y zonas del golfo de Hauraki de 2025; lo baja
//     scripts/fuentes/doc-reservas-marinas.mjs).
//
// Cada zona lleva solo { nombre, tipo }: "reserva" y "hpa" = no se pesca nada;
// "spa" = protección del fondo (caña sí, artes de fondo no), que el mapa
// dibuja distinto. Longitudes de NZ en 162..186 (la copia del mundo del
// mapa): una reserva al este del 180 (Kermadec) llega como -178 y se pasa a
// +182. Coordenadas a 4 decimales (~11 m), de sobra para dibujar.
//
// Uso: node scripts/fuentes/zonas-sin-pesca.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TIPOS = ["reserva", "hpa", "spa"];

const redondear = (x) => Math.round(x * 1e4) / 1e4;

// Pasa cada anillo a la copia del mundo de `lonMin` (NZ: 162) y redondea.
export function normalizarGeometria(g, lonMin = -180) {
  const punto = ([lon, lat]) => [redondear(lon < lonMin ? lon + 360 : lon), redondear(lat)];
  const anillo = (a) => a.map(punto);
  if (g?.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map(anillo) };
  if (g?.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(anillo)) };
  return null;
}

export function zonasNZ(doc) {
  const features = [];
  for (const f of doc.features || []) {
    const tipo = f.properties?.tipo || "reserva";
    const geometry = normalizarGeometria(f.geometry, 0);
    if (!TIPOS.includes(tipo) || !geometry) continue;
    features.push({ type: "Feature", properties: { nombre: f.properties?.nombre || "Marine reserve", tipo }, geometry });
  }
  return {
    type: "FeatureCollection",
    region: "nz",
    atribucion: doc.atribucion,
    fuente: doc.fuente,
    generado: doc.generado,
    aviso: "Contorno simplificado para dibujar: no sirve como límite legal exacto.",
    features,
  };
}

function main() {
  const doc = JSON.parse(readFileSync(join(RAIZ, "datos", "nz", "reservas-marinas-doc.geojson"), "utf8"));
  const salida = join(RAIZ, "assets", "datos", "zonas-sin-pesca");
  mkdirSync(salida, { recursive: true });
  const nz = zonasNZ(doc);
  const texto = JSON.stringify(nz) + "\n";
  writeFileSync(join(salida, "nz.geojson"), texto);
  console.log(`nz: ${nz.features.length} zonas, ${Buffer.byteLength(texto)} bytes.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
