// assets/js/lluvia-animada.js
//
// Lluvia de las últimas 3 horas, animada sobre el mapa (pedido de Mikel,
// 2026-10-08: "que mostrara la evolución de las últimas tres horas, con
// botón de pause/play; por defecto corriendo en las tomas que tenga,
// mostrando la hora de cada toma").
//
// FUENTE: EUMETSAT H SAF H60B ("Blended SEVIRI / LEO MW precipitation"),
// servida por EUMETView como WMS (capa msg_fes:h60b), la misma
// infraestructura que ya usan los rayos del satélite (index.html).
// - Licencia: los productos H SAF son CC BY 4.0 ("for any purpose, even
//   commercially", hsaf.meteoam.it, comprobado 2026-10-08). EUMETView
//   declara Fees "none" y AccessConstraints "none". Sin API key, sin coste.
// - Atribución obligatoria: "EUMETSAT H SAF (H60B), CC BY 4.0", en el
//   control de atribución del mapa y en el panel.
// - Una toma cada 15 min, con ~45 min de retraso. Es lluvia ESTIMADA por
//   satélite (~5 km), no radar: cubre también mar abierto, donde el radar
//   no llega, pero en tierra es menos fina que un radar.
// - Por qué no RainViewer (lo que había antes, una sola imagen fija): su
//   API gratuita solo da 2 horas de historia y su FAQ (2026-10-08) dice que
//   el uso comercial requiere condiciones aparte ("for commercial
//   integration ... get in touch"). Costaviva es de pago.
// - Por qué no AEMET: su OpenData solo publica la ÚLTIMA imagen de radar
//   (sin historia) y exige API key; su web usa una API interna sin
//   documentar, que no se debe raspar.
// - TIME siempre explícito en cada petición: EUMETView manda cache-control
//   de 7 días por URL (por eso cada toma es cacheable para siempre) y una
//   URL sin hora se quedaría enseñando lluvia vieja.
//
// Lo de arriba del separador es lógica pura (sin DOM ni red), probada en
// test/lluvia-animada.test.js. Lo de abajo monta la capa en Leaflet.

export const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
export const CAPABILITIES_URL =
  "https://view.eumetsat.int/geoserver/msg_fes/h60b/wms?service=WMS&version=1.3.0&request=GetCapabilities";
export const CAPA = "msg_fes:h60b";
export const ATRIBUCION = 'Lluvia: <a href="https://hsaf.meteoam.it/" target="_blank" rel="noopener">EUMETSAT H SAF</a> (H60B), CC BY 4.0';
export const HORAS_VENTANA = 3;
export const PASO_POR_DEFECTO_MIN = 15;
export const RETARDO_FRAME_MS = 600;
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
// Montaje en Leaflet (navegador). `L` y `map` los pasa index.html.
// ===========================================================================

const CSS = `
.lluvia-anim-panel { position: absolute; left: 10px; bottom: 90px; z-index: 900;
  width: 236px; max-width: calc(100vw - 150px); box-sizing: border-box;
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
.lluvia-anim-pasos { display: flex; gap: 2px; margin: 7px 0 6px; }
.lluvia-anim-paso { flex: 1 1 0; height: 8px; min-width: 0; border: 0; padding: 0; border-radius: 2px;
  background: #C9D3D6; cursor: pointer; }
.lluvia-anim-paso.lista { background: #8FB3C0; }
.lluvia-anim-paso.actual { background: #0B2532; }
.lluvia-anim-paso.fallo { background: transparent; outline: 1px dashed #C9D3D6; cursor: default; }
.lluvia-anim-leyenda { height: 8px; border-radius: 2px;
  background: linear-gradient(90deg, #f7fcc8, #c7e9b4, #7fcdbb, #41b6c4, #1d91c0, #225ea8, #253494); }
.lluvia-anim-extremos { display: flex; justify-content: space-between; color: #5C7680; font-size: 10px; margin-top: 2px; }
.lluvia-anim-nota { color: #5C7680; font-size: 10px; margin-top: 5px; }
.lluvia-anim-nota a { color: inherit; }
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
        <div class="lluvia-anim-hora" aria-live="off">--:--</div>
        <div class="lluvia-anim-sub">Cargando tomas…</div>
      </div>
    </div>
    <div class="lluvia-anim-pasos"></div>
    <div class="lluvia-anim-leyenda"></div>
    <div class="lluvia-anim-extremos"><span>0</span><span>5</span><span>20</span><span>50+ mm/h</span></div>
    <div class="lluvia-anim-nota">Lluvia estimada por satélite, una toma cada 15 min (unos 45 min de retraso). Datos: EUMETSAT H SAF, CC BY 4.0.</div>`;
  return panel;
}

// Monta el control. Devuelve { activar(), desactivar(), activo() }.
export function crearLluviaAnimada({ L, map, contenedor, fetchFn = fetch, doc = document }) {
  const panel = crearPanel(doc);
  contenedor.appendChild(panel);
  // Que tocar el panel no arrastre ni haga zoom en el mapa.
  if (L.DomEvent) {
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
  }
  const boton = panel.querySelector('[data-accion="lluvia-play-pausa"]');
  const horaEl = panel.querySelector(".lluvia-anim-hora");
  const subEl = panel.querySelector(".lluvia-anim-sub");
  const pasosEl = panel.querySelector(".lluvia-anim-pasos");

  let activo = false;
  let frames = [];      // horas WMS
  let capas = [];       // L.tileLayer.wms, una por toma
  let carga = [];       // { cargadas, errores, terminado }
  let estado = crearEstado(0);
  let temporizador = null;
  let refresco = null;
  let generacion = 0;   // invalida cargas viejas si se reconstruye

  const listas = () => carga.map((c) => estadoCarga(c) === "ok");

  function pintar() {
    const ls = listas();
    capas.forEach((c, i) => c.setOpacity(i === estado.indice ? 0.75 : 0));
    horaEl.textContent = frames.length ? horaMadrid(frames[estado.indice]) : "--:--";
    const n = ls.filter(Boolean).length;
    const fallos = carga.filter((c) => estadoCarga(c) === "fallo").length;
    const pendientes = frames.length - n - fallos;
    subEl.textContent = !frames.length
      ? "Sin datos de lluvia ahora mismo"
      : pendientes > 0
        ? `Cargando tomas… ${n}/${frames.length}`
        : `${horaMadrid(frames[0])}–${horaMadrid(frames[frames.length - 1])} · ${n} tomas`;
    boton.textContent = estado.reproduciendo ? "⏸" : "▶";
    boton.setAttribute("aria-label", estado.reproduciendo ? "Pausar" : "Reproducir");
    [...pasosEl.children].forEach((el, i) => {
      const e = estadoCarga(carga[i] || {});
      el.className = "lluvia-anim-paso" + (e === "ok" ? " lista" : "") + (e === "fallo" ? " fallo" : "") + (i === estado.indice ? " actual" : "");
    });
  }

  function programar() {
    clearTimeout(temporizador);
    if (!activo) return;
    const ls = listas();
    temporizador = setTimeout(() => {
      estado = avanzar(estado, listas());
      pintar();
      programar();
    }, retardo(estado.indice, ls));
  }

  function quitarCapas() {
    capas.forEach((c) => map.removeLayer(c));
    capas = [];
    carga = [];
  }

  async function leerTiempo() {
    try {
      const resp = await fetchFn(CAPABILITIES_URL);
      if (resp.ok) {
        const dim = parsearDimensionTiempo(await resp.text());
        if (dim) return dim;
      }
    } catch (e) {
      console.log("Lluvia: sin capabilities, se estima la hora:", e.message);
    }
    return { ultima: ultimaEstimada(Date.now()), pasoMs: PASO_POR_DEFECTO_MIN * MIN, lista: null };
  }

  async function construir() {
    const gen = ++generacion;
    const dim = await leerTiempo();
    if (!activo || gen !== generacion) return;
    const nuevos = framesEnVentana(dim);
    if (frames.length && nuevos[nuevos.length - 1] === frames[frames.length - 1]) return; // nada nuevo
    quitarCapas();
    frames = nuevos;
    estado = { ...crearEstado(frames.length), reproduciendo: estado.n ? estado.reproduciendo : true };
    pasosEl.innerHTML = "";
    frames.forEach((t, i) => {
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

      const c = { cargadas: 0, errores: 0, terminado: false };
      carga.push(c);
      // Precarga: todas las tomas se añaden al mapa a la vez, invisibles
      // (opacidad 0) salvo la actual, así el navegador ya tiene sus teselas
      // cuando la animación llega a ellas. Las que fallen se saltan.
      const capa = L.tileLayer.wms(WMS_URL, {
        layers: CAPA,
        styles: "",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        time: t,
        opacity: 0,
        // 512 px por tesela: la mitad de peticiones por lado (el producto
        // es de ~5 km, no gana nada con más detalle), y a partir de zoom 8
        // se reescala la de zoom 8 en vez de pedir más.
        tileSize: 512,
        maxNativeZoom: 8,
        zIndex: 640,
        attribution: i === frames.length - 1 ? ATRIBUCION : "",
      });
      capa.on("loading", () => { c.cargadas = 0; c.errores = 0; c.terminado = false; pintar(); });
      capa.on("tileload", () => { c.cargadas++; });
      capa.on("tileerror", () => { c.errores++; });
      capa.on("load", () => {
        if (gen !== generacion) return;
        c.terminado = true;
        // Mientras no haya nada listo, se enseña la toma más reciente que
        // ya lo esté (la animación arranca sola en cuanto hay tomas).
        const ls = listas();
        if (!ls[estado.indice]) {
          const u = ultimoIndiceListo(ls);
          if (u >= 0) estado = { ...estado, indice: u };
        }
        pintar();
      });
      capa.addTo(map);
      capas.push(capa);
    });
    pintar();
    programar();
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
      panel.hidden = false;
      estado = crearEstado(0);
      frames = [];
      await construir();
      // Cada 5 min se mira si EUMETSAT ha publicado una toma nueva.
      clearInterval(refresco);
      refresco = setInterval(() => { if (activo) construir(); }, 5 * MIN);
    },
    desactivar() {
      activo = false;
      generacion++;
      clearTimeout(temporizador);
      clearInterval(refresco);
      quitarCapas();
      frames = [];
      panel.hidden = true;
    },
  };
}
