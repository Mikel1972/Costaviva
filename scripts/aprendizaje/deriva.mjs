// scripts/aprendizaje/deriva.mjs
//
// Vigilancia de la calidad de los datos y de la deriva del índice
// (2026-10-09). Sin IA, sin red: recibe lo leído y devuelve avisos.
//
//   - frescura(): ¿siguen llegando las fuentes (cámaras, boyas, robots)?
//   - sesgoBoyas(): modelo de mar abierto frente a la boya, por boya y semana.
//   - errorCamaras(): error de calibración de cada cámara y su evolución.
//   - panelReferencia(): el índice en un panel fijo de escenarios; si un
//     cambio de pesos o reglas lo mueve mucho, se ve aquí (y frena el
//     ajuste automático).
//   - psi() (metricas.mjs) sobre el histograma del índice en spots reales.

import { indiceSpot } from "../../assets/js/ventana-actividad.js";
import { histograma } from "./metricas.mjs";

const H = 3600e3;
const mediana = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// fuentes: [{ nombre, ultima: ISO | null, cadencia_h, nota? }]
export function frescura(fuentes, ahora = Date.now()) {
  return fuentes.map((f) => {
    if (!f.ultima) return { ...f, estado: "sin_datos", horas: null };
    const horas = Math.round((ahora - Date.parse(f.ultima)) / H);
    const estado = horas <= f.cadencia_h * 1.5 ? "ok" : horas <= f.cadencia_h * 4 ? "retrasada" : "parada";
    return { ...f, horas, estado };
  });
}

// Semana ISO "AAAA-Www" de una fecha.
export function semanaISO(ms) {
  const d = new Date(ms);
  const dia = (d.getUTCDay() + 6) % 7;
  const jueves = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia + 3));
  const ene4 = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
  const sem = 1 + Math.round(((jueves - ene4) / 86400e3 - 3 + ((ene4.getUTCDay() + 6) % 7)) / 7);
  return `${jueves.getUTCFullYear()}-W${String(sem).padStart(2, "0")}`;
}

// Líneas de espuma.jsonl -> por boya y semana: mediana de (modelo / boya)
// del mar abierto, con y sin la corrección (×1,38 de Gipuzkoa). Solo pares
// con la boya a menos de 4 h de la lectura.
export function sesgoBoyas(lineas) {
  const g = new Map();
  for (const l of lineas) {
    const b = l.boya, m = l.marAbierto;
    if (!b?.hs || !m?.hs || !b.hora) continue;
    if (Math.abs(Date.parse(l.fecha) - Date.parse(b.hora)) > 4 * H) continue;
    const k = `${b.id}|${semanaISO(Date.parse(l.fecha))}`;
    const x = g.get(k) || { boya: b.id, nombre: b.nombre || b.id, semana: semanaISO(Date.parse(l.fecha)), crudo: [], corregido: [], horas: new Set() };
    // Una lectura por boya y hora de la boya (varias cámaras comparten boya).
    const clave = `${b.hora}|${m.hs}`;
    if (x.horas.has(clave)) continue;
    x.horas.add(clave);
    x.crudo.push(m.hs / b.hs);
    x.corregido.push((m.hsCorregida ?? m.hs) / b.hs);
    g.set(k, x);
  }
  return [...g.values()].map((x) => ({
    boya: x.boya, nombre: x.nombre, semana: x.semana, n: x.crudo.length,
    modelo_entre_boya: +mediana(x.crudo).toFixed(3), corregido_entre_boya: +mediana(x.corregido).toFixed(3),
  })).sort((a, b) => (a.boya + a.semana).localeCompare(b.boya + b.semana));
}

// Tendencia por boya: última semana frente a la media de las anteriores
// (hasta 4). Aviso si el cociente se aleja más de `umbral` de 1 o cambia más
// de `umbral` respecto a su historia.
export function avisosSesgo(serie, umbral = 0.2) {
  const porBoya = new Map();
  for (const s of serie) (porBoya.get(s.boya) || porBoya.set(s.boya, []).get(s.boya)).push(s);
  const avisos = [];
  for (const [boya, xs] of porBoya) {
    xs.sort((a, b) => a.semana.localeCompare(b.semana));
    const ult = xs[xs.length - 1];
    if (ult.n < 3) continue;
    const prev = xs.slice(-5, -1).filter((x) => x.n >= 3);
    const media = prev.length ? prev.reduce((s, x) => s + x.corregido_entre_boya, 0) / prev.length : null;
    if (Math.abs(ult.corregido_entre_boya - 1) > umbral) {
      avisos.push({ boya, nombre: ult.nombre, semana: ult.semana, tipo: "sesgo", valor: ult.corregido_entre_boya, texto: `el modelo da ${Math.round((ult.corregido_entre_boya - 1) * 100)} % frente a la boya ${ult.nombre} (${ult.n} lecturas)` });
    }
    if (media !== null && Math.abs(ult.corregido_entre_boya - media) > umbral) {
      avisos.push({ boya, nombre: ult.nombre, semana: ult.semana, tipo: "cambio", valor: ult.corregido_entre_boya, antes: +media.toFixed(3), texto: `el sesgo frente a ${ult.nombre} ha cambiado: de ${media.toFixed(2)} a ${ult.corregido_entre_boya.toFixed(2)}` });
    }
  }
  return avisos;
}

// calibracion.json de las cámaras -> error por cámara/encuadre, comparado con
// la foto anterior (la guarda el historial semanal).
export function errorCamaras(calibracion, anterior = null) {
  const filas = [];
  for (const [k, c] of Object.entries(calibracion?.calibracion || {})) {
    const prev = anterior?.[k];
    filas.push({
      camara: k, n: c.n, etiquetas: (c.nEtiquetas || 0) + (c.nEtiquetasClaude || 0), dias: c.dias ?? null,
      error: c.errorRel ?? null, error_antes: prev?.error ?? null,
      empeora: prev?.error != null && c.errorRel != null && c.errorRel > prev.error * 1.25 && c.errorRel - prev.error > 0.1,
    });
  }
  return filas.sort((a, b) => a.camara.localeCompare(b.camara));
}

// ---------------------------------------------------------------------------
// Panel fijo de escenarios (sin red). Las mismas condiciones cada semana:
// si el número cambia, es que cambiaron los pesos o las reglas.
// ---------------------------------------------------------------------------
export const PUNTOS_PANEL = [
  { region: "cantabrico", lat: 43.4047, lon: -2.6989, slug: "mundaka" },
  { region: "atlantico_norte", lat: 42.24, lon: -8.72 },
  { region: "portugal", lat: 38.7, lon: -9.4 },
  { region: "golfo_cadiz", lat: 36.5, lon: -6.3 },
  { region: "mediterraneo", lat: 39.47, lon: -0.33 },
  { region: "baleares", lat: 39.57, lon: 2.65 },
  { region: "canarias", lat: 28.1, lon: -15.4 },
];
const OLAS = [0.4, 1.4, 2.8];
// Viento: flojo del NW, levante moderado y fuerte del NW (velocidad, dirección).
const VIENTOS = [[8, 300], [12, 90], [28, 300]];
// Una hora de día y una de noche (las reglas nocturnas también cuentan).
const HORAS = ["08", "23"];
const PRESIONES = [{ id: "estable", d: 0 }, { id: "bajando", d: -0.6 }];
const MESES = [1, 4, 7, 10];
const MODALIDADES = ["costa", "embarcacion", "submarina"];

function seriePanel(mes, ola, [viento, dir], dPresion) {
  const h = [];
  const inicio = Date.UTC(2026, mes - 1, 10);
  for (let i = 0; i < 144; i++) {
    const d = new Date(inicio + i * H);
    h.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.5 * Math.sin((2 * Math.PI * i) / 12.42), ola, viento, vientoDir: dir,
      tempAgua: [13, 14, 19, 17][MESES.indexOf(mes)] ?? 16, presion: 1018 + dPresion * Math.max(0, i - 120), lluvia: 0,
    });
  }
  return h;
}

// Devuelve { claves: [...], puntuaciones: [...] } en orden fijo.
export function panelReferencia(datos, { puntos = PUNTOS_PANEL } = {}) {
  const claves = [], puntuaciones = [];
  for (const pt of puntos) for (const mes of MESES) for (const ola of OLAS) for (const v of VIENTOS) for (const pr of PRESIONES) {
    const serie = seriePanel(mes, ola, v, pr.d);
    for (const hh of HORAS) {
      const i = serie.findIndex((x) => x.hora.endsWith(`T${hh}:00`) && x.hora.slice(8, 10) === "15");
      for (const modalidad of MODALIDADES) {
        const ind = indiceSpot(datos, serie, i, { lat: pt.lat, lon: pt.lon, region: pt.region, modalidad });
        claves.push(`${pt.region}|${mes}|${ola}|${v.join("/")}|${pr.id}|${hh}h|${modalidad}`);
        puntuaciones.push(ind?.puntuacion ?? null);
      }
    }
  }
  return { claves, puntuaciones };
}

export function compararPaneles(a, b) {
  const difs = [];
  for (let i = 0; i < a.puntuaciones.length; i++) {
    const x = a.puntuaciones[i], y = b.puntuaciones[i];
    if (Number.isFinite(x) && Number.isFinite(y)) difs.push({ clave: a.claves[i], d: y - x });
  }
  if (!difs.length) return { n: 0, cambiados: 0, media_abs: 0, max_abs: 0, peores: [] };
  const abs = difs.map((x) => Math.abs(x.d));
  return {
    n: difs.length, cambiados: abs.filter((x) => x > 0).length,
    media_abs: +(abs.reduce((s, x) => s + x, 0) / abs.length).toFixed(2),
    max_abs: Math.max(...abs),
    peores: difs.sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, 5),
  };
}

export function histogramaPanel(panel) {
  return histograma(panel.puntuaciones.filter(Number.isFinite));
}
