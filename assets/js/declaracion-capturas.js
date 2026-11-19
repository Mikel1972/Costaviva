// assets/js/declaracion-capturas.js — ¿hay que declarar esta captura? (2026-11-19)
//
// Costaviva NO declara por el pescador: la declaración legal solo se hace en
// la app oficial de cada país. Aquí solo se avisa, con la norma de la que
// sale, y se enlaza a la app oficial. Nada de "probables": cada especie está
// copiada del texto oficial y la tabla lleva su fuente y fecha.
//
// España: RD 347/2011, art. 3 bis (añadido por el RD 214/2026, BOE-A-2026-6401,
//   en vigor desde el 20-03-2026). Especies del anexo II (protección
//   diferenciada) en cualquier agua, a declarar en PescaREC en las 24 horas
//   siguientes al final de la actividad, retenidas y sueltas. Anexo II
//   consolidado (BOE-A-2011-6099, consultado 2026-11-19): atún rojo, atún
//   blanco, patudo, pez espada, marlines (Makaira), agujas (Tetrapturus),
//   pez vela, merluza, besugo (Orden APA/315/2020) y, desde el RD 214/2026,
//   lubina, bacalao, abadejo, lenguado y lampuga.
//   El resto de especies con medidas de la UE solo en aguas exteriores: no se
//   avisa de ellas (no hay lista cerrada que podamos citar).
// Portugal: RecFishing (app europea), desde el 10-01-2026, según las
//   preguntas frecuentes de la DGRM: robalo (lubina), atún rojo, aguja azul,
//   aguja blanca y marlín peto.
// Nueva Zelanda: no hay obligación general de declarar (MPI): nada.

export const FUENTES = {
  es: { app: "PescaREC", norma: "RD 347/2011, art. 3 bis y anexo II (RD 214/2026)", consultado: "2026-11-19",
        enlaces: { ios: "https://apps.apple.com/es/app/pescarec/id6752486687", android: "https://play.google.com/store/search?q=PescaREC&c=apps" } },
  pt: { app: "RecFishing", norma: "Reg. (CE) 1224/2009, art. 55 (Reg. 2023/2842); DGRM", consultado: "2026-11-19",
        enlaces: { info: "https://dgrm.pt/en/electronic-catch-recording-system" } },
};

// Nombre científico (especie exacta) o género con "spp." (todo el género).
export const ESPECIES = {
  es: [
    "Thunnus thynnus", "Thunnus alalunga", "Thunnus obesus", "Xiphias gladius",
    "Makaira spp.", "Tetrapturus spp.", "Istiophorus albicans", "Merluccius merluccius",
    "Pagellus bogaraveo", "Dicentrarchus labrax", "Gadus morhua", "Pollachius pollachius",
    "Solea solea", "Coryphaena hippurus",
  ],
  pt: ["Dicentrarchus labrax", "Thunnus thynnus", "Makaira nigricans", "Kajikia albida", "Tetrapturus albidus", "Tetrapturus pfluegeri"],
};

const PLAZO_HORAS = { es: 24, pt: 24 };

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function casa(cientifico, patron) {
  const c = norm(cientifico), p = norm(patron);
  if (p.endsWith(" spp.")) return c.split(" ")[0] === p.split(" ")[0];
  return c === p;
}

// "es" | "pt" | null a partir de la región de assets/js/regiones.js.
export function paisDeclaracion(region) {
  const r = String(region || "");
  if (!r) return null;
  if (r === "nueva_zelanda" || r.startsWith("nz")) return null;
  if (r === "portugal" || r === "azores" || r === "madeira") return "pt";
  return "es";
}

// regionPorCoordenadas devuelve una región española para cualquier punto que
// no case con otra (por defecto "cantabrico"). Para no mandar a PescaREC una
// captura hecha en Francia o fuera de la Península e islas, se exige que el
// punto esté en una caja amplia de España y Portugal, sin la costa francesa
// (al este de Hendaya en el Cantábrico, al norte de Portbou en el
// Mediterráneo).
export function puntoEnEspanaOPortugal(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < 27 || lat > 44.5 || lon < -31.5 || lon > 4.6) return false;
  if (lat >= 43.35 && lon > -1.79) return false;
  if (lat >= 42.44 && lon > 2.0) return false;
  return true;
}

// Devuelve { pais, app, plazo_horas, norma, enlaces } o null.
// Un nombre científico con varias especies ("A / B") no se avisa: no
// sabemos cuál fue.
export function declaracionNecesaria(cientifico, region) {
  const pais = paisDeclaracion(region);
  if (!pais || !cientifico || String(cientifico).includes("/")) return null;
  if (!ESPECIES[pais].some((p) => casa(cientifico, p))) return null;
  const f = FUENTES[pais];
  return { pais, app: f.app, plazo_horas: PLAZO_HORAS[pais], norma: f.norma, enlaces: f.enlaces };
}

// Texto para copiar y pegar en la app oficial. `campos` son pares
// [etiqueta, valor] ya traducidos; se omiten los vacíos.
export function textoParaDeclarar(campos) {
  return campos.filter(([, v]) => v != null && v !== "").map(([e, v]) => `${e}: ${v}`).join("\n");
}

// --- Recordatorio (2026-11-19) -------------------------------------------
// Sin notificaciones push ni servidor: un evento de calendario (.ics) con
// alarma que el móvil guarda en su propio calendario. Nada sale de Costaviva.

const HORAS_ANTES_DEL_LIMITE = 4;

// Etiqueta local "AAAA-MM-DDTHH:MM" del final de la actividad: hora de fin de
// la salida (día siguiente si es anterior a la de inicio) o, si no la hay,
// la hora de la captura. null si no hay ninguna.
export function etiquetaFinActividad(salida, captura) {
  if (!salida?.fecha) return null;
  const h = (x) => (x ? String(x).slice(0, 5) : null);
  const fin = h(salida.hora_fin), ini = h(salida.hora_inicio), cap = h(captura?.hora);
  if (fin) {
    const fecha = ini && fin < ini ? sumarUnDia(salida.fecha) : salida.fecha;
    return `${fecha}T${fin}`;
  }
  if (cap) {
    const fecha = ini && cap < ini ? sumarUnDia(salida.fecha) : salida.fecha;
    return `${fecha}T${cap}`;
  }
  return null;
}

function sumarUnDia(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const icsFecha = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsTexto = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Evento de 30 min que empieza HORAS_ANTES_DEL_LIMITE antes de que venza el
// plazo, con alarma al empezar. `finMs`: final de la actividad (UTC).
export function icsRecordatorio({ uid, finMs, plazoHoras, titulo, descripcion, ahoraMs = Date.now() }) {
  const limite = finMs + plazoHoras * 3600e3;
  const inicio = Math.max(limite - HORAS_ANTES_DEL_LIMITE * 3600e3, ahoraMs + 5 * 60e3);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Costaviva//Declarar captura//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@costaviva.org`,
    `DTSTAMP:${icsFecha(ahoraMs)}`,
    `DTSTART:${icsFecha(inicio)}`,
    `DTEND:${icsFecha(inicio + 30 * 60e3)}`,
    `SUMMARY:${icsTexto(titulo)}`,
    `DESCRIPTION:${icsTexto(descripcion)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsTexto(titulo)}`, "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

// Capturas marcadas como "ya declarada" en este dispositivo (localStorage;
// es solo una comodidad: si se borra, vuelve a salir el aviso).
const CLAVE_DECLARADAS = "cv-declaradas";
export function leerDeclaradas(almacen = globalThis.localStorage) {
  try { return new Set(JSON.parse(almacen?.getItem(CLAVE_DECLARADAS) || "[]")); } catch { return new Set(); }
}
export function marcarDeclarada(id, almacen = globalThis.localStorage) {
  try {
    const s = leerDeclaradas(almacen); s.add(String(id));
    almacen?.setItem(CLAVE_DECLARADAS, JSON.stringify([...s].slice(-500)));
  } catch { /* sin almacenamiento: no pasa nada */ }
}
