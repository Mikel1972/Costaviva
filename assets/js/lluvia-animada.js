// assets/js/lluvia-animada.js
//
// Lluvia de las últimas 3 horas, animada sobre el mapa (pedidos de Mikel,
// 2026-10-08: "que mostrara la evolución de las últimas tres horas, con botón
// de pause/play; por defecto corriendo en las tomas que tenga, mostrando la
// hora de cada toma" y "es imprescindible que sea lo más cercano en tiempo").
//
// FUENTE PRINCIPAL — radar EUMETNET OPERA (composición europea de
// reflectividad con los radares de AEMET, IPMA y Météo-France): publica una
// toma cada 5 min (la animación usa una cada 10 y siempre la última), publicada ~4-5 min después de su hora (medido 2026-10-08: la de las
// 10:35 UTC estaba en el bucket a las 10:39:15). Licencia CC BY 4.0, uso
// comercial permitido. Llega por functions/lluvia/tomas.js y toma.js (el
// bucket no manda CORS); aquí se descomprime, se reproyecta de Lambert
// azimutal a Mercator y se pinta en un canvas por toma.
//
// RESPALDO — satélite EUMETSAT H SAF H60B (WMS de EUMETView, CC BY 4.0, una
// toma cada 15 min con ~45 min de retraso): solo donde el radar no llega (mar
// abierto lejos de costa, Canarias, radares caídos), más tenue, y se dice en
// el panel. Si el radar entero falla, se anima solo el satélite.
//
// Descartados: RainViewer (solo 2 h y sin uso comercial), AEMET OpenData
// (solo la última imagen, con fondo de mapa pintado y clave), Météo-France
// (clave; sus radares ya están en OPERA), IPMA (solo "informativo").
//
// Lo de arriba del separador es lógica pura (sin DOM ni red), probada en
// test/lluvia-animada.test.js. Lo de abajo monta la capa en Leaflet.

export const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
export const CAPABILITIES_URL =
  "https://view.eumetsat.int/geoserver/msg_fes/h60b/wms?service=WMS&version=1.3.0&request=GetCapabilities";
export const CAPA = "msg_fes:h60b";
export const ATRIBUCION =
  'Lluvia: radar <a href="https://www.eumetnet.eu/" target="_blank" rel="noopener">EUMETNET OPERA</a> (AEMET, IPMA, Météo-France) y satélite <a href="https://hsaf.meteoam.it/" target="_blank" rel="noopener">EUMETSAT H SAF</a>, CC BY 4.0';
export const HORAS_VENTANA = 3;
export const PASO_POR_DEFECTO_MIN = 15;
export const RETARDO_FRAME_MS = 400;
export const RETARDO_ULTIMO_MS = 2000;

const MIN = 60 * 1000;

// "PT15M", "PT1H", "PT10M" -> milisegundos (null si no se entiende).
export function duracionISOaMs(txt) {
  const m = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/.exec(String(txt || "").trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return ((+m[1] || 0) * 60 + (+m[2] || 0)) * MIN + (+m[3] || 0) * 1000;
}

// Lee la dimensión time de un GetCapabilities de WMS. Admite las dos formas
// que usa GeoServer: intervalo "inicio/fin/PT15M" o lista "t1,t2,...".
// Devuelve { ultima (ms), pasoMs, lista (ms[] o null) } o null.
export function parsearDimensionTiempo(xml) {
  const m = /<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i.exec(String(xml || ""));
  if (!m) return null;
  const valor = m[1].trim();
  const def = /default="([^"]+)"/i.exec(m[0]);
  if (valor.includes("/") && !valor.includes(",")) {
    const [, fin, periodo] = valor.split("/");
    const ultima = Date.parse(fin);
    const pasoMs = duracionISOaMs(periodo);
    if (!Number.isFinite(ultima)) return null;
    return { ultima, pasoMs: pasoMs || PASO_POR_DEFECTO_MIN * MIN, lista: null };
  }
  const lista = valor.split(",").map((t) => Date.parse(t.trim())).filter(Number.isFinite).sort((a, b) => a - b);
  if (!lista.length) {
    const d = def ? Date.parse(def[1]) : NaN;
    return Number.isFinite(d) ? { ultima: d, pasoMs: PASO_POR_DEFECTO_MIN * MIN, lista: null } : null;
  }
  const pasoMs = lista.length > 1 ? lista[lista.length - 1] - lista[lista.length - 2] : PASO_POR_DEFECTO_MIN * MIN;
  return { ultima: lista[lista.length - 1], pasoMs, lista };
}

// Hora WMS exacta, sin milisegundos: "2026-10-08T09:45:00Z".
export function horaWms(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Todas las tomas de las últimas `horas` horas que acaban en la última toma
// publicada (ambos extremos incluidos), de la más antigua a la más reciente.
// Con lista explícita se usan solo las tomas que existen de verdad.
export function framesEnVentana({ ultima, pasoMs, lista = null }, horas = HORAS_VENTANA) {
  if (!Number.isFinite(ultima)) return [];
  const desde = ultima - horas * 60 * MIN;
  if (lista) return lista.filter((t) => t >= desde && t <= ultima).map(horaWms);
  const paso = pasoMs > 0 ? pasoMs : PASO_POR_DEFECTO_MIN * MIN;
  const out = [];
  for (let t = ultima; t >= desde; t -= paso) out.unshift(horaWms(t));
  return out;
}

// Respaldo si no hay capabilities: la toma de hace 45 min, redondeada a 15.
export function ultimaEstimada(ahoraMs, pasoMs = PASO_POR_DEFECTO_MIN * MIN) {
  const t = ahoraMs - 45 * MIN;
  return t - (t % pasoMs);
}

// "HH:MM" en hora de Madrid (CET/CEST según la fecha, no la del navegador).
// Hora de Madrid a propósito: el radar OPERA y el satélite cubren Europa; NZ tendrá su propia capa (fase 6).
const FORMATO_MADRID = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Madrid",
});
export function horaMadrid(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return FORMATO_MADRID.format(d);
}

// Estado de carga de una toma a partir de lo que ha contado Leaflet.
// 'pendiente' mientras carga, 'fallo' si terminó sin una sola tesela buena.
export function estadoCarga({ cargadas = 0, errores = 0, terminado = false }) {
  if (!terminado) return "pendiente";
  if (cargadas === 0 && errores > 0) return "fallo";
  return "ok";
}

// --- Animación: estado inmutable, funciones puras --------------------------
// listas[i] === true si la toma i está precargada y se puede enseñar.

export function crearEstado(n) {
  return { indice: Math.max(0, n - 1), reproduciendo: true, n };
}

export function alternarReproduccion(estado) {
  return { ...estado, reproduciendo: !estado.reproduciendo };
}

// Siguiente toma lista después de `indice`, dando la vuelta al final. Si no
// hay ninguna otra lista, se queda donde está (o -1 si no hay ninguna).
export function siguienteIndice(indice, listas) {
  const n = listas.length;
  for (let k = 1; k <= n; k++) {
    const i = (indice + k) % n;
    if (listas[i]) return i;
  }
  return -1;
}

export function ultimoIndiceListo(listas) {
  for (let i = listas.length - 1; i >= 0; i--) if (listas[i]) return i;
  return -1;
}

// La última toma disponible se queda más tiempo en pantalla, para que se
// lea bien "cómo está ahora" antes de volver a empezar.
export function retardo(indice, listas, normal = RETARDO_FRAME_MS, ultimo = RETARDO_ULTIMO_MS) {
  return indice === ultimoIndiceListo(listas) ? ultimo : normal;
}

// Un paso de reloj: si está en marcha avanza a la siguiente toma lista.
export function avanzar(estado, listas) {
  if (!estado.reproduciendo) return estado;
  const i = siguienteIndice(estado.indice, listas);
  return i < 0 ? estado : { ...estado, indice: i };
}

// ===========================================================================

// --- Submuestreo -------------------------------------------------------------
// OPERA publica una toma cada 5 min; la animación usa una cada 10 (decisión
// de Mikel, 2026-10-08: la mitad de descarga, ~3,5 MB) pero SIEMPRE con la
// última publicada, aunque no caiga en múltiplo de 10, para no perder
// actualidad.
export const PASO_ANIMACION_MIN = 10;
export function submuestrear(tomasIso, pasoMin = PASO_ANIMACION_MIN) {
  if (!tomasIso.length) return [];
  const ultima = tomasIso[tomasIso.length - 1];
  const out = tomasIso.filter((t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) && (ms / MIN) % pasoMin === 0;
  });
  if (out[out.length - 1] !== ultima) out.push(ultima);
  return out;
}

// --- Retraso -----------------------------------------------------------------
// "hace 6 min", "hace 1 h 5 min", "ahora".
export function textoRetraso(tomaIso, ahoraMs) {
  const t = Date.parse(tomaIso);
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((ahoraMs - t) / MIN));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
}

// Toma de satélite que acompaña a una de radar: la de su cuarto de hora, o
// la última publicada si el satélite aún no ha llegado a esa hora.
export function satelitePara(tomaMs, ultimaSatMs, pasoMs = PASO_POR_DEFECTO_MIN * MIN) {
  const t = tomaMs - (tomaMs % pasoMs);
  return Number.isFinite(ultimaSatMs) ? Math.min(t, ultimaSatMs) : t;
}

// --- Proyección de OPERA ------------------------------------------------------
// Lambert azimutal equivalente sobre el elipsoide WGS84 (Snyder, fórmulas
// 24-13 a 24-17), lat0 55, lon0 10, x0 1 950 000, y0 -2 100 000. Comprobada
// contra proj4 (+proj=laea ... +ellps=WGS84) al milímetro.
const A = 6378137, F = 1 / 298.257223563, E2 = 2 * F - F * F, E = Math.sqrt(E2);
const RAD = Math.PI / 180;
const qf = (phi) => {
  const s = Math.sin(phi);
  return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)));
};
const LAT0 = 55 * RAD, LON0 = 10 * RAD;
const QP = qf(Math.PI / 2), B0 = Math.asin(qf(LAT0) / QP), RQ = A * Math.sqrt(QP / 2);
const D = (A * Math.cos(LAT0)) / Math.sqrt(1 - E2 * Math.sin(LAT0) ** 2) / (RQ * Math.cos(B0));
export function laea(lat, lon) {
  const b = Math.asin(qf(lat * RAD) / QP), lam = lon * RAD - LON0;
  const BB = RQ * Math.sqrt(2 / (1 + Math.sin(B0) * Math.sin(b) + Math.cos(B0) * Math.cos(b) * Math.cos(lam)));
  return [
    BB * D * Math.cos(b) * Math.sin(lam) + 1950000,
    (BB / D) * (Math.cos(B0) * Math.sin(b) - Math.sin(B0) * Math.cos(b) * Math.cos(lam)) - 2100000,
  ];
}
// Esquina superior izquierda de la rejilla (GeoTIFF, ModelTiepoint) y tamaño
// de píxel de la imagen completa.
export const OPERA_ORIGEN = [-500.0002714332659, 499.9999123872258];
export const OPERA_PIXEL_M = 1000;
// Píxel (columna, fila, con decimales) en la vista reducida de `factor`.
export function pixelOpera(lat, lon, factor) {
  const [x, y] = laea(lat, lon);
  return [(x - OPERA_ORIGEN[0]) / (OPERA_PIXEL_M * factor), (OPERA_ORIGEN[1] - y) / (OPERA_PIXEL_M * factor)];
}

// --- Regiones que se pintan (un canvas por región y toma) ---------------------
export const REGIONES = [
  { id: "peninsula", sur: 34.5, norte: 45.5, oeste: -11, este: 5, ancho: 640, radar: true },
  { id: "canarias", sur: 27.4, norte: 29.6, oeste: -18.4, este: -13.2, ancho: 320, radar: false },
];
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const latDeMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
export function altoRegion(r) {
  return Math.round((r.ancho * (mercY(r.norte) - mercY(r.sur))) / ((r.este - r.oeste) * RAD));
}
// Caja EPSG:3857 de la región, para pedir el satélite pixel a pixel igual.
export function bboxMercator(r) {
  const R = 6378137;
  return [r.oeste * RAD * R, mercY(r.sur) * R, r.este * RAD * R, mercY(r.norte) * R];
}

// Para cada píxel del canvas de la región, el índice de la rejilla de radar
// (ventana de la vista reducida) o -1 si cae fuera. Se calcula una vez.
export function indiceRegion(r, ventana) {
  const alto = altoRegion(r);
  const anchoV = ventana.x1 - ventana.x0, altoV = ventana.y1 - ventana.y0;
  const idx = new Int32Array(r.ancho * alto).fill(-1);
  const y0 = mercY(r.norte), y1 = mercY(r.sur);
  for (let j = 0; j < alto; j++) {
    const lat = latDeMercY(y0 + ((j + 0.5) / alto) * (y1 - y0));
    for (let i = 0; i < r.ancho; i++) {
      const lon = r.oeste + ((i + 0.5) / r.ancho) * (r.este - r.oeste);
      const [px, py] = pixelOpera(lat, lon, ventana.factor);
      const cx = Math.floor(px) - ventana.x0, cy = Math.floor(py) - ventana.y0;
      if (cx >= 0 && cy >= 0 && cx < anchoV && cy < altoV) idx[j * r.ancho + i] = cy * anchoV + cx;
    }
  }
  return idx;
}

// --- Paquete de /lluvia/toma ------------------------------------------------
export function desempaquetar(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(u8.subarray(4, 4 + n)));
  const trozos = [];
  let p = 4 + n;
  for (const t of meta.teselas) {
    trozos.push(u8.subarray(p, p + t.len));
    p += t.len;
  }
  if (p !== u8.length) throw new Error("paquete de radar incompleto");
  return { meta, trozos };
}

// Descomprime una tesela deflate (zlib) con la API nativa del navegador.
export async function inflar(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export const SIN_DATO = -9999000;
// Rejilla de dBZ (banda 1) de la ventana. Lo que no llega queda SIN_DATO.
// `crudas[k]` es la tesela k ya descomprimida (float32 LE, bandas intercaladas).
export function rellenarRejilla(meta, crudas, ventana) {
  const anchoV = ventana.x1 - ventana.x0, altoV = ventana.y1 - ventana.y0;
  const rejilla = new Float32Array(anchoV * altoV).fill(SIN_DATO);
  const bandas = meta.bandas || 1;
  meta.teselas.forEach((t, k) => {
    const c = crudas[k];
    if (!c || !c.length) return;
    const f = new Float32Array(c.buffer, c.byteOffset, Math.floor(c.byteLength / 4));
    for (let yy = 0; yy < meta.th; yy++) {
      const Y = t.fila * meta.th + yy - ventana.y0;
      if (Y < 0 || Y >= altoV || t.fila * meta.th + yy >= meta.alto) continue;
      for (let xx = 0; xx < meta.tw; xx++) {
        const X = t.col * meta.tw + xx - ventana.x0;
        if (X < 0 || X >= anchoV || t.col * meta.tw + xx >= meta.ancho) continue;
        const v = f[(yy * meta.tw + xx) * bandas];
        if (v !== undefined) rejilla[Y * anchoV + X] = v;
      }
    }
  });
  return rejilla;
}

// Reflectividad (dBZ) -> intensidad (mm/h), Marshall-Palmer Z = 200 R^1.6.
export function dbzAMmh(dbz) {
  return Math.pow(Math.pow(10, dbz / 10) / 200, 1 / 1.6);
}
// Escala de color compartida por la leyenda (mm/h -> rgb).
export const ESCALA = [
  [0.2, [199, 233, 180]], [0.5, [127, 205, 187]], [1, [65, 182, 196]], [2, [29, 145, 192]],
  [5, [34, 94, 168]], [10, [37, 52, 148]], [20, [122, 1, 119]], [50, [197, 27, 138]],
];
export function colorLluvia(mmh) {
  if (!(mmh >= ESCALA[0][0])) return null;
  let c = ESCALA[0][1];
  for (const [umbral, rgb] of ESCALA) if (mmh >= umbral) c = rgb;
  return c;
}

// Compone una toma: radar donde hay cobertura (aunque no llueva: entonces
// transparente), satélite más tenue donde no. `satelite` es el RGBA del
// satélite al mismo tamaño (o null). Devuelve { rgba, pxRadar, pxSatelite }.
export function componer({ ancho, alto, indice, rejilla, satelite, alfaRadar = 220, alfaSatelite = 0.6 }) {
  const rgba = new Uint8ClampedArray(ancho * alto * 4);
  let pxRadar = 0, pxSatelite = 0;
  for (let p = 0; p < ancho * alto; p++) {
    const k = indice ? indice[p] : -1;
    const v = k >= 0 && rejilla ? rejilla[k] : SIN_DATO;
    if (v > -1e6 || Number.isNaN(v)) {
      pxRadar++;
      const c = Number.isNaN(v) ? null : colorLluvia(dbzAMmh(v));
      if (c) { rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = alfaRadar; }
    } else if (satelite && satelite[p * 4 + 3]) {
      pxSatelite++;
      rgba[p * 4] = satelite[p * 4]; rgba[p * 4 + 1] = satelite[p * 4 + 1]; rgba[p * 4 + 2] = satelite[p * 4 + 2];
      rgba[p * 4 + 3] = Math.round(satelite[p * 4 + 3] * alfaSatelite);
    }
  }
  return { rgba, pxRadar, pxSatelite };
}

// Misma ventana que functions/_lib/radar-opera.js (VENTANA); el test lo vigila.
export const VENTANA_RADAR = { factor: 4, x0: 0, y0: 724, x1: 396, y1: 1092 };

// "YYYYMMDDHHMM" (UTC) de una hora en ms, el parámetro t de /lluvia/toma.
export function sello(ms) {
  return new Date(ms).toISOString().replace(/[-:T]/g, "").slice(0, 12);
}

// ===========================================================================
// Montaje en Leaflet (navegador). `L` y `map` los pasa index.html.
// ===========================================================================

const CSS = `
.lluvia-anim-panel { position: absolute; left: 10px; bottom: 90px; z-index: 900;
  width: 246px; max-width: calc(100vw - 140px); box-sizing: border-box;
  background: #FFFFFF; border: 1px solid #DDE2DC; border-radius: 8px; padding: 8px 10px;
  font: 12px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0B2532;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.lluvia-anim-panel[hidden] { display: none; }
.lluvia-anim-fila { display: flex; align-items: center; gap: 8px; }
.lluvia-anim-boton { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%;
  border: 1px solid #0B2532; background: #0B2532; color: #FFFFFF; font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0; }
.lluvia-anim-hora { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .5px; }
.lluvia-anim-sub { color: #5C7680; font-size: 11px; }
.lluvia-anim-ultima { margin-top: 6px; font-size: 11px; }
.lluvia-anim-ultima b { font-variant-numeric: tabular-nums; }
.lluvia-anim-ultima.vieja b { color: #B3261E; }
.lluvia-anim-pasos { display: flex; gap: 1px; margin: 6px 0; }
.lluvia-anim-paso { flex: 1 1 0; height: 10px; min-width: 0; border: 0; padding: 0; border-radius: 1px;
  background: #E3E8EA; cursor: pointer; }
.lluvia-anim-paso.lista { background: #8FB3C0; }
.lluvia-anim-paso.actual { background: #0B2532; }
.lluvia-anim-paso.fallo { background: transparent; cursor: default; }
.lluvia-anim-leyenda { height: 8px; border-radius: 2px; }
.lluvia-anim-extremos { display: flex; justify-content: space-between; color: #5C7680; font-size: 10px; margin-top: 2px; }
.lluvia-anim-nota { color: #5C7680; font-size: 10px; margin-top: 5px; }
`;

function crearPanel(doc) {
  if (!doc.getElementById("lluviaAnimCss")) {
    const st = doc.createElement("style");
    st.id = "lluviaAnimCss";
    st.textContent = CSS;
    doc.head.appendChild(st);
  }
  const panel = doc.createElement("div");
  panel.className = "lluvia-anim-panel";
  panel.id = "lluviaAnimPanel";
  panel.hidden = true;
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Lluvia de las últimas 3 horas");
  // Sin on*= (CSP con nonce): los eventos se enganchan con addEventListener.
  panel.innerHTML = `
    <div class="lluvia-anim-fila">
      <button type="button" class="lluvia-anim-boton" data-accion="lluvia-play-pausa" aria-label="Pausar">⏸</button>
      <div>
        <div class="lluvia-anim-hora">--:--</div>
        <div class="lluvia-anim-sub">Cargando…</div>
      </div>
    </div>
    <div class="lluvia-anim-ultima"></div>
    <div class="lluvia-anim-pasos"></div>
    <div class="lluvia-anim-leyenda"></div>
    <div class="lluvia-anim-extremos"><span>0,2</span><span>2</span><span>10</span><span>50+ mm/h</span></div>
    <div class="lluvia-anim-nota"></div>`;
  const ley = panel.querySelector(".lluvia-anim-leyenda");
  ley.style.background = `linear-gradient(90deg, ${ESCALA.map(([, c]) => `rgb(${c.join(",")})`).join(", ")})`;
  return panel;
}

function urlSatelite(region, ms) {
  const alto = altoRegion(region);
  const q = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetMap", layers: CAPA, styles: "", format: "image/png",
    transparent: "true", crs: "EPSG:3857", bbox: bboxMercator(region).join(","),
    width: String(region.ancho), height: String(alto), time: horaWms(ms),
  });
  return `${WMS_URL}?${q}`;
}

// Monta el control. Devuelve { activar(), desactivar(), activo() }.
export function crearLluviaAnimada({ L, map, contenedor, fetchFn = (...a) => fetch(...a), doc = document, ahora = () => Date.now() }) {
  const panel = crearPanel(doc);
  contenedor.appendChild(panel);
  if (L.DomEvent) {
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
  }
  const boton = panel.querySelector('[data-accion="lluvia-play-pausa"]');
  const horaEl = panel.querySelector(".lluvia-anim-hora");
  const subEl = panel.querySelector(".lluvia-anim-sub");
  const ultimaEl = panel.querySelector(".lluvia-anim-ultima");
  const pasosEl = panel.querySelector(".lluvia-anim-pasos");
  const notaEl = panel.querySelector(".lluvia-anim-nota");

  let activo = false;
  let gen = 0;
  let modo = "radar";          // "radar" | "satelite" (si el radar entero falla)
  let tomas = [];              // horas ISO, de la más antigua a la más reciente
  let capas = [];              // por toma: [{ overlay, url }] (una por región)
  let estados = [];            // por toma: "pendiente" | "ok" | "fallo"
  let fuentes = [];            // por toma: { radar: bool, satelite: ms|null }
  let estado = crearEstado(0);
  let ultimaSat = NaN;
  let temporizador = null, refresco = null, reloj = null;
  const indices = new Map();   // región -> Int32Array
  const satCache = new Map();  // "región|ms" -> Promise<Uint8ClampedArray|null>
  const enCurso = new Set();   // tomas que ya se están cargando

  const listas = () => estados.map((e) => e === "ok");

  function pintar() {
    capas.forEach((cs, i) => cs.forEach((c) => c.overlay.setOpacity(i === estado.indice && estados[i] === "ok" ? 1 : 0)));
    const t = tomas[estado.indice];
    horaEl.textContent = t ? horaMadrid(t) : "--:--";
    const n = estados.filter((e) => e === "ok").length;
    const pend = estados.filter((e) => e === "pendiente").length;
    if (!tomas.length) subEl.textContent = activo ? "Cargando…" : "";
    else if (pend) subEl.textContent = `Cargando ${n}/${tomas.length}…`;
    else subEl.textContent = `${modo === "radar" ? "Radar" : "Satélite"} · ${textoRetraso(t, ahora())}`;
    const ult = tomas[ultimoIndiceListo(listas())] || tomas[tomas.length - 1];
    ultimaEl.innerHTML = ult ? `Última toma <b>${horaMadrid(ult)}</b> · <b>${textoRetraso(ult, ahora())}</b>` : "";
    ultimaEl.classList.toggle("vieja", !!ult && ahora() - Date.parse(ult) > 20 * MIN);
    const sat = fuentes[estado.indice]?.satelite;
    notaEl.textContent = modo === "radar"
      ? `Radar EUMETNET OPERA, una toma cada 10 min y la última.${sat ? ` Donde no llega el radar (más tenue): satélite H SAF de las ${horaMadrid(horaWms(sat))}.` : ""} CC BY 4.0.`
      : "Radar no disponible ahora: lluvia estimada por satélite EUMETSAT H SAF (cada 15 min, ~45 min de retraso). CC BY 4.0.";
    boton.textContent = estado.reproduciendo ? "⏸" : "▶";
    boton.setAttribute("aria-label", estado.reproduciendo ? "Pausar" : "Reproducir");
    [...pasosEl.children].forEach((el, i) => {
      const e = estados[i];
      el.className = "lluvia-anim-paso" + (e === "ok" ? " lista" : "") + (e === "fallo" ? " fallo" : "") + (i === estado.indice ? " actual" : "");
    });
  }

  function programar() {
    clearTimeout(temporizador);
    if (!activo) return;
    temporizador = setTimeout(() => {
      estado = avanzar(estado, listas());
      pintar();
      programar();
    }, retardo(estado.indice, listas()));
  }

  function pasos() {
    pasosEl.innerHTML = "";
    tomas.forEach((t, i) => {
      const paso = doc.createElement("button");
      paso.type = "button";
      paso.className = "lluvia-anim-paso";
      paso.setAttribute("aria-label", `Toma de las ${horaMadrid(t)}`);
      paso.addEventListener("click", () => {
        if (!listas()[i]) return;
        estado = { ...estado, indice: i, reproduciendo: false };
        pintar();
        programar();
      });
      pasosEl.appendChild(paso);
    });
  }

  async function leerUltimaSatelite() {
    try {
      const r = await fetchFn(CAPABILITIES_URL);
      if (r.ok) {
        const d = parsearDimensionTiempo(await r.text());
        if (d) return d;
      }
    } catch (e) {
      console.log("Lluvia: sin capabilities del satélite:", e.message);
    }
    return { ultima: ultimaEstimada(ahora()), pasoMs: PASO_POR_DEFECTO_MIN * MIN, lista: null };
  }

  function satelite(region, ms) {
    const clave = `${region.id}|${ms}`;
    if (!satCache.has(clave)) {
      satCache.set(clave, new Promise((resolver) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.addEventListener("load", () => {
          try {
            const c = doc.createElement("canvas");
            c.width = region.ancho; c.height = altoRegion(region);
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolver(ctx.getImageData(0, 0, c.width, c.height).data);
          } catch (e) { resolver(null); }
        });
        img.addEventListener("error", () => resolver(null));
        img.src = urlSatelite(region, ms);
      }));
    }
    return satCache.get(clave);
  }

  async function rejillaRadar(t) {
    const r = await fetchFn(`/lluvia/toma?t=${sello(Date.parse(t))}`);
    if (!r.ok) throw new Error(`toma ${r.status}`);
    const { meta, trozos } = desempaquetar(await r.arrayBuffer());
    const crudas = await Promise.all(trozos.map((b) => (b.length ? inflar(b) : new Uint8Array(0))));
    return rellenarRejilla(meta, crudas, VENTANA_RADAR);
  }

  async function cargarToma(t, g) {
    const tMs = Date.parse(t);
    let rejilla = null;
    if (modo === "radar") rejilla = await rejillaRadar(t);
    const satMs = Number.isFinite(ultimaSat) ? satelitePara(tMs, ultimaSat) : null;
    const salida = [];
    let usaSat = false;
    for (const region of REGIONES) {
      if (g !== gen) return null;
      const alto = altoRegion(region);
      let indice = null;
      if (region.radar && rejilla) {
        if (!indices.has(region.id)) indices.set(region.id, indiceRegion(region, VENTANA_RADAR));
        indice = indices.get(region.id);
      }
      const sat = satMs != null ? await satelite(region, satMs) : null;
      const comp = componer({ ancho: region.ancho, alto, indice, rejilla, satelite: sat });
      if (comp.pxSatelite) usaSat = true;
      const c = doc.createElement("canvas");
      c.width = region.ancho; c.height = alto;
      c.getContext("2d").putImageData(new ImageData(comp.rgba, region.ancho, alto), 0, 0);
      const blob = await new Promise((res) => c.toBlob(res, "image/png"));
      const url = URL.createObjectURL(blob);
      const overlay = L.imageOverlay(url, [[region.sur, region.oeste], [region.norte, region.este]], {
        opacity: 0, interactive: false, zIndex: 640,
      });
      salida.push({ overlay, url });
    }
    return { capas: salida, fuentes: { radar: !!rejilla, satelite: usaSat ? satMs : null } };
  }

  function quitar(i) {
    (capas[i] || []).forEach((c) => { map.removeLayer(c.overlay); URL.revokeObjectURL(c.url); });
  }

  // Carga las tomas que falten, de la más reciente a la más antigua, de 3 en 3.
  async function cargarPendientes(g) {
    const cola = tomas.filter((t, i) => estados[i] === "pendiente" && !enCurso.has(t)).reverse();
    cola.forEach((t) => enCurso.add(t));
    const trabajador = async () => {
      while (cola.length && g === gen) {
        const t = cola.shift();
        let res = null;
        try { res = await cargarToma(t, g); } catch (e) { console.log("Lluvia: toma", t, e.message); }
        enCurso.delete(t);
        if (g !== gen) { res?.capas.forEach((c) => URL.revokeObjectURL(c.url)); return; }
        const i = tomas.indexOf(t);
        if (i < 0) { res?.capas.forEach((c) => URL.revokeObjectURL(c.url)); continue; }
        if (res) {
          res.capas.forEach((c) => c.overlay.addTo(map));
          capas[i] = res.capas; fuentes[i] = res.fuentes; estados[i] = "ok";
        } else estados[i] = "fallo";
        if (!listas()[estado.indice]) {
          const u = ultimoIndiceListo(listas());
          if (u >= 0) estado = { ...estado, indice: u };
        }
        pintar();
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador()]);
  }

  async function listaRadar() {
    try {
      const r = await fetchFn("/lluvia/tomas");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.tomas) ? d.tomas : [];
    } catch (e) {
      return [];
    }
  }

  // Pone la lista nueva de tomas conservando las ya cargadas.
  function actualizarTomas(nuevas) {
    const viejas = tomas;
    const nCapas = [], nEstados = [], nFuentes = [];
    nuevas.forEach((t) => {
      const j = viejas.indexOf(t);
      nCapas.push(j >= 0 ? capas[j] : []);
      nEstados.push(j >= 0 ? estados[j] : "pendiente");
      nFuentes.push(j >= 0 ? fuentes[j] : {});
    });
    viejas.forEach((t, j) => { if (!nuevas.includes(t)) quitar(j); });
    const actual = viejas[estado.indice];
    tomas = nuevas; capas = nCapas; estados = nEstados; fuentes = nFuentes;
    const i = tomas.indexOf(actual);
    estado = { ...estado, n: tomas.length, indice: i >= 0 ? i : Math.max(0, tomas.length - 1) };
    pasos();
  }

  async function sincronizar(g) {
    const [radar, dim] = await Promise.all([listaRadar(), leerUltimaSatelite()]);
    if (g !== gen) return;
    ultimaSat = dim.ultima;
    const nuevoModo = radar.length ? "radar" : "satelite";
    if (nuevoModo !== modo) { tomas.forEach((_, j) => quitar(j)); tomas = []; capas = []; estados = []; fuentes = []; }
    modo = nuevoModo;
    actualizarTomas(modo === "radar" ? submuestrear(radar) : framesEnVentana(dim));
    pintar();
    await cargarPendientes(g);
  }

  boton.addEventListener("click", () => {
    estado = alternarReproduccion(estado);
    pintar();
    programar();
  });

  return {
    activo: () => activo,
    async activar() {
      if (activo) return;
      activo = true;
      const g = ++gen;
      panel.hidden = false;
      estado = crearEstado(0);
      map.attributionControl?.addAttribution(ATRIBUCION);
      pintar();
      programar();
      // Cada minuto se mira si hay una toma nueva; cada 30 s, el "hace X min".
      refresco = setInterval(() => { if (activo) sincronizar(g); }, MIN);
      reloj = setInterval(() => { if (activo) pintar(); }, 30 * 1000);
      await sincronizar(g);
    },
    desactivar() {
      activo = false;
      gen++;
      clearTimeout(temporizador); clearInterval(refresco); clearInterval(reloj);
      tomas.forEach((_, j) => quitar(j));
      tomas = []; capas = []; estados = []; fuentes = [];
      satCache.clear(); enCurso.clear();
      map.attributionControl?.removeAttribution(ATRIBUCION);
      panel.hidden = true;
    },
  };
}
