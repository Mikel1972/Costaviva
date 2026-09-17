// functions/geocodificar.js
// Geocodificación inversa (lat/lon -> nombre real de la costa) para las
// ubicaciones personalizadas del mapa — alcanzable en
// /geocodificar?lat=<lat>&lon=<lon>. El nombre de una ubicación creada
// por un usuario nunca es texto libre que él mismo escriba: siempre sale
// de aquí, para que la lista de spots se enriquezca con nombres reales,
// no apodos.
//
// Añadido 2026-09-17: geocodificación DIRECTA por código postal
// (/geocodificar?cp=48001) — para centrar el mapa de index.html en la
// zona del usuario la primera vez que entra (perfiles.codigo_postal, ver
// el paso 1 del alta en login.html). Mismo proxy, misma razón: Nominatim
// exige User-Agent, que un fetch() de navegador no puede fijar.
//
// Nominatim (OpenStreetMap), gratuito y sin clave, pero exige un
// User-Agent identificando la app en cada petición (política de uso) —
// los navegadores no dejan fijar ese header desde fetch(), así que tiene
// que pasar por este proxy en vez de llamarse directo desde el cliente.

const USER_AGENT = "Mozilla/5.0 (compatible; CostaVivaApp/0.1; +https://costaviva.org)";

function nombreDesdeDireccion(address) {
  return (
    address.town || address.village || address.city || address.municipality ||
    address.suburb || address.county || null
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const codigoPostal = url.searchParams.get("cp");

  if (codigoPostal !== null) {
    if (!/^[0-9]{5}$/.test(codigoPostal)) {
      return new Response(JSON.stringify({ error: "código postal inválido" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${codigoPostal}&country=Spain&format=jsonv2&limit=1`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const resultados = await resp.json();
      const primero = resultados[0];
      if (!primero) {
        return new Response(
          JSON.stringify({ error: "no se ha podido localizar ese código postal" }),
          { status: 422, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ lat: parseFloat(primero.lat), lon: parseFloat(primero.lon) }),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=86400", // un código postal no cambia de sitio
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

  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: "faltan lat/lon (o ?cp=)" }), {
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
