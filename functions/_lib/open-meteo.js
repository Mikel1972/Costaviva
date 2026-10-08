// functions/_lib/open-meteo.js
// Único sitio que sabe construir una URL de Open-Meteo (2026-10-08).
//
// POR QUÉ EXISTE: Costaviva tiene suscripciones de pago, y la API gratuita de
// Open-Meteo es solo para uso NO comercial ("Subscriptions or ads make a site
// or app commercial", open-meteo.com/en/terms). El uso comercial exige un
// plan de pago (Standard/Professional), que da una API key y un host propio
// con el prefijo "customer-" (customer-api.open-meteo.com, etc.; la key va en
// `&apikey=`). El resto de la URL es idéntico.
//
// Cómo funciona: si existe OPEN_METEO_API_KEY (secret de Cloudflare Pages o
// de GitHub Actions), se usa el host comercial con la key; si no, el host
// gratuito de siempre. Así el código funciona hoy y pasa a comercial en
// cuanto Mikel ponga el secret (y haga un redeploy: un secret nuevo no llega
// a lo ya desplegado, trampa 1 de comun).
//
// LA KEY NUNCA SALE AL NAVEGADOR: el navegador habla con /meteo/<api>
// (functions/meteo/[api].js), nunca con Open-Meteo. Y los mensajes de error
// que construye este módulo llevan la URL SIN la key (urlSinClave), porque
// algunos endpoints (p. ej. /prevision) devuelven el texto del error en su
// JSON público.
//
// Sin dependencias ni APIs de Cloudflare: lo importan las Pages Functions y
// también scripts de Node (scripts/turbidez/medir-turbidez.mjs) y los tests.

export const APIS_OPEN_METEO = {
  forecast: { libre: "api.open-meteo.com", comercial: "customer-api.open-meteo.com", ruta: "/v1/forecast" },
  marine: { libre: "marine-api.open-meteo.com", comercial: "customer-marine-api.open-meteo.com", ruta: "/v1/marine" },
  archive: { libre: "archive-api.open-meteo.com", comercial: "customer-archive-api.open-meteo.com", ruta: "/v1/archive" },
  "historical-forecast": {
    libre: "historical-forecast-api.open-meteo.com",
    comercial: "customer-historical-forecast-api.open-meteo.com",
    ruta: "/v1/forecast",
  },
  "air-quality": {
    libre: "air-quality-api.open-meteo.com",
    comercial: "customer-air-quality-api.open-meteo.com",
    ruta: "/v1/air-quality",
  },
};

export const ATRIBUCION_OPEN_METEO = "Datos meteorológicos: Open-Meteo.com (CC BY 4.0)";

const USER_AGENT = "Mozilla/5.0 (compatible; CostaVivaApp/0.1)";

// Key desde `env` de Cloudflare (context.env) o process.env en Node. Vacía o
// solo espacios cuenta como "no hay key" (modo gratuito).
export function claveOpenMeteo(env) {
  const v = env && typeof env.OPEN_METEO_API_KEY === "string" ? env.OPEN_METEO_API_KEY.trim() : "";
  return v || "";
}

// `consulta`: query string SIN "?" (p. ej. "latitude=43.4&longitude=-2.7&hourly=...")
// o un objeto/URLSearchParams. Las comas de latitude=a,b,c se dejan tal cual
// si llega como string, igual que se hacía antes de este módulo.
export function urlOpenMeteo(api, consulta, apiKey = "") {
  const def = Object.prototype.hasOwnProperty.call(APIS_OPEN_METEO, api) ? APIS_OPEN_METEO[api] : null;
  if (!def) throw new Error(`API de Open-Meteo desconocida: ${api}`);
  let qs = typeof consulta === "string" ? consulta.replace(/^\?/, "") : new URLSearchParams(consulta).toString();
  // Nunca dejar pasar una apikey que venga de fuera en la consulta: la única
  // que vale es la del secret.
  qs = qs
    .split("&")
    .filter((p) => p && !/^apikey=/i.test(p))
    .join("&");
  const host = apiKey ? def.comercial : def.libre;
  const clave = apiKey ? `${qs ? "&" : ""}apikey=${encodeURIComponent(apiKey)}` : "";
  return `https://${host}${def.ruta}?${qs}${clave}`;
}

// La misma URL con la key tapada, para logs y mensajes de error.
export function urlSinClave(url) {
  return String(url).replace(/([?&]apikey=)[^&]*/gi, "$1***");
}

// fetch + json con errores que NUNCA contienen la key. Devuelve el JSON tal
// cual (con varias coordenadas, Open-Meteo devuelve un array).
export async function pedirOpenMeteo(api, consulta, { apiKey = "", fetchImpl = fetch, init = {} } = {}) {
  const url = urlOpenMeteo(api, consulta, apiKey);
  let resp;
  try {
    resp = await fetchImpl(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init.headers || {}) } });
  } catch (e) {
    throw new Error(`Open-Meteo (${api}) sin respuesta: ${urlSinClave(String(e?.message || e))}`);
  }
  if (!resp.ok) {
    const err = new Error(`Open-Meteo (${api}) HTTP ${resp.status} (${urlSinClave(url)})`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Proxy público /meteo/<api> (functions/meteo/[api].js): validación estricta.
//
// No es un proxy abierto: solo forecast y marine, una sola coordenada (sin
// listas: una petición con 200 coordenadas gastaría 200 llamadas de la cuota,
// que Open-Meteo cuenta por ubicación — ROBOT_REGLAS.md, 2026-09-14), solo
// los parámetros y variables que usa la app, y valores con formato fijo.
// Cualquier otra cosa -> 400. Si una pantalla nueva necesita otra variable,
// se añade aquí (y en test/open-meteo.test.js).
// ---------------------------------------------------------------------------

export const PROXY_PERMITIDO = {
  forecast: {
    hourly: new Set([
      "windspeed_10m", "winddirection_10m", "wind_speed_10m", "wind_direction_10m",
      "pressure_msl", "cloudcover", "cloud_cover", "precipitation", "temperature_2m",
    ]),
    current: new Set(["pressure_msl", "cloud_cover", "cloudcover", "temperature_2m", "windspeed_10m", "winddirection_10m"]),
    // Minutos de caché en el edge. El modelo se actualiza cada pocas horas.
    ttlMin: 30,
  },
  marine: {
    hourly: new Set([
      "wave_height", "wave_period", "wave_direction", "sea_surface_temperature",
      "sea_level_height_msl", "ocean_current_velocity", "ocean_current_direction",
    ]),
    current: new Set(["wave_height", "sea_surface_temperature", "sea_level_height_msl"]),
    ttlMin: 60,
  },
};

// Si toda la consulta es de días ya pasados, el dato no cambia: caché larga.
const TTL_PASADO_MIN = 24 * 60;
const ZONAS_HORARIAS = new Set(["Europe/Madrid", "UTC", "GMT"]);
const UNIDADES_VIENTO = new Set(["kmh", "ms", "kn"]);
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_NUM = /^-?\d{1,3}(\.\d+)?$/;
// Rango ±: Open-Meteo admite hasta 92 días atrás en past_days; las fechas
// sueltas se limitan a 31 días de ventana para que nadie pida años de golpe.
const MAX_DIAS_VENTANA = 31;

// Redondeo a 0,01° (~1 km): muchos usuarios cerca del mismo punto comparten
// la misma entrada de caché y la misma llamada a Open-Meteo. La rejilla de
// los modelos es de varios km, así que no cambia el dato que se obtiene.
export function redondearCoordenada(v) {
  return (Math.round(Number(v) * 100) / 100).toFixed(2);
}

function hoyUTC() {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

// Devuelve { ok: true, consulta, ttlSeg } con la consulta canónica (orden fijo,
// coordenadas redondeadas: sirve tal cual como clave de caché), o
// { ok: false, error } si algo no está en la lista blanca.
export function validarConsultaProxy(api, searchParams, { hoy = hoyUTC() } = {}) {
  const reglas = Object.prototype.hasOwnProperty.call(PROXY_PERMITIDO, api) ? PROXY_PERMITIDO[api] : null;
  if (!reglas) return { ok: false, error: `api no permitida: ${api}` };
  const sp = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);

  const vistos = new Set();
  for (const k of sp.keys()) {
    if (vistos.has(k)) return { ok: false, error: `parámetro repetido: ${k}` };
    vistos.add(k);
  }
  const permitidos = new Set([
    "latitude", "longitude", "timezone", "hourly", "current",
    "forecast_days", "past_days", "start_date", "end_date",
    ...(api === "forecast" ? ["windspeed_unit", "wind_speed_unit"] : []),
  ]);
  for (const k of vistos) {
    if (!permitidos.has(k)) return { ok: false, error: `parámetro no permitido: ${k}` };
  }

  const lat = sp.get("latitude");
  const lon = sp.get("longitude");
  if (!lat || !lon || !RE_NUM.test(lat) || !RE_NUM.test(lon)) {
    return { ok: false, error: "latitude/longitude: un solo número cada una" };
  }
  if (Math.abs(+lat) > 90 || Math.abs(+lon) > 180) return { ok: false, error: "coordenadas fuera de rango" };

  const salida = [
    ["latitude", redondearCoordenada(lat)],
    ["longitude", redondearCoordenada(lon)],
  ];

  for (const tipo of ["hourly", "current"]) {
    const v = sp.get(tipo);
    if (v === null) continue;
    const vars = v.split(",");
    if (!vars.length || vars.length > 10 || vars.some((x) => !reglas[tipo].has(x))) {
      return { ok: false, error: `${tipo}: variable no permitida` };
    }
    salida.push([tipo, [...new Set(vars)].sort().join(",")]);
  }
  if (!sp.has("hourly") && !sp.has("current")) return { ok: false, error: "falta hourly o current" };

  const tz = sp.get("timezone");
  if (tz !== null) {
    if (!ZONAS_HORARIAS.has(tz)) return { ok: false, error: "timezone no permitida" };
    salida.push(["timezone", tz]);
  }

  const fd = sp.get("forecast_days");
  const pd = sp.get("past_days");
  const sd = sp.get("start_date");
  const ed = sp.get("end_date");
  if ((sd !== null || ed !== null) && (fd !== null || pd !== null)) {
    return { ok: false, error: "start_date/end_date no se combinan con forecast_days/past_days" };
  }
  if (fd !== null) {
    if (!/^\d{1,2}$/.test(fd) || +fd < 1 || +fd > 16) return { ok: false, error: "forecast_days: 1-16" };
    salida.push(["forecast_days", String(+fd)]);
  }
  if (pd !== null) {
    if (!/^\d{1,2}$/.test(pd) || +pd > 31) return { ok: false, error: "past_days: 0-31" };
    salida.push(["past_days", String(+pd)]);
  }
  let todoPasado = false;
  if (sd !== null || ed !== null) {
    if (!sd || !ed || !RE_FECHA.test(sd) || !RE_FECHA.test(ed) || isNaN(Date.parse(sd)) || isNaN(Date.parse(ed))) {
      return { ok: false, error: "start_date y end_date: AAAA-MM-DD, los dos" };
    }
    const span = diasEntre(sd, ed);
    if (span < 0 || span > MAX_DIAS_VENTANA) return { ok: false, error: `ventana de fechas: 0-${MAX_DIAS_VENTANA} días` };
    salida.push(["start_date", sd], ["end_date", ed]);
    // Margen de un día: con timezone=Europe/Madrid "ayer" en UTC puede ser
    // todavía hoy en local.
    todoPasado = diasEntre(ed, hoy) >= 2;
  }

  if (api === "forecast") {
    const u = sp.get("wind_speed_unit") ?? sp.get("windspeed_unit");
    if (sp.has("wind_speed_unit") && sp.has("windspeed_unit")) return { ok: false, error: "unidad de viento repetida" };
    if (u !== null) {
      if (!UNIDADES_VIENTO.has(u)) return { ok: false, error: "unidad de viento no permitida" };
      salida.push(["wind_speed_unit", u]);
    }
  }

  const consulta = salida.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const ttlSeg = (todoPasado ? TTL_PASADO_MIN : reglas.ttlMin) * 60;
  return { ok: true, consulta, ttlSeg };
}

// Clave de la Cache API: depende solo de la consulta canónica, nunca de la
// key ni de cabeceras del usuario. Va con el origen propio de la petición
// (la Cache API de Cloudflare solo guarda claves del propio dominio).
export function claveCacheProxy(origen, api, consulta) {
  return `${origen}/meteo/${api}?${consulta}`;
}
