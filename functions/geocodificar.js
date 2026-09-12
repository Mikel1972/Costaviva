// functions/geocodificar.js
// Geocodificación inversa (lat/lon -> nombre real de la costa) para las
// ubicaciones personalizadas del mapa — alcanzable en
// /geocodificar?lat=<lat>&lon=<lon>. El nombre de una ubicación creada
// por un usuario nunca es texto libre que él mismo escriba: siempre sale
// de aquí, para que la lista de spots se enriquezca con nombres reales,
// no apodos.
//
// Nominatim (OpenStreetMap), gratuito y sin clave, pero exige un
// User-Agent identificando la app en cada petición (política de uso) —
// los navegadores no dejan fijar ese header desde fetch(), así que tiene
// que pasar por este proxy en vez de llamarse directo desde el cliente.

const USER_AGENT = "Mozilla/5.0 (compatible; CostaVivaApp/0.1; +https://fishnow-59u.pages.dev)";

function nombreDesdeDireccion(address) {
  return (
    address.town || address.village || address.city || address.municipality ||
    address.suburb || address.county || null
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: "faltan lat/lon" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const datos = await resp.json();
    const address = datos.address || {};
    const localidad = nombreDesdeDireccion(address);

    if (!localidad) {
      return new Response(
        JSON.stringify({ error: "no se ha podido identificar el nombre de esta zona" }),
        { status: 422, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        nombre: localidad,
        pais: address.country || null,
        ccaa: address.state || null,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=86400", // el nombre de un punto no cambia de un día para otro
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
