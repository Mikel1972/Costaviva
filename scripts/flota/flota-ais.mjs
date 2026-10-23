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
// Fase 2 (2026-10-22, aprobada por Mikel: "cada pez tiene su momento"): cada
// fila lleva la HORA de la escucha (en punto, UTC) y, al acabar, el robot
// recalcula flota_zonas, lo único que lee la app: barcos DISTINTOS por celda
// en las últimas 24 h ("24h") y en las 24 h anteriores ("ayer"), por clase
// de eslora y "todas", solo celdas con MIN_BARCOS_CELDA (3) o más. Lo lanza
// pg_cron cada 2 h (migración 20261022120000_flota_zonas_dia.sql).
// Flota PARADA (2026-10-23, pedido de Mikel): de la ÚLTIMA escucha, los
// pesqueros con velocidad mediana < 0,5 nudos se cuentan en el puerto
// conocido a menos de 2 km (scripts/flota/puertos.json + las lonxas de
// scripts/lonjas/lonjas-galicia.json) o, si no hay puerto cerca, por celda
// de 0,05° en el mar. Solo puertos y celdas con 3 barcos o más, sin
// desglose por eslora (así no hay restas que delaten a nadie). Tabla
// flota_parados (migración 20261023130000_flota_parados.sql).
// Histórico (2026-10-23): además, flota_zonas_dia guarda cada DÍA de Madrid
// (hoy y ayer se recalculan en cada escucha; 60 días) para el ▶️ de 14 días.
//
// Uso: AISSTREAM_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/flota/flota-ais.mjs
//      [--minutos 20]
// Lo puro (sin red) se prueba en test/flota-ais.test.js.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
export const AIS_URL = "wss://stream.aisstream.io/v0/stream";
// Cantábrico y Galicia (fase 1). [[lat, lon] esquina SO, [lat, lon] esquina NE].
export const CAJA = [[42.0, -10.0], [44.8, -1.3]];
export const PASO_CELDA = 0.05;
export const SOG_FAENA = [0.5, 5];
export const MIN_POSICIONES = 3;
export const DIAS_CONSERVAR = 60;
export const TIPO_PESQUERO = 30;
// Privacidad: una celda solo se publica con al menos 3 barcos distintos.
export const MIN_BARCOS_CELDA = 3;
export const CLASES_ZONA = ["<24", "24-40", ">40"];
const HORA_MS = 3600_000;

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

// ---- Flota parada (2026-10-23) ----
export const SOG_PARADO = 0.5;
export const RADIO_PUERTO_KM = 2;

// posiciones -> [lat, lon] medianas si el barco está PARADO (al menos 3
// posiciones y velocidad mediana < 0,5 nudos), si no null.
export function posicionParado(posiciones) {
  const validas = (posiciones || []).filter((p) => Number.isFinite(p.sog) && p.sog < 102 && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (validas.length < MIN_POSICIONES) return null;
  if (mediana(validas.map((p) => p.sog)) >= SOG_PARADO) return null;
  return [mediana(validas.map((p) => p.lat)), mediana(validas.map((p) => p.lon))];
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// El puerto más cercano a menos de radio km, o null.
export function puertoCercano(lat, lon, puertos, radio = RADIO_PUERTO_KM) {
  let mejor = null, dMejor = Infinity;
  for (const p of puertos) {
    const d = distanciaKm(lat, lon, p.lat, p.lon);
    if (d <= radio && d < dMejor) { mejor = p; dMejor = d; }
  }
  return mejor;
}

// Puertos de la caja: los de puertos.json + las lonxas de Galicia con
// coordenadas (id "gal-<id>"). Todos aproximados (~1 km).
export function cargarPuertos() {
  const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
  const propios = leer("./puertos.json").puertos;
  const galicia = leer("../lonjas/lonjas-galicia.json").lonjas
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon))
    .map((l) => ({ id: `gal-${l.id}`, nombre: l.nombre.replace(/\.$/, ""), zona: "Galicia", lat: l.lat, lon: l.lon }));
  // Solo los de dentro de la caja del AIS (A Guarda, p. ej., queda al sur).
  const dentro = (x) => x.lat >= CAJA[0][0] && x.lat <= CAJA[1][0] && x.lon >= CAJA[0][1] && x.lon <= CAJA[1][1];
  return [...propios, ...galicia].filter(dentro);
}

const esPesquero = (b, conocida) => b.tipo === TIPO_PESQUERO || (b.tipo == null && !!conocida);

// Flota parada de UNA escucha -> filas de flota_parados: por puerto (a
// menos de 2 km) o por celda en el mar, barcos DISTINTOS, solo >= min.
// Nunca devuelve barcos ni posiciones de barcos: la del puerto o la celda.
export function paradosDeEscucha(barcos, clasesConocidas, clave, puertos, escucha, min = MIN_BARCOS_CELDA) {
  const grupos = new Map(); // clave -> { fila, barcos: Set }
  for (const [mmsi, b] of Object.entries(barcos)) {
    const barco = resumenBarco(mmsi, clave);
    if (!esPesquero(b, clasesConocidas[barco])) continue;
    const pos = posicionParado(b.posiciones);
    if (!pos) continue;
    const puerto = puertoCercano(pos[0], pos[1], puertos);
    let k, base;
    if (puerto) {
      k = `puerto:${puerto.id}`;
      base = { clave: k, tipo: "puerto", puerto: puerto.nombre, lat: puerto.lat, lon: puerto.lon };
    } else {
      const [la, lo] = celda(pos[0], pos[1]);
      k = `mar:${la.toFixed(2)},${lo.toFixed(2)}`;
      base = { clave: k, tipo: "mar", puerto: null, lat: la, lon: lo };
    }
    if (!grupos.has(k)) grupos.set(k, { base, barcos: new Set() });
    grupos.get(k).barcos.add(barco);
  }
  return [...grupos.values()].filter((g) => g.barcos.size >= min)
    .map((g) => ({ ...g.base, n_barcos: g.barcos.size, escucha }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
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

// Hora en punto (UTC) de un instante, en ISO: la "hora" de la escucha.
export const horaEnPunto = (fecha) => new Date(Math.floor(fecha.getTime() / HORA_MS) * HORA_MS).toISOString();

// Junta lo escuchado: { [mmsi]: { tipo, clase, posiciones } } + clases ya
// conocidas de otras escuchas ({ [barco]: clase }) -> filas para flota_faena.
// hora: horaEnPunto() del comienzo de la escucha (fase 2).
export function filasDeFaena(barcos, clasesConocidas, clave, dia, hora) {
  const filas = [], nuevas = [];
  for (const [mmsi, b] of Object.entries(barcos)) {
    const barco = resumenBarco(mmsi, clave);
    const conocida = clasesConocidas[barco];
    const pesquero = b.tipo === TIPO_PESQUERO || (b.tipo == null && conocida);
    if (!pesquero) continue;
    const clase = b.clase && b.clase !== "?" ? b.clase : conocida || "?";
    if (b.tipo === TIPO_PESQUERO && clase !== conocida) nuevas.push({ barco, clase, visto: dia });
    const c = celdaDeFaena(b.posiciones || []);
    if (c) filas.push({ dia, ...(hora ? { hora } : {}), celda_lat: c[0], celda_lon: c[1], clase, barco });
  }
  return { filas, nuevas };
}

// Zonas calientes para la app (flota_zonas) a partir de las filas de
// flota_faena de las últimas 48 h ({ hora, celda_lat, celda_lon, barco, clase }).
// "24h": hora > ahora - 24 h; "ayer": de ahora - 48 h (excluida) a ahora - 24 h.
// La clase de cada barco es la más reciente conocida (clases: { [barco]:
// clase }, de flota_barcos), si no la de la fila. Cuenta barcos DISTINTOS por
// celda (un barco visto en 5 escuchas en la misma celda cuenta 1) y solo
// devuelve celdas con min barcos o más, por clase y "todas" (en "todas"
// entran también los de eslora desconocida). Nunca devuelve barcos.
// Contra la resta (2026-10-22): una fila de clase solo sale si "todas" menos
// esa clase es 0 o >= min, y lo que queda de "todas" tras restar TODAS las
// clases publicadas también; si no, se quitan clases (la más pequeña
// primero). Así "todas = 4, <24 = 3" no delata que había 1 barco de otra
// eslora. La fila "todas" se queda siempre.
export function zonasDeFaena(filas, clases, ahora, min = MIN_BARCOS_CELDA) {
  const t = ahora.getTime();
  const zonas = agregarCeldas(filas, clases, (h) => {
    if (h > t) return null;
    const edad = t - h;
    return edad < 24 * HORA_MS ? "24h" : edad < 48 * HORA_MS ? "ayer" : null;
  }, min).map(({ grupo, ...z }) => ({ periodo: grupo, ...z, especie_probable: null, calculado: ahora.toISOString() }));
  const orden = { "24h": 0, ayer: 1 };
  return zonas.sort((a, b) => orden[a.periodo] - orden[b.periodo] || a.celda_lat - b.celda_lat || a.celda_lon - b.celda_lon || a.clase.localeCompare(b.clase));
}

// Día de calendario de Madrid (YYYY-MM-DD) de un instante: el "día" del
// histórico (el de la gente que pesca en España y Portugal; el de UTC
// partiría la noche a la 01:00/02:00 hora local).
// Madrid a propósito: el día del histórico es el de Madrid para toda la
// flota (la caja del AIS es Cantábrico y Galicia), no la zona de un spot.
const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
export const diaMadrid = (fecha) => FORMATO_DIA.format(fecha);

// Histórico diario (flota_zonas_dia): las zonas de HOY y AYER (días de
// Madrid) con las filas de las últimas ~50 h. Mismo umbral y misma regla
// contra la resta que zonasDeFaena. Devuelve { dias, zonas }: los días
// recalculados (para borrar lo que deje de cumplir el umbral) y las filas.
export function zonasPorDia(filas, clases, ahora, min = MIN_BARCOS_CELDA) {
  const hoy = diaMadrid(ahora);
  const ayer = diaMadrid(new Date(Date.parse(`${hoy}T12:00:00Z`) - 24 * HORA_MS));
  const dias = [ayer, hoy];
  const t = ahora.getTime();
  const zonas = agregarCeldas(filas, clases, (h) => {
    if (h > t) return null;
    const d = diaMadrid(new Date(h));
    return dias.includes(d) ? d : null;
  }, min).map(({ grupo, ...z }) => ({ dia: grupo, ...z, especie_probable: null, calculado: ahora.toISOString() }));
  zonas.sort((a, b) => a.dia.localeCompare(b.dia) || a.celda_lat - b.celda_lat || a.celda_lon - b.celda_lon || a.clase.localeCompare(b.clase));
  return { dias, zonas };
}

// Lo común: barcos DISTINTOS por grupo (periodo o día), celda y clase, con
// el umbral y la regla contra la resta. grupoDe(ms) -> grupo o null.
function agregarCeldas(filas, clases, grupoDe, min) {
  const grupos = new Map(); // "grupo|lat|lon|clase" -> Set(barco)
  const sumar = (clave, barco) => { if (!grupos.has(clave)) grupos.set(clave, new Set()); grupos.get(clave).add(barco); };
  for (const f of filas) {
    const h = Date.parse(f.hora);
    if (!Number.isFinite(h)) continue;
    const grupo = grupoDe(h);
    if (!grupo) continue;
    const lat = Number(f.celda_lat), lon = Number(f.celda_lon);
    const clase = clases[f.barco] && clases[f.barco] !== "?" ? clases[f.barco] : f.clase;
    sumar(`${grupo}|${lat}|${lon}|todas`, f.barco);
    if (CLASES_ZONA.includes(clase)) sumar(`${grupo}|${lat}|${lon}|${clase}`, f.barco);
  }
  const zonas = [];
  const restoValido = (r) => r === 0 || r >= min;
  for (const [k, barcos] of grupos) {
    const [grupo, lat, lon, clase] = k.split("|");
    if (clase !== "todas" || barcos.size < min) continue;
    const total = barcos.size;
    const base = { grupo, celda_lat: Number(lat), celda_lon: Number(lon) };
    zonas.push({ ...base, clase: "todas", n_barcos: total });
    let clasesCelda = CLASES_ZONA
      .map((c) => ({ clase: c, n: grupos.get(`${grupo}|${lat}|${lon}|${c}`)?.size || 0 }))
      .filter((c) => c.n >= min && restoValido(total - c.n))
      .sort((a, b) => b.n - a.n);
    while (clasesCelda.length && !restoValido(total - clasesCelda.reduce((s, c) => s + c.n, 0))) clasesCelda = clasesCelda.slice(0, -1);
    for (const c of clasesCelda) zonas.push({ ...base, clase: c.clase, n_barcos: c.n });
  }
  return zonas;
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

// PostgREST devuelve como mucho 1000 filas por petición (max-rows de
// Supabase): se pide por páginas hasta que llega una incompleta.
async function leerTodo(ruta, pagina = 1000) {
  const todo = [];
  for (let desde = 0; ; desde += pagina) {
    const filas = await (await supabase(`${ruta}&limit=${pagina}&offset=${desde}`)).json();
    todo.push(...filas);
    if (filas.length < pagina) return todo;
  }
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
  const inicio = new Date();
  const dia = inicio.toISOString().slice(0, 10);
  const hora = horaEnPunto(inicio);

  const conocidas = Object.fromEntries((await leerTodo("flota_barcos?select=barco,clase&order=barco")).map((r) => [r.barco, r.clase]));
  const { barcos, mensajes } = await escuchar(minutos, apiKey);
  const { filas, nuevas } = filasDeFaena(barcos, conocidas, clave, dia, hora);
  if (nuevas.length) await supabase("flota_barcos?on_conflict=barco", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(nuevas) });
  if (filas.length) await supabase("flota_faena?on_conflict=hora,celda_lat,celda_lon,barco", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(filas) });
  const corte = new Date(Date.now() - DIAS_CONSERVAR * 864e5).toISOString().slice(0, 10);
  await supabase(`flota_faena?dia=lt.${corte}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // Zonas para la app (fase 2): se recalculan con las últimas 48 h; primero
  // se escriben las nuevas y luego se borran las de cálculos anteriores, para
  // que el mapa nunca vea la tabla vacía a medias.
  const ahora = new Date();
  for (const n of nuevas) conocidas[n.barco] = n.clase;
  // 50 h: cubre las 24 h + ayer y el día de ayer de Madrid entero.
  const desde = encodeURIComponent(new Date(ahora.getTime() - 50 * HORA_MS).toISOString());
  const recientes = await leerTodo(`flota_faena?select=hora,celda_lat,celda_lon,barco,clase&hora=gt.${desde}&order=hora,celda_lat,celda_lon,barco`);
  const zonas = zonasDeFaena(recientes, conocidas, ahora);
  if (zonas.length) await supabase("flota_zonas?on_conflict=periodo,celda_lat,celda_lon,clase", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(zonas) });
  await supabase(`flota_zonas?calculado=lt.${encodeURIComponent(ahora.toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // Histórico diario (▶️ de 14 días): hoy y ayer (días de Madrid), igual:
  // primero lo nuevo, luego se borra lo viejo de esos dos días; y lo de más
  // de 60 días.
  const { dias, zonas: zonasDia } = zonasPorDia(recientes, conocidas, ahora);
  if (zonasDia.length) await supabase("flota_zonas_dia?on_conflict=dia,celda_lat,celda_lon,clase", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(zonasDia) });
  await supabase(`flota_zonas_dia?dia=in.(${dias.join(",")})&calculado=lt.${encodeURIComponent(ahora.toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabase(`flota_zonas_dia?dia=lt.${corte}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // Flota parada de ESTA escucha (foto, no 24 h): lo nuevo y luego se borra
  // lo de escuchas anteriores.
  const parados = paradosDeEscucha(barcos, conocidas, clave, cargarPuertos(), ahora.toISOString());
  if (parados.length) await supabase("flota_parados?on_conflict=clave", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(parados) });
  await supabase(`flota_parados?escucha=lt.${encodeURIComponent(ahora.toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // Solo totales en el registro (repo público): nunca celdas ni barcos.
  const pesqueros = Object.entries(barcos).filter(([m, b]) => b.tipo === TIPO_PESQUERO || (b.tipo == null && conocidas[resumenBarco(m, clave)])).length;
  const porClase = filas.reduce((a, f) => ((a[f.clase] = (a[f.clase] || 0) + 1), a), {});
  console.log(`${minutos} min: ${mensajes} mensajes, ${Object.keys(barcos).length} barcos, ${pesqueros} pesqueros, ${filas.length} faenando ${JSON.stringify(porClase)}.`);
  // Solo cuántas celdas se publican, nunca cuáles.
  const celdasPublicadas = (p) => zonas.filter((z) => z.periodo === p && z.clase === "todas").length;
  console.log(`Zonas publicadas (>= ${MIN_BARCOS_CELDA} barcos): ${celdasPublicadas("24h")} celdas en las últimas 24 h, ${celdasPublicadas("ayer")} ayer; histórico de hoy: ${zonasDia.filter((z) => z.dia === dias[1] && z.clase === "todas").length} celdas.`);
  console.log(`Flota parada (>= ${MIN_BARCOS_CELDA} barcos): ${parados.filter((p) => p.tipo === "puerto").length} puertos, ${parados.filter((p) => p.tipo === "mar").length} celdas en el mar.`);
  if (!mensajes) throw new Error("aisstream no mandó ningún mensaje.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
