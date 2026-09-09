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

  // --- Ampliación nacional España (coordenadas de localidad conocida, no de
  // un pico/roca concreto — Open-Meteo funciona en cualquier lat/lon del
  // mundo así que no hace falta más verificación que la geografía real) ---
  // Galicia — Rías Baixas
  { slug: "baiona", nombre: "Baiona", lat: 42.117, lon: -8.850 },
  { slug: "aguarda", nombre: "A Guarda", lat: 41.900, lon: -8.867 },
  { slug: "cangas", nombre: "Cangas", lat: 42.266, lon: -8.786 },
  { slug: "cies", nombre: "Vigo (Illas Cíes)", lat: 42.241, lon: -8.721 },
  { slug: "sanxenxo", nombre: "Sanxenxo", lat: 42.400, lon: -8.808 },
  { slug: "ons", nombre: "Illas Ons", lat: 42.383, lon: -8.933 },
  // Galicia — Rías Altas / Costa da Morte
  { slug: "acoruna", nombre: "A Coruña", lat: 43.362, lon: -8.412 },
  { slug: "camarinas", nombre: "Camariñas", lat: 43.130, lon: -9.181 },
  { slug: "corrubedo", nombre: "Corrubedo (Ribeira)", lat: 42.565, lon: -9.047 },
  { slug: "portosin", nombre: "Portosín", lat: 42.755, lon: -8.933 },
  { slug: "ribadeo", nombre: "Ribadeo", lat: 43.539, lon: -7.041 },
  // Asturias / Cantabria (resto de costa no vasca)
  { slug: "llanes", nombre: "Llanes", lat: 43.420, lon: -4.755 },
  { slug: "ribadesella", nombre: "Ribadesella", lat: 43.463, lon: -5.057 },
  { slug: "santander", nombre: "Santander", lat: 43.462, lon: -3.810 },
  { slug: "suances", nombre: "Suances", lat: 43.440, lon: -4.040 },
  { slug: "comillas", nombre: "Comillas", lat: 43.386, lon: -4.292 },
  { slug: "sanvicente", nombre: "San Vicente de la Barquera", lat: 43.383, lon: -4.398 },
  { slug: "santona", nombre: "Santoña", lat: 43.442, lon: -3.440 },
  { slug: "laredo", nombre: "Laredo", lat: 43.413, lon: -3.409 },
  { slug: "castrourdiales", nombre: "Castro Urdiales", lat: 43.385, lon: -3.217 },
  // Cataluña
  { slug: "roses", nombre: "Roses", lat: 42.262, lon: 3.176 },
  { slug: "blanes", nombre: "Blanes", lat: 41.674, lon: 2.791 },
  { slug: "cambrils", nombre: "Cambrils", lat: 41.067, lon: 1.058 },
  // Comunidad Valenciana
  { slug: "peniscola", nombre: "Peñíscola", lat: 40.360, lon: 0.402 },
  { slug: "valencia", nombre: "Valencia (Malvarrosa)", lat: 39.475, lon: -0.322 },
  { slug: "gandia", nombre: "Gandía", lat: 38.993, lon: -0.152 },
  { slug: "denia", nombre: "Dénia", lat: 38.841, lon: 0.105 },
  { slug: "calpe", nombre: "Calpe", lat: 38.645, lon: 0.045 },
  // Murcia
  { slug: "cartagena", nombre: "Cartagena", lat: 37.605, lon: -0.986 },
  { slug: "aguilas", nombre: "Águilas", lat: 37.405, lon: -1.583 },
  { slug: "cabodepalos", nombre: "Cabo de Palos", lat: 37.638, lon: -0.696 },
  // Andalucía — Atlántico
  { slug: "cadiz", nombre: "Cádiz", lat: 36.530, lon: -6.293 },
  { slug: "conil", nombre: "Conil de la Frontera", lat: 36.267, lon: -6.093 },
  { slug: "chipiona", nombre: "Chipiona", lat: 36.739, lon: -6.435 },
  { slug: "puntaumbria", nombre: "Punta Umbría", lat: 37.183, lon: -6.974 },
  // Andalucía — Mediterráneo
  { slug: "malaga", nombre: "Málaga", lat: 36.721, lon: -4.421 },
  { slug: "nerja", nombre: "Nerja", lat: 36.750, lon: -3.875 },
  { slug: "almeria", nombre: "Almería", lat: 36.834, lon: -2.464 },
  { slug: "roquetas", nombre: "Roquetas de Mar", lat: 36.764, lon: -2.614 },
  // Baleares
  { slug: "palma", nombre: "Palma de Mallorca", lat: 39.570, lon: 2.650 },
  { slug: "ciutadella", nombre: "Ciutadella (Menorca)", lat: 40.000, lon: 3.833 },
  { slug: "formentera", nombre: "Formentera (Es Pujols)", lat: 38.722, lon: 1.440 },
  // Canarias
  { slug: "laspalmas", nombre: "Las Palmas (Las Canteras)", lat: 28.140, lon: -15.436 },
  { slug: "santacruztenerife", nombre: "Santa Cruz de Tenerife", lat: 28.464, lon: -16.252 },
  { slug: "elmedano", nombre: "El Médano (Tenerife)", lat: 28.042, lon: -16.539 },
  { slug: "corralejo", nombre: "Corralejo (Fuerteventura)", lat: 28.736, lon: -13.867 },

  // --- Ampliación Portugal (misma lógica: coordenadas de localidad real,
  // previsión vía Open-Meteo — sin boya real disponible, ver BOYAS más abajo) ---
  { slug: "moledo", nombre: "Moledo (Caminha, PT)", lat: 41.864, lon: -8.866 },
  { slug: "vianadocastelo", nombre: "Viana do Castelo (PT)", lat: 41.693, lon: -8.852 },
  { slug: "povoadevarzim", nombre: "Póvoa de Varzim (PT)", lat: 41.381, lon: -8.764 },
  { slug: "matosinhos", nombre: "Matosinhos (PT)", lat: 41.186, lon: -8.701 },
  { slug: "aveiro", nombre: "Aveiro (PT)", lat: 40.644, lon: -8.753 },
  { slug: "figueiradafoz", nombre: "Figueira da Foz (PT)", lat: 40.151, lon: -8.862 },
  { slug: "nazare", nombre: "Nazaré (PT)", lat: 39.603, lon: -9.080 },
  { slug: "peniche", nombre: "Peniche (PT)", lat: 39.339, lon: -9.335 },
  { slug: "ericeira", nombre: "Ericeira (PT)", lat: 38.993, lon: -9.421 },
  { slug: "cascais", nombre: "Cascais (PT)", lat: 38.733, lon: -9.475 },
  { slug: "costadacaparica", nombre: "Costa da Caparica (PT)", lat: 38.647, lon: -9.237 },
  { slug: "troia", nombre: "Tróia (PT)", lat: 38.491, lon: -8.893 },
  { slug: "sines", nombre: "Sines (PT)", lat: 37.956, lon: -8.865 },
  { slug: "milfontes", nombre: "Vila Nova de Milfontes (PT)", lat: 37.726, lon: -8.783 },
  { slug: "sagres", nombre: "Sagres (PT)", lat: 37.008, lon: -8.946 },
  { slug: "lagos", nombre: "Lagos (PT)", lat: 37.102, lon: -8.674 },
  { slug: "faro", nombre: "Faro/Olhão (PT)", lat: 37.019, lon: -7.930 },
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
// modelo). Verificadas una a una el 2026-09-09 contra
// https://poem.puertos.es/portus/StationData?code=<codigo> antes de
// incluirlas — se descartaron 1560 (Melilla) y 2620 (Valencia) por no traer
// datos en las últimas 30h, y 2542 (Mar de Alborán) por estar retirada
// oficialmente desde 2006. Fuente de la lista de códigos: tablas oficiales
// REDCOS (bancodatos.puertos.es/BD/informes/INT_1.pdf) y REDEXT
// (.../INT_2.pdf).
const BOYAS = [
  // REDCOS (costeras, <100m de profundidad)
  { codigo: 1117, nombre: "Gijón", lat: 43.62, lon: -5.66 },
  { codigo: 1101, nombre: "Pasaia II", lat: 43.36, lon: -1.89 },
  { codigo: 1103, nombre: "AP Bilbao", lat: 43.40, lon: -3.13 },
  { codigo: 1239, nombre: "Langosteira (A Coruña)", lat: 43.35, lon: -8.56 },
  { codigo: 1414, nombre: "Las Palmas Este", lat: 28.05, lon: -15.39 },
  { codigo: 1421, nombre: "Sta. Cruz de Tenerife", lat: 28.46, lon: -16.23 },
  { codigo: 1500, nombre: "Tarifa", lat: 36.00, lon: -5.59 },
  { codigo: 1504, nombre: "Algeciras-Pta. Carnero", lat: 36.07, lon: -5.42 },
  { codigo: 1512, nombre: "Ceuta", lat: 35.90, lon: -5.33 },
  { codigo: 1514, nombre: "Málaga", lat: 36.69, lon: -4.42 },
  { codigo: 1712, nombre: "Tarragona", lat: 41.07, lon: 1.19 },
  { codigo: 1731, nombre: "Barcelona II", lat: 41.32, lon: 2.20 },

  // REDEXT (exteriores, >200m de profundidad). Coordenadas aproximadas de
  // la zona/cabo homónimo — el PDF oficial trae el fondeo exacto pero no
  // se extrajo en esta pasada; el código de boya (lo único que importa
  // para pedir datos reales a la API) sí está verificado uno a uno.
  { codigo: 2136, nombre: "Bilbao-Vizcaya", lat: 43.64, lon: -3.04 },
  { codigo: 2242, nombre: "Cabo Peñas", lat: 43.72, lon: -6.16 },
  { codigo: 2244, nombre: "Estaca de Bares", lat: 43.79, lon: -7.69 },
  { codigo: 2246, nombre: "Villano-Sisargas", lat: 43.16, lon: -9.21 },
  { codigo: 2248, nombre: "Cabo Silleiro", lat: 42.11, lon: -8.90 },
  { codigo: 2342, nombre: "Golfo de Cádiz", lat: 36.48, lon: -7.00 },
  { codigo: 2442, nombre: "Gran Canaria", lat: 28.00, lon: -15.60 },
  { codigo: 2446, nombre: "Tenerife Sur", lat: 28.00, lon: -16.60 },
  { codigo: 2548, nombre: "Cabo de Gata", lat: 36.72, lon: -2.19 },
  { codigo: 2610, nombre: "Cabo de Palos", lat: 37.63, lon: -0.70 },
  { codigo: 2720, nombre: "Tarragona (exterior)", lat: 40.68, lon: 1.47 },
  { codigo: 2798, nombre: "Cabo de Begur", lat: 41.95, lon: 3.23 },
  { codigo: 2820, nombre: "Dragonera (Mallorca)", lat: 39.58, lon: 2.32 },
  { codigo: 2838, nombre: "Mahón (Menorca)", lat: 39.87, lon: 4.29 },
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
