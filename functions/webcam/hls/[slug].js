// functions/webcam/hls/[slug].js
// Vídeo de las webcams de IPCamLive (Santoña, Sopelana) resuelto en cada
// petición desde el alias del reproductor (2026-09-28, pedido del usuario
// tras ver Santoña caída otra vez).
//
// IPCamLive cambia sin aviso el servidor (sXX) y el streamid de cada
// cámara: Sopelana se rompió el 2026-09-21 y Santoña el 2026-09-25, se
// corrigieron a mano ese día, y Santoña volvió a dar 404 el 2026-09-28.
// Guardar la URL final en el código garantiza que se vuelva a romper. Lo
// único estable es el alias que el dueño embebe en su web
// (ipcamlive.com/player/player.php?alias=<alias>, ver ROBOT_REGLAS.md,
// "IPCamLive en concreto"): esta función descarga ese reproductor, saca
// `address` y `streamid` y redirige (302) al stream.m3u8 real de ese
// momento. Si la resolución falla, redirige a la última URL conocida, que
// es lo mismo que había antes de este cambio — nunca queda peor.
//
// ?tipo=snapshot devuelve la imagen fija de la misma cámara en vez del
// vídeo.
//
// Pública (prefijo /webcam/ en functions/_lib/rutas-publicas.js), igual
// que el proxy de imagen fija de ../[slug].js.

const IPCAMLIVE = {
  // Watsay Surf School, playa de Berria: watsaysurfschool.com/webcam/
  santona: { alias: "webcamberria", ultimaConocida: "https://s123.ipcamlive.com/streams/7bz57yv0sddgbiwei/" },
  // Ayuntamiento de Sopela: sopela.eus/webcam-olas/
  sopelana: { alias: "673c8a5893eaf", ultimaConocida: "https://s153.ipcamlive.com/streams/99eod1rsuvg7yjnvk/" },
};

// Extrae la base del stream de la página del reproductor. El HTML trae,
// entre otras, `var address = 'http://s123.ipcamlive.com/';` y
// `var streamid = '7bz57yv0sddgbiwei';` (formato documentado en
// ROBOT_REGLAS.md). Exportada para el test.
export function baseDesdeReproductor(html) {
  const address = /address\s*=\s*['"](https?:\/\/[a-z0-9.-]+\.ipcamlive\.com\/?)['"]/i.exec(html)?.[1];
  const streamid = /streamid\s*=\s*['"]([a-z0-9]+)['"]/i.exec(html)?.[1];
  if (!address || !streamid) return null;
  const servidor = address.replace(/^http:/i, "https:").replace(/\/?$/, "/");
  return `${servidor}streams/${streamid}/`;
}

async function resolverBase(alias) {
  try {
    const resp = await fetch(`https://ipcamlive.com/player/player.php?alias=${encodeURIComponent(alias)}`, {
      // 5 min en la caché de Cloudflare: basta para no pedir el reproductor
      // en cada visita, y un cambio de servidor se recoge solo enseguida.
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: { "user-agent": "Mozilla/5.0 (compatible; Costaviva/1.0; +https://costaviva.org)" },
    });
    if (!resp.ok) return null;
    return baseDesdeReproductor(await resp.text());
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, params } = context;
  const camara = IPCAMLIVE[params.slug];
  if (!camara) return new Response("Webcam no encontrada", { status: 404 });

  const base = (await resolverBase(camara.alias)) || camara.ultimaConocida;
  const tipo = new URL(request.url).searchParams.get("tipo");
  const destino = base + (tipo === "snapshot" ? "snapshot.jpg" : "stream.m3u8");

  return new Response(null, {
    status: 302,
    headers: {
      location: destino,
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}
