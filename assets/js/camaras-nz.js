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
// Técnicamente NO embebibles (siguen en enlace, motivo_sin_embed): Primo
// bloquea el enlace directo a sus imágenes (redirige a /camera-access-info/)
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
  primo: true,
  napier_cc: true,
  southloop: true,
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
  primo: true,
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
    motivo_sin_embed:
      "Sus imágenes rechazan el enlace directo desde otras webs (redirigen a /camera-access-info/): es un bloqueo y no " +
      "se rodea. Sigue en enlace.",
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
