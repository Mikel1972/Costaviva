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
//
// Nueva Zelanda (2026-10-11, pedido de Mikel): piezas en inglés a las 07:00
// hora de NZ (Pacific/Auckland), con datos solo de NZ y el tema elegido por
// las palabras clave de NZ (pieza-nz.mjs). Martes especie, viernes
// condiciones de un spot, sábado reel (condiciones o especie). Sin función de
// la app: sus pantallas están en español. Se preparan la víspera por la tarde
// de NZ (pg_cron a las 05:40/05:20 UTC con lanzar_marketing_nz(); el
// `schedule:` de GitHub, una hora después), así que Mikel las ve por la
// mañana en España y se
// publican a las 20:00 (19:00 en invierno) de la víspera en España; el
// contenedor sigue vivo (caduca a las 24 h). La regla no cambia: cada pieza
// sale solo con su OK (workflow manual "Publicar post de Instagram").
export const MERCADOS = {
  // Hora de Madrid a propósito (ZONA_NEGOCIO): calendario de publicación en España.
  es: { zona: "Europe/Madrid", idioma: "es", nombre: "España" },
  nz: { zona: "Pacific/Auckland", idioma: "en", nombre: "Nueva Zelanda" },
};
export const mercadoValido = (m) => (MERCADOS[m] ? m : "es");

// getDay(): 0 domingo ... 6 sábado. Día y hora, en la zona de su mercado.
export const CALENDARIO = [
  { mercado: "es", dia: 2, formato: "post", tipo: "especie", hora: "08:00" },
  { mercado: "es", dia: 4, formato: "post", tipo: "funcion", hora: "13:00" },
  { mercado: "es", dia: 5, formato: "post", tipo: "condiciones", hora: "08:00" },
  { mercado: "es", dia: 6, formato: "reel", tipo: null, hora: "09:00" },
  { mercado: "nz", dia: 2, formato: "post", tipo: "especie", hora: "07:00" },
  { mercado: "nz", dia: 5, formato: "post", tipo: "condiciones", hora: "07:00" },
  { mercado: "nz", dia: 6, formato: "reel", tipo: null, hora: "07:00" },
];
// Tipos que valen en cada mercado (NZ: sin funciones de la app).
export const TIPOS_NZ = ["especie", "condiciones"];

export const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Funciones de la app que van rotando en el post del jueves (claves de
// FUNCIONES en pieza-datos.mjs).
export const ROTACION_FUNCIONES = ["diario", "grupos", "alarma"];
export function siguienteFuncion(ultima) {
  const i = ROTACION_FUNCIONES.indexOf(ultima);
  return ROTACION_FUNCIONES[(i + 1) % ROTACION_FUNCIONES.length];
}

// Fecha de hoy en una zona, "AAAA-MM-DD".
export function hoyEn(zona, ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}
// Fecha de hoy en España.
export function hoyMadrid(ahora = new Date()) {
  return hoyEn(MERCADOS.es.zona, ahora);
}
export function sumarDias(fechaISO, n) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
export function diaSemana(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Hueco del calendario para una fecha, formato y mercado (o null si ese día
// no toca).
export function huecoDe(fechaISO, formato, mercado = "es") {
  return CALENDARIO.find((h) => h.mercado === mercado && h.dia === diaSemana(fechaISO) && h.formato === formato) || null;
}

// Minutos que la zona va por delante de UTC en ese instante.
function desfaseMinutos(zona, fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha).map((x) => [x.type, x.value]));
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((local - Math.floor(fecha.getTime() / 60000) * 60000) / 60000);
}

// Instante real (Date) de "fechaISO hora" en una zona, con su horario de
// verano o invierno (NZ: NZDT +13 / NZST +12).
export function instanteEn(fechaISO, hora, zona) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const local = Date.UTC(a, m - 1, d, hh, mm);
  let t = local;
  for (let k = 0; k < 3; k++) t = local - desfaseMinutos(zona, new Date(t)) * 60000;
  return new Date(t);
}
// Instante real de "fechaISO hora" en España.
export function instanteMadrid(fechaISO, hora = "08:00") {
  return instanteEn(fechaISO, hora, MERCADOS.es.zona);
}

// Qué pieza hay que preparar en esta pasada. Por defecto, la de MAÑANA en la
// zona del mercado ("es" España, "nz" Nueva Zelanda).
//   fechaForzada: "AAAA-MM-DD" (input del workflow).
//   tipoForzado: fuerza el tipo aunque ese día no toque nada.
// Devuelve null si no toca nada o si ya se hizo (estado.generadas). La clave
// de NZ lleva "-nz": el mismo día puede haber pieza de los dos mercados.
export function piezaAPreparar({ formato, ahora = new Date(), fechaForzada = "", tipoForzado = "", estado = {}, mercado = "es" }) {
  const m = mercadoValido(mercado);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaForzada) ? fechaForzada : sumarDias(hoyEn(MERCADOS[m].zona, ahora), 1);
  const hueco = huecoDe(fecha, formato, m);
  if (!hueco && !tipoForzado) return null;
  if (m === "nz" && tipoForzado && !TIPOS_NZ.includes(tipoForzado)) throw new Error(`En NZ solo hay piezas de ${TIPOS_NZ.join(" o ")} (pedido: ${tipoForzado})`);
  const clave = m === "es" ? `${fecha}-${formato}` : `${fecha}-${formato}-${m}`;
  if (!tipoForzado && estado?.generadas?.[clave]) return null;
  const hora = hueco?.hora || (m === "nz" ? "07:00" : formato === "reel" ? "09:00" : "08:00");
  let tipo = tipoForzado || hueco.tipo;
  return { fecha, formato, tipo, hora, clave, mercado: m, zona: MERCADOS[m].zona, idioma: MERCADOS[m].idioma, dia: NOMBRE_DIA[diaSemana(fecha)] };
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
// bio" ("or tap the link in bio" en las de NZ). En Facebook sí se pueden pulsar.
export const MARCA_ENLACE = "{ENLACE}";
export function captionParaRed(caption, red, campana, idioma = "es") {
  const en = idioma === "en";
  const url = enlaceCampana(red, campana);
  const enlace = red === "instagram" ? `${url.replace(/^https:\/\//, "")} (${en ? "or tap the link in bio" : "o en el enlace de la bio"})` : url;
  const texto = String(caption);
  if (texto.includes(MARCA_ENLACE)) return texto.split(MARCA_ENLACE).join(enlace);
  return `${texto}\n\n🔗 ${en ? "Try it free for 14 days" : "Pruébala 14 días gratis"}: ${enlace}`;
}

// Línea "cuándo publicar" del Issue. Las de NZ dicen además la hora de
// España, que es cuando Mikel tiene que darle al botón.
export function textoCuando({ fecha, hora, dia, mercado = "es" }) {
  const [, m, d] = fecha.split("-").map(Number);
  const base = `${dia} ${d}/${m} a las ${hora}`;
  if (mercadoValido(mercado) === "es") return base;
  const t = instanteEn(fecha, hora, MERCADOS[mercado].zona);
  const fechaEs = hoyEn(MERCADOS.es.zona, t);
  const horaEs = new Intl.DateTimeFormat("en-GB", { timeZone: MERCADOS.es.zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
  const [, me, de] = fechaEs.split("-").map(Number);
  return `${base} hora de ${MERCADOS[mercado].nombre} (en España: ${NOMBRE_DIA[diaSemana(fechaEs)]} ${de}/${me} a las ${horaEs})`;
}
