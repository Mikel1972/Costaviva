// scripts/oleaje-camaras/examen-olas.mjs — examen diario de la ola que enseña
// la app (2026-11-20, Mikel: «son varios días con errores en las alturas de
// las olas… no puedo revisar todas una a una… podemos dar un margen de 0,3
// pero no más… la máxima tiene que ser la fiabilidad»).
//
// Sin IA, en cada pasada del robot de las cámaras (espuma-camaras.yml):
//   1. FOTO de lo que enseña /prevision ahora para cada spot con cámara
//      propia (datos-robots/oleaje-camaras/mostrado/AAAA-MM-DD.jsonl, 14 días);
//   2. EXAMEN: cada etiqueta de foto (rutina de etiquetado de Claude y
//      «ola real que veo» de los usuarios, sin confianza baja) se compara con
//      lo que se enseñaba a esa hora (±45 min). Error = cuánto se sale el
//      centro de lo enseñado de la banda etiquetada (0 si cae dentro).
//      Suspenso: error > TOLERANCIA_M (0,3 m);
//   3. RESULTADO en datos-robots/oleaje-camaras/examen.json (por cámara:
//      exámenes, suspensos, error medio, racha de suspensos) y ::warning:: de
//      cada suspenso de las últimas 24 h;
//   4. CASTIGO: una cámara con RACHA_SUSPENSO suspensos seguidos deja de
//      usarse en /prevision (functions/_lib/examen-olas-datos.js) hasta que
//      apruebe de nuevo: el spot pasa a modelo × coeficiente.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTE_POR_SPOT, BANDAS_OLA } from "../../functions/_lib/oleaje-camaras.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(RAIZ, "datos-robots", "oleaje-camaras");
export const DIR_MOSTRADO = join(DIR, "mostrado");
export const FICHERO_EXAMEN = join(DIR, "examen.json");
export const FICHERO_ETIQUETAS_CLAUDE = join(DIR, "etiquetas-claude.jsonl");
export const FICHERO_SUSPENDIDAS = join(RAIZ, "functions", "_lib", "examen-olas-datos.js");
export const TOLERANCIA_M = 0.3, VENTANA_MIN = 45, RACHA_SUSPENSO = 3, DIAS = 14;
const URLS = ["https://costaviva.org/prevision", "https://costaviva.org/prevision?region=nz"];
const CABECERA = "// Generado por scripts/oleaje-camaras/examen-olas.mjs. No editar a mano.\n// Cámaras suspendidas: /prevision no las usa hasta que vuelvan a aprobar.\nexport default ";

// Cuánto se sale el centro de lo enseñado [a, b] de la banda etiquetada.
export function errorContraBanda(mostrado, bandaId) {
  const banda = BANDAS_OLA.find((x) => x.id === bandaId);
  if (!banda || !Array.isArray(mostrado) || !Number.isFinite(mostrado[0]) || !Number.isFinite(mostrado[1])) return null;
  const c = (mostrado[0] + mostrado[1]) / 2;
  if (c < banda.min) return +(banda.min - c).toFixed(2);
  if (banda.max !== null && c > banda.max) return +(c - banda.max).toFixed(2);
  return 0;
}

// Foto de /prevision: para cada spot con cámara propia, el bloque de ahora.
export function capturas(prevision, ahora = Date.now()) {
  const fecha = new Date(ahora).toISOString();
  return (prevision?.spots || []).flatMap((s) => {
    const f = FUENTE_POR_SPOT[s?.slug];
    const b = s?.bloques?.[0];
    if (!f?.propia || !Array.isArray(b?.altura)) return [];
    return [{ fecha, camara: f.camara, spot: s.slug, altura: b.altura, fuente: b.fuenteAltura || "modelo" }];
  });
}

// Etiquetas -> { fecha, camara, banda, por } (sin «no se sabe» ni confianza baja).
export function etiquetasValidas(claude, usuarios) {
  const out = [];
  for (const e of claude || []) {
    if (!e?.camara || !BANDAS_OLA.some((b) => b.id === e.banda) || e.confianza === "baja" || e.encuadre !== "principal") continue;
    out.push({ fecha: e.fecha, camara: e.camara, banda: e.banda, por: "claude" });
  }
  for (const e of usuarios || []) {
    const f = FUENTE_POR_SPOT[e?.spot_slug];
    if (!f?.propia || !BANDAS_OLA.some((b) => b.id === e.banda)) continue;
    out.push({ fecha: e.observado_en, camara: f.camara, banda: e.banda, por: e.origen || "usuario" });
  }
  return out;
}

export function examinar(etiquetas, mostrados, ahora = Date.now()) {
  const porCam = {};
  for (const m of mostrados || []) (porCam[m.camara] ||= []).push({ ...m, t: Date.parse(m.fecha) });
  const filas = [];
  for (const e of etiquetas || []) {
    const t = Date.parse(e.fecha);
    let mejor = null;
    for (const m of porCam[e.camara] || []) {
      const d = Math.abs(m.t - t);
      if (d <= VENTANA_MIN * 60e3 && (!mejor || d < mejor.d)) mejor = { m, d };
    }
    if (!mejor) continue;
    const error = errorContraBanda(mejor.m.altura, e.banda);
    if (error === null) continue;
    filas.push({ fecha: e.fecha, camara: e.camara, spot: mejor.m.spot, banda: e.banda, mostrado: mejor.m.altura, fuente: mejor.m.fuente, error, suspenso: error > TOLERANCIA_M, por: e.por });
  }
  filas.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
  const camaras = {};
  for (const f of filas) {
    const c = (camaras[f.camara] ||= { spot: f.spot, examenes: 0, suspensos: 0, errorMedio: 0, racha: 0, ultimos: [] });
    c.examenes++;
    c.errorMedio += f.error;
    if (f.suspenso) { c.suspensos++; c.racha++; } else c.racha = 0;
    c.ultimos.push({ fecha: f.fecha, banda: f.banda, mostrado: f.mostrado, error: f.error });
  }
  for (const c of Object.values(camaras)) {
    c.errorMedio = +(c.errorMedio / c.examenes).toFixed(2);
    c.ultimos = c.ultimos.slice(-5);
  }
  const suspendidas = Object.entries(camaras).filter(([, c]) => c.racha >= RACHA_SUSPENSO).map(([id]) => id).sort();
  const desde = ahora - 86400e3;
  return {
    generado: new Date(ahora).toISOString(),
    tolerancia: TOLERANCIA_M,
    resumen: { examenes: filas.length, suspensos: filas.filter((f) => f.suspenso).length },
    suspensos24h: filas.filter((f) => f.suspenso && Date.parse(f.fecha) >= desde),
    suspendidas,
    camaras,
  };
}

const leerJsonl = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
export const textoSuspendidas = (lista) => CABECERA + JSON.stringify(lista) + ";\n";

async function etiquetasUsuarios(desdeIso) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return [];
  const url = `https://imncbmizxkorotpeisic.supabase.co/rest/v1/oleaje_etiquetas?select=origen,banda,spot_slug,observado_en&observado_en=gte.${encodeURIComponent(desdeIso)}&spot_slug=not.is.null&limit=5000`;
  try {
    const r = await fetch(url, { headers: { apikey: clave, authorization: `Bearer ${clave}` } });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

async function main() {
  const ahora = Date.now();
  mkdirSync(DIR_MOSTRADO, { recursive: true });
  const dia = new Date(ahora).toISOString().slice(0, 10);
  for (const u of URLS) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "costaviva-robot-examen" } });
      if (!r.ok) { console.log(`::warning::${u}: HTTP ${r.status}`); continue; }
      const filas = capturas(await r.json(), ahora);
      if (filas.length) appendFileSync(join(DIR_MOSTRADO, `${dia}.jsonl`), filas.map((x) => JSON.stringify(x)).join("\n") + "\n");
    } catch (e) { console.log(`::warning::${u}: ${e.message}`); }
  }
  const limite = new Date(ahora - DIAS * 86400e3).toISOString().slice(0, 10);
  const ficheros = readdirSync(DIR_MOSTRADO).filter((n) => n.endsWith(".jsonl")).sort();
  for (const n of ficheros) if (n.slice(0, 10) < limite) unlinkSync(join(DIR_MOSTRADO, n));
  const mostrados = ficheros.filter((n) => n.slice(0, 10) >= limite).flatMap((n) => leerJsonl(join(DIR_MOSTRADO, n)));
  const desdeIso = new Date(ahora - DIAS * 86400e3).toISOString();
  const claude = leerJsonl(FICHERO_ETIQUETAS_CLAUDE).filter((e) => Date.parse(e.fecha) >= Date.parse(desdeIso));
  const resultado = examinar(etiquetasValidas(claude, await etiquetasUsuarios(desdeIso)), mostrados, ahora);
  writeFileSync(FICHERO_EXAMEN, JSON.stringify(resultado, null, 1) + "\n");
  const nuevo = textoSuspendidas(resultado.suspendidas);
  if (!existsSync(FICHERO_SUSPENDIDAS) || readFileSync(FICHERO_SUSPENDIDAS, "utf8") !== nuevo) writeFileSync(FICHERO_SUSPENDIDAS, nuevo);
  for (const f of resultado.suspensos24h) console.log(`::warning::Ola mal en ${f.spot} (${f.fecha.slice(0, 16)}): enseñábamos ${f.mostrado.join("–")} m y la foto era ${f.banda} m (error ${f.error} m > ${TOLERANCIA_M})`);
  for (const c of resultado.suspendidas) console.log(`::warning::Cámara ${c} suspendida (${RACHA_SUSPENSO} suspensos seguidos): /prevision usa el modelo en su spot hasta que vuelva a aprobar`);
  console.log(`Examen: ${resultado.resumen.examenes} exámenes, ${resultado.resumen.suspensos} suspensos; suspendidas: ${resultado.suspendidas.join(", ") || "ninguna"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
