// assets/js/hoja-prevision.js — hoja de previsión del spot (2026-11-19).
//
// Mikel: "cuando vamos a pescar, nos gusta saber la predicción para las
// siguientes horas para saber si va a empeorar o mejorar [...] una hoja que
// se abriera aparte con todos los datos en columna y, al final, la
// estimación del spot". Decidido con él sobre la maqueta (2026-11-19):
//   - las próximas 24 h, gratis; los 7 días, Premium (fase siguiente);
//   - horas en columnas que se deslizan, datos en filas y la nota del spot
//     en la última fila; el pez se elige (por defecto, el mejor de cada hora);
//   - por defecto solo lo esencial; "Ver todos los datos" abre el resto;
//   - resaca: Muy poca · Poca · Fuerte · Muy fuerte (nunca "algo").
//
// Módulo puro (sin red): index.html le pasa la serie horaria del spot
// (datosHorariosSpot) y las notas ya calculadas con ventana-actividad.js;
// aquí se ordena, se resume y se pinta. Lo prueba test/hoja-prevision.test.js.
import { marDeFondo } from "./mar-de-fondo.js";
import { t, I18n } from "./i18n-modulo.js";

export const HORAS_HOJA = 24;
// Cambios que cuentan como "mejora" o "empeora" en el resumen.
export const UMBRAL_OLA_M = 0.2, UMBRAL_OLA_REL = 0.15, UMBRAL_VIENTO_KMH = 8;

const hh = (iso) => iso.slice(11, 13);
const fin = (x) => x !== null && x !== undefined && Number.isFinite(Number(x));

// Las próximas `n` horas desde la hora local actual ("AAAA-MM-DDTHH").
export function serieDesdeAhora(horas, ahoraISO, n = HORAS_HOJA) {
  const h0 = ahoraISO.slice(0, 13);
  const i = (horas || []).findIndex((h) => h.hora.slice(0, 13) >= h0);
  return i < 0 ? [] : horas.slice(i, i + n + 1);
}

// Resaca de cada hora (mismo cálculo que la nota: mar-de-fondo.js).
export const resacaHora = (h) => marDeFondo(h?.fondoAltura, h?.fondoPeriodo, h?.fondoCoef);
const NIVEL_RESACA = { suave: 0, moderada: 1, fuerte: 2, muy_fuerte: 3 };

// Pleamar / bajamar en una serie de niveles: máximo o mínimo local.
export function hitosMarea(serie) {
  return serie.map((h, i) => {
    const a = serie[i - 1]?.nivelMar, b = serie[i + 1]?.nivelMar, x = h.nivelMar;
    if (!fin(a) || !fin(b) || !fin(x)) return null;
    if (x > a && x >= b) return "pleamar";
    if (x < a && x <= b) return "bajamar";
    return null;
  });
}

// Nota de cada hora con el pez elegido o, sin elegir, la mejor especie.
// resultados: { [especieId]: [{ hora, puntuacion, prohibida, luz }] }
export function notasPorHora(serie, resultados, especieId = null) {
  return serie.map((h) => {
    let mejor = null;
    for (const [id, lista] of Object.entries(resultados || {})) {
      if (especieId && id !== especieId) continue;
      const r = lista.find((x) => x.hora.slice(0, 13) === h.hora.slice(0, 13));
      if (!r || !Number.isFinite(r.puntuacion)) continue;
      const nota = r.prohibida ? 0 : r.puntuacion;
      if (!mejor || nota > mejor.nota) mejor = { nota, especie: id, prohibida: !!r.prohibida, luz: r.luz || null };
    }
    return mejor;
  });
}

// Resumen "¿mejora o empeora?": frases con clave i18n y variables.
// serie[0] es la hora actual. notas: salida de notasPorHora.
export function resumenTendencia(serie, notas = []) {
  const out = [];
  if (!serie.length) return out;
  const h0 = serie[0];
  // Ola en la orilla: el extremo de las próximas 24 h frente a ahora.
  const olas = serie.map((h) => h.ola).filter(fin);
  if (fin(h0.ola) && olas.length > 1) {
    let iMin = 0, iMax = 0;
    serie.forEach((h, i) => { if (fin(h.ola)) { if (h.ola < serie[iMin].ola) iMin = i; if (h.ola > serie[iMax].ola) iMax = i; } });
    const cambio = (x) => Math.abs(x - h0.ola) >= Math.max(UMBRAL_OLA_M, UMBRAL_OLA_REL * h0.ola);
    if (cambio(serie[iMax].ola) && iMax > iMin) out.push({ clave: "hoja.res.ola_sube", tono: "empeora", vars: { de: h0.ola, a: serie[iMax].ola, hora: hh(serie[iMax].hora) } });
    else if (cambio(serie[iMin].ola)) out.push({ clave: "hoja.res.ola_baja", tono: "mejora", vars: { de: h0.ola, a: serie[iMin].ola, hora: hh(serie[iMin].hora) } });
    else out.push({ clave: "hoja.res.ola_igual", tono: "", vars: { de: h0.ola } });
  }
  // Viento: la primera hora en que sube o baja UMBRAL_VIENTO_KMH.
  if (fin(h0.viento)) {
    const sube = serie.findIndex((h) => fin(h.viento) && h.viento >= h0.viento + UMBRAL_VIENTO_KMH);
    const baja = serie.findIndex((h) => fin(h.viento) && h.viento <= h0.viento - UMBRAL_VIENTO_KMH);
    const max = Math.max(...serie.map((h) => h.viento).filter(fin));
    const min = Math.min(...serie.map((h) => h.viento).filter(fin));
    if (sube > 0 && (baja < 0 || sube <= baja)) out.push({ clave: "hoja.res.viento_sube", tono: "empeora", vars: { v: max, hora: hh(serie[sube].hora), dir: serie[sube].vientoDir } });
    else if (baja > 0) out.push({ clave: "hoja.res.viento_baja", tono: "mejora", vars: { v: min, hora: hh(serie[baja].hora) } });
    else out.push({ clave: "hoja.res.viento_igual", tono: "", vars: { v: h0.viento, dir: h0.vientoDir } });
  }
  // Resaca: hasta cuándo tira fuerte, o desde cuándo empieza.
  const res = serie.map(resacaHora);
  if (res[0]) {
    const fuerte = (r) => r && NIVEL_RESACA[r.nivel] >= 2;
    if (fuerte(res[0])) {
      const i = res.findIndex((r) => r && !fuerte(r));
      out.push(i > 0
        ? { clave: "hoja.res.resaca_hasta", tono: "mejora", vars: { hora: hh(serie[i].hora) } }
        : { clave: "hoja.res.resaca_todo", tono: "empeora", vars: {} });
    } else {
      const i = res.findIndex(fuerte);
      out.push(i > 0
        ? { clave: "hoja.res.resaca_desde", tono: "empeora", vars: { hora: hh(serie[i].hora) } }
        : { clave: "hoja.res.resaca_poca", tono: "", vars: {} });
    }
  }
  // Mejor momento: la franja seguida alrededor de la mejor nota (±5).
  const validas = notas.map((n, i) => ({ n, i })).filter(({ n }) => n && !n.prohibida);
  if (validas.length) {
    const top = validas.reduce((m, x) => (x.n.nota > m.n.nota ? x : m));
    let a = top.i, b = top.i;
    while (notas[a - 1] && !notas[a - 1].prohibida && notas[a - 1].nota >= top.n.nota - 5) a--;
    while (notas[b + 1] && !notas[b + 1].prohibida && notas[b + 1].nota >= top.n.nota - 5) b++;
    const otroDia = serie[a].hora.slice(0, 10) !== serie[0].hora.slice(0, 10);
    out.push({ clave: otroDia ? "hoja.res.mejor_manana" : "hoja.res.mejor_hoy", tono: "", vars: { desde: hh(serie[a].hora), hasta: String((Number(hh(serie[b].hora)) + 1) % 24).padStart(2, "0"), nota: top.n.nota, especie: top.n.especie } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pintado (navegador). opciones: { todos, nombreEspecie(id), modalidad }
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const m1 = (x) => (fin(x) ? I18n.metros(x, 1) : "—");
const vel = (x) => (fin(x) ? I18n.velocidad(x) : "—");
const nivelNota = (n) => (n >= 65 ? "bueno" : n >= 40 ? "medio" : "malo");

export function textoResumen(r, nombreEspecie = (id) => id) {
  const v = { ...r.vars };
  for (const k of ["de", "a"]) if (k in v) v[k] = m1(v[k]);
  if ("v" in v) v.v = vel(v.v);
  if ("dir" in v) v.dir = I18n.rumbo(v.dir) || "";
  if ("especie" in v) v.especie = nombreEspecie(v.especie);
  return t(r.clave, v);
}

// bloqueada: sin Premium la fila de la nota sale con candado (Mikel,
// 2026-11-19: "Candado"); el resto de la hoja es gratis.
export function htmlTabla(serie, notas, { todos = false, nombreEspecie = (id) => id, bloqueada = false } = {}) {
  const hitos = hitosMarea(serie);
  const flecha = (a, b, malo = "sube") => {
    if (!fin(a) || !fin(b)) return "";
    const d = b - a;
    if (Math.abs(d) < 0.05 * Math.max(1, Math.abs(a))) return '<span class="hp-fl">→</span>';
    const sube = d > 0;
    return `<span class="hp-fl ${(sube ? "sube" : "baja") === malo ? "peor" : "mejor"}">${sube ? "↗" : "↘"}</span>`;
  };
  const cab = serie.map((h, i) => {
    const otroDia = h.hora.slice(0, 10) !== serie[0].hora.slice(0, 10);
    return `<th scope="col" class="${i === 0 ? "hp-ahora" : ""}">${i === 0 ? esc(t("hoja.ahora")) : `${hh(h.hora)}h`}<span class="hp-dia">${esc(i === 0 ? t("hoja.modelo") : otroDia ? t("comun.manana") : t("comun.hoy"))}</span></th>`;
  }).join("");
  const fila = (titulo, celda, extra = false, cls = "") =>
    `<tr class="${extra ? "hp-extra" : ""} ${cls}"${extra && !todos ? " hidden" : ""}><th scope="row">${titulo}</th>${serie.map((h, i) => `<td class="${i === 0 ? "hp-ahora" : ""}${h.luz === "noche" ? " hp-noche" : ""}">${celda(h, i)}</td>`).join("")}</tr>`;
  const filas = [
    fila(esc(t("hoja.f.ola")), (h, i) => (fin(h.ola) ? `${m1(h.ola)} ${i ? flecha(serie[i - 1].ola, h.ola) : ""}` : "—")),
    fila(esc(t("hoja.f.resaca")), (h) => {
      const r = resacaHora(h);
      return r ? `<span class="hp-res ${r.nivel}">${esc(t(`hoja.resaca.${r.nivel}`))}</span><small>${m1(r.altura)} · ${r.periodo} s</small>` : "—";
    }),
    fila(esc(t("hoja.f.viento")), (h, i) => (fin(h.viento) ? `${vel(h.viento)} ${esc(I18n.rumbo(h.vientoDir) || "")} ${i ? flecha(serie[i - 1].viento, h.viento) : ""}` : "—")),
    fila(esc(t("hoja.f.marea")), (h, i) => {
      if (!fin(h.nivelMar)) return "—";
      if (hitos[i]) return `<b class="hp-hito">${esc(t(`hoja.${hitos[i]}`))}</b><small>${m1(h.nivelMar)}</small>`;
      const prev = serie[i - 1]?.nivelMar;
      return `${m1(h.nivelMar)} ${fin(prev) ? (h.nivelMar > prev ? "↑" : "↓") : ""}`;
    }),
    fila(esc(t("hoja.f.mar_abierto")), (h) => m1(h.olaMarAbierto), true),
    fila(esc(t("hoja.f.periodo")), (h) => (fin(h.periodo) ? `${Math.round(h.periodo)} s ${esc(I18n.rumbo(h.dirOla) || "")}` : "—"), true),
    fila(esc(t("hoja.f.presion")), (h) => (fin(h.presion) ? `${Math.round(h.presion)} hPa` : "—"), true),
    fila(esc(t("hoja.f.lluvia")), (h) => (fin(h.lluvia) ? (h.lluvia > 0 ? `${I18n.num(h.lluvia, 1)} mm` : "0") : "—"), true),
    fila(esc(t("hoja.f.agua")), (h) => (fin(h.tempAgua) ? I18n.temp(h.tempAgua) : "—"), true),
    fila(esc(t("hoja.f.luz")), (h) => (h.luz ? esc(t(`hoja.luz.${h.luz}`)) : "—"), true),
    fila(esc(t("hoja.f.nota")), (h, i) => {
      if (bloqueada) return i === 0 ? `<a class="hp-candado" href="/suscripcion">${esc(t("hoja.nota_premium"))}</a>` : '<span class="hp-candado-mini" aria-hidden="true">🔒</span>';
      const n = notas[i];
      if (!n) return "—";
      if (n.prohibida) return `<span class="hp-nota"><b class="malo">0</b><small>${esc(t("hoja.de_noche_no"))}</small></span>`;
      return `<span class="hp-nota"><b class="${nivelNota(n.nota)}">${n.nota}</b><small>${esc(nombreEspecie(n.especie))}</small></span>`;
    }, false, "hp-fila-nota"),
  ];
  return `<thead><tr><th scope="col">${esc(t("hoja.f.hora"))}</th>${cab}</tr></thead><tbody>${filas.join("")}</tbody>`;
}
