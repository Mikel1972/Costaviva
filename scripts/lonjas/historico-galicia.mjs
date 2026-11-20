// scripts/lonjas/historico-galicia.mjs
// Histórico de primera venta en las lonjas de BAJURA de Galicia (2026-11-20,
// fase 1 de los patrones de especie; Mikel: «nos sirve para… establecer
// patrones de temperatura, horas de luz, etc. de cada especie. Los de bajura
// pescan en la zona»). Sin IA y sin base de datos: baja día a día lo vendido
// desde 2002 (lo más antiguo con datos en la fuente) y lo guarda resumido en
// datos/lonjas/galicia/<año>.csv.gz, uno por año (comprimido: ~90.000 filas
// por año).
//
// Qué se guarda: por día, ZONA costera de bajura (campo zona de
// lonjas-galicia.json) y especie, los kg y euros de PECES y CEFALÓPODOS (lo
// que interesa a quien pesca con caña). Fuera las lonjas de altura (zona
// null: Vigo, Marín, Lonja Coruña S.A., Burela y Celeiro), que venden lo
// pescado lejos, y el mercado de Pontevedra, que no es un puerto. Nombres de especie y grupo tal cual la fuente, números sin
// tocar (solo sumados por zona): no se desnaturaliza el dato.
// Fonte: Xunta de Galicia – pescadegalicia.gal (aviso legal: reutilización
// permitida citando la fuente). Va en datos/lonjas/galicia/LEEME.md.
//
// Sin cargar a la Xunta: una petición cada PAUSA_MS, como mucho
// --max-dias días por pasada (lonjas-historico.yml, de noche), del año más
// reciente al más antiguo. estado.json dice qué años están completos y qué
// días fallaron (se reintentan en la pasada siguiente). El año en curso se
// completa hasta hace 3 días (Vigo a veces llega tarde).
//
// Uso: node scripts/lonjas/historico-galicia.mjs [--max-dias 800] [--probar]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { sesion, bajarDia, unificar, CITA } from "./galicia.mjs";

export const ANO_INICIO = 2002; // julio de 2001 sale vacío; 2002 ya tiene ventas
export const GRUPOS = ["Peixes", "Cefalópodos"];
export const PAUSA_MS = 1200;
export const DIR = new URL("../../datos/lonjas/galicia/", import.meta.url);
export const CABECERA = "fecha,zona,grupo,especie,kg,importe";

const redondear = (n) => Math.round(n * 100) / 100;

export function zonasDeLonjas(catalogo) {
  return new Map(catalogo.lonjas.map((l) => [l.nombre, l.zona ?? null]));
}

// Filas de un día (las de galicia.mjs) -> filas del histórico por zona y
// especie. Devuelve también las lonjas que no están en el catálogo (para
// avisar: hay que darles zona) y cuántos kg se han dejado fuera por ser de
// altura, para el registro.
export function agregarDia(filas, zonas) {
  const porClave = new Map();
  const desconocidas = new Set();
  let kgAltura = 0;
  for (const f of filas) {
    if (!GRUPOS.includes(f.grupo)) continue;
    if (!zonas.has(f.lonja)) { desconocidas.add(f.lonja); continue; }
    const zona = zonas.get(f.lonja);
    if (!zona) { kgAltura += f.kg ?? 0; continue; }
    const k = `${f.fecha}|${zona}|${f.especie}`;
    const p = porClave.get(k) || { fecha: f.fecha, zona, grupo: f.grupo, especie: f.especie, kg: 0, importe: 0 };
    p.kg = redondear(p.kg + (f.kg ?? 0));
    p.importe = redondear(p.importe + (f.importe ?? 0));
    porClave.set(k, p);
  }
  const orden = (a, b) => a.fecha.localeCompare(b.fecha) || a.zona.localeCompare(b.zona) || a.especie.localeCompare(b.especie);
  return { filas: [...porClave.values()].sort(orden), desconocidas: [...desconocidas].sort(), kgAltura: Math.round(kgAltura) };
}

// CSV sin dependencias: los nombres de especie pueden llevar comas.
const campo = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const aCsv = (filas) => `${CABECERA}\n${filas.map((f) => [f.fecha, f.zona, f.grupo, f.especie, f.kg, f.importe].map(campo).join(",")).join("\n")}${filas.length ? "\n" : ""}`;
export function deCsv(texto) {
  const lineas = String(texto).split("\n").filter(Boolean);
  if (lineas[0] !== CABECERA) throw new Error("CSV del histórico con otra cabecera");
  return lineas.slice(1).map((l) => {
    const v = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { v.push(cur); cur = ""; }
      else cur += c;
    }
    v.push(cur);
    return { fecha: v[0], zona: v[1], grupo: v[2], especie: v[3], kg: Number(v[4]), importe: Number(v[5]) };
  });
}

export const diasEntre = (desde, hasta) => {
  const out = [];
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= Date.parse(`${hasta}T12:00:00Z`); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

// Qué días toca bajar en esta pasada: del año en curso, los que faltan hasta
// hace 3 días; luego los fallidos; luego los años sin completar, del más
// reciente al más antiguo. Como mucho maxDias.
export function plan(estado, hoy, maxDias) {
  const anoActual = Number(hoy.slice(0, 4));
  const tope = new Date(Date.parse(`${hoy}T12:00:00Z`) - 3 * 864e5).toISOString().slice(0, 10);
  const pendientes = [];
  const e = estado.anos || {};
  for (let ano = anoActual; ano >= ANO_INICIO; ano--) {
    const info = e[ano] || {};
    const fin = ano === anoActual ? tope : `${ano}-12-31`;
    if (fin < `${ano}-01-01`) continue;
    pendientes.push(...(info.fallidos || []));
    if (info.completo && ano !== anoActual) continue;
    const desde = info.hasta ? diasEntre(info.hasta, fin)[1] : `${ano}-01-01`;
    if (desde && desde <= fin) pendientes.push(...diasEntre(desde, fin));
  }
  return [...new Set(pendientes)].slice(0, maxDias);
}

const leerJson = (url, defecto) => (existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : defecto);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const probar = process.argv.includes("--probar");
  const i = process.argv.indexOf("--max-dias");
  const maxDias = i > -1 ? Number(process.argv[i + 1]) : 800;
  if (!(maxDias >= 1 && maxDias <= 3000)) throw new Error("--max-dias tiene que ir de 1 a 3000.");
  mkdirSync(DIR, { recursive: true });
  const catalogo = JSON.parse(readFileSync(new URL("./lonjas-galicia.json", import.meta.url), "utf8"));
  const zonas = zonasDeLonjas(catalogo);
  const urlEstado = new URL("estado.json", DIR);
  const estado = leerJson(urlEstado, { nota: "Qué años del histórico están completos. Lo escribe scripts/lonjas/historico-galicia.mjs.", anos: {} });
  const hoy = new Date().toISOString().slice(0, 10);
  const dias = plan(estado, hoy, probar ? Math.min(maxDias, 3) : maxDias);
  console.log(`Días a bajar en esta pasada: ${dias.length}${dias.length ? ` (${dias[0]} … ${dias.at(-1)})` : ""}.`);

  let s = await sesion();
  const porAno = new Map(); // año -> { filas: [], ok: Set(dias), fallidos: Set(dias) }
  const desconocidas = new Set();
  let kgAltura = 0;
  for (const dia of dias) {
    const ano = dia.slice(0, 4);
    if (!porAno.has(ano)) porAno.set(ano, { filas: [], ok: new Set(), fallidos: new Set() });
    const a = porAno.get(ano);
    let hecho = false;
    for (let intento = 1; intento <= 3 && !hecho; intento++) {
      try {
        const r = agregarDia(unificar(await bajarDia(s, dia)), zonas);
        a.filas.push(...r.filas);
        r.desconocidas.forEach((n) => desconocidas.add(n));
        kgAltura += r.kgAltura;
        a.ok.add(dia);
        hecho = true;
      } catch (e) {
        console.log(`${dia}: intento ${intento} falló (${e.message}).`);
        await dormir(5000 * intento);
        try { s = await sesion(); } catch {}
      }
    }
    if (!hecho) a.fallidos.add(dia);
    await dormir(PAUSA_MS);
  }

  for (const [ano, a] of [...porAno].sort()) {
    const url = new URL(`${ano}.csv.gz`, DIR);
    const previas = existsSync(url) ? deCsv(gunzipSync(readFileSync(url)).toString("utf8")).filter((f) => !a.ok.has(f.fecha)) : [];
    const todas = [...previas, ...a.filas].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.zona.localeCompare(y.zona) || x.especie.localeCompare(y.especie));
    const info = estado.anos[ano] || {};
    const fallidos = new Set([...(info.fallidos || [])].filter((d) => !a.ok.has(d)));
    a.fallidos.forEach((d) => fallidos.add(d));
    const conDatos = [...a.ok, ...(info.hasta ? [info.hasta] : [])].sort();
    const hasta = conDatos.at(-1);
    const fin = Number(ano) === Number(hoy.slice(0, 4)) ? null : `${ano}-12-31`;
    estado.anos[ano] = {
      hasta, fallidos: [...fallidos].sort(), completo: Boolean(fin && hasta === fin && !fallidos.size),
      filas: todas.length, kg: Math.round(todas.reduce((t, f) => t + f.kg, 0)), dias_con_ventas: new Set(todas.map((f) => f.fecha)).size,
    };
    console.log(`${ano}: ${a.ok.size} días bajados, ${a.fallidos.size} fallidos; el fichero tiene ${todas.length} filas, ${estado.anos[ano].kg} kg, ${estado.anos[ano].dias_con_ventas} días con ventas${estado.anos[ano].completo ? " (año completo)" : ""}.`);
    if (!probar) writeFileSync(url, gzipSync(aCsv(todas), { level: 9 }));
  }
  estado.actualizado = new Date().toISOString();
  if (!probar) writeFileSync(urlEstado, JSON.stringify(estado, null, 1) + "\n");
  console.log(`Fuera por ser de altura (o sin puerto): ${kgAltura} kg.`);
  if (desconocidas.size) console.log(`::warning::${desconocidas.size} lonja(s) que no están en lonjas-galicia.json (sus ventas no se cuentan): ${[...desconocidas].join("; ")}. Añadirlas con su zona.`);
  console.log(CITA);
  if (probar) console.log("Modo probar: no se escribe nada.");
  const fallidosTotal = [...porAno.values()].reduce((t, a) => t + a.fallidos.size, 0);
  if (dias.length && fallidosTotal === dias.length) throw new Error("No se ha podido bajar ningún día: ¿ha cambiado la página de la Xunta?");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
