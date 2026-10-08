// scripts/marketing/calendario.mjs
// Calendario de contenido de redes (2026-10-09, fase de captación de Mikel):
// 3 posts y 1 reel por semana, con la pieza lista LA TARDE ANTERIOR para que
// Mikel solo tenga que aprobarla por la mañana. Lógica pura (sin red):
// test/calendario-marketing.test.js.
//
// Quién lo lanza: pg_cron (migración 20261009130000_programador_marketing)
// la tarde anterior; el `schedule:` de GitHub queda de respaldo una hora
// después. El estado (calendario-estado.json) evita repetir una pieza si se
// lanzan los dos.
//
// Horas de publicación (hora de España). Criterio, sin datos propios todavía
// (con 1 seguidor no hay estadística de la cuenta): las franjas que los
// estudios de Instagram y Facebook en España repiten para entre semana son
// primera hora (8-9 h, antes de trabajar) y la comida (13-14 h); en fin de
// semana, la mañana. Para pesca, además, la gente decide la salida la víspera
// o esa misma mañana. Cuando haya métricas propias (metricas-instagram.yml)
// se ajustan aquí.
//   - Martes 08:00  post de especie de temporada (planear la semana).
//   - Jueves 13:00  post de una función de la app (diario, grupos, alarma).
//   - Viernes 08:00 post de condiciones de un spot (el finde se decide hoy).
//   - Sábado 09:00  reel (rotación ROTACION_REELS de pieza-datos.mjs).
// El contenedor de Instagram caduca 24 h después de crearse (~19:30 de la
// víspera), así que todas las horas caen dentro de ese margen.

// getDay(): 0 domingo ... 6 sábado.
export const CALENDARIO = [
  { dia: 2, formato: "post", tipo: "especie", hora: "08:00" },
  { dia: 4, formato: "post", tipo: "funcion", hora: "13:00" },
  { dia: 5, formato: "post", tipo: "condiciones", hora: "08:00" },
  { dia: 6, formato: "reel", tipo: null, hora: "09:00" },
];

export const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Funciones de la app que van rotando en el post del jueves (claves de
// FUNCIONES en pieza-datos.mjs).
export const ROTACION_FUNCIONES = ["diario", "grupos", "alarma"];
export function siguienteFuncion(ultima) {
  const i = ROTACION_FUNCIONES.indexOf(ultima);
  return ROTACION_FUNCIONES[(i + 1) % ROTACION_FUNCIONES.length];
}

// Fecha de hoy en España, "AAAA-MM-DD".
export function hoyMadrid(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}
export function sumarDias(fechaISO, n) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
export function diaSemana(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Hueco del calendario para una fecha y formato (o null si ese día no toca).
export function huecoDe(fechaISO, formato) {
  return CALENDARIO.find((h) => h.dia === diaSemana(fechaISO) && h.formato === formato) || null;
}

// Instante real (Date) de "fechaISO hora" en España, con su horario de
// verano o invierno.
export function instanteMadrid(fechaISO, hora = "08:00") {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  for (const desfase of [2, 1]) {
    const t = new Date(Date.UTC(a, m - 1, d, hh - desfase, mm));
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(t).map((x) => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}` === fechaISO && Number(p.hour) === hh) return t;
  }
  return new Date(Date.UTC(a, m - 1, d, hh - 1, mm));
}

// Qué pieza hay que preparar en esta pasada. Por defecto, la de MAÑANA.
//   fechaForzada: "AAAA-MM-DD" (input del workflow).
//   tipoForzado: fuerza el tipo aunque ese día no toque nada.
// Devuelve null si no toca nada o si ya se hizo (estado.generadas).
export function piezaAPreparar({ formato, ahora = new Date(), fechaForzada = "", tipoForzado = "", estado = {} }) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaForzada) ? fechaForzada : sumarDias(hoyMadrid(ahora), 1);
  const hueco = huecoDe(fecha, formato);
  if (!hueco && !tipoForzado) return null;
  const clave = `${fecha}-${formato}`;
  if (!tipoForzado && estado?.generadas?.[clave]) return null;
  const hora = hueco?.hora || (formato === "reel" ? "09:00" : "08:00");
  let tipo = tipoForzado || hueco.tipo;
  return { fecha, formato, tipo, hora, clave, dia: NOMBRE_DIA[diaSemana(fecha)] };
}

// Apunta una pieza hecha; se guardan solo las 40 últimas.
export function apuntarGenerada(estado = {}, clave, datos) {
  const generadas = { ...(estado.generadas || {}), [clave]: { ...datos, en: new Date().toISOString() } };
  const claves = Object.keys(generadas).sort().slice(-40);
  return { ...estado, generadas: Object.fromEntries(claves.map((k) => [k, generadas[k]])) };
}

// ---------------------------------------------------------------------------
// Enlaces con UTM. Campaña = fecha + pieza ("20261013-condiciones-bakio"):
// así en las métricas se ve qué pieza trajo cada visita y cada alta.
export const LANDING = "https://costaviva.org/empieza";
export function campanaDePieza(fechaISO, slug) {
  const limpio = String(slug || "pieza").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${fechaISO.replace(/-/g, "")}-${limpio}`.slice(0, 60).replace(/-+$/, "");
}
export function enlaceCampana(red, campana) {
  if (!["instagram", "facebook"].includes(red)) throw new Error(`Red no válida: ${red}`);
  return `${LANDING}?utm_source=${red}&utm_medium=social&utm_campaign=${campana}`;
}

// El texto de la pieza lleva el hueco {ENLACE}. En Instagram los enlaces del
// texto no se pueden pulsar: va sin https:// y con "o en el enlace de la
// bio". En Facebook sí se pueden pulsar.
export const MARCA_ENLACE = "{ENLACE}";
export function captionParaRed(caption, red, campana) {
  const url = enlaceCampana(red, campana);
  const enlace = red === "instagram" ? `${url.replace(/^https:\/\//, "")} (o en el enlace de la bio)` : url;
  const texto = String(caption);
  if (texto.includes(MARCA_ENLACE)) return texto.split(MARCA_ENLACE).join(enlace);
  return `${texto}\n\n🔗 Pruébala 7 días gratis: ${enlace}`;
}

// Línea "cuándo publicar" del Issue.
export function textoCuando({ fecha, hora, dia }) {
  const [, m, d] = fecha.split("-").map(Number);
  return `${dia} ${d}/${m} a las ${hora}`;
}
