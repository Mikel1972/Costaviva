// functions/viento-campo.js
// Cloudflare Pages Function — rejilla de viento (velocidad+dirección) para
// la capa de partículas animadas del mapa, estilo Windy (2026-09-19,
// pedido explícito del usuario). Alcanzable en /viento-campo?bbox=S,W,N,E
//
// Formato de salida: el mismo que espera leaflet-velocity (formato
// "wind-js": dos bandas, componente U y V del viento, en m/s) — así el
// frontend no necesita convertir nada, solo pasarlo tal cual a
// L.velocityLayer(). Devuelve un array de snapshots horarios (hoy, hasta
// 24h) para que la barra deslizante de "próximas horas" no necesite pedir
// nada más a Open-Meteo, solo cambiar de índice sobre lo ya descargado.
//
// Cuota de Open-Meteo: verificado que el coste real es por una fórmula
// ponderada (localizaciones × días/14 × variables/10), no una petición
// por localización — una rejilla de ~256 puntos con 1 día y 2 variables
// pesa solo ~3-4 sobre un límite diario de 10.000, seguro incluso sumado
// al resto de llamadas que ya hace la app (ver ROBOT_REGLAS.md, "Cuota
// de Open-Meteo cuenta por ubicación" para el contexto de por qué esto
// se comprobó con cuidado antes de construirlo).
//
// La rejilla se REDONDEA a la retícula de 1° más cercana antes de pedir
// nada -- no al bbox exacto del viewport, que cambia en cada pixel de
// paneo -- así paneos/zooms pequeños reutilizan la misma llamada a
// Open-Meteo y el mismo hueco de caché de Cloudflare, en vez de generar
// una petición nueva cada vez (mismo motivo que la caché real de
// /prevision, ver el comentario largo ahí).

const RESOLUCION_GRADOS = 1; // tamaño de celda de la rejilla redondeada
const PUNTOS_POR_LADO = 16; // 16x16 = 256 puntos, de sobra para que la interpolación bilineal de leaflet-velocity se vea suave
const EXTENSION_MAXIMA_GRADOS = 20; // límite de seguridad si el bbox pedido es enorme (usuario con el mapa muy alejado)

function redondearBbox(sur, oeste, norte, este) {
  let s = Math.floor(sur / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  let o = Math.floor(oeste / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  let n = Math.ceil(norte / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  let e = Math.ceil(este / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  // Límite de seguridad: si el bbox pedido es descomunal (mapa muy
  // alejado), lo recorta a un máximo centrado en el mismo punto medio en
  // vez de pedir una rejilla gigante.
  if (n - s > EXTENSION_MAXIMA_GRADOS) {
    const centro = (n + s) / 2;
    s = Math.floor((centro - EXTENSION_MAXIMA_GRADOS / 2) / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
    n = Math.ceil((centro + EXTENSION_MAXIMA_GRADOS / 2) / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  }
  if (e - o > EXTENSION_MAXIMA_GRADOS) {
    const centro = (e + o) / 2;
    o = Math.floor((centro - EXTENSION_MAXIMA_GRADOS / 2) / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
    e = Math.ceil((centro + EXTENSION_MAXIMA_GRADOS / 2) / RESOLUCION_GRADOS) * RESOLUCION_GRADOS;
  }
  return { sur: s, oeste: o, norte: n, este: e };
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const bboxParam = url.searchParams.get("bbox"); // "sur,oeste,norte,este"
  if (!bboxParam) {
    return new Response(JSON.stringify({ error: "falta el parámetro bbox=sur,oeste,norte,este" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const partes = bboxParam.split(",").map(Number);
  if (partes.length !== 4 || partes.some((v) => !Number.isFinite(v))) {
    return new Response(JSON.stringify({ error: "bbox inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const [sur0, oeste0, norte0, este0] = partes;
  const { sur, oeste, norte, este } = redondearBbox(sur0, oeste0, norte0, este0);

  // Caché real en el edge de Cloudflare, con clave normalizada al bbox
  // redondeado (no a la URL original tal cual, que ya viene redondeada
  // en la práctica porque el frontend manda el bbox ya snapado -- pero
  // redondear aquí también protege si algún día el frontend cambia).
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = `?bbox=${sur},${oeste},${norte},${este}`;
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cacheada = await cache.match(cacheKey);
  if (cacheada) return cacheada;

  const lats = [], lons = [];
  for (let i = 0; i < PUNTOS_POR_LADO; i++) {
    // Fila a fila desde el NORTE hacia el SUR (orden que espera el
    // formato wind-js: la primera fila de `data` es la más al norte).
    const lat = norte - (i / (PUNTOS_POR_LADO - 1)) * (norte - sur);
    for (let j = 0; j < PUNTOS_POR_LADO; j++) {
      const lon = oeste + (j / (PUNTOS_POR_LADO - 1)) * (este - oeste);
      lats.push(lat.toFixed(3));
      lons.push(lon.toFixed(3));
    }
  }

  let datos;
  try {
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}` +
        `&hourly=windspeed_10m,winddirection_10m&wind_speed_unit=ms&forecast_days=1&timezone=UTC`
    );
    if (!resp.ok) throw new Error(`Open-Meteo respondió ${resp.status}`);
    datos = await resp.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: `no se pudo obtener el viento: ${String(e)}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Con varias localizaciones, Open-Meteo devuelve un array (uno por
  // punto, mismo orden que se pidió) en vez de un único objeto.
  const porPunto = Array.isArray(datos) ? datos : [datos];
  const horas = porPunto[0]?.hourly?.time || [];
  const NUM_HORAS = Math.min(horas.length, 24);

  const snapshots = [];
  for (let h = 0; h < NUM_HORAS; h++) {
    const bandaU = new Array(PUNTOS_POR_LADO * PUNTOS_POR_LADO).fill(0);
    const bandaV = new Array(PUNTOS_POR_LADO * PUNTOS_POR_LADO).fill(0);
    for (let p = 0; p < porPunto.length; p++) {
      const velocidad = porPunto[p]?.hourly?.windspeed_10m?.[h];
      const direccionDesde = porPunto[p]?.hourly?.winddirection_10m?.[h];
      if (velocidad == null || direccionDesde == null) continue;
      // winddirection_10m es de dónde SOPLA (convención meteorológica) --
      // para el campo de flujo hace falta hacia dónde EMPUJA, de ahí el
      // signo negativo en las dos componentes.
      const rad = (direccionDesde * Math.PI) / 180;
      bandaU[p] = +(-velocidad * Math.sin(rad)).toFixed(2);
      bandaV[p] = +(-velocidad * Math.cos(rad)).toFixed(2);
    }
    const cabecera = {
      lo1: oeste, la1: norte, lo2: este, la2: sur,
      dx: (este - oeste) / (PUNTOS_POR_LADO - 1),
      dy: (norte - sur) / (PUNTOS_POR_LADO - 1),
      nx: PUNTOS_POR_LADO, ny: PUNTOS_POR_LADO,
      refTime: horas[h], parameterUnit: "m.s-1",
    };
    snapshots.push({
      hora: horas[h],
      data: [
        { header: { ...cabecera, parameterCategory: 2, parameterNumber: 2 }, data: bandaU },
        { header: { ...cabecera, parameterCategory: 2, parameterNumber: 3 }, data: bandaV },
      ],
    });
  }

  const cuerpo = JSON.stringify({ bbox: { sur, oeste, norte, este }, snapshots });
  const respuesta = new Response(cuerpo, {
    headers: {
      "content-type": "application/json",
      // 30 min: el viento no cambia tan rápido como para necesitar algo
      // más fino, y mantiene la cuota de Open-Meteo lejos de cualquier
      // límite pase lo que pase con el tráfico real.
      "cache-control": "public, max-age=1800",
    },
  });
  context.waitUntil(cache.put(cacheKey, respuesta.clone()));
  return respuesta;
}
