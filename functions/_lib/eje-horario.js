// functions/_lib/eje-horario.js
// Eje de horas idéntico al que devuelve Open-Meteo (2026-10-08).
//
// Los adaptadores de fuentes gratuitas (met-norway.js, copernicus-mar.js)
// tienen que devolver EXACTAMENTE la misma forma que Open-Meteo, porque la
// app (prevision.js, index.html, diario.html...) busca las horas por su
// etiqueta ("2026-10-08T14:00") y por índice. Este módulo reproduce cómo
// Open-Meteo arma ese eje:
//   - timezone=Europe/Madrid -> etiquetas en hora local de Madrid; sin
//     timezone, UTC/GMT -> etiquetas en UTC.
//   - start_date/end_date -> días locales completos, ambos incluidos.
//   - un único desfase horario para toda la respuesta (ver ejeHorario).
//   - si no, desde las 00:00 locales de hoy menos past_days (0 por defecto)
//     durante past_days + forecast_days (7 por defecto) días.
// Sin dependencias: lo importan las Functions, los scripts y los tests.

const HORA_MS = 3600 * 1000;
const DIA_MS = 24 * HORA_MS;

const ZONAS = new Set(["Europe/Madrid", "UTC", "GMT"]);

function zonaDe(tz) {
  return tz && ZONAS.has(tz) && tz !== "GMT" ? tz : "UTC";
}

// Minutos que la zona va por delante de UTC en el instante `ms`.
const formateadores = new Map();
export function desfaseMinutos(ms, tz) {
  const zona = zonaDe(tz);
  if (zona === "UTC") return 0;
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    formateadores.set(zona, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((comoUTC - Math.floor(ms / 60000) * 60000) / 60000);
}

const p2 = (n) => String(n).padStart(2, "0");

// "2026-10-08T14:00" en la zona pedida (formato de Open-Meteo).
export function etiquetaHora(ms, tz) {
  const d = new Date(ms + desfaseMinutos(ms, tz) * 60000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00`;
}

function sumarDias(fecha, n) {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Lee de la consulta (URLSearchParams) lo que define el eje.
export function ventanaDeConsulta(sp) {
  const tz = sp.get("timezone") || "GMT";
  const sd = sp.get("start_date");
  const ed = sp.get("end_date");
  const pd = sp.get("past_days");
  const fd = sp.get("forecast_days");
  return {
    timezone: tz,
    start_date: sd || null,
    end_date: ed || null,
    past_days: pd === null ? 0 : Math.max(0, parseInt(pd, 10) || 0),
    forecast_days: fd === null ? 7 : Math.max(0, parseInt(fd, 10) || 0),
  };
}

// Devuelve { horas: [{ ms, etiqueta }], utc_offset_seconds, timezone,
// timezone_abbreviation } para la ventana pedida.
//
// OJO, comprobado en real contra Open-Meteo (2026-10-08, historical-forecast
// del 28 al 30 de marzo pedido en octubre): Open-Meteo usa UN SOLO desfase
// para toda la respuesta, el de la zona en el momento de la petición
// (utc_offset_seconds), y etiqueta cada hora como UTC + ese desfase: siempre
// 24 horas por día, sin hora repetida ni saltada en el cambio de hora. Aquí
// se hace igual para que las etiquetas casen una a una.
export function ejeHorario(ventana, ahora = Date.now()) {
  const tz = ventana.timezone || "GMT";
  const desfaseMs = desfaseMinutos(ahora, tz) * 60000;
  let inicioFecha;
  let dias;
  if (ventana.start_date && ventana.end_date) {
    inicioFecha = ventana.start_date;
    dias = Math.round((Date.parse(ventana.end_date + "T00:00:00Z") - Date.parse(inicioFecha + "T00:00:00Z")) / DIA_MS) + 1;
  } else {
    const hoy = new Date(ahora + desfaseMs).toISOString().slice(0, 10);
    const pasado = ventana.past_days ?? 0;
    inicioFecha = sumarDias(hoy, -pasado);
    dias = pasado + (ventana.forecast_days ?? 7);
  }
  const desde = Date.parse(inicioFecha + "T00:00:00Z") - desfaseMs;
  const horas = [];
  for (let i = 0; i < dias * 24; i++) {
    const ms = desde + i * HORA_MS;
    const d = new Date(ms + desfaseMs);
    horas.push({ ms, etiqueta: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00` });
  }
  const desfase = desfaseMs / 60000;
  const zona = zonaDe(tz);
  return {
    horas,
    utc_offset_seconds: desfase * 60,
    timezone: zona === "UTC" ? "GMT" : zona,
    timezone_abbreviation: desfase === 0 ? "GMT" : `GMT${desfase > 0 ? "+" : "-"}${Math.abs(desfase / 60)}`,
  };
}

// Etiqueta de una hora con el desfase fijo de una respuesta.
export function etiquetaConDesfase(ms, utcOffsetSeconds) {
  const d = new Date(ms + utcOffsetSeconds * 1000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00`;
}

export function horaUTC(ms) {
  return Math.floor(ms / HORA_MS) * HORA_MS;
}

export { HORA_MS, DIA_MS };
