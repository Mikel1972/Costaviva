// assets/js/condiciones-salida.js
//
// Condiciones de una salida del diario PARA SU FECHA Y HORA, no las de hoy
// (Fase 0 del índice v2, 2026-10-08). Módulo ES puro (sin DOM ni red), con
// tests en test/indice-pesca-v2.test.js; lo usa diario.html.
//
// El bug: una entrada retroactiva (apuntada otro día) podía guardarse con
// datos de HOY:
//   - sin hora de inicio, el índice horario caía en "la hora de ahora", y en
//     la serie de mar (que trae ±8 días para el coeficiente de marea) esa
//     hora existe: oleaje, temperatura del agua y marea salían de hoy;
//   - la boya real (solo embarcación) se leía de /prevision, que es la de
//     ahora mismo, fuera cual fuera la fecha;
//   - la luna se pedía a /luna, que siempre calcula la de hoy;
//   - una hora como 23:40 se redondeaba a las 00 del MISMO día.
// Y si la fecha era demasiado antigua para Open-Meteo (o una previsión
// demasiado lejana), la petición fallaba y no quedaba constancia del motivo.
//
// Aquí: qué pedir para cada fecha (con las ventanas que admite el proxy
// /meteo/, máx. 31 días), qué hora de la serie usar, y la luna de esa fecha
// (astronomía pura). Fechas fuera de alcance: condiciones a null con un
// estado que lo dice, nunca datos de otro día.
//
// Nota (2026-10-08): otra rama (fuentes gratuitas, fase 2) está añadiendo
// histórico ERA5; cuando exista un camino "pasado" para fechas antiguas, el
// modo "antigua" podrá pedirlo en vez de dejar null. Hoy no se toca la capa
// de fuentes desde aquí: se usa el mismo proxy /meteo/ de siempre.

import { faseLunar } from "./ventana-actividad.js";
import { t, I18n } from "./i18n-modulo.js";

// Open-Meteo Forecast/Marine sirven como mucho ~92 días hacia atrás
// (past_days ≤ 92) y 16 hacia delante. Margen de 2 días por la zona horaria.
export const MAX_DIAS_PASADO = 90;
export const MAX_DIAS_FUTURO = 15;
// Atmósfera: 5 días antes (tendencias y retardos de las reglas expertas)
// hasta el día siguiente (salidas que cruzan medianoche). Mar: ±8 días para
// el coeficiente de marea por spot (ver diario.html). Ambas ≤ 31 días, el
// tope del proxy.
export const DIAS_ATMOSFERA_ANTES = 5;
export const DIAS_MAR_ALREDEDOR = 8;

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// modo: "hoy" | "pasado" | "futuro" (previsión) | "antigua" (sin dato por
// fecha) | "lejana" (sin previsión todavía) | "sin_fecha" (comportamiento de
// siempre: ahora mismo).
export function planCondiciones(fecha, hoy) {
  if (!fecha) return { modo: "sin_fecha", dias: 0, pedir: true };
  const dias = diasEntre(fecha, hoy); // >0: pasado
  if (dias === 0) return { modo: "hoy", dias, pedir: true };
  if (dias > MAX_DIAS_PASADO) return { modo: "antigua", dias, pedir: false, estado: "sin_dato_fecha_antigua" };
  if (dias > 0) return { modo: "pasado", dias, pedir: true };
  if (-dias > MAX_DIAS_FUTURO) return { modo: "lejana", dias, pedir: false, estado: "sin_prevision_fecha_lejana" };
  return { modo: "futuro", dias, pedir: true };
}

// Ventanas de fechas para el proxy, recortadas a lo que sirve Open-Meteo.
export function ventanasConsulta(fecha, hoy) {
  const limiteAtras = sumarDias(hoy, -MAX_DIAS_PASADO);
  const limiteDelante = sumarDias(hoy, MAX_DIAS_FUTURO);
  const recorta = (ini, fin) => ({
    inicio: ini < limiteAtras ? limiteAtras : ini,
    fin: fin > limiteDelante ? limiteDelante : fin,
  });
  return {
    atmosfera: recorta(sumarDias(fecha, -DIAS_ATMOSFERA_ANTES), sumarDias(fecha, 1)),
    mar: recorta(sumarDias(fecha, -DIAS_MAR_ALREDEDOR), sumarDias(fecha, DIAS_MAR_ALREDEDOR)),
  };
}

// Hora "HH:MM" -> { fecha, hora } de la hora en punto más cercana (07:40 ->
// 08; 23:40 -> 00 del día SIGUIENTE).
export function horaRedondeada(fecha, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (m >= 30 && h === 23) return { fecha: sumarDias(fecha, 1), hora: 0 };
  return { fecha, hora: m >= 30 ? h + 1 : h };
}

// Índice de la serie horaria (etiquetas "AAAA-MM-DDTHH:00", hora de Madrid)
// para la salida. Nunca devuelve una hora de otro día distinto del de la
// salida (o del siguiente, si la hora redondeada cruza medianoche):
//   - con hora: la hora en punto más cercana de ESA fecha;
//   - sin hora y la fecha es hoy: la hora actual;
//   - sin hora y otra fecha: mediodía de esa fecha (estimada: true).
// Devuelve { i, estimada } con i = -1 si la serie no tiene esa hora.
export function indiceHoraSalida(listaHoras, fecha, hhmm, { hoy, horaActual } = {}) {
  const busca = (f, h) => listaHoras.findIndex((t) => t.startsWith(f) && Number(t.slice(11, 13)) === h);
  if (hhmm) {
    const r = horaRedondeada(fecha, hhmm);
    return { i: busca(r.fecha, r.hora), estimada: false };
  }
  if (fecha === hoy && horaActual) {
    return { i: listaHoras.findIndex((t) => t.slice(0, 13) === horaActual.slice(0, 13)), estimada: false };
  }
  return { i: busca(fecha, 12), estimada: true };
}

// Luna de una fecha cualquiera (astronomía pura, ver faseLunar): mismos
// nombres que /luna (USNO) y la iluminación en %, como luna_iluminacion.
export function lunaDeFecha(fecha, hhmm = "12:00") {
  const [h, m] = (hhmm || "12:00").split(":").map(Number);
  // Hora de Madrid aproximada a UTC (-1/-2 h): sobra para la fase.
  const ms = Date.parse(`${fecha}T00:00:00Z`) + ((h - 1) * 60 + m) * 60000;
  const f = faseLunar(ms);
  const nombre = f.nombre.charAt(0).toUpperCase() + f.nombre.slice(1);
  return { fase: nombre, iluminacion: Math.round(50 * (1 - Math.cos(2 * Math.PI * f.fraccion))) };
}

// Tendencia de presión a la hora i (±1 hPa en 3 h, mismo umbral que /prevision).
export function tendenciaPresion(serie, i) {
  const p = serie[i], p3 = serie[i - 3];
  if (p === null || p === undefined || p3 === null || p3 === undefined) return null;
  const d = p - p3;
  return d <= -1 ? "bajando" : d >= 1 ? "subiendo" : "estable";
}

// Junta las dos respuestas (mar y atmósfera) en la serie que espera
// calcularVentana, cruzando por la etiqueta de hora (nunca por índice).
export function serieHoraria(marino, tiempo, factorOla = 1) {
  const mar = {}, atm = {};
  (marino?.hourly?.time || []).forEach((t, i) => {
    const ola = marino.hourly.wave_height?.[i];
    mar[t] = {
      nivelMar: marino.hourly.sea_level_height_msl?.[i] ?? null,
      ola: ola === null || ola === undefined ? null : ola * factorOla,
      tempAgua: marino.hourly.sea_surface_temperature?.[i] ?? null,
    };
  });
  (tiempo?.hourly?.time || []).forEach((t, i) => {
    atm[t] = {
      viento: tiempo.hourly.windspeed_10m?.[i] ?? null, vientoDir: tiempo.hourly.winddirection_10m?.[i] ?? null,
      presion: tiempo.hourly.pressure_msl?.[i] ?? null, lluvia: tiempo.hourly.precipitation?.[i] ?? null,
    };
  });
  return [...new Set([...Object.keys(mar), ...Object.keys(atm)])].sort().map((t) => ({
    hora: t, nivelMar: mar[t]?.nivelMar ?? null, ola: mar[t]?.ola ?? null, tempAgua: mar[t]?.tempAgua ?? null,
    viento: atm[t]?.viento ?? null, vientoDir: atm[t]?.vientoDir ?? null, presion: atm[t]?.presion ?? null, lluvia: atm[t]?.lluvia ?? null,
  }));
}

// Lo que se guarda del índice en la salida (salidas_pesca.indice_*): compacto
// y con lo necesario para calibrar después (cada factor en log-odds, las
// reglas que actuaron y la puntuación de cada especie candidata).
export const TIPO_SALIDA_A_MODALIDAD = { costa: "costa", embarcacion: "embarcacion", submarinismo: "submarina" };
export function resumenIndice(ind, { estimada = false } = {}) {
  if (!ind || ind.puntuacion === null || ind.puntuacion === undefined) {
    return { indice_puntuacion: null, indice_especie: null, indice_factores: ind ? { motivo: ind.motivo || null, version: ind.version } : null };
  }
  const r = ind.resultado;
  return {
    indice_puntuacion: ind.puntuacion,
    indice_especie: ind.especie.id,
    indice_factores: {
      version: ind.version, hora: ind.hora, hora_estimada: estimada, modalidad: ind.modalidad, region: ind.region,
      // Lo guardado va siempre en español (texto de siempre, para calibrar y
      // para el robot de aprendizaje); la clave y sus datos, para enseñarlo en
      // el idioma de quien lo mire (2026-10-09).
      especie: ind.especie.id, especie_nombre: ind.especie.nombreEs ?? ind.especie.nombre, puntuacion: ind.puntuacion, probabilidad: r.probabilidad,
      razones: r.razones.map((x) => ({ factor: x.factor, texto: x.textoEs ?? x.texto, aporte: x.aporte, ...(x.lo !== undefined ? { lo: x.lo } : {}), ...(x.clave ? { clave: x.clave, vars: x.vars } : {}) })),
      reglas: r.reglasAplicadas, sin_dato: r.sinDato, cobertura: r.cobertura,
      fiabilidad: ind.fiabilidad ? { estrellas: ind.fiabilidad.estrellas, etiqueta: ind.fiabilidad.etiqueta } : null,
      freza: !!ind.freza,
      // Ola peligrosa (2026-10-08): nota aparte, no motivo ni tope.
      aviso_ola: ind.avisoOla ? (ind.avisoOla.clave ? t(ind.avisoOla.clave, ind.avisoOla.vars, "es") : ind.avisoOla.texto) : null,
      ranking: ind.ranking.map((x) => ({ id: x.id, p: x.puntuacion })),
    },
  };
}

// ---------------------------------------------------------------------------
// Boya real y ficha de la salida (2026-10-09, captura de Mikel: la ficha
// decía "TEMP. AGUA 17.2°C" y "OLEAJE 1.9–1.9m" mientras el índice decía
// "agua a 20,4 °C" y "mar de 1-1,5 m"). La ficha se pisaba con la boya
// DESPUÉS de calcular el índice con el modelo: dos fuentes distintas en la
// misma tarjeta. Ahora el índice se calcula con lo mismo que enseña la ficha.

// La boya más cercana con dato (de /prevision), o null.
export function boyaMasCercana(boyas, lat, lon) {
  const validas = (boyas || []).filter((b) => b && !b.error && Number.isFinite(b.lat) && Number.isFinite(b.lon));
  if (!validas.length) return null;
  const d = (b) => Math.hypot(b.lat - lat, b.lon - lon);
  return validas.reduce((mejor, b) => (d(b) < d(mejor) ? b : mejor));
}

// Pone la ola y la temperatura medidas por la boya en la hora i de la serie
// (la de la salida), sin tocar el resto. Devuelve una copia.
export function aplicarBoyaASerie(serie, i, boya) {
  if (!boya || i < 0 || i >= serie.length) return serie;
  const copia = serie.slice();
  const h = { ...copia[i] };
  if (Number.isFinite(boya.alturaSignificativa)) h.ola = boya.alturaSignificativa;
  if (Number.isFinite(boya.tempAgua)) h.tempAgua = boya.tempAgua;
  copia[i] = h;
  return copia;
}

// Números con coma decimal, como el resto de la app ("1,9 m", "17,2 °C");
// en inglés, con punto (I18n.decimal).
export function fmtDecimal(x, decimales = 1) {
  if (x === null || x === undefined || !Number.isFinite(+x)) return null;
  return I18n.decimal(String(+(+x).toFixed(decimales)));
}

// "1,9 m" si es un solo valor (boya) y "1,7–2,1 m" si es un rango (modelo).
export function textoOleaje(min, max) {
  const a = fmtDecimal(min), b = fmtDecimal(max ?? min);
  if (a === null) return "—";
  return a === b || b === null ? `${a} m` : `${a}–${b} m`;
}

// "Cebo: Anchoa · Señuelo: Pulpo" sin separadores sueltos si falta alguno.
export function textoCeboAparejo({ cebo, aparejo, senuelo } = {}) {
  return [cebo && t("cs.cebo", { v: cebo }), aparejo && t("cs.aparejo", { v: t(`cs.ap.${aparejo}`) === `cs.ap.${aparejo}` ? aparejo : t(`cs.ap.${aparejo}`) }), senuelo && t("cs.senuelo", { v: senuelo })].filter(Boolean).join(" · ");
}
