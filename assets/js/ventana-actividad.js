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
// (aviso "devuélvelo", nunca suma), topes de seguridad por modalidad (se
// aplican al final y se enseñan como un motivo más), submarina de noche = 0,
// y datos caducados -> S/D (lo decide quien llama, con la vigencia del spot).
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

import { reglasEnAmbito, evaluarReglas, iluminacionLunar, coeficienteMareaAstronomico } from "./reglas-expertas.js";

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
// Regiones. Cajas aproximadas por coordenadas, igual de honestas que
// zonaPorCoordenadas() de index.html: no son límites oficiales.
// ---------------------------------------------------------------------------
export const REGIONES = [
  "cantabrico", "atlantico_norte", "portugal", "golfo_cadiz",
  "mediterraneo", "baleares", "canarias", "azores", "madeira",
];

export function regionPorCoordenadas(lat, lon) {
  if (lat >= 36.8 && lat <= 39.8 && lon >= -31.5 && lon <= -24.5) return "azores";
  if (lat >= 32.3 && lat <= 33.2 && lon >= -17.4 && lon <= -16.1) return "madeira";
  if (lat >= 27 && lat <= 29.6 && lon >= -18.5 && lon <= -13) return "canarias";
  if (lat >= 38.5 && lat <= 40.3 && lon >= 1.0 && lon <= 4.6) return "baleares";
  // Golfo de Cádiz español: del Guadiana (-7.4) a Tarifa (-5.6).
  if (lat >= 35.9 && lat <= 37.5 && lon >= -7.4 && lon <= -5.6) return "golfo_cadiz";
  // Portugal continental: al sur del Miño (41.87) y al oeste del Guadiana.
  if (lat < 41.87 && lon < -7.4) return "portugal";
  // Cantábrico: de Ribadeo (-7.05) a la frontera francesa (y Baiona).
  if (lat >= 43.0 && lon >= -7.05 && lon <= -1.3) return "cantabrico";
  // Galicia (Rías Altas y Baixas).
  if (lat >= 41.87 && lon < -7.05) return "atlantico_norte";
  if (lon > -5.6 && lat < 43.0) return "mediterraneo";
  return "cantabrico";
}

// ---------------------------------------------------------------------------
// Sol: amanecer y anochecer (algoritmo de la NOAA, precisión ~1 min).
// Devuelve minutos desde la medianoche en hora de Europe/Madrid, que es la
// zona en la que Open-Meteo etiqueta las horas (timezone=Europe/Madrid en
// toda la app, también para Portugal y Canarias).
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

const fmtMadrid = typeof Intl !== "undefined"
  ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  : null;

export function minutosMadrid(ms) {
  const [h, mi] = fmtMadrid.format(new Date(ms)).split(":").map(Number);
  return h * 60 + mi;
}

export function textoHora(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Estado de la luz para una hora local (minuto central de la hora).
// alba/ocaso = ±60 min alrededor del amanecer/anochecer.
export function estadoLuz(minutoLocal, sol) {
  if (!sol) return "dia";
  const am = minutosMadrid(sol.amanecer);
  const an = minutosMadrid(sol.anochecer);
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
export const NOMBRE_MODALIDAD = { costa: "Desde costa", embarcacion: "Embarcación", submarina: "Submarina" };

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

const fmt1 = (x) => String(+x.toFixed(1)).replace(".", ",");
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function rangoOlaTexto(h) {
  if (h < 0.5) return "mar casi plana (<0,5 m)";
  const a = Math.floor(h * 2) / 2;
  return `mar de ${fmt1(a)}-${fmt1(a + 0.5)} m`;
}

// ---------------------------------------------------------------------------
// Cálculo principal.
//
// especie: entrada de especies.json (usa .reglas y .temperatura_agua).
// reglasDefecto: especies.json.reglas_por_defecto.
// horas: [{ hora: "AAAA-MM-DDTHH:00", nivelMar, ola, viento, vientoDir, tempAgua, presion, lluvia }]
//   (serie continua, hora local de Madrid; puede empezar días antes del que
//   se quiere pintar para tener las tendencias y los retardos de las reglas).
// horas[].lluvia (mm en esa hora) y horas[].vientoDir (grados, de dónde
// viene) son opcionales: sin ellos, lo que los usa no aplica.
// contexto: { lat, lon, turbidez: "no turbia"|"turbia"|"muy turbia"|null,
//   modalidad: "costa"|"embarcacion"|"submarina" (por defecto costa),
//   reglasModalidad: especies.json.reglas_por_modalidad,
//   reglasExpertas: especies.json.reglas_expertas (opcional),
//   region (si no, por coordenadas),
//   caudalRio: "bajo"|"normal"|"alto"|null (río asociado al spot, solo hoy),
//   rio: { nombre, distancia_desembocadura_km } | null (null = sin río conocido),
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

export function calcularVentana(especie, reglasDefecto, horas, contexto) {
  const modalidad = contexto.modalidad || "costa";
  const reglas = reglasParaModalidad(reglasDefecto, especie, modalidad, contexto.reglasModalidad);
  const rm = contexto.reglasModalidad?.[modalidad] || {};
  const region = contexto.region || regionPorCoordenadas(contexto.lat, contexto.lon);
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
    const anota = (factor, valor, texto, cientifico = false) => {
      if (sustituidos.has(factor)) return;
      const r = reglas[factor];
      const w = pesoLogOdds(r);
      if (!r || !w) {
        if (texto) terminos.push({ factor, texto, lo: 0 });
        return;
      }
      terminos.push({ factor, texto, lo: w * clamp(valor, -1, 1), cientifico: cientifico || TIPOS_CIENTIFICOS.has(r.tipo) });
    };

    // Submarina: prohibida de noche (art. 16.d RD 347/2011; art. 8.3
    // Portaria 14/2014). Una hora entera de noche puntúa 0 y no se calcula
    // nada más; una hora a caballo lo avisa.
    let prohibida = false;
    const notas = [];
    if (rm.solo_de_dia && solCache[dia]) {
      const am = minutosMadrid(solCache[dia].amanecer), an = minutosMadrid(solCache[dia].anochecer);
      const ini = minuto - 30, fin = minuto + 30;
      if (fin <= am || ini >= an) prohibida = true;
      else if (ini < am) notas.push({ factor: "legal", texto: `legal solo desde la salida del sol (${textoHora(am)})`, aporte: 0 });
      else if (fin > an) notas.push({ factor: "legal", texto: `legal solo hasta la puesta del sol (${textoHora(an)})`, aporte: 0 });
    }
    if (prohibida) {
      return {
        hora: h.hora, puntuacion: 0, luz: "noche", marea: marea[i], marPeligrosa: false, prohibida: true, avisos: [],
        razones: [{ factor: "legal", texto: "de noche la pesca submarina está prohibida", aporte: 0 }],
        cobertura: 1, reglasAplicadas: [], sinDato: [],
      };
    }

    // Luz
    const luz = estadoLuz(minuto, solCache[dia]);
    const textoLuz = { alba: "amanecer", ocaso: "atardecer", dia: "pleno día", noche: "de noche" }[luz];
    cuenta("luz", true);
    anota("luz", reglas.luz?.preferencia?.[luz] ?? 0, textoLuz);

    // Marea (escalada con el rango local)
    const m = marea[i];
    if (cuenta("marea", !!m) && pesoLogOdds(reglas.marea)) {
      const ref = reglas.marea.rango_referencia_m || 2.5;
      const escala = clamp(m.rango / ref, 0, 1);
      if (escala < 0.25) {
        terminos.push({ factor: "marea", texto: `marea casi nula aquí (${fmt1(m.rango)} m): no cuenta`, lo: 0 });
      } else {
        const estado = m.repunte ? "repunte" : m.tendencia;
        const pref = reglas.marea.preferencia?.[estado] ?? 0;
        const txt = estado === "repunte" ? "repunte de marea" : `marea ${estado}`;
        anota("marea", pref * escala, txt);
      }
    }

    // Temperatura del agua: curva gaussiana alrededor del óptimo de la especie
    const hayTemp = h.tempAgua !== null && h.tempAgua !== undefined;
    if (tempExcluida && hayTemp) {
      cuenta("temperatura", false);
      terminos.push({ factor: "temperatura", texto: `agua a ${fmt1(h.tempAgua)} °C (rango de la especie pendiente de fuente abierta: no cuenta)`, lo: 0 });
    } else if (rangoTemp) {
      if (cuenta("temperatura", hayTemp)) {
        const [tmin, tmax] = rangoTemp;
        const f = factorTemperatura(h.tempAgua, rangoTemp);
        const dentro = h.tempAgua >= tmin && h.tempAgua <= tmax;
        const txt = !dentro ? `agua a ${fmt1(h.tempAgua)} °C, fuera de su rango (${tmin}-${tmax})`
          : f >= 0.8 ? `agua a ${fmt1(h.tempAgua)} °C, cerca de su óptimo (${tmin}-${tmax})`
          : `agua a ${fmt1(h.tempAgua)} °C, en su rango (${tmin}-${tmax})`;
        anota("temperatura", f, txt, tempCientifica);
      }
    } else {
      cuenta("temperatura", false);
      if (modalidad === "submarina" && hayTemp) terminos.push({ factor: "temperatura", texto: `agua a ${fmt1(h.tempAgua)} °C`, lo: 0 });
    }

    // Oleaje. El tope de seguridad va APARTE del factor: se aplica siempre,
    // también cuando una regla experta sustituye el factor de oleaje (p. ej.
    // "mar algo movida" para los depredadores costeros desde costa).
    let marPeligrosa = false;
    const hayOla = h.ola !== null && h.ola !== undefined;
    const peligro = reglas.oleaje?.texto_peligro || "peligrosa desde costa";
    if (hayOla && reglas.oleaje && h.ola > (reglas.oleaje.max_seguro_m || 2.5)) {
      marPeligrosa = true;
      const tope = reglas.oleaje.tope_si_peligrosa ?? 20;
      topes.push({ tope, texto: `${rangoOlaTexto(h.ola)}, ${peligro}: máximo ${tope}` });
    }
    if (cuenta("oleaje", hayOla) && pesoLogOdds(reglas.oleaje)) {
      const [omin, omax] = reglas.oleaje.optimo_m || [0, 1.5];
      const maxSeguro = reglas.oleaje.max_seguro_m || 2.5;
      let v;
      if (marPeligrosa) v = -1;
      else if (h.ola > omax) v = -(h.ola - omax) / Math.max(0.1, maxSeguro - omax);
      else if (h.ola < omin) v = reglas.oleaje.valor_bajo_minimo ?? -0.3;
      else v = 1;
      anota("oleaje", v, marPeligrosa ? `${rangoOlaTexto(h.ola)}: ${peligro}` : rangoOlaTexto(h.ola));
    }

    // Viento: solo penaliza por encima del máximo cómodo
    if (cuenta("viento", h.viento !== null && h.viento !== undefined) && pesoLogOdds(reglas.viento)) {
      const vmax = reglas.viento.max_kmh || 30;
      if (h.viento > vmax) anota("viento", -clamp((h.viento - vmax) / 20, 0.2, 1), `viento fuerte (${Math.round(h.viento)} km/h)`);
    }

    // Embarcación: avisos de seguridad (kayak / embarcación pequeña). Se
    // aplica el nivel más severo que se supere, con su tope.
    const avisos = [];
    if (rm.seguridad?.niveles) {
      for (const nv of rm.seguridad.niveles) {
        const porViento = h.viento !== null && h.viento !== undefined && h.viento > nv.viento_max_kmh;
        const porOla = h.ola !== null && h.ola !== undefined && h.ola > nv.ola_max_m;
        if (porViento || porOla) {
          const motivo = [porViento && `viento ${Math.round(h.viento)} km/h`, porOla && `ola ${fmt1(h.ola)} m`].filter(Boolean).join(" y ");
          avisos.push({ nivel: nv.id, texto: `${nv.texto} (${motivo})` });
          notas.push({ factor: "seguridad", texto: `⚠ ${nv.texto} (${motivo})`, aporte: 0 });
          topes.push({ tope: nv.tope, texto: `${nv.texto}: máximo ${nv.tope}` });
          break;
        }
      }
    }

    // Tendencia de la presión (mismos umbrales que /prevision: ±1 hPa en 3 h)
    const p = h.presion, p3 = horas[i - 3]?.presion;
    const hayPresion = p !== null && p !== undefined && p3 !== null && p3 !== undefined;
    if (cuenta("presion", hayPresion) && pesoLogOdds(reglas.presion)) {
      const d = p - p3;
      const t = d <= -1 ? "bajando" : d >= 1 ? "subiendo" : "estable";
      anota("presion", reglas.presion.preferencia?.[t] ?? 0, `presión ${t}`);
    }

    // Turbidez (dato diario por spot, de las webcams)
    if (cuenta("turbidez", !!contexto.turbidez) && pesoLogOdds(reglas.turbidez)) {
      const t = contexto.turbidez;
      const txt = t === "no turbia" ? "agua clara" : t === "turbia" ? "agua turbia" : "agua muy turbia";
      anota("turbidez", reglas.turbidez.preferencia?.[t] ?? 0, txt);
    }

    // Lluvia de las 24 h anteriores (enturbia el agua; solo submarina)
    if (pesoLogOdds(reglas.lluvia)) {
      const previas = horas.slice(Math.max(0, i - 24), i).map((x) => x.lluvia).filter((x) => x !== null && x !== undefined);
      if (cuenta("lluvia", previas.length >= 12)) {
        const mm = previas.reduce((a, b) => a + b, 0);
        const [u0, u1] = reglas.lluvia.umbral_mm_24h || [2, 15];
        if (mm >= u0) anota("lluvia", -clamp((mm - u0) / Math.max(0.1, u1 - u0), 0.2, 1), `${fmt1(mm)} mm de lluvia en las 24 h anteriores`);
      }
    }

    // Caudal del río asociado al spot (solo submarina, solo con dato)
    if (pesoLogOdds(reglas.caudal_rio) && cuenta("caudal_rio", !!contexto.caudalRio)
      && reglas.caudal_rio.preferencia?.[contexto.caudalRio] !== undefined) {
      anota("caudal_rio", reglas.caudal_rio.preferencia[contexto.caudalRio], `río cercano con caudal ${contexto.caudalRio}`);
    }

    // Reglas expertas (datos de especies.json, motor genérico)
    // Hora de Madrid aproximada a UTC (-1 h; en verano son -2): sobra para la luna y el coeficiente.
    const msUTC = Date.parse(`${h.hora}:00Z`) - 3600000;
    const ctxReglas = {
      caudal_rio: contexto.caudalRio ?? null,
      rio_desembocadura_km: contexto.rio?.distancia_desembocadura_km ?? null,
      turbidez: contexto.turbidez ?? null,
      mes, hora_local: Number(h.hora.slice(11, 13)), luz,
      luna: iluminacionLunar(msUTC),
      coeficiente_marea: coeficienteMareaAstronomico(msUTC),
    };
    const ev = evaluarReglas(expertas, horas, i, ctxReglas);
    for (const r of expertas) {
      const w = Math.abs((r.efecto?.logodds || 0) * (r.confianza ?? 1));
      cobertura.total += w;
      if (!ev.sinDato.includes(r.id)) cobertura.conDato += w;
    }
    for (const t of ev.terminos) {
      terminos.push({ factor: t.factor, texto: t.texto, lo: t.lo, cientifico: TIPOS_CIENTIFICOS.has(t.regla.tipo), regla: t.regla });
    }

    // Escala logística y reparto del porqué en puntos
    const rep = repartirAportes(terminos.map((t) => t.lo), b0);
    const razones = terminos.map((t, k) => ({
      factor: t.factor, texto: t.texto, aporte: rep.aportes[k], lo: +t.lo.toFixed(3),
      variable: t.regla ? t.regla.variable : VARIABLE_DE_FACTOR[t.factor],
      ...(t.regla ? { regla: t.regla } : {}),
    }));
    razones.push(...notas);
    let puntuacion = rep.puntuacion;
    if (topes.length) {
      const peor = topes.reduce((a, b) => (b.tope < a.tope ? b : a));
      if (puntuacion > peor.tope) {
        razones.push({ factor: "tope", texto: `tope de seguridad (${peor.texto})`, aporte: peor.tope - puntuacion });
        puntuacion = peor.tope;
      }
    }
    razones.sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte));
    const loTotal = terminos.reduce((s, t) => s + Math.abs(t.lo), 0);
    const loCientifico = terminos.filter((t) => t.cientifico).reduce((s, t) => s + Math.abs(t.lo), 0);
    return {
      hora: h.hora, puntuacion, razones, luz, marea: m, marPeligrosa, prohibida: false, avisos,
      probabilidad: +rep.probabilidad.toFixed(2), base: rep.base,
      cobertura: cobertura.total ? +(cobertura.conDato / cobertura.total).toFixed(2) : 1,
      fraccionCientifica: loTotal ? +(loCientifico / loTotal).toFixed(2) : 0,
      reglasAplicadas: ev.terminos.map((t) => t.regla.id), sinDato: ev.sinDato,
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
const NIVEL_TEXTO = { 1: "criterio experto", 2: "con base científica", 3: "validado con el diario", 4: "confirmado con desembarcos" };
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
    if (horizonte > 48) { menos += 1; rebajas.push("previsión a más de 48 h"); }
  }
  if ((resultado.cobertura ?? 1) < 0.6) { menos += 1; rebajas.push(`solo ${Math.round((resultado.cobertura ?? 0) * 100)} % del peso con dato`); }
  if (!datosMedidos) { menos += 0.5; rebajas.push("modelo, no medido"); }
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
    especie: { id: mejor.e.id, nombre: mejor.e.nombres.es },
    resultado: mejor.r,
    fiabilidad: fiabilidad(mejor.r, { especieId: mejor.e.id, modalidad, region, validacion: datos.validacion_fiabilidad, horaActual: contexto.horaActual, datosMedidos: contexto.datosMedidos }),
    // Freza: solo aviso, nunca suma.
    freza: fz?.enFreza ? { texto: "en freza en esta zona: si lo pescas, devuélvelo al agua", meses: fz.meses } : null,
    ranking: ranking.map(({ e, r }) => ({ id: e.id, nombre: e.nombres.es, puntuacion: r.puntuacion })),
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
        porque: mejor.razones.filter((r) => r.aporte > 0).slice(0, 4).map((r) => r.texto),
      };
    })
    .sort((a, b) => b.media - a.media)
    .slice(0, max);
}

// ¿Está la especie en freza en esa región y mes? Devuelve null si no hay
// dato (nunca "no está en freza" por falta de dato).
export function estadoFreza(especie, region, mes) {
  const f = especie.freza?.por_region?.[region] ?? especie.freza?.por_region?.general;
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
  cantabrico: "el Cantábrico", atlantico_norte: "Galicia", portugal: "Portugal",
  golfo_cadiz: "el Golfo de Cádiz", mediterraneo: "el Mediterráneo", baleares: "Baleares",
  canarias: "Canarias", azores: "Azores", madeira: "Madeira",
};
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Veda (p. ej. recreativa) que afecta a esa región ese mes, o null.
export function vedaActiva(especie, region, mes) {
  return (especie.vedas || []).find((v) =>
    Array.isArray(v.meses) && v.meses.includes(mes) && (!v.regiones || v.regiones.includes(region))) || null;
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
  return datos.especies.filter((e) => e.presencia?.[region]?.meses?.includes(mes) && !vedaActiva(e, region, mes)
    && (!modalidad || aplicaModalidad(e, modalidad, region)));
}

// Especies con presencia en la región que se pescan con esa modalidad (de
// temporada o no): el desplegable de la ventana de actividad de cada pestaña.
export function especiesParaModalidad(datos, region, modalidad) {
  return datos.especies.filter((e) => e.presencia?.[region]?.meses?.length && aplicaModalidad(e, modalidad, region));
}

// "abr–dic", "todo el año" o "ene, mar, may": meses en orden circular.
export function textoMeses(meses) {
  if (!meses?.length) return "";
  if (meses.length === 12) return "todo el año";
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
