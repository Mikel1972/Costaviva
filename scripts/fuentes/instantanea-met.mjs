// scripts/fuentes/instantanea-met.mjs
// Instantánea de MET Norway Locationforecast para todos los SPOTS y una
// rejilla de 1° (2026-10-08). Sin IA, sin dependencias (Node 20).
//
// La lee functions/_lib/fuentes.js cuando FUENTE_ATMOSFERA (o un grupo) vale
// "metno" y la petición trae muchos puntos (prevision.js, viento-campo.js,
// registrar-presion.js, turbidez): MET pide no pasar de 20 peticiones/s en
// total y las Pages Functions cortan a los 50 subrequests, así que esas
// llamadas no pueden ir punto a punto en vivo.
//
// Condiciones de MET (api.met.no/doc/TermsOfService) que se cumplen aquí:
//   - User-Agent "Costaviva/1.0 <METNO_CONTACTO>" (variable obligatoria).
//   - No se repite una petición antes de su Expires: se reaprovecha la serie
//     de la instantánea anterior; al caducar, petición condicional con
//     If-Modified-Since (304 = misma serie).
//   - Como mucho 4 peticiones a la vez y una pausa entre lotes (~5/s).
//
// Uso: METNO_CONTACTO="https://..." node scripts/fuentes/instantanea-met.mjs salida.json
//      (opcional ANTERIOR_URL o FUENTES_GRATUITAS_URL para reaprovechar la anterior)

import { writeFileSync } from "node:fs";
import { SPOTS } from "../../functions/prevision.js";
import { urlMetNorway, userAgentMetNorway, serieDesdeMet, COLUMNAS_MET } from "../../functions/_lib/met-norway.js";
import { baseInstantaneas } from "../../functions/_lib/instantaneas.js";

// Rejilla de 1° sobre el mar y la costa de España y Portugal (península y
// Baleares) y Canarias. viento-campo.js interpola sobre ella.
export const CAJAS_REJILLA = [
  { latMin: 35, latMax: 44, lonMin: -10, lonMax: 5 },
  { latMin: 27, latMax: 30, lonMin: -19, lonMax: -13 },
];
const PASO = 1;
const MAX_HORAS = 96;
const CONCURRENCIA = 4;

export function puntosInstantanea(spots = SPOTS) {
  const puntos = spots.map((s) => ({ id: s.slug, tipo: "spot", lat: s.lat, lon: s.lon }));
  for (const c of CAJAS_REJILLA) {
    for (let la = c.latMin; la <= c.latMax; la += PASO) {
      for (let lo = c.lonMin; lo <= c.lonMax; lo += PASO) {
        puntos.push({ id: `r${la}_${lo}`, tipo: "rejilla", lat: la, lon: lo });
      }
    }
  }
  return puntos;
}

// Recorta la serie a las horas útiles (desde la hora anterior a ahora).
export function recortarSerie(serie, ahora = Date.now()) {
  if (serie.inicio === null) return serie;
  const desde = Math.max(0, Math.floor((ahora - 3600e3 - serie.inicio) / 3600e3));
  const hasta = Math.min(serie.horas, desde + MAX_HORAS);
  const r = { inicio: serie.inicio + desde * 3600e3, horas: hasta - desde };
  for (const k of COLUMNAS_MET) r[k] = serie[k].slice(desde, hasta);
  return r;
}

async function leerAnterior() {
  const url = process.env.ANTERIOR_URL || `${baseInstantaneas(process.env)}/atmosfera/todos.json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return new Map();
    const d = await r.json();
    return new Map((d.puntos || []).map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

async function pedirPunto(p, anterior, ua, ahora, stats) {
  const prev = anterior.get(p.id);
  if (prev && prev.expira && ahora < prev.expira && prev.serie) {
    stats.reutilizados++;
    return { ...p, expira: prev.expira, last_modified: prev.last_modified, elevacion: prev.elevacion ?? null, serie: prev.serie };
  }
  const headers = { "User-Agent": ua, Accept: "application/json" };
  if (prev?.last_modified && prev.serie) headers["If-Modified-Since"] = prev.last_modified;
  for (let intento = 1; intento <= 3; intento++) {
    const r = await fetch(urlMetNorway(p.lat, p.lon), { headers });
    const exp = Date.parse(r.headers.get("expires") || "");
    const expira = Number.isFinite(exp) ? exp : ahora + 30 * 60e3;
    if (r.status === 304 && prev?.serie) {
      stats.no_modificados++;
      return { ...p, expira, last_modified: prev.last_modified, elevacion: prev.elevacion ?? null, serie: prev.serie };
    }
    if (r.ok) {
      const json = await r.json();
      stats.descargados++;
      return {
        ...p,
        expira,
        last_modified: r.headers.get("last-modified") || "",
        elevacion: json?.geometry?.coordinates?.[2] ?? null,
        serie: recortarSerie(serieDesdeMet(json), ahora),
      };
    }
    if (r.status === 429 || r.status >= 500) {
      await new Promise((ok) => setTimeout(ok, 2000 * intento));
      continue;
    }
    throw new Error(`MET Norway HTTP ${r.status} en ${p.id}`);
  }
  throw new Error(`MET Norway no respondió en ${p.id}`);
}

export async function generarInstantanea({ ahora = Date.now() } = {}) {
  const ua = userAgentMetNorway(process.env);
  const anterior = await leerAnterior();
  const puntos = puntosInstantanea();
  const stats = { descargados: 0, no_modificados: 0, reutilizados: 0, fallos: 0 };
  const salida = [];
  for (let i = 0; i < puntos.length; i += CONCURRENCIA) {
    const lote = puntos.slice(i, i + CONCURRENCIA);
    const res = await Promise.all(
      lote.map((p) =>
        pedirPunto(p, anterior, ua, ahora, stats).catch((e) => {
          stats.fallos++;
          console.log(`::warning::${e.message}`);
          return null;
        })
      )
    );
    salida.push(...res.filter(Boolean));
    await new Promise((ok) => setTimeout(ok, 800));
  }
  return {
    v: 1,
    fuente: "metno",
    atribucion: "Datos meteorológicos: MET Norway (CC BY 4.0)",
    generado_en: new Date(ahora).toISOString(),
    rejilla: { paso: PASO, cajas: CAJAS_REJILLA },
    stats,
    puntos: salida,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destino = process.argv[2] || "todos.json";
  const inst = await generarInstantanea();
  writeFileSync(destino, JSON.stringify(inst));
  console.log(`Instantánea MET Norway: ${inst.puntos.length} puntos`, inst.stats);
  // Más de un 10 % de fallos: en rojo (no se sube una instantánea a medias
  // sin que se note, comun pruebas-y-alertas.md P4).
  if (inst.stats.fallos > puntosInstantanea().length * 0.1) {
    console.log("::error::Demasiados fallos pidiendo a MET Norway");
    process.exit(1);
  }
}
