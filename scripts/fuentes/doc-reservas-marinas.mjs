// scripts/fuentes/doc-reservas-marinas.mjs
// Reservas marinas de Nueva Zelanda (Department of Conservation, DOC) para
// la futura capa "Marine reserves" (fase 1 de NZ, 2026-10-09). Sin IA ni
// claves. Lo lanza a mano el workflow linz-mareas.yml o cualquiera en local.
//
// Fuente: elemento de ArcGIS 0e74f9682502447c9a14d51340512361 (DOC_admin),
// servicio DOC_Marine_Reserves/FeatureServer/0, 49 reservas. Licencia
// verificada el 2026-10-09 en la ficha del elemento: "Crown copyright (c)
// Department of Conservation (DOC) ... licensed under a Creative Commons
// Attribution 4.0 International License".
//
// Se pide ya simplificado al servidor (maxAllowableOffset, en grados) y con
// 5 decimales, y se sube la tolerancia hasta que el fichero cabe en
// LIMITE_BYTES. Es para dibujar: el polígono simplificado NO sirve para
// decidir si un punto concreto está dentro de una reserva al metro.
//
// Uso: node scripts/fuentes/doc-reservas-marinas.mjs [--salida datos/nz]

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SERVICIO = "https://services1.arcgis.com/3JjYDyG3oajxU6HO/arcgis/rest/services/DOC_Marine_Reserves/FeatureServer/0";
const FICHA = "https://www.arcgis.com/home/item.html?id=0e74f9682502447c9a14d51340512361";
export const ATRIBUCION_DOC = "Marine reserves: Department of Conservation (DOC), Crown copyright, CC BY 4.0";
export const LIMITE_BYTES = 300 * 1024;
const TOLERANCIAS = [0.0005, 0.001, 0.002, 0.004];

export function urlConsulta(tolerancia) {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: "NaPALIS_ID,Name,Legislation,Recorded_Area",
    outSR: "4326",
    f: "geojson",
    maxAllowableOffset: String(tolerancia),
    geometryPrecision: "5",
  });
  return `${SERVICIO}/query?${q}`;
}

export function armarGeojson(datos, tolerancia, fecha) {
  const features = (datos.features || []).map((f) => ({
    type: "Feature",
    properties: {
      id: f.properties?.NaPALIS_ID ?? null,
      nombre: f.properties?.Name ?? null,
      ley: f.properties?.Legislation ?? null,
      area_ha: f.properties?.Recorded_Area ?? null,
    },
    geometry: f.geometry,
  }));
  return {
    type: "FeatureCollection",
    fuente: `Department of Conservation (DOC), DOC Marine Reserves (${FICHA})`,
    licencia: "CC BY 4.0 (verificada en la ficha del elemento el 2026-10-09)",
    atribucion: ATRIBUCION_DOC,
    simplificado_grados: tolerancia,
    aviso: "Geometría simplificada para dibujar; no sirve para límites exactos. No fishing. No take of any marine life.",
    generado: fecha,
    script: "scripts/fuentes/doc-reservas-marinas.mjs",
    features,
  };
}

async function main() {
  const i = process.argv.indexOf("--salida");
  const salida = i >= 0 ? process.argv[i + 1] : join(RAIZ, "datos", "nz");
  for (const tol of TOLERANCIAS) {
    const r = await fetch(urlConsulta(tol), { headers: { "User-Agent": "Costaviva/1.0 reservas DOC (sin IA)" } });
    if (!r.ok) throw new Error(`DOC HTTP ${r.status}`);
    const datos = await r.json();
    if (!datos.features?.length) throw new Error("DOC no devolvió ninguna reserva");
    const texto = JSON.stringify(armarGeojson(datos, tol, new Date().toISOString().slice(0, 10))) + "\n";
    if (Buffer.byteLength(texto) <= LIMITE_BYTES) {
      mkdirSync(salida, { recursive: true });
      writeFileSync(join(salida, "reservas-marinas-doc.geojson"), texto);
      console.log(`${datos.features.length} reservas, tolerancia ${tol}°, ${Buffer.byteLength(texto)} bytes.`);
      return;
    }
  }
  throw new Error(`no cabe en ${LIMITE_BYTES} bytes ni con la tolerancia más alta`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
