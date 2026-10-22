// test/navegador/navegador.test.mjs
// Pruebas en un Chromium de verdad (2026-10-12, Mikel: "pruebas automáticas
// en el navegador en cada PR"). Las de node --test miran el código; estas
// abren las páginas como un usuario, en ordenador y en móvil, y fallan si
// algo salta con un error de JavaScript o deja de responder: el zoom de la
// foto, el menú ☰ del mapa, las preferencias de unidades...
// Sin red hacia producción: ver test/navegador/web.mjs.
// Corre en .github/workflows/navegador.yml; en local:
//   npm i --no-save playwright && npx playwright install chromium
//   node --test test/navegador/
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prepararContexto, abrir } from "./web.mjs";

const MOVIL = { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true };
const PC = { viewport: { width: 1280, height: 800 } };
let navegador;

before(async () => {
  navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await navegador?.close(); });

async function contexto(opciones, prep) {
  const ctx = await navegador.newContext({ locale: "es-ES", ...opciones });
  await prepararContexto(ctx, prep);
  return ctx;
}

// admin.html queda fuera: solo la usa Mikel y sus datos no se pueden
// imitar con respuestas vacías.
const CON_LOGIN = ["/", "/diario", "/alarma", "/grupos", "/suscripcion", "/etiquetar-olas"];
const SIN_LOGIN = ["/login", "/privacidad", "/terminos", "/empieza", "/404"];

for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: cada página carga sin errores de JavaScript`, async () => {
    for (const [rutas, conSesion] of [[CON_LOGIN, true], [SIN_LOGIN, false]]) {
      const ctx = await contexto(opciones, { conSesion });
      for (const ruta of rutas) {
        const { pagina, errores } = await abrir(ctx, ruta);
        await pagina.waitForTimeout(1500);
        assert.deepEqual(errores, [], `${ruta} (${nombre})`);
        if (conSesion) assert.equal(new URL(pagina.url()).pathname.replace(/\.html$/, ""), ruta, `${ruta} no debe mandar al login`);
        await pagina.close();
      }
      await ctx.close();
    }
  });
}

test("mapa: Leaflet arranca y en el móvil el ☰ pliega y despliega las capas", async () => {
  const ctx = await contexto(MOVIL);
  const { pagina, errores } = await abrir(ctx, "/");
  await pagina.waitForSelector("#map.leaflet-container", { timeout: 15000 });
  const boton = pagina.locator("#menuCapas");
  await boton.waitFor({ state: "visible" });
  assert.equal(await boton.getAttribute("aria-expanded"), "false", "en el móvil empieza plegado");
  assert.equal(await pagina.locator("#toggleRayos").isVisible(), false);
  await boton.click();
  assert.equal(await boton.getAttribute("aria-expanded"), "true");
  assert.equal(await pagina.locator("#toggleRayos").isVisible(), true, "desplegado se ven las capas");
  await boton.click();
  assert.equal(await pagina.locator("#toggleRayos").isVisible(), false);
  assert.deepEqual(errores, []);
  await ctx.close();
});

test("preferencias: elegir nudos se guarda y se recuerda al volver", async () => {
  const ctx = await contexto(PC);
  const { pagina, errores } = await abrir(ctx, "/");
  await pagina.waitForSelector("[data-preferencias-selector][data-prefs-montado] button", { state: "attached" });
  // Al cambiar una preferencia la página se recarga sola (i18n.js) para
  // pintarlo todo con las unidades nuevas.
  await Promise.all([
    pagina.waitForEvent("load"),
    pagina.evaluate(() => {
      const b = [...document.querySelectorAll("[data-preferencias-selector] button")].find((x) => /nudos|kn/i.test(x.textContent));
      b.click();
    }),
  ]);
  const guardadas = await pagina.evaluate(() => JSON.parse(localStorage.getItem("costaviva.preferencias") || "{}"));
  assert.equal(guardadas.viento, "nudos");
  await pagina.waitForSelector("[data-preferencias-selector][data-prefs-montado] button", { state: "attached" });
  const marcado = await pagina.evaluate(() => [...document.querySelectorAll("[data-preferencias-selector] button[aria-pressed=true]")].map((b) => b.textContent).join("|"));
  assert.match(marcado, /nudos|kn/i);
  assert.deepEqual(errores, []);
  await ctx.close();
});

for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: la foto ampliada de la cámara se puede mover y no deja huecos`, async () => {
    const ctx = await contexto(opciones, { conSesion: false });
    const { pagina, errores } = await abrir(ctx, "/404");
    await pagina.evaluate(async () => {
      document.body.innerHTML = `<div id="v" style="position:fixed;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#123">
        <img id="i" style="max-width:100%;max-height:100%" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#4a8"/></svg>')}"></div>`;
      await new Promise((r) => { const i = document.getElementById("i"); i.complete ? r() : (i.onload = r); });
      const Z = await import("/assets/js/zoom-foto.js");
      window.cerrado = 0;
      Z.montarZoom(document.getElementById("v"), document.getElementById("i"), { alClicFuera: () => window.cerrado++ });
    });
    const caja = await pagina.locator("#i").boundingBox();
    const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
    if (opciones.hasTouch) await pagina.touchscreen.tap(cx, cy); else await pagina.mouse.click(cx, cy);
    await pagina.waitForTimeout(300);
    const escala = () => pagina.$eval("#i", (e) => e.style.transform);
    assert.match(await escala(), /scale\(2\.5\)/, "un toque amplía");
    const antes = await pagina.locator("#i").boundingBox();
    await pagina.mouse.move(cx, cy); await pagina.mouse.down(); await pagina.mouse.move(cx + 100, cy, { steps: 6 }); await pagina.mouse.up();
    const despues = await pagina.locator("#i").boundingBox();
    assert.ok(Math.abs(despues.x - antes.x - 100) < 2, "arrastrar mueve la foto");
    await pagina.mouse.move(cx, cy); await pagina.mouse.down(); await pagina.mouse.move(cx - 4000, cy, { steps: 6 }); await pagina.mouse.up();
    const borde = await pagina.$eval("#i", (e) => { const r = e.getBoundingClientRect(); return { izq: r.left, der: r.right, ancho: innerWidth }; });
    assert.ok(borde.izq <= 1 && borde.der >= borde.ancho - 1, "no deja hueco al llegar al borde");
    assert.match(await escala(), /scale\(2\.5\)/, "arrastrar no cambia el zoom");
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

// Flota pesquera faenando (2026-10-22): la capa sale solo con la modalidad
// Embarcación (evento `modalidad`, no los clics de las pestañas), con su
// control "Hoy (24 h) / Ayer", el filtro de eslora y el aviso sin datos.
for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: flota faenando solo en Embarcación, con Hoy/Ayer, eslora y aviso sin datos`, async () => {
    const ctx = await contexto(opciones);
    const calculado = new Date().toISOString();
    const fila = (periodo, clase, n, lat) => ({ periodo, clase, n_barcos: n, celda_lat: lat, celda_lon: -3.1, especie_probable: null, calculado });
    await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/flota_zonas**", (route) => route.fulfill({
      status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
      body: JSON.stringify(route.request().method() === "OPTIONS" ? {} : [
        fila("24h", "todas", 5, 43.6), fila("24h", "<24", 3, 43.6), fila("24h", "todas", 12, 43.7), fila("ayer", "todas", 4, 43.5),
      ]),
    }));
    const { pagina, errores } = await abrir(ctx, "/");
    await pagina.waitForSelector("#map.leaflet-container", { timeout: 15000 });
    await pagina.waitForFunction(() => window.Flota && window.supabaseCliente, null, { timeout: 15000 });
    const modalidad = (m) => pagina.evaluate((x) => document.dispatchEvent(new CustomEvent("modalidad", { detail: { modalidad: x } })), m);
    const celdas = () => pagina.locator("path.leaflet-interactive[fill='#EE8434'], path.leaflet-interactive[fill='#F6B84B'], path.leaflet-interactive[fill='#D2492A']").count();
    const control = pagina.locator("[data-flota-control]");

    assert.equal(await control.count(), 0, "en Desde costa no hay capa");
    await modalidad("embarcacion");
    await control.waitFor({ state: "visible" });
    await pagina.waitForFunction(() => document.querySelectorAll(".leaflet-overlay-pane path[fill='#EE8434']").length > 0, null, { timeout: 10000 });
    assert.equal(await celdas(), 2, "dos celdas en las últimas 24 h");
    assert.equal(await pagina.locator("[data-periodo='24h']").getAttribute("aria-pressed"), "true");
    assert.equal(await pagina.locator("[data-flota-vacio]").isVisible(), false);
    assert.match(await pagina.locator(".leaflet-control-attribution").innerText(), /aisstream\.io/);

    await pagina.locator("[data-flota-clase]").selectOption(">40");
    assert.equal(await celdas(), 0);
    assert.match(await pagina.locator("[data-flota-vacio]").innerText(), /Sin flota faenando registrada en las últimas 24 h/);
    await pagina.locator("[data-flota-clase]").selectOption("todas");
    await pagina.locator("[data-periodo='ayer']").click();
    assert.equal(await celdas(), 1, "ayer, una celda");
    assert.equal(await pagina.locator("[data-periodo='ayer']").getAttribute("aria-pressed"), "true");

    await modalidad("costa");
    assert.equal(await control.count(), 0, "al salir de Embarcación desaparece");
    assert.equal(await celdas(), 0);
    assert.doesNotMatch(await pagina.locator(".leaflet-control-attribution").innerText(), /aisstream\.io/);
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

test("flota faenando sin datos: aviso «Sin flota faenando registrada en las últimas 24 h»", async () => {
  const ctx = await contexto(PC);
  const { pagina, errores } = await abrir(ctx, "/");
  await pagina.waitForFunction(() => window.Flota && window.supabaseCliente, null, { timeout: 15000 });
  await pagina.evaluate(() => document.dispatchEvent(new CustomEvent("modalidad", { detail: { modalidad: "embarcacion" } })));
  await pagina.waitForSelector("[data-flota-vacio]:not([hidden])");
  assert.equal(await pagina.locator("[data-flota-vacio]").innerText(), "Sin flota faenando registrada en las últimas 24 h");
  assert.deepEqual(errores, []);
  await ctx.close();
});
