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

export const CONDICIONES = {
  skyline: {
    dueno: "SkylineWebcams (VisioRay S.r.l., Italia)",
    tipo_dueno: "privado",
    modos_permitidos: ["imagen_oficial", "enlace"],
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
  modo: "imagen_oficial",
  url: `https://www.skylinewebcams.com/es/webcam/${pagina}.html`,
  imagen: `https://embed.skylinewebcams.com/img/${imagenId}.jpg`,
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

  // --- Mediterráneo ---
  yt("nerja-balcon", "nerja", "Nerja, Balcón de Europa", "meteo365es", "liW4_fLCE5A", false, "webcamera24.com"),
  // Águilas: hasta el 2026-10-08 se pasaban por nuestro proxy
  // (functions/webcam/[slug].js) y se medía su turbidez; las condiciones de
  // SkylineWebcams no lo permiten, así que ahora van con su código oficial.
  // Orden: la bahía primero (mar abierto); la marina está siempre en calma.
  sky("aguilas", "Águilas, Bahía de Levante", "espana/region-de-murcia/murcia/aguilas-bahia-de-levante", 5963, true),
  sky("aguilas", "Águilas Yacht Club", "espana/region-de-murcia/murcia/aguilas-yacht-club", 260, false),
  sky("aguilas", "Puerto deportivo de Águilas", "espana/region-de-murcia/murcia/marina-di-aguilas", 1448, false),
  sky("cabodepalos", "La Manga del Mar Menor", "espana/region-de-murcia/murcia/manga-mar-menor-cartagena", 490, true),
  sky("blanes", "Lloret de Mar", "espana/cataluna/gerona/lloret-de-mar-costa-brava", 631, true),

  // --- Baleares ---
  sky("palma", "Can Pastilla (Playa de Palma)", "espana/islas-baleares/mallorca/can-pastilla-playa-de-palma", 6123, true),
  yt("arenal", "palma", "S'Arenal (Playa de Palma)", "Webcam Arenal", "1qGjkrM0REk", true, "webcamera24.com"),
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

export const CAMARAS_EXTERNAS = LISTA;

export function camarasExternasDeSpot(slug) {
  return CAMARAS_EXTERNAS.filter((c) => c.spot === slug);
}

// Clave en camara_estado (la tabla de salud, una fila por clave): con
// prefijo para no pisar nunca la fila de la cámara propia del spot.
export function claveSalud(camara) {
  return `ext-${camara.id}`;
}
