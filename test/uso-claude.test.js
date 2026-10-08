// Registro del gasto de Claude (functions/_lib/uso-claude.js, 2026-10-07) y
// su uso en functions/identificar-captura.js. Fetch simulado: no sale nada
// a la red.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registrarUsoClaude, _reiniciarUsoClaude } from "../functions/_lib/uso-claude.js";
import { onRequestPost, inicioMesMadrid, cuerpoPeticion, interpretarRespuesta, LIMITE_MENSUAL } from "../functions/identificar-captura.js";

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

// usosHoy: llamadas en 24 h; usosMes: identificaciones buenas del mes;
// acceso: lo que devuelve mi_estado_suscripcion() (null = la RPC falla).
function simularTodo(anthropic, usosHoy = 0, { usosMes = 0, acceso = true } = {}) {
  const filas = [];
  const peticiones = [];
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
    if (url.endsWith("/rest/v1/rpc/mi_estado_suscripcion")) {
      peticiones.push({ url, opt });
      if (acceso === null) return new Response("caída", { status: 500 });
      return Response.json({ estado: acceso ? "active" : "canceled", con_acceso: acceso });
    }
    if (url.includes("/rest/v1/uso_claude?") && opt.method === "HEAD") {
      peticiones.push({ url, opt });
      const n = url.includes("ok=eq.true") ? usosMes : usosHoy;
      return new Response(null, { status: 200, headers: { "content-range": `*/${n}` } });
    }
    if (url.includes("api.anthropic.com")) {
      peticiones.push({ url, opt });
      return anthropic();
    }
    if (url.endsWith("/rest/v1/uso_claude")) {
      filas.push(JSON.parse(opt.body));
      return new Response(null, { status: 201 });
    }
    throw new Error(`url inesperada ${url}`);
  };
  filas.peticiones = peticiones;
  return filas;
}

test("identificar-captura: registra tokens y usuario sin cambiar la respuesta", async () => {
  const filas = simularTodo(() => Response.json({
    model: "claude-haiku-5-5", usage: USAGE, stop_reason: "end_turn",
    content: [
      { type: "thinking", thinking: "", signature: "x" },
      { type: "text", text: '{"especie":"Lubina","talla_cm":null,"peso_g":null,"confianza":"media"}' },
    ],
  }), 0, { usosMes: 10 });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    especie: "Lubina", talla_cm: null, peso_g: null, confianza: "media",
    limite_mes: 100, restantes_mes: 89,
  });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].funcion, "identificar-captura");
  assert.equal(filas[0].modelo, "claude-haiku-5-5");
  assert.equal(filas[0].input_tokens, 120);
  assert.equal(filas[0].output_tokens, 40);
  assert.equal(filas[0].max_tokens, 1024);
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
    model: "claude-haiku-5-5", usage: USAGE, stop_reason: "max_tokens",
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

test("identificar-captura: la petición a Haiku 5.5 lleva esfuerzo bajo, sin temperature ni prefill", async () => {
  const filas = simularTodo(() => Response.json({
    model: "claude-haiku-5-5", usage: USAGE, stop_reason: "end_turn",
    content: [{ type: "text", text: '{"especie":"","talla_cm":null,"peso_g":null,"confianza":"baja"}' }],
  }));
  const { ctx, pendientes } = contexto();
  await onRequestPost(ctx);
  await Promise.all(pendientes);
  const llamada = filas.peticiones.find((p) => p.url.includes("api.anthropic.com"));
  const cuerpo = JSON.parse(llamada.opt.body);
  assert.equal(cuerpo.model, "claude-haiku-5-5");
  assert.equal(cuerpo.max_tokens, 1024);
  assert.deepEqual(cuerpo.output_config, { effort: "low" });
  assert.equal("temperature" in cuerpo, false);
  assert.equal("thinking" in cuerpo, false);
  assert.equal(cuerpo.messages.at(-1).role, "user");
  // Haiku 4.5 (solo para la evaluación) no admite effort.
  assert.equal("output_config" in cuerpoPeticion({ imagenBase64: "A", modelo: "claude-haiku-4-5-20251001" }), false);
});

test("identificar-captura: la suscripción se comprueba con el token del usuario, no con service_role", async () => {
  const filas = simularTodo(() => Response.json({ usage: USAGE, content: [{ type: "text", text: "{}" }] }));
  const { ctx, pendientes } = contexto();
  await onRequestPost(ctx);
  await Promise.all(pendientes);
  const rpc = filas.peticiones.find((p) => p.url.includes("mi_estado_suscripcion"));
  assert.equal(rpc.opt.headers.Authorization, "Bearer tok");
  assert.notEqual(rpc.opt.headers.apikey, "sr");
});

test("identificar-captura: sin suscripción activa no llama a Claude", async () => {
  let llamadasClaude = 0;
  const filas = simularTodo(() => { llamadasClaude++; return Response.json({}); }, 0, { acceso: false });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 403);
  assert.equal((await r.json()).codigo, "sin_suscripcion");
  assert.equal(llamadasClaude, 0);
  assert.equal(filas.length, 0);
});

test("identificar-captura: si la RPC de suscripción falla se deja pasar", async () => {
  const filas = simularTodo(() => Response.json({
    usage: USAGE, content: [{ type: "text", text: '{"especie":"Sargo","talla_cm":null,"peso_g":null,"confianza":"alta"}' }],
  }), 0, { acceso: null });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 200);
  assert.equal(filas.length, 1);
});

test("identificar-captura: con el tope mensual alcanzado no llama a Claude", async () => {
  let llamadasClaude = 0;
  const filas = simularTodo(() => { llamadasClaude++; return Response.json({}); }, 0, { usosMes: LIMITE_MENSUAL });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 429);
  const cuerpo = await r.json();
  assert.equal(cuerpo.codigo, "limite_mensual");
  assert.equal(cuerpo.restantes_mes, 0);
  assert.equal(llamadasClaude, 0);
  assert.equal(filas.length, 0);
  // El mes se cuenta solo con las buenas y desde el día 1 en Madrid.
  const mes = filas.peticiones.find((p) => p.url.includes("ok=eq.true"));
  assert.match(decodeURIComponent(mes.url), /creado_en=gte\.\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z/);
});

test("identificar-captura: la última del mes devuelve restantes_mes 0", async () => {
  simularTodo(() => Response.json({
    usage: USAGE, content: [{ type: "text", text: '{"especie":"Sargo","talla_cm":null,"peso_g":null,"confianza":"alta"}' }],
  }), 0, { usosMes: LIMITE_MENSUAL - 1 });
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).restantes_mes, 0);
});

test("identificar-captura: un rechazo (stop_reason refusal) es un aviso con código, no un error", async () => {
  const filas = simularTodo(() => Response.json({
    model: "claude-haiku-5-5", usage: USAGE, stop_reason: "refusal",
    stop_details: { type: "refusal", category: "general_harms" }, content: [],
  }));
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 422);
  assert.equal((await r.json()).codigo, "rechazada");
  assert.equal(filas.length, 1);
  assert.equal(filas[0].ok, false);
  assert.equal(filas[0].codigo, "rechazada");
});

test("identificar-captura: JSON mal formado queda registrado con sus tokens", async () => {
  const filas = simularTodo(() => Response.json({
    usage: USAGE, stop_reason: "end_turn", content: [{ type: "text", text: "{especie: Lubina}" }],
  }));
  const { ctx, pendientes } = contexto();
  const r = await onRequestPost(ctx);
  await Promise.all(pendientes);
  assert.equal(r.status, 502);
  assert.equal((await r.json()).codigo, "fallo_proveedor");
  assert.equal(filas[0].codigo, "respuesta_invalida");
  assert.equal(filas[0].input_tokens, 120);
});

test("interpretarRespuesta: lee los bloques de texto aunque empiece por thinking", () => {
  const r = interpretarRespuesta({ stop_reason: "end_turn", content: [
    { type: "thinking", thinking: "" },
    { type: "text", text: 'Aquí va: {"especie":"Dorada","talla_cm":30,"peso_g":400,"confianza":"alta"}' },
  ] });
  assert.deepEqual(r.resultado, { especie: "Dorada", talla_cm: 30, peso_g: 400, confianza: "alta" });
});

test("inicioMesMadrid: día 1 a las 00:00 en Madrid, con horario de verano e invierno", () => {
  assert.equal(inicioMesMadrid(new Date("2026-10-08T10:00:00Z")).toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(inicioMesMadrid(new Date("2026-01-15T10:00:00Z")).toISOString(), "2025-12-31T23:00:00.000Z");
  // 31 de octubre 23:30 en Madrid: todavía octubre.
  assert.equal(inicioMesMadrid(new Date("2026-10-31T22:30:00Z")).toISOString(), "2026-09-30T22:00:00.000Z");
  // 1 de noviembre 00:30 en Madrid (23:30 UTC del 31): ya noviembre.
  assert.equal(inicioMesMadrid(new Date("2026-10-31T23:30:00Z")).toISOString(), "2026-10-31T23:00:00.000Z");
});
