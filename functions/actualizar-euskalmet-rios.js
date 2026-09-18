// functions/actualizar-euskalmet-rios.js
// Corrido una vez al día por .github/workflows/euskalmet-rios.yml (decisión
// explícita del usuario, 2026-09-18: "con dar la medida una vez al día es
// más que suficiente"). Firma el JWT y llama a la API real de Euskalmet
// (única función de este repo que lo hace — a diferencia de turbidez/
// cámaras, esto SÍ puede vivir en una Cloudflare Pages Function porque no
// hace falta decodificar ninguna imagen, solo JSON) y guarda el resultado
// en `euskalmet_rios`. Protegido con el mismo secreto compartido que
// registrar-presion.js / registrar-turbidez.js / registrar-estado-camaras.js
// (cabecera X-Cron-Secret, variable de entorno CRON_SECRET).
//
// Las 13 estaciones/sensores de abajo se localizaron a mano (ver rama
// feat/euskalmet-rios): para cada cabecera/tramo medio de los 6 ríos
// vascos sin caudal real, se pidió la lista completa de estaciones de
// Euskalmet (154, todas con coordenadas reales) y se escogió la más
// cercana que de verdad tuviera un sensor de precipitación
// (measuresForWater/precipitation, prefijo "G4" en el id del sensor) —
// todas quedaron a menos de 6 km del punto real. Para presión
// (measuresForAtmosphere/pressure, prefijo "S0") solo hay 10 estaciones
// en todo el catálogo — se usó la más cercana aunque esté a 5-35 km,
// porque la presión atmosférica varía mucho más suave en el espacio que
// la lluvia (un frente de presión cubre decenas de km; un chubasco
// puede ser muy local) — no sería razonable hacer lo mismo con lluvia a
// esa distancia, con presión sí. Nada de esto es una lista oficial de
// Euskalmet, es nuestra propia elección basada en distancia real.
//
// Corrección real tras el primer run (2026-09-18): Deusto (C039/S009,
// la más cercana para Lea/Oka/Nervión) devolvía siempre
// ENTITY_NOT_FOUND para su sensor de presión — dado de baja en el
// catálogo real aunque siga apareciendo en los metadatos de la estación
// (misma situación con Derio/G4R2 para precipitación). Sustituidas por
// Zorrotza (presión) y Mungia (precipitación), ambas confirmadas con
// datos reales en ese mismo run. Si vuelve a pasar con otra estación,
// comprobarlo así: pedir /euskalmet/readings/... para varias horas
// seguidas — un 404 sistemático en todas es un sensor muerto, no un
// hueco de datos puntual.
// temp/viento (2026-09-18, pedido explícito del usuario): sacados SIEMPRE
// de la misma estación de precipitación de cada punto (nunca de la de
// presión, más lejana) — el viento en superficie cambia mucho más por el
// relieve local que la presión, así que solo tiene sentido si es la
// estación realmente cercana. "viento" se omite cuando esa estación no
// tenía sensor de viento real (verificado uno a uno, no asumido por el
// prefijo del id).
const OBJETIVOS = [
  { rio: "Lea", punto: "Cabecera (Munitibar)",
    precip: { id: "C0BD", nombre: "Iruzubieta (Ziortza-Bolibar)", sensor: "G458" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0SI" },
  { rio: "Lea", punto: "Medio (Amoroto)",
    precip: { id: "C0BA", nombre: "Oleta (Amoroto)", sensor: "G418" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0CX" },
  { rio: "Oka", punto: "Cabecera (Muxika)",
    precip: { id: "C063", nombre: "Muxika", sensor: "G4R7" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0BT" },
  { rio: "Oka", punto: "Medio (Gernika-Lumo)",
    precip: { id: "C063", nombre: "Muxika", sensor: "G4R7" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0BT" },
  { rio: "Estepona (Zarraga)", punto: "Cabecera (Meñaka)",
    precip: { id: "C069", nombre: "Almike (Bermeo)", sensor: "G4AR" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R014", viento: "Y033" },
  { rio: "Estepona (Zarraga)", punto: "Medio (Bakio urbano)",
    precip: { id: "C019", nombre: "Matxitxako (Bermeo)", sensor: "G455" },
    presion: { id: "C042", nombre: "Punta Galea (Getxo)", sensor: "S0AC" },
    temp: "R0FM", viento: "Y0BT" },
  { rio: "Butroe", punto: "Cabecera (Fruiz)",
    // Derio (C003/G4R2) descartada tras el primer run real: su sensor de
    // precipitación devuelve ENTITY_NOT_FOUND en todas las horas
    // probadas (sensor dado de baja en el catálogo, aunque siga listado
    // en los metadatos de la estación) — se reutiliza Mungia, la misma
    // estación ya usada para el tramo medio de este río, confirmada con
    // datos reales en ese mismo run.
    precip: { id: "C057", nombre: "Mungia", sensor: "G4D0" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0GF", viento: "Y011" },
  { rio: "Butroe", punto: "Medio (Gatika)",
    precip: { id: "C057", nombre: "Mungia", sensor: "G4D0" },
    presion: { id: "C042", nombre: "Punta Galea (Getxo)", sensor: "S0AC" },
    temp: "R0GF", viento: "Y011" },
  { rio: "Arroyo Sopelana", punto: "Cabecera (pinar)",
    precip: { id: "C0B8", nombre: "Larrainazubi (Getxo)", sensor: "G4DB" },
    presion: { id: "C042", nombre: "Punta Galea (Getxo)", sensor: "S0AC" },
    temp: "R0HJ" },
  { rio: "Arroyo Sopelana", punto: "Medio (canalizado)",
    precip: { id: "C0B8", nombre: "Larrainazubi (Getxo)", sensor: "G4DB" },
    presion: { id: "C042", nombre: "Punta Galea (Getxo)", sensor: "S0AC" },
    temp: "R0HJ" },
  { rio: "Nervión", punto: "Cabecera (Orduña)",
    precip: { id: "C067", nombre: "Gardea (Laudio/Llodio)", sensor: "G4R8" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0W1", viento: "Y0DR" },
  { rio: "Nervión", punto: "Medio (Bilbao)",
    precip: { id: "C0B1", nombre: "Abusu (Arrigorriaga)", sensor: "G4AI" },
    presion: { id: "C03A", nombre: "Zorrotza (Bilbao)", sensor: "S0AG" },
    temp: "R0FP" },
];

const EUSKALMET_BASE = "https://api.euskadi.eus";
// Cuenta real asociada a la clave privada actual — no es datos@costaviva.org
// (ese alta nunca llegó a completarse: Cloudflare Email Routing descarta
// cualquier correo que no pase SPF/DKIM, y opendata.euskadi.eus no los
// tiene bien configurados). Si se renueva la clave con otra cuenta, hay
// que actualizar esto también.
const EUSKALMET_EMAIL = "cot2038@gmail.com";
const EUSKALMET_ISS = "Costaviva";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

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
// Un solo JWT firmado por ejecución, reutilizado en todas las llamadas —
// firmar de más cuesta CPU real (RSA-sign con Web Crypto agotó el límite
// de recursos de un Worker al firmar una vez por estación durante las
// pruebas de esta integración).
async function firmarJwtEuskalmet(privateKeyPem) {
  const header = { alg: "RS256", typ: "JWT" };
  const ahoraS = Math.floor(Date.now() / 1000);
  const payload = { aud: "met01.apikey", iss: EUSKALMET_ISS, exp: ahoraS + 300, iat: ahoraS, version: "1.0.0", email: EUSKALMET_EMAIL };
  const entrada = `${base64UrlDesdeTexto(JSON.stringify(header))}.${base64UrlDesdeTexto(JSON.stringify(payload))}`;
  const clave = await crypto.subtle.importKey("pkcs8", pemADer(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(entrada));
  return `${entrada}.${base64UrlDesdeBytes(new Uint8Array(firma))}`;
}
async function euskalmetGet(endpoint, jwt) {
  const resp = await fetch(`${EUSKALMET_BASE}${endpoint}`, { headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Euskalmet HTTP ${resp.status} (${endpoint})`);
  return resp.json();
}

// El parámetro de hora del endpoint de lecturas es HORA UTC (verificado en
// real: con la hora local de Madrid la hora "actual" devolvía 404 por
// estar en el futuro respecto al reloj de la API) — nada de convertir a
// Europe/Madrid aquí, a diferencia del resto de fechas de este repo.
async function ultimaLecturaValida(stationId, sensorId, measureType, measureId, jwt) {
  const ahora = new Date();
  for (let horasAtras = 0; horasAtras <= 2; horasAtras++) {
    const fecha = new Date(ahora.getTime() - horasAtras * 3600 * 1000);
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    const h = String(fecha.getUTCHours()).padStart(2, "0");
    try {
      const data = await euskalmetGet(
        `/euskalmet/readings/forStation/${stationId}/${sensorId}/measures/${measureType}/${measureId}/at/${y}/${m}/${d}/${h}`,
        jwt
      );
      const valores = (data.values || []).filter((v) => v != null);
      if (valores.length) return { valores, horasAtras };
    } catch (e) {
      // Sin datos para esa hora (404 típico de la hora en curso, aún sin
      // ninguna lectura) — se prueba con la hora anterior.
    }
  }
  return null;
}

export async function onRequestPost(context) {
  const secretoEsperado = context.env.CRON_SECRET;
  const secretoRecibido = context.request.headers.get("X-Cron-Secret");
  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const privateKeyPem = context.env.EUSKALMET_API_KEY;
  if (!privateKeyPem) {
    return new Response(JSON.stringify({ error: "Falta EUSKALMET_API_KEY" }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const jwt = await firmarJwtEuskalmet(privateKeyPem);
  const ahora = new Date().toISOString();

  const filas = await Promise.all(
    OBJETIVOS.map(async (obj) => {
      const [precipLectura, presionLectura, tempLectura, humedadLectura, vientoVelLectura, vientoDirLectura] = await Promise.all([
        ultimaLecturaValida(obj.precip.id, obj.precip.sensor, "measuresForWater", "precipitation", jwt).catch(() => null),
        ultimaLecturaValida(obj.presion.id, obj.presion.sensor, "measuresForAtmosphere", "pressure", jwt).catch(() => null),
        obj.temp ? ultimaLecturaValida(obj.precip.id, obj.temp, "measuresForAir", "temperature", jwt).catch(() => null) : null,
        obj.temp ? ultimaLecturaValida(obj.precip.id, obj.temp, "measuresForAir", "humidity", jwt).catch(() => null) : null,
        obj.viento ? ultimaLecturaValida(obj.precip.id, obj.viento, "measuresForWind", "mean_speed", jwt).catch(() => null) : null,
        obj.viento ? ultimaLecturaValida(obj.precip.id, obj.viento, "measuresForWind", "mean_direction", jwt).catch(() => null) : null,
      ]);
      const ultimo = (lectura) => (lectura ? lectura.valores[lectura.valores.length - 1] : null);
      return {
        rio: obj.rio,
        punto: obj.punto,
        estacion_precip_id: obj.precip.id,
        estacion_precip_nombre: obj.precip.nombre,
        // Suma de la última hora con datos reales — un total de mm caído
        // en esa hora, no una única muestra de 10 min.
        precipitacion_mm: precipLectura ? Math.round(precipLectura.valores.reduce((a, b) => a + b, 0) * 10) / 10 : null,
        estacion_presion_id: obj.presion.id,
        estacion_presion_nombre: obj.presion.nombre,
        // Resto de magnitudes: último valor real disponible, no tiene
        // sentido sumar presión/temperatura/viento como sí con la lluvia.
        presion_hpa: ultimo(presionLectura),
        temperatura_c: ultimo(tempLectura),
        humedad_pct: ultimo(humedadLectura),
        // La API devuelve la velocidad en m/s (verificado en real: valores
        // de 0.5-2 en una mañana tranquila de costa) — se convierte a
        // km/h (×3.6) para ser consistente con el resto de la app
        // (Open-Meteo ya se pide en windspeed_unit=kmh).
        viento_vel_kmh: ultimo(vientoVelLectura) != null ? Math.round(ultimo(vientoVelLectura) * 3.6 * 10) / 10 : null,
        viento_dir_grados: ultimo(vientoDirLectura),
        actualizado_en: ahora,
      };
    })
  );

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/euskalmet_rios?on_conflict=rio,punto`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(filas),
  });
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Supabase upsert HTTP ${resp.status}: ${await resp.text()}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, filas }, null, 2), { headers: { "content-type": "application/json" } });
}
