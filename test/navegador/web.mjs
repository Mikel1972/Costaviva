// test/navegador/web.mjs
// La web servida a Chromium sin servidor: un origen falso (https://costaviva.test)
// cuyas peticiones se contestan con los ficheros del repo, como Cloudflare
// Pages (/diario -> diario.html). Sin red hacia nuestras APIs, Supabase,
// mapas ni cámaras: así la prueba no depende de nada de fuera ni toca
// producción. Las librerías de las CDN (cdnjs, jsdelivr, unpkg, esm.sh) sí se
// cargan: en CI de verdad; en local, si NAVEGADOR_CDN_CACHE apunta a una
// carpeta, desde ahí (con curl la primera vez, por el proxy).
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ORIGEN = "https://costaviva.test";
const SUPABASE = "https://imncbmizxkorotpeisic.supabase.co";
const CLAVE_SESION = "sb-imncbmizxkorotpeisic-auth-token";
export const USUARIO = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "prueba@costaviva.test", user_metadata: {}, app_metadata: {} };

// Sesión de mentira para entrar en las páginas con login: supabase-js la lee
// del localStorage sin comprobar la firma, y las llamadas a Supabase las
// contesta supabase() de aquí abajo. Nunca sale nada hacia el Supabase real.
function jwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256", typ: "JWT" })}.${b({ sub: USUARIO.id, role: "authenticated", exp: 4102444800 })}.firma`;
}
export function sesionFalsa() {
  return { access_token: jwt(), refresh_token: "prueba", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: USUARIO };
}

// Respuestas vacías de Supabase: tablas sin filas, RPC null, el usuario de
// prueba para /auth/v1/user.
function supabase(route, url) {
  const { pathname } = new URL(url);
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify(body) });
  if (route.request().method() === "OPTIONS") return json({});
  if (pathname.startsWith("/auth/v1/user")) return json(USUARIO);
  if (pathname.startsWith("/rest/v1/rpc/")) return json(null);
  if (pathname.startsWith("/rest/v1/")) return json([]);
  return json({});
}
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh)\//;
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".geojson": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

function fichero(ruta) {
  let p = decodeURIComponent(ruta);
  if (p.endsWith("/")) p += "index.html";
  const candidatos = [p, `${p}.html`];
  for (const c of candidatos) {
    const f = join(RAIZ, c);
    if (!f.startsWith(RAIZ) || c.includes("/.") || c.startsWith("/functions") || c.startsWith("/test")) continue;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

async function cdn(route, url) {
  const cache = process.env.NAVEGADOR_CDN_CACHE;
  if (!cache) return route.continue();
  mkdirSync(cache, { recursive: true });
  const f = join(cache, url.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200));
  if (!existsSync(f)) {
    try { execFileSync("curl", ["-sfL", "-A", "Mozilla/5.0 Chrome/130", "-o", f, url]); } catch { return route.fulfill({ status: 502, body: "" }); }
  }
  const ext = extname(new URL(url).pathname);
  const tipo = ext === ".css" ? TIPOS[".css"] : (ext === ".json" ? TIPOS[".json"] : TIPOS[".js"]);
  return route.fulfill({ status: 200, contentType: tipo, headers: { "access-control-allow-origin": "*" }, body: readFileSync(f) });
}

// Engancha las rutas a un contexto de Playwright. Devuelve los errores de
// JavaScript de cada página que se abra (pageerror), que es lo que las
// pruebas miran: un error así es un fallo que el usuario sufre.
export async function prepararContexto(ctx, { conSesion = true } = {}) {
  if (conSesion) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [CLAVE_SESION, JSON.stringify(sesionFalsa())]);
  }
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGEN)) {
      const { pathname } = new URL(url);
      const f = fichero(pathname);
      if (f) return route.fulfill({ status: 200, contentType: TIPOS[extname(f)] || "application/octet-stream", body: readFileSync(f) });
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    if (url.startsWith(SUPABASE)) return supabase(route, url);
    if (CDN.test(url)) return cdn(route, url);
    return route.abort("blockedbyclient");
  });
}

export async function abrir(ctx, ruta) {
  const pagina = await ctx.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));
  await pagina.goto(ORIGEN + ruta, { waitUntil: "load" });
  return { pagina, errores };
}
