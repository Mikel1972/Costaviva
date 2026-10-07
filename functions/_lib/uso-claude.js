// functions/_lib/uso-claude.js
// Registro del gasto de cada llamada a la API de Claude en la tabla
// public.uso_claude (Mikel1972/comun, estandares/claude-api.md C5). El
// informe diario de `comun` la consulta para saber cuánto gasta cada
// proyecto y en qué.
//
// Reglas (especificación común, idéntica en los 4 proyectos):
//   * NUNCA lanza ni cambia la respuesta del endpoint: si algo falla, una
//     línea de console.warn y nada más.
//   * Si la tabla todavía no existe (el código se despliega antes que la
//     migración supabase/migrations/20261007130000_uso_claude.sql), avisa UNA
//     vez por instancia y deja de intentarlo en esa instancia.
//   * Sin SUPABASE_SERVICE_ROLE_KEY no hace nada (aviso una vez).
//   * Con ctx.waitUntil, la escritura no retrasa la respuesta pero tampoco
//     se pierde al terminar la Function.
//
// _lib no es una ruta (lista blanca de functions/_lib/rutas-publicas.js).

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";

let tablaAusente = false;
let avisoSinClave = false;

function num(v) {
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

function pareceTablaAusente(status, texto) {
  return status === 404 || /42P01|does not exist|PGRST205/.test(texto || "");
}

async function escribir(env, fila) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/uso_claude`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(fila),
    });
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      if (pareceTablaAusente(resp.status, texto)) {
        tablaAusente = true;
        console.warn("uso_claude: la tabla no existe todavía; no se registra el uso en esta instancia");
        return;
      }
      console.warn(`uso_claude: HTTP ${resp.status} al registrar: ${texto.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn(`uso_claude: fallo al registrar: ${String(e)}`);
  }
}

export function registrarUsoClaude(env, ctx, { funcion, modelo, usage, maxTokens, ok = true, codigo = null, userId = null } = {}) {
  try {
    if (tablaAusente) return Promise.resolve();
    if (!env?.SUPABASE_SERVICE_ROLE_KEY) {
      if (!avisoSinClave) {
        avisoSinClave = true;
        console.warn("uso_claude: falta SUPABASE_SERVICE_ROLE_KEY; no se registra el uso");
      }
      return Promise.resolve();
    }
    const u = usage || {};
    const fila = {
      funcion,
      modelo,
      input_tokens: num(u.input_tokens),
      output_tokens: num(u.output_tokens),
      cache_creation_input_tokens: num(u.cache_creation_input_tokens),
      cache_read_input_tokens: num(u.cache_read_input_tokens),
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : null,
      ok: ok !== false,
      codigo: codigo ?? null,
      user_id: userId ?? null,
    };
    const p = escribir(env, fila);
    if (typeof ctx?.waitUntil === "function") {
      ctx.waitUntil(p);
      return Promise.resolve();
    }
    return p;
  } catch (e) {
    console.warn(`uso_claude: fallo al registrar: ${String(e)}`);
    return Promise.resolve();
  }
}

// Solo para tests: reinicia el estado de módulo.
export function _reiniciarUsoClaude() {
  tablaAusente = false;
  avisoSinClave = false;
}
