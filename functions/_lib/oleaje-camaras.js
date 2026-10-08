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

// ---------------------------------------------------------------------------
// Constantes de la medida (antes en scripts/oleaje-camaras/calibracion.mjs,
// que las reexporta): /prevision también las necesita para la referencia.
export const ESPUMA_MINIMA = 0.003; // por debajo: "sin espuma" (ruido, brillos sueltos)

// Elevación del sol en grados (fórmula aproximada de la NOAA, error < 1°:
// de sobra para decidir si hay luz). Las lecturas con el sol por debajo de
// ELEVACION_MINIMA no se hacen (oscuro, o sol rasante de cara a la cámara).
export const ELEVACION_MINIMA = 8;
export function elevacionSolar(fechaMs, lat, lon) {
  const d = new Date(fechaMs);
  const dia = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const horaUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dia - 1 + (horaUTC - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const tst = horaUTC * 60 + eqt + 4 * lon;
  const ha = ((tst / 4 - 180) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  return +(90 - (Math.acos(Math.min(1, Math.max(-1, cosZ))) * 180) / Math.PI).toFixed(2);
}

// ---------------------------------------------------------------------------
// Cámara como REFERENCIA (2026-10-08, aprobado por Mikel): mientras una
// cámara aún no sustituye al modelo (camaraSustituyeModelo() = false:
// ruidosa o sin etiquetas/días suficientes), su lectura se enseña debajo del
// valor del modelo, como dato secundario: "La cámara apunta a ~1,2 m
// (0,6–1,8 m, sin calibrar · 16:30)". La cifra principal sigue siendo
// modelo × coeficiente.
//
// filasLecturas(): de las filas de oleaje_camara_lecturas (estado ok, de las
// últimas VIGENCIA_LECTURA_HORAS, más recientes primero) saca
//   lecturas: { <camara>: la última que SUSTITUYE al modelo } (lo de antes)
//   medidas:  { <camara>: la última medida, sustituya o no } (para la
//             referencia; una medida = todas las filas "ok" de esa fecha,
//             una por encuadre).
export function filasLecturas(filas) {
  const lecturas = {}, medidas = {};
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  const ordenadas = [...(filas || [])]
    .filter((f) => f && f.estado === "ok" && f.camara && Number.isFinite(Date.parse(f.fecha)))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  for (const f of ordenadas) {
    const est = num(f.estimacion_camara_m);
    if (f.sustituye_modelo === true && Number.isFinite(est) && !lecturas[f.camara]) {
      lecturas[f.camara] = {
        fecha: f.fecha, estado: f.estado, encuadre: f.encuadre,
        estimacion: est,
        rangoMin: num(f.rango_min_m), rangoMax: num(f.rango_max_m),
        modeloCamara: num(f.modelo_camara_m), errorRel: num(f.error_rel),
        sustituyeModelo: true,
      };
    }
    const m = medidas[f.camara];
    if (!m) {
      medidas[f.camara] = {
        fecha: f.fecha, estado: "ok",
        estimacion: Number.isFinite(est) ? est : null,
        rangoMin: num(f.rango_min_m), rangoMax: num(f.rango_max_m),
        sustituyeModelo: f.sustituye_modelo === true,
        espumas: [num(f.espuma)],
      };
    } else if (Date.parse(m.fecha) === Date.parse(f.fecha)) {
      m.espumas.push(num(f.espuma));
      if (m.estimacion === null && Number.isFinite(est)) {
        m.estimacion = est; m.rangoMin = num(f.rango_min_m); m.rangoMax = num(f.rango_max_m);
      }
    }
  }
  for (const m of Object.values(medidas)) {
    // Sin espuma en NINGÚN encuadre medido: la cámara no ve romper nada.
    m.sinEspuma = m.espumas.every((e) => Number.isFinite(e) && e <= ESPUMA_MINIMA);
    delete m.espumas;
  }
  return { lecturas, medidas };
}

const redondeo1 = (v) => Math.round(v * 10) / 10;

// Referencia de cámara para un spot ya pasado por aplicarCamarasASpots().
// Devuelve { altura, rango:[min,max], hora, fecha, camara, nombre } o null.
// Solo si:
//   - el spot tiene cámara PROPIA (nunca la de un vecino; Santoña tampoco,
//     su cámara está al otro lado del Buciero);
//   - la cámara NO está sustituyendo ya al modelo en este spot;
//   - la última medida es "ok" (encuadre de referencia, sin orilla), de
//     menos de VIGENCIA_LECTURA_HORAS y con el sol ≥ ELEVACION_MINIMA;
//   - se ve espuma y hay estimación.
// Sin espuma no se dice nada (decisión 2026-10-08): la rompiente puede estar
// fuera de la zona medida (Castro, Getaria) y "la cámara no ve rompiente"
// junto a un modelo de 2 m invitaría a fiarse de una mar más pequeña.
export function camaraReferenciaDeSpot(spot, medida, ahoraMs = Date.now()) {
  const fuente = FUENTE_POR_SPOT[spot?.slug];
  if (!fuente?.propia || !medida) return null;
  if (spot.oleajeCamara?.propia || spot.bloques?.some((b) => b?.fuenteAltura === "camara")) return null;
  if (medida.sustituyeModelo === true) return null;
  if (medida.estado !== "ok" || medida.sinEspuma) return null;
  const t = Date.parse(medida.fecha);
  if (!Number.isFinite(t)) return null;
  const edad = horasEntre(t, ahoraMs);
  if (edad < -0.25 || edad > VIGENCIA_LECTURA_HORAS) return null;
  const cam = CAMARAS_OLEAJE[fuente.camara];
  if (!cam || elevacionSolar(t, cam.lat, cam.lon) < ELEVACION_MINIMA) return null;
  if (!Number.isFinite(medida.estimacion) || medida.estimacion <= 0) return null;
  const altura = redondeo1(medida.estimacion);
  let min = Number.isFinite(medida.rangoMin) ? redondeo1(medida.rangoMin) : redondeo1(medida.estimacion * 0.5);
  let max = Number.isFinite(medida.rangoMax) ? redondeo1(medida.rangoMax) : redondeo1(medida.estimacion * 1.5);
  min = Math.min(min, altura); max = Math.max(max, altura);
  return {
    altura,
    rango: [min, max],
    hora: isoLocalMadrid(t).slice(11, 16),
    fecha: medida.fecha,
    camara: fuente.camara,
    nombre: cam.nombre,
  };
}

// Añade `camaraReferencia` a los spots que la tengan (los demás, tal cual).
export function aplicarReferenciasCamara(spots, medidas, ahoraMs = Date.now()) {
  return (spots || []).map((s) => {
    const fuente = FUENTE_POR_SPOT[s?.slug];
    const ref = fuente?.propia ? camaraReferenciaDeSpot(s, medidas?.[fuente.camara], ahoraMs) : null;
    return ref ? { ...s, camaraReferencia: ref } : s;
  });
}
