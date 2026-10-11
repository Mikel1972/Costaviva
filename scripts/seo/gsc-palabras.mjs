// scripts/seo/gsc-palabras.mjs
// Datos de Search Console para el robot de palabras clave de comun
// (Mikel1972/comun, scripts/seo/palabras.mjs), SIN IA. Comun no puede entrar
// en Search Console: la cuenta de servicio solo acepta a este repo (Workload
// Identity Federation filtrada por repositorio, ver CLAUDE.md, "Search
// Console"). Por eso este script deja los datos aquí y comun los lee con su
// token los lunes.
//
// Escribe datos-robots/seo/gsc-consultas.json (privado: datos-robots/ está
// fuera de la lista blanca de rutas públicas):
//   semanas: clics, impresiones y posición por semana (lunes a domingo) de
//            las últimas 16 semanas completas; semanas_por_pais, lo mismo
//            por país de Search Console ("esp", "prt", "nzl"...).
//   consultas: búsqueda + página + país de los últimos 28 días.
//   consultas_semana: búsqueda + página + país de la última semana completa.
// comun hace un informe por país (España, Portugal y Nueva Zelanda).
// Solo lectura (webmasters.readonly). Lo llama indexacion-google.yml
// (martes y viernes) después de autenticarse. Nunca sale con error: si falla,
// lo dice y deja el fichero anterior (comun avisa si está viejo).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SALIDA = join(RAIZ, "datos-robots", "seo", "gsc-consultas.json");
const DIA = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

export function lunesDe(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

// Filas diarias {keys:[fecha], clicks, impressions, position} → semanas
// completas (solo las que tienen sus 7 días cerrados antes de `hasta`).
export function agruparSemanas(filas, hasta, iFecha = 0) {
  const sem = {};
  for (const r of filas) {
    const s = lunesDe(r.keys[iFecha]);
    const x = (sem[s] ||= { semana: s, clics: 0, impresiones: 0, posPond: 0, dias: 0 });
    x.clics += r.clicks; x.impresiones += r.impressions; x.posPond += r.position * r.impressions; x.dias++;
  }
  return Object.values(sem)
    .filter((x) => iso(Date.parse(`${x.semana}T00:00:00Z`) + 6 * DIA) <= hasta)
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .map((x) => ({ semana: x.semana, clics: x.clics, impresiones: x.impresiones, posicion: x.impresiones ? +(x.posPond / x.impresiones).toFixed(1) : null }));
}

const ruta = (u) => String(u).replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
export const filaConsulta = (r) => ({ query: r.keys[0], pagina: ruta(r.keys[1]), pais: r.keys[2] ?? null, clics: r.clicks, impresiones: r.impressions, posicion: +r.position.toFixed(1) });

// Filas diarias con [fecha, país] → { país: semanas }.
export function semanasPorPais(filas, hasta) {
  const por = {};
  for (const r of filas) (por[r.keys[1]] ||= []).push(r);
  return Object.fromEntries(Object.entries(por).map(([p, fs]) => [p, agruparSemanas(fs, hasta).slice(-16)]));
}

async function main() {
  // Import dinámico: así la lógica pura se prueba sin instalar la librería.
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const cab = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const sites = await (await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: cab })).json();
  const sitio = sites.siteEntry?.[0]?.siteUrl;
  if (!sitio) throw new Error("la cuenta de servicio no ve ninguna propiedad");
  const consulta = async (cuerpo) => {
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/searchAnalytics/query`, { method: "POST", headers: cab, body: JSON.stringify(cuerpo) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).rows || [];
  };
  const hoy = Date.now();
  const hasta = iso(hoy - 3 * DIA); // Google tarda ~2-3 días en asentar
  const diarias = await consulta({ startDate: iso(hoy - 120 * DIA), endDate: hasta, dimensions: ["date"], rowLimit: 200 });
  const semanas = agruparSemanas(diarias, hasta).slice(-16);
  const porPais = semanasPorPais(await consulta({ startDate: iso(hoy - 120 * DIA), endDate: hasta, dimensions: ["date", "country"], rowLimit: 5000 }), hasta);
  const consultas = (await consulta({ startDate: iso(hoy - 30 * DIA), endDate: hasta, dimensions: ["query", "page", "country"], rowLimit: 2000 })).map(filaConsulta);
  const ult = semanas.at(-1)?.semana;
  const consultasSemana = ult ? (await consulta({ startDate: ult, endDate: iso(Date.parse(`${ult}T00:00:00Z`) + 6 * DIA), dimensions: ["query", "page", "country"], rowLimit: 2000 })).map(filaConsulta) : [];
  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), propiedad: sitio, hasta, semanas, semanas_por_pais: porPais, consultas, consultas_semana: ult ? { semana: ult, filas: consultasSemana } : null }, null, 1) + "\n");
  console.log(`Search Console para palabras clave: ${semanas.length} semanas, ${consultas.length} búsquedas (28 días), ${consultasSemana.length} en la semana ${ult ?? "—"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => console.log(`::warning::Search Console para palabras clave: no se pudo consultar (${e.message}); queda el fichero anterior.`));
}
