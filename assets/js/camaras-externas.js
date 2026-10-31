// assets/js/camaras-externas.js
//
// Cámaras de TERCEROS que Costaviva enseña sin pasar por su proxy
// (functions/webcam/[slug].js) y sin copiar su imagen. Añadidas el
// 2026-10-08 tras revisar agregadores (SkylineWebcams, webcamera24 /
// webcamtaxi, MEO Beachcam, Windy, meteo365, IPCamLive). Pedido de Mikel:
// "revisa páginas aglomeradoras ... Si no están, incorpóralas. Siempre sin
// API".
//
// Regla: los permisos los pone el DUEÑO real del stream, no el agregador
// donde la vimos. Cada cámara dice quién es su dueño y en qué condiciones
// nos apoyamos (CONDICIONES, con la URL y la cita). Solo hay dos modos:
//
//   - "imagen_oficial": el código de inserción que el propio dueño ofrece,
//     tal cual (su imagen, su marca y el enlace a su página). Hoy solo
//     SkylineWebcams: su FAQ permite insertar un fotograma que se
//     actualiza cada 5 min con el botón "Insertar" (el vídeo en directo
//     solo lo pueden insertar los anfitriones de la cámara).
//   - "enlace": botón "Ver cámara" que abre la web del dueño en otra
//     pestaña. Para todo lo que no permite insertarse en una app de pago:
//     YouTube (sus políticas prohíben cobrar por ver un reproductor
//     insertado, y Costaviva está detrás de un paywall) y MEO Beachcam
//     (sus términos no permiten usar el stream fuera de su web sin
//     consentimiento).
//
// analisis_permitido: si se puede descargar fotogramas para medir algo
// (espuma/oleaje, turbidez). HOY ES false EN TODAS: las tres condiciones
// lo prohíben de forma expresa (ver CONDICIONES). Solo las true pueden
// entrar en la medida de espuma (rama claude/ola-camaras); por eso el
// robot de salud (scripts/camaras/comprobar-camaras.mjs) tampoco descarga
// su imagen: solo pregunta si la página/imagen responde.
//
// Para añadir una: mira quién emite de verdad (en el agregador, el iframe o
// el reproductor de la página de la cámara), busca sus condiciones, y si no
// hay permiso expreso para insertar en un servicio de pago, va como
// "enlace". test/camaras-externas.test.js comprueba que cada entrada tiene
// dueño, modo, condiciones con fuente y un spot que existe.

// INTERRUPTOR ÚNICO (2026-10-08). Mikel ha pedido a SkylineWebcams
// autorización escrita para usar su fotograma oficial en una app de pago.
// Decisión de Mikel (2026-10-08): true mientras contestan (su FAQ ofrece el
// código de "Insertar" a cualquier web). CONFIRMADO POR ESCRITO el
// 2026-10-12: SkylineWebcams contesta que no dan autorizaciones aparte para
// insertar sus imágenes fijas porque ese uso ya está permitido en su web, y
// que se use la función oficial de inserción según sus condiciones. El
// análisis automático no lo autorizan (no contestan a esa pregunta). Emails
// completos en comun, permisos/evidencias/it/skylinewebcams/. Si algún día
// lo retiran: false y todas pasan a "enlace" sin cargar nada de
// embed.skylinewebcams.com. Nada más que tocar.
// Nueva Zelanda (2026-10-11): sus cámaras viven en camaras-nz.js (mismo
// formato) y se suman aquí a la lista y a las condiciones, así que la app y
// el robot de salud las tratan igual. Embebidas por decisión de Mikel
// (2026-10-11) con un interruptor por dueño (NZ_EMBED_AUTORIZADO); traen un
// tercer modo, "iframe_oficial" (el iframe que publica el dueño: CoroLive),
// y `atribucion` (dueño y licencia, que la ficha enseña siempre).
import { CAMARAS_NZ, CONDICIONES_NZ } from "./camaras-nz.js";

export const MODOS_EXTERNAS = ["imagen_oficial", "iframe_oficial", "enlace"];

export const SKYLINE_EMBED_AUTORIZADO = true;

export const CONDICIONES = {
  skyline: {
    dueno: "SkylineWebcams (VisioRay S.r.l., Italia)",
    tipo_dueno: "privado",
    modos_permitidos: SKYLINE_EMBED_AUTORIZADO ? ["imagen_oficial", "enlace"] : ["enlace"],
    analisis_permitido: false,
    fuentes: [
      "https://www.skylinewebcams.com/es/support/faq.html",
      "https://www.skylinewebcams.com/es/terms-of-use.html",
    ],
    cita:
      "FAQ: «Sólo los anfitriones de cámaras web pueden incrustar la transmisión de vídeo en directo en su sitio web. " +
      "Sin embargo, pueden incorporar un fotograma que se actualiza cada 5 minutos. Haga clic en \"Incrustar\"». " +
      "Términos: «También está prohibida cualquier reproducción de fotogramas generados por cámaras web, extrapolados " +
      "o capturados a través de fotografías, capturas de pantalla o cualquier otro dispositivo o instrumento».",
    contacto: "info@skylinewebcams.com (autorizaciones de reproducción)",
  },
  youtube: {
    dueno: "Canal de YouTube indicado en cada cámara",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: [
      "https://developers.google.com/youtube/terms/developer-policies",
      "https://www.youtube.com/t/terms",
    ],
    cita:
      "Políticas para desarrolladores: «API Clients must not charge users to watch content in an embedded YouTube player». " +
      "Términos: no se permite «access the Service using any automated means (such as robots, botnets or scrapers)» " +
      "ni descargar contenido salvo autorización expresa.",
  },
  meo_beachcam: {
    dueno: "MEO Beachcam (Altice Portugal)",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://beachcam.meo.pt/termos-e-condicoes/"],
    cita:
      "«Entende-se por conteúdo do site toda a informação disponível para o utilizador, nomeadamente o Stream das Livecams " +
      "[...] não podendo ser utilizado fora das condições admitidas no uso deste site, sem consentimento do Beachcam».",
  },
};

const sky = (spot, nombre, pagina, imagenId, rompiente) => ({
  id: `sky-${imagenId}`,
  spot,
  nombre,
  dueno: "SkylineWebcams",
  condiciones: "skyline",
  modo: SKYLINE_EMBED_AUTORIZADO ? "imagen_oficial" : "enlace",
  url: `https://www.skylinewebcams.com/es/webcam/${pagina}.html`,
  ...(SKYLINE_EMBED_AUTORIZADO ? { imagen: `https://embed.skylinewebcams.com/img/${imagenId}.jpg` } : {}),
  skyline_id: imagenId,
  rompiente,
  analisis_permitido: false,
  visto_en: "skylinewebcams.com",
});

const yt = (id, spot, nombre, canal, videoId, rompiente, vistoEn) => ({
  id: `yt-${id}`,
  spot,
  nombre,
  dueno: `${canal} (YouTube)`,
  condiciones: "youtube",
  modo: "enlace",
  url: `https://www.youtube.com/watch?v=${videoId}`,
  youtube_id: videoId,
  rompiente,
  analisis_permitido: false,
  visto_en: vistoEn,
});

const meo = (spot, nombre, slugMeo, rompiente) => ({
  id: `meo-${slugMeo}`,
  spot,
  nombre,
  dueno: "MEO Beachcam",
  condiciones: "meo_beachcam",
  modo: "enlace",
  url: `https://beachcam.meo.pt/livecams/${slugMeo}/`,
  rompiente,
  analisis_permitido: false,
  visto_en: "beachcam.meo.pt",
});

// rompiente: true si en el encuadre se ve la zona donde rompe la ola
// (comprobado mirando el fotograma oficial en las de Skyline; en las de
// enlace, por la descripción del dueño, porque no se descarga su imagen).
const LISTA = [
  // --- Cantábrico ---
  sky("santander", "Playa del Sardinero", "espana/cantabria/santander/playa-del-sardinero", 728, true),
  yt("santander-bahia", "santander", "Bahía de Santander", "Tend Networks", "YozT82BqQqg", false, "webcamera24.com"),
  yt("loredo-somo", "santander", "Loredo y Somo (SurfCam.io)", "Tend Networks", "bV_ltoX7Jy8", true, "webcamera24.com / skylinewebcams.com"),
  // Suances ya tiene cámara (cantabria.es), pero lleva días caída: estas
  // dos quedan como alternativa visible.
  sky("suances", "Playa de La Concha", "espana/cantabria/suances/playa-de-la-concha", 804, true),
  sky("suances", "Playa de Los Locos", "espana/cantabria/suances/playa-de-los-locos", 757, true),

  // --- Golfo de Cádiz ---
  sky("cadiz", "Santa María del Mar", "espana/andalucia/cadiz/cadiz-santa-maria-del-mar", 1329, true),
  sky("cadiz", "Playa Santa María del Mar", "espana/andalucia/cadiz/playa-santa-maria-del-mar", 1372, true),
  sky("cadiz", "Playa Victoria", "espana/andalucia/cadiz/playa-victoria", 1735, true),
  yt("cortadura", "cadiz", "Playa de Cortadura", "Playa Victoria", "kkIA93YOQ6w", true, "webcamera24.com"),
  // Del buscador de cámaras (Issue #359, aprobadas por Mikel el 2026-10-31).
  yt("conil-fontanilla", "conil", "Conil, playa de la Fontanilla", "La costa de Cádiz", "KmBrwm5T-Dc", true, "youtube.com (buscar-camaras)"),

  // --- Mediterráneo ---
  yt("nerja-balcon", "nerja", "Nerja, Balcón de Europa", "meteo365es", "liW4_fLCE5A", false, "webcamera24.com"),
  // Del buscador de cámaras (Issue #359, aprobadas por Mikel el 2026-10-31).
  yt("malaga-puerto", "malaga", "Puerto de Málaga, Muelle de Levante y faro", "meteo365es", "sxgx5ZqAAxo", false, "youtube.com (buscar-camaras)"),
  yt("rincon-victoria", "malaga", "Rincón de la Victoria, playa", "Malaga Live Cam", "Ib0xbFBU9Wg", true, "youtube.com (buscar-camaras)"),
  // Águilas: hasta el 2026-10-08 se pasaban por nuestro proxy
  // (functions/webcam/[slug].js) y se medía su turbidez; las condiciones de
  // SkylineWebcams no lo permiten (ver SKYLINE_EMBED_AUTORIZADO).
  // Orden: la bahía primero (mar abierto); la marina está siempre en calma.
  sky("aguilas", "Águilas, Bahía de Levante", "espana/region-de-murcia/murcia/aguilas-bahia-de-levante", 5963, true),
  sky("aguilas", "Águilas Yacht Club", "espana/region-de-murcia/murcia/aguilas-yacht-club", 260, false),
  sky("aguilas", "Puerto deportivo de Águilas", "espana/region-de-murcia/murcia/marina-di-aguilas", 1448, false),
  sky("cabodepalos", "La Manga del Mar Menor", "espana/region-de-murcia/murcia/manga-mar-menor-cartagena", 490, true),
  sky("blanes", "Lloret de Mar", "espana/cataluna/gerona/lloret-de-mar-costa-brava", 631, true),

  // --- Baleares ---
  sky("palma", "Can Pastilla (Playa de Palma)", "espana/islas-baleares/mallorca/can-pastilla-playa-de-palma", 6123, true),
  yt("arenal", "palma", "S'Arenal (Playa de Palma)", "Webcam Arenal", "1qGjkrM0REk", true, "webcamera24.com"),
  // Muro: su cámara propia (SOCIB) salió el 2026-10-11 por llevar parada
  // desde 2024. Esta emite en directo desde el Resort Playa Esperanza
  // (YouTube "isLive", 8 espectadores, 2026-10-11 09:53 UTC); la miniatura
  // del canal enseña la playa con la bahía de Alcúdia. Solo enlace.
  yt("playa-de-muro", "muro", "Playa de Muro (Resort Playa Esperanza)", "WEBCAMS ONLINE", "mxfelXmWtCA", true, "youtube.com"),
  sky("formentera", "Playa de Es Pujols", "espana/islas-baleares/formentera/playa-es-pujols", 4727, true),

  // --- Canarias ---
  sky("laspalmas", "Playa Grande de Las Canteras", "espana/canarias/las-palmas-gran-canaria/playa-grande-las-canteras", 680, true),
  sky("laspalmas", "Las Canteras desde Peña la Vieja", "espana/canarias/las-palmas-gran-canaria/playa-las-canteras", 624, true),
  sky("laspalmas", "La Cícer (Las Canteras)", "espana/canarias/las-palmas-gran-canaria/la-cicer-las-canteras", 627, true),
  sky("santacruztenerife", "Playa de Las Teresitas", "espana/canarias/santa-cruz-de-tenerife/playa-de-las-teresitas", 1105, true),
  yt("teresitas", "santacruztenerife", "Las Teresitas", "SIEMPRIA InfiniteTechSolutions", "BuH1_8tFc0g", true, "webcamera24.com"),
  sky("elmedano", "El Médano (surf y kite)", "espana/canarias/santa-cruz-de-tenerife/surf-kitesurf-medano", 427, true),
  sky("elmedano", "Playa de El Médano", "espana/canarias/santa-cruz-de-tenerife/playa-el-medano", 6103, true),
  sky("elmedano", "El Médano, paseo marítimo", "espana/canarias/santa-cruz-de-tenerife/playa-de-el-medano", 376, true),
  sky("corralejo", "Grandes Playas de Corralejo", "espana/canarias/corralejo/grandes-playas-corralejo", 6086, true),
  sky("corralejo", "Corralejo Viejo", "espana/canarias/corralejo/fuerteventura-corralejo", 1091, true),

  // --- Portugal (ningún spot portugués tenía cámara) ---
  meo("moledo", "Vila Praia de Âncora", "vila-praia-de-ancora", true),
  meo("vianadocastelo", "Viana do Castelo, Cabedelo", "viana-do-castelo-cabedelo", true),
  meo("povoadevarzim", "Caxinas (Vila do Conde)", "caxinas-macaco-17", true),
  meo("matosinhos", "Praia de Matosinhos", "praia-de-matosinhos", true),
  meo("matosinhos", "Leça da Palmeira", "leca-da-palmeira", true),
  meo("aveiro", "Praia da Barra", "praia-da-barra", true),
  meo("aveiro", "Costa Nova", "costa-nova", true),
  meo("figueiradafoz", "Figueira da Foz, Cabedelo", "figueira-da-foz-cabedelo", true),
  meo("figueiradafoz", "Figueira da Foz, Tamargueira", "figueira-da-foz-tamargueira", true),
  meo("nazare", "Praia da Nazaré", "praia-da-nazare", true),
  meo("nazare", "Praia do Norte (canhão da Nazaré)", "praia-do-norte-canhao-nazare", true),
  meo("nazare", "Porto de abrigo da Nazaré", "nazare-porto-de-abrigo", false),
  meo("peniche", "Supertubos", "peniche-supertubos", true),
  meo("peniche", "Molhe Leste", "peniche-molhe-leste", true),
  meo("peniche", "Baleal, panorâmica", "peniche-baleal-panoramica", true),
  meo("ericeira", "Ericeira", "ericeira", true),
  meo("ericeira", "Ericeira, Praia do Sul", "ericeira-praia-do-sul", true),
  meo("ericeira", "Ribeira d'Ilhas", "ribeira-dilhas", true),
  meo("cascais", "Praia do Peixe (baía de Cascais)", "praia-do-peixe-baia-de-cascais", false),
  meo("cascais", "Praia do Guincho", "praia-do-guincho", true),
  meo("costadacaparica", "Costa da Caparica", "costa-da-caparica", true),
  meo("costadacaparica", "Fonte da Telha", "fonte-da-telha", true),
  yt("caparica-panoramica", "costadacaparica", "Costa da Caparica, panorámica", "Playocean", "_LUOa8uffGE", true, "webcamera24.com / skylinewebcams.com"),
  meo("troia", "Tróia", "troia", true),
  meo("sines", "Praia de São Torpes", "praia-de-sao-torpes", true),
  meo("milfontes", "Vila Nova de Milfontes, Farol", "vila-nova-de-milfontes-farol", true),
  meo("milfontes", "Vila Nova de Milfontes, Franquia", "vila-nova-de-milfontes-franquia", false),
  meo("sagres", "Sagres", "sagres", true),
  sky("lagos", "Lagos (Campimar)", "portugal/algarve/lagos/lagos-portugal", 996, true),
  meo("lagos", "Meia Praia", "meia-praia", true),
  meo("faro", "Praia de Faro", "faro", true),
  meo("faro", "Ilha do Farol (Culatra)", "ilha-do-farol-culatra", true),
];

Object.assign(CONDICIONES, CONDICIONES_NZ);

export const CAMARAS_EXTERNAS = [...LISTA, ...CAMARAS_NZ];

export function camarasExternasDeSpot(slug) {
  return CAMARAS_EXTERNAS.filter((c) => c.spot === slug);
}

// Clave en camara_estado (la tabla de salud, una fila por clave): con
// prefijo para no pisar nunca la fila de la cámara propia del spot.
// Nombre de la cámara en el idioma de la ficha (las de NZ traen nombre_en).
export function nombreCamara(camara, idioma = "es") {
  // En portugués, nombre_pt si lo hay y, si no, el inglés (las de NZ).
  if (idioma === "pt" && camara.nombre_pt) return camara.nombre_pt;
  return (idioma === "en" || idioma === "pt") && camara.nombre_en ? camara.nombre_en : camara.nombre;
}

export function claveSalud(camara) {
  return `ext-${camara.id}`;
}

// --- Salud de las externas: "caída" frente a "no verificable" (2026-10-08) ---
//
// Caso real (camara_estado, 2026-10-08 21:04 UTC): las 30 cámaras de MEO
// Beachcam salían sin_senal=true con motivo http_403 y las otras 30
// (Skyline, YouTube) bien. MEO responde 403 a las peticiones que salen de
// centros de datos (los runners de GitHub de camaras-salud.yml) por su
// protección anti-bots, aunque la cámara funcione: desde un navegador
// normal la página abre. Era un falso "caída", y a las 24 h la app habría
// escondido todos los enlaces de Portugal.
//
// Regla: en una cámara de modo "enlace" (solo abrimos la web del dueño en
// otra pestaña), un 401/403/429 significa "el dueño no deja comprobarla de
// forma automática", no "está caída". Se guarda como no_verificable_<código>
// con sin_senal=false y sin sumar fallos: ni la app la esconde ni el robot
// de cámaras caídas la toma por rota. No se intenta saltar su protección
// (sería ir contra sus términos). En "imagen_oficial" sí cuenta como fallo:
// ahí la imagen la carga la app y, si el dueño la bloquea, no se vería.
export const CODIGOS_ANTIBOT = [401, 403, 429];

export function esNoVerificable(motivo) {
  return typeof motivo === "string" && motivo.startsWith("no_verificable");
}

// Resultado de una comprobación HTTP de una cámara externa (status y
// content-type de la respuesta; status 0 = sin respuesta).
// GeoNet y Cam-Era (NZ, 2026-10-11) sirven sus JPG como
// application/octet-stream; el navegador las pinta igual (lo hace su propia
// web). Una página de error sigue saliendo como no_es_imagen (text/html).
// En "iframe_oficial" la página la carga el navegador dentro del iframe, así
// que un bloqueo a los robots es "no verificable", como en un enlace.
const TIPOS_IMAGEN = ["image/", "application/octet-stream"];

export function resultadoComprobacionExterna(camara, status, contentType = "") {
  if (!status) return { ok: false, motivo: "sin_respuesta" };
  if (status >= 200 && status < 300) {
    if (camara.modo === "imagen_oficial" && !TIPOS_IMAGEN.some((t) => String(contentType).toLowerCase().startsWith(t))) return { ok: false, motivo: "no_es_imagen" };
    return { ok: true };
  }
  if ((camara.modo === "enlace" || camara.modo === "iframe_oficial") && CODIGOS_ANTIBOT.includes(status)) return { ok: null, noVerificable: true, motivo: `no_verificable_${status}` };
  return { ok: false, motivo: `http_${status}` };
}

// Lectura para /registrar-estado-camaras a partir del resultado de esta
// pasada y del estado previo de la misma clave.
export function lecturaSaludExterna(clave, bruto, previo, ahora, umbral = 2) {
  const base = { spot: clave, hashFrame: null, hashDesde: null, fuenteUsada: 0 };
  if (bruto.noVerificable) {
    // Ni sana ni caída: no se toca ultimaSenalEn (no la hemos visto) y no
    // suma fallos (no hay ninguno comprobado).
    return { ...base, sinSenal: false, motivo: bruto.motivo, ultimaSenalEn: previo?.ultimaSenalEn ?? null, fallosSeguidos: 0 };
  }
  const fallosSeguidos = bruto.ok ? 0 : (previo?.fallosSeguidos ?? 0) + 1;
  return {
    ...base,
    sinSenal: fallosSeguidos >= umbral,
    motivo: bruto.ok ? "ok" : bruto.motivo,
    ultimaSenalEn: bruto.ok ? ahora : (previo?.ultimaSenalEn ?? null),
    fallosSeguidos,
  };
}

// La app solo puede esconder una externa por estar caída si el fallo es
// real. Cubre también las filas viejas (sin_senal=true, http_403) que
// quedaron escritas antes de este cambio, hasta que la siguiente pasada
// del robot de salud las reescriba.
export function externaCuentaComoCaida(camara, estado) {
  if (!estado?.sinSenal) return false;
  if (esNoVerificable(estado.motivo)) return false;
  if ((camara.modo === "enlace" || camara.modo === "iframe_oficial") && CODIGOS_ANTIBOT.some((c) => estado.motivo === `http_${c}`)) return false;
  return true;
}

// --- Cámara embebida en la ficha, con atribución visible (2026-10-11) ---
//
// HTML de una cámara de terceros en modo "imagen_oficial" o
// "iframe_oficial" que lleva `atribucion` (las de NZ). Puro y sin DOM para
// poder probarlo: index.html lo mete con innerHTML. Sin on*= (la CSP con
// nonce los bloquearía). Siempre: el nombre, «Image: <dueño enlazado a su
// web>[, <licencia enlazada>]» y cada cuánto la cambia el dueño. `t` es
// I18n.t (claves mapa.cam.imagen_atrib, video_atrib, cada_min, en_directo_su_web).
const escaparHtml = (x) =>
  String(x).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

export function textoAtribucion(camara, t) {
  const a = camara.atribucion;
  if (!a) return "";
  const etiqueta = camara.modo === "iframe_oficial" ? t("mapa.cam.video_atrib") : t("mapa.cam.imagen_atrib");
  return `${etiqueta}: ${a.dueno}${a.licencia ? `, ${a.licencia.nombre}` : ""}`;
}

export function htmlCamaraIncrustada(camara, idioma, t) {
  const e = escaparHtml;
  const nombre = nombreCamara(camara, idioma);
  const a = camara.atribucion;
  const enlace = (url, texto) => `<a href="${e(url)}" target="_blank" rel="noopener">${e(texto)}</a>`;
  const etiqueta = camara.modo === "iframe_oficial" ? t("mapa.cam.video_atrib") : t("mapa.cam.imagen_atrib");
  const atrib =
    `<span class="atribucion-camara">${e(etiqueta)}: ${enlace(camara.url, a.dueno)}` +
    `${a.licencia ? `, ${enlace(a.licencia.url, a.licencia.nombre)}` : ""}</span>`;
  const ritmo = camara.modo === "iframe_oficial"
    ? t("mapa.cam.en_directo_su_web")
    : camara.refresco_min ? t("mapa.cam.cada_min", { min: camara.refresco_min }) : "";
  const alt = `${nombre} | ${textoAtribucion(camara, t)}`;
  const medio = camara.modo === "iframe_oficial"
    ? `<iframe src="${e(camara.iframe)}" title="${e(alt)}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen ` +
      `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin" ` +
      `style="width:100%; aspect-ratio:16/9; border:1px solid var(--linea); border-radius:8px; display:block; background:#000;"></iframe>`
    : `<a href="${e(camara.url)}" target="_blank" rel="noopener"><img src="${e(camara.imagen)}" alt="${e(alt)}" loading="lazy" ` +
      `referrerpolicy="strict-origin" style="width:100%; border-radius:8px; border:1px solid var(--linea); display:block;"></a>`;
  return `
    <figure class="camara-incrustada" data-camara="${e(camara.id)}" style="margin:8px 0 0;">
      ${medio}
      <figcaption style="font-size:11px; color:var(--tinta-2); margin-top:3px;">${e(nombre)} · ${atrib}${ritmo ? ` ${e(ritmo)}` : ""}</figcaption>
    </figure>`;
}

// --- Color de cámara de cada spot en el mapa (2026-10-11) ---
//
// Pedido de Mikel: "En la de España, revisa que el status sea correcto.
// Verde = cámara. Rojo = no cámara." Hasta hoy el punto solo salía en los
// spots con cámara PROPIA (SPOTS_CON_WEBCAM de index.html): los que solo
// tienen una de terceros que funciona (Santander, Cádiz, Águilas, Muro...)
// no llevaban punto, y los de cámara oculta o sin cámara tampoco. Ahora el
// punto sale en todos los spots de España y Portugal y dice lo mismo que
// verá el usuario al abrir la ficha:
//
//   - "verde": funciona AHORA al menos una cámara: la propia (con su
//     reserva, el proxy ya cambia solo de fuente) o una de terceros cuyo
//     robot de salud la ha visto bien en su última pasada (motivo "ok").
//   - "rojo": ninguna funciona: la propia sin señal (también congelada u
//     oculta por llevar más de 24 h así), las de terceros caídas, las
//     retiradas del código y los spots que no tienen ninguna.
//   - Las de terceros "no verificables" (su dueño bloquea a los robots: MEO
//     Beachcam, CoroLive en NZ, motivo no_verificable_*) cuentan como
//     funcionando, igual que una vista bien (decisión de Mikel, 2026-10-11).
//     Una vez al mes la rutina de cámaras caídas las mira a mano (ver
//     ROBOT_REGLAS.md) y, si ve que una está caída de verdad, la marca con
//     `caida_comprobada` (más abajo) o la quita de la lista.
export const HORAS_CAMARA_OCULTA = 24;

// Desde cuándo no llega una imagen NUEVA: la última lectura buena
// (ultimaSenalEn) o, si es anterior, desde cuándo el fotograma es el mismo
// (congeladaDesde = hash_desde). Antes solo se miraba congeladaDesde con
// motivo "frame_congelado", y una congelada que además fallaba a ratos
// (cantabria.es, 522 intermitente) perdía ese motivo en cada fallo y su
// cuenta de 24 h volvía a empezar.
export function inicioSinSenal(estado) {
  const fechas = [estado?.ultimaSenalEn, estado?.congeladaDesde]
    .map((f) => (f ? Date.parse(f) : NaN))
    .filter(Number.isFinite);
  if (!fechas.length) return null;
  return new Date(Math.min(...fechas)).toISOString();
}

// Más de 24 h sin señal: fuera de la vista (ver CLAUDE.md, "Cámaras caídas").
export function camaraOculta(estado, ahoraMs = Date.now()) {
  if (!estado?.sinSenal) return false;
  const desde = inicioSinSenal(estado);
  if (!desde) return true;
  return ahoraMs - Date.parse(desde) > HORAS_CAMARA_OCULTA * 3600 * 1000;
}

// Caída comprobada A MANO (2026-10-11). Para las que el robot de salud no
// puede comprobar (no_verificable_*): si la revisión mensual de la rutina
// ve en la web del dueño que no emite, añade a su entrada de LISTA
//   caida_comprobada: { fecha: "AAAA-MM-DD", nota: "qué se vio y dónde" }
// y la app la trata como caída: fuera de la ficha y no cuenta para el color.
// Cuando vuelva a emitir, se borra el campo. Si no va a volver, se quita la
// entrada entera (retirada).
export function externaMarcadaCaida(camara) {
  return !!camara?.caida_comprobada;
}

// Una de terceros cuenta como "funciona" si el robot la vio bien o si su
// dueño no deja comprobarla (no_verificable_*), salvo que esté marcada a
// mano como caída.
export function externaFunciona(estado, camara = null) {
  if (externaMarcadaCaida(camara)) return false;
  if (!estado || estado.sinSenal) return false;
  return estado.motivo === "ok" || esNoVerificable(estado.motivo);
}

// Un enlace a la cámara de otro (modo "enlace") pone el punto verde aunque el
// robot de salud no la haya podido ver aún (Mikel, 2026-10-12: "si un spot
// tiene link a cámaras, también es punto verde"). Solo no cuenta si el robot
// la ha visto caída de verdad (sinSenal) o está marcada a mano como caída.
export function enlaceCuentaVerde(camara, estado) {
  return camara?.modo === "enlace" && !externaMarcadaCaida(camara) && !estado?.sinSenal;
}

// slug: spot; tienePropia: si está en SPOTS_CON_WEBCAM; camaras: el objeto
// `camaras` de /prevision (clave = slug o ext-<id>).
export function estadoCamaraSpot(slug, tienePropia, camaras = {}) {
  if (tienePropia && !camaras[slug]?.sinSenal) return "verde";
  if (camarasExternasDeSpot(slug).some((c) => externaFunciona(camaras[claveSalud(c)], c) || enlaceCuentaVerde(c, camaras[claveSalud(c)]))) return "verde";
  return "rojo";
}
