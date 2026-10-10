// scripts/aprendizaje/sesgo-temp-agua.mjs
//
// Sesgo del modelo de temperatura del agua por zona (2026-10-10, pedido de
// Mikel): diferencia media sonda − modelo (Open-Meteo de la serie de la
// salida, capa IBI de Copernicus y boya si se usó), con n y personas
// distintas. Puro, sin red.
//
// Entradas: las salidas del diario con indice_factores.temp_agua_sonda
// (assets/js/temp-agua-sonda.js) y los puntos de calibración del repo
// (datos-robots/calibracion-temp-agua.jsonl, aportados por el dueño).
//
// PRIVACIDAD (repo público): un grupo zona × modelo solo se publica con 5
// personas distintas o más (el dueño cuenta como una). A diferencia del resto
// del aprendizaje, aquí NO se publican los grupos que son solo del dueño:
// los ve él en admin.html, calculados en su navegador con sus salidas.
//
// Propuesta (nunca se aplica sola): corregir el sesgo de un modelo en una
// zona, solo si supera TODAS las barreras de aprendizaje/config.json →
// sesgo_temp_agua: muestra mínima, 5 personas, sesgo de al menos min_sesgo_c,
// z_min errores típicos, y el mismo signo (con al menos la mitad del tamaño)
// en el 30 % más reciente.

import { sesgoPorZona, estadistica, muestraDeSalida, muestraDeCalibracion } from "../../assets/js/temp-agua-sonda.js";
import { regionPorCoordenadas } from "../../assets/js/ventana-actividad.js";
import { propuesta } from "./propuestas.mjs";

export const CONFIG_SESGO = { min_muestras: 30, min_personas: 5, min_sesgo_c: 0.3, z_min: 3, fraccion_prueba: 0.3 };
const NOMBRE_MODELO = { open_meteo: "Open-Meteo", ibi: "Copernicus IBI (capa 🌡)", boya: "las boyas" };

const zonaDe = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon) ? regionPorCoordenadas(lat, lon) : null);

// Muestras de las salidas del diario y de los puntos de calibración.
export function muestrasTempAgua({ salidas = [], calibracion = [], excluir = new Set(), propios = new Set() }) {
  return [
    ...salidas.map((s) => muestraDeSalida(s, { propios, excluir, zonaDe })),
    ...calibracion.map((l) => muestraDeCalibracion(l, { zonaDe })),
  ].filter(Boolean);
}

// Evalúa cada grupo zona × modelo frente a las barreras.
export function evaluarSesgo(muestras, config = {}) {
  const cfg = { ...CONFIG_SESGO, ...config };
  return sesgoPorZona(muestras).map((g) => {
    const motivos = [];
    if (g.personas < cfg.min_personas) motivos.push(`${g.personas} persona${g.personas === 1 ? "" : "s"} (mínimo ${cfg.min_personas})`);
    if (g.n < cfg.min_muestras) motivos.push(`${g.n} medidas (mínimo ${cfg.min_muestras})`);
    if (g.media !== null && Math.abs(g.media) < cfg.min_sesgo_c) motivos.push(`sesgo de ${g.media} °C (mínimo ±${cfg.min_sesgo_c})`);
    const z = g.se ? g.media / g.se : null;
    if (z === null || Math.abs(z) < cfg.z_min) motivos.push(`${z === null ? "sin" : Math.abs(z).toFixed(1)} errores típicos (mínimo ${cfg.z_min})`);
    const orden = [...g.filas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const reciente = estadistica(orden.slice(Math.round(orden.length * (1 - cfg.fraccion_prueba))).map((f) => f.x));
    if (!(reciente.n && Math.sign(reciente.media) === Math.sign(g.media) && Math.abs(reciente.media) >= Math.abs(g.media) / 2)) {
      motivos.push("no se sostiene en las medidas más recientes");
    }
    const { filas, ...resto } = g;
    return { ...resto, z: z === null ? null : Math.round(z * 10) / 10, reciente: { n: reciente.n, media: reciente.media }, supera: motivos.length === 0, motivos };
  });
}

// Lo que va al repo público: solo grupos de 5 personas o más.
export function publicarSesgo(grupos, config = {}) {
  const cfg = { ...CONFIG_SESGO, ...config };
  return grupos.map((g) => (g.personas >= cfg.min_personas
    ? { zona: g.zona, modelo: g.modelo, n: g.n, personas: g.personas, media_c: g.media, sd_c: g.sd, z: g.z, reciente: g.reciente, supera_barreras: g.supera, motivos: g.motivos }
    : { zona: g.zona, modelo: g.modelo, oculto: true, motivo: g.solo_dueño ? "solo medidas del dueño: las ve en admin" : "menos de 5 personas distintas" }));
}

// Propuestas para aprendizaje/propuestas.json (siempre con sí).
export function propuestasSesgo(grupos, { hoy }) {
  return grupos.filter((g) => g.supera).map((g) => {
    const corr = Math.round(g.media * 10) / 10;
    return propuesta({
      clave: `sesgo-temp-agua-${g.modelo}-${g.zona}`, fecha: hoy, tipo: "dato", impacto: 2, esfuerzo: "bajo",
      titulo: `Temperatura del agua de ${NOMBRE_MODELO[g.modelo]} en ${g.zona}: ${corr > 0 ? "sumar" : "restar"} ${Math.abs(corr).toString().replace(".", ",")} °C`,
      explicacion_llana: `Las sondas de la gente miden el agua ${corr > 0 ? "más caliente" : "más fría"} de lo que dice ${NOMBRE_MODELO[g.modelo]} en ${g.zona}, de forma constante. Propuesta: corregir ese modelo en esa zona en lo que enseña la app y en lo que usa el índice.`,
      deshacer: "quitar la corrección de esa zona y modelo.",
      evidencia: `${g.n} medidas de ${g.personas} personas; sonda − modelo ${g.media} ± ${g.se} °C (${Math.abs(g.z)} errores típicos); en las más recientes ${g.reciente.media} °C (${g.reciente.n})`,
      evidencia_n: g.n, riesgo: "medio: cambia la temperatura del agua que ve la gente y la que usa el índice",
      detalle: { tipo: "sesgo_temp_agua", zona: g.zona, modelo: g.modelo, correccion_c: corr, n: g.n, personas: g.personas },
    });
  });
}
