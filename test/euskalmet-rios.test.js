// /actualizar-euskalmet-rios nunca pasa de 50 subpeticiones (límite de un
// Worker: si se pasa, Cloudflare corta todo con el error 1101). 2026-10-20:
// en rojo 4 de cada 15 días porque la hora en curso aún no tenía lecturas y
// cada una gastaba 2-3 peticiones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { onRequestPost, MAX_PETICIONES_EUSKALMET } from "../functions/actualizar-euskalmet-rios.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

async function ejecutar(responde) {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (url) => {
    n++;
    if (String(url).includes("supabase")) return new Response(null, { status: 201 });
    return responde(String(url));
  };
  try {
    const r = await onRequestPost({
      request: new Request("https://x/actualizar-euskalmet-rios", { method: "POST", headers: { "X-Cron-Secret": "s".repeat(32) } }),
      env: { CRON_SECRET: "s".repeat(32), SUPABASE_SERVICE_ROLE_KEY: "k", EUSKALMET_API_KEY: pem },
    });
    return { r, n };
  } finally { globalThis.fetch = real; }
}

test("Euskalmet sin ninguna lectura: no pasa de 50 subpeticiones y responde", async () => {
  const { r, n } = await ejecutar(() => new Response("", { status: 404 }));
  assert.ok(n <= 50, `${n} subpeticiones`);
  assert.ok(n <= MAX_PETICIONES_EUSKALMET + 1);
  assert.equal(r.status, 200);
});

test("con datos en la última hora completa: una petición por lectura", async () => {
  const { r, n } = await ejecutar(() => Response.json({ values: [1, 2] }));
  assert.equal(r.status, 200);
  assert.ok(n <= 38, `${n} subpeticiones`);
});
