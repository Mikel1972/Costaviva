// assets/js/camaras-nz.js
//
// Cámaras de TERCEROS para los 60 spots de Nueva Zelanda (2026-10-11).
// Mismo formato que assets/js/camaras-externas.js (id, spot, nombre, dueno,
// condiciones, modo, url, rompiente, analisis_permitido, visto_en), en un
// módulo aparte. NZ es pública desde la PR #176: camarasNZVisibles(
// REGIONES_ACTIVAS) devuelve la lista entera. PENDIENTE: ni index.html ni el
// robot de salud (scripts/camaras/comprobar-camaras.mjs) la cargan todavía;
// hay que sumarla a la lista de la app y del robot. Módulo ES sin
// dependencias (el navegador no puede cargar functions/): quien llame pasa
// REGIONES_ACTIVAS; sin argumento, nada se ve. test/nz-region.test.js.
//
// Reglas de Mikel (2026-10-11):
//   - Sin permiso escrito del dueño, solo modo "enlace" (botón que abre su
//     web). HOY TODAS SON "enlace", también las de licencia CC BY: pedir
//     permiso o no lo decide Mikel (lista en el informe de la PR).
//   - Nunca analizar fotogramas de terceros: analisis_permitido = false en
//     todas.
//   - Nada de Facebook ni de Instagram. YouTube, solo como enlace.
//
// Cómo se verificó cada una (2026-10-11, ver "verificada" en cada entrada):
// la web del dueño responde, la imagen o el directo es de HOY (Last-Modified,
// sello de hora en la imagen o directo activo en YouTube) y se MIRÓ un
// fotograma de día para confirmar que se ve el mar y el sitio. Mirar para
// verificar no es analizar: el robot nunca descarga su imagen.
//
// Distancia: todas están a ≤ 15 km del punto del spot (km aproximados, por
// la ubicación que da el dueño o, si no la da, por lo que se ve en el
// encuadre).

export const CONDICIONES_NZ = {
  earth_sciences_camera: {
    dueno: "Earth Sciences New Zealand (antes NIWA), red costera Cam-Era",
    tipo_dueno: "publico",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://niwa.co.nz/about-niwa/terms", "https://niwa.co.nz/tairua"],
    cita:
      "«material on our web applications is licensed for re-use under a Creative Commons Attribution 4.0 International " +
      "Licence [...] Unless otherwise indicated [...] the CC Licence does not apply to: Photos, videos or animations.»",
    contacto: "https://niwa.co.nz/contact-us",
  },
  geonet: {
    dueno: "GeoNet (Earth Sciences New Zealand y Natural Hazards Commission Toka Tū Ake)",
    tipo_dueno: "publico",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://www.geonet.org.nz/volcano/cameras", "https://www.geonet.org.nz/data/types/camera"],
    cita:
      "«GeoNet content is copyright Earth Sciences New Zealand and is licensed under a Creative Commons Attribution 3.0 " +
      "New Zealand License». Licencia que permite reutilizar con atribución, pero sin permiso escrito va como enlace.",
    contacto: "info@geonet.org.nz",
  },
  corolive: {
    dueno: "CoroLive (red de webcams de la Coromandel)",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://corolive.nz/embedding"],
    cita:
      "«So you want to embed CoroLive on your own website? [...] reach out and let me know you're going to embed " +
      "CoroLive, this means I can keep track and whitelist your website.» Sin ese aviso y su visto bueno, enlace.",
    contacto: "hi@corolive.nz",
  },
  port_otago: {
    dueno: "Port Otago Limited",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://www.portotago.co.nz/otago-harbour/webcams"],
    cita: "«Copyright © 2026 Port Otago Limited - All rights reserved». No publica condiciones de uso de las webcams.",
    contacto: "customerservices@portotago.co.nz",
  },
  primo: {
    dueno: "PrimoWireless Ltd (Primo, New Plymouth)",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://www.primo.nz/info/primo-webcams"],
    cita:
      "«You are free to share them with your friends and family far and wide, remember to photo credit us» / " +
      "«Our webcam images and videos are solely for informative and entertainment purposes [...] All images and " +
      "streaming on this website are the property of Primo». Sus imágenes rechazan el enlace directo (redirigen a " +
      "/camera-access-info/).",
    contacto: "Primo, 123 Molesworth Street, New Plymouth (formulario en primo.nz)",
  },
  napier_cc: {
    dueno: "Napier City Council",
    tipo_dueno: "publico",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://www.napier.govt.nz/napier/about/weather-cam/", "https://www.napier.govt.nz/our-council/about-this-site/copyright-and-privacy/"],
    cita:
      "«Napier City Council grants you a non-exclusive license to reproduce the contents of this website: in your web " +
      "browser [...] for the sole purpose of viewing the content. Napier City Council reserves all other rights.»",
    contacto: "info@napier.govt.nz",
  },
  southloop: {
    dueno: "SouthLoop (red de cámaras meteorológicas de Southland)",
    tipo_dueno: "privado",
    modos_permitidos: ["enlace"],
    analisis_permitido: false,
    fuentes: ["https://weathercam.southloop.net.nz/camstart.php"],
    cita: "«Southland Weather/Environment cameras Provided by SouthLoop». No publica condiciones de uso: sin permiso, enlace.",
    contacto: "https://weathercam.southloop.net.nz/ (sin email publicado)",
  },
};

const cam = (id, spot, nombre, condiciones, url, rompiente, verificada, extra = {}) => ({
  id: `nz-${id}`,
  spot,
  nombre,
  dueno: CONDICIONES_NZ[condiciones].dueno,
  condiciones,
  modo: "enlace",
  url,
  rompiente,
  analisis_permitido: false,
  visto_en: extra.visto_en || new URL(url).hostname,
  verificada,
  ...(extra.km != null ? { km: extra.km } : {}),
});

// rompiente: true si en el encuadre se ve la zona donde rompe la ola
// (mirado en el fotograma de día de la verificación).
const LISTA = [
  // --- Coromandel ---
  cam("tairua-cam-era", "nz-tairua", "Tairua, playa (Cam-Era)", "earth_sciences_camera", "https://niwa.co.nz/tairua", true,
    "2026-10-11: fotograma de las 18:00 NZDT, playa de Tairua con olas rompiendo", { km: 1.5 }),
  cam("pauanui-norte-cam-era", "nz-tairua", "Pauanui norte: barra y estuario de Tairua (Cam-Era)", "earth_sciences_camera", "https://niwa.co.nz/pauanui-north", true,
    "2026-10-11: fotograma de las 18:00 NZDT, entrada del estuario y Tairua al fondo", { km: 2 }),
  cam("corolive-whitianga", "nz-whitianga", "Whitianga y Mercury Bay (CoroLive)", "corolive", "https://corolive.nz/whitianga", false,
    "2026-10-11: directo HLS activo y archivo del día hasta las 21:08 NZDT; fotograma de mediodía con la bahía", { km: 4 }),
  cam("corolive-whangamata", "nz-whangamata", "Whangamatā, puerto y costa (CoroLive)", "corolive", "https://corolive.nz/whangamata", false,
    "2026-10-11: directo activo y archivo del día hasta las 21:10 NZDT; fotograma de mediodía con el mar y el puerto", { km: 5 }),

  // --- Bay of Plenty ---
  cam("geonet-whakatane", "nz-whakatane", "Whakatāne, mar hacia Whakaari (GeoNet)", "geonet", "https://www.geonet.org.nz/volcano/cameras/whakatane", false,
    "2026-10-11: imagen cada 10 min (Last-Modified de hoy); fotograma de las 19:00 NZDT con el mar abierto", { km: 0.7 }),
  cam("geonet-te-kaha", "nz-te-kaha", "Te Kaha, mar hacia Whakaari (GeoNet)", "geonet", "https://www.geonet.org.nz/volcano/cameras/tekaha", false,
    "2026-10-11: archivo TKAH.01 del día (2026.284) y última imagen de hoy; fotograma de las 13:00 NZDT con el mar", { km: 1.5 }),

  // --- Gisborne / Hawke's Bay ---
  cam("napier-marine-parade", "nz-napier", "Napier, Marine Parade (Napier City Council)", "napier_cc", "https://www.napier.govt.nz/napier/about/weather-cam/", true,
    "2026-10-11: la imagen cambia entre descargas; fotograma de las 17:05 NZDT con la playa y el mar", { km: 2.5 }),

  // --- Taranaki ---
  cam("primo-port-taranaki", "nz-new-plymouth", "Port Taranaki desde la chimenea (Primo)", "primo", "https://www.primo.nz/info/primo-webcams", true,
    "2026-10-11: fotograma de las 19:00 NZDT (ChimneyCam2) con el puerto, el rompeolas y el mar", { km: 1 }),

  // --- Otago ---
  cam("port-otago-aramoana", "nz-aramoana", "Taiaroa Head: Aramoana y el espigón (Port Otago)", "port_otago", "https://www.portotago.co.nz/otago-harbour/webcams", true,
    "2026-10-11: imágenes de las 22:35-22:39 NZDT en su web; fotograma de las 17:05 NZDT con el espigón y la entrada del puerto", { km: 2 }),

  // --- Southland ---
  cam("southloop-riverton", "nz-riverton", "Riverton, desembocadura del Aparima (SouthLoop)", "southloop", "https://weathercam.southloop.net.nz/camstart.php", true,
    "2026-10-11: imagen de las 22:47 NZDT (Last-Modified de hoy) con la desembocadura y el mar", { km: 1.5, visto_en: "weather.geek.nz" }),
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
