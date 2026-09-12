// functions/luna.js
// Fase y posición de la luna para una ubicación concreta — alcanzable en
// /luna?lat=<lat>&lon=<lon>. Separado de /prevision porque esto cambia
// según dónde esté centrado el mapa en cada momento (no es fijo para toda
// la zona), así que el navegador lo pide aparte cuando el usuario mueve
// el mapa.
//
// Horas de salida/puesta/culminación y fase: Observatorio Naval de EE.UU.
// (aa.usno.navy.mil), API JSON oficial y gratuita. El azimut (por dónde
// sale/se pone) y la altura máxima en el cielo NO están en esa API — la
// página que sí los tiene es HTML pensada para lectura humana, no fiable
// de parsear automáticamente — así que los calculamos nosotros mismos con
// una posición lunar aproximada (fórmula compacta estándar, precisión
// ~0.3-1°, de sobra para saber hacia dónde mirar).

const RUMBOS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function rumboDesdeGrados(grados) {
  const idx = Math.round((((grados % 360) + 360) % 360) / 22.5) % 16;
  return RUMBOS[idx];
}

const FASES_LUNA = {
  "New Moon": { es: "Luna nueva", emoji: "🌑" },
  "Waxing Crescent": { es: "Creciente", emoji: "🌒" },
  "First Quarter": { es: "Cuarto creciente", emoji: "🌓" },
  "Waxing Gibbous": { es: "Gibosa creciente", emoji: "🌔" },
  "Full Moon": { es: "Luna llena", emoji: "🌕" },
  "Waning Gibbous": { es: "Gibosa menguante", emoji: "🌖" },
  "Last Quarter": { es: "Cuarto menguante", emoji: "🌗" },
  "Waning Crescent": { es: "Menguante", emoji: "🌘" },
};

function norm360(x) {
  return ((x % 360) + 360) % 360;
}

function fechaJuliana(fecha) {
  return fecha.getTime() / 86400000 + 2440587.5;
}

function posicionEclipticaLuna(jd) {
  const d = jd - 2451545.0;
  const L = norm360(218.316 + 13.176396 * d);
  const M = ((norm360(134.963 + 13.064993 * d)) * Math.PI) / 180;
  const F = ((norm360(93.272 + 13.22935 * d)) * Math.PI) / 180;
  return { lon: norm360(L + 6.289 * Math.sin(M)), lat: 5.128 * Math.sin(F) };
}

function eclipticaAEcuatorial(lonGrados, latGrados) {
  const eps = (23.4397 * Math.PI) / 180;
  const lon = (lonGrados * Math.PI) / 180;
  const lat = (latGrados * Math.PI) / 180;
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon));
  const ra = norm360(
    (Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)) * 180) / Math.PI
  );
  return { ra, dec: (dec * 180) / Math.PI };
}

function tiempoSiderealGreenwich(jd) {
  const d = jd - 2451545.0;
  return norm360(280.46061837 + 360.98564736629 * d);
}

function altAzLuna(fecha, latObs, lonObs) {
  const jd = fechaJuliana(fecha);
  const { lon, lat } = posicionEclipticaLuna(jd);
  const { ra, dec } = eclipticaAEcuatorial(lon, lat);
  const lst = norm360(tiempoSiderealGreenwich(jd) + lonObs);
  const H = (norm360(lst - ra) * Math.PI) / 180;
  const latR = (latObs * Math.PI) / 180;
  const decR = (dec * Math.PI) / 180;

  const alt = Math.asin(Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(H));
  let az =
    (Math.acos(
      Math.max(-1, Math.min(1, (Math.sin(decR) - Math.sin(alt) * Math.sin(latR)) / (Math.cos(alt) * Math.cos(latR))))
    ) *
      180) /
    Math.PI;
  if (Math.sin(H) > 0) az = 360 - az;

  return { altitud: +((alt * 180) / Math.PI).toFixed(1), azimut: +az.toFixed(1) };
}

function fechaMadridActual() {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const fecha = `${partes.find((p) => p.type === "year").value}-${partes.find((p) => p.type === "month").value}-${partes.find((p) => p.type === "day").value}`;
  const enMadrid = new Date(ahora.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const enUTC = new Date(ahora.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetHoras = Math.round((enMadrid.getTime() - enUTC.getTime()) / 3600000);
  return { fecha, offsetHoras };
}

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);
  return resp.json();
}

async function datosLuna(lat, lon) {
  // lat/lon deben ser number (no string) — una resta/suma de grados con un
  // string concatena en vez de sumar y da NaN en todos los cálculos.
  lat = Number(lat);
  lon = Number(lon);
  const { fecha, offsetHoras } = fechaMadridActual();
  const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${fecha}&coords=${lat.toFixed(4)},${lon.toFixed(4)}&tz=${offsetHoras}`;
  const datos = await fetchJSON(url);
  const p = datos?.properties?.data;
  if (!p) throw new Error("sin datos del Observatorio Naval de EE.UU.");

  const horaDe = (fen) => (p.moondata || []).find((m) => m.phen === fen)?.time || null;
  const horaSalida = horaDe("Rise");
  const horaPuesta = horaDe("Set");
  const horaCulminacion = horaDe("Upper Transit") || horaDe("Lower Transit");

  const aFechaHora = (hhmm) => {
    if (!hhmm) return null;
    const signo = offsetHoras >= 0 ? "+" : "-";
    const offsetStr = String(Math.abs(offsetHoras)).padStart(2, "0");
    return new Date(`${fecha}T${hhmm}:00${signo}${offsetStr}:00`);
  };

  const fSalida = aFechaHora(horaSalida);
  const fPuesta = aFechaHora(horaPuesta);
  const fCulminacion = aFechaHora(horaCulminacion);

  const fase = FASES_LUNA[p.curphase] || { es: p.curphase, emoji: "🌙" };

  return {
    fase: fase.es,
    emoji: fase.emoji,
    // La API de la USNO devuelve esto como texto con el símbolo de
    // porcentaje ("2%"), no como número — guardarlo tal cual rompía el
    // insert en salidas_pesca.luna_iluminacion (columna numeric) con
    // "invalid input syntax for type numeric". parseFloat corta en el
    // primer carácter no numérico, así que "2%" -> 2.
    iluminacion: p.fracillum != null ? parseFloat(p.fracillum) : null,
    horaSalida,
    horaPuesta,
    horaCulminacion,
    azimutSalida: fSalida ? altAzLuna(fSalida, lat, lon).azimut : null,
    azimutPuesta: fPuesta ? altAzLuna(fPuesta, lat, lon).azimut : null,
    alturaMaxima: fCulminacion ? altAzLuna(fCulminacion, lat, lon).altitud : null,
    rumboSalida: fSalida ? rumboDesdeGrados(altAzLuna(fSalida, lat, lon).azimut) : null,
    rumboPuesta: fPuesta ? rumboDesdeGrados(altAzLuna(fPuesta, lat, lon).azimut) : null,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: "faltan lat/lon" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const luna = await datosLuna(lat, lon);
    return new Response(JSON.stringify(luna, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=900", // 15 min: de sobra para algo que cambia en horas
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
