// scripts/flota/flota-ais.mjs
// Flota pesquera faenando, fase 1 (2026-10-20, Mikel: "por el AIS sabemos
// dónde está la flota y dónde está faenando... zonas calientes por tipo de
// barco"). Sin IA. Lo lanza .github/workflows/flota-ais.yml.
//
// Escucha el AIS de aisstream.io (gratis, WebSocket) ESCUCHA_MIN minutos en
// la caja del Cantábrico y Galicia y, por cada PESQUERO (tipo AIS 30):
//   - su clase de eslora (A+B del mensaje estático): <24, 24-40, >40 m;
//   - si ha FAENADO: al menos 3 posiciones con la velocidad mediana entre
//     0,5 y 5 nudos (arrastre, cerco cerrando, palangre: despacio; amarrado
//     da 0 y navegando más de 7);
//   - la celda de 0,05° (~5 km) de su posición mediana.
// Guarda en Supabase (flota_faena) "este barco faenó este día en esta
// celda", con el barco como HMAC del MMSI: ni nombre, ni MMSI, ni ruta.
// En el registro (el repo es público) solo salen totales, nunca celdas.
//
// Uso: AISSTREAM_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/flota/flota-ais.mjs
//      [--minutos 20]
// Lo puro (sin red) se prueba en test/flota-ais.test.js.

import { createHmac } from "node:crypto";

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
export const AIS_URL = "wss://stream.aisstream.io/v0/stream";
// Cantábrico y Galicia (fase 1). [[lat, lon] esquina SO, [lat, lon] esquina NE].
export const CAJA = [[42.0, -10.0], [44.8, -1.3]];
export const PASO_CELDA = 0.05;
export const SOG_FAENA = [0.5, 5];
export const MIN_POSICIONES = 3;
export const DIAS_CONSERVAR = 60;
export const TIPO_PESQUERO = 30;

export function claseEslora(a, b) {
  const l = (Number(a) || 0) + (Number(b) || 0);
  if (!l || l >= 511) return "?";
  return l < 24 ? "<24" : l < 40 ? "24-40" : ">40";
}

export function celda(lat, lon, paso = PASO_CELDA) {
  const f = (v) => +(Math.floor(v / paso + 1e-9) * paso).toFixed(2);
  return [f(lat), f(lon)];
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// posiciones: [{ lat, lon, sog }]. Devuelve la celda donde faena o null.
export function celdaDeFaena(posiciones) {
  const validas = posiciones.filter((p) => Number.isFinite(p.sog) && p.sog < 102 && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (validas.length < MIN_POSICIONES) return null;
  const sog = mediana(validas.map((p) => p.sog));
  if (sog < SOG_FAENA[0] || sog > SOG_FAENA[1]) return null;
  return celda(mediana(validas.map((p) => p.lat)), mediana(validas.map((p) => p.lon)));
}

export const resumenBarco = (mmsi, clave) => createHmac("sha256", clave).update(String(mmsi)).digest("hex").slice(0, 24);

// Un mensaje de aisstream.io -> { mmsi, tipo?, clase?, pos? }.
export function leerMensaje(m) {
  const mmsi = m?.MetaData?.MMSI;
  if (!mmsi) return null;
  const msg = m.Message || {};
  if (m.MessageType === "ShipStaticData") {
    const s = msg.ShipStaticData || {};
    return { mmsi, tipo: s.Type, clase: claseEslora(s.Dimension?.A, s.Dimension?.B) };
  }
  if (m.MessageType === "StaticDataReport") {
    const r = msg.StaticDataReport?.ReportB;
    if (!r || !msg.StaticDataReport?.Valid) return { mmsi };
    return { mmsi, tipo: r.ShipType, clase: claseEslora(r.Dimension?.A, r.Dimension?.B) };
  }
  const p = msg.PositionReport || msg.StandardClassBPositionReport || msg.ExtendedClassBPositionReport;
  if (p) return { mmsi, pos: { lat: p.Latitude, lon: p.Longitude, sog: p.Sog } };
  return { mmsi };
}

// Junta lo escuchado: { [mmsi]: { tipo, clase, posiciones } } + clases ya
// conocidas de otras escuchas ({ [barco]: clase }) -> filas para flota_faena.
export function filasDeFaena(barcos, clasesConocidas, clave, dia) {
  const filas = [], nuevas = [];
  for (const [mmsi, b] of Object.entries(barcos)) {
    const barco = resumenBarco(mmsi, clave);
    const conocida = clasesConocidas[barco];
    const pesquero = b.tipo === TIPO_PESQUERO || (b.tipo == null && conocida);
    if (!pesquero) continue;
    const clase = b.clase && b.clase !== "?" ? b.clase : conocida || "?";
    if (b.tipo === TIPO_PESQUERO && clase !== conocida) nuevas.push({ barco, clase, visto: dia });
    const c = celdaDeFaena(b.posiciones || []);
    if (c) filas.push({ dia, celda_lat: c[0], celda_lon: c[1], clase, barco });
  }
  return { filas, nuevas };
}

async function supabase(ruta, opciones = {}) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, "content-type": "application/json", ...(opciones.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} ${ruta.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

function escuchar(minutos, apiKey) {
  return new Promise((resolver, rechazar) => {
    const barcos = {};
    let n = 0;
    const ws = new WebSocket(AIS_URL);
    const fin = setTimeout(() => ws.close(), minutos * 60_000);
    ws.onopen = () => ws.send(JSON.stringify({
      APIKey: apiKey, BoundingBoxes: [CAJA],
      FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"],
    }));
    ws.onmessage = async (e) => {
      n++;
      let m;
      try { m = JSON.parse(typeof e.data === "string" ? e.data : await e.data.text()); } catch { return; }
      if (m.error) { clearTimeout(fin); ws.close(); return rechazar(new Error(`aisstream: ${m.error}`)); }
      const l = leerMensaje(m);
      if (!l) return;
      const b = (barcos[l.mmsi] ||= { posiciones: [] });
      if (l.tipo != null) b.tipo = l.tipo;
      if (l.clase && l.clase !== "?") b.clase = l.clase;
      if (l.pos) b.posiciones.push(l.pos);
    };
    ws.onerror = (e) => { clearTimeout(fin); rechazar(new Error(`WebSocket: ${e.message || "error"}`)); };
    ws.onclose = () => { clearTimeout(fin); resolver({ barcos, mensajes: n }); };
  });
}

async function main() {
  const apiKey = (process.env.AISSTREAM_API_KEY || "").trim();
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!apiKey) throw new Error("Falta el secret AISSTREAM_API_KEY (cuenta gratis en aisstream.io).");
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  const i = process.argv.indexOf("--minutos");
  const minutos = i > -1 ? Number(process.argv[i + 1]) : 20;
  const dia = new Date().toISOString().slice(0, 10);

  const conocidas = Object.fromEntries((await (await supabase("flota_barcos?select=barco,clase&limit=100000")).json()).map((r) => [r.barco, r.clase]));
  const { barcos, mensajes } = await escuchar(minutos, apiKey);
  const { filas, nuevas } = filasDeFaena(barcos, conocidas, clave, dia);
  if (nuevas.length) await supabase("flota_barcos?on_conflict=barco", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(nuevas) });
  if (filas.length) await supabase("flota_faena?on_conflict=dia,celda_lat,celda_lon,barco", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(filas) });
  const corte = new Date(Date.now() - DIAS_CONSERVAR * 864e5).toISOString().slice(0, 10);
  await supabase(`flota_faena?dia=lt.${corte}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // Solo totales en el registro (repo público): nunca celdas ni barcos.
  const pesqueros = Object.entries(barcos).filter(([m, b]) => b.tipo === TIPO_PESQUERO || (b.tipo == null && conocidas[resumenBarco(m, clave)])).length;
  const porClase = filas.reduce((a, f) => ((a[f.clase] = (a[f.clase] || 0) + 1), a), {});
  console.log(`${minutos} min: ${mensajes} mensajes, ${Object.keys(barcos).length} barcos, ${pesqueros} pesqueros, ${filas.length} faenando ${JSON.stringify(porClase)}.`);
  if (!mensajes) throw new Error("aisstream no mandó ningún mensaje.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
