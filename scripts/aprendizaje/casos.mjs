// scripts/aprendizaje/casos.mjs
//
// Convierte las filas del diario (salidas_pesca + capturas) en "casos" del
// banco de pruebas: una salida terminada, con lo que dijo el índice a esa
// hora y lo que pasó (¿se pescó algo? ¿qué?). Puro, sin red.
//
// PRIVACIDAD: un caso lleva `usuario` SOLO para contar usuarios distintos
// (k-anonimato, privacidad.mjs). Nada de este módulo se publica tal cual:
// semanal.mjs publica solo agregados y nunca ids, fechas, spots ni
// coordenadas (el repo es público).

import { regionPorCoordenadas } from "../../assets/js/ventana-actividad.js";

const normal = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Índice nombre normalizado -> id de especies.json (nombres en todos los
// idiomas, id y nombre científico).
export function mapaNombres(datos) {
  const m = new Map();
  for (const e of datos.especies || []) {
    const nombres = [e.id, e.id.replace(/_/g, " "), e.cientifico, ...Object.values(e.nombres || {}).flat()];
    for (const n of nombres) if (n && typeof n === "string" && !m.has(normal(n))) m.set(normal(n), e.id);
  }
  return m;
}

// "Calamar / chipirón" -> ["calamar"]; "Txitxarro / verdel" -> los que
// existan. Primero coincidencia exacta de cada parte; si no, el nombre más
// largo contenido en el texto ("Bonito del norte" -> bonito_norte).
export function idsEspecie(mapa, texto) {
  const partes = String(texto ?? "").split("/").map(normal).filter(Boolean);
  const ids = new Set();
  for (const p of partes) {
    if (mapa.has(p)) { ids.add(mapa.get(p)); continue; }
    let mejor = null;
    for (const [n, id] of mapa) {
      if (n.length >= 4 && (p === n || p.startsWith(`${n} `) || p.includes(` ${n}`) || n.startsWith(`${p} `))) {
        if (!mejor || n.length > mejor.n.length) mejor = { n, id };
      }
    }
    if (mejor) ids.add(mejor.id);
  }
  return [...ids];
}

export const MODALIDAD_DE_TIPO = { costa: "costa", embarcacion: "embarcacion", submarinismo: "submarina" };
const ESTADOS_VALIDOS = new Set([null, undefined, "ok", "parcial"]);

// Hora local "HH" de la salida: la de inicio (redondeada a la hora) o
// mediodía si no hay (igual que el diario, `hora_estimada`).
export function horaCaso(s) {
  const f = s.indice_factores;
  if (f?.hora && /T\d\d:/.test(f.hora)) return { hora: Number(f.hora.slice(11, 13)), estimada: !!f.hora_estimada };
  if (s.hora_inicio && /^\d\d:\d\d/.test(s.hora_inicio)) {
    const [h, m] = s.hora_inicio.split(":").map(Number);
    return { hora: Math.min(23, h + (m >= 30 ? 1 : 0)), estimada: false };
  }
  return { hora: 12, estimada: true };
}

// Términos (factor/regla -> log-odds) guardados por el diario. Solo los que
// llevan `lo` (las notas y avisos no puntúan).
export function terminosGuardados(f) {
  if (!f || !Array.isArray(f.razones)) return null;
  return f.razones.filter((r) => typeof r.lo === "number" && r.factor && r.factor !== "tope").map((r) => ({ u: r.factor, lo: r.lo }));
}

// salidas: filas de salidas_pesca; capturas: [{ salida_id, especie }];
// excluir: Set de user_id (cuentas de prueba); propios: Set de user_id del
// dueño (tabla administradores). hoy: "AAAA-MM-DD".
export function casosDesdeDiario({ salidas = [], capturas = [], excluir = new Set(), propios = new Set(), datos, hoy }) {
  const mapa = mapaNombres(datos);
  const porSalida = new Map();
  for (const c of capturas) {
    if (!porSalida.has(c.salida_id)) porSalida.set(c.salida_id, []);
    porSalida.get(c.salida_id).push(c);
  }
  const casos = [];
  const descartes = { en_curso: 0, prueba: 0, futuro: 0, sin_condiciones: 0, sin_lugar: 0 };
  for (const s of salidas) {
    if (excluir.has(s.user_id)) { descartes.prueba++; continue; }
    if (s.concluida === false) { descartes.en_curso++; continue; }
    if (!s.fecha || (hoy && s.fecha > hoy)) { descartes.futuro++; continue; }
    if (!ESTADOS_VALIDOS.has(s.condiciones_estado)) { descartes.sin_condiciones++; continue; }
    const f = s.indice_factores && typeof s.indice_factores === "object" ? s.indice_factores : null;
    const lat = Number(s.lat), lon = Number(s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { descartes.sin_lugar++; continue; }
    const cs = porSalida.get(s.id) || [];
    const especies = [...new Set(cs.flatMap((c) => idsEspecie(mapa, c.especie)))];
    const { hora, estimada } = horaCaso(s);
    const p = Number.isFinite(s.indice_puntuacion) ? s.indice_puntuacion / 100
      : Number.isFinite(f?.probabilidad) ? f.probabilidad / 100 : null;
    casos.push({
      ref: s.id, // interno: nunca se publica
      usuario: s.user_id, propio: propios.has(s.user_id),
      fecha: s.fecha, mes: Number(s.fecha.slice(5, 7)), hora, hora_estimada: estimada,
      modalidad: f?.modalidad || MODALIDAD_DE_TIPO[s.tipo_salida] || "costa",
      region: f?.region || regionPorCoordenadas(lat, lon),
      lat, lon, spot: s.spot_slug || null,
      y: cs.length > 0 ? 1 : 0, especies,
      guardado: p === null ? null : {
        p, version: s.indice_version || f?.version || null, especie: s.indice_especie || f?.especie || null,
        terminos: terminosGuardados(f), ranking: Array.isArray(f?.ranking) ? f.ranking : null,
      },
    });
  }
  casos.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + String(b.hora).padStart(2, "0")) || String(a.ref).localeCompare(String(b.ref)));
  return { casos, descartes };
}

// Partición temporal: los más antiguos para ajustar y los más recientes para
// comprobar (nunca al revés: el futuro no se usa para predecir el pasado).
export function particionTemporal(casos, fraccionPrueba = 0.3) {
  const orden = [...casos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const corte = Math.max(0, Math.min(orden.length, Math.round(orden.length * (1 - fraccionPrueba))));
  return { ajuste: orden.slice(0, corte), prueba: orden.slice(corte) };
}

// Acierto de especie: entre las salidas con pesca, ¿la especie pescada
// estaba la primera (o entre las 3 primeras) del ranking del índice?
export function aciertoEspecie(casos) {
  const con = casos.filter((c) => c.y && c.especies.length && c.indice?.ranking?.length);
  if (!con.length) return { n: 0 };
  let top1 = 0, top3 = 0, rr = 0;
  for (const c of con) {
    const pos = c.indice.ranking.findIndex((r) => c.especies.includes(r.id));
    if (pos === 0) top1++;
    if (pos >= 0 && pos < 3) top3++;
    if (pos >= 0) rr += 1 / (pos + 1);
  }
  const n = con.length;
  return { n, top1: +(top1 / n).toFixed(3), top3: +(top3 / n).toFixed(3), mrr: +(rr / n).toFixed(3) };
}
