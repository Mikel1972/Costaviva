// scripts/aprendizaje/sesgo-condiciones.mjs
//
// Histórico previsto/real de las condiciones (2026-11-08, Mikel: "analiza
// todos los elementos, viento, etc., con nuestras predicciones y vete
// adaptándolas; crea los históricos para que el sistema sea cada vez más
// rico y exacto"). Puro, sin red.
//
// Cada salida guarda al crearse la PREVISIÓN de su hora (viento_kmh,
// oleaje_altura_max, presion_valor, temp_agua) y, al concluir la jornada,
// diario.html deja en indice_factores.real el análisis del modelo (y la boya
// si la salida es de hoy) para esa misma hora. Aquí se compara: error =
// previsto − real, por zona y variable.
//
// Solo cuentan las salidas apuntadas al menos 1 hora antes de empezar
// (indice_factores.real.horas_antes ≥ 1): si se apuntó después de pescar, la
// "previsión" ya era el análisis y no mide nada.
//
// PRIVACIDAD (repo público): un grupo zona × variable solo se publica con 5
// personas distintas o más, como el resto del aprendizaje. Nunca se corrige
// nada solo: con muestra suficiente sale una propuesta para el sí de Mikel.

import { regionPorCoordenadas } from "../../assets/js/ventana-actividad.js";

export const VARIABLES = {
  viento_kmh: { previsto: "viento_kmh", real: "viento_kmh", unidad: "km/h", nombre: "viento" },
  ola_m: { previsto: "oleaje_altura_max", real: "oleaje_altura_max", unidad: "m", nombre: "ola" },
  presion_hpa: { previsto: "presion_valor", real: "presion_valor", unidad: "hPa", nombre: "presión" },
  temp_agua_c: { previsto: "temp_agua", real: "temp_agua", unidad: "°C", nombre: "temperatura del agua" },
};
export const CONFIG_CONDICIONES = { min_muestras: 20, min_personas: 5, horas_antes_min: 1, horas_antes_max: 168 };

const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

// salidas: filas de salidas_pesca con indice_factores; excluir/propios como en casos.mjs.
export function muestrasCondiciones({ salidas = [], excluir = new Set(), propios = new Set() }, cfg = CONFIG_CONDICIONES) {
  const out = [];
  for (const s of salidas) {
    if (excluir.has(s.user_id) || s.concluida === false) continue;
    const real = s.indice_factores?.real;
    const antes = num(real?.horas_antes);
    if (!real || antes === null || antes < cfg.horas_antes_min || antes > cfg.horas_antes_max) continue;
    const lat = num(s.lat), lon = num(s.lon);
    if (lat === null || lon === null) continue;
    const zona = regionPorCoordenadas(lat, lon);
    for (const [variable, v] of Object.entries(VARIABLES)) {
      const p = num(s[v.previsto]), r = num(real[v.real]);
      if (p === null || r === null) continue;
      out.push({ zona, variable, error: +(p - r).toFixed(3), previsto: p, real: r, horas_antes: antes, usuario: s.user_id, propio: propios.has(s.user_id), fecha: s.fecha });
    }
  }
  return out;
}

// Agregados por zona × variable: n, personas, sesgo medio (previsto − real),
// error absoluto medio y error típico de la media.
export function sesgoCondiciones(muestras) {
  const grupos = new Map();
  for (const m of muestras) {
    const k = `${m.zona}|${m.variable}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  }
  return [...grupos.entries()].map(([k, ms]) => {
    const [zona, variable] = k.split("|");
    const n = ms.length;
    const media = ms.reduce((a, m) => a + m.error, 0) / n;
    const mae = ms.reduce((a, m) => a + Math.abs(m.error), 0) / n;
    const sd = n > 1 ? Math.sqrt(ms.reduce((a, m) => a + (m.error - media) ** 2, 0) / (n - 1)) : null;
    return {
      zona, variable, unidad: VARIABLES[variable].unidad, n,
      personas: new Set(ms.map((m) => (m.propio ? "dueño" : m.usuario))).size,
      sesgo: +media.toFixed(2), error_medio: +mae.toFixed(2), error_tipico: sd === null ? null : +(sd / Math.sqrt(n)).toFixed(3),
    };
  }).sort((a, b) => a.zona.localeCompare(b.zona) || a.variable.localeCompare(b.variable));
}

// Lo que se puede publicar en el repo público (5 personas o más).
export function publicarCondiciones(grupos, cfg = CONFIG_CONDICIONES) {
  return grupos.filter((g) => g.personas >= cfg.min_personas);
}

// Grupos con muestra suficiente y sesgo claro (al menos 3 errores típicos):
// candidatos a propuesta de corrección, nunca aplicados solos.
export function candidatosCorreccion(grupos, cfg = CONFIG_CONDICIONES) {
  return grupos.filter((g) => g.n >= cfg.min_muestras && g.personas >= cfg.min_personas && g.error_tipico && Math.abs(g.sesgo) >= 3 * g.error_tipico);
}
