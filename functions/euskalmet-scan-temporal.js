// functions/euskalmet-scan-temporal.js
// TEMPORAL — solo para localizar a mano las estaciones reales de Euskalmet
// más cercanas a las cabeceras/tramos medios de los ríos vascos, antes de
// escribir la versión final. Se borra en cuanto termine este descubrimiento
// (no debe quedar en main). Vive fuera de /prevision a propósito: así tiene
// el límite de 50 subpeticiones de Cloudflare solo para esto, sin competir
// con lo que ya hace /prevision en la misma invocación.
const EUSKALMET_BASE = "https://api.euskadi.eus";
const EUSKALMET_EMAIL = "cot2038@gmail.com";
const EUSKALMET_ISS = "Costaviva";

function base64UrlDesdeBytes(bytes) {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDesdeTexto(texto) {
  return base64UrlDesdeBytes(new TextEncoder().encode(texto));
}
function pemADer(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}
async function firmarJwt(privateKeyPem) {
  const header = { alg: "RS256", typ: "JWT" };
  const ahoraS = Math.floor(Date.now() / 1000);
  const payload = { aud: "met01.apikey", iss: EUSKALMET_ISS, exp: ahoraS + 300, iat: ahoraS, version: "1.0.0", email: EUSKALMET_EMAIL };
  const entrada = `${base64UrlDesdeTexto(JSON.stringify(header))}.${base64UrlDesdeTexto(JSON.stringify(payload))}`;
  const clave = await crypto.subtle.importKey("pkcs8", pemADer(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(entrada));
  return `${entrada}.${base64UrlDesdeBytes(new Uint8Array(firma))}`;
}
async function eGet(endpoint, jwt) {
  const resp = await fetch(`${EUSKALMET_BASE}${endpoint}`, { headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function onRequestGet(context) {
  const key = context.env.EUSKALMET_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: "Falta EUSKALMET_API_KEY" }), { headers: { "content-type": "application/json" } });

  const params = new URL(context.request.url).searchParams;
  const offset = Number(params.get("offset") || 0);
  const limit = Number(params.get("limit") || 45);
  const sensoresPedidos = params.get("sensores");

  try {
    const jwt = await firmarJwt(key);

    if (sensoresPedidos) {
      const ids = sensoresPedidos.split(",");
      const info = await Promise.all(
        ids.map((id) =>
          eGet(`/euskalmet/sensors/${id}`, jwt)
            .then((d) => ({ id, meteors: d.meteors }))
            .catch((e) => ({ id, error: String(e) }))
        )
      );
      return new Response(JSON.stringify(info, null, 2), { headers: { "content-type": "application/json" } });
    }

    const estaciones = await eGet("/euskalmet/stations", jwt);
    const idsUnicos = [...new Set(estaciones.map((e) => e.stationId))];
    const tanda = idsUnicos.slice(offset, offset + limit);
    const actuales = await Promise.all(
      tanda.map((id) =>
        eGet(`/euskalmet/stations/${id}/current`, jwt)
          .then((d) => ({
            id,
            tipo: d.stationType,
            nombre: d.name?.SPANISH,
            municipio: d.municipality?.SPANISH,
            lat: d.position?.position?.GOOGLE?.y,
            lon: d.position?.position?.GOOGLE?.x,
            sensores: (d.sensors || []).map((s) => s.sensorKey.replace("euskalmet/sensors/", "")),
          }))
          .catch((e) => ({ id, error: String(e) }))
      )
    );
    return new Response(JSON.stringify({ idsUnicos: idsUnicos.length, offset, tanda: actuales }, null, 2), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: { "content-type": "application/json" } });
  }
}
