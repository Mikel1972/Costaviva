// functions/identificar-captura.js
// Identifica especie/talla/peso aproximados a partir de una foto de una
// captura, usando la API de Anthropic (Claude, con visión). Pedido
// explícito del usuario: al añadir una captura, poder sacar/elegir una
// foto y que rellene especie/talla/peso en vez de escribirlo a mano.
//
// Requiere sesión real (igual que sos-alerta.js: el token del que
// llama, nunca service_role) — analizar una foto tiene coste real en la
// API de Anthropic, así que este endpoint no puede quedar abierto a
// cualquiera sin cuenta.
//
// Talla y peso son SIEMPRE una estimación, nunca un dato medido — el
// modelo solo debe dar una talla si hay algo en la foto que sirva de
// referencia de escala (una mano, un aparejo de tamaño conocido...); si
// no la hay, debe devolver null en vez de inventar un número con
// aspecto fiable (mismo principio de "nunca inventar" de todo el
// proyecto). El cliente muestra esto siempre como editable, nunca como
// un dato ya confirmado.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const auth = context.request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "falta la sesión" });
  const token = auth.slice(7);

  const verifResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!verifResp.ok) return json(401, { error: "sesión no válida" });

  if (!context.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "función no configurada todavía (falta ANTHROPIC_API_KEY)" });
  }

  let cuerpo;
  try {
    cuerpo = await context.request.json();
  } catch (e) {
    return json(400, { error: "cuerpo inválido" });
  }
  const { imagenBase64, tipoMime } = cuerpo;
  if (!imagenBase64) return json(400, { error: "falta la imagen" });

  const prompt = `Eres un asistente de pesca recreativa en España. Te doy una foto de un pez recién pescado.

Identifica, si puedes:
- "especie": el nombre común en español más probable (ej. "Lubina", "Sargo", "Congrio", "Calamar / chipirón"). Si no estás razonablemente seguro de la especie, pon "" (cadena vacía) — no adivines al azar.
- "talla_cm": longitud aproximada en centímetros, SOLO si en la foto hay algo que sirva de referencia real de escala (una mano, un aparejo o cebo de tamaño reconocible, el suelo con baldosas, etc.). Si no hay ninguna referencia de escala fiable en la imagen, pon null — nunca inventes un número de talla sin base real en la foto.
- "peso_g": peso aproximado en gramos, estimado a partir de la especie y la talla — pon null si talla_cm es null o la especie es incierta.
- "confianza": "alta", "media" o "baja", tu propia confianza en el conjunto de la estimación.

Responde ÚNICAMENTE con el JSON, sin texto antes ni después:
{"especie": "...", "talla_cm": ..., "peso_g": ..., "confianza": "..."}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": context.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: tipoMime || "image/jpeg", data: imagenBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Anthropic HTTP ${resp.status}: ${await resp.text()}`);
    const datos = await resp.json();
    const textoRespuesta = datos.content?.[0]?.text || "{}";
    const match = textoRespuesta.match(/\{[\s\S]*\}/);
    const resultado = match ? JSON.parse(match[0]) : {};

    return json(200, {
      especie: typeof resultado.especie === "string" && resultado.especie.trim() ? resultado.especie.trim() : null,
      talla_cm: typeof resultado.talla_cm === "number" ? resultado.talla_cm : null,
      peso_g: typeof resultado.peso_g === "number" ? resultado.peso_g : null,
      confianza: resultado.confianza || null,
    });
  } catch (e) {
    return json(502, { error: String(e) });
  }
}
