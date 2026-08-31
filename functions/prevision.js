// functions/prevision.js
// Cloudflare Pages Function — corre en el servidor (edge de Cloudflare), no
// en el navegador del usuario, así que no sufre los problemas de CORS ni las
// restricciones de red que sí tuvimos en el sandbox de desarrollo.
// Alcanzable en /prevision (sin el prefijo /functions/, por convención).
//
// Fuente de datos: Open-Meteo (Marine API + Forecast API), gratis y sin
// API key. Ya no dependemos de scrapear el HTML de Todosurf — pedimos los
// datos crudos de oleaje (altura, periodo, dirección) y viento por
// coordenadas, y calculamos nosotros mismos todo lo demás (etiquetas de
// hora, rumbos en texto, y el índice de mar combinado que hace el cliente).

const SPOTS = [
  { slug: "lekeitio", nombre: "Lekeitio", lat: 43.3647, lon: -2.5089 },
  { slug: "mundaka", nombre: "Mundaka", lat: 43.4047, lon: -2.6989 },
  { slug: "bakio", nombre: "Bakio", lat: 43.4297, lon: -2.8103 },
  { slug: "sopelana", nombre: "Sopelana", lat: 43.3878, lon: -2.9975 },
  { slug: "plentzia", nombre: "Plentzia", lat: 43.4053, lon: -2.9436 },
  { slug: "getxo", nombre: "Getxo (Ereaga)", lat: 43.3489, lon: -3.0119 },
];

// Bloques de 3h que queremos mostrar, igual que el formato anterior
// (Todosurf), para no tener que tocar el resto de la app.
const HORAS_BLOQUE = { 0: "12am", 3: "3am", 6: "6am", 9: "9am", 12: "12pm", 15: "3pm", 18: "6pm", 21: "9pm" };

const RUMBOS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function rumboDesdeGrados(grados) {
  const idx = Math.round((((grados % 360) + 360) % 360) / 22.5) % 16;
  return RUMBOS[idx];
}

function horaLocalDesdeISO(iso) {
  // Open-Meteo, con timezone=Europe/Madrid, devuelve "YYYY-MM-DDTHH:00" ya
  // en hora local (sin sufijo Z) — leemos la hora directamente del texto,
  // sin conversiones de zona horaria propias.
  return parseInt(iso.slice(11, 13), 10);
}

// Encuentra pleamares/bajamares reales a partir de la curva horaria de
// altura de marea (máximos/mínimos locales) y devuelve el estado actual
// (altura + si sube o baja) más las próximas 2 mareas.
function calcularMarea(horas, alturas) {
  if (!horas.length || !alturas.length) return null;

  const eventos = [];
  for (let i = 1; i < alturas.length - 1; i++) {
    const [prev, cur, next] = [alturas[i - 1], alturas[i], alturas[i + 1]];
    if (cur === null || prev === null || next === null) continue;
    if (cur >= prev && cur >= next) eventos.push({ tipo: "pleamar", hora: horas[i], altura: cur });
    else if (cur <= prev && cur <= next) eventos.push({ tipo: "bajamar", hora: horas[i], altura: cur });
  }

  const ahoraISO = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  let idxAhora = horas.findIndex((h) => h.slice(0, 13) === ahoraISO);
  if (idxAhora === -1) idxAhora = 0;

  const proximas = eventos
    .filter((e) => e.hora > horas[idxAhora])
    .slice(0, 2)
    .map((e) => ({ ...e, hora: e.hora.slice(11, 16), altura: +e.altura.toFixed(2) }));

  const actual = alturas[idxAhora];
  const siguiente = alturas[idxAhora + 1];
  const tendencia = actual === null || siguiente === null ? null : siguiente > actual ? "subiendo" : "bajando";

  return {
    altura: actual === null ? null : +actual.toFixed(2),
    tendencia,
    proximas,
  };
}

// Presión atmosférica: no es una marea (sin máximos/mínimos que buscar),
// así que comparamos el valor actual contra el de 3h antes para ver si
// sube o baja. A diferencia de la fase lunar, la tendencia de presión sí
// tiene respaldo real en pesca — una bajada suele venir antes de un
// cambio de tiempo y coincide con más actividad alimenticia; lo marcamos
// como orientativo, nunca como una certeza.
function calcularPresion(horas, presiones) {
  if (!horas.length || !presiones.length) return null;
  const ahoraISO = new Date().toISOString().slice(0, 13);
  let idxAhora = horas.findIndex((h) => h.slice(0, 13) === ahoraISO);
  if (idxAhora === -1) idxAhora = 0;

  const actual = presiones[idxAhora];
  if (actual === null || actual === undefined) return null;

  const idxAntes = Math.max(0, idxAhora - 3);
  const antes = presiones[idxAntes];
  let tendencia = null;
  if (antes !== null && antes !== undefined) {
    const delta = actual - antes;
    tendencia = delta <= -1 ? "bajando" : delta >= 1 ? "subiendo" : "estable";
  }

  return { valor: Math.round(actual), tendencia };
}

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);
  return resp.json();
}

async function previsionSpot(spot) {
  const paramsComunes = `latitude=${spot.lat}&longitude=${spot.lon}&timezone=Europe%2FMadrid&forecast_days=2`;

  const [marino, viento] = await Promise.all([
    fetchJSON(
      `https://marine-api.open-meteo.com/v1/marine?${paramsComunes}&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl`
    ),
    fetchJSON(
      `https://api.open-meteo.com/v1/forecast?${paramsComunes}&hourly=windspeed_10m,winddirection_10m,precipitation,cloudcover,pressure_msl&windspeed_unit=kmh`
    ),
  ]);
  const tempAguaPorHoraISO = Object.fromEntries(
    (marino.hourly?.time || []).map((t, i) => [t, marino.hourly.sea_surface_temperature?.[i] ?? null])
  );
  const corrientePorHoraISO = Object.fromEntries(
    (marino.hourly?.time || []).map((t, i) => [
      t,
      {
        velocidad: marino.hourly.ocean_current_velocity?.[i] ?? null,
        dirGrados: marino.hourly.ocean_current_direction?.[i] ?? null,
      },
    ])
  );
  const marea = calcularMarea(marino.hourly?.time || [], marino.hourly?.sea_level_height_msl || []);
  const presion = calcularPresion(viento.hourly?.time || [], viento.hourly?.pressure_msl || []);
  const precipNubesPorHoraISO = Object.fromEntries(
    (viento.hourly?.time || []).map((t, i) => [
      t,
      { precipitacion: viento.hourly.precipitation?.[i] ?? null, nubosidad: viento.hourly.cloudcover?.[i] ?? null },
    ])
  );

  const horasOla = marino.hourly?.time || [];
  const horasViento = viento.hourly?.time || [];
  const vientoPorHoraISO = Object.fromEntries(
    horasViento.map((t, i) => [
      t,
      { viento: viento.hourly.windspeed_10m[i], dirGrados: viento.hourly.winddirection_10m[i] },
    ])
  );

  const bloques = [];
  for (let i = 0; i < horasOla.length && bloques.length < 8; i++) {
    const h = horaLocalDesdeISO(horasOla[i]);
    if (!(h in HORAS_BLOQUE)) continue;

    const alturaOla = marino.hourly.wave_height[i];
    const periodoOla = marino.hourly.wave_period[i];
    const dirOlaGrados = marino.hourly.wave_direction[i];
    if (alturaOla === null || alturaOla === undefined) continue;

    const v = vientoPorHoraISO[horasOla[i]];
    const pn = precipNubesPorHoraISO[horasOla[i]];
    const tempAgua = tempAguaPorHoraISO[horasOla[i]];
    const c = corrientePorHoraISO[horasOla[i]];

    bloques.push({
      hora: HORAS_BLOQUE[h],
      // El modelo da un único valor de altura; mostramos un rango pequeño
      // en torno a él (±10%) para mantener el mismo formato que antes en
      // el panel ("0.3–0.5m") en vez de un número seco.
      altura: [Math.max(0, +(alturaOla * 0.9).toFixed(1)), +(alturaOla * 1.1).toFixed(1)],
      periodo: periodoOla === null ? null : Math.round(periodoOla),
      dirOla: dirOlaGrados === null ? null : `${rumboDesdeGrados(dirOlaGrados)} ${Math.round(dirOlaGrados)}°`,
      viento: v ? Math.round(v.viento) : null,
      dirViento: v ? rumboDesdeGrados(v.dirGrados) : null,
      tempAgua: tempAgua === null || tempAgua === undefined ? null : +tempAgua.toFixed(1),
      precipitacion: pn?.precipitacion ?? null,
      nubosidad: pn?.nubosidad ?? null,
      corriente: c?.velocidad ?? null,
      dirCorriente: c?.dirGrados !== null && c?.dirGrados !== undefined ? rumboDesdeGrados(c.dirGrados) : null,
    });
  }

  return {
    slug: spot.slug,
    nombre: spot.nombre,
    lat: spot.lat,
    lon: spot.lon,
    fuente: "Open-Meteo (Marine + Forecast API) — cálculo propio, no Todosurf",
    actualizado: new Date().toISOString(),
    marea,
    presion,
    bloques,
  };
}

// Boyas reales de Puertos del Estado (medidas por satélite/radio, no un
// modelo) que cubren el tramo Lekeitio→Bilbao de oeste a este: Gijón queda
// algo fuera del mapa pero da contexto del Cantábrico, Bilbao-Vizcaya es la
// boya de referencia frente a la zona, y Pasaia II cubre el lado este.
const BOYAS = [
  { codigo: 1117, nombre: "Gijón", lat: 43.62, lon: -5.66 },
  { codigo: 2136, nombre: "Bilbao-Vizcaya", lat: 43.64, lon: -3.04 },
  { codigo: 1101, nombre: "Pasaia II", lat: 43.36, lon: -1.89 },
];

function fechaParaBoya(d) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}@${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
}

async function datosBoya(boya) {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 6 * 3600 * 1000);
  const url =
    `https://poem.puertos.es/portus/StationData?code=${boya.codigo}` +
    `&params=Hm0,Tp,MeanDir,WaterTemp&from=${fechaParaBoya(desde)}&to=${fechaParaBoya(ahora)}`;
  const datos = await fetchJSON(url);
  const cabeceras = datos[0]; // ["UTC", "Hm0 (m)", "Tp (s)", "MeanDir (º)", "WaterTemp (ºC)"] — el orden puede variar
  const filas = datos[1];
  if (!filas || !filas.length) throw new Error("boya sin datos recientes");
  const ultima = filas[filas.length - 1];

  const indice = (nombreCorto) => cabeceras.findIndex((c) => c.startsWith(nombreCorto));
  const valor = (nombreCorto) => {
    const i = indice(nombreCorto);
    return i === -1 || !ultima[i] ? null : ultima[i][0];
  };

  return {
    ...boya,
    actualizado: new Date(ultima[0] * 1000).toISOString(),
    alturaSignificativa: valor("Hm0"),
    periodoPico: valor("Tp"),
    dirOla: (() => {
      const g = valor("MeanDir");
      return g === null ? null : `${rumboDesdeGrados(g)} ${Math.round(g)}°`;
    })(),
    tempAgua: valor("WaterTemp"),
  };
}

// Luna: movida a functions/luna.js (endpoint propio /luna?lat=&lon=) — su
// posición depende de dónde esté centrado el mapa en cada momento, así que
// el navegador la pide aparte en vez de venir fija dentro de /prevision.

// Metadato de la imagen nacional de rayos de AEMET (ver /rayos-imagen) —
// solo la hora de la última actualización, para no repetir la llamada al
// timeline en el navegador.
async function metaRayos() {
  const resp = await fetch("https://www.aemet.es/es/api-eltiempo/rayos/timeline", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const datos = await resp.json();
  const bloques = datos?.ica_horario?.penbal?.variables?.rayos || [];
  if (!bloques.length) throw new Error("sin datos");
  return { actualizado: bloques[bloques.length - 1].fecha };
}

export async function onRequestGet(context) {
  const [resultados, boyas, rayosNacional] = await Promise.all([
    Promise.all(
      SPOTS.map((spot) =>
        previsionSpot(spot).catch((e) => ({ slug: spot.slug, nombre: spot.nombre, error: String(e) }))
      )
    ),
    Promise.all(BOYAS.map((b) => datosBoya(b).catch((e) => ({ ...b, error: String(e) })))),
    metaRayos().catch((e) => ({ error: String(e) })),
  ]);

  return new Response(JSON.stringify({ spots: resultados, boyas, rayosNacional }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Cache corto en el edge de Cloudflare — el modelo de Open-Meteo se
      // actualiza varias veces al día, no hace falta pedirlo en cada visita.
      "cache-control": "public, max-age=1800",
    },
  });
}
