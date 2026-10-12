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
// Golfo de Hauraki (2026-10-12): las zonas de la Hauraki Gulf / Tīkapa Moana
// Marine Protection Act 2025 (en vigor desde el 24-10-2025), del elemento de
// ArcGIS 4b0a74880f554ce1a8e1fa46a3bbd3ce (DOC_admin): 12 zonas de alta
// protección (HPA: sin pesca recreativa ni marisqueo), 5 de protección del
// fondo (SPA: caña, fusil y a mano sí; arrastre, dragas y cerco danés no; en
// Mokohīnau tampoco redes caladas, nasas ni palangre de fondo) y 2
// ampliaciones de reserva marina (Cape Rodney-Okakari Point y Cathedral
// Cove). Condiciones de su ficha: uso libre reconociendo "Crown Copyright:
// Department of Conservation Te Papa Atawhai 2025", solo informativo, no para
// navegar ni para interpretar la ley (ATRIBUCION_HAURAKI). Cada zona lleva
// `tipo`: "reserva", "hpa" o "spa" (las del primer servicio, "reserva").
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
const SERVICIO_HAURAKI = "https://services1.arcgis.com/3JjYDyG3oajxU6HO/arcgis/rest/services/Hauraki_Gulf_Tikapa_Moana_Marine_Protection_Act/FeatureServer/0";
const FICHA_HAURAKI = "https://www.arcgis.com/home/item.html?id=4b0a74880f554ce1a8e1fa46a3bbd3ce";
export const ATRIBUCION_DOC = "Marine reserves: Department of Conservation (DOC), Crown copyright, CC BY 4.0";
export const ATRIBUCION_HAURAKI = "Hauraki Gulf / Tīkapa Moana protection areas: Crown Copyright: Department of Conservation Te Papa Atawhai 2025";
export const LIMITE_BYTES = 300 * 1024;
const TOLERANCIAS = [0.0005, 0.001, 0.002, 0.004];

// Tipo de zona de Hauraki por la sección de la ley que la declara.
export function tipoZonaHauraki(seccion) {
  if (/HIGH_PROTECTION/.test(seccion || "")) return "hpa";
  if (/SEAFLOOR_PROTECTION/.test(seccion || "")) return "spa";
  if (/MARINE_RESERVES/.test(seccion || "")) return "reserva";
  return null;
}

export function urlConsulta(tolerancia, servicio = SERVICIO) {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: servicio === SERVICIO ? "NaPALIS_ID,Name,Legislation,Recorded_Area" : "NaPALIS_ID,Name,Legislation,Section",
    outSR: "4326",
    f: "geojson",
    maxAllowableOffset: String(tolerancia),
    geometryPrecision: "5",
  });
  return `${servicio}/query?${q}`;
}

export function armarGeojson(datos, tolerancia, fecha, hauraki = null) {
  const features = (datos.features || []).map((f) => ({
    type: "Feature",
    properties: {
      id: f.properties?.NaPALIS_ID ?? null,
      nombre: f.properties?.Name ?? null,
      ley: f.properties?.Legislation ?? null,
      area_ha: f.properties?.Recorded_Area ?? null,
      tipo: "reserva",
    },
    geometry: f.geometry,
  }));
  for (const f of hauraki?.features || []) {
    const tipo = tipoZonaHauraki(f.properties?.Section);
    if (!tipo) continue;
    features.push({
      type: "Feature",
      properties: { id: f.properties?.NaPALIS_ID ?? null, nombre: f.properties?.Name ?? null, ley: f.properties?.Legislation ?? null, tipo },
      geometry: f.geometry,
    });
  }
  return {
    type: "FeatureCollection",
    fuente: `Department of Conservation (DOC): DOC Marine Reserves (${FICHA})${hauraki ? ` y Hauraki Gulf / Tīkapa Moana Marine Protection Act (${FICHA_HAURAKI})` : ""}`,
    licencia: "Reservas: CC BY 4.0 (verificada en la ficha del elemento el 2026-10-09)." +
      (hauraki ? " Hauraki: Crown Copyright, uso con reconocimiento, solo informativo (ficha del elemento, 2026-10-12)." : ""),
    atribucion: hauraki ? `${ATRIBUCION_DOC} · ${ATRIBUCION_HAURAKI}` : ATRIBUCION_DOC,
    simplificado_grados: tolerancia,
    aviso: "Geometría simplificada para dibujar; no sirve para límites exactos. reserva y hpa: no fishing, no take of any marine life. spa: no bottom trawling, dredging or Danish seining.",
    generado: fecha,
    script: "scripts/fuentes/doc-reservas-marinas.mjs",
    features,
  };
}

async function main() {
  const i = process.argv.indexOf("--salida");
  const salida = i >= 0 ? process.argv[i + 1] : join(RAIZ, "datos", "nz");
  const pedir = async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": "Costaviva/1.0 reservas DOC (sin IA)" } });
    if (!r.ok) throw new Error(`DOC HTTP ${r.status}`);
    return r.json();
  };
  for (const tol of TOLERANCIAS) {
    const datos = await pedir(urlConsulta(tol));
    if (!datos.features?.length) throw new Error("DOC no devolvió ninguna reserva");
    const hauraki = await pedir(urlConsulta(tol, SERVICIO_HAURAKI));
    if (!hauraki.features?.length) throw new Error("DOC no devolvió ninguna zona de Hauraki");
    const texto = JSON.stringify(armarGeojson(datos, tol, new Date().toISOString().slice(0, 10), hauraki)) + "\n";
    if (Buffer.byteLength(texto) <= LIMITE_BYTES) {
      mkdirSync(salida, { recursive: true });
      writeFileSync(join(salida, "reservas-marinas-doc.geojson"), texto);
      console.log(`${datos.features.length} reservas y ${hauraki.features.length} zonas de Hauraki, tolerancia ${tol}°, ${Buffer.byteLength(texto)} bytes.`);
      return;
    }
  }
  throw new Error(`no cabe en ${LIMITE_BYTES} bytes ni con la tolerancia más alta`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
