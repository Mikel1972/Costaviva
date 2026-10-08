// functions/_lib/oleaje-costero.js
// Oleaje "en la playa" frente a oleaje "en mar abierto" (2026-10-08).
//
// EL PROBLEMA (Mikel, 2026-10-08): Hondarribia salía con "3.7–4.5 m" y su
// webcam enseñaba la bahía casi en calma. Diagnóstico completo en CLAUDE.md
// ("Oleaje costero"). En corto:
//   1. El modelo de Open-Meteo Marine tiene celdas de ~9 km en el Cantábrico.
//      La celda que devuelve para Hondarribia está en 43.458, -1.792: ~9,4 km
//      MAR ADENTRO, frente a la costa francesa, en mar abierto. Lo mismo pasa
//      en todos los spots del Cantábrico (celdas a 6-19 km de la costa).
//   2. Encima se aplica el ×1,38 de Gipuzkoa (calibrado contra la boya
//      exterior Pasaia II, que mide mar abierto: correcto PARA MAR ABIERTO).
//   3. El "rango" 3.7–4.5 no es swell + mar de viento ni una incertidumbre
//      real: es ±10 % artificial alrededor de un único valor (Hs total).
//   Resultado: un número de mar abierto bien calculado, presentado como si
//   fuera lo que hay en una playa que está al abrigo del cabo Higuer.
//
// QUÉ HACE ESTE MÓDULO (determinista, sin IA, sin red):
//   - Coeficiente de abrigo por spot y por dirección de llegada de la ola,
//     SOLO para spots claramente abrigados (bahías interiores, puertos,
//     rías, lagunas) donde el punto de rejilla del modelo está en mar
//     abierto. No se toca ninguna playa expuesta: ahí la diferencia existe
//     pero es menor y se calibrará con las cámaras (scripts/oleaje-camaras/).
//   - altura en la playa = altura de mar abierto (ya con el ×1,38 si toca)
//     × coeficiente de abrigo. El ×1,38 corrige el MAR ABIERTO; el abrigo
//     se aplica después, nunca al revés ni en lugar de él.
//
// MODELO DEL COEFICIENTE: cada spot abrigado tiene una "ventana abierta"
// (dirección central `centro` y semiancho `semiancho`, en grados de DONDE
// VIENE la ola, igual que wave_direction). Dentro de la ventana vale
// `coefAbierto`; fuera de la ventana más una transición lineal de 30° vale
// `coefAbrigado`. Sin dirección se usa `coefAbierto` (el MAYOR): ante la
// duda, se sobrestima la ola en vez de subestimarla — una ola subestimada es
// la que puede hacer daño.
//
// CONFIANZA: los coeficientes son ESTIMACIONES por geometría de la costa (y,
// en Hondarribia, contrastadas con la imagen de su webcam el 2026-10-08), no
// una medida. Por eso la app enseña SIEMPRE el valor de mar abierto al lado
// y escribe "estimación". Los valores se han elegido por el lado alto.
// Cuando haya calibración por cámara (scripts/oleaje-camaras/), los
// coeficientes de spots con cámara se sustituyen por los calibrados.

export const TRANSICION_GRADOS = 30;

// Criterio para entrar en esta tabla (no relajarlo sin pedirlo Mikel):
//   - el spot (sus coordenadas, no solo el nombre) está DENTRO de una bahía
//     cerrada, un puerto, una ría o una laguna, con un obstáculo físico claro
//     (cabo, monte, dique, isla barrera) entre él y el oleaje dominante; y
//   - la celda del modelo que le toca está en mar abierto (si la celda ya
//     está dentro de la ría, el modelo ya reduce la ola y no se corrige dos
//     veces — por eso NO están Cangas, Vigo/Cíes, Sanxenxo ni Portosín:
//     sus celdas ya dan 0,6-0,9 m cuando fuera hay 1,3-1,5 m).
export const ABRIGO_SPOTS = {
  hondarribia: {
    centro: 40, semiancho: 25, coefAbierto: 0.45, coefAbrigado: 0.15, nivel: "muy abrigada",
    criterio:
      "Bahía de Txingudi, en la desembocadura del Bidasoa. Desde la playa, el mar abierto solo " +
      "se ve hacia el NE, por la boca entre el cabo Higuer y la punta de Hendaia; el cabo Higuer " +
      "(y su dique) y el monte Jaizkibel tapan " +
      "el oleaje del W y del NW, que es el dominante en el Cantábrico. Contrastado el " +
      "2026-10-08 11:57: boya Pasaia II 3,5-3,8 m del NW, la webcam enseña la bahía casi en " +
      "calma con una orilla de espuma mínima, mientras Zarautz y Deba rompen en varias líneas.",
  },
  mundaka: {
    // 2026-10-08, "veo que Mundaka también está mal" (Mikel). Diagnóstico con
    // los números de ese día, 12:20: la celda del modelo cae en 43.54,
    // -2.71, ~15 km al N, en mar abierto por fuera del cabo Matxitxako; da
    // 2,78 m del NW (330°) y la app lo enseñaba como "2,5–3,1 m" en el spot.
    // Las boyas medían 3,1-3,5 m (Bilbao II y Bilbao-Vizcaya): en Bizkaia el
    // mar abierto del modelo sale algo BAJO (no tiene el ×1,38 de Gipuzkoa).
    // Pero el spot (43.4047, -2.6989) está en el pueblo, dentro de la boca de
    // la ría de Urdaibai: la ola llega refractada por Matxitxako e Izaro, y
    // la cámara de la barra (KOSTASystem) enseñaba series rompiendo que, a
    // ojo y sin escala en la imagen, eran de ~1,5-2,5 m. La boca mira al
    // N-NNW: con mar del NW-N entra (así funciona la izquierda de Mundaka);
    // del W o del NE queda tapado. Coeficiente por el lado alto, como el
    // resto. Con lectura de cámara vigente, manda la cámara
    // (functions/_lib/oleaje-camaras.js).
    centro: 345, semiancho: 25, coefAbierto: 0.7, coefAbrigado: 0.35, nivel: "semiabrigada",
    criterio:
      "Mundaka está dentro de la boca de la ría de Urdaibai, que se abre al N-NNW entre " +
      "Matxitxako e Izaro. La celda del modelo cae ~15 km mar adentro. Con mar del NW-N la ola " +
      "entra y rompe en la barra, refractada; del W o del NE queda tapada. Contrastado el " +
      "2026-10-08 12:20 con la cámara de la barra (series de ~1,5-2,5 m a ojo, con 3,1-3,5 m en " +
      "las boyas de Bilbao).",
  },
  pasaia: {
    centro: 355, semiancho: 15, coefAbierto: 0.2, coefAbrigado: 0.08, nivel: "muy abrigada",
    criterio:
      "Interior del puerto de Pasaia: bocana estrecha y en codo abierta al N, entre los " +
      "montes Ulia y Jaizkibel. El oleaje solo entra de frente por la bocana y muy atenuado.",
  },
  getxo: {
    centro: 320, semiancho: 25, coefAbierto: 0.35, coefAbrigado: 0.15, nivel: "abrigada",
    criterio:
      "Ereaga, dentro del Abra de Bilbao: los diques exteriores (Punta Lucero y Santurtzi) y " +
      "Punta Galea cierran el Abra; el oleaje del NW entra por la boca pero muy atenuado, y " +
      "Ereaga solo rompe con mar de fondo muy grande.",
  },
  santander: {
    centro: 60, semiancho: 30, coefAbierto: 0.25, coefAbrigado: 0.08, nivel: "muy abrigada",
    criterio:
      "Las coordenadas del spot (43.462, -3.810) caen en el frente interior de la bahía de " +
      "Santander. La bahía se abre al ENE por una boca estrecha entre la Magdalena y El " +
      "Puntal/Somo; el oleaje del N y NW lo recibe El Sardinero, no el interior.",
  },
  santona: {
    centro: 40, semiancho: 30, coefAbierto: 0.35, coefAbrigado: 0.12, nivel: "muy abrigada",
    criterio:
      "Santoña, al resguardo del monte Buciero, en la bahía/estuario que se abre al NE hacia " +
      "Laredo. El oleaje del W-NW lo tapa el Buciero.",
  },
  ribadeo: {
    centro: 5, semiancho: 20, coefAbierto: 0.35, coefAbrigado: 0.12, nivel: "muy abrigada",
    criterio:
      "Ribadeo está dentro de la ría del Eo, a varios km de la boca, que se abre al N. La celda " +
      "del modelo cae a ~19 km mar adentro.",
  },
  faro: {
    centro: 180, semiancho: 40, coefAbierto: 0.15, coefAbrigado: 0.08, nivel: "muy abrigada",
    criterio:
      "Faro/Olhão están dentro de la laguna de la Ria Formosa, detrás de las islas barrera; el " +
      "oleaje solo entra por las bocas, atenuado.",
  },
};

function normalizar(g) {
  return ((g % 360) + 360) % 360;
}
function diferenciaAngular(a, b) {
  const d = Math.abs(normalizar(a) - normalizar(b));
  return d > 180 ? 360 - d : d;
}

// Coeficiente de abrigo para unos parámetros concretos (exportado aparte para
// poder copiarlo tal cual en index.html, que recibe los parámetros de
// /prevision y no puede importar functions/).
export function coeficienteDesdeParametros(p, dirGrados) {
  if (!p) return 1;
  if (dirGrados === null || dirGrados === undefined || !Number.isFinite(Number(dirGrados))) return p.coefAbierto;
  const d = diferenciaAngular(Number(dirGrados), p.centro);
  if (d <= p.semiancho) return p.coefAbierto;
  if (d >= p.semiancho + TRANSICION_GRADOS) return p.coefAbrigado;
  const t = (d - p.semiancho) / TRANSICION_GRADOS;
  return +(p.coefAbierto + (p.coefAbrigado - p.coefAbierto) * t).toFixed(3);
}

export function coeficienteAbrigo(slug, dirGrados) {
  return coeficienteDesdeParametros(ABRIGO_SPOTS[slug], dirGrados);
}

// Rango que se enseña: ±10 % alrededor del valor (mismo formato que siempre,
// "0.3–0.5m"). Es un rango de presentación, NO una incertidumbre medida.
export function rangoAltura(h) {
  if (h === null || h === undefined || !Number.isFinite(h)) return null;
  return [Math.max(0, +(h * 0.9).toFixed(1)), +(h * 1.1).toFixed(1)];
}

// Distancia aproximada en km (equirectangular, suficiente a estas escalas).
export function distanciaKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((v) => Number.isFinite(Number(v)))) return null;
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)) * 111.32;
  const y = (lat2 - lat1) * 110.57;
  return Math.hypot(x, y);
}

// Oleaje de un bloque horario: mar abierto (lo que da el modelo, ya
// corregido con el factor de zona) y, si el spot es abrigado, la estimación
// en la playa. `alturaMarAbierto` en metros (número), `dirGrados` de donde
// viene la ola.
export function oleajeCostero(slug, alturaMarAbierto, dirGrados) {
  const marAbierto = rangoAltura(alturaMarAbierto);
  const p = ABRIGO_SPOTS[slug];
  if (!p || !marAbierto) return { altura: marAbierto, alturaMarAbierto: marAbierto, coefAbrigo: null };
  const coef = coeficienteDesdeParametros(p, dirGrados);
  return { altura: rangoAltura(alturaMarAbierto * coef), alturaMarAbierto: marAbierto, coefAbrigo: coef };
}

// Descripción por spot que va en /prevision (una vez por spot, no por bloque):
// tipo de zona, parámetros (para que index.html aplique el mismo coeficiente
// a la serie horaria de la ventana de actividad) y dónde cae la celda del
// modelo, para poder decir "mar abierto, a 9 km de la costa".
export function zonaOleaje(spot, celdaLat, celdaLon) {
  const p = ABRIGO_SPOTS[spot.slug];
  const km = distanciaKm(spot.lat, spot.lon, Number(celdaLat), Number(celdaLon));
  return {
    tipo: p ? "abrigada" : "abierta",
    nivel: p ? p.nivel : null,
    parametros: p ? { centro: p.centro, semiancho: p.semiancho, coefAbierto: p.coefAbierto, coefAbrigado: p.coefAbrigado } : null,
    criterio: p ? p.criterio : null,
    celdaModelo: km === null ? null : { lat: Number(celdaLat), lon: Number(celdaLon), distanciaKm: +km.toFixed(1) },
  };
}
