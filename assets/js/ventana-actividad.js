// assets/js/ventana-actividad.js
//
// "Ventana de actividad" por especie y spot, hora a hora, y el índice de pesca
// del spot. Pedido de Mikel (2026-10-07; escala logística v2 el 2026-10-08).
// Reglas fijas y transparentes, SIN IA en tiempo de ejecución (regla de coste:
// cero tokens de la API al usar la app).
//
// Qué hace: para cada hora calcula una puntuación 0-100 y la lista de
// motivos que la explican ("marea subiendo", "amanecer", "agua turbia",
// "mar de 1-1,5 m"...). Cada motivo lleva su aporte en puntos, así que el
// número nunca es una caja negra: 50 + la suma de los aportes mostrados da
// exactamente la puntuación.
//
// ESCALA v2 (logística, 2026-10-08, diseño aprobado por Mikel):
//
//   P = 100 · σ(b0 + Σ wᵢ · fᵢ(xᵢ)),   fᵢ ∈ [-1, 1],   σ(x) = 1 / (1 + e^-x)
//
// Los pesos wᵢ están en log-odds (`peso_lo` en especies.json) y valen el
// peso antiguo en puntos / 25: cerca de 50 la logística tiene pendiente 25
// puntos por unidad de log-odds, así que las puntuaciones típicas apenas
// cambian, pero ya no hay que recortar a 0-100 (la curva se satura sola) y
// los factores se componen como probabilidades, no como puntos sueltos.
// El "porqué" se sigue enseñando en puntos: el total P - 50 se reparte entre
// los factores en proporción a su log-odds (pendiente de la secante de σ, la
// misma para todos: conserva el signo de cada factor y la suma exacta).
//
// Filtros duros, FUERA de la fórmula: veda (la especie no entra), freza
// (aviso "devuélvelo", nunca suma), tope de seguridad por VIENTO en
// embarcación (kayak / embarcación pequeña; se aplica al final y se enseña
// como un motivo más), submarina de noche = 0, y datos caducados -> S/D (lo
// decide quien llama, con la vigencia del spot).
//
// Ola peligrosa (decisión de Mikel, 2026-10-08): la altura de ola ya NO pone
// tope a la nota. La nota se calcula igual (el factor de oleaje sigue
// puntuando) y, aparte, el resultado lleva `avisoOla` ("⚠️ Ola peligrosa
// desde costa (2,5-3 m): extrema la precaución"), que NO es un motivo con
// flecha: se pinta como una nota de aviso separada. Umbrales (estrictamente
// por encima de `oleaje.max_seguro_m` de la modalidad): costa 2,5 m,
// embarcación 2,5 m, submarina 1,5 m.
//
// Reglas expertas (assets/js/reglas-expertas.js + `reglas_expertas` del
// JSON): suman su efecto en log-odds como un factor más, con su texto y su
// fuente ("Mikel (experiencia local de pesca)"), y pueden sustituir un factor
// base en su ámbito (p. ej. la tendencia de presión de 3 h).
//
// Los pesos y preferencias de cada especie NO están aquí: viven en
// assets/datos/especies.json (campo `reglas`), cada uno con su `fuente` o su
// `criterio` (y marcado como heurística experta cuando lo es). Este módulo
// solo aplica esas reglas a los datos que Costaviva ya tiene: nivel del mar
// por hora (marea), amanecer/anochecer (calculados aquí, astronomía pura),
// temperatura del agua, oleaje, viento, tendencia de la presión y turbidez.
//
// MAREA EN CUALQUIER COSTA (corrección de Mikel, 2026-10-07): Costaviva cubre
// toda España y Portugal. En el Mediterráneo la marea es de unos centímetros,
// así que el factor de marea se ESCALA con el rango de marea real del spot
// (máx - mín del nivel del mar en las 24 h alrededor de cada hora, del propio
// Open-Meteo de ese punto) frente a un rango de referencia. Con 0,2 m de rango
// el factor vale casi 0 y la marea no decide nada; en el Cantábrico, con 3-4 m,
// pesa entero.
//
// Módulo ES puro (sin DOM ni red): lo usan index.html y diario.html en el
// navegador y test/ventana-actividad.test.js, test/modalidades.test.js y
// test/indice-pesca-v2.test.js en node --test.

import { reglasEnAmbito, evaluarReglas, iluminacionLunar, coeficienteMareaAstronomico, usaFrentes } from "./reglas-expertas.js";
import { contextoReglas } from "./batimetria-calculo.js";
import { t, I18n } from "./i18n-modulo.js";

// Idiomas (2026-10-09): cada motivo lleva su `clave` y sus `vars` (assets/i18n,
// "va.*") además del `texto` ya traducido al idioma de la app, y `textoEs`, el
// mismo motivo en español: es el que se guarda en el diario y el que mira
// paraUsuario() para separar lo interno. Las reglas expertas traen su texto
// de los datos (texto, y texto_en cuando la fase de datos lo añada).
const tx = (clave, vars) => ({ clave, vars: vars || null, texto: t(clave, vars), textoEs: t(clave, vars, "es") });
import {
  regionPescaPorCoordenadas, zonaPorCoordenadas, minutosLocales, msAproxDeEtiqueta, usaDatosGenerales, ZONA_POR_DEFECTO,
  paisDeRegion, AREAS_NZ,
} from "./regiones.js";

export const VERSION = "2026-10-08";
// Se guarda en cada salida del diario (salidas_pesca.indice_version) para
// poder calibrar cada versión de la fórmula por separado.
export const INDICE_VERSION = "v2-logistica-2026-10-08";
export const PUNTOS_POR_LOGODDS = 25;

export const sigmoide = (x) => 1 / (1 + Math.exp(-x));

// Peso de un factor en log-odds. `peso_lo` es lo normal desde la v2; un
// `peso` suelto (en puntos, formato antiguo) se convierte /25 para que una
// ficha vieja o una edición a mano no rompa nada.
export function pesoLogOdds(regla) {
  if (!regla) return 0;
  if (typeof regla.peso_lo === "number") return regla.peso_lo;
  if (typeof regla.peso === "number") return regla.peso / PUNTOS_POR_LOGODDS;
  return 0;
}

// Reparte P - base entre los términos (en log-odds) en puntos enteros que
// suman exactamente round(P) - base (método del resto mayor).
export function repartirAportes(los, b0 = 0) {
  const X = los.reduce((s, x) => s + x, 0);
  const s0 = sigmoide(b0);
  const p = 100 * sigmoide(b0 + X);
  const base = Math.round(100 * s0);
  const k = Math.abs(X) > 1e-9 ? (p - 100 * s0) / X : 100 * s0 * (1 - s0);
  const crudos = los.map((x) => k * x);
  const objetivo = Math.round(p) - base;
  const enteros = crudos.map((x) => Math.trunc(x));
  let falta = objetivo - enteros.reduce((s, x) => s + x, 0);
  const orden = crudos.map((x, i) => ({ i, r: x - Math.trunc(x) }))
    .sort((a, b) => (falta > 0 ? b.r - a.r : a.r - b.r));
  for (let j = 0; falta !== 0 && j < orden.length * 2; j++) {
    const { i } = orden[j % orden.length];
    if (los[i] === 0) continue;
    enteros[i] += Math.sign(falta);
    falta -= Math.sign(falta);
  }
  return { puntuacion: Math.round(p), probabilidad: p, base, aportes: enteros };
}

// Curva gaussiana de la temperatura del agua alrededor del óptimo de la
// especie (centro del rango documentado, σ = media anchura del rango):
// 1 en el centro, ~0,2 en los bordes del rango, tiende a -1 lejos.
export function factorTemperatura(t, [tmin, tmax]) {
  const mu = (tmin + tmax) / 2;
  const sigma = Math.max(0.5, (tmax - tmin) / 2);
  return 2 * Math.exp(-((t - mu) ** 2) / (2 * sigma ** 2)) - 1;
}

// ---------------------------------------------------------------------------
// Regiones de especies.json (las de la Península e islas). La región de un
// punto y su zona horaria viven en regiones.js (2026-10-09); se reexporta
// regionPorCoordenadas para no romper a quien la importa de aquí.
// ---------------------------------------------------------------------------
export const REGIONES = [
  "cantabrico", "atlantico_norte", "portugal", "golfo_cadiz",
  "mediterraneo", "baleares", "canarias", "azores", "madeira",
];

// Áreas de MPI de Nueva Zelanda (fase 2 de NZ): presencia y freza de las
// especies de NZ. Aparte de REGIONES para que nada de España las recorra.
export const REGIONES_NZ = AREAS_NZ;

// Región de PESCA (2026-10-09, fase 2 de NZ): la de siempre en España y
// Portugal; en NZ, el área de MPI (nz_central...), que es la que llevan las
// especies de NZ. Se exporta con el nombre de siempre para que el mapa, el
// SEO y los scripts de especies no cambien.
const regionPorCoordenadas = regionPescaPorCoordenadas;
export { regionPorCoordenadas };

// País de una especie (especies.json `pais`; sin él, España/Portugal). El
// índice de una región solo mira las especies de su país: las de NZ nunca
// salen en España y al revés.
export const paisEspecie = (e) => e?.pais || "es";
const delPais = (e, region) => paisEspecie(e) === paisDeRegion(region);

// ---------------------------------------------------------------------------
// Sol: amanecer y anochecer (algoritmo de la NOAA, precisión ~1 min).
// Las horas se comparan en minutos desde la medianoche en la zona del punto
// (regiones.js), que es la misma con la que se pide a Open-Meteo la serie.
// ---------------------------------------------------------------------------
const RAD = Math.PI / 180;

function diaJuliano(fechaUTCms) {
  return fechaUTCms / 86400000 + 2440587.5;
}

// fechaISO: "AAAA-MM-DD" (día local). Devuelve { amanecer, anochecer } en
// milisegundos UTC, o null si ese día no hay amanecer (no pasa en Iberia).
export function solDelDia(fechaISO, lat, lon) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const mediodiaUTC = Date.UTC(a, m - 1, d, 12, 0, 0);
  const n = Math.round(diaJuliano(mediodiaUTC) - 2451545.0 + 0.0008);
  const jEstrella = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jEstrella) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransito = 2451545.0 + jEstrella + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  const aMs = (j) => (j - 2440587.5) * 86400000;
  return { amanecer: aMs(jTransito - w / 360), anochecer: aMs(jTransito + w / 360) };
}

// Minutos desde la medianoche local en `zona` (por defecto la de Madrid).
export function minutosLocal(ms, zona = ZONA_POR_DEFECTO) {
  return minutosLocales(ms, zona);
}
// Compatibilidad: minutos en hora de Madrid.
// Hora de Madrid a propósito: compatibilidad con quien la importaba.
export function minutosMadrid(ms) {
  return minutosLocales(ms, "Europe/Madrid");
}

export function textoHora(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Estado de la luz para una hora local (minuto central de la hora) en `zona`.
// alba/ocaso = ±60 min alrededor del amanecer/anochecer.
export function estadoLuz(minutoLocal, sol, zona = ZONA_POR_DEFECTO) {
  if (!sol) return "dia";
  const am = minutosLocales(sol.amanecer, zona);
  const an = minutosLocales(sol.anochecer, zona);
  if (Math.abs(minutoLocal - am) <= 60) return "alba";
  if (Math.abs(minutoLocal - an) <= 60) return "ocaso";
  if (minutoLocal > am && minutoLocal < an) return "dia";
  return "noche";
}

// ---------------------------------------------------------------------------
// Luna: fase aproximada (mes sinódico desde una luna nueva conocida). Solo
// informativa en el índice base: peso 0 por defecto (ver reglas_por_defecto.luna en el JSON).
// Las reglas expertas usan la fracción iluminada (iluminacionLunar, variable `luna`).
// ---------------------------------------------------------------------------
const LUNA_NUEVA_REF = Date.UTC(2000, 0, 6, 18, 14);
const MES_SINODICO = 29.530588853;
export function faseLunar(ms) {
  const dias = (ms - LUNA_NUEVA_REF) / 86400000;
  const f = ((dias / MES_SINODICO) % 1 + 1) % 1;
  const nombre = f < 0.03 || f > 0.97 ? "luna nueva"
    : f < 0.22 ? "creciente" : f < 0.28 ? "cuarto creciente"
    : f < 0.47 ? "gibosa creciente" : f < 0.53 ? "luna llena"
    : f < 0.72 ? "gibosa menguante" : f < 0.78 ? "cuarto menguante" : "menguante";
  return { fraccion: +f.toFixed(3), nombre };
}

// ---------------------------------------------------------------------------
// Marea a partir del nivel del mar por hora (sea_level_height_msl).
// Para cada hora: tendencia, si está cerca de un extremo (repunte, ±1 h de
// pleamar o bajamar) y el rango local (máx - mín en ±12 h).
// ---------------------------------------------------------------------------
export function analizarMarea(niveles) {
  const n = niveles.length;
  return niveles.map((v, i) => {
    if (v === null || v === undefined) return null;
    const desde = Math.max(0, i - 12), hasta = Math.min(n - 1, i + 12);
    let min = Infinity, max = -Infinity;
    for (let k = desde; k <= hasta; k++) {
      const x = niveles[k];
      if (x === null || x === undefined) continue;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    const rango = max - min;
    const prev = niveles[i - 1], next = niveles[i + 1];
    let tendencia = null;
    if (next !== null && next !== undefined) tendencia = next > v ? "subiendo" : "bajando";
    else if (prev !== null && prev !== undefined) tendencia = v > prev ? "subiendo" : "bajando";
    // Repunte: esta hora o una vecina es un máximo/mínimo local.
    const esExtremo = (k) => {
      const a = niveles[k - 1], b = niveles[k], c = niveles[k + 1];
      if ([a, b, c].some((x) => x === null || x === undefined)) return false;
      return (b >= a && b >= c) || (b <= a && b <= c);
    };
    const repunte = [i - 1, i, i + 1].some((k) => k > 0 && k < n - 1 && esExtremo(k));
    return { tendencia, repunte, rango: +rango.toFixed(2) };
  });
}

// ---------------------------------------------------------------------------
// Utilidades de reglas
// ---------------------------------------------------------------------------
function fusionarReglas(defecto, especie) {
  const r = {};
  for (const k of new Set([...Object.keys(defecto || {}), ...Object.keys(especie || {})])) {
    r[k] = { ...(defecto?.[k] || {}), ...(especie?.[k] || {}) };
    // Un override en el formato antiguo (`peso` en puntos) manda sobre el
    // `peso_lo` heredado: se normaliza todo a log-odds.
    const sobre = especie?.[k];
    if (sobre && typeof sobre.peso === "number" && typeof sobre.peso_lo !== "number") r[k].peso_lo = sobre.peso / PUNTOS_POR_LOGODDS;
    delete r[k].peso;
    if (defecto?.[k]?.preferencia || especie?.[k]?.preferencia) {
      r[k].preferencia = { ...(defecto?.[k]?.preferencia || {}), ...(especie?.[k]?.preferencia || {}) };
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Modalidades de pesca (2026-10-08, pedido de Mikel): "Desde costa",
// "Embarcación" y "Submarina". Una especie puede estar en varias (la lubina,
// en las tres; el bonito, solo en embarcación): es muchos-a-muchos, no una
// clasificación exclusiva. Datos en especies.json: `modalidades` de cada
// especie (aplica true/false/null con fuente o criterio), `reglas_por_modalidad`
// (pesos propios de cada pestaña) y `normativa_modalidades`.
// ---------------------------------------------------------------------------
export const MODALIDADES = ["costa", "embarcacion", "submarina"];
export const NOMBRE_MODALIDAD = { costa: t("va.mod.costa"), embarcacion: t("va.mod.embarcacion"), submarina: t("va.mod.submarina") };

// true solo con dato afirmativo: `aplica: null` (sin dato) no se muestra,
// para no proponer una especie que no se pesca así ("no tiene sentido poner
// Mundaka y que me aparezca bonito"). `regiones_excluidas` afina por región.
export function aplicaModalidad(especie, modalidad, region = null) {
  const m = especie.modalidades?.[modalidad];
  if (!m || m.aplica !== true) return false;
  if (region && Array.isArray(m.regiones_excluidas) && m.regiones_excluidas.includes(region)) return false;
  if (region && Array.isArray(m.regiones) && !m.regiones.includes(region)) return false;
  return true;
}

// Consejo corto de profundidad por temporada de una modalidad (hoy solo
// embarcación: pargo, dorada y dentón, observación de campo de Mikel):
// "Verano: a unos 20 m · Invierno: más profundo", o null sin dato.
export function consejoProfundidad(especie, modalidad) {
  const p = especie?.modalidades?.[modalidad]?.profundidad_temporada;
  if (!p || (!p.verano && !p.invierno)) return null;
  const verano = I18n.dato(p, "verano"), invierno = I18n.dato(p, "invierno");
  return [verano && t("va.prof.verano", { texto: verano }), invierno && t("va.prof.invierno", { texto: invierno })].filter(Boolean).join(" · ");
}

// Reglas efectivas de una especie en una modalidad:
//   reglas_por_defecto <- reglas_por_modalidad[m] <- reglas de la especie
// salvo en los `factores_de_modalidad` (oleaje, viento, turbidez...), donde
// manda la modalidad: que a la lubina le guste el agua tomada desde la orilla
// no puede hacer que el agua turbia sume buceando.
export function reglasParaModalidad(reglasDefecto, especie, modalidad = "costa", reglasPorModalidad = null) {
  const rm = reglasPorModalidad?.[modalidad] || {};
  const propios = new Set(rm.factores_de_modalidad || []);
  const deModalidad = Object.fromEntries(Object.entries(rm).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)));
  const base = fusionarReglas(reglasDefecto, deModalidad);
  const deEspecie = Object.fromEntries(Object.entries(especie.reglas || {}).filter(([k]) => !propios.has(k)));
  return fusionarReglas(base, deEspecie);
}

// "1,5" en español, "1.5" en inglés (I18n.num sin decimales fijos).
const fmt1 = (x, idioma) => I18n.num(x, undefined, idioma);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Aviso de ola peligrosa (2026-10-08, decisión de Mikel): nota aparte, nunca
// motivo con flecha ni tope. Salta estrictamente por encima del
// `max_seguro_m` de la modalidad (costa 2,5 m, embarcación 2,5 m, submarina
// 1,5 m). Devuelve null si la ola no llega o no hay regla de oleaje.
export function avisoOlaPeligrosa(ola, reglasOleaje) {
  if (ola === null || ola === undefined || !reglasOleaje) return null;
  const umbral = reglasOleaje.max_seguro_m || 2.5;
  if (!(ola > umbral)) return null;
  const peligro = I18n.dato(reglasOleaje, "texto_peligro") || t("va.ola.peligro_defecto");
  const rango = rangoOla(ola, true);
  const m = tx("va.ola.aviso", { peligro, rango: rango.texto });
  return { texto: m.texto, clave: m.clave, vars: m.vars, umbral_m: umbral, ola: +ola.toFixed(1) };
}

// Lo que ve el USUARIO del porqué (Mikel, 2026-10-08): solo los motivos con
// flecha (▲▲ / ▲ / ▼ / ▼▼, el doble desde 6 puntos) y los avisos útiles
// (legal: submarina de noche o a caballo del orto/ocaso; seguridad: kayak /
// embarcación pequeña). Lo neutro (aporte 0, el "·"), lo interno ("pendiente
// de fuente", "no cuenta", fuentes, fiabilidad...) va solo al "Detalle
// (admin)". El aviso de ola peligrosa va aparte (`avisoOla`).
const FACTORES_AVISO_USUARIO = new Set(["legal", "seguridad"]);
export const TEXTO_INTERNO = /pendiente|no cuenta|fuente|por validar|fiabilidad|sin dato/i;
export function flechaDeAporte(aporte) {
  if (aporte >= 6) return "▲▲";
  if (aporte > 0) return "▲";
  if (aporte <= -6) return "▼▼";
  if (aporte < 0) return "▼";
  return "";
}
// Lo interno se reconoce por el texto en español (textoEs), sea cual sea el
// idioma en que se enseñe.
export function paraUsuario(razones, { max = Infinity } = {}) {
  const limpias = (razones || []).filter((r) => r && r.texto && !TEXTO_INTERNO.test(r.textoEs || r.texto));
  const motivos = limpias
    .filter((r) => r.aporte && !FACTORES_AVISO_USUARIO.has(r.factor))
    .sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte))
    .slice(0, max)
    .map((r) => ({ texto: r.texto, aporte: r.aporte, flecha: flechaDeAporte(r.aporte), sube: r.aporte > 0, ...(r.clave ? { clave: r.clave, vars: r.vars } : {}) }));
  const avisos = [...new Set(limpias.filter((r) => FACTORES_AVISO_USUARIO.has(r.factor))
    .map((r) => `⚠️ ${r.texto.replace(/^⚠\uFE0F?\s*/, "")}`))];
  return { motivos, avisos };
}

// Oleaje de una hora como motivo: "mar de 1-1,5 m" / "1-1.5 m sea". soloRango:
// sin "mar de" (para el aviso de ola peligrosa).
function rangoOla(h, soloRango = false) {
  if (h < 0.5) return tx(soloRango ? "va.ola.rango_plana" : "va.ola.plana");
  const a = Math.floor(h * 2) / 2;
  return tx(soloRango ? "va.ola.rango" : "va.ola.mar_de", { a: fmt1(a), b: fmt1(a + 0.5) });
}

// ---------------------------------------------------------------------------
// Cálculo principal.
//
// especie: entrada de especies.json (usa .reglas y .temperatura_agua).
// reglasDefecto: especies.json.reglas_por_defecto.
// horas: [{ hora: "AAAA-MM-DDTHH:00", nivelMar, ola, viento, vientoDir, tempAgua, presion, lluvia }]
//   (serie continua, hora local de `contexto.zona`; puede empezar días antes del que
//   se quiere pintar para tener las tendencias y los retardos de las reglas).
// horas[].lluvia (mm en esa hora) y horas[].vientoDir (grados, de dónde
// viene) son opcionales: sin ellos, lo que los usa no aplica.
// contexto: { lat, lon, turbidez: "no turbia"|"turbia"|"muy turbia"|null,
//   modalidad: "costa"|"embarcacion"|"submarina" (por defecto costa),
//   reglasModalidad: especies.json.reglas_por_modalidad,
//   reglasExpertas: especies.json.reglas_expertas (opcional),
//   region (si no, por coordenadas),
//   zona: zona horaria de las etiquetas de `horas` (si no, la de las
//     coordenadas, ver regiones.js: Madrid, Canarias, Lisboa, Azores...),
//   fondo: { orilla_tipo, fondo_roca, ... } | null (capa-tipo-fondo.js; ignorado en embarcación),
//   caudalRio: "bajo"|"normal"|"alto"|null (río asociado al spot, solo hoy),
//   rio: { nombre, distancia_desembocadura_km } | null (null = sin río conocido),
//   batimetria: estadísticas de fondo del spot (estadisticasPunto de
//     batimetria-calculo.js: zona_m, prof_max_5km_m, dist_10_30m_m) | null,
//   frentes: { fecha, frente_km, frente_clorofila_km, clorofila_nivel, corriente_ms } | null
//     (〰 Frentes del día en el spot, contextoFrentes de frentes.js; solo vale
//     para las horas de su fecha y del día siguiente, ver frentesDelDia),
//   horaActual: "AAAA-MM-DDTHH:00" (para la fiabilidad: horizonte de previsión),
//   b0: término independiente en log-odds (especies.json.indice.b0_logodds, 0 = 50),
//   soloIndice: i (opcional: calcula solo esa hora; las demás salen null) }
// Devuelve un array paralelo a `horas` con { hora, puntuacion, razones, ... }.
// ---------------------------------------------------------------------------
const TIPOS_CIENTIFICOS = new Set(["cientifica", "oficial"]);
// Variable que puntúa cada factor base. Una regla experta declara la suya en
// `variable`; si coincide con la de un factor base, debe sustituirlo
// (`sustituye`), y dos reglas de la misma variable deben ser excluyentes:
// cada variable cuenta UNA vez (test/indice-pesca-v2.test.js lo comprueba).
export const VARIABLE_DE_FACTOR = {
  luz: "luz", marea: "nivel_mar", temperatura: "temp_agua", oleaje: "ola", viento: "viento",
  presion: "presion", turbidez: "turbidez", lluvia: "lluvia", caudal_rio: "caudal_rio",
};

// Variables de fondo y orilla que puede traer `contexto.fondo` (ver
// capa-tipo-fondo.js, contextoFondo). Nunca en embarcación.
const VARIABLES_FONDO_REGLAS = ["orilla_tipo", "fondo_roca", "fondo_arena", "fondo_fango", "fondo_grava", "posidonia", "algas"];

// Contexto de 〰 Frentes para una hora: solo si la capa es de ese día o del
// anterior (la clorofila del satélite llega con 1-2 días de retraso; el
// fichero se rehace cada mañana). Otro día = sin dato.
export function frentesDelDia(f, dia) {
  const vacio = { frente_km: null, frente_clorofila_km: null, clorofila_nivel: null, corriente_ms: null };
  if (!f || !f.fecha || !dia) return vacio;
  const dias = (Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${f.fecha}T12:00:00Z`)) / 86400000;
  if (!(dias >= 0 && dias <= 1)) return vacio;
  return {
    frente_km: f.frente_km ?? null, frente_clorofila_km: f.frente_clorofila_km ?? null,
    clorofila_nivel: f.clorofila_nivel ?? null, corriente_ms: f.corriente_ms ?? null,
  };
}

export function calcularVentana(especie, reglasDefecto, horas, contexto) {
  const modalidad = contexto.modalidad || "costa";
  const reglas = reglasParaModalidad(reglasDefecto, especie, modalidad, contexto.reglasModalidad);
  const rm = contexto.reglasModalidad?.[modalidad] || {};
  const region = contexto.region || regionPorCoordenadas(contexto.lat, contexto.lon);
  const zona = contexto.zona || zonaPorCoordenadas(contexto.lat, contexto.lon);
  const b0 = contexto.b0 ?? 0;
  const marea = analizarMarea(horas.map((h) => h.nivelMar ?? null));
  const solCache = {};
  // Un rango cuya única fuente es no comercial (FishBase, CC BY-NC) se
  // conserva en el JSON marcado como pendiente, pero NO puntúa.
  const tempExcluida = !!especie.temperatura_agua?.excluir_del_calculo;
  const rangoTemp = tempExcluida ? null : (especie.temperatura_agua?.rango || null);
  const tempCientifica = !!rangoTemp && especie.temperatura_agua?.verificado === true
    && !(especie.temperatura_agua.fuentes || []).includes("app_index");

  return horas.map((h, i) => {
    if (contexto.soloIndice !== undefined && contexto.soloIndice !== null && i !== contexto.soloIndice) return null;
    const dia = h.hora.slice(0, 10);
    const mes = Number(h.hora.slice(5, 7));
    const minuto = Number(h.hora.slice(11, 13)) * 60 + 30;
    solCache[dia] ||= solDelDia(dia, contexto.lat, contexto.lon);
    // Términos en log-odds: { factor, texto, lo, cientifico }
    const terminos = [];
    const topes = [];
    // Peso total de los factores que deberían contar y peso de los que
    // tienen dato (para la fiabilidad: "% del peso con dato").
    const cobertura = { total: 0, conDato: 0 };
    const ambito = { especieId: especie.id, modalidad, region, mes };
    const { reglas: expertas, sustituidos } = reglasEnAmbito(contexto.reglasExpertas, ambito);
    const cuenta = (factor, hayDato) => {
      if (sustituidos.has(factor)) return false;
      const w = Math.abs(pesoLogOdds(reglas[factor]));
      if (!w) return hayDato;
      cobertura.total += w;
      if (hayDato) cobertura.conDato += w;
      return hayDato;
    };
    // m: motivo con clave (tx); se guarda su texto, su texto en español y su clave.
    const anota = (factor, valor, m, cientifico = false) => {
      if (sustituidos.has(factor)) return;
      const r = reglas[factor];
      const w = pesoLogOdds(r);
      if (!r || !w) {
        if (m) terminos.push({ factor, ...m, lo: 0 });
        return;
      }
      terminos.push({ factor, ...m, lo: w * clamp(valor, -1, 1), cientifico: cientifico || TIPOS_CIENTIFICOS.has(r.tipo) });
    };

    // Submarina: prohibida de noche (art. 16.d RD 347/2011; art. 8.3
    // Portaria 14/2014). Una hora entera de noche puntúa 0 y no se calcula
    // nada más; una hora a caballo lo avisa.
    let prohibida = false;
    const notas = [];
    if (rm.solo_de_dia && solCache[dia]) {
      const am = minutosLocales(solCache[dia].amanecer, zona), an = minutosLocales(solCache[dia].anochecer, zona);
      const ini = minuto - 30, fin = minuto + 30;
      if (fin <= am || ini >= an) prohibida = true;
      else if (ini < am) notas.push({ factor: "legal", ...tx("va.legal.desde_sol", { hora: textoHora(am) }), aporte: 0 });
      else if (fin > an) notas.push({ factor: "legal", ...tx("va.legal.hasta_sol", { hora: textoHora(an) }), aporte: 0 });
    }
    if (prohibida) {
      return {
        hora: h.hora, puntuacion: 0, luz: "noche", marea: marea[i], marPeligrosa: false, avisoOla: null, prohibida: true, avisos: [],
        razones: [{ factor: "legal", ...tx("va.legal.noche"), aporte: 0 }],
        cobertura: 1, reglasAplicadas: [], sinDato: [],
      };
    }

    // Luz
    const luz = estadoLuz(minuto, solCache[dia], zona);
    cuenta("luz", true);
    anota("luz", reglas.luz?.preferencia?.[luz] ?? 0, tx(`va.luz.${luz}`));

    // Marea (escalada con el rango local)
    const m = marea[i];
    if (cuenta("marea", !!m) && pesoLogOdds(reglas.marea)) {
      const ref = reglas.marea.rango_referencia_m || 2.5;
      const escala = clamp(m.rango / ref, 0, 1);
      if (escala < 0.25) {
        terminos.push({ factor: "marea", ...tx("va.marea.nula", { rango: fmt1(m.rango) }), lo: 0 });
      } else {
        const estado = m.repunte ? "repunte" : m.tendencia;
        const pref = reglas.marea.preferencia?.[estado] ?? 0;
        anota("marea", pref * escala, tx(`va.marea.${estado}`));
      }
    }

    // Temperatura del agua: curva gaussiana alrededor del óptimo de la especie
    const hayTemp = h.tempAgua !== null && h.tempAgua !== undefined;
    if (tempExcluida && hayTemp) {
      cuenta("temperatura", false);
      terminos.push({ factor: "temperatura", ...tx("va.temp.pendiente", { t: fmt1(h.tempAgua) }), lo: 0 });
    } else if (rangoTemp) {
      if (cuenta("temperatura", hayTemp)) {
        const [tmin, tmax] = rangoTemp;
        const f = factorTemperatura(h.tempAgua, rangoTemp);
        const dentro = h.tempAgua >= tmin && h.tempAgua <= tmax;
        const v = { t: fmt1(h.tempAgua), min: tmin, max: tmax };
        const txt = !dentro ? tx("va.temp.fuera", v) : f >= 0.8 ? tx("va.temp.optimo", v) : tx("va.temp.en_rango", v);
        anota("temperatura", f, txt, tempCientifica);
      }
    } else {
      cuenta("temperatura", false);
      if (modalidad === "submarina" && hayTemp) terminos.push({ factor: "temperatura", ...tx("va.temp.agua", { t: fmt1(h.tempAgua) }), lo: 0 });
    }

    // Oleaje. El aviso de ola peligrosa va APARTE del factor y no toca la
    // nota (sin tope desde el 2026-10-08): se da siempre, también cuando una
    // regla experta sustituye el factor de oleaje (p. ej. "mar algo movida"
    // para los depredadores costeros desde costa).
    const hayOla = h.ola !== null && h.ola !== undefined;
    const avisoOla = hayOla ? avisoOlaPeligrosa(h.ola, reglas.oleaje) : null;
    const marPeligrosa = !!avisoOla;
    if (cuenta("oleaje", hayOla) && pesoLogOdds(reglas.oleaje)) {
      const [omin, omax] = reglas.oleaje.optimo_m || [0, 1.5];
      const maxSeguro = reglas.oleaje.max_seguro_m || 2.5;
      let v;
      if (marPeligrosa) v = -1;
      else if (h.ola > omax) v = -(h.ola - omax) / Math.max(0.1, maxSeguro - omax);
      else if (h.ola < omin) v = reglas.oleaje.valor_bajo_minimo ?? -0.3;
      else v = 1;
      anota("oleaje", v, rangoOla(h.ola));
    }

    // Viento: solo penaliza por encima del máximo cómodo
    if (cuenta("viento", h.viento !== null && h.viento !== undefined) && pesoLogOdds(reglas.viento)) {
      const vmax = reglas.viento.max_kmh || 30;
      if (h.viento > vmax) anota("viento", -clamp((h.viento - vmax) / 20, 0.2, 1), tx("va.viento.fuerte", { v: Math.round(h.viento) }));
    }

    // Embarcación: avisos de seguridad (kayak / embarcación pequeña). Se
    // avisa del nivel más severo que se supere (por viento o por ola). El
    // tope solo lo pone el VIENTO: el nivel más severo que supere el viento
    // (la ola ya no pone tope: decisión de Mikel, 2026-10-08; para la ola
    // está `avisoOla`).
    const avisos = [];
    if (rm.seguridad?.niveles) {
      const hayViento = h.viento !== null && h.viento !== undefined;
      for (const nv of rm.seguridad.niveles) {
        const porViento = hayViento && h.viento > nv.viento_max_kmh;
        const porOla = hayOla && h.ola > nv.ola_max_m;
        if ((porViento || porOla) && !avisos.length) {
          const motivoEn = (id) => [porViento && t("va.seg.viento", { v: Math.round(h.viento) }, id), porOla && t("va.seg.ola", { v: fmt1(h.ola, id) }, id)].filter(Boolean).join(t("va.seg.y", null, id));
          const nvTexto = I18n.dato(nv, "texto");
          avisos.push({ nivel: nv.id, texto: `${nvTexto} (${motivoEn()})` });
          notas.push({ factor: "seguridad", texto: `⚠ ${nvTexto} (${motivoEn()})`, textoEs: `⚠ ${nv.texto} (${motivoEn("es")})`, aporte: 0 });
        }
        if (porViento) {
          topes.push({ tope: nv.tope, texto: t("va.seg.tope", { nivel: I18n.dato(nv, "texto"), v: Math.round(h.viento), tope: nv.tope }), textoEs: t("va.seg.tope", { nivel: nv.texto, v: Math.round(h.viento), tope: nv.tope }, "es") });
          break;
        }
      }
    }

    // Tendencia de la presión (mismos umbrales que /prevision: ±1 hPa en 3 h)
    const p = h.presion, p3 = horas[i - 3]?.presion;
    const hayPresion = p !== null && p !== undefined && p3 !== null && p3 !== undefined;
    if (cuenta("presion", hayPresion) && pesoLogOdds(reglas.presion)) {
      const d = p - p3;
      const tend = d <= -1 ? "bajando" : d >= 1 ? "subiendo" : "estable";
      anota("presion", reglas.presion.preferencia?.[tend] ?? 0, tx(`va.presion.${tend}`));
    }

    // Turbidez (dato diario por spot, de las webcams)
    if (cuenta("turbidez", !!contexto.turbidez) && pesoLogOdds(reglas.turbidez)) {
      const tb = contexto.turbidez;
      const txt = tb === "no turbia" ? tx("va.turbidez.clara") : tb === "turbia" ? tx("va.turbidez.turbia") : tx("va.turbidez.muy_turbia");
      anota("turbidez", reglas.turbidez.preferencia?.[tb] ?? 0, txt);
    }

    // Lluvia de las 24 h anteriores (enturbia el agua; solo submarina)
    if (pesoLogOdds(reglas.lluvia)) {
      const previas = horas.slice(Math.max(0, i - 24), i).map((x) => x.lluvia).filter((x) => x !== null && x !== undefined);
      if (cuenta("lluvia", previas.length >= 12)) {
        const mm = previas.reduce((a, b) => a + b, 0);
        const [u0, u1] = reglas.lluvia.umbral_mm_24h || [2, 15];
        if (mm >= u0) anota("lluvia", -clamp((mm - u0) / Math.max(0.1, u1 - u0), 0.2, 1), tx("va.lluvia.previa", { mm: fmt1(mm) }));
      }
    }

    // Caudal del río asociado al spot (solo submarina, solo con dato)
    if (pesoLogOdds(reglas.caudal_rio) && cuenta("caudal_rio", !!contexto.caudalRio)
      && reglas.caudal_rio.preferencia?.[contexto.caudalRio] !== undefined) {
      anota("caudal_rio", reglas.caudal_rio.preferencia[contexto.caudalRio], tx(`va.rio.${contexto.caudalRio}`));
    }

    // Reglas expertas (datos de especies.json, motor genérico)
    // Hora local aproximada a UTC con el desfase de invierno de la zona (en
    // Madrid -1 h, como siempre; en verano serían -2): sobra para la luna y el coeficiente.
    const msUTC = msAproxDeEtiqueta(h.hora, zona);
    const ctxReglas = {
      caudal_rio: contexto.caudalRio ?? null,
      rio_desembocadura_km: contexto.rio?.distancia_desembocadura_km ?? null,
      turbidez: contexto.turbidez ?? null,
      ...contextoReglas(contexto.batimetria),
      mes, hora_local: Number(h.hora.slice(11, 13)), luz,
      luna: iluminacionLunar(msUTC),
      coeficiente_marea: coeficienteMareaAstronomico(msUTC),
      // 〰 Frentes del día (contexto.frentes = contextoFrentes de frentes.js,
      // solo el día de la capa): sin capa, todo null y esas reglas no aplican.
      ...frentesDelDia(contexto.frentes, dia),
    };
    // Fondo y orilla (capa-tipo-fondo.js): solo costa y submarina.
    for (const k of VARIABLES_FONDO_REGLAS) ctxReglas[k] = modalidad === "embarcacion" ? null : (contexto.fondo?.[k] ?? null);
    const ev = evaluarReglas(expertas, horas, i, ctxReglas);
    for (const r of expertas) {
      // Sin capa de frentes la regla no aplica y tampoco rebaja la cobertura.
      if (ev.sinDato.includes(r.id) && usaFrentes(r)) continue;
      const w = Math.abs((r.efecto?.logodds || 0) * (r.confianza ?? 1));
      cobertura.total += w;
      if (!ev.sinDato.includes(r.id)) cobertura.conDato += w;
    }
    for (const x of ev.terminos) {
      terminos.push({ factor: x.factor, texto: I18n.dato(x.regla, "texto") || x.texto, textoEs: x.texto, lo: x.lo, cientifico: TIPOS_CIENTIFICOS.has(x.regla.tipo), regla: x.regla });
    }

    // Escala logística y reparto del porqué en puntos
    const rep = repartirAportes(terminos.map((t) => t.lo), b0);
    const razones = terminos.map((x, k) => ({
      factor: x.factor, texto: x.texto, aporte: rep.aportes[k], lo: +x.lo.toFixed(3),
      variable: x.regla ? x.regla.variable : VARIABLE_DE_FACTOR[x.factor],
      ...(x.regla ? { regla: x.regla } : {}),
      ...(x.textoEs !== undefined ? { textoEs: x.textoEs } : {}),
      ...(x.clave ? { clave: x.clave, vars: x.vars } : {}),
    }));
    razones.push(...notas);
    let puntuacion = rep.puntuacion;
    if (topes.length) {
      const peor = topes.reduce((a, b) => (b.tope < a.tope ? b : a));
      if (puntuacion > peor.tope) {
        razones.push({ factor: "tope", texto: t("va.seg.tope_razon", { texto: peor.texto }), textoEs: t("va.seg.tope_razon", { texto: peor.textoEs }, "es"), aporte: peor.tope - puntuacion });
        puntuacion = peor.tope;
      }
    }
    razones.sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte));
    const loTotal = terminos.reduce((s, x) => s + Math.abs(x.lo), 0);
    const loCientifico = terminos.filter((x) => x.cientifico).reduce((s, x) => s + Math.abs(x.lo), 0);
    return {
      hora: h.hora, puntuacion, razones, luz, marea: m, marPeligrosa, avisoOla, prohibida: false, avisos,
      probabilidad: +rep.probabilidad.toFixed(2), base: rep.base,
      cobertura: cobertura.total ? +(cobertura.conDato / cobertura.total).toFixed(2) : 1,
      fraccionCientifica: loTotal ? +(loCientifico / loTotal).toFixed(2) : 0,
      reglasAplicadas: ev.terminos.map((x) => x.regla.id), sinDato: ev.sinDato,
    };
  });
}

// ---------------------------------------------------------------------------
// Fiabilidad (estrellas) por especie × modalidad × región, rebajada por la
// calidad de los datos de esa hora.
//   ★     solo criterio experto (lo normal hoy)
//   ★★    la mayor parte del peso viene de factores con mecanismo científico
//         u oficial citado (regla con tipo "cientifica"/"oficial", o rango de
//         temperatura verificado con fuente propia)
//   ★★★   validado con el diario (`validacion_fiabilidad` del JSON, más adelante)
//   ★★★★  temporada confirmada con desembarcos (ídem)
// Rebajas: previsión a más de 48 h (-1), menos del 60 % del peso con dato
// (-1), datos de modelo y no medidos (-0,5). Nunca baja de 1 estrella: las
// rebajas se dicen siempre en el texto.
// ---------------------------------------------------------------------------
const NIVEL_TEXTO = { 1: t("va.fiab.1"), 2: t("va.fiab.2"), 3: t("va.fiab.3"), 4: t("va.fiab.4") };
export function fiabilidad(resultado, { especieId, modalidad, region, validacion = null, horaActual = null, datosMedidos = false } = {}) {
  if (!resultado) return null;
  let nivel = (resultado.fraccionCientifica ?? 0) >= 0.5 ? 2 : 1;
  const v = validacion?.por_combinacion?.[`${especieId}|${modalidad}|${region}`];
  if (v?.diario) nivel = 3;
  if (v?.diario && v?.desembarcos) nivel = 4;
  const rebajas = [];
  let menos = 0;
  if (horaActual && resultado.hora) {
    const horizonte = (Date.parse(`${resultado.hora}:00Z`) - Date.parse(`${horaActual.slice(0, 13)}:00:00Z`)) / 3600000;
    if (horizonte > 48) { menos += 1; rebajas.push(t("va.fiab.mas_48")); }
  }
  if ((resultado.cobertura ?? 1) < 0.6) { menos += 1; rebajas.push(t("va.fiab.cobertura", { pct: Math.round((resultado.cobertura ?? 0) * 100) })); }
  if (!datosMedidos) { menos += 0.5; rebajas.push(t("va.fiab.modelo")); }
  const estrellas = Math.max(1, nivel - menos);
  const llenas = Math.floor(estrellas), media = estrellas - llenas >= 0.5;
  const simbolo = "★".repeat(llenas) + (media ? "½" : "");
  return {
    nivel, estrellas, rebajas,
    etiqueta: `${simbolo} ${NIVEL_TEXTO[nivel]}${rebajas.length ? ` · ${rebajas.join(", ")}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Índice de pesca del spot (v2): la MEJOR especie de temporada (sin vedas) de
// esa modalidad en esa hora, con su nombre. Unifica el antiguo índice
// (ratio de especies con agua en rango × 70 + presión) con la ventana de
// actividad: el número del panel es la puntuación de la ventana de la especie
// que mejor está ahora.
// ---------------------------------------------------------------------------
export function indiceSpot(datos, horas, i, contexto) {
  const modalidad = contexto.modalidad || "costa";
  const region = contexto.region || regionPorCoordenadas(contexto.lat, contexto.lon);
  const h = horas[i];
  if (!h) return { puntuacion: null, motivo: "sin_hora", version: INDICE_VERSION };
  const mes = Number(h.hora.slice(5, 7));
  const candidatas = especiesDeTemporada(datos, region, mes, modalidad);
  if (!candidatas.length) return { puntuacion: null, motivo: "sin_especies", region, modalidad, version: INDICE_VERSION };
  const ctx = {
    ...contexto, modalidad, region, soloIndice: i,
    reglasModalidad: contexto.reglasModalidad ?? datos.reglas_por_modalidad,
    reglasExpertas: contexto.reglasExpertas ?? datos.reglas_expertas,
    b0: contexto.b0 ?? datos.indice?.b0_logodds ?? 0,
  };
  const ranking = candidatas.map((e) => ({ e, r: calcularVentana(e, datos.reglas_por_defecto, horas, ctx)[i] }))
    .sort((a, b) => b.r.puntuacion - a.r.puntuacion || datos.especies.indexOf(a.e) - datos.especies.indexOf(b.e));
  const mejor = ranking[0];
  const fz = estadoFreza(mejor.e, region, mes);
  return {
    version: INDICE_VERSION, region, modalidad, hora: h.hora,
    puntuacion: mejor.r.puntuacion,
    especie: { id: mejor.e.id, nombre: I18n.nombre(mejor.e), nombreEs: mejor.e.nombres.es },
    resultado: mejor.r,
    // Ola peligrosa: nota aparte (no motivo, no tope). Igual para todas las
    // especies de la modalidad.
    avisoOla: mejor.r.avisoOla || null,
    fiabilidad: fiabilidad(mejor.r, { especieId: mejor.e.id, modalidad, region, validacion: datos.validacion_fiabilidad, horaActual: contexto.horaActual, datosMedidos: contexto.datosMedidos }),
    // Freza: solo aviso, nunca suma.
    freza: fz?.enFreza ? { texto: t("va.freza.aviso"), meses: fz.meses } : null,
    ranking: ranking.map(({ e, r }) => ({ id: e.id, nombre: I18n.nombre(e), puntuacion: r.puntuacion })),
  };
}

// ---------------------------------------------------------------------------
// Tramos seguidos de horas buenas, mejores primero. Una hora entra si pasa
// del umbral absoluto Y está a no más de `margen` puntos de la mejor hora del
// día: así "mejor ventana" significa de verdad las mejores horas, no medio día.
export function mejoresVentanas(resultados, { umbral = 60, margen = 10, max = 3 } = {}) {
  if (!resultados.length) return [];
  const mejorDelDia = Math.max(...resultados.map((r) => r.puntuacion));
  umbral = Math.max(umbral, mejorDelDia - margen);
  const tramos = [];
  let actual = null;
  resultados.forEach((r, i) => {
    if (r.puntuacion >= umbral) {
      if (!actual) actual = { desde: i, hasta: i };
      else actual.hasta = i;
    } else if (actual) { tramos.push(actual); actual = null; }
  });
  if (actual) tramos.push(actual);
  return tramos
    .map((t) => {
      const horas = resultados.slice(t.desde, t.hasta + 1);
      const media = Math.round(horas.reduce((s, r) => s + r.puntuacion, 0) / horas.length);
      const mejor = horas.reduce((a, b) => (b.puntuacion > a.puntuacion ? b : a));
      const finH = Number(resultados[t.hasta].hora.slice(11, 13)) + 1;
      return {
        desde: resultados[t.desde].hora.slice(11, 16),
        hasta: `${String(finH).padStart(2, "0")}:00`,
        media,
        maxima: mejor.puntuacion,
        avisoOla: horas.some((r) => r.avisoOla),
        porque: paraUsuario(mejor.razones).motivos.filter((r) => r.sube).slice(0, 4).map((r) => r.texto),
      };
    })
    .sort((a, b) => b.media - a.media)
    .slice(0, max);
}

// ¿Está la especie en freza en esa región y mes? Devuelve null si no hay
// dato (nunca "no está en freza" por falta de dato).
// La freza "general" es de la Península: en el hemisferio sur (Nueva Zelanda)
// no vale, cada región trae la suya (nunca se desplaza 6 meses).
export function estadoFreza(especie, region, mes) {
  const f = especie.freza?.por_region?.[region] ?? (usaDatosGenerales(region) ? especie.freza?.por_region?.general : null);
  if (!f || !Array.isArray(f.meses) || !f.meses.length) return null;
  return { enFreza: f.meses.includes(mes), meses: f.meses, fuentes: f.fuentes || [], nota: f.nota || null };
}

// Talla mínima aplicable a una región (lista de entradas del JSON).
const JURISDICCIONES_POR_REGION = {
  cantabrico: ["ES-PV", "ES-recreativa-CNW", "ES-RD560-I", "UE-SWW"],
  atlantico_norte: ["ES-GA", "ES-recreativa-CNW", "ES-RD560-I", "UE-SWW"],
  golfo_cadiz: ["ES-AN", "ES-RD560-I", "UE-SWW"],
  mediterraneo: ["ES-RD560-II", "UE-MED"],
  baleares: ["ES-IB", "ES-RD560-II", "UE-MED"],
  canarias: ["ES-CN", "ES-RD560-III", "UE-SWW"],
  portugal: ["PT"],
  azores: ["PT-AC", "PT"],
  madeira: ["PT-MA", "PT"],
};
export function tallasParaRegion(especie, region, enEuskadi = false) {
  const orden = JURISDICCIONES_POR_REGION[region] || [];
  return (especie.talla_minima || [])
    .filter((t) => orden.includes(t.jurisdiccion) && (t.jurisdiccion !== "ES-PV" || enEuskadi))
    .sort((a, b) => orden.indexOf(a.jurisdiccion) - orden.indexOf(b.jurisdiccion));
}

// Caja de la costa vasca (para la normativa del Gobierno Vasco).
export function enEuskadi(lat, lon) {
  return lat >= 43.25 && lat <= 43.5 && lon >= -3.45 && lon <= -1.75;
}

// Pestañas en las que vale un cebo: su campo `modalidades` (lo rellena el
// JSON) o, si falta, deducido de su `modalidad` libre.
const CEBO_A_MODALIDADES = {
  surfcasting: ["costa"], roca: ["costa"], spinning: ["costa"], flotador: ["costa"], puerto: ["costa"],
  "embarcación": ["embarcacion"], jigging: ["embarcacion"], "curricán": ["embarcacion"],
  fondo: ["costa", "embarcacion"], eging: ["costa", "embarcacion"],
};
export function modalidadesDeCebo(c) {
  if (Array.isArray(c.modalidades)) return c.modalidades;
  const set = new Set();
  for (const parte of String(c.modalidad || "").toLowerCase().split(/[/ ]+/)) {
    for (const m of CEBO_A_MODALIDADES[parte] || []) set.add(m);
  }
  return [...set];
}

// Cebos típicos de una especie para una región (y modalidad, si se da):
// primero los que tienen fuente, luego las heurísticas; los marcados con otra
// región se descartan. En submarina no hay cebos (prohibidos en Portugal y sin
// sentido con arpón): devuelve [].
export function cebosParaRegion(especie, region, max = 5, modalidad = null) {
  if (modalidad === "submarina") return [];
  return (especie.cebos || [])
    .filter((c) => !c.region || c.region === region)
    .filter((c) => !modalidad || modalidadesDeCebo(c).includes(modalidad))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (!!b.c.fuente - !!a.c.fuente) || a.i - b.i)
    .slice(0, max)
    .map(({ c }) => c);
}

// Normativa de una modalidad para una región: las entradas verificadas de
// normativa_modalidades cuya jurisdicción aplica (Estado, Euskadi solo en la
// costa vasca, Portugal...) más las de la propia especie, y lo pendiente.
const JURIS_MODALIDAD_POR_REGION = {
  cantabrico: ["ES", "ES-CB", "ES-AS"], atlantico_norte: ["ES", "ES-GA"], golfo_cadiz: ["ES", "ES-AN"],
  mediterraneo: ["ES", "ES-AN", "ES-MC", "ES-VC", "ES-CT"], baleares: ["ES", "ES-IB"], canarias: ["ES", "ES-CN"],
  portugal: ["PT"], azores: ["PT-AC", "PT"], madeira: ["PT-MA", "PT"],
};
export function normativaModalidad(datos, modalidad, region, { euskadi = false, especie = null } = {}) {
  // En la costa vasca, Euskadi en vez de Cantabria/Asturias.
  const juris = euskadi ? ["ES", "ES-PV"] : [...(JURIS_MODALIDAD_POR_REGION[region] || [])];
  const vale = (n) => juris.includes(n.jurisdiccion);
  // Primero la norma autonómica/regional (la más concreta), luego la estatal.
  const nivel = (n) => (n.jurisdiccion === "ES" || n.jurisdiccion === "PT" ? 1 : 0);
  const orden = (a, b) => nivel(a) - nivel(b);
  const general = (datos.normativa_modalidades?.[modalidad] || []).filter(vale);
  const deEspecie = (especie?.modalidades?.[modalidad]?.normativa || []).filter(vale);
  const pend = datos.normativa_modalidades?.pendiente || {};
  const pendiente = juris.filter((j) => pend[j]?.length).map((j) => ({ jurisdiccion: j, pendiente: pend[j] }));
  return { general: general.sort(orden), especie: deEspecie.sort(orden), pendiente };
}

// ---------------------------------------------------------------------------
// Especies de temporada (sustituye a las listas ESPECIES* que había en
// index.html, retiradas el 2026-10-08). Una especie está "de temporada" en
// una región si su presencia en esa región incluye el mes y NO está en veda.
// ---------------------------------------------------------------------------
export const NOMBRE_REGION = {
  cantabrico: t("va.region.cantabrico"), atlantico_norte: t("va.region.atlantico_norte"), portugal: t("va.region.portugal"),
  golfo_cadiz: t("va.region.golfo_cadiz"), mediterraneo: t("va.region.mediterraneo"), baleares: t("va.region.baleares"),
  canarias: t("va.region.canarias"), azores: t("va.region.azores"), madeira: t("va.region.madeira"), nueva_zelanda: t("va.region.nueva_zelanda"),
  ...Object.fromEntries(AREAS_NZ.map((a) => [a, t(`va.region.${a}`)])),
};
const MESES_CORTOS = I18n.mesesCortos();

// Veda (p. ej. recreativa) que afecta a esa región ese mes, o null. Una veda
// sin lista de regiones es de la Península: no se aplica en el hemisferio sur.
export function vedaActiva(especie, region, mes) {
  return (especie.vedas || []).find((v) =>
    Array.isArray(v.meses) && v.meses.includes(mes)
    && (v.regiones ? v.regiones.includes(region) : usaDatosGenerales(region))) || null;
}

// true/false si hay rango de temperatura usable; null si no hay dato o si el
// rango solo tiene fuente no comercial (excluir_del_calculo).
export function coincideTemperatura(especie, tempAgua) {
  const t = especie.temperatura_agua;
  if (!t?.rango || t.excluir_del_calculo || tempAgua === null || tempAgua === undefined) return null;
  return tempAgua >= t.rango[0] && tempAgua <= t.rango[1];
}

// modalidad opcional: con ella, solo las especies que se pescan así.
export function especiesDeTemporada(datos, region, mes, modalidad = null) {
  return datos.especies.filter((e) => delPais(e, region) && e.presencia?.[region]?.meses?.includes(mes) && !vedaActiva(e, region, mes)
    && (!modalidad || aplicaModalidad(e, modalidad, region)));
}

// Especies con presencia en la región que se pescan con esa modalidad (de
// temporada o no): el desplegable de la ventana de actividad de cada pestaña.
export function especiesParaModalidad(datos, region, modalidad) {
  return datos.especies.filter((e) => delPais(e, region) && e.presencia?.[region]?.meses?.length && aplicaModalidad(e, modalidad, region));
}

// "abr–dic", "todo el año" o "ene, mar, may": meses en orden circular.
export function textoMeses(meses) {
  if (!meses?.length) return "";
  if (meses.length === 12) return t("va.todo_el_ano");
  const set = new Set(meses);
  const inicio = [...set].find((m) => !set.has(m === 1 ? 12 : m - 1));
  if (inicio !== undefined) {
    let fin = inicio, n = 1;
    while (set.has(fin === 12 ? 1 : fin + 1) && n < set.size) { fin = fin === 12 ? 1 : fin + 1; n++; }
    if (n === set.size) return `${MESES_CORTOS[inicio - 1]}–${MESES_CORTOS[fin - 1]}`;
  }
  return meses.map((m) => MESES_CORTOS[m - 1]).join(", ");
}

// ---------------------------------------------------------------------------
// Río asociado a un spot (para las reglas de caudal). Usa la lista RIOS de
// index.html (cada río con `spotCosta` y tres puntos, el último la
// desembocadura). Spot sin río asociado -> null: "desconocido", las reglas
// que lo necesitan no aplican (nunca se supone que no hay río).
// ---------------------------------------------------------------------------
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export function rioDeSpot(spot, rios) {
  const r = (rios || []).find((x) => x.spotCosta === spot.slug);
  if (!r?.puntos?.length) return null;
  const boca = r.puntos.find((p) => /^desembocadura/i.test(p.tramo || "")) || r.puntos[r.puntos.length - 1];
  return { nombre: r.rio, distancia_desembocadura_km: +distanciaKm(spot.lat, spot.lon, boca.lat, boca.lon).toFixed(2) };
}
