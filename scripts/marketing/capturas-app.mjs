// scripts/marketing/capturas-app.mjs
// Capturas REALES de pantallas de la app (diario, grupos, alarma) para las
// piezas de Instagram que presentan funciones (2026-10-08). Sirve el propio
// repo en local y abre la página con Playwright, con un doble de Supabase que
// devuelve una sesión de demostración y unos pocos datos inventados de
// ejemplo (fechas del mes en curso, un grupo "Cuadrilla"): nunca datos de
// usuarios reales y sin tocar producción. Lo de fuera (mapas, analítica,
// Turnstile...) se bloquea; solo pasan Google Fonts.
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp4": "video/mp4" };

function demo() {
  const hoy = new Date();
  const dia = (d) => `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const hasta = Math.max(1, hoy.getDate());
  const dias = [2, 4, 9, 12, 16, 19, 23, 26].filter((d) => d <= hasta);
  const salidas = dias.map((d, i) => ({ id: `s${i}`, user_id: "demo", fecha: dia(d), spot_nombre: ["Bakio", "Mundaka", "Getxo"][i % 3], tipo_salida: "costa" }));
  const capturas = salidas.filter((_, i) => i % 2 === 0).map((s, i) => ({ id: `c${i}`, salida_id: s.id, especie: ["Lubina", "Sargo", "Dorada"][i % 3], creado_en: `${s.fecha}T10:00:00Z` }));
  return {
    salidas_pesca: salidas,
    capturas,
    miembros_grupo: [{ grupo_id: "g1", user_id: "demo", grupos: { id: "g1", nombre: "Cuadrilla de Bakio" } }],
    perfiles: { nombre: "Mikel" },
  };
}

// Doble mínimo de @supabase/supabase-js: sesión de demostración y, por
// tabla, los datos de demo() o una lista vacía.
function supabaseFalso() {
  return `
const DEMO = ${JSON.stringify(demo())};
const cadena = (tabla) => { const p = new Proxy(function () {}, {
  get(_, k) { if (k === "then") return (ok) => ok({ data: DEMO[tabla] ?? [], error: null, count: 0 }); return () => p; },
  apply() { return p; } }); return p; };
export function createClient() { return {
  auth: { getSession: async () => ({ data: { session: { access_token: "demo", user: { id: "demo", email: "demo@costaviva.org" } } } }),
          signOut: async () => ({}), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } },
  rpc: async () => ({ data: null, error: null }), from: (t) => cadena(t), storage: { from: () => cadena("storage") }, channel: () => cadena("canal") }; }`;
}

export function servirRepo(puerto = 0) {
  return new Promise((ok) => {
    const servidor = http.createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      let ruta = join(RAIZ_REPO, decodeURIComponent(url.pathname));
      if (!ruta.startsWith(RAIZ_REPO)) { res.writeHead(403); return res.end(); }
      if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, "index.html");
      if (!existsSync(ruta)) { res.writeHead(404); return res.end("{}"); }
      res.writeHead(200, { "content-type": TIPOS[extname(ruta)] || "application/octet-stream" });
      res.end(readFileSync(ruta));
    });
    servidor.listen(puerto, "127.0.0.1", () => ok(servidor));
  });
}

const CSS_FUENTES = `
@font-face { font-family: "Unbounded"; font-weight: 200 900; src: url(http://127.0.0.1/__fuentes/Unbounded-latin.woff2) format("woff2"); }
@font-face { font-family: "Manrope"; font-weight: 200 800; src: url(http://127.0.0.1/__fuentes/Manrope-latin.woff2) format("woff2"); }`;

// Devuelve un PNG (Buffer) de la página a 390x844 @2x, como un móvil.
export async function capturarPantalla(navegador, pagina, { puerto, alto = 844 } = {}) {
  // Hora de Madrid a propósito (ZONA_NEGOCIO): capturas para el marketing en España.
  const ctx = await navegador.newContext({ viewport: { width: 390, height: alto }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-ES", timezoneId: "Europe/Madrid" });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && u.pathname.startsWith("/__fuentes/")) {
      return route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(join(RAIZ_REPO, "assets/fonts", u.pathname.slice(11))), headers: { "access-control-allow-origin": "*" } });
    }
    if (u.hostname === "127.0.0.1") return route.continue();
    if (u.hostname === "esm.sh" && u.pathname.includes("supabase")) return route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseFalso() });
    // Las letras de la app (Unbounded y Manrope) salen de assets/fonts, sin red.
    if (u.hostname === "fonts.googleapis.com") return route.fulfill({ status: 200, contentType: "text/css", body: CSS_FUENTES });
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${puerto}${pagina}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await ctx.close();
  return png;
}
