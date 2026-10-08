// assets/js/ventana-actividad.js
//
// "Ventana de actividad" por especie y spot, hora a hora. Pedido de Mikel
// (2026-10-07). Reglas fijas y transparentes, SIN IA en tiempo de ejecución
// (regla de coste: cero tokens de la API al usar la app).
//
// Qué hace: para cada hora calcula una puntuación 0-100 y la lista de
// motivos que la explican ("marea subiendo", "amanecer", "agua turbia",
// "mar de 1-1,5 m"...). Cada motivo lleva su aporte en puntos, así que el
// número nunca es una caja negra: se puede reconstruir sumando.
//
//   puntuación = 50 + Σ (peso_factor × valor_factor),  valor ∈ [-1, 1]
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
// Módulo ES puro (sin DOM ni red): lo usa index.html en el navegador y
// test/ventana-actividad.test.js en node --test.

export const VERSION = "2026-10-07";

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
// informativa: peso 0 por defecto (ver reglas_por_defecto.luna en el JSON).
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
    if (defecto?.[k]?.preferencia || especie?.[k]?.preferencia) {
      r[k].preferencia = { ...(defecto?.[k]?.preferencia || {}), ...(especie?.[k]?.preferencia || {}) };
    }
  }
  return r;
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
// horas: [{ hora: "AAAA-MM-DDTHH:00", nivelMar, ola, viento, tempAgua, presion }]
//   (serie continua, hora local de Madrid; puede empezar antes del día que se
//   quiere pintar para tener la presión de 3 h antes).
// contexto: { lat, lon, turbidez: "no turbia"|"turbia"|"muy turbia"|null }
// Devuelve un array paralelo a `horas` con { hora, puntuacion, razones, ... }.
// ---------------------------------------------------------------------------
export function calcularVentana(especie, reglasDefecto, horas, contexto) {
  const reglas = fusionarReglas(reglasDefecto, especie.reglas);
  const marea = analizarMarea(horas.map((h) => h.nivelMar ?? null));
  const solCache = {};
  // Un rango cuya única fuente es no comercial (FishBase, CC BY-NC) se
  // conserva en el JSON marcado como pendiente, pero NO puntúa.
  const tempExcluida = !!especie.temperatura_agua?.excluir_del_calculo;
  const rangoTemp = tempExcluida ? null : (especie.temperatura_agua?.rango || null);

  return horas.map((h, i) => {
    const dia = h.hora.slice(0, 10);
    const minuto = Number(h.hora.slice(11, 13)) * 60 + 30;
    solCache[dia] ||= solDelDia(dia, contexto.lat, contexto.lon);
    const razones = [];
    let total = 50;
    const anota = (factor, valor, texto) => {
      const r = reglas[factor];
      if (!r || !r.peso) {
        if (texto) razones.push({ factor, texto, aporte: 0 });
        return;
      }
      const aporte = Math.round(r.peso * clamp(valor, -1, 1));
      total += aporte;
      if (texto) razones.push({ factor, texto, aporte });
    };

    // Luz
    const luz = estadoLuz(minuto, solCache[dia]);
    const textoLuz = { alba: "amanecer", ocaso: "atardecer", dia: "pleno día", noche: "de noche" }[luz];
    anota("luz", reglas.luz?.preferencia?.[luz] ?? 0, textoLuz);

    // Marea (escalada con el rango local)
    const m = marea[i];
    if (m && reglas.marea?.peso) {
      const ref = reglas.marea.rango_referencia_m || 2.5;
      const escala = clamp(m.rango / ref, 0, 1);
      if (escala < 0.25) {
        razones.push({ factor: "marea", texto: `marea casi nula aquí (${fmt1(m.rango)} m): no cuenta`, aporte: 0 });
      } else {
        const estado = m.repunte ? "repunte" : m.tendencia;
        const pref = reglas.marea.preferencia?.[estado] ?? 0;
        const txt = estado === "repunte" ? "repunte de marea" : `marea ${estado}`;
        anota("marea", pref * escala, txt);
      }
    }

    // Temperatura del agua frente a la de la especie
    if (tempExcluida && h.tempAgua !== null && h.tempAgua !== undefined) {
      razones.push({ factor: "temperatura", texto: `agua a ${fmt1(h.tempAgua)} °C (rango de la especie pendiente de fuente abierta: no cuenta)`, aporte: 0 });
    } else if (h.tempAgua !== null && h.tempAgua !== undefined && rangoTemp) {
      const [tmin, tmax] = rangoTemp;
      if (h.tempAgua >= tmin && h.tempAgua <= tmax) {
        anota("temperatura", 1, `agua a ${fmt1(h.tempAgua)} °C, en su rango (${tmin}-${tmax})`);
      } else {
        const dist = h.tempAgua < tmin ? tmin - h.tempAgua : h.tempAgua - tmax;
        anota("temperatura", -clamp(dist / 3, 0.2, 1), `agua a ${fmt1(h.tempAgua)} °C, fuera de su rango (${tmin}-${tmax})`);
      }
    }

    // Oleaje
    let marPeligrosa = false;
    if (h.ola !== null && h.ola !== undefined && reglas.oleaje?.peso) {
      const [omin, omax] = reglas.oleaje.optimo_m || [0, 1.5];
      const maxSeguro = reglas.oleaje.max_seguro_m || 2.5;
      let v;
      if (h.ola > maxSeguro) { v = -1; marPeligrosa = true; }
      else if (h.ola > omax) v = -(h.ola - omax) / Math.max(0.1, maxSeguro - omax);
      else if (h.ola < omin) v = reglas.oleaje.valor_bajo_minimo ?? -0.3;
      else v = 1;
      anota("oleaje", v, marPeligrosa ? `${rangoOlaTexto(h.ola)}: peligrosa desde costa` : rangoOlaTexto(h.ola));
    }

    // Viento: solo penaliza por encima del máximo cómodo
    if (h.viento !== null && h.viento !== undefined && reglas.viento?.peso) {
      const vmax = reglas.viento.max_kmh || 30;
      if (h.viento > vmax) anota("viento", -clamp((h.viento - vmax) / 20, 0.2, 1), `viento fuerte (${Math.round(h.viento)} km/h)`);
    }

    // Tendencia de la presión (mismos umbrales que /prevision: ±1 hPa en 3 h)
    const p = h.presion, p3 = horas[i - 3]?.presion;
    if (p !== null && p !== undefined && p3 !== null && p3 !== undefined && reglas.presion?.peso) {
      const d = p - p3;
      const t = d <= -1 ? "bajando" : d >= 1 ? "subiendo" : "estable";
      anota("presion", reglas.presion.preferencia?.[t] ?? 0, `presión ${t}`);
    }

    // Turbidez (dato diario por spot, de las webcams)
    if (contexto.turbidez && reglas.turbidez?.peso) {
      const t = contexto.turbidez;
      const txt = t === "no turbia" ? "agua clara" : t === "turbia" ? "agua turbia" : "agua muy turbia";
      anota("turbidez", reglas.turbidez.preferencia?.[t] ?? 0, txt);
    }

    let puntuacion = clamp(Math.round(total), 0, 100);
    if (marPeligrosa) puntuacion = Math.min(puntuacion, reglas.oleaje?.tope_si_peligrosa ?? 20);
    razones.sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte));
    return { hora: h.hora, puntuacion, razones, luz, marea: m, marPeligrosa };
  });
}

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
