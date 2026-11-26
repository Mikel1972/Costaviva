// functions/precios-zona.js
// GET /precios-zona: precios de Premium para el país de quien pregunta
// (2026-10-11). Sin sesión y sin datos personales: solo la tabla pública de
// precios de una zona (functions/_lib/precios-zonas.json), para la página de
// precios.
//
// País de residencia (2026-11-25, CLAUDE.md "País de residencia obligatorio
// antes de pagar"): con ?pais=XX (el que elige la persona en el selector) la
// tabla es la de la zona de ese país; sin él, la del país de la conexión
// (request.cf.country), que también se devuelve como pais_ip para rellenar
// el selector. El checkout cobra por el país de residencia declarado.
import { zonaDePais, tablaZona, cobroActivo } from "./_lib/precios.js";
import { bizumDisponible } from "./_lib/bizum.js";
import { paisResidenciaValido } from "./_lib/pais-residencia.js";
import { REGIONES_ACTIVAS } from "./_lib/regiones-activas.js";
import CONFIG_PRECIOS from "./_lib/precios-zonas.json";

export async function onRequestGet({ request, env }) {
  const paisIp = String(request.cf?.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
  const pedido = paisResidenciaValido(new URL(request.url).searchParams.get("pais") || "");
  // País para la zona: el elegido o, si no, el de la conexión.
  const pais = pedido || paisResidenciaValido(paisIp) || "";
  const zona = zonaDePais(CONFIG_PRECIOS, pais);
  const tabla = tablaZona(CONFIG_PRECIOS, zona.id);
  return new Response(JSON.stringify({
    pais: pais || null,
    // Para rellenar el selector de país de residencia (solo el código).
    pais_ip: paisResidenciaValido(paisIp),
    ...tabla,
    regiones_mundial: [...REGIONES_ACTIVAS],
    plazas_fundador_total: CONFIG_PRECIOS.plazas_fundador,
    // Interruptor COBRO_ACTIVO: sin él, la página dice "Próximamente".
    cobro_activo: cobroActivo(env),
    // Interruptor BIZUM_ACTIVO (2026-11-25): botón "Pagar 1 año con Bizum"
    // solo con él encendido, el cobro abierto y residencia en España.
    bizum_activo: bizumDisponible(env, pais, cobroActivo(env)),
  }), {
    headers: { "content-type": "application/json", "cache-control": "private, max-age=300", vary: "CF-IPCountry" },
  });
}
