// scripts/oleaje-camaras/camaras.mjs
// Inventario de cámaras para medir la ola (2026-10-08, "utiliza las cámaras
// en todos los spots"). Revisadas UNA A UNA mirando un fotograma real el
// 2026-10-08 entre las 12:20 y las 12:50 (hora de Madrid), con mar de fondo
// del NW de 3,1-4,0 m en las boyas (Pasaia II, Donostia, Bilbao II).
//
// Criterio para que una cámara sirva: ve la zona donde ROMPE la ola del spot
// (o el mar justo delante), y se puede dibujar una zona de medida (ROI) en
// el agua que no toque la orilla en ninguna marea, ni rocas, barcos,
// diques o edificios. Si no, no sirve (y se dice por qué en NO_SIRVEN).
//
// Cada cámara tiene uno o varios ENCUADRES (o, si barre sin repetir plano,
// `dinamico: true`, ver zonasDinamicas() en espuma.mjs): las de la Diputación de
// Gipuzkoa hacen una ronda de posiciones (cada ~20 s cambian de plano), así
// que cada encuadre tiene su imagen de referencia (referencias/<id>.jpg,
// 320x180) y su ROI, y solo se mide un fotograma si se parece a alguna
// referencia (similitud ≥ SIMILITUD_MINIMA de espuma.mjs). Las cámaras de
// imagen fija también tienen referencia: si el proveedor mueve la cámara,
// la lectura sale "otro_encuadre" en vez de medir otra cosa.
//
// ROI en fracciones del encuadre (x0, y0, x1, y1). Todas dibujadas con un
// margen hacia el mar respecto a la orilla de ese momento (marea media
// subiendo); además espuma.mjs descarta la lectura si dentro del ROI hay
// color de arena (`orilla`), que es lo que pasaría con bajamar fuerte.

import { CAMARAS_OLEAJE } from "../../functions/_lib/oleaje-camaras.js";

const DIPU = (stream) => `https://58f14c0895a20.streamlock.net/camaramar/${stream}.stream/playlist.m3u8`;

// Boya de referencia por tramo (ids de Copernicus In Situ, ver
// boyas-copernicus.py): la costera más cercana y, si no tiene dato, la
// exterior.
const BOYA_GIPUZKOA = ["PasaiaII-coast-buoy", "Donostia-buoy"];
const BOYA_BIZKAIA = ["Bilbao-coast-buoy", "6200024"];

export const CAMARAS = {
  hondarribia: {
    tipo: "hls", url: DIPU("GIP_hondarribia_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [
      // Bahía de Txingudi bajo los barcos fondeados (ROI de la primera versión).
      { id: "principal", ref: "hondarribia", roi: { x0: 0.56, y0: 0.375, x1: 0.98, y1: 0.42 } },
      // Hacia el dique y Hendaia: agua de la bahía exterior, sin el dique (x > 0,55).
      { id: "bocana", ref: "hondarribia-bocana", roi: { x0: 0.0, y0: 0.2, x1: 0.53, y1: 0.37 } },
    ],
  },
  donostia: {
    tipo: "hls", url: DIPU("GIP_zurriola_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [
      // Hacia Ulia: solo un trozo de mar a la derecha (poco fiable, se deja).
      { id: "principal", ref: "donostia", roi: { x0: 0.8, y0: 0.38, x1: 1.0, y1: 0.44 } },
      // De frente al mar: la zona de rompientes, sin la orilla (y > 0,5).
      { id: "playa", ref: "donostia-playa", roi: { x0: 0.0, y0: 0.34, x1: 1.0, y1: 0.5 } },
    ],
  },
  orio: {
    // El 2026-10-08 el stream de Orio daba 404 en la chunklist todo el día:
    // se deja configurada; si sigue caída, simplemente no hay lectura.
    tipo: "hls", url: DIPU("GIP_orio_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [{ id: "principal", ref: "orio", roi: { x0: 0.5, y0: 0.55, x1: 1.0, y1: 0.63 } }],
  },
  zarautz: {
    // Barre la playa sin repetir plano (15 planos en 7 minutos el
    // 2026-10-08): además de sus encuadres de referencia, usa la zona
    // DINÁMICA de espuma.mjs (busca mar entre horizonte y orilla en cada
    // fotograma). Calibración aparte ("zarautz/dinamico").
    tipo: "hls", url: DIPU("GIP_zarautz_169"), boyas: BOYA_GIPUZKOA, dinamico: true,
    encuadres: [
      // ROI recortado respecto a la primera versión (bajaba hasta la orilla).
      { id: "principal", ref: "zarautz", roi: { x0: 0.0, y0: 0.22, x1: 1.0, y1: 0.48 } },
      { id: "ancho", ref: "zarautz-ancho", roi: { x0: 0.0, y0: 0.35, x1: 1.0, y1: 0.48 } },
      { id: "surf", ref: "zarautz-surf", roi: { x0: 0.0, y0: 0.17, x1: 1.0, y1: 0.42 } },
    ],
  },
  getaria: {
    // Malkorbe: bahía abrigada al E. Con mar del NW apenas hay espuma dentro;
    // la de la orilla no se mide (regla de la orilla). Sin etiquetas, no
    // calibra: es lo esperable, no un fallo.
    tipo: "hls", url: DIPU("GIP_getaria_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [{ id: "malkorbe", ref: "getaria-malkorbe", roi: { x0: 0.02, y0: 0.45, x1: 0.45, y1: 0.66 } }],
  },
  zumaia: {
    tipo: "hls", url: DIPU("GIP_zumaia2"), boyas: BOYA_GIPUZKOA,
    encuadres: [
      { id: "a", ref: "zumaia-a", roi: { x0: 0.0, y0: 0.4, x1: 1.0, y1: 0.7 } },
      // Al pie del flysch: sin las lajas (x > 0,75) ni la playa (y > 0,75).
      { id: "c", ref: "zumaia-c", roi: { x0: 0.0, y0: 0.48, x1: 0.75, y1: 0.72 } },
    ],
  },
  deba: {
    tipo: "hls", url: DIPU("GIP_deba_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [
      // ROI recortado: ni la orilla (y > 0,55) ni las rocas de la derecha.
      { id: "principal", ref: "deba", roi: { x0: 0.0, y0: 0.4, x1: 0.65, y1: 0.53 } },
      { id: "rompiente", ref: "deba-rompiente", roi: { x0: 0.0, y0: 0.43, x1: 0.8, y1: 0.57 } },
    ],
  },
  mutriku: {
    tipo: "hls", url: DIPU("GIP_mutrikukaia_169"), boyas: BOYA_GIPUZKOA,
    encuadres: [{ id: "principal", ref: "mutriku", roi: { x0: 0.6, y0: 0.37, x1: 1.0, y1: 0.44 } }],
  },
  mundaka: {
    // KOSTASystem (AZTI / Diputación de Bizkaia): mira a la barra de la ría
    // desde encima de la iglesia; se ve la izquierda de Mundaka rompiendo.
    // ROI: la barra, sin las rocas de la punta (x < 0,3) ni la cabecera.
    tipo: "imagen", url: "https://www.kostasystem.com/wp-content/uploads/irudiak/mundaka/camara1_snap.jpeg", boyas: BOYA_BIZKAIA,
    encuadres: [{ id: "principal", ref: "mundaka", roi: { x0: 0.32, y0: 0.42, x1: 1.0, y1: 0.72 } }],
  },
  bakio: {
    // Isurki (Diputación de Bizkaia). Rompiente exterior arriba a la
    // derecha; la playa queda a la izquierda de x≈0,6 (más con bajamar).
    tipo: "imagen", url: "https://pyscada.isurki.com/static/pyscada/sirena/aditu/BakioNAS/last/bakio.1.snap.last.thumb.jpeg", boyas: BOYA_BIZKAIA,
    encuadres: [{ id: "principal", ref: "bakio", roi: { x0: 0.75, y0: 0.22, x1: 1.0, y1: 0.45 } }],
  },
  sopelana: {
    // Detectia/AZTI (imagen fija cada ~15 min). La app enseña el vídeo de
    // IPCamLive (Atxabiribil), que tiene gotas y el acantilado delante; para
    // medir se usa esta, que ve toda la rompiente.
    tipo: "imagen", url: "https://detectia.net/img/webcam-sopelana-azti3.webp", boyas: BOYA_BIZKAIA,
    encuadres: [{ id: "principal", ref: "sopelana", roi: { x0: 0.12, y0: 0.3, x1: 0.5, y1: 0.44 } }],
  },
  berria: {
    // Playa de Berria (Santoña), IPCamLive "webcamberria". Es la playa
    // expuesta al otro lado del Buciero, no la bahía del spot (ver
    // FUENTE_POR_SPOT en functions/_lib/oleaje-camaras.js).
    // Tiene varias posiciones de zoom (1X, 14X...) que cambian cada ~1 min
    // y su huella apenas las distingue (todas son franjas horizontales de
    // mar, arena y duna): se mide solo con la zona DINÁMICA de espuma.mjs.
    tipo: "ipcamlive", alias: "webcamberria", boyas: BOYA_BIZKAIA, dinamico: true,
    encuadres: [],
  },
  castrourdiales: {
    // Ostende (webcamsencantabria / tendsys, la de reserva de la app: la de
    // cantabria.es daba 503 el 2026-10-08). Agua de la bahía delante de la
    // orilla, sin las rocas de la derecha.
    tipo: "imagen", url: "https://rswc.tendsys.net/memfs/56b44eac-9cc1-4487-98fc-3991c5a4874d.jpg", boyas: BOYA_BIZKAIA,
    encuadres: [{ id: "principal", ref: "castrourdiales", roi: { x0: 0.35, y0: 0.42, x1: 0.78, y1: 0.5 } }],
  },
};

// Las que la app tiene y NO sirven para medir la ola, con el motivo (mirado
// en el fotograma del 2026-10-08). Si cambian de encuadre, se revisan.
export const NO_SIRVEN = {
  lekeitio: "mira al puerto deportivo y a Isuntza desde el pueblo: la rompiente queda lejos, pequeña y detrás de barcos",
  getxo: "Ereaga dentro del Abra: solo rompe en la orilla (shorebreak) y la orilla se mueve ~4 m de marea; no hay zona de agua donde rompa",
  pasaia: "mira la bocana desde dentro: el agua de fuera no es la del spot (interior del puerto) y la espuma es contra las rocas",
  acoruna: "dique de Oza/San Diego: la espuma es la de las olas contra la escollera, no rompiente libre",
  baiona: "ría en calma, sin zona de rompiente a la vista",
  camarinas: "interior de la ría, sin zona de rompiente",
  cangas: "puerto y ría, reflejo del sol",
  cies: "playa de Rodas (lado de dentro de la isla), sin rompiente",
  corrubedo: "el mar es una franja lejana detrás de los pinos",
  ribadeo: "ría del Eo bajo el puente, sin rompiente",
  ons: "puerto de Ons, con calima; sin rompiente",
  portosin: "ría abierta, sin zona de rompiente cerca",
  santona: "la imagen fija de cantabria.es daba 503 (la que sirve es la de Berria, `berria`)",
  laredo: "cantabria.es 503 y la de reserva (tendsys) da una imagen gris sin señal",
  suances: "cantabria.es 503 el 2026-10-08: sin evaluar",
  comillas: "cantabria.es 503 el 2026-10-08: sin evaluar",
  sanvicente: "cantabria.es 503 el 2026-10-08: sin evaluar",
  mediterraneo: "las 27 de la Comunitat Valenciana, Águilas y SOCIB: mar casi siempre plano y la ola rompe en la misma orilla (no hay ROI posible sin tocarla); además las de la Comunitat son miniaturas pequeñas",
};

// Comprobación de coherencia: toda cámara medida existe en CAMARAS_OLEAJE.
for (const id of Object.keys(CAMARAS)) {
  if (!CAMARAS_OLEAJE[id]) throw new Error(`Cámara ${id} sin metadatos en functions/_lib/oleaje-camaras.js`);
}
