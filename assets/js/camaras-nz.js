// assets/js/camaras-nz.js
//
// Cámaras de TERCEROS para los 60 spots de Nueva Zelanda (2026-10-11).
// Mismo formato que assets/js/camaras-externas.js (id, spot, nombre, dueno,
// condiciones, modo, url, rompiente, analisis_permitido, visto_en), más
// `nombre_en` (la ficha en inglés). Conectadas el 2026-10-11 (NZ es pública
// desde la PR #176): camaras-externas.js las suma a CAMARAS_EXTERNAS y a
// CONDICIONES, así que index.html las enseña en la ficha de cada spot NZ y
// el robot de salud (camaras-salud.yml) las comprueba igual que las de
// España (un 401/403/429 en un enlace o un iframe es "no verificable", no
// caída). `dueno` es el nombre corto del dueño que sale en la ficha; el
// largo está en CONDICIONES_NZ. Módulo ES sin dependencias.
//
// Reglas de Mikel (2026-10-11):
//   - Análisis de la OLA (espuma, scripts/oleaje-camaras/): decisión
//     expresa de Mikel (2026-10-11) de medir la ola con TODAS las cámaras de
//     NZ, como en España, aunque los dueños aún no hayan contestado (los
//     emails están en preparación). Interruptor por dueño en
//     NZ_ANALISIS_AUTORIZADO (abajo): `analisis_permitido` de cada dueño y de
//     cada cámara sale de ahí. Solo es la ola: nada de turbidez, Instagram
//     ni miniaturas públicas. El robot de salud sigue sin descargar nada.
//   - Nada de Facebook ni de Instagram. YouTube, solo como enlace.
//   - Nunca saltarse un bloqueo (anti-bots, hotlink, lista blanca).
//
// EMBEBER (decisión de Mikel, 2026-10-11: "Embeberlas", igual que hizo con
// Skyline; PENDIENTE DE RESPUESTA ESCRITA de cada dueño, emails redactados
// en el informe de la PR). La ficha enseña la imagen o el iframe que publica
// el propio dueño, tal cual, con atribución visible ("Image: GeoNet, CC BY
// 3.0 NZ") y enlace a su web. Un interruptor por dueño en
// NZ_EMBED_AUTORIZADO: si un dueño dice que no, se pone su clave a false y
// sus cámaras vuelven solas a "enlace" (CoroLive sale además de frame-src en
// la CSP, functions/_middleware.js). No hay que tocar nada más.
//
// Licencias (comprobadas el 2026-10-11):
//   - GeoNet: «GeoNet content is copyright Earth Sciences New Zealand and is
//     licensed under a Creative Commons Attribution 3.0 New Zealand License»
//     (pie de geonet.org.nz) y su Data Policy (geonet.org.nz/policy): «All
//     data and images are made available free of charge [...] Users are
//     requested to acknowledge». Es la única con licencia que ya lo permite.
//   - Cam-Era (Earth Sciences NZ, antes NIWA): la CC BY 4.0 de niwa.co.nz
//     EXCLUYE las fotos. Sin licencia: embebida solo por la decisión de Mikel.
//   - CoroLive: ofrece el iframe en /embedding y pide avisar para meter el
//     dominio en su lista blanca (hoy el iframe no comprueba el dominio).
//   - Napier City Council: su copyright solo da licencia para verlo en el
//     navegador. SouthLoop: no publica condiciones.
// NO embebibles (siguen en enlace, motivo_sin_embed): Primo lo DENEGÓ por
// escrito el 2026-10-12 (embebido, URLs de imagen y análisis; solo enlace a
// su página de webcams; antes ya bloqueaba el enlace directo a sus imágenes)
// y Port Otago solo publica imágenes con la hora en el nombre (no hay una URL
// estable sin rascar su página).
//
// Cómo se verificó cada una (2026-10-11, ver "verificada" en cada entrada):
// la web del dueño responde, la imagen o el directo es de HOY (Last-Modified,
// sello de hora en la imagen o directo activo) y se MIRÓ un fotograma de día
// para confirmar que se ve el mar y el sitio. Mirar para verificar no es
// analizar: el robot de salud nunca descarga su imagen (solo HEAD); la ola
// la mide aparte scripts/oleaje-camaras/ (NZ_ANALISIS_AUTORIZADO).
//
// Distancia: todas están a ≤ 15 km del punto del spot (km aproximados, por
// la ubicación que da el dueño o, si no la da, por lo que se ve en el
// encuadre).

// Interruptor por dueño del análisis de la ola (2026-10-11, decisión de
// Mikel: true salvo excepción). Si un dueño dice que no, se pone su clave en
// false y su cámara deja de analizarse en la siguiente ejecución del robot
// (scripts/oleaje-camaras/camaras.mjs filtra con esto); no hay que tocar
// nada más. EXCEPCIÓN fijada por Mikel: si los términos publicados del dueño
// PROHÍBEN EXPRESAMENTE el uso automatizado, el scraping o el análisis de sus
// imágenes, se queda en false (el texto, en `prohibicion` de CONDICIONES_NZ).
// Que un dueño esté en true no obliga a analizar: si su cámara no ve la
// rompiente o bloquea a los robots, va en NO_SIRVEN_NZ de camaras.mjs.
export const NZ_ANALISIS_AUTORIZADO = {
  earth_sciences_camera: false, // sus términos prohíben bots y scraping (ver `prohibicion`)
  geonet: true,
  corolive: true,
  port_otago: true,
  // 2026-10-12: Primo (respuesta escrita de su helpdesk a Mikel, ticket
  // #81475) DENIEGA el análisis automático, el embebido y las URLs directas
  // de imagen; el acceso a sus
  // webcams queda restringido a su web. Solo se ENLAZA a su página de webcams
  // (permisos/registro.json de Mikel1972/comun, estado "denegada").
  primo: false,
  napier_cc: true,
  southloop: true,
  // Añadidos en el repaso de día del 2026-10-12, solo como ENLACE: ni se
  // embeben ni se analizan mientras no haya permiso escrito (peticiones en
  // permisos/registro.json de Mikel1972/comun).
  hauraki_coromandel: false,
  raglan_sport_fishing: false,
  castlepoint_lighthouse: false,
  greater_wellington: false,
  nelson_cc: false,
  sails_ashore: false,
  // 2026-10-31, del buscador de cámaras: directo de YouTube, solo enlace
  // (paywall) y nunca analizado (condiciones de YouTube).
  youtube_motella: false,
};

export const NZ_EMBED_AUTORIZADO = {
  earth_sciences_camera: true,
  geonet: true,
  corolive: true,
  napier_cc: true,
  southloop: true,
  // No embebibles por un motivo técnico (motivo_sin_embed): el valor no
  // cambia nada mientras no publiquen una imagen o un iframe utilizable.
  port_otago: true,
  // 2026-10-12: Primo deniega por escrito el embebido y las URLs
  // directas de imagen: solo enlace a su página pública de webcams.
  primo: false,
  // Repaso de día del 2026-10-12: enlace hasta que el dueño conteste por
  // escrito (no hay modo en EMBEBIBLE: aunque se pusieran a true, seguirían
  // en enlace hasta añadirles la imagen o el iframe que publiquen).
  hauraki_coromandel: false,
  raglan_sport_fishing: false,
  castlepoint_lighthouse: false,
  greater_wellington: false,
  nelson_cc: false,
  sails_ashore: false,
  // 2026-10-31, del buscador de cámaras: directo de YouTube, solo enlace
  // (paywall) y nunca analizado (condiciones de YouTube).
  youtube_motella: false,
};

// Cómo se embebe cada dueño, si se puede: "imagen_oficial" (la URL de la
// imagen que publica el dueño) o "iframe_oficial" (su código de inserción).
const EMBEBIBLE = {
  earth_sciences_camera: "imagen_oficial",
  geonet: "imagen_oficial",
  corolive: "iframe_oficial",
  napier_cc: "imagen_oficial",
  southloop: "imagen_oficial",
};

// Modo de embebido de un dueño, o null si va como enlace.
export function embedNZ(condiciones) {
  return NZ_EMBED_AUTORIZADO[condiciones] === true && EMBEBIBLE[condiciones] ? EMBEBIBLE[condiciones] : null;
}

const modos = (clave) => (embedNZ(clave) ? [embedNZ(clave), "enlace"] : ["enlace"]);

// Orígenes de los iframes que la CSP tiene que admitir en frame-src
// (functions/_middleware.js): solo los de dueños con el interruptor puesto.
export const ORIGENES_IFRAME_NZ = embedNZ("corolive") === "iframe_oficial" ? ["https://corolive.nz"] : [];

export const CONDICIONES_NZ = {
  earth_sciences_camera: {
    dueno_corto: "Earth Sciences NZ",
    dueno: "Earth Sciences New Zealand (antes NIWA), red costera Cam-Era",
    tipo_dueno: "publico",
    modos_permitidos: modos("earth_sciences_camera"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.earth_sciences_camera,
    licencia: null,
    fuentes: ["https://niwa.co.nz/about-niwa/terms", "https://niwa.co.nz/tairua"],
    cita:
      "«material on our web applications is licensed for re-use under a Creative Commons Attribution 4.0 International " +
      "Licence [...] Unless otherwise indicated [...] the CC Licence does not apply to: Photos, videos or animations.» " +
      "Sin licencia para las fotos: se embebe por decisión de Mikel (2026-10-11), pendiente de su respuesta escrita.",
    contacto: "https://niwa.co.nz/contact-us (info@geonet.org.nz también es de Earth Sciences NZ)",
    // Comprobado el 2026-10-11 en https://niwa.co.nz/about-niwa/terms: por
    // esto su interruptor de análisis está en false (lo decide Mikel).
    prohibicion:
      "«Use any text or data mining or web scraping tool in relation to our web applications without our express " +
      "written permission, including by using any \u201crobot\u201d, \u201cbot\u201d, \u201cspider\u201d, \u201cscraper\u201d, artificial " +
      "intelligence or machine learning tool, or other automated device or tool to access, monitor, compile or copy any " +
      "part of our web applications or material.»",
  },
  geonet: {
    dueno_corto: "GeoNet",
    dueno: "GeoNet (Earth Sciences New Zealand y Natural Hazards Commission Toka Tū Ake)",
    tipo_dueno: "publico",
    modos_permitidos: modos("geonet"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.geonet,
    licencia: { nombre: "CC BY 3.0 NZ", url: "https://creativecommons.org/licenses/by/3.0/nz/" },
    fuentes: [
      "https://www.geonet.org.nz/policy",
      "https://www.geonet.org.nz/data/types/camera",
      "https://www.geonet.org.nz/volcano/cameras",
    ],
    cita:
      "«GeoNet content is copyright Earth Sciences New Zealand and is licensed under a Creative Commons Attribution 3.0 " +
      "New Zealand License» (pie de todas sus páginas). Data Policy: «All data and images are made available free of " +
      "charge [...] Users are requested to acknowledge the GeoNet programme sponsors as the source of the data or " +
      "images». Su página de cámaras publica la URL de la última imagen: " +
      "«Single image request https://images.geonet.org.nz/volcano/cameras/latest/{camera_id}.jpg».",
    contacto: "info@geonet.org.nz",
  },
  corolive: {
    dueno_corto: "CoroLive",
    dueno: "CoroLive (red de webcams de la Coromandel)",
    tipo_dueno: "privado",
    modos_permitidos: modos("corolive"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.corolive,
    licencia: null,
    fuentes: ["https://corolive.nz/embedding"],
    cita:
      "«So you want to embed CoroLive on your own website? [...] create an HTML iframe with the embed URL [...] " +
      "https://corolive.nz/embed?camera=CAMERA-ID [...] reach out and let me know you're going to embed CoroLive, this " +
      "means I can keep track and whitelist your website.» Embebido por decisión de Mikel (2026-10-11); hay que " +
      "avisarle (hi@corolive.nz). Si activa la lista blanca sin incluirnos, interruptor a false.",
    contacto: "hi@corolive.nz",
  },
  port_otago: {
    dueno_corto: "Port Otago",
    dueno: "Port Otago Limited",
    tipo_dueno: "privado",
    modos_permitidos: modos("port_otago"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.port_otago,
    licencia: null,
    fuentes: ["https://www.portotago.co.nz/otago-harbour/webcams"],
    cita: "«Copyright © 2026 Port Otago Limited - All rights reserved». No publica condiciones de uso de las webcams.",
    motivo_sin_embed:
      "Solo publica imágenes con la fecha y la hora en el nombre (TaiaroaHead1-AAAAMMDD-HHMM-....jpg): no hay una URL " +
      "estable que enseñar sin rascar su página cada vez. Sigue en enlace.",
    contacto: "customerservices@portotago.co.nz",
  },
  primo: {
    dueno_corto: "Primo",
    dueno: "PrimoWireless Ltd (Primo, New Plymouth)",
    tipo_dueno: "privado",
    modos_permitidos: modos("primo"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.primo,
    licencia: null,
    fuentes: ["https://www.primo.nz/info/primo-webcams"],
    cita:
      "«You are free to share them with your friends and family far and wide, remember to photo credit us» / " +
      "«Our webcam images and videos are solely for informative and entertainment purposes [...] All images and " +
      "streaming on this website are the property of Primo».",
    // Respuesta escrita de Primo (helpdesk, ticket #81475) a Mikel, 2026-10-12.
    denegacion:
      "2026-10-12: Primo deniega el embebido, las URLs directas de imagen y el análisis automático; el acceso a sus " +
      "webcams queda restringido a la web de Primo. Permite enlazar a su página de webcams.",
    motivo_sin_embed:
      "Denegado por escrito por Primo (2026-10-12): solo enlace a su página pública de webcams. Además sus imágenes " +
      "rechazan el enlace directo desde otras webs (redirigen a /camera-access-info/).",
    contacto: "Primo, 123 Molesworth Street, New Plymouth (formulario en primo.nz)",
  },
  napier_cc: {
    dueno_corto: "Napier City Council",
    dueno: "Napier City Council",
    tipo_dueno: "publico",
    modos_permitidos: modos("napier_cc"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.napier_cc,
    licencia: null,
    fuentes: ["https://www.napier.govt.nz/napier/about/weather-cam/", "https://www.napier.govt.nz/our-council/about-this-site/copyright-and-privacy/"],
    cita:
      "«Napier City Council grants you a non-exclusive license to reproduce the contents of this website: in your web " +
      "browser [...] for the sole purpose of viewing the content. Napier City Council reserves all other rights.» " +
      "Embebida por decisión de Mikel (2026-10-11), pendiente de su respuesta escrita.",
    contacto: "info@napier.govt.nz",
  },
  southloop: {
    dueno_corto: "SouthLoop",
    dueno: "SouthLoop (red de cámaras meteorológicas de Southland)",
    tipo_dueno: "privado",
    modos_permitidos: modos("southloop"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.southloop,
    licencia: null,
    fuentes: ["https://weathercam.southloop.net.nz/camstart.php"],
    cita:
      "«Southland Weather/Environment cameras Provided by SouthLoop». No publica condiciones de uso. Embebida por " +
      "decisión de Mikel (2026-10-11), pendiente de su respuesta escrita.",
    contacto: "https://weathercam.southloop.net.nz/ (sin email publicado)",
  },
  // --- Repaso de día del 2026-10-12: dueños nuevos, solo ENLACE ---
  hauraki_coromandel: {
    dueno_corto: "Destination Hauraki Coromandel",
    dueno: "Destination Hauraki Coromandel (thecoromandel.nz; la cámara la sirve Select Solutions)",
    tipo_dueno: "publico",
    modos_permitidos: modos("hauraki_coromandel"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.hauraki_coromandel,
    licencia: null,
    fuentes: ["https://thecoromandel.nz/webcams/whangamata-webcam", "https://thecoromandel.nz/industry/about-us/policy"],
    cita:
      "«Copyright © 2026 Destination Hauraki Coromandel, All Rights Reserved» (pie de la página de la webcam). No publica " +
      "condiciones de uso de las webcams ni prohíbe enlazar. Solo enlace hasta su permiso escrito.",
    contacto: "info@haurakicoromandel.com",
  },
  raglan_sport_fishing: {
    dueno_corto: "Raglan Sport Fishing Club",
    dueno: "Raglan Sport Fishing Club (directo en su canal de YouTube)",
    tipo_dueno: "privado",
    modos_permitidos: modos("raglan_sport_fishing"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.raglan_sport_fishing,
    licencia: null,
    fuentes: ["https://www.raglansportfishing.co.nz/live-cams/raglan-bar-cam"],
    cita:
      "«RAGLAN BAR CAM Connection kindly supplied by: [...]» con el directo de YouTube del club insertado. No publica " +
      "condiciones de uso. YouTube solo como enlace: se enlaza la página del club.",
    contacto: "info@raglansportfishing.co.nz",
  },
  castlepoint_lighthouse: {
    dueno_corto: "Castlepoint Lighthouse",
    dueno: "Castlepoint Lighthouse (castlepointlighthouse.com, patrocinado por Harvest Electronics)",
    tipo_dueno: "privado",
    modos_permitidos: modos("castlepoint_lighthouse"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.castlepoint_lighthouse,
    licencia: null,
    fuentes: ["https://castlepointlighthouse.com/"],
    cita:
      "«The live video feed will only run between 7am and 6pm due to low battery on site [...] For comments on this " +
      "website or the live video please email [...]». No publica condiciones de uso. El id de YouTube puede cambiar: se " +
      "enlaza su web.",
    contacto: "castlepointlighthouse@harvest.com",
  },
  greater_wellington: {
    dueno_corto: "Greater Wellington",
    dueno: "Greater Wellington Regional Council (Beacon Hill Signal Station)",
    tipo_dueno: "publico",
    modos_permitidos: modos("greater_wellington"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.greater_wellington,
    licencia: { nombre: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    fuentes: [
      "https://www.gw.govt.nz/environment/harbours-and-coasts/wellington-harbour-entrance-webcams-and-radio/",
      "https://www.gw.govt.nz/your-council/legal/",
    ],
    cita:
      "«Unless indicated otherwise [...] this copyright material is licensed for re-use under a Creative Commons " +
      "Attribution 4.0 International Licence [...] as long as you attribute it to the Greater Wellington Regional " +
      "Council» (gw.govt.nz/your-council/legal, leído el 2026-10-12). Aun así, solo enlace hasta su respuesta escrita.",
    contacto: "harbours@gw.govt.nz",
  },
  nelson_cc: {
    dueno_corto: "Nelson City Council",
    dueno: "Nelson City Council (Harbourmaster)",
    tipo_dueno: "publico",
    modos_permitidos: modos("nelson_cc"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.nelson_cc,
    licencia: null,
    fuentes: ["https://harbours.nelson.govt.nz/cams/"],
    cita:
      "«Harbour Cameras provide safety information to the public and for emergency response and awareness. For all " +
      "enquiries, please contact the Harbourmaster». Las páginas legales de nelson.govt.nz no se pudieron leer desde la " +
      "nube (202 de un reto anti-bots: no se rodea). Solo enlace.",
    contacto: "harbourmaster@ncc.govt.nz",
  },
  sails_ashore: {
    dueno_corto: "Sails Ashore",
    dueno: "Sails Ashore (alojamiento en Stewart Island)",
    tipo_dueno: "privado",
    modos_permitidos: modos("sails_ashore"),
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.sails_ashore,
    licencia: null,
    fuentes: ["https://sailsashore.co.nz/garden-web-cam/"],
    cita: "«Sails Ashore Garden & Webcam». No publica condiciones de uso. Solo enlace.",
    contacto: "tait@sailsashore.co.nz",
  },
  youtube_motella: {
    dueno_corto: "Motella (YouTube)",
    dueno: "Canal de YouTube Motella (Teal Motor Lodge, Gisborne)",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: NZ_ANALISIS_AUTORIZADO.youtube_motella,
    licencia: null,
    fuentes: ["https://www.youtube.com/watch?v=TBWhP73uY6s", "https://developers.google.com/youtube/terms/developer-policies"],
    cita: "Directo público de YouTube. Solo enlace: Costaviva tiene paywall y YouTube no permite cobrar por ver un reproductor insertado.",
    contacto: null,
  },
};

// embed: { imagen } o { iframe } que publica el dueño, y refresco_min (cada
// cuánto la cambia el dueño; null en un directo). Solo se usa si el
// interruptor de su dueño lo permite; si no, la cámara queda en enlace sin
// cargar nada del dueño.
const cam = (id, spot, [nombre, nombre_en], condiciones, url, rompiente, verificada, extra = {}) => {
  const modo = extra.embed && embedNZ(condiciones) ? embedNZ(condiciones) : "enlace";
  const cond = CONDICIONES_NZ[condiciones];
  return {
    id: `nz-${id}`,
    spot,
    nombre,
    nombre_en,
    dueno: cond.dueno_corto,
    condiciones,
    modo,
    url,
    ...(modo === "imagen_oficial" ? { imagen: extra.embed.imagen } : {}),
    ...(modo === "iframe_oficial" ? { iframe: extra.embed.iframe } : {}),
    ...(modo !== "enlace"
      ? { atribucion: { dueno: cond.dueno_corto, licencia: cond.licencia }, refresco_min: extra.embed.refresco_min ?? null }
      : {}),
    rompiente,
    analisis_permitido: cond.analisis_permitido,
    visto_en: extra.visto_en || new URL(url).hostname,
    verificada,
    ...(extra.km != null ? { km: extra.km } : {}),
  };
};

// rompiente: true si en el encuadre se ve la zona donde rompe la ola
// (mirado en el fotograma de día de la verificación).
const LISTA = [
  // --- Coromandel ---
  // Cam-Era: su página enseña la galería del día (TA_W_<fecha>.jpg) y en el
  // mismo almacén público deja latest.jpg, idéntico (mismo Content-MD5) a la
  // última de la galería (comprobado el 2026-10-11).
  cam("tairua-cam-era", "nz-tairua", ["Tairua, playa", "Tairua beach"], "earth_sciences_camera", "https://niwa.co.nz/tairua", true,
    "2026-10-11: fotograma de las 18:00 NZDT, playa de Tairua con olas rompiendo", {
      km: 1.5,
      embed: { imagen: "https://camerastorageoflalbwn.blob.core.windows.net/$web/TairuaWeb/latest.jpg", refresco_min: 30 },
    }),
  cam("pauanui-norte-cam-era", "nz-tairua", ["Pauanui norte: barra de Tairua", "Pauanui North: Tairua bar"], "earth_sciences_camera", "https://niwa.co.nz/pauanui-north", true,
    "2026-10-11: fotograma de las 18:00 NZDT, entrada del estuario y Tairua al fondo", {
      km: 2,
      embed: { imagen: "https://camerastorageoflalbwn.blob.core.windows.net/$web/PauanuiNorth/latest.jpg", refresco_min: 60 },
    }),
  cam("corolive-whitianga", "nz-whitianga", ["Whitianga y Mercury Bay", "Whitianga and Mercury Bay"], "corolive", "https://corolive.nz/whitianga", false,
    "2026-10-11: directo HLS activo y archivo del día hasta las 21:08 NZDT; fotograma de mediodía con la bahía", {
      km: 4,
      embed: { iframe: "https://corolive.nz/embed?camera=whitianga", refresco_min: null },
    }),
  cam("corolive-whangamata", "nz-whangamata", ["Whangamatā, puerto y costa", "Whangamatā harbour and coast"], "corolive", "https://corolive.nz/whangamata", false,
    "2026-10-11: directo activo y archivo del día hasta las 21:10 NZDT; fotograma de mediodía con el mar y el puerto", {
      km: 5,
      embed: { iframe: "https://corolive.nz/embed?camera=whangamata", refresco_min: null },
    }),

  // --- Bay of Plenty ---
  // GeoNet: URL "latest" que documenta su página de datos de cámaras
  // (camera_id whakatane y tekaha en images.geonet.org.nz/volcano/cameras/all.json).
  cam("geonet-whakatane", "nz-whakatane", ["Whakatāne, mar hacia Whakaari", "Whakatāne, sea towards Whakaari"], "geonet", "https://www.geonet.org.nz/volcano/cameras/whakatane", false,
    "2026-10-11: imagen cada 10 min (Last-Modified de hoy); fotograma de las 19:00 NZDT con el mar abierto", {
      km: 0.7,
      embed: { imagen: "https://images.geonet.org.nz/volcano/cameras/latest/whakatane.jpg", refresco_min: 10 },
    }),
  cam("geonet-te-kaha", "nz-te-kaha", ["Te Kaha, mar hacia Whakaari", "Te Kaha, sea towards Whakaari"], "geonet", "https://www.geonet.org.nz/volcano/cameras/tekaha", false,
    "2026-10-11: archivo TKAH.01 del día (2026.284) y última imagen de hoy; fotograma de las 13:00 NZDT con el mar", {
      km: 1.5,
      embed: { imagen: "https://images.geonet.org.nz/volcano/cameras/latest/tekaha.jpg", refresco_min: 10 },
    }),

  // --- Gisborne / Hawke's Bay ---
  // Napier: la imagen "Rotary Pathway, Marine Parade" de su página (la que
  // da al mar; las otras dos son el skatepark y el centro).
  cam("napier-marine-parade", "nz-napier", ["Napier, Marine Parade", "Napier, Marine Parade"], "napier_cc", "https://www.napier.govt.nz/napier/about/weather-cam/", true,
    "2026-10-11: la imagen cambia entre descargas; fotograma de las 17:05 NZDT con la playa y el mar", {
      km: 2.5,
      embed: { imagen: "https://data.napier.govt.nz/webcam/thumbnail.php?ims=800", refresco_min: 1 },
    }),

  // --- Taranaki ---
  // Primo: SOLO enlace a su página de webcams (denegado el resto, 2026-10-12).
  // Nunca se le añade `embed` ni se pide su imagen.
  cam("primo-port-taranaki", "nz-new-plymouth", ["Port Taranaki desde la chimenea", "Port Taranaki from the chimney"], "primo", "https://www.primo.nz/info/primo-webcams", true,
    "2026-10-11: fotograma de las 19:00 NZDT (ChimneyCam2) con el puerto, el rompeolas y el mar", { km: 1 }),

  // --- Otago ---
  cam("port-otago-aramoana", "nz-aramoana", ["Taiaroa Head: Aramoana y el espigón", "Taiaroa Head: Aramoana and the mole"], "port_otago", "https://www.portotago.co.nz/otago-harbour/webcams", true,
    "2026-10-11: imágenes de las 22:35-22:39 NZDT en su web; fotograma de las 17:05 NZDT con el espigón y la entrada del puerto", { km: 2 }),

  // --- Southland ---
  // SouthLoop: "Riverton - Aparima Mouth" de camstart.php (rivertonA0.jpg;
  // la PTZ de al lado, RivertonPTZA0.jpg, salió desenfocada el 2026-10-11).
  // Su página la enlaza por http; el mismo host la sirve por https.
  cam("southloop-riverton", "nz-riverton", ["Riverton, desembocadura del Aparima", "Riverton, Aparima river mouth"], "southloop", "https://weathercam.southloop.net.nz/camstart.php", true,
    "2026-10-11: imagen de las 22:47 NZDT (Last-Modified de hoy) con la desembocadura y el mar; 2026-10-12 05:32 NZDT, desembocadura de día", {
      km: 1.5,
      visto_en: "weather.geek.nz",
      embed: { imagen: "https://weathercam.southloop.net.nz/riverton/rivertonA0.jpg", refresco_min: null },
    }),
  // --- Repaso de día del 2026-10-12 (07:30-07:45 NZDT): solo ENLACE ---
  // Fotograma de día mirado con Read en cada una; ni se embeben ni se
  // analizan sin permiso escrito (NO_SIRVEN_NZ de camaras.mjs).
  cam("hauraki-whangamata-beach", "nz-whangamata", ["Whangamatā, playa", "Whangamatā beach"], "hauraki_coromandel", "https://thecoromandel.nz/webcams/whangamata-webcam", true,
    "2026-10-12: imagen de las 07:41 NZDT (Last-Modified de hoy; el sello de la cámara dice 06:41), playa con olas rompiendo, Whenuakura y Hauturu", { km: 1.5 }),
  cam("raglan-bar", "nz-raglan", ["Raglan, barra", "Raglan bar"], "raglan_sport_fishing", "https://www.raglansportfishing.co.nz/live-cams/raglan-bar-cam", true,
    "2026-10-12: directo de YouTube activo, fotograma de las 07:37 NZDT con niebla: se ven el mar y las olas rompiendo en la barra", { km: 3 }),
  cam("castlepoint-lighthouse", "nz-castlepoint", ["Castlepoint, faro", "Castlepoint lighthouse"], "castlepoint_lighthouse", "https://castlepointlighthouse.com/", false,
    "2026-10-12: directo de YouTube activo (de 7 a 18 h), fotograma de las 07:38 NZDT con el faro, el mar, la laguna y Castle Rock", { km: 0.5 }),
  cam("gw-beacon-hill", "nz-wellington-harbour", ["Beacon Hill: entrada del puerto de Wellington", "Beacon Hill: Wellington Harbour entrance"], "greater_wellington", "https://www.gw.govt.nz/environment/harbours-and-coasts/wellington-harbour-entrance-webcams-and-radio/", true,
    "2026-10-12: las 4 imágenes de las 07:39 NZDT (Last-Modified de hoy): bahía, Breaker Bay con olas rompiendo, la entrada y la costa sur", { km: 1.5 }),
  cam("nelson-harbour", "nz-nelson", ["Puerto de Nelson (norte y sur)", "Nelson Harbour (north and south)"], "nelson_cc", "https://harbours.nelson.govt.nz/cams/", false,
    "2026-10-12: las 2 imágenes de las 07:38 NZDT (Last-Modified de hoy): Boulder Bank, el faro y el puerto en calma", { km: 3 }),
  cam("southloop-ocean-beach", "nz-bluff", ["Ocean Beach (Bluff)", "Ocean Beach (Bluff)"], "southloop", "https://weathercam.southloop.net.nz/camstart.php", false,
    "2026-10-12: imagen de las 07:33 NZDT (Last-Modified de hoy), costa rocosa y mar con Bluff Hill detrás", { km: 3.5 }),
  cam("southloop-oban", "nz-halfmoon-bay", ["Oban, South Seas Hotel", "Oban, South Seas Hotel"], "southloop", "https://weathercam.southloop.net.nz/camstart.php", false,
    "2026-10-12: imagen de las 07:00 NZDT (Last-Modified de hoy), Halfmoon Bay con el muelle y los barcos fondeados", { km: 0.2 }),
  cam("sails-ashore", "nz-halfmoon-bay", ["Halfmoon Bay desde Sails Ashore", "Halfmoon Bay from Sails Ashore"], "sails_ashore", "https://sailsashore.co.nz/garden-web-cam/", false,
    "2026-10-12: imagen de las 07:37 NZDT (Last-Modified de hoy), Halfmoon Bay, el muelle de Oban y el mar abierto", { km: 0.6 }),
  // Del buscador de cámaras (Issue #357, aprobada por Mikel el 2026-10-31).
  cam("motella-gisborne", "nz-gisborne", ["Gisborne, Teal Motor Lodge", "Gisborne, Teal Motor Lodge"], "youtube_motella", "https://www.youtube.com/watch?v=TBWhP73uY6s", false,
    "2026-10-31: directo de YouTube «Gisborne Live Webcam | NZ Weather» encontrado por buscar-camaras.yml", { visto_en: "youtube.com (buscar-camaras)" }),
];

export const CAMARAS_NZ = LISTA;

// Las de NZ que la app puede enseñar: ninguna mientras "nz" no esté activa.
// `activas` es REGIONES_ACTIVAS de functions/_lib/regiones-activas.js.
export function camarasNZVisibles(activas = []) {
  return Array.isArray(activas) && activas.includes("nz") ? CAMARAS_NZ : [];
}

export function camarasNZDeSpot(slug, activas = []) {
  return camarasNZVisibles(activas).filter((c) => c.spot === slug);
}
