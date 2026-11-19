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

// «Ahora mismo, medido» (2026-11-19, fase 2 de la hoja): lo que miden de
// verdad, ahora, la cámara del spot, la boya y la estación de AEMET más
// cercanas, al lado de la previsión de esta hora. Así se ve si el modelo se
// queda corto o se pasa. Solo datos reales y recientes: sin dato, «—»
// (nunca se rellena con el modelo).
export const MEDIDO_MAX_HORAS = 3, MEDIDO_MAX_KM_BOYA = 80, MEDIDO_MAX_KM_ESTACION = 30;

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, R = 6371;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const reciente = (iso, ahoraMs) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && ahoraMs - t <= MEDIDO_MAX_HORAS * 3600e3 && t - ahoraMs <= 15 * 60e3;
};
const masCercana = (lista, lat, lon, maxKm, valida, ahoraMs) => {
  let mejor = null;
  for (const x of lista || []) {
    if (!fin(x?.lat) || !fin(x?.lon) || !valida(x) || !reciente(x.actualizado, ahoraMs)) continue;
    const km = distanciaKm(lat, lon, x.lat, x.lon);
    if (km <= maxKm && (!mejor || km < mejor.km)) mejor = { x, km };
  }
  return mejor;
};

// camara: s.oleajeCamara de /prevision ({ propia, nombre, fecha, estimacion }).
// Solo la cámara PROPIA del spot: la de una playa vecina no mide esta orilla.
// boyas: BOYAS del mapa ({ nombre, lat, lon, alturaSignificativa,
// periodoPico, dirOla, tempAgua, actualizado }).
// estaciones: ESTACIONES_METEO ({ nombre, lat, lon, vv (m/s), dv, pres,
// prec, actualizado }). horaTexto: ISO -> "HH:MM" en la zona del spot.
export function medidoAhora({ lat, lon, camara, boyas, estaciones, ahoraMs = Date.now(), horaTexto = (iso) => String(iso).slice(11, 16) }) {
  if (!fin(lat) || !fin(lon)) return null;
  const out = {};
  if (camara?.propia && fin(camara.estimacion) && reciente(camara.fecha, ahoraMs)) {
    out.ola = { valor: Number(camara.estimacion), nombre: camara.nombre || "", hora: horaTexto(camara.fecha) };
  }
  const b = masCercana(boyas, lat, lon, MEDIDO_MAX_KM_BOYA, (x) => fin(x.alturaSignificativa), ahoraMs);
  if (b) {
    out.boya = {
      nombre: b.x.nombre, km: Math.round(b.km), hora: horaTexto(b.x.actualizado),
      hs: Number(b.x.alturaSignificativa), periodo: fin(b.x.periodoPico) ? Number(b.x.periodoPico) : null,
      dir: b.x.dirOla || null, agua: fin(b.x.tempAgua) ? Number(b.x.tempAgua) : null,
    };
  }
  const e = masCercana(estaciones, lat, lon, MEDIDO_MAX_KM_ESTACION, (x) => fin(x.vv) || fin(x.pres) || fin(x.prec), ahoraMs);
  if (e) {
    out.estacion = {
      nombre: e.x.nombre, km: Math.round(e.km), hora: horaTexto(e.x.actualizado),
      viento: fin(e.x.vv) ? Number(e.x.vv) * 3.6 : null, vientoDir: fin(e.x.dv) ? Number(e.x.dv) : null,
      presion: fin(e.x.pres) ? Number(e.x.pres) : null, lluvia: fin(e.x.prec) ? Number(e.x.prec) : null,
    };
  }
  return Object.keys(out).length ? out : null;
}

// Resaca de cada hora (mismo cálculo que la nota: mar-de-fondo.js).
export const resacaHora = (h) => marDeFondo(h?.fondoAltura, h?.fondoPeriodo, h?.fondoCoef);
const NIVEL_RESACA = { suave: 0, moderada: 1, fuerte: 2, muy_fuerte: 3 };

// Pleamar / bajamar en una serie de niveles: máximo o mínimo local.
// La marea de la hoja, con las alturas de la tabla del puerto (2026-11-19,
// Mikel: "estos datos están mal, son variaciones pero no marcan la altura
// real"). El modelo da el nivel respecto al nivel medio del mar (de −1 a
// +1 m); las tablas y el panel, respecto al cero del puerto (pleamar 2,2 m,
// bajamar 0,3 m). La forma de la curva y la hora del modelo valen; se le
// suma la diferencia con las pleamares y bajamares de la tabla (s.marea de
// /prevision: proximas [{ tipo, hora "HH:MM", altura, manana }]). Sin
// tabla, la serie sale tal cual y `ajustada` es false.
export function ajustarMareaATabla(serie, marea) {
  const sin = { serie, ajustada: false };
  if (!serie?.length || !marea) return sin;
  const hitos = hitosMarea(serie);
  const hoy = serie[0].hora.slice(0, 10);
  const manana = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const minutos = (iso) => Date.parse(`${iso.slice(0, 16)}:00Z`) / 60e3;
  const difs = [];
  for (const p of marea.proximas || []) {
    if (!fin(p?.altura) || !/^\d{2}:\d{2}$/.test(p?.hora || "")) continue;
    const objetivo = minutos(`${p.manana ? manana : hoy}T${p.hora}`);
    let mejor = null;
    hitos.forEach((tipo, i) => {
      if (tipo !== p.tipo) return;
      const d = Math.abs(minutos(serie[i].hora) - objetivo);
      if (d <= 150 && (!mejor || d < mejor.d)) mejor = { i, d };
    });
    if (mejor) difs.push(p.altura - serie[mejor.i].nivelMar);
  }
  if (!difs.length && fin(marea.altura) && fin(serie[0].nivelMar)) difs.push(marea.altura - serie[0].nivelMar);
  if (!difs.length) return sin;
  const desfase = difs.reduce((a, b) => a + b, 0) / difs.length;
  return { serie: serie.map((h) => (fin(h.nivelMar) ? { ...h, nivelMar: +(h.nivelMar + desfase).toFixed(2) } : h)), ajustada: true, desfase: +desfase.toFixed(2) };
}

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

// enOrilla = false: el spot no tiene cámara ni abrigo con que estimar la
// orilla, y la ola es la de mar abierto (se dice así, no "en la orilla").
export function textoResumen(r, nombreEspecie = (id) => id, { enOrilla = true } = {}) {
  const v = { ...r.vars };
  for (const k of ["de", "a"]) if (k in v) v[k] = m1(v[k]);
  if ("v" in v) v.v = vel(v.v);
  if ("dir" in v) v.dir = I18n.rumbo(v.dir) || "";
  if ("especie" in v) v.especie = nombreEspecie(v.especie);
  return t(!enOrilla && /^hoja\.res\.ola_/.test(r.clave) ? `${r.clave}_abierto` : r.clave, v);
}

// bloqueada: sin Premium la fila de la nota sale con candado (Mikel,
// 2026-11-19: "Candado"); el resto de la hoja es gratis.
export function htmlTabla(serie, notas, { todos = false, nombreEspecie = (id) => id, bloqueada = false, medido = null, enOrilla = true } = {}) {
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
  // Columna «Medido» (antes de la de ahora): cada fila dice qué mide y de
  // dónde sale; sin medida, «—».
  const md = medido || null;
  const fuente = (icono, nombre, hora) => `<small>${icono} ${esc(nombre)}${hora ? ` · ${esc(hora)}` : ""}</small>`;
  const deBoya = (v) => (md?.boya && v !== null && v !== undefined && v !== "" ? `${v}${fuente("⚓", md.boya.nombre, md.boya.hora)}` : "—");
  const deEstacion = (v) => (md?.estacion && v !== null && v !== undefined && v !== "" ? `${v}${fuente("🌬️", md.estacion.nombre, md.estacion.hora)}` : "—");
  const fila = (titulo, celda, extra = false, cls = "", celdaMedida = () => "—") =>
    `<tr class="${extra ? "hp-extra" : ""} ${cls}"${extra && !todos ? " hidden" : ""}><th scope="row">${titulo}</th>${md ? `<td class="hp-medido">${celdaMedida()}</td>` : ""}${serie.map((h, i) => `<td class="${i === 0 ? "hp-ahora" : ""}${h.luz === "noche" ? " hp-noche" : ""}">${celda(h, i)}</td>`).join("")}</tr>`;
  const filas = [
    fila(esc(t(enOrilla ? "hoja.f.ola" : "hoja.f.ola_abierto")), (h, i) => (fin(h.ola) ? `${m1(h.ola)} ${i ? flecha(serie[i - 1].ola, h.ola) : ""}` : "—"), false, "",
      () => (md?.ola ? `~${m1(md.ola.valor)}${fuente("📷", md.ola.nombre, md.ola.hora)}` : "—")),
    fila(esc(t("hoja.f.resaca")), (h) => {
      const r = resacaHora(h);
      return r ? `<span class="hp-res ${r.nivel}">${esc(t(`hoja.resaca.${r.nivel}`))}</span><small>${m1(r.altura)} · ${r.periodo} s</small>` : "—";
    }),
    fila(esc(t("hoja.f.viento")), (h, i) => (fin(h.viento) ? `${vel(h.viento)} ${esc(I18n.rumbo(h.vientoDir) || "")} ${i ? flecha(serie[i - 1].viento, h.viento) : ""}` : "—"), false, "",
      () => deEstacion(fin(md?.estacion?.viento) ? `${vel(md.estacion.viento)} ${esc(I18n.rumbo(md.estacion.vientoDir) || "")}` : null)),
    fila(esc(t("hoja.f.marea")), (h, i) => {
      if (!fin(h.nivelMar)) return "—";
      if (hitos[i]) return `<b class="hp-hito">${esc(t(`hoja.${hitos[i]}`))}</b><small>${m1(h.nivelMar)}</small>`;
      const prev = serie[i - 1]?.nivelMar;
      return `${m1(h.nivelMar)} ${fin(prev) ? (h.nivelMar > prev ? "↑" : "↓") : ""}`;
    }),
    fila(esc(t("hoja.f.mar_abierto")), (h) => m1(h.olaMarAbierto), true, "", () => deBoya(md?.boya ? m1(md.boya.hs) : null)),
    fila(esc(t("hoja.f.periodo")), (h) => (fin(h.periodo) ? `${Math.round(h.periodo)} s ${esc(I18n.rumbo(h.dirOla) || "")}` : "—"), true, "",
      () => deBoya(fin(md?.boya?.periodo) ? `${Math.round(md.boya.periodo)} s ${esc(md.boya.dir || "")}` : null)),
    fila(esc(t("hoja.f.presion")), (h) => (fin(h.presion) ? `${Math.round(h.presion)} hPa` : "—"), true, "",
      () => deEstacion(fin(md?.estacion?.presion) ? `${Math.round(md.estacion.presion)} hPa` : null)),
    fila(esc(t("hoja.f.lluvia")), (h) => (fin(h.lluvia) ? (h.lluvia > 0 ? `${I18n.num(h.lluvia, 1)} mm` : "0") : "—"), true, "",
      () => deEstacion(fin(md?.estacion?.lluvia) ? (md.estacion.lluvia > 0 ? `${I18n.num(md.estacion.lluvia, 1)} mm` : "0") : null)),
    fila(esc(t("hoja.f.agua")), (h) => (fin(h.tempAgua) ? I18n.temp(h.tempAgua) : "—"), true, "",
      () => deBoya(fin(md?.boya?.agua) ? I18n.temp(md.boya.agua) : null)),
    fila(esc(t("hoja.f.luz")), (h) => (h.luz ? esc(t(`hoja.luz.${h.luz}`)) : "—"), true),
    fila(esc(t("hoja.f.nota")), (h, i) => {
      if (bloqueada) return i === 0 ? `<a class="hp-candado" href="/suscripcion">${esc(t("hoja.nota_premium"))}</a>` : '<span class="hp-candado-mini" aria-hidden="true">🔒</span>';
      const n = notas[i];
      if (!n) return "—";
      if (n.prohibida) return `<span class="hp-nota"><b class="malo">0</b><small>${esc(t("hoja.de_noche_no"))}</small></span>`;
      return `<span class="hp-nota"><b class="${nivelNota(n.nota)}">${n.nota}</b><small>${esc(nombreEspecie(n.especie))}</small></span>`;
    }, false, "hp-fila-nota"),
  ];
  const cabMedido = md ? `<th scope="col" class="hp-medido">${esc(t("hoja.medido"))}<span class="hp-dia">${esc(t("hoja.medido_sub"))}</span></th>` : "";
  return `<thead><tr><th scope="col">${esc(t("hoja.f.hora"))}</th>${cabMedido}${cab}</tr></thead><tbody>${filas.join("")}</tbody>`;
}
