// Registro del gasto de Claude (functions/_lib/uso-claude.js, 2026-10-07) y
// su uso en functions/identificar-captura.js. Fetch simulado: no sale nada
// a la red.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registrarUsoClaude, _reiniciarUsoClaude } from "../functions/_lib/uso-claude.js";
import { onRequestPost } from "../functions/identificar-captura.js";

const ENV = { SUPABASE_SERVICE_ROLE_KEY: "sr", ANTHROPIC_API_KEY: "ak" };
const USAGE = { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 5 };

let avisos;
beforeEach(() => {
  _reiniciarUsoClaude();
  avisos = [];
  console.warn = (m) => avisos.push(String(m));
  console.error = () => {};
});

function simularSupabase(respuesta = () => new Response(null, { status: 201 })) {
  const llamadas = [];
  globalThis.fetch = async (url, opt = {}) => {
    llamadas.push({ url: String(url), opt });
    return respuesta();
  };
  return llamadas;
}

test("helper: escribe la fila con service_role y return=minimal", async () => {
  const llamadas = simularSupabase();
  await registrarUsoClaude(ENV, null, { funcion: "f", modelo: "m", usage: USAGE, maxTokens: 300, userId: "u1" });
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].url, /\/rest\/v1\/uso_claude$/);
  const h = llamadas[0].opt.headers;
  assert.equal(h.apikey, "sr");
  assert.equal(h.Authorization, "Bearer sr");
  assert.equal(h.Prefer, "return=minimal");
  assert.deepEqual(JSON.parse(llamadas[0].opt.body), {
    funcion: "f", modelo: "m", input_tokens: 120, output_tokens: 40,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 5,
    max_tokens: 300, ok: true, codigo: null, user_id: "u1",
  });
});

test("helper: tabla inexistente avisa una vez y deja de intentarlo", async () => {
  const llamadas = simularSupabase(() => new Response('{"code":"PGRST205"}', { status: 404 }));
  await registrarUsoClaude(ENV, null, { funcion: "f", modelo: "m" });
  await registrarUsoClaude(ENV, null, { funcion: "f", modelo: "m" });
  assert.equal(llamadas.length, 1);
  assert.equal(avisos.length, 1);
});

test("helper: sin clave no llama y avisa una sola vez", async () => {
  const llamadas = simularSupabase();
  await registrarUsoClaude({}, null, { funcion: "f", modelo: "m" });
  await registrarUsoClaude({}, null, { funcion: "f", modelo: "m" });
  assert.equal(llamadas.length, 0);
  assert.equal(avisos.length, 1);
});

test("helper: usa ctx.waitUntil si existe y nunca lanza", async () => {
  simularSupabase(() => { throw new Error("red caída"); });
  const pendientes = [];
  await registrarUsoClaude(ENV, { waitUntil: (p) => pendientes.push(p) }, { funcion: "f", modelo: "m" });
  assert.equal(pendientes.length, 1);
  await pendientes[0];
  assert.equal(avisos.length, 1);
});

function contexto(env = ENV) {
  const pendientes = [];
  return {
    pendientes,
    ctx: {
      request: new Request("https://costaviva.org/identificar-captura", {
        method: "POST",
        headers: { Authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({ imagenBase64: "AAAA", tipoMime: "image/jpeg" }),
      }),
      env,
      waitUntil: (p) => pendientes.push(p),
    },
  };
}

function simularTodo(anthropic, usosHoy = 0) {
  const filas = [];
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
    if (url.includes("/rest/v1/uso_claude?") && opt.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-range": `*/${usosHoy}` } });
    }
    if (url.includes("api.anthropic.com")) return anthropic();
    if (url.endsWith("/rest/v1/uso_claude")) {
      filas.push(JSON.parse(opt.body));
      return new Response(null, { status: 201 });
    }
    throw new Error(`url inesperada ${url}`);
  };
  return filas;
}

test("identificar-captura: registra tokens y usuario sin cambiar la respuesta", async () => {
  const filas = simularTodo(() => Response.json({
    model: "claude-haiku-4-5-20251001", usage: USAGE,
    content: [{ type: "text", text: '{"especie":"Lubina","talla_cm":null,"peso_g":null,"confianza":"media"}' }],
  }));
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { especie: "Lubina", talla_cm: null, peso_g: null, confianza: "media" });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].funcion, "identificar-captura");
  assert.equal(filas[0].modelo, "claude-haiku-4-5-20251001");
  assert.equal(filas[0].input_tokens, 120);
  assert.equal(filas[0].output_tokens, 40);
  assert.equal(filas[0].max_tokens, 300);
  assert.equal(filas[0].ok, true);
  assert.equal(filas[0].user_id, "user-1");
});

test("identificar-captura: sin saldo registra ok=false con el código clasificado", async () => {
  const filas = simularTodo(() => new Response(
    JSON.stringify({ error: { type: "invalid_request_error", message: "Your credit balance is too low" } }),
    { status: 400 },
  ));
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).codigo, "sin_credito");
  assert.equal(filas.length, 1);
  assert.equal(filas[0].ok, false);
  assert.equal(filas[0].codigo, "sin_credito");
  assert.equal(filas[0].input_tokens, 0);
});

test("identificar-captura: fallo de red registra fallo_proveedor una sola vez", async () => {
  const filas = simularTodo(() => { throw new Error("red caída"); });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 502);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].codigo, "fallo_proveedor");
});

test("identificar-captura: con el límite diario alcanzado no llama a Claude (C6)", async () => {
  let llamadasClaude = 0;
  const filas = simularTodo(() => { llamadasClaude++; return Response.json({}); }, 30);
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).codigo, "limite_diario");
  assert.equal(llamadasClaude, 0);
  assert.equal(filas.length, 0);
});

test("identificar-captura: respuesta cortada por max_tokens es un fallo propio (C4)", async () => {
  const filas = simularTodo(() => Response.json({
    model: "claude-haiku-4-5-20251001", usage: USAGE, stop_reason: "max_tokens",
    content: [{ type: "text", text: '{"especie":"Lub' }],
  }));
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 502);
  assert.equal((await r.json()).codigo, "respuesta_cortada");
  assert.equal(filas.length, 1);
  assert.equal(filas[0].ok, false);
  assert.equal(filas[0].codigo, "respuesta_cortada");
  assert.equal(filas[0].input_tokens, 120);
});
