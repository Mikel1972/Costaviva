// scripts/marketing/pieza-datos.mjs
// Lógica pura (sin red ni DOM) de las piezas de Instagram en estilo
// "Amanecer" (2026-10-08): qué se cuenta en cada post, story y reel, a partir
// de datos reales. La usan generar-post-instagram.mjs y
// generar-reel-instagram.mjs; la prueba test/pieza-datos.test.js.
//
// Reglas de contenido (Mikel, 2026-10-08):
//   - Sin IA: todo sale de plantillas y de los datos de la app.
//   - Sin fotogramas de cámaras de terceros (Skyline, YouTube, MEO lo
//     prohíben): el "mapa" es la batimetría de EMODnet y los datos.
//   - Ninguna afirmación que no se pueda demostrar ("la primera app...":
//     Ley General de Publicidad). Los claims de abajo son comprobables
//     abriendo la app.
//   - Alarma: texto honesto. El SOS manda un email con tu ubicación a tus
//     contactos; la detección de caída es experimental y SOLO funciona con la
//     app abierta y la pantalla visible. Nada de "te salva la vida".
import * as VA from "../../assets/js/ventana-actividad.js";
import "../../assets/js/nivel-indice.js";

const { nivelPesca } = globalThis.NivelIndice;

// ---------------------------------------------------------------------------
// Índice de pesca del día para un spot: la misma cuenta que la ficha de la
// app (mejor especie de temporada en la hora actual, sin vedas) y la tira de
// 24 horas de esa especie para la "ventana del día".
export function resumenDelDia(especiesDatos, horas, { lat, lon, ahoraISO, modalidad = "costa" }) {
  const hoy = ahoraISO.slice(0, 10);
  const i = horas.findIndex((h) => h.hora.slice(0, 13) === ahoraISO.slice(0, 13));
  if (i < 0) return null;
  const contexto = {
    lat, lon, modalidad, horaActual: ahoraISO,
    reglasModalidad: especiesDatos.reglas_por_modalidad, reglasExpertas: especiesDatos.reglas_expertas,
    b0: especiesDatos.indice?.b0_logodds ?? 0,
  };
  const ind = VA.indiceSpot(especiesDatos, horas, i, contexto);
  if (ind.puntuacion === null || ind.puntuacion === undefined) return null;
  const especie = especiesDatos.especies.find((e) => e.id === ind.especie.id);
  const ventana = VA.calcularVentana(especie, especiesDatos.reglas_por_defecto, horas, { ...contexto, region: ind.region });
  const barras = [];
  horas.forEach((h, j) => { if (h.hora.slice(0, 10) === hoy) barras.push(Math.round(ventana[j].puntuacion)); });
  return {
    puntuacion: Math.round(ind.puntuacion),
    nivel: nivelPesca(ind.puntuacion),
    especie: ind.especie.nombre,
    especieId: ind.especie.id,
    emoji: especie.emoji || "🐟",
    freza: !!ind.freza,
    motivos: motivosDestacados(ind.resultado.razones),
    barras,
    mejorTramo: mejorTramo(barras),
  };
}

// Los motivos con más peso, como en la ficha (▲▲ sube mucho ... ▼▼ baja mucho).
export function flecha(aporte) {
  if (aporte >= 6) return "▲▲";
  if (aporte > 0) return "▲";
  if (aporte <= -6) return "▼▼";
  if (aporte < 0) return "▼";
  return "";
}
export function motivosDestacados(razones, max = 3) {
  return [...(razones || [])]
    .filter((r) => r.aporte)
    .sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte))
    .slice(0, max)
    .map((r) => ({ texto: r.texto, flecha: flecha(r.aporte), sube: r.aporte > 0 }));
}

// Tramo de 3 horas con la media más alta de la tira (empates: el primero).
export function mejorTramo(barras, ancho = 3) {
  if (barras.length < ancho) return null;
  let mejor = -1, desde = 0;
  for (let k = 0; k + ancho <= barras.length; k++) {
    const media = barras.slice(k, k + ancho).reduce((a, b) => a + b, 0) / ancho;
    if (media > mejor) { mejor = media; desde = k; }
  }
  const hh = (n) => String(n).padStart(2, "0");
  return { desde, hasta: desde + ancho, texto: `${hh(desde)}–${hh(desde + ancho)} h` };
}

// ---------------------------------------------------------------------------
// Textos de las tres tarjetas de datos, a partir del bloque de /prevision.
export function tarjetasCondiciones(bloque, marea) {
  const ola = bloque?.altura ? `${fmt(bloque.altura[0])}–${fmt(bloque.altura[1])} m` : "—";
  const dirOla = (bloque?.dirOla || "").split(" ")[0];
  const viento = bloque?.viento != null ? `${Math.round(bloque.viento)} km/h` : "—";
  const dirViento = (bloque?.dirViento || "").split(" ")[0];
  const flechaMarea = marea?.tendencia === "subiendo" ? "↑" : marea?.tendencia === "bajando" ? "↓" : "";
  const prox = marea?.proximas?.[0];
  return [
    { icono: "ola", etq: "Ola", val: ola, sub: [bloque?.periodo ? `${bloque.periodo} s` : "", dirOla].filter(Boolean).join(" · ") },
    { icono: "viento", etq: "Viento", val: viento, sub: [dirViento, textoFuerzaViento(bloque?.viento)].filter(Boolean).join(", ") },
    { icono: "marea", etq: "Marea", val: marea?.altura != null ? `${fmt(marea.altura)} m ${flechaMarea}`.trim() : "—", sub: prox ? `${prox.tipo} ${prox.hora}${prox.manana ? " (mañana)" : ""}` : "" },
  ];
}
function fmt(n) {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}
export function textoFuerzaViento(kmh) {
  if (kmh == null) return "";
  if (kmh < 12) return "flojo";
  if (kmh < 29) return "moderado";
  if (kmh < 50) return "fuerte";
  return "muy fuerte";
}

// ---------------------------------------------------------------------------
// Ganchos (pantalla 1 del reel) y claims (cierre). Solo afirmaciones que se
// comprueban abriendo la app; nada de "la primera", "la única" o "la mejor".
// Ojo: la app NO tiene "tipo de fondo" (roca/arena), tiene batimetría
// (profundidad, capa "Fondo"): por eso el claim dice "profundidad del fondo".
export const GANCHOS = {
  condiciones: (spot) => `¿Te merece la pena ir hoy a ${spot}?`,
  especie: (especie) => `¿Sale hoy ${articulo(especie)} ${especie.toLowerCase()}?`,
  diario: () => "¿Dónde y con qué mar pescaste tu mejor pieza?",
  grupos: () => "¿Dónde pescan hoy tus amigos?",
  alarma: () => "¿Pescas solo en las rocas?",
};
export const CLAIMS = [
  "Caudal de ríos, turbidez del agua, profundidad del fondo y cámaras: todo en una app.",
  "Ola, viento, marea e índice de pesca de tu spot, hora a hora.",
  "Tu diario guarda el mar que hacía en cada salida.",
];
function articulo(especie) {
  return /a$/i.test(especie) && !/^(pulpo|sargo|robalo)/i.test(especie) ? "la" : "el";
}

// Piezas de funciones de la app (Mikel, 2026-10-08), con captura real de la
// pantalla dentro de un marco de móvil. Textos honestos y verificables.
export const FUNCIONES = {
  diario: {
    pagina: "/diario.html",
    titulo: "Tu diario de pesca",
    frase: "Apunta cada salida y la app guarda el mar que hacía: ola, viento, marea e índice de pesca de ese día.",
    puntos: ["Calendario de salidas", "Capturas con foto", "Condiciones de cada salida"],
    claim: "Tu diario guarda el mar que hacía en cada salida.",
  },
  grupos: {
    pagina: "/grupos.html",
    titulo: "Pesca con tus amigos",
    frase: "Crea un grupo con tu cuadrilla y compartid ubicaciones, capturas y calendario.",
    puntos: ["Grupos privados por invitación", "Ubicaciones compartidas", "Aviso de novedades en el grupo"],
    claim: "Grupos privados con tu cuadrilla: ubicaciones, capturas y calendario.",
  },
  alarma: {
    pagina: "/alarma.html",
    titulo: "SOS en un toque",
    frase: "Avisa a tus contactos de emergencia con tu ubicación por email, y llama al 112 desde la app.",
    puntos: ["SOS por email a tus contactos", "Detección de caída mientras pescas con la app abierta (experimental)", "Llamada rápida al 112"],
    aviso: "La detección de caída es experimental y solo funciona con la app abierta y la pantalla visible.",
    claim: "SOS: avisa a tus contactos con tu ubicación en un toque.",
  },
};

// Rotación de los reels: no todos son de condiciones. Cada pasada toma la
// siguiente; el estado (último índice) lo guarda el workflow en disco.
export const ROTACION_REELS = ["condiciones", "diario", "condiciones", "grupos", "especie", "alarma"];
export function siguientePieza(ultimoIndice) {
  const i = (Number.isInteger(ultimoIndice) ? ultimoIndice + 1 : 0) % ROTACION_REELS.length;
  return { indice: i, tipo: ROTACION_REELS[i] };
}

// ---------------------------------------------------------------------------
// Guion del reel: 3 escenas en segundos. gancho (vídeo + texto), datos
// (animados) y cierre (llamada a la acción). escenaEn(t) dice cuál toca y en
// qué punto va (0..1); es lo que pinta cada fotograma de la plantilla.
export const GUION_REEL = [
  { escena: "gancho", dura: 3.5 },
  { escena: "datos", dura: 5.5 },
  { escena: "cierre", dura: 1.5 },
];
export const DURACION_REEL = GUION_REEL.reduce((a, e) => a + e.dura, 0);
export function escenaEn(t, guion = GUION_REEL) {
  let inicio = 0;
  for (const e of guion) {
    if (t < inicio + e.dura) return { escena: e.escena, progreso: (t - inicio) / e.dura, inicio };
    inicio += e.dura;
  }
  const ultima = guion[guion.length - 1];
  return { escena: ultima.escena, progreso: 1, inicio: inicio - ultima.dura };
}
// Cuenta del índice: sube con frenada suave y acaba EXACTAMENTE en el valor.
export function contar(valor, progreso) {
  const p = Math.max(0, Math.min(1, progreso));
  return Math.round(valor * (1 - Math.pow(1 - p, 3)));
}
export function fotogramas(fps = 30, duracion = DURACION_REEL) {
  return Math.round(fps * duracion);
}

// Recorte EMODnet de la zona del spot (EPSG:3857), para el minimapa.
export function bboxMercator(lat, lon, anchoKm = 60, proporcion = 0.62) {
  const R = 6378137;
  const x = (lon * Math.PI / 180) * R;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R;
  // En Mercator un km de terreno ocupa 1/cos(lat) metros proyectados.
  const k = 1 / Math.cos(lat * Math.PI / 180);
  const ancho = anchoKm * 1000 * k, alto = ancho * proporcion;
  return { minx: x - ancho / 2, miny: y - alto * 0.62, maxx: x + ancho / 2, maxy: y + alto * 0.38, x, y };
}
