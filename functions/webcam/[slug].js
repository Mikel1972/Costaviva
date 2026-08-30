// functions/webcam/[slug].js
// Proxy de imágenes de webcam: descarga en el servidor (edge de Cloudflare)
// y la sirve desde nuestro propio dominio. Esto es lo que resuelve de raíz
// el problema de CORS/hotlinking que sufrimos al intentar cargar estas
// imágenes directamente desde el navegador en el prototipo anterior.
// Alcanzable en /webcam/<slug>, ej. /webcam/bakio

const WEBCAMS = {
  mundaka: "https://www.kostasystem.com/wp-content/uploads/irudiak/mundaka/camara1_snap.jpeg",
  bakio: "https://pyscada.isurki.com/static/pyscada/sirena/aditu/BakioNAS/last/bakio.1.snap.last.thumb.jpeg",
  sopelana: "https://detectia.net/img/webcam-sopelana-azti3.webp",
  // lekeitio, plentzia, getxo: sin fuente identificada todavía
};

export async function onRequestGet(context) {
  const { slug } = context.params;
  const url = WEBCAMS[slug];

  if (!url) {
    return new Response(JSON.stringify({ error: `Sin webcam registrada para "${slug}"` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} del proveedor de la webcam`);

    // Reenviamos la imagen tal cual, pero con caché corta propia (no
    // dependemos de las cabeceras de caché del proveedor original)
    return new Response(resp.body, {
      headers: {
        "content-type": resp.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=120", // 2 min: son capturas que se actualizan solas
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), slug, url_origen: url }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
