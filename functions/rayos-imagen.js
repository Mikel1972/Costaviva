// functions/rayos-imagen.js
// Proxy de la imagen de rayos de AEMET (Agencia Estatal de Meteorología),
// alcanzable en /rayos-imagen. Es un endpoint público de su propia web (el
// que usa aemet.es/es/eltiempo/observacion/rayos), no requiere API key ni
// login — lo comprobamos con curl antes de conectarlo.
//
// IMPORTANTE — qué es y qué no es esta imagen: es el mapa de TODA España de
// las últimas 12h, actualizado una vez por hora. No tiene coordenadas de
// cada rayo por separado (AEMET no las publica en abierto en ningún sitio
// que respete sus términos de uso), así que no se puede convertir en una
// capa de puntos sobre nuestro propio mapa — es solo una imagen de
// referencia nacional, y así se presenta en la app.

async function ultimoFichero() {
  const resp = await fetch("https://www.aemet.es/es/api-eltiempo/rayos/timeline", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (timeline)`);
  const datos = await resp.json();
  const bloques = datos?.ica_horario?.penbal?.variables?.rayos || [];
  if (!bloques.length) throw new Error("sin datos en la línea temporal de AEMET");
  const ultimo = bloques[bloques.length - 1];
  return { archivo: ultimo.ficheros.PROV, actualizado: ultimo.fecha };
}

export async function onRequestGet(context) {
  try {
    const { archivo, actualizado } = await ultimoFichero();
    const resp = await fetch(`https://www.aemet.es/es/api-eltiempo/rayos/imagen/rayos/${archivo}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CostaVivaApp/0.1)" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} (imagen)`);

    return new Response(resp.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=900", // 15 min: la imagen solo cambia una vez por hora
        "access-control-allow-origin": "*",
        "x-rayos-actualizado": actualizado,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
