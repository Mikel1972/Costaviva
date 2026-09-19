// functions/mareas/index.js
// Página índice pública de /mareas -- lista los ~105 spots con enlace a
// su página individual (functions/mareas/[slug].js). Pedido explícito
// del usuario: dar a Google otra vía de descubrir las páginas de spot
// además del sitemap, y una página que pueda rankear ella misma para
// búsquedas más genéricas ("mareas España", "previsión marina España y
// Portugal"). Sin datos en vivo aquí a propósito -- solo el listado y
// enlaces, los datos reales viven en la página de cada spot.

const DORADO = "#A8792A";
const NAVY = "#0B2532";
const GRIS = "#5C7680";
const CREMA = "#F7F3E8";
const BLANCO = "#FFFFFF";
const BORDE = "#DDE2DC";

function escaparHtml(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function onRequestGet(context) {
  const { request } = context;
  const previsionUrl = new URL("/prevision", request.url).toString();
  let datos;
  try {
    const resp = await fetch(previsionUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    datos = await resp.json();
  } catch (e) {
    return new Response(`No se pudo cargar la lista de spots ahora mismo: ${e.message}`, { status: 502 });
  }

  const spots = [...datos.spots].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const url = "https://costaviva.org/mareas";
  const descripcion = `Marea, oleaje y viento en tiempo real de ${spots.length} spots de pesca en España y Portugal -- consulta cada uno gratis, sin necesidad de cuenta.`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mareas y oleaje en España y Portugal | Costaviva</title>
<meta name="description" content="${escaparHtml(descripcion)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="Mareas y oleaje en España y Portugal | Costaviva" />
<meta property="og:description" content="${escaparHtml(descripcion)}" />
<meta property="og:image" content="https://costaviva.org/assets/hero-peces-poster.jpg" />
<meta property="og:locale" content="es_ES" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Mareas y oleaje en España y Portugal | Costaviva" />
<meta name="twitter:description" content="${escaparHtml(descripcion)}" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${CREMA}; font-family: Arial, 'Liberation Sans', sans-serif; color: ${NAVY}; }
  .envoltorio { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
  .marca { font-family: Georgia, 'Liberation Serif', serif; font-size: 28px; font-weight: bold; color: ${DORADO}; letter-spacing: 1px; text-decoration: none; }
  .subtitulo { color: ${GRIS}; font-size: 14px; margin-top: 4px; }
  h1 { font-family: Georgia, serif; font-size: 28px; margin: 32px 0 8px; }
  .intro { color: ${GRIS}; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
  .cta { display: block; text-align: center; background: ${DORADO}; color: ${BLANCO}; font-weight: bold; text-decoration: none; padding: 16px; border-radius: 10px; margin: 0 0 32px; font-size: 16px; }
  .lista { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  .lista li a { display: block; background: ${BLANCO}; border: 1px solid ${BORDE}; border-radius: 10px; padding: 10px 14px; text-decoration: none; color: ${NAVY}; font-size: 14px; }
  a { color: ${DORADO}; }
</style>
</head>
<body>
  <div class="envoltorio">
    <a class="marca" href="/login">COSTAVIVA</a>
    <div class="subtitulo">pesca en tiempo real</div>

    <h1>Mareas y oleaje en España y Portugal</h1>
    <p class="intro">${escaparHtml(descripcion)}</p>

    <a class="cta" href="/login">Ver el mapa completo, webcams en directo y mucho más → Entra gratis</a>

    <ul class="lista">
      ${spots.map((s) => `<li><a href="/mareas/${s.slug}">${escaparHtml(s.nombre)}</a></li>`).join("\n      ")}
    </ul>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=1800",
    },
  });
}
