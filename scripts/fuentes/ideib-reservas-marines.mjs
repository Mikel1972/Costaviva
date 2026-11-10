// scripts/fuentes/ideib-reservas-marines.mjs
// Reservas marinas de les Illes Balears (aguas interiores, competencia del
// Govern balear) para la capa "Zonas sin pesca" de España (2026-11-10). Sin IA
// ni claves. Lo lanza cualquiera en local; el resultado se sube al repo.
//
// Fuente: IDEIB, servicio GOIB_ReservesMarines, capa 1 "Límits Reserves
// Marines Illes Balears". Licencia confirmada por escrito por el ICGIB el
// 2026-11-10 (comun, permisos/registro.json, costaviva-icgib-reservas-marines):
// CC BY-SA 4.0, uso comercial permitido, CompartirIgual solo para esta capa
// (no se extiende al resto de la app). Cita obligatoria: ATRIBUCION_IDEIB.
//
// Solo se toman las zonas "Autonòmica": las estatales (Levante de Mallorca,
// Dragonera) ya están en datos/es/zonas-sin-pesca-boe.geojson con su regla
// del BOE. La capa trae casi todos los polígonos repetidos (dos OBJECTID con
// la misma zona): se quedan una vez. Las "zonas especiales de busseig" son de
// buceo, no de pesca, y no se dibujan.
//
// Tipos (conservador: rojo solo donde el nombre de la zona ya dice que no se
// pesca): reserva integral, zona de veda de pesca recreativa y zona de
// protecció màxima -> sin_pesca; el resto -> parcial, con "consulta la norma".
//
// Uso: node scripts/fuentes/ideib-reservas-marines.mjs

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SERVICIO_IDEIB = "https://ideib.caib.es/geoserveis/rest/services/public/GOIB_ReservesMarines/";
const CAPA = `${SERVICIO_IDEIB}MapServer/1/query`;
export const ATRIBUCION_IDEIB = `<a href="${SERVICIO_IDEIB}" target="_blank" rel="noopener">Servei de mapa de les Reserves Marines de les Illes Balears</a> CC BY-SA 4.0 Govern de les Illes Balears, Direcció General de Pesca`;
const TOLERANCIA = 0.0001; // grados (~10 m): para dibujar, no es el límite legal.

export const REGLAS_IDEIB = {
  "Reserva integral": ["sin_pesca", "Reserva integral de les Illes Balears: prohibida toda pesca."],
  "Zona de veda de pesca recreativa": ["sin_pesca", "Zona de veda de pesca recreativa: prohibida la pesca recreativa."],
  "Zona de protecció màxima": ["sin_pesca", "Zona de protección máxima: prohibida la pesca."],
  "Reserva marina": ["parcial", "Reserva marina de les Illes Balears: pesca recreativa con limitaciones (modalidades, cupos y autorización). Consulta la norma."],
  "Zona de protecció especial": ["parcial", "Zona de protección especial de una reserva marina balear: limitaciones más estrictas que en el resto de la reserva. Consulta la norma."],
  "Zona d'alta protecció": ["parcial", "Zona de alta protección (Govern balear): limitaciones más estrictas a la pesca. Consulta la norma."],
  "Zona de protecció pesquera": ["parcial", "Zona de protección pesquera (Govern balear): pesca con limitaciones. Consulta la norma."],
};

const https = (u) => String(u || "").trim().replace(/^http:\/\//, "https://");

// Pasa la capa del IDEIB (GeoJSON de ArcGIS) al formato de
// datos/es/zonas-sin-pesca-boe.geojson.
export function convertirIDEIB(geo) {
  const vistas = new Set();
  const features = [];
  const lista = [...(geo.features || [])].sort((a, b) => a.properties.OBJECTID - b.properties.OBJECTID);
  for (const f of lista) {
    const p = f.properties || {};
    const regla = REGLAS_IDEIB[p.PROTECCIO];
    if (!regla || !f.geometry || !(p["SHAPE.AREA"] > 1000)) continue; // m²: fuera polígonos degenerados
    const clave = `${p.NOM}|${p.PROTECCIO}|${Math.round(p["SHAPE.AREA"])}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const nom = String(p.NOM || "").trim();
    features.push({
      type: "Feature",
      properties: {
        reserva: nom,
        ambito: "Govern de les Illes Balears (aguas interiores)",
        zona: p.PROTECCIO,
        tipo: regla[0],
        regla: regla[1],
        referencia: {
          norma: String(p.NORMA || "").trim() && !/^Reserva marina/i.test(p.NORMA) ? String(p.NORMA).trim() : "Govern de les Illes Balears (reserves marines)",
          url: https(p.URL) || "https://www.caib.es/sites/reservesmarines/ca/",
        },
        fuente: "IDEIB",
        ideib_objectid: p.OBJECTID,
      },
      geometry: f.geometry,
    });
  }
  return { type: "FeatureCollection", atribucion: ATRIBUCION_IDEIB, features };
}

async function main() {
  const q = new URLSearchParams({
    where: "COMPETENT='Autonòmica'",
    outFields: "OBJECTID,NOM,PROTECCIO,NORMA,URL,SHAPE.AREA",
    outSR: "4326", f: "geojson",
    maxAllowableOffset: String(TOLERANCIA), geometryPrecision: "5",
  });
  const r = await fetch(`${CAPA}?${q}`);
  if (!r.ok) throw new Error(`IDEIB: HTTP ${r.status}`);
  const geo = convertirIDEIB(await r.json());
  geo.generado = new Date().toISOString().slice(0, 10);
  const texto = JSON.stringify(geo) + "\n";
  writeFileSync(join(RAIZ, "datos", "es", "reservas-marines-ideib.geojson"), texto);
  console.log(`IDEIB: ${geo.features.length} zonas, ${Buffer.byteLength(texto)} bytes.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
