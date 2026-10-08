// functions/_lib/oleaje-camaras.js
// "Si hay cámara, utiliza nuestro cálculo" (Mikel, 2026-10-08).
//
// Lógica pura (sin red), compartida por /prevision (functions/prevision.js),
// por el robot que mide las cámaras (scripts/oleaje-camaras/) y por los tests
// (test/oleaje-camaras.test.js). La métrica y la calibración viven en
// scripts/oleaje-camaras/espuma.mjs y calibracion.mjs; aquí solo:
//   1. Qué cámara sirve a qué spot (la suya o, si no tiene, la de al lado
//      con la misma orientación de costa) — CAMARAS_OLEAJE y FUENTE_POR_SPOT.
//   2. Cuándo una lectura de cámara vale todavía (lecturaVigente).
//   3. Cómo se corrige la previsión de las próximas horas con lo que ve la
//      cámara ahora (factorCamara: cociente cámara/modelo que se va
//      apagando hasta el coeficiente estático en DECAIMIENTO_HORAS).
//   4. Aplicarlo a la respuesta de /prevision (aplicarCamarasASpots).
//
// Nada de IA ni de API de pago: los números salen de contar píxeles de
// espuma en GitHub Actions (ver CLAUDE.md, "Oleaje por cámara").

// Bandas de altura que se enseñan y que etiqueta Mikel (página
// etiquetar-olas.html y botón "ola real que veo" del panel). `centro` es el
// valor que entra en la calibración para una etiqueta de esa banda.
export const BANDAS_OLA = [
  { id: "<0.5", min: 0, max: 0.5, centro: 0.3, texto: "menos de 0,5 m" },
  { id: "0.5-1", min: 0.5, max: 1, centro: 0.75, texto: "0,5–1 m" },
  { id: "1-2", min: 1, max: 2, centro: 1.5, texto: "1–2 m" },
  { id: "2-3", min: 2, max: 3, centro: 2.5, texto: "2–3 m" },
  { id: ">3", min: 3, max: null, centro: 3.5, texto: "más de 3 m" },
];

export function bandaDeAltura(h) {
  if (!Number.isFinite(h)) return null;
  return BANDAS_OLA.find((b) => h >= b.min && (b.max === null || h < b.max)) || null;
}

// Una lectura vale para el spot si es "ok" (luz, encuadre de referencia,
// sin orilla en la zona medida), tiene estimación y tiene menos de 3 h.
export const VIGENCIA_LECTURA_HORAS = 3;
// La corrección de la previsión por cámara se apaga linealmente: a las 0 h
// pesa entero, a las 18 h ya no pesa nada (se vuelve al modelo × coeficiente
// estático). 18 h está en el tramo de 12-24 h que pidió Mikel: el mar de
// fondo cambia en medio día, y una lectura de por la mañana no debe decidir
// la ola de mañana por la tarde.
export const DECAIMIENTO_HORAS = 18;
// Cociente cámara/modelo acotado: fuera de esto es más probable un fallo de
// la lectura (sol, niebla, gotas) que un modelo tan equivocado.
export const COCIENTE_MIN = 0.25;
export const COCIENTE_MAX = 3;

// Cámaras con métrica de espuma (las que ven el mar donde rompe; el
// inventario completo, con las que NO sirven y por qué, está en
// scripts/oleaje-camaras/camaras.mjs y en CLAUDE.md).
//   spot:      spot de la app al que pertenece la cámara.
//   expuesta:  la zona medida está en mar abierto/playa expuesta. Solo las
//              expuestas sirven de fuente para otros spots (una abrigada
//              llevaría su propio abrigo a un spot que no lo tiene).
//   orientacion: hacia dónde mira la costa del tramo medido (grados), para
//              elegir vecina con la misma exposición.
export const CAMARAS_OLEAJE = {
  hondarribia: { spot: "hondarribia", nombre: "Hondarribia", expuesta: false, orientacion: 30, lat: 43.3736, lon: -1.7964 },
  donostia: { spot: "donostia", nombre: "Zurriola", expuesta: true, orientacion: 0, lat: 43.3255, lon: -1.9745 },
  orio: { spot: "orio", nombre: "Orio", expuesta: true, orientacion: 330, lat: 43.2833, lon: -2.13 },
  zarautz: { spot: "zarautz", nombre: "Zarautz", expuesta: true, orientacion: 345, lat: 43.2865, lon: -2.17 },
  getaria: { spot: "getaria", nombre: "Getaria (Malkorbe)", expuesta: false, orientacion: 80, lat: 43.3015, lon: -2.2045 },
  zumaia: { spot: "zumaia", nombre: "Zumaia", expuesta: true, orientacion: 340, lat: 43.2985, lon: -2.2575 },
  deba: { spot: "deba", nombre: "Deba", expuesta: true, orientacion: 0, lat: 43.2955, lon: -2.354 },
  mutriku: { spot: "mutriku", nombre: "Mutriku (fuera del dique)", expuesta: true, orientacion: 10, lat: 43.3125, lon: -2.383 },
  mundaka: { spot: "mundaka", nombre: "Mundaka (barra de la ría)", expuesta: false, orientacion: 340, lat: 43.4075, lon: -2.698 },
  bakio: { spot: "bakio", nombre: "Bakio", expuesta: true, orientacion: 345, lat: 43.4297, lon: -2.8103 },
  sopelana: { spot: "sopelana", nombre: "Sopela", expuesta: true, orientacion: 300, lat: 43.3878, lon: -2.9975 },
  berria: { spot: "santona", nombre: "Berria (Santoña)", expuesta: true, orientacion: 0, lat: 43.4615, lon: -3.4655 },
  castrourdiales: { spot: "castrourdiales", nombre: "Castro Urdiales (Ostende)", expuesta: false, orientacion: 45, lat: 43.385, lon: -3.205 },
};

// Spot -> cámara cuya lectura se usa. Spots con cámara propia: la suya
// (propia: true) y su estimación SUSTITUYE a la del modelo. Spots sin cámara
// usable: la cámara EXPUESTA más cercana con la misma orientación de costa
// (±60°) a menos de 60 km; su cociente cámara/modelo corrige el modelo del
// spot, con `peso` < 1 porque la cámara no ve ese spot. Orientaciones de la
// costa sacadas del trazado de costa (OSM) a mano; ver CLAUDE.md.
//
// Santoña: la cámara (Berria) está en la playa expuesta al otro lado del
// monte Buciero, NO en la bahía donde están las coordenadas del spot. Por
// eso Santoña no usa su "cámara propia" como altura del spot: se trata como
// vecina (corrige el modelo, y el abrigo de la bahía se mantiene).
export const FUENTE_POR_SPOT = {
  hondarribia: { camara: "hondarribia", propia: true },
  donostia: { camara: "donostia", propia: true },
  orio: { camara: "orio", propia: true },
  zarautz: { camara: "zarautz", propia: true },
  getaria: { camara: "getaria", propia: true },
  zumaia: { camara: "zumaia", propia: true },
  deba: { camara: "deba", propia: true },
  mutriku: { camara: "mutriku", propia: true },
  mundaka: { camara: "mundaka", propia: true },
  bakio: { camara: "bakio", propia: true },
  sopelana: { camara: "sopelana", propia: true },
  castrourdiales: { camara: "castrourdiales", propia: true },
  santona: { camara: "berria", propia: false, peso: 0.8, motivo: "la cámara de Berria está al otro lado del Buciero: corrige el mar abierto; el abrigo de la bahía se mantiene" },
  // Vecinas (sin cámara usable).
  ondarroa: { camara: "mutriku", propia: false, peso: 0.8, motivo: "a 3 km, misma costa abierta al N" },
  lekeitio: { camara: "deba", propia: false, peso: 0.5, motivo: "a 13 km, costa abierta al N (la de Lekeitio mira al puerto)" },
  pasaia: { camara: "donostia", propia: false, peso: 0.8, motivo: "a 5 km, mar abierto al N (el abrigo del puerto se mantiene)" },
  plentzia: { camara: "bakio", propia: false, peso: 0.8, motivo: "a 11 km, costa abierta al N" },
  getxo: { camara: "sopelana", propia: false, peso: 0.8, motivo: "a 4 km, mar abierto al NW (el abrigo del Abra se mantiene)" },
  laredo: { camara: "berria", propia: false, peso: 0.8, motivo: "a 5 km, costa abierta al N" },
  santander: { camara: "berria", propia: false, peso: 0.5, motivo: "a 28 km, mar abierto al N (el abrigo de la bahía se mantiene)" },
  suances: { camara: "berria", propia: false, peso: 0.5, motivo: "a 47 km, costa abierta al N" },
};

function horasEntre(aMs, bMs) {
  return (bMs - aMs) / 3600e3;
}

export function lecturaVigente(lectura, ahoraMs = Date.now()) {
  if (!lectura || lectura.estado !== "ok") return false;
  // Cámara ruidosa aún sin calibrar (calibracion.mjs, camaraSustituyeModelo):
  // se mide y se guarda, pero no sustituye ni corrige al modelo.
  if (lectura.sustituyeModelo === false) return false;
  if (!Number.isFinite(lectura.estimacion)) return false;
  const t = Date.parse(lectura.fecha);
  if (!Number.isFinite(t)) return false;
  const edad = horasEntre(t, ahoraMs);
  // -0,25 h: tolera relojes algo desfasados, nunca lecturas "del futuro".
  return edad >= -0.25 && edad <= VIGENCIA_LECTURA_HORAS;
}

// Con calibración de pocos datos (error ≥ 50 %: hoy, un solo estado de
// mar) el cociente se acota más: una foto con otra exposición (Bakio,
// 2026-10-08: espuma 0,13 → 0,41 en 30 min con el mismo mar) no puede
// duplicar la ola de los spots vecinos.
export const COCIENTE_POCOS_DATOS = [0.6, 1.6];
export function cocienteCamaraModelo(estimacion, modeloSpot, errorRel = null) {
  if (!Number.isFinite(estimacion) || !Number.isFinite(modeloSpot) || modeloSpot <= 0.05) return null;
  const [min, max] = Number.isFinite(errorRel) && errorRel >= 0.5 ? COCIENTE_POCOS_DATOS : [COCIENTE_MIN, COCIENTE_MAX];
  return +Math.min(max, Math.max(min, estimacion / modeloSpot)).toFixed(3);
}

// Factor multiplicativo sobre modelo × coeficiente para una hora que está a
// `horas` de la lectura (positivo = después). Peso lineal 1 → 0 en
// DECAIMIENTO_HORAS; `peso` (< 1 para cámaras vecinas) rebaja el efecto.
export function factorCamara(cociente, horas, peso = 1) {
  if (!Number.isFinite(cociente) || !Number.isFinite(horas)) return 1;
  const w = Math.max(0, 1 - Math.abs(horas) / DECAIMIENTO_HORAS) * Math.min(1, Math.max(0, peso));
  return +(1 + (cociente - 1) * w).toFixed(4);
}

// Hora local de Madrid "YYYY-MM-DDTHH:MM" de un instante (las horas del
// modelo en /prevision vienen en hora de Madrid sin zona).
export function isoLocalMadrid(ms) {
  return new Date(ms).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).replace(" ", "T").slice(0, 16);
}

// Horas entre dos "YYYY-MM-DDTHH:MM" locales (mismo huso, sin zona).
export function horasEntreLocales(a, b) {
  const pa = Date.parse(`${a.slice(0, 16)}:00Z`), pb = Date.parse(`${b.slice(0, 16)}:00Z`);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return null;
  return (pb - pa) / 3600e3;
}

function rango(h) {
  if (!Number.isFinite(h)) return null;
  return [Math.max(0, +(h * 0.9).toFixed(1)), +(h * 1.1).toFixed(1)];
}

// Ajuste de una serie de spots de /prevision con las lecturas de cámara.
//   spots: [{ slug, bloques: [{ horaISO, altura:[min,max], ... }] }]
//   lecturas: { <camara>: { fecha, estado, estimacion, rangoMin, rangoMax,
//               modeloCamara, encuadre } } (la última de cada cámara)
// Devuelve los mismos spots (copias) con, en cada uno que tenga fuente:
//   oleajeCamara: { camara, nombre, propia, peso, motivo, fecha, horaLocal,
//                   estimacion, rango, cociente, decaimientoHoras }
// y los bloques ajustados:
//   - cámara propia: el bloque más cercano a la lectura toma la estimación
//     de la cámara (`fuenteAltura: "camara"`); los demás, modelo ×
//     coeficiente × factorCamara.
//   - vecina: todos los bloques, modelo × coeficiente × factorCamara(peso).
// Sin lectura vigente, el spot sale tal cual (modelo × coeficiente).
export function aplicarCamarasASpots(spots, lecturas, ahoraMs = Date.now()) {
  return (spots || []).map((s) => {
    const fuente = FUENTE_POR_SPOT[s?.slug];
    const lectura = fuente ? lecturas?.[fuente.camara] : null;
    if (!fuente || !s.bloques?.length || !lecturaVigente(lectura, ahoraMs)) return s;
    const cociente = cocienteCamaraModelo(lectura.estimacion, lectura.modeloCamara, lectura.errorRel);
    const peso = fuente.propia ? 1 : fuente.peso ?? 0.5;
    const horaLectura = isoLocalMadrid(Date.parse(lectura.fecha));
    const info = {
      camara: fuente.camara,
      nombre: CAMARAS_OLEAJE[fuente.camara]?.nombre || fuente.camara,
      propia: !!fuente.propia,
      peso,
      motivo: fuente.motivo || null,
      fecha: lectura.fecha,
      horaLocal: horaLectura.slice(11, 16),
      estimacion: +lectura.estimacion.toFixed(2),
      rango: Number.isFinite(lectura.rangoMin) && Number.isFinite(lectura.rangoMax)
        ? [+lectura.rangoMin.toFixed(1), +lectura.rangoMax.toFixed(1)]
        : rango(lectura.estimacion),
      cociente,
      decaimientoHoras: DECAIMIENTO_HORAS,
    };
    // Bloque más cercano a la lectura (para la estimación directa).
    let iCerca = -1, dMin = Infinity;
    s.bloques.forEach((b, i) => {
      const d = b.horaISO ? Math.abs(horasEntreLocales(horaLectura, b.horaISO)) : Infinity;
      if (d < dMin) { dMin = d; iCerca = i; }
    });
    const bloques = s.bloques.map((b, i) => {
      if (!b.altura) return b;
      if (fuente.propia && i === iCerca && dMin <= 2) {
        return { ...b, altura: info.rango, alturaModelo: b.altura, fuenteAltura: "camara" };
      }
      if (cociente === null || !b.horaISO) return b;
      const f = factorCamara(cociente, horasEntreLocales(horaLectura, b.horaISO), peso);
      const centro = (b.altura[0] + b.altura[1]) / 2;
      return { ...b, altura: rango(centro * f), alturaModelo: b.altura, fuenteAltura: fuente.propia ? "modelo_corregido_camara" : "modelo_ajustado_vecina", factorCamara: f };
    });
    return { ...s, bloques, oleajeCamara: info };
  });
}
