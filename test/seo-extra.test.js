// IndexNow, imágenes para compartir, iconos de la app (PWA), 404 general,
// security.txt y caché de imágenes (2026-10-08, "todo lo gratuito que nos
// ayude"). Sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";
import {
  CLAVE_INDEXNOW, FICHERO_CLAVE, MAX_URLS_POR_PETICION, entradasSitemap, cambiosSitemap, urlsDeCambios,
  urlsCondicionesHoy, todasLasUrls, peticionesIndexNow, interpretarRespuesta,
} from "../functions/_lib/seo/indexnow.js";
import { REGIONES_MAREAS } from "../functions/_lib/seo/datos.js";
import { paginaRegionSpots, paginaIndiceSpots, paginaIndiceEspecies } from "../functions/_lib/seo/paginas.js";
import { htmlNoEncontradaGeneral } from "../functions/_lib/seo/base.js";
import { SPOTS } from "../functions/prevision.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const binario = (r) => readFileSync(join(RAIZ, r));
const sitemap = leer("sitemap.xml");
const especies = JSON.parse(leer("assets/datos/especies.json"));

// Tamaño de un PNG (cabecera IHDR) o de un JPEG (marcador SOF).
function tamanoImagen(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { tipo: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  assert.equal(buf.readUInt16BE(0), 0xffd8, "ni PNG ni JPEG");
  let i = 2;
  while (i < buf.length) {
    const marca = buf.readUInt16BE(i);
    const largo = buf.readUInt16BE(i + 2);
    if (marca >= 0xffc0 && marca <= 0xffc3) return { tipo: "jpeg", h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  throw new Error("JPEG sin SOF");
}

// ---------------------------------------------------------------------------
// IndexNow
// ---------------------------------------------------------------------------
test("IndexNow: la clave se sirve en la raíz, con el mismo contenido y en la lista blanca", () => {
  assert.match(CLAVE_INDEXNOW, /^[a-f0-9]{32}$/);
  assert.equal(FICHERO_CLAVE, `/${CLAVE_INDEXNOW}.txt`);
  assert.equal(leer(FICHERO_CLAVE.slice(1)).trim(), CLAVE_INDEXNOW);
  assert.equal(esRutaPermitida(FICHERO_CLAVE), true);
  // El workflow vigila el fichero (el primer push con la clave avisa de todo).
  const wf = leer(".github/workflows/indexnow.yml");
  assert.ok(wf.includes(`"${CLAVE_INDEXNOW}.txt"`), "indexnow.yml: falta la clave en paths");
  assert.match(wf, /cron: "\d+ \d+ \* \* \*"/, "una vez al día");
  assert.match(wf, /--esperar/, "en push espera al despliegue");
  assert.doesNotMatch(wf, /anthropic|claude -p|secrets\./i, "sin IA ni secretos");
});

test("IndexNow: lee el sitemap y detecta URLs nuevas o con lastmod distinto", () => {
  const e = entradasSitemap(sitemap);
  assert.equal(e.length, (sitemap.match(/<loc>/g) || []).length);
  assert.ok(e.every((x) => x.loc.startsWith("https://costaviva.org/") && /^\d{4}-\d{2}-\d{2}$/.test(x.lastmod)));
  const antes = `<urlset><url><loc>https://costaviva.org/a</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://costaviva.org/b</loc><lastmod>2026-01-01</lastmod></url></urlset>`;
  const despues = `<urlset><url><loc>https://costaviva.org/a</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://costaviva.org/b</loc><lastmod>2026-02-01</lastmod></url><url><loc>https://costaviva.org/c</loc><lastmod>2026-02-01</lastmod></url></urlset>`;
  assert.deepEqual(cambiosSitemap(antes, despues), ["https://costaviva.org/b", "https://costaviva.org/c"]);
  assert.deepEqual(cambiosSitemap(despues, despues), []);
});

test("IndexNow: de ficheros cambiados a URLs públicas afectadas", () => {
  const todas = todasLasUrls(sitemap);
  const r = (ficheros) => urlsDeCambios({ ficheros, xmlAntes: sitemap, xmlDespues: sitemap });
  const rutas = (urls) => urls.map((u) => new URL(u).pathname);
  // Nada público cambia: nada que avisar (CSS, robots, workflows, la app).
  assert.deepEqual(r(["assets/css/publico.css", "SEO_ESTADO.md", ".github/workflows/x.yml", "assets/js/rayos.js", "diario.html"]), []);
  // Primera vez (fichero de la clave nuevo) o plantilla común: todas.
  assert.equal(r([FICHERO_CLAVE.slice(1)]).length, todas.length);
  assert.equal(r(["functions/_lib/seo/base.js"]).length, todas.length);
  // Páginas de spots, de especies, de mareas, portada y privacidad.
  const spots = rutas(r(["functions/spots/[slug].js"]));
  assert.ok(spots.length === SPOTS.length + REGIONES_MAREAS.length + 1 && spots.every((p) => p.startsWith("/spots")), "solo /spots");
  assert.ok(rutas(r(["functions/especies/[slug].js"])).every((p) => p.startsWith("/especies")));
  const esp = rutas(r(["assets/datos/especies.json"]));
  assert.ok(esp.includes("/especies/lubina") && esp.includes("/spots/bakio") && !esp.some((p) => p.startsWith("/mareas")));
  assert.ok(rutas(r(["functions/mareas/[slug].js"])).every((p) => p.startsWith("/mareas")));
  assert.deepEqual(rutas(r(["login.html"])), ["/"]);
  assert.deepEqual(rutas(r(["privacidad.html"])), ["/privacidad"]);
  // Sin sitemap anterior: todas. Nada fuera del sitemap (nunca privadas).
  assert.equal(urlsDeCambios({ ficheros: [], xmlAntes: "", xmlDespues: sitemap }).length, todas.length);
  assert.ok(todas.every((u) => !/\/(diario|alarma|grupos|suscripcion|admin|login)/.test(u)));
});

test("IndexNow: a diario solo las páginas de cada spot (pesca y marea)", () => {
  const hoy = urlsCondicionesHoy(sitemap).map((u) => new URL(u).pathname);
  assert.equal(hoy.length, SPOTS.length * 2);
  assert.ok(hoy.includes("/spots/bakio") && hoy.includes("/mareas/bakio"));
  assert.ok(!hoy.some((p) => p.includes("/region/") || p.startsWith("/especies") || p === "/spots" || p === "/mareas"));
});

test("IndexNow: peticiones de 10.000 URLs como mucho, solo del host propio", () => {
  const urls = Array.from({ length: 10_001 }, (_, i) => `https://costaviva.org/x${i}`);
  const lotes = peticionesIndexNow([...urls, "https://otro.com/a", "http://costaviva.org/b", "basura", urls[0]]);
  assert.equal(lotes.length, 2);
  assert.equal(lotes[0].urlList.length, MAX_URLS_POR_PETICION);
  assert.equal(lotes[1].urlList.length, 1);
  assert.deepEqual(Object.keys(lotes[0]).sort(), ["host", "key", "keyLocation", "urlList"]);
  assert.equal(lotes[0].host, "costaviva.org");
  assert.equal(lotes[0].keyLocation, `https://costaviva.org${FICHERO_CLAVE}`);
  assert.deepEqual(peticionesIndexNow([]), []);
});

test("IndexNow: 200 y 202 son éxito; 403, 422 y 429 dejan el run en rojo", () => {
  assert.equal(interpretarRespuesta(200).ok, true);
  assert.equal(interpretarRespuesta(202).ok, true);
  for (const s of [0, 400, 403, 422, 429, 500]) assert.equal(interpretarRespuesta(s).ok, false, String(s));
});

test("IndexNow: el script en modo --probar no manda nada", () => {
  const salida = execFileSync(process.execPath, [join(RAIZ, "scripts/seo/indexnow.mjs"), "hoy", "--probar"], { encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
  assert.match(salida, new RegExp(`${SPOTS.length * 2} URL\\(s\\) para avisar`));
  assert.match(salida, /no se ha mandado nada/);
  const todas = execFileSync(process.execPath, [join(RAIZ, "scripts/seo/indexnow.mjs"), "cambios", "--antes", "0000000000000000000000000000000000000000", "--probar"], { encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
  assert.match(todas, new RegExp(`${entradasSitemap(sitemap).length} URL\\(s\\)`));
});

// ---------------------------------------------------------------------------
// Imágenes para compartir (Open Graph)
// ---------------------------------------------------------------------------
test("Open Graph: una imagen 1200x630 por sección y por región, y las páginas la usan", () => {
  const nombres = ["costaviva", "spots", "especies", "mareas", ...REGIONES_MAREAS.map((r) => `region-${r.slug}`)];
  for (const n of nombres) {
    const ruta = `assets/og/${n}.jpg`;
    assert.ok(existsSync(join(RAIZ, ruta)), `falta ${ruta}: python3 scripts/seo/generar-imagenes.py`);
    const t = tamanoImagen(binario(ruta));
    assert.deepEqual([t.w, t.h], [1200, 630], ruta);
    assert.ok(binario(ruta).length < 200_000, `${ruta} pesa demasiado`);
  }
  const og = (h) => /<meta property="og:image" content="([^"]+)">/.exec(h)?.[1];
  const region = REGIONES_MAREAS[0];
  const hRegion = paginaRegionSpots(region, SPOTS, especies, 10).html;
  assert.equal(og(hRegion), `https://costaviva.org/assets/og/region-${region.slug}.jpg`);
  assert.match(hRegion, /<meta property="og:image:width" content="1200">/);
  assert.match(hRegion, /<meta name="twitter:image" content="https:\/\/costaviva\.org\/assets\/og\/region-/);
  assert.match(hRegion, /<meta property="og:image:alt" content="[^"]{10,}">/);
  assert.equal(og(paginaIndiceSpots(SPOTS).html), "https://costaviva.org/assets/og/spots.jpg");
  assert.equal(og(paginaIndiceEspecies(especies, 10).html), "https://costaviva.org/assets/og/especies.jpg");
  // Mareas (HTML propio): región o índice, nunca la foto de portada.
  for (const f of ["functions/mareas/[slug].js", "functions/mareas/index.js", "functions/mareas/region/[region].js"]) {
    const t = leer(f);
    assert.match(t, /og:image" content="[^"]*\/assets\/og\//, f);
    assert.match(t, /twitter:image"/, f);
  }
  // La portada que de verdad sirve "/" (index.html) y login.html.
  for (const f of ["index.html", "login.html"]) {
    const t = leer(f);
    assert.ok(t.includes('<meta property="og:image" content="https://costaviva.org/assets/og/costaviva.jpg" />'), f);
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(t);
    assert.ok(ld, `${f}: JSON-LD`);
    const datos = JSON.parse(ld[1]);
    assert.ok(datos.some((x) => x["@type"] === "Organization" && x.logo.endsWith(".png")), `${f}: logo PNG`);
  }
});

// ---------------------------------------------------------------------------
// App instalable (PWA): manifest e iconos
// ---------------------------------------------------------------------------
test("manifest.json: iconos PNG reales (192, 512 y maskable) y colores de la marca", () => {
  const m = JSON.parse(leer("manifest.json"));
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.equal(m.lang, "es");
  const themeIndex = /<meta name="theme-color" content="([^"]+)"/.exec(leer("index.html"))[1];
  assert.equal(m.theme_color, themeIndex, "mismo theme-color que las páginas");
  const png = m.icons.filter((i) => i.type === "image/png");
  for (const tam of ["192x192", "512x512"]) assert.ok(png.some((i) => i.sizes === tam && i.purpose === "any"), tam);
  assert.ok(png.some((i) => i.purpose === "maskable"), "maskable");
  for (const i of m.icons) {
    const ruta = i.src.replace(/^\//, "");
    assert.ok(existsSync(join(RAIZ, ruta)), ruta);
    assert.ok(esRutaPermitida(i.src.startsWith("/") ? i.src : `/${i.src}`), `${i.src} en la lista blanca`);
    if (i.type === "image/png") {
      const t = tamanoImagen(binario(ruta));
      assert.equal(`${t.w}x${t.h}`, i.sizes, ruta);
    }
  }
  const apple = tamanoImagen(binario("assets/iconos/apple-touch-icon.png"));
  assert.deepEqual([apple.w, apple.h], [180, 180]);
});

test("apple-touch-icon: PNG en todas las páginas (iOS no usa SVG)", () => {
  for (const f of ["index.html", "login.html", "diario.html", "alarma.html", "grupos.html", "suscripcion.html"]) {
    assert.ok(leer(f).includes('<link rel="apple-touch-icon" href="/assets/iconos/apple-touch-icon.png" />'), f);
  }
  assert.match(htmlNoEncontradaGeneral(), /<link rel="apple-touch-icon" href="\/assets\/iconos\/apple-touch-icon\.png">/);
});

// ---------------------------------------------------------------------------
// 404 general, security.txt y caché
// ---------------------------------------------------------------------------
test("404: lo que no está en la lista blanca da una página útil, 404, noindex y con CSP", async () => {
  const { onRequest } = await import("../functions/_middleware.js");
  globalThis.HTMLRewriter ??= class { on() { return this; } transform(r) { return r; } };
  const next = async () => { throw new Error("no debe llegar a next()"); };
  for (const ruta of ["/CLAUDE.md", "/.github/workflows/tests.yml", "/no-existe"]) {
    const r = await onRequest({ request: new Request(`https://costaviva.org${ruta}`), next });
    assert.equal(r.status, 404, ruta);
    assert.equal(r.headers.get("x-robots-tag"), "noindex");
    assert.match(r.headers.get("content-type"), /text\/html/);
    assert.ok(r.headers.get("content-security-policy"), "CSP");
    const h = await r.text();
    assert.match(h, /<meta name="robots" content="noindex">/);
    for (const enlace of ["/spots", "/especies", "/mareas"]) assert.ok(h.includes(`href="${enlace}"`), enlace);
    assert.ok(!h.includes("CLAUDE"), "no repite la ruta pedida");
  }
  // 404.html (lo que Pages da para un fichero que no existe) es la misma página.
  assert.equal(leer("404.html"), `${htmlNoEncontradaGeneral()}\n`);
});

test("security.txt (RFC 9116): público, con contacto y sin caducar", () => {
  assert.equal(esRutaPermitida("/.well-known/security.txt"), true);
  assert.equal(esRutaPermitida("/.well-known/otra-cosa"), false);
  const s = leer(".well-known/security.txt");
  assert.match(s, /^Contact: mailto:[^@\s]+@costaviva\.org$/m);
  assert.match(s, /^Canonical: https:\/\/costaviva\.org\/\.well-known\/security\.txt$/m);
  const expira = new Date(/^Expires: (.+)$/m.exec(s)[1]);
  assert.ok(expira > new Date(), "security.txt caducado: renueva Expires (máximo un año)");
});

test("_headers: caché para imágenes, nunca para CSS ni JS sin versión", () => {
  const h = leer("_headers");
  for (const r of ["/assets/og/*", "/assets/iconos/*", "/assets/hero-peces*"]) {
    assert.match(h, new RegExp(`^${r.replace(/[*.]/g, (c) => `\\${c}`)}\\n  Cache-Control: public, max-age=\\d+$`, "m"), r);
  }
  assert.doesNotMatch(h, /^\/assets\/(js|css)|^\/assets\/\*/m);
  assert.doesNotMatch(h, /Content-Security-Policy/);
});
