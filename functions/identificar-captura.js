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

import { registrarUsoClaude } from "./_lib/uso-claude.js";

// Registro del gasto en public.uso_claude (comun, estandares/claude-api.md C5).
const FUNCION_USO = "identificar-captura";

// Modelo (2026-10-08, aprobado por Mikel): Claude Haiku 5.5 en vez de Haiku
// 4.5. Cuesta una décima parte por token (0,10/0,50 USD por millón frente a
// 1/5) y en la evaluación de scripts/eval-identificacion/ acertó al menos
// igual (resultados en CLAUDE.md, sección "Identificación por foto: Haiku
// 5.5 y límites"). AJUSTES_MODELO se exporta porque el script de evaluación
// usa exactamente esta petición para los dos modelos.
//
// Haiku 5.5 piensa por defecto (pensamiento adaptativo, esfuerzo "medium") y
// ese pensamiento cuenta dentro de max_tokens. Para una clasificación corta
// basta con esfuerzo "low" (skill claude-api, migración a Haiku 5.5: se baja
// el esfuerzo, no se desactiva el pensamiento), y max_tokens sube de 300 a
// 1024 para que el pensamiento no deje la respuesta cortada. Sin temperature
// ni prefill: en Haiku 5.5 los dos dan un 400.
export const MODELO = "claude-haiku-5-5";
export const AJUSTES_MODELO = {
  "claude-haiku-5-5": { maxTokens: 1024, esfuerzo: "low" },
  // Solo para la evaluación (el modelo anterior, tal como estaba).
  "claude-haiku-4-5-20251001": { maxTokens: 300, esfuerzo: null },
};
const MAX_TOKENS = AJUSTES_MODELO[MODELO].maxTokens;

// Topes por usuario (comun, estandares/claude-api.md C6). Se cuentan sobre
// public.uso_claude, que ya registra cada llamada con su user_id.
//  * 30 llamadas en 24 h (2026-10-07): corta el abuso de una cuenta que se
//    ponga a mandar fotos en bucle. Cuenta todas las llamadas, también las
//    fallidas.
//  * 100 identificaciones por mes natural, hora de Madrid (2026-10-08,
//    pedido de Mikel). Cuenta solo las que salieron bien (ok = true): una
//    caída del proveedor no le gasta el cupo a nadie. Desde 80 usadas la
//    app avisa de cuántas quedan; al llegar a 100 la captura se sigue
//    guardando a mano.
const LIMITE_DIARIO = 30;
export const LIMITE_MENSUAL = 100;

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

// Degradación cuando la IA no está disponible (añadido 2026-09-25, pedido
// explícito del usuario: "asegúrate que cuando no hay saldo nada se
// rompe"). El 2026-09-24 la cuenta de Anthropic se quedó sin saldo y este
// endpoint devolvía un 502 con el texto CRUDO del proveedor — quien subía
// la foto de su captura veía en pantalla "Your credit balance is too
// low..." junto al request_id interno. Dos problemas en uno: una
// experiencia rota por un motivo que no es asunto suyo, y una fuga de
// detalle interno de infraestructura.
//
// A partir de ahora el fallo se CLASIFICA y nunca se reenvía el cuerpo del
// proveedor al cliente: se devuelve un motivo legible y un `codigo` estable
// para que el frontend (diario.html) y el smoke test puedan distinguir "la
// IA no está disponible ahora mismo" (degradación esperada, se rellena a
// mano) de un fallo real del endpoint. Identificar la foto es una ayuda
// opcional: la captura se guarda igual sin ella, así que esto nunca debe
// presentarse como un error de la app.
// SI APARECE UN SEGUNDO ENDPOINT QUE LLAME A ANTHROPIC, extrae esta función
// a functions/_lib/ antes de copiarla. Pólizas.ai tiene el equivalente
// (clasificarFalloClaude en functions/api/polizas/_claude.js) reutilizado por
// 8 endpoints, y ahí compensa de sobra. Aquí todavía no: con un solo uso, un
// helper compartido sería una indirección sin beneficio.
//
// (El robot de mejores prácticas propuso el 2026-09-25 unificar esto con el
// manejo de errores de crear-checkout-stripe.js. Se revisó y se descartó: no
// son la misma idea. Esto CLASIFICA fallos de servicio en un mensaje para el
// usuario; aquello DETECTA una condición concreta y recuperable —un cliente
// de Stripe que ya no existe— para reintentar. Lo único común es el
// try/JSON.parse del cuerpo de error, cinco líneas. Unirlos habría hecho el
// código más difícil de leer, no menos.)
function clasificarFalloProveedor(status, textoCrudo) {
  let tipo = "", mensajeProveedor = "";
  try {
    const cuerpo = JSON.parse(textoCrudo);
    tipo = cuerpo?.error?.type || "";
    mensajeProveedor = cuerpo?.error?.message || "";
  } catch (e) {
    mensajeProveedor = "";
  }
  const dice = (t) => mensajeProveedor.toLowerCase().includes(t);

  // Saldo agotado. Anthropic lo devuelve como invalid_request_error (400),
  // no como un 402/403, así que hay que reconocerlo por el mensaje — un 400
  // a secas sí sería un fallo nuestro (imagen mal formada, etc.).
  if (dice("credit balance") || dice("billing") || dice("purchase credits")) {
    return { status: 503, codigo: "sin_credito",
      error: "La identificación automática está sin servicio ahora mismo." };
  }
  // Límite de peticiones o modelo saturado: temporal, se reintenta luego.
  if (status === 429 || status === 529 || tipo === "overloaded_error" || tipo === "rate_limit_error") {
    return { status: 503, codigo: "saturado",
      error: "La identificación automática está saturada ahora mismo; inténtalo en unos minutos." };
  }
  return { status: 502, codigo: "fallo_proveedor",
    error: "La identificación automática ha fallado." };
}

// Llamadas de este usuario a este endpoint desde `desde` (ISO), o null si
// no se puede saber (sin service_role, tabla sin crear, red). Con null se
// deja pasar y se avisa en el log: los topes son un freno de coste, no
// pueden tumbar la identificación de todos si falla el contador. `userId`
// sale del JWT verificado por Supabase y aun así se codifica (supabase.md
// D14).
async function contarUsos(env, userId, desde, { soloOk = false } = {}) {
  if (!userId || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/uso_claude?select=id&funcion=eq.${FUNCION_USO}` +
        `&user_id=eq.${encodeURIComponent(userId)}&creado_en=gte.${encodeURIComponent(desde)}` +
        (soloOk ? "&ok=eq.true" : ""),
      {
        method: "HEAD",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "count=exact",
        },
      }
    );
    if (!resp.ok) return null;
    const total = Number(resp.headers.get("content-range")?.split("/")?.[1]);
    return Number.isFinite(total) ? total : null;
  } catch (e) {
    return null;
  }
}

// Partes de fecha/hora de `fecha` en hora de Madrid.
function partesMadrid(fecha) {
  const p = {};
  for (const { type, value } of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(fecha)) p[type] = Number(value);
  return p;
}

// Instante (Date) en que empezó el mes natural en curso en Madrid: el día 1
// a las 00:00 hora de Madrid (CET o CEST según la fecha). Exportada para el
// test.
export function inicioMesMadrid(ahora = new Date()) {
  const { year, month } = partesMadrid(ahora);
  // Primera aproximación: medianoche UTC del día 1; se corrige con el
  // desfase que tenga Madrid en ese momento (1 o 2 horas).
  const aprox = Date.UTC(year, month - 1, 1);
  const m = partesMadrid(new Date(aprox));
  const desfase = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second) - aprox;
  return new Date(aprox - desfase);
}

// Mismo criterio de acceso que el paywall de la app: se llama a la propia
// mi_estado_suscripcion() con el token del usuario (no con service_role),
// así que el bypass del admin, los accesos permanentes, los 7 días de
// prueba y las suscripciones trialing/active son exactamente los mismos y
// no hay una segunda copia de la regla que pueda divergir. Devuelve true,
// false, o null si no se pudo saber (red, RPC caída): con null se deja
// pasar, igual que hace diario.html, y quedan los topes como freno.
async function tieneAcceso(token) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mi_estado_suscripcion`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (!resp.ok) return null;
    const estado = await resp.json();
    if (estado?.con_acceso === true) return true;
    if (estado?.con_acceso === false) return false;
    return null;
  } catch (e) {
    return null;
  }
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

export const PROMPT_IDENTIFICACION = `Eres un asistente de pesca recreativa en España. Te doy una foto de un pez recién pescado.

Identifica, si puedes:
- "especie": el nombre común en español más probable (ej. "Lubina", "Sargo", "Congrio", "Calamar / chipirón"). Si no estás razonablemente seguro de la especie, pon "" (cadena vacía) — no adivines al azar.
- "talla_cm": longitud aproximada en centímetros, SOLO si en la foto hay algo que sirva de referencia real de escala (una mano, un aparejo o cebo de tamaño reconocible, el suelo con baldosas, etc.). Si no hay ninguna referencia de escala fiable en la imagen, pon null — nunca inventes un número de talla sin base real en la foto.
- "peso_g": peso aproximado en gramos, estimado a partir de la especie y la talla — pon null si talla_cm es null o la especie es incierta.
- "confianza": "alta", "media" o "baja", tu propia confianza en el conjunto de la estimación.

Responde ÚNICAMENTE con el JSON, sin texto antes ni después:
{"especie": "...", "talla_cm": ..., "peso_g": ..., "confianza": "..."}`;

// Cuerpo de la petición a la API de mensajes. Lo usan este endpoint y el
// script de evaluación (scripts/eval-identificacion/evaluar.mjs), para que
// la comparación entre modelos sea con la petición real.
export function cuerpoPeticion({ imagenBase64, tipoMime, modelo = MODELO }) {
  const ajustes = AJUSTES_MODELO[modelo];
  if (!ajustes) throw new Error(`modelo sin ajustes: ${modelo}`);
  const cuerpo = {
    model: modelo,
    max_tokens: ajustes.maxTokens,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipoMime || "image/jpeg", data: imagenBase64 } },
          { type: "text", text: PROMPT_IDENTIFICACION },
        ],
      },
    ],
  };
  // effort no existe en Haiku 4.5 (daría error); en Haiku 5.5 es el mando
  // del pensamiento.
  if (ajustes.esfuerzo) cuerpo.output_config = { effort: ajustes.esfuerzo };
  return cuerpo;
}

// Interpreta una respuesta 200 de la API. stop_reason primero (comun
// claude-api.md C4): "max_tokens" = JSON incompleto, "refusal" = el filtro
// de seguridad de Haiku 5.5 rechazó la petición (HTTP 200 con el contenido
// vacío o parcial; Haiku 5.5 no tiene fallback en servidor). En los dos
// casos el contenido no vale. Si no, el texto se lee de los bloques de tipo
// "text": con pensamiento adaptativo la respuesta puede empezar por bloques
// "thinking", así que content[0] ya no es necesariamente la respuesta.
export function interpretarRespuesta(datos) {
  if (datos?.stop_reason === "max_tokens") return { codigo: "respuesta_cortada" };
  if (datos?.stop_reason === "refusal") return { codigo: "rechazada" };
  const texto = (datos?.content || [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
  const match = texto.match(/\{[\s\S]*\}/);
  let r = {};
  try {
    r = match ? JSON.parse(match[0]) : {};
  } catch (e) {
    return { codigo: "respuesta_invalida" };
  }
  return {
    resultado: {
      especie: typeof r.especie === "string" && r.especie.trim() ? r.especie.trim() : null,
      talla_cm: typeof r.talla_cm === "number" ? r.talla_cm : null,
      peso_g: typeof r.peso_g === "number" ? r.peso_g : null,
      confianza: r.confianza || null,
    },
  };
}

export async function onRequestPost(context) {
  const auth = context.request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "falta la sesión" });
  const token = auth.slice(7);

  const verifResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!verifResp.ok) return json(401, { error: "sesión no válida" });
  // Para atribuir el gasto de Claude al usuario y contar sus topes; si no se
  // puede leer, se registra sin user_id (nunca cambia la respuesta).
  let userId = null;
  try {
    userId = (await verifResp.json())?.id || null;
  } catch (e) {
    userId = null;
  }

  if (!context.env.ANTHROPIC_API_KEY) {
    // 503 + codigo, no 500: para quien usa la app es exactamente el mismo
    // caso que el saldo agotado (la ayuda no está, la captura se guarda a
    // mano igual), y el smoke test lo trata igual.
    console.error("identificar-captura: falta ANTHROPIC_API_KEY en el entorno");
    return json(503, { codigo: "sin_configurar", disponible: false,
      error: "La identificación automática no está configurada." });
  }

  const [acceso, usosDia, usosMes] = await Promise.all([
    tieneAcceso(token),
    contarUsos(context.env, userId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    contarUsos(context.env, userId, inicioMesMadrid().toISOString(), { soloOk: true }),
  ]);

  // Sin suscripción activa (ni prueba, ni admin, ni acceso permanente): la
  // app ya le manda a suscripcion.html, pero el endpoint no puede fiarse de
  // eso — es quien gasta.
  if (acceso === false) {
    return json(403, { codigo: "sin_suscripcion", disponible: false,
      error: "La identificación automática es parte de la suscripción." });
  }
  if (acceso === null) console.warn("identificar-captura: no se pudo comprobar la suscripción; se deja pasar");

  if (usosDia === null) {
    console.warn("identificar-captura: no se pudo contar el uso diario; se deja pasar");
  } else if (usosDia >= LIMITE_DIARIO) {
    return json(429, { codigo: "limite_diario", disponible: false,
      error: "Has llegado al límite diario de identificaciones automáticas." });
  }
  if (usosMes === null) {
    console.warn("identificar-captura: no se pudo contar el uso del mes; se deja pasar");
  } else if (usosMes >= LIMITE_MENSUAL) {
    return json(429, { codigo: "limite_mensual", disponible: false,
      limite_mes: LIMITE_MENSUAL, restantes_mes: 0,
      error: `Has usado las ${LIMITE_MENSUAL} identificaciones automáticas de este mes.` });
  }

  let cuerpo;
  try {
    cuerpo = await context.request.json();
  } catch (e) {
    return json(400, { error: "cuerpo inválido" });
  }
  const { imagenBase64, tipoMime } = cuerpo;
  if (!imagenBase64) return json(400, { error: "falta la imagen" });

  let usoRegistrado = false;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": context.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpoPeticion({ imagenBase64, tipoMime })),
    });
    if (!resp.ok) {
      const textoCrudo = await resp.text();
      // El cuerpo del proveedor se queda SOLO en el log del Worker (para
      // poder diagnosticar), nunca viaja al cliente.
      console.error(`identificar-captura: Anthropic HTTP ${resp.status}: ${textoCrudo}`);
      const c = clasificarFalloProveedor(resp.status, textoCrudo);
      usoRegistrado = true;
      await registrarUsoClaude(context.env, context, {
        funcion: FUNCION_USO, modelo: MODELO, usage: null, maxTokens: MAX_TOKENS,
        ok: false, codigo: c.codigo, userId,
      });
      return json(c.status, { codigo: c.codigo, disponible: false, error: c.error });
    }
    const datos = await resp.json();
    const interpretado = interpretarRespuesta(datos);
    usoRegistrado = true;
    await registrarUsoClaude(context.env, context, {
      funcion: FUNCION_USO, modelo: datos?.model || MODELO, usage: datos?.usage,
      maxTokens: MAX_TOKENS, userId,
      ...(interpretado.codigo ? { ok: false, codigo: interpretado.codigo } : {}),
    });
    if (interpretado.codigo === "respuesta_cortada") {
      console.error(`identificar-captura: respuesta cortada por max_tokens (${MAX_TOKENS})`);
      return json(502, { codigo: "respuesta_cortada", disponible: false,
        error: "La identificación automática ha fallado." });
    }
    if (interpretado.codigo === "rechazada") {
      // Rechazo del filtro de seguridad: no es un fallo de la app ni se
      // reintenta (C8); se dice en tono neutro y se rellena a mano.
      console.warn(`identificar-captura: rechazada (${datos?.stop_details?.category ?? "sin categoría"})`);
      return json(422, { codigo: "rechazada", disponible: false,
        error: "No se ha podido analizar esta foto." });
    }
    if (interpretado.codigo) {
      // respuesta_invalida: JSON mal formado. Queda en uso_claude con su
      // nombre; al cliente, el fallo genérico de siempre.
      return json(502, { codigo: "fallo_proveedor", disponible: false,
        error: "La identificación automática ha fallado." });
    }

    return json(200, {
      ...interpretado.resultado,
      limite_mes: LIMITE_MENSUAL,
      // Contando la de ahora (aún no está en uso_claude: se escribe con
      // waitUntil). null si no se pudo contar.
      restantes_mes: usosMes === null ? null : Math.max(0, LIMITE_MENSUAL - usosMes - 1),
    });
  } catch (e) {
    // Fallo de red/parseo por nuestro lado: mismo criterio, el detalle al
    // log y al cliente solo algo que pueda leer sin alarmarse.
    console.error(`identificar-captura: fallo inesperado: ${String(e)}`);
    if (!usoRegistrado) {
      await registrarUsoClaude(context.env, context, {
        funcion: FUNCION_USO, modelo: MODELO, usage: null, maxTokens: MAX_TOKENS,
        ok: false, codigo: "fallo_proveedor", userId,
      });
    }
    return json(502, { codigo: "fallo_proveedor", disponible: false,
      error: "La identificación automática ha fallado." });
  }
}
