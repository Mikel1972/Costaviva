// functions/prevision.js
// Cloudflare Pages Function — corre en el servidor (edge de Cloudflare), no
// en el navegador del usuario, así que no sufre los problemas de CORS ni las
// restricciones de red que sí tuvimos en el sandbox de desarrollo.
// Alcanzable en /prevision (sin el prefijo /functions/, por convención).

const SPOTS = [
  { slug: "lekeitio", nombre: "Lekeitio", lat: 43.3647, lon: -2.5089,
    url: "https://www.todosurf.com/prevision/playa-de-karraspio-spot263.htm" },
  { slug: "mundaka", nombre: "Mundaka", lat: 43.4047, lon: -2.6989,
    url: "https://www.todosurf.com/prevision/mundaka-spot80.htm" },
  { slug: "bakio", nombre: "Bakio", lat: 43.4297, lon: -2.8103,
    url: "https://www.todosurf.com/prevision/bakio-spot81.htm" },
  { slug: "sopelana", nombre: "Sopelana", lat: 43.3878, lon: -2.9975,
    url: "https://www.todosurf.com/prevision/sopelana-spot10.htm" },
  { slug: "plentzia", nombre: "Plentzia", lat: 43.4053, lon: -2.9436,
    url: "https://www.todosurf.com/prevision/plentzia-spot264.htm" },
  { slug: "getxo", nombre: "Getxo (Ereaga)", lat: 43.3489, lon: -3.0119,
    url: "https://www.todosurf.com/prevision/playa-de-ereaga-spot256.htm" },
];

// Mismas expresiones regulares validadas hoy contra HTML real de Todosurf
// (ver /backend/scraper.py) — el campo "kj" es energía de ola, NO viento.
const PATRON_OLA = /(\d{1,2}(?:am|pm))\d(\d\.\d)(\d\.\d) - (\d\.\d)m(\d+)s(\d+|-)kj([a-z]+) (\d+)°/g;
const PATRON_VIENTO = /(\d{1,2}(?:am|pm)) (\d+) ([A-Z]+) Viento en/g;

function parsearOla(texto, nBloques = 8) {
  const bloques = [];
  let m;
  PATRON_OLA.lastIndex = 0;
  while ((m = PATRON_OLA.exec(texto)) && bloques.length < nBloques) {
    bloques.push({
      hora: m[1],
      altura: [parseFloat(m[3]), parseFloat(m[4])],
      periodo: parseInt(m[5], 10),
      energiaOlaKj: m[6] === "-" ? null : parseInt(m[6], 10),
      dirOla: `${m[7].toUpperCase()} ${m[8]}°`,
    });
  }
  return bloques;
}

function parsearViento(texto, nBloques = 8) {
  const bloques = [];
  let m;
  PATRON_VIENTO.lastIndex = 0;
  while ((m = PATRON_VIENTO.exec(texto)) && bloques.length < nBloques) {
    bloques.push({ hora: m[1], viento: parseInt(m[2], 10), dirViento: m[3] });
  }
  return bloques;
}

function combinar(ola, viento) {
  const porHora = Object.fromEntries(viento.map((v) => [v.hora, v]));
  return ola.map((o) => ({ ...o, ...(porHora[o.hora] || { viento: null, dirViento: null }) }));
}

async function previsionSpot(spot) {
  const resp = await fetch(spot.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  // Extracción simple de texto (suficiente para este parser basado en regex
  // sobre el patrón de caracteres, no necesita DOM real)
  const texto = html.replace(/<[^>]+>/g, "");
  const bloques = combinar(parsearOla(texto), parsearViento(texto));
  return {
    slug: spot.slug,
    nombre: spot.nombre,
    lat: spot.lat,
    lon: spot.lon,
    actualizado: new Date().toISOString(),
    bloques,
  };
}

export async function onRequestGet(context) {
  const resultados = await Promise.all(
    SPOTS.map((spot) =>
      previsionSpot(spot).catch((e) => ({ slug: spot.slug, nombre: spot.nombre, error: String(e) }))
    )
  );

  return new Response(JSON.stringify({ spots: resultados }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Cache corto en el edge de Cloudflare para no golpear Todosurf en
      // cada visita — los datos cambian cada 3h en origen, no hace falta
      // más frecuencia que esta.
      "cache-control": "public, max-age=1800",
    },
  });
}
