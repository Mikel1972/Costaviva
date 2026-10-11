// functions/precios-zona.js
// GET /precios-zona: precios de Premium para el país de quien pregunta
// (2026-10-11). Sin sesión y sin datos personales: solo la tabla pública de
// precios de su zona (functions/_lib/precios-zonas.json), para la página de
// precios. El país sale de Cloudflare (request.cf.country); el precio final
// lo confirma el checkout de Stripe con el país de facturación.
import { zonaDePais, tablaZona } from "./_lib/precios.js";
import { REGIONES_ACTIVAS } from "./_lib/regiones-activas.js";
import CONFIG_PRECIOS from "./_lib/precios-zonas.json";

export async function onRequestGet({ request }) {
  const pais = String(request.cf?.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
  const zona = zonaDePais(CONFIG_PRECIOS, pais);
  const tabla = tablaZona(CONFIG_PRECIOS, zona.id);
  return new Response(JSON.stringify({
    pais: pais || null,
    ...tabla,
    regiones_mundial: [...REGIONES_ACTIVAS],
    plazas_fundador_total: CONFIG_PRECIOS.plazas_fundador,
  }), {
    headers: { "content-type": "application/json", "cache-control": "private, max-age=300", vary: "CF-IPCountry" },
  });
}
