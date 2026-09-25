// functions/webcam/[slug].js
// Proxy de imágenes de webcam: descarga en el servidor (edge de Cloudflare)
// y la sirve desde nuestro propio dominio. Esto es lo que resuelve de raíz
// el problema de CORS/hotlinking que sufrimos al intentar cargar estas
// imágenes directamente desde el navegador en el prototipo anterior.
// Alcanzable en /webcam/<slug>, ej. /webcam/bakio

// Exportado (además de usarse aquí mismo) para que scripts/camaras/
// comprobar-camaras.mjs pueda comprobar exactamente la misma lista de
// cámaras de imagen fija que sirve este proxy, sin mantener una tercera
// copia a mano (a diferencia de SPOTS_IMAGEN en scripts/turbidez/
// medir-turbidez.mjs, que sí es una copia manual más antigua y ya
// incompleta frente a esta lista real).
//
// Varias fuentes por spot + failover (añadido 2026-09-19, pedido explícito
// del usuario): un valor puede ser un string (una sola fuente, como hasta
// ahora) o un array de strings (varias, en orden de preferencia). El proxy
// prueba cada una en orden y sirve la primera que responda bien -- si la
// principal está caída (ver la regla "Fallos correlados por proveedor" en
// ROBOT_REGLAS.md), el usuario sigue viendo imagen real de la cámara de
// reserva sin notar nada. Añade la cabecera X-Webcam-Fuente-Indice para que
// scripts/camaras/comprobar-camaras.mjs pueda saber si tuvo que recurrir a
// una reserva (0 = la principal, >0 = cuál de las siguientes) y reportarlo
// en el informe diario -- el failover en sí es transparente para quien ve
// la app, pero no debe serlo para quien vigila la salud de las cámaras.
//
// Orden de preferencia entre varias fuentes de un mismo spot (criterio
// explícito del usuario, 2026-09-19): 1) vídeo antes que imagen fija
// (WEBCAMS_HLS en index.html, no este WEBCAMS -- son dos listas
// separadas), 2) entre imágenes fijas, la de mejor resolución/nitidez
// real de píxeles, 3) entre las que empatan de día, la que sea infrarroja
// y siga enseñando algo útil de noche. Este array (WEBCAMS) solo ordena
// fuentes de IMAGEN FIJA entre sí -- si para un spot aparece una fuente de
// vídeo nueva y hoy solo tiene imagen fija aquí, la decisión de pasarlo a
// WEBCAMS_HLS (y así ganarle prioridad a la imagen fija) es aparte, no la
// resuelve el orden de este array.
export const WEBCAMS = {
  mundaka: "https://www.kostasystem.com/wp-content/uploads/irudiak/mundaka/camara1_snap.jpeg",
  // Reserva de ÚLTIMO RECURSO añadida 2026-09-19 (pedido explícito del
  // usuario, con la limitación ya avisada y aceptada): webviewcams.com es
  // un directorio de cámaras IP controlables por cualquier visitante
  // (pan/tilt/zoom), no una fuente oficial -- comprobado en vivo que
  // apuntaba bien al mar (playa de Bakio, con "La Vela" reconocible), pero
  // NADA garantiza que siga así la próxima vez que alguien la mueva.
  // Workers no puede decodificar/analizar la imagen para verificarlo en
  // cada petición (sin API de imagen), así que no hay comprobación de
  // píxeles en tiempo real -- se usa tal cual SOLO cuando la fuente
  // principal (isurki.com) también falla, bajo el criterio de "algo (casi
  // siempre correcto) es mejor que nada". Es un stream MJPEG, no una
  // imagen suelta (`mjpeg: true`, ver extraerFramePrimeroDeMjpeg).
  bakio: [
    "https://pyscada.isurki.com/static/pyscada/sirena/aditu/BakioNAS/last/bakio.1.snap.last.thumb.jpeg",
    { url: "https://www.webviewcams.com/stream-image?ip=82.130.141.93&size=640", mjpeg: true },
  ],
  // Dos fuentes reales e independientes, verificadas en vivo 2026-09-19
  // (ver ROBOT_REGLAS.md, "Aprendizaje por zonas" > Bizkaia): la principal
  // es AZTI/detectia.net; la de reserva es la cámara propia del
  // ayuntamiento de Sopela (sopela.eus/webcam-olas/, vía IPCamLive) --
  // proveedor totalmente distinto, así que una caída de detectia.net (que
  // se lleva consigo a bakio/pasaia/getaria a la vez, ver la regla de
  // fallos correlados) no afecta a esta reserva.
  sopelana: [
    "https://detectia.net/img/webcam-sopelana-azti3.webp",
    // Snapshot del mismo alias nuevo (ver index.html). El anterior
    // (s61/3d0d8zpvutondjmwg) daba 404 igual que el vídeo.
    "https://s153.ipcamlive.com/streams/99eod1rsuvg7yjnvk/snapshot.jpg",
  ],
  // AZTI (detectia.net), mismo proveedor que Sopelana. Verificado por el
  // robot buscador de fuentes el 2026-09-13 (imagen WebP real descargada
  // y comprobada, no un placeholder).
  lekeitio: "https://detectia.net/img/webcam-lekeitio.webp",
  getxo: "https://detectia.net/img/webcam-ereaga.webp",
  // Pasaia, encontrada 2026-09-17 (mismo proveedor AZTI/detectia.net,
  // slug distinto del resto: "-azti" en vez de sin sufijo). Verificada con
  // descarga real: WebP 2464x2056, ~140 KB, no un placeholder.
  pasaia: "https://detectia.net/img/webcam-pasaia-azti.webp",
  // Getaria (playa de Malkorbe), encontrada 2026-09-18. Mismo proveedor
  // AZTI/detectia.net, slug "malkorbe-azti" (nombre de playa, no del
  // pueblo). Verificada con descarga real: WebP 1600x1200, ~54 KB, imagen
  // real (no placeholder) con el Ratón de Getaria reconocible al fondo.
  getaria: "https://detectia.net/img/webcam-malkorbe-azti.webp",
  // plentzia, ondarroa: sin fuente identificada todavía (zumaia ya tiene
  // vídeo, ver WEBCAMS_HLS en index.html)

  // MeteoGalicia (Xunta de Galicia) — imagen JPG directa sin cabeceras
  // especiales, verificada en vivo 2026-09-09. El nombre de fichero puede
  // cambiar si la Xunta renumera/reinstala la cámara.
  baiona: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Baiona/ultima.jpg",
  acoruna: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Corunha/ultima.jpg",
  camarinas: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Camarinhas/ultima.jpg",
  cangas: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Cangas/ultima.jpg",
  corrubedo: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Corrubedo/ultima.jpg",
  ribadeo: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ribadeoporto/ultima.jpg",
  ons: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Onspuerto/ultima.jpg",
  portosin: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Portosin/ultima.jpg",
  cies: "https://www.meteogalicia.gal/datosred/camaras/MeteoGalicia/Ciesrodas/ultima.jpg",

  // Gobierno de Cantabria (puertosdecantabria.es) — imagen JPG directa,
  // verificada en vivo 2026-09-09. El sufijo numérico del fichero es el id
  // interno de la cámara y puede cambiar si la reinstalan.
  suances: "https://www.cantabria.es/ftp_webcam/suances-New-85.jpg",
  // Reserva añadida 2026-09-19: cantabria.es llevaba caído (http_502) todo
  // el día en las 6 cámaras de este proveedor a la vez (ver ROBOT_REGLAS.md,
  // "Fallos correlados por proveedor"). Red independiente
  // webcamsencantabria.com (tendsys.net) verificada en vivo -- poster real
  // actualizándose cada pocos minutos. Solo encontrada para Castro-Urdiales
  // y Laredo, no para Santoña/Suances/San Vicente/Comillas.
  castrourdiales: [
    "https://www.cantabria.es/ftp_webcam/castro-New-117.jpg",
    "https://rswc.tendsys.net/memfs/56b44eac-9cc1-4487-98fc-3991c5a4874d.jpg",
  ],
  laredo: [
    "https://www.cantabria.es/ftp_webcam/Laredo-New-1.jpg",
    "https://rswc.tendsys.net/memfs/4d8076d3-525d-4868-b02d-8126c51da987.jpg",
  ],
  sanvicente: "https://www.cantabria.es/ftp_webcam/sanvicente-New-101_1.jpg",
  comillas: "https://www.cantabria.es/ftp_webcam/Comillas-New-1.jpg",
  santona: "https://www.cantabria.es/ftp_webcam/Santonia-New-69.jpg",

  // Turisme Comunitat Valenciana (streaming.comunitatvalenciana.com) —
  // imagen PNG directa sin cabeceras especiales, verificada en vivo
  // 2026-09-09. Se usa la variante "_mini" (~200KB) en vez de la de
  // resolución completa (~2-3MB) para no sobrecargar el proxy.
  calpe: "https://streaming.comunitatvalenciana.com/static/CalpeNautico/webcam_mini.png",
  denia: "https://streaming.comunitatvalenciana.com/static/Denia/webcam_mini.png",
  peniscola: "https://streaming.comunitatvalenciana.com/static/Penyiscola/webcam_mini.png",
  gandia: "https://streaming.comunitatvalenciana.com/static/Gandia/webcam_mini.png",
  valencia: "https://streaming.comunitatvalenciana.com/static/ValenciaLasArenas/webcam_mini.png",
  alicante: "https://streaming.comunitatvalenciana.com/static/AlicantePuerto/webcam_mini.png",
  altea: "https://streaming.comunitatvalenciana.com/static/Altea/webcam_mini.png",
  benidorm: "https://streaming.comunitatvalenciana.com/static/BenidormLevante/webcam_mini.png",
  guardamardelsegura: "https://streaming.comunitatvalenciana.com/static/GuardamardelSegura/webcam_mini.png",
  vilajoiosa: "https://streaming.comunitatvalenciana.com/static/LaVilaJoiosa/webcam_mini.png",
  pilardelahoradada: "https://streaming.comunitatvalenciana.com/static/PilardelaHoradada/webcam_mini.png",
  santapola: "https://streaming.comunitatvalenciana.com/static/SantaPolaGranPlaya/webcam_mini.png",
  javea: "https://streaming.comunitatvalenciana.com/static/Xabiapuerto/webcam_mini.png",
  alcossebre: "https://streaming.comunitatvalenciana.com/static/Alcossebre/webcam_mini.png",
  benicassim: "https://streaming.comunitatvalenciana.com/static/BenicassimVela/webcam_mini.png",
  burriana: "https://streaming.comunitatvalenciana.com/static/Burriana/webcam_mini.png",
  castellon: "https://streaming.comunitatvalenciana.com/static/GraodeCastellon/webcam_mini.png",
  xilxes: "https://streaming.comunitatvalenciana.com/static/Xilxes/webcam_mini.png",
  oropesa: "https://streaming.comunitatvalenciana.com/static/OropesadelMar/webcam_mini.png",
  torreblanca: "https://streaming.comunitatvalenciana.com/static/Torreblanca/webcam_mini.png",
  vinaros: "https://streaming.comunitatvalenciana.com/static/Vinaros/webcam_mini.png",
  alboraya: "https://streaming.comunitatvalenciana.com/static/AlborayaPatacona/webcam_mini.png",
  canetdeberenguer: "https://streaming.comunitatvalenciana.com/static/CanetdeBerenguer/webcam_mini.png",
  cullera: "https://streaming.comunitatvalenciana.com/static/CulleraCastillo/webcam_mini.png",
  pobladefarnals: "https://streaming.comunitatvalenciana.com/static/PobladeFarnals/webcam_mini.png",
  oliva: "https://streaming.comunitatvalenciana.com/static/OlivaPuerto/webcam_mini.png",
  piles: "https://streaming.comunitatvalenciana.com/static/Piles/webcam_mini.png",

  // SOCIB (Sistema d'Observació i Predicció Costanera de les Illes Balears)
  // — endpoint interno del visor BEAMON, no documentado públicamente pero
  // verificado en vivo 2026-09-09 (redirección 307 a un JPEG con marca de
  // agua SOCIB, CORS abierto). Puede romperse si SOCIB cambia el visor.
  calamillor: "https://apps.socib.es/beamon/api/image_access/view/clm/clm/c01/latest/latest/thumbnail/",
  sonbou: "https://apps.socib.es/beamon/api/image_access/view/snb/snb/c01/latest/latest/thumbnail/",
  muro: "https://apps.socib.es/beamon/api/image_access/view/muro/muro/c01/latest/latest/thumbnail/",

  // SkylineWebcams (proveedor nuevo en el repo) — snapshot JPEG directo, sin
  // token ni cabeceras especiales. Encontradas por el robot buscador de
  // fuentes el 2026-09-25 (zona Comunidad Valenciana y Murcia) e integradas
  // ese mismo día por la regla "Cámara con mar a la vista" de
  // ROBOT_REGLAS.md. Águilas era uno de los 2 únicos spots de Murcia sin
  // ninguna cámara.
  //
  // Las 4 candidatas se miraron una a una antes de elegir. El orden NO es el
  // que propuso el robot (proponía la del puerto deportivo como principal,
  // por "mejor composición"): para esta app lo que importa es poder leer el
  // estado del mar, y el agua de una marina está siempre en calma detrás del
  // espigón, así que no dice nada del mar real. Va primero la de la bahía.
  //
  // DESCARTADA a propósito: live911.jpg ("Águilas", panorámica). Es una
  // vista de los tejados de la ciudad con el mar como franja lejana al
  // fondo — no se puede leer el estado del agua, que es justo el caso que
  // ROBOT_REGLAS.md excluye. No añadirla como reserva "por si acaso".
  //
  // Limitación conocida y aceptada: las 3 son de 344x193 px, bastante menos
  // que el resto de cámaras del repo (SkylineWebcams las regenera desde su
  // propio vídeo, no es la resolución nativa). Se integran igual porque la
  // alternativa era dejar Águilas sin ninguna cámara. El vídeo HLS real de
  // este proveedor exige un token de sesión que cambia en cada carga, así
  // que no es integrable sin un proxy propio (mismo bloqueo ya documentado
  // para rtsp.me y tendsys.net).
  aguilas: [
    // Bahía de Levante: bahía entera, playa, orilla y veleros fondeados —
    // la única de las 4 en la que se ve mar abierto de verdad.
    "https://cdn.skylinewebcams.com/live5963.jpg",
    // Águilas Yacht Club: mar abierto en la mitad izquierda del encuadre.
    // Confirmada de forma cruzada con la web del Club Náutico de Águilas.
    "https://cdn.skylinewebcams.com/live260.jpg",
    // Puerto deportivo: marina y castillo al fondo, con algo de mar arriba
    // a la izquierda.
    "https://cdn.skylinewebcams.com/live1448.jpg",
  ],
};

// Busca una subsecuencia de bytes dentro de un Uint8Array a partir de
// `desde` -- versión mínima de Buffer.indexOf sin depender de Buffer
// (Node), que no está garantizado en el runtime de Cloudflare Workers.
function indiceDeBytes(datos, patron, desde = 0) {
  for (let i = desde; i <= datos.length - patron.length; i++) {
    let coincide = true;
    for (let j = 0; j < patron.length; j++) {
      if (datos[i + j] !== patron[j]) { coincide = false; break; }
    }
    if (coincide) return i;
  }
  return -1;
}

// Extrae el primer frame JPEG completo (marcadores SOI 0xFFD8 ... EOI
// 0xFFD9) de un stream MJPEG (`multipart/x-mixed-replace`) que en teoría
// no termina nunca -- lee por trozos y corta la conexión en cuanto tiene
// un frame entero, en vez de esperar a que el stream termine solo (nunca
// pasaría). Sin librería de imagen ni Buffer de Node: solo Uint8Array,
// universal en cualquier runtime de Workers.
async function extraerFramePrimeroDeMjpeg(resp) {
  const reader = resp.body.getReader();
  const trozos = [];
  let total = 0;
  const LIMITE_BYTES = 2 * 1024 * 1024; // margen de sobra para un frame + cabecera multipart
  try {
    while (total < LIMITE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      trozos.push(value);
      total += value.length;
      const datos = new Uint8Array(total);
      let offset = 0;
      for (const t of trozos) { datos.set(t, offset); offset += t.length; }
      const inicio = indiceDeBytes(datos, [0xff, 0xd8, 0xff]);
      if (inicio < 0) continue;
      const fin = indiceDeBytes(datos, [0xff, 0xd9], inicio);
      if (fin < 0) continue;
      return datos.subarray(inicio, fin + 2);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return null;
}

export async function onRequestGet(context) {
  const { slug } = context.params;
  const entrada = WEBCAMS[slug];

  if (!entrada) {
    return new Response(JSON.stringify({ error: `Sin webcam registrada para "${slug}"` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const fuentes = Array.isArray(entrada) ? entrada : [entrada];
  const errores = [];

  for (let i = 0; i < fuentes.length; i++) {
    const fuente = fuentes[i];
    // Fuentes MJPEG (ver ROBOT_REGLAS.md, Bakio "último recurso"): objeto
    // { url, mjpeg: true } en vez de un string plano -- necesitan extraer
    // un frame en vez de reenviar la respuesta tal cual.
    const url = typeof fuente === "string" ? fuente : fuente.url;
    const esMjpeg = typeof fuente === "object" && fuente.mjpeg === true;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} del proveedor de la webcam`);

      if (esMjpeg) {
        const frame = await extraerFramePrimeroDeMjpeg(resp);
        if (!frame) throw new Error("no se encontró ningún frame JPEG completo en el stream MJPEG");
        return new Response(frame, {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=120",
            "access-control-allow-origin": "*",
            "x-webcam-fuente-indice": String(i),
            "x-webcam-fuentes-total": String(fuentes.length),
          },
        });
      }

      // Reenviamos la imagen tal cual, pero con caché corta propia (no
      // dependemos de las cabeceras de caché del proveedor original)
      return new Response(resp.body, {
        headers: {
          "content-type": resp.headers.get("content-type") || "image/jpeg",
          "cache-control": "public, max-age=120", // 2 min: son capturas que se actualizan solas
          "access-control-allow-origin": "*",
          // Índice de la fuente que sirvió de verdad (0 = principal, >0 =
          // se recurrió a una de reserva) -- lo lee scripts/camaras/
          // comprobar-camaras.mjs para poder avisar aunque el failover deje
          // la app funcionando con normalidad de cara al usuario.
          "x-webcam-fuente-indice": String(i),
          "x-webcam-fuentes-total": String(fuentes.length),
        },
      });
    } catch (e) {
      errores.push(`fuente ${i} (${url}): ${String(e)}`);
    }
  }

  return new Response(JSON.stringify({ error: "todas las fuentes fallaron", slug, detalle: errores }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}
