// functions/mareas/[slug].js
// Prototipo de página pública indexable por Google, una por spot (Fase 2
// de SEO, pedida explícitamente por el usuario 2026-09-19): a diferencia
// del resto de la app (todo detrás de login, renderizado en JS del
// cliente), esto es HTML real generado en el servidor, sin login ni
// JavaScript necesario para ver el dato -- para que alguien que busque
// en Google "marea Mundaka hoy" encuentre de verdad una página nuestra
// que responda a eso.
//
// Generalizado a los ~105 spots 2026-09-19 (probado antes solo con
// Mundaka como prototipo, confirmado en producción real) -- cualquier
// slug que exista en /prevision tiene página pública, no hace falta
// mantener una lista aparte: si el spot existe en la app, existe aquí.
// Nunca inventa datos: reutiliza el mismo /prevision ya real que usa la
// app (mismo criterio del resto del repo), no un cálculo aparte.
//
// La página actúa de puerta de entrada: da el dato real al instante
// (gratis, sin cuenta) y ofrece un CTA claro hacia /login para ver el
// mapa completo, las webcams en directo, el diario de pesca, etc.

import { regionDeSlug } from "./_regiones.js";

const DORADO = "#A8792A";
const NAVY = "#0B2532";
const GRIS = "#5C7680";
const CREMA = "#F7F3E8";
const BLANCO = "#FFFFFF";
const BORDE = "#DDE2DC";

function escaparHtml(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paginaNoEncontrada(slug) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Spot no encontrado | Costaviva</title></head>
    <body><p>No tenemos página pública para "${escaparHtml(slug)}" todavía. <a href="/login">Entra en Costaviva</a> para ver el mapa completo.</p></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// Distancia aproximada entre dos puntos (fórmula de Haversine, km) --
// solo para ordenar "spots cercanos", no hace falta más precisión que
// esa. Pedido explícito del usuario: enlaces cruzados entre spots
// cercanos, para que Google entienda mejor la relación entre páginas
// (antes cada página de spot estaba aislada, sin enlaces internos).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function spotsCercanos(todos, spot, n = 4) {
  return todos
    .filter((s) => s.slug !== spot.slug)
    .map((s) => ({ ...s, distancia: distanciaKm(spot.lat, spot.lon, s.lat, s.lon) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, n);
}

// "16:42" o "mañana 04:10" -- próximas pleamares/bajamares tal cual las
// calcula /prevision (hora local de Madrid), sin recalcular nada aquí.
function textoEvento(e) {
  return `${e.manana ? "mañana " : ""}${e.hora} (${e.altura} m)`;
}

// "12am"/"3pm" de /prevision -> "00:00"/"15:00", más natural en español.
function hora24(etiqueta) {
  const m = /^(\d+)(am|pm)$/.exec(etiqueta || "");
  if (!m) return etiqueta || "";
  let h = Number(m[1]) % 12;
  if (m[2] === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:00`;
}

// SEO y conversión (2026-09-28, pedido del usuario: "lo más óptimo para que
// se pague rápido"). Lo que la gente busca en Google es "marea <sitio> hoy",
// "pleamar <sitio>", "bajamar <sitio>": el título, la descripción y la
// cabecera llevan ahora la hora real de la próxima pleamar/bajamar, que
// /prevision ya calculaba pero esta página no enseñaba. También la
// temperatura del agua y la previsión de las próximas horas (los mismos
// bloques de la app), para que la página tenga contenido propio suficiente
// y Google no la trate como una ficha vacía repetida 105 veces.
function renderizarPagina(spot, todos) {
  const bloque = spot.bloques[0];
  const oleajeTexto = bloque ? `${bloque.altura[0]}–${bloque.altura[1]} m (periodo ${bloque.periodo}s)` : "sin dato ahora mismo";
  const vientoTexto = bloque ? `${bloque.viento} km/h ${bloque.dirViento}` : "sin dato ahora mismo";
  const mareaFlecha = spot.marea.tendencia === "subiendo" ? "▲" : "▼";
  const mareaTexto = `${spot.marea.altura} m, ${spot.marea.tendencia} ${mareaFlecha} (coeficiente ${spot.marea.coeficiente})`;
  const nombre = escaparHtml(spot.nombre);
  const region = regionDeSlug(spot.slug);
  const proximas = spot.marea.proximas || [];
  const pleamar = proximas.find((e) => e.tipo === "pleamar");
  const bajamar = proximas.find((e) => e.tipo === "bajamar");
  const tempAgua = bloque?.tempAgua;
  const resumenMareas = [pleamar && `pleamar ${textoEvento(pleamar)}`, bajamar && `bajamar ${textoEvento(bajamar)}`]
    .filter(Boolean)
    .join(", ");
  const descripcion =
    `Marea hoy en ${spot.nombre}: ${resumenMareas ? `próxima ${resumenMareas}; ` : ""}` +
    `oleaje ${oleajeTexto}, viento ${vientoTexto}${tempAgua != null ? `, agua a ${tempAgua} °C` : ""}. ` +
    `Datos reales actualizados cada hora, gratis y sin cuenta.`;
  const titulo = `Marea hoy en ${spot.nombre}${region ? ` (${region.nombre})` : ""}: pleamar, bajamar y oleaje | Costaviva`;
  const url = `https://costaviva.org/mareas/${spot.slug}`;

  const migas = [
    { name: "Mareas", item: "https://costaviva.org/mareas" },
    ...(region ? [{ name: region.nombre, item: `https://costaviva.org/mareas/region/${region.slug}` }] : []),
    { name: spot.nombre, item: url },
  ];
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Place",
      name: spot.nombre,
      geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon },
      url,
      ...(region ? { containedInPlace: { "@type": "AdministrativeArea", name: region.nombre } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: migas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.name, item: m.item })),
    },
  ]).replace(/</g, "\\u003c");

  const filasPrevision = spot.bloques
    .map(
      (b) =>
        `<tr><td>${escaparHtml(hora24(b.hora))}</td><td>${b.altura[0]}–${b.altura[1]} m</td><td>${b.viento ?? "–"} km/h ${escaparHtml(b.dirViento ?? "")}</td><td>${b.tempAgua != null ? `${b.tempAgua} °C` : "–"}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escaparHtml(titulo)}</title>
<meta name="description" content="${escaparHtml(descripcion)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${escaparHtml(titulo)}" />
<meta property="og:description" content="${escaparHtml(descripcion)}" />
<meta property="og:image" content="https://costaviva.org/assets/hero-peces-poster.jpg" />
<meta property="og:locale" content="es_ES" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escaparHtml(titulo)}" />
<meta name="twitter:description" content="${escaparHtml(descripcion)}" />
<script type="application/ld+json">${jsonLd}</script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${CREMA}; font-family: Arial, 'Liberation Sans', sans-serif; color: ${NAVY}; }
  .envoltorio { max-width: 640px; margin: 0 auto; padding: 32px 20px 64px; }
  .marca { font-family: Georgia, 'Liberation Serif', serif; font-size: 28px; font-weight: bold; color: ${DORADO}; letter-spacing: 1px; text-decoration: none; }
  .subtitulo { color: ${GRIS}; font-size: 14px; margin-top: 4px; }
  .migas { font-size: 13px; color: ${GRIS}; margin-top: 24px; }
  .migas a { color: ${GRIS}; }
  h1 { font-family: Georgia, serif; font-size: 32px; margin: 32px 0 4px; }
  .actualizado { color: ${GRIS}; font-size: 13px; margin-bottom: 24px; }
  .tarjetas { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .tarjeta { background: ${BLANCO}; border: 1px solid ${BORDE}; border-radius: 12px; padding: 16px 20px; }
  .tarjeta .titulo { font-size: 13px; font-weight: bold; color: ${GRIS}; letter-spacing: 1px; }
  .tarjeta .valor { font-family: Georgia, serif; font-size: 22px; font-weight: bold; margin-top: 4px; }
  .cta { display: block; text-align: center; background: ${DORADO}; color: ${BLANCO}; font-weight: bold; text-decoration: none; padding: 16px; border-radius: 10px; margin: 32px 0 16px; font-size: 16px; }
  .nota { color: ${GRIS}; font-size: 12px; line-height: 1.5; }
  a { color: ${DORADO}; }
  .cercanos { margin: 32px 0; }
  .cercanos .titulo { font-size: 13px; font-weight: bold; color: ${GRIS}; letter-spacing: 1px; margin-bottom: 8px; }
  .cercanos ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .cercanos li a { display: inline-block; background: ${BLANCO}; border: 1px solid ${BORDE}; border-radius: 20px; padding: 6px 14px; font-size: 14px; text-decoration: none; }
  .mareas-hoy { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .mareas-hoy .tarjeta { background: ${NAVY}; border-color: ${NAVY}; color: ${BLANCO}; }
  .mareas-hoy .tarjeta .titulo { color: #D4A24C; }
  h2 { font-family: Georgia, serif; font-size: 20px; margin: 32px 0 10px; }
  .tabla-envoltorio { overflow-x: auto; background: ${BLANCO}; border: 1px solid ${BORDE}; border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid ${BORDE}; white-space: nowrap; }
  th { font-size: 12px; color: ${GRIS}; letter-spacing: 0.5px; }
  tr:last-child td { border-bottom: none; }
  .cta-sub { text-align: center; color: ${GRIS}; font-size: 13px; margin: -8px 0 24px; }
</style>
</head>
<body>
  <div class="envoltorio">
    <a class="marca" href="/login">COSTAVIVA</a>
    <div class="subtitulo">pesca en tiempo real</div>

    <div class="migas"><a href="/mareas">Todos los spots</a>${region ? ` → <a href="/mareas/region/${region.slug}">${escaparHtml(region.nombre)}</a>` : ""} → ${nombre}</div>
    <h1>Marea hoy en ${nombre}</h1>
    <div class="actualizado">Datos reales, actualizados: ${new Date(spot.actualizado).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</div>

    ${
      pleamar || bajamar
        ? `<div class="mareas-hoy">
      <div class="tarjeta"><div class="titulo">PRÓXIMA PLEAMAR</div><div class="valor">${pleamar ? escaparHtml(textoEvento(pleamar)) : "–"}</div></div>
      <div class="tarjeta"><div class="titulo">PRÓXIMA BAJAMAR</div><div class="valor">${bajamar ? escaparHtml(textoEvento(bajamar)) : "–"}</div></div>
    </div>`
        : ""
    }

    <div class="tarjetas">
      <div class="tarjeta"><div class="titulo">🌊 OLEAJE</div><div class="valor">${escaparHtml(oleajeTexto)}</div></div>
      <div class="tarjeta"><div class="titulo">💨 VIENTO</div><div class="valor">${escaparHtml(vientoTexto)}</div></div>
      <div class="tarjeta"><div class="titulo">🌙 MAREA AHORA</div><div class="valor">${escaparHtml(mareaTexto)}</div></div>
      ${tempAgua != null ? `<div class="tarjeta"><div class="titulo">🌡️ TEMPERATURA DEL AGUA</div><div class="valor">${tempAgua} °C</div></div>` : ""}
    </div>

    <a class="cta" href="/login?alta=1">Prueba Costaviva 7 días gratis →</a>
    <p class="cta-sub">Sin tarjeta. Mapa completo, webcams en directo y diario de pesca. Después, 3,99 €/mes.</p>

    ${
      filasPrevision
        ? `<h2>Previsión de las próximas horas en ${nombre}</h2>
    <div class="tabla-envoltorio"><table>
      <thead><tr><th>HORA</th><th>OLEAJE</th><th>VIENTO</th><th>AGUA</th></tr></thead>
      <tbody>${filasPrevision}</tbody>
    </table></div>`
        : ""
    }

    <p class="nota">Costaviva es una app de condiciones costeras en tiempo real (oleaje, mareas, corriente, webcams, radar de lluvia) y diario de pesca, para toda la costa de España y Portugal. La marea, el oleaje y el viento de ${nombre} son gratis y no necesitan cuenta. Con la prueba gratuita de 7 días ves además el mapa completo, las webcams en directo de este spot y de otros, y llevas tu propio diario de pesca con los datos del momento de cada captura.</p>

    <div class="cercanos">
      <div class="titulo">SPOTS CERCANOS</div>
      <ul>
        ${spotsCercanos(todos, spot)
          .map((s) => `<li><a href="/mareas/${s.slug}">${escaparHtml(s.nombre)}</a></li>`)
          .join("")}
      </ul>
    </div>

    <p class="nota"><a href="/mareas">Ver todos los spots →</a></p>
  </div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, params } = context;
  const slug = params.slug;

  const previsionUrl = new URL("/prevision", request.url).toString();
  let datos;
  try {
    const resp = await fetch(previsionUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    datos = await resp.json();
  } catch (e) {
    return new Response(`No se pudo cargar la previsión ahora mismo: ${e.message}`, { status: 502 });
  }

  const spot = datos.spots.find((s) => s.slug === slug);
  if (!spot) return paginaNoEncontrada(slug);

  return new Response(renderizarPagina(spot, datos.spots), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Media hora -- mismo orden de magnitud que la caché de /prevision,
      // no tiene sentido que esta página vaya más fresca que su fuente.
      "cache-control": "public, max-age=1800",
    },
  });
}
