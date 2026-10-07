// Test de la CSP con nonce de functions/_middleware.js (conformidad W6,
// Mikel1972/comun estandares/web-y-despliegue.md, 2026-10-07).
//
// HTMLRewriter solo existe en el runtime de Cloudflare, así que aquí se
// sustituye por un doble mínimo que llama al handler de "script" por cada
// <script> del HTML. Lo que se prueba es nuestra parte: que cada <script>
// recibe el MISMO nonce que va en la cabecera, que lo que no es HTML no se
// toca y que, si la reescritura falla, se devuelve 500 y no el HTML sin CSP.
// Sin red ni secretos: corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { aplicarCsp, construirCsp, generarNonce } from "../functions/_middleware.js";

class RewriterFalso {
  constructor() {
    this.handlers = [];
  }
  on(selector, handler) {
    this.handlers.push({ selector, handler });
    return this;
  }
  transform(response) {
    const { handlers } = this;
    const texto = response.text().then((html) =>
      html.replace(/<script\b([^>]*)>/gi, (_, attrs) => {
        let extra = "";
        const el = { setAttribute: (n, v) => { extra += ` ${n}="${v}"`; } };
        for (const { selector, handler } of handlers) {
          if (selector === "script") handler.element(el);
        }
        return `<script${attrs}${extra}>`;
      })
    );
    const body = new ReadableStream({
      async start(c) {
        c.enqueue(new TextEncoder().encode(await texto));
        c.close();
      },
    });
    return new Response(body, { status: response.status, headers: response.headers });
  }
}

class RewriterQueFalla {
  on() {
    return this;
  }
  transform() {
    throw new Error("fallo simulado");
  }
}

const html = (cuerpo, extra = {}) =>
  new Response(cuerpo, { headers: { "content-type": "text/html; charset=utf-8", etag: '"abc"', ...extra } });

function nonceDeCsp(csp) {
  return /'nonce-([^']+)'/.exec(csp)?.[1];
}

test("HTML: CSP en la cabecera y el mismo nonce en cada <script>", async () => {
  const resp = aplicarCsp(
    html(`<html><head><script src="https://cdnjs.cloudflare.com/x.js"></script>
<script type="module">import "https://esm.sh/a";</script></head>
<body><script>console.log(1)</script></body></html>`),
    RewriterFalso
  );
  const csp = resp.headers.get("content-security-policy");
  assert.ok(csp, "falta la cabecera CSP");
  const nonce = nonceDeCsp(csp);
  assert.ok(nonce && nonce.length >= 16, "nonce ausente o corto");
  const cuerpo = await resp.text();
  const scripts = cuerpo.match(/<script\b[^>]*>/g);
  assert.equal(scripts.length, 3);
  for (const s of scripts) assert.ok(s.includes(`nonce="${nonce}"`), `sin nonce: ${s}`);
  assert.equal(resp.headers.get("etag"), null, "el ETag haría reutilizar un nonce viejo");
});

test("cada petición lleva un nonce distinto", () => {
  const a = nonceDeCsp(aplicarCsp(html("<p>"), RewriterFalso).headers.get("content-security-policy"));
  const b = nonceDeCsp(aplicarCsp(html("<p>"), RewriterFalso).headers.get("content-security-policy"));
  assert.notEqual(a, b);
  assert.match(generarNonce(), /^[A-Za-z0-9+/]{24}$/);
});

test("lo que no es HTML sale intacto (misma respuesta, sin CSP)", () => {
  for (const tipo of ["application/json", "image/jpeg", "application/vnd.apple.mpegurl", "text/css", "application/javascript"]) {
    const original = new Response("x", { headers: { "content-type": tipo, etag: '"e"' } });
    const resp = aplicarCsp(original, RewriterQueFalla);
    assert.equal(resp, original, tipo);
    assert.equal(resp.headers.get("content-security-policy"), null);
  }
  const sinTipo = new Response(null, { status: 302, headers: { location: "/login" } });
  assert.equal(aplicarCsp(sinTipo, RewriterQueFalla), sinTipo);
});

test("fail-closed: si la reescritura falla, 500 y nunca el HTML sin CSP", async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const resp = aplicarCsp(html("<script>secreto()</script>"), RewriterQueFalla);
    assert.equal(resp.status, 500);
    assert.ok(!(await resp.text()).includes("secreto"));
  } finally {
    console.error = errorOriginal;
  }
});

test("la política cumple W6: sin unsafe-inline/unsafe-eval en scripts, y cierres básicos", () => {
  const csp = construirCsp("NONCE");
  const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src "));
  assert.ok(scriptSrc.includes("'nonce-NONCE'"));
  assert.ok(scriptSrc.includes("'strict-dynamic'"));
  assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSrc), scriptSrc);
  for (const d of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(csp.includes(d), `falta ${d}`);
  }
  assert.ok(csp.includes("wss://imncbmizxkorotpeisic.supabase.co"), "realtime de Supabase");
  assert.ok(/worker-src [^;]*blob:/.test(csp), "hls.js necesita worker blob:");
  assert.ok(/frame-src [^;]*challenges\.cloudflare\.com/.test(csp), "Turnstile en login.html");
});

// Con nonce, un onclick="..." o un href="javascript:..." deja de ejecutarse
// en silencio. Este test lo caza en CI en vez de en producción.
test("ninguna página usa manejadores on*= inline, javascript: ni <base>", () => {
  const paginas = readdirSync(new URL("..", import.meta.url)).filter((f) => f.endsWith(".html"));
  assert.ok(paginas.length >= 7);
  for (const p of paginas) {
    const t = readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    assert.doesNotMatch(t, /\son[a-z]{3,}\s*=\s*["'`]/i, `${p}: manejador inline`);
    assert.doesNotMatch(t, /javascript:/i, `${p}: URL javascript:`);
    assert.doesNotMatch(t, /<base[\s>]/i, `${p}: <base> (base-uri es 'none')`);
  }
});
