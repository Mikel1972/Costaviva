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

// Modalidad global (2026-10-22): la píldora 🪨 🚤 🤿 del mapa se ve en
// ordenador y en móvil (también con el ☰ plegado), empieza en Desde costa,
// emite "modalidad" al cambiar y se recuerda al volver.
for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: la píldora de modalidad del mapa cambia, avisa y se recuerda`, async () => {
    const ctx = await contexto(opciones);
    const { pagina, errores } = await abrir(ctx, "/");
    await pagina.waitForSelector("#map.leaflet-container", { timeout: 15000 });
    const pildora = pagina.locator("#modalidadPildora");
    await pildora.waitFor({ state: "visible" });
    assert.equal(await pildora.getAttribute("role"), "radiogroup");
    assert.equal(await pagina.locator("#modPill-costa").getAttribute("aria-checked"), "true", "la primera vez, Desde costa");
    assert.equal(await pagina.locator("#modPill-costa").getAttribute("aria-label"), "Desde costa");
    await pagina.evaluate(() => { window.cambios = []; document.addEventListener("modalidad", (e) => window.cambios.push(e.detail.modalidad)); });
    await pagina.locator("#modPill-embarcacion").click();
    assert.equal(await pagina.locator("#modPill-embarcacion").getAttribute("aria-checked"), "true");
    assert.equal(await pagina.locator("#modPill-costa").getAttribute("aria-checked"), "false");
    assert.equal(await pagina.locator("#modalidadNombre").textContent(), "Embarcación");
    assert.ok(await pagina.locator("#modalidadNombre.visible").count(), "al tocar se ve el nombre");
    await pagina.locator("#modPill-embarcacion").press("ArrowRight");
    assert.equal(await pagina.locator("#modPill-submarina").getAttribute("aria-checked"), "true");
    assert.equal(await pagina.evaluate(() => document.activeElement?.id), "modPill-submarina", "el foco sigue a la selección");
    assert.deepEqual(await pagina.evaluate(() => window.cambios), ["embarcacion", "submarina"]);
    assert.equal(await pagina.evaluate(() => localStorage.getItem("va_modalidad")), "submarina");
    assert.equal(await pagina.locator("#modActual").textContent(), "🤿 Submarina", "la ficha dice la modalidad puesta");
    assert.equal(await pagina.locator("#pescaModalidades [role=tab]").count(), 0, "sin pestañas en la ficha");
    await pagina.reload({ waitUntil: "load" });
    await pagina.waitForSelector("#map.leaflet-container", { timeout: 15000 });
    assert.equal(await pagina.locator("#modPill-submarina").getAttribute("aria-checked"), "true", "se recuerda al volver");
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modalidad), "submarina");
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

// Hoja de condiciones del alta (2026-10-22): «Continuar» abre la hoja, el
// botón no se activa sin «He leído y acepto», y al aceptar se pide el enlace
// del alta con la versión aceptada y las estadísticas por interés legítimo.
// Turnstile se sustituye por uno de mentira (su script no se carga aquí).
for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: el alta pide aceptar la hoja de condiciones antes de crear la cuenta`, async () => {
    const ctx = await contexto(opciones, { conSesion: false });
    await ctx.addInitScript(() => { window.turnstile = { render: () => 1, getResponse: () => "token-de-prueba", reset: () => {} }; });
    const peticiones = [];
    await ctx.route("https://imncbmizxkorotpeisic.supabase.co/auth/v1/otp**", (route) => {
      if (route.request().method() === "POST") peticiones.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: "{}" });
    });
    const { pagina, errores } = await abrir(ctx, "/login?alta=1");
    await pagina.locator("#cajaRegistroDatos").waitFor({ state: "visible" });
    assert.equal(await pagina.locator("#checkDatosCapturas").count(), 0, "sin la casilla de capturas anónimas");
    await pagina.fill("#emailRegistro", "nuevo@costaviva.test");
    await pagina.fill("#codigoPostal", "48001");
    await pagina.click("#btnContinuarRegistro");
    const hoja = pagina.locator("#hojaCondiciones");
    await hoja.waitFor({ state: "visible" });
    assert.equal(peticiones.length, 0, "sin aceptar no se pide el enlace");
    assert.equal(await pagina.locator("#btnAceptarHoja").isDisabled(), true);
    for (const t of ["Protección de datos (RGPD)", "Estadísticas anónimas", "Condiciones de pago", "Datos de terceros y disponibilidad"]) {
      assert.ok(await pagina.getByText(t).count(), `falta «${t}»`);
    }
    // El texto se desplaza y la casilla y el botón quedan dentro de la pantalla.
    const caja = await pagina.locator("#btnAceptarHoja").boundingBox();
    assert.ok(caja.y + caja.height <= opciones.viewport.height, "el botón se ve sin desplazar");
    const cuerpo = await pagina.$eval("#hojaCuerpo", (e) => ({ alto: e.clientHeight, total: e.scrollHeight }));
    assert.ok(cuerpo.total > cuerpo.alto, "el texto se desplaza dentro de la hoja");
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.ok(ancho, "sin desplazamiento horizontal");
    await pagina.check("#checkHoja");
    assert.equal(await pagina.locator("#btnAceptarHoja").isDisabled(), false);
    if (opciones.isMobile && process.env.CAPTURA_HOJA) await pagina.screenshot({ path: process.env.CAPTURA_HOJA });
    await pagina.click("#btnAceptarHoja");
    await pagina.locator("#cajaRegistroEsperando").waitFor({ state: "visible" });
    assert.equal(await hoja.isVisible(), false);
    assert.equal(peticiones.length, 1);
    const datos = peticiones[0].data;
    assert.equal(datos.codigo_postal, "48001");
    assert.equal(datos.consiente_uso_datos_capturas, true);
    assert.match(datos.condiciones_alta_version, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(datos.condiciones_alta_aceptadas_en)));
    assert.equal(datos.condiciones_alta_idioma, "es");
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

// perfil: lo que devuelve /rest/v1/perfiles con las columnas nuevas
// (migración 20261023120000).
async function probarTusDatos(perfil, marcadaEsperada, motivo) {
  const ctx = await contexto(MOVIL);
  const llamadas = [];
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
  await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/perfiles**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors, body: "" });
    const url = new URL(route.request().url());
    if ((url.searchParams.get("select") || "").startsWith("consiente_uso_datos_capturas")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(perfil) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
  });
  await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/rpc/fijar_uso_capturas_estadisticas", (route) => {
    if (route.request().method() === "POST") llamadas.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "false" });
  });
  const { pagina, errores } = await abrir(ctx, "/suscripcion");
  await pagina.locator("#bloqueDatos").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await pagina.locator("#checkEstadisticas").isChecked(), marcadaEsperada, motivo);
  if (marcadaEsperada) {
    await pagina.locator("#checkEstadisticas").uncheck();
    await pagina.waitForFunction(() => document.getElementById("mensajeDatos").textContent.length > 0);
    assert.deepEqual(llamadas, [{ p_usar: false }]);
    assert.match(await pagina.locator("#mensajeDatos").textContent(), /dejamos de usar/);
  }
  assert.deepEqual(errores, []);
  await ctx.close();
}

test("Mi suscripción: «Tus datos» deja oponerse a las estadísticas anónimas", async () => {
  await probarTusDatos({ consiente_uso_datos_capturas: true, aviso_condiciones_en: null, oposicion_estadisticas_en: null }, true, "por defecto, activado");
});

test("Mi suscripción: «Tus datos» de una cuenta antigua avisada sale marcada y deja oponerse", async () => {
  await probarTusDatos({ consiente_uso_datos_capturas: false, aviso_condiciones_en: "2026-10-23T09:00:00Z", oposicion_estadisticas_en: null }, true, "en el preaviso aplica el interés legítimo");
});

test("Mi suscripción: «Tus datos» de quien ya se opuso sale desmarcada", async () => {
  await probarTusDatos({ consiente_uso_datos_capturas: false, aviso_condiciones_en: "2026-10-23T09:00:00Z", oposicion_estadisticas_en: "2026-10-24T09:00:00Z" }, false, "opuesto");
});

// Flota pesquera faenando (2026-10-22): la capa sale solo con la modalidad
// Embarcación (evento `modalidad`, no los clics de las pestañas), con su
// control "Hoy (24 h) / Ayer", el filtro de eslora y el aviso sin datos.
// Desde el 2026-10-23 es un mapa de calor en un <canvas> (data-celdas =
// manchas pintadas) con ▶️ de los últimos 14 días.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const diaMadrid = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(ms));
async function rutasFlota(ctx, zonas, historico, parados = []) {
  await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/flota_parados?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(route.request().method() === "OPTIONS" ? {} : parados) }));
  await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/flota_zonas?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(route.request().method() === "OPTIONS" ? {} : zonas) }));
  await ctx.route("https://imncbmizxkorotpeisic.supabase.co/rest/v1/flota_zonas_dia?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(route.request().method() === "OPTIONS" ? {} : historico) }));
}
for (const [nombre, opciones] of [["ordenador", PC], ["móvil", MOVIL]]) {
  test(`${nombre}: flota faenando solo en Embarcación, con Hoy/Ayer, eslora y aviso sin datos`, async () => {
    const ctx = await contexto(opciones);
    const calculado = new Date().toISOString();
    const fila = (periodo, clase, n, lat) => ({ periodo, clase, n_barcos: n, celda_lat: lat, celda_lon: -3.1, especie_probable: null, calculado });
    const hoy = diaMadrid(Date.now()), ayer = diaMadrid(Date.now() - 864e5);
    const hist = (dia, n, lat) => ({ dia, clase: "todas", n_barcos: n, celda_lat: lat, celda_lon: -3.1, especie_probable: null });
    await rutasFlota(ctx, [
      fila("24h", "todas", 5, 43.6), fila("24h", "<24", 3, 43.6), fila("24h", "todas", 12, 43.7), fila("ayer", "todas", 4, 43.5),
    ], [hist(ayer, 6, 43.5), hist(ayer, 3, 43.4), hist(hoy, 8, 43.6)], [
      { tipo: "puerto", puerto: "Ondarroa", lat: 43.322, lon: -2.418, n_barcos: 14, escucha: calculado },
      { tipo: "mar", puerto: null, lat: 43.6, lon: -2.85, n_barcos: 3, escucha: calculado },
    ]);
    const { pagina, errores } = await abrir(ctx, "/");
    await pagina.waitForSelector("#map.leaflet-container", { timeout: 15000 });
    await pagina.waitForFunction(() => window.Flota && window.supabaseCliente, null, { timeout: 15000 });
    const modalidad = (m) => pagina.locator(`#modPill-${m}`).click();
    const celdas = () => pagina.evaluate(() => { const c = document.querySelector("canvas[data-flota-calor]"); return c ? +c.dataset.celdas : 0; });
    const pintado = () => pagina.evaluate(() => {
      const c = document.querySelector("canvas[data-flota-calor]");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
    const control = pagina.locator("[data-flota-control]");

    assert.equal(await control.count(), 0, "en Desde costa no hay capa");
    await modalidad("embarcacion");
    await control.waitFor({ state: "visible" });
    // En el móvil empieza plegado en un chip; en el ordenador, abierto.
    const chip = pagina.locator("[data-flota-chip]");
    if (opciones.isMobile) {
      assert.equal(await chip.getAttribute("aria-expanded"), "false");
      assert.match(await chip.innerText(), /Flota\s*▾/);
      assert.equal(await pagina.locator("[data-flota-clase]").isVisible(), false);
      await chip.click();
    }
    assert.equal(await chip.getAttribute("aria-expanded"), "true");
    assert.equal(await pagina.locator("[data-flota-clase]").isVisible(), true);
    await pagina.waitForFunction(() => +document.querySelector("canvas[data-flota-calor]")?.dataset.celdas > 0, null, { timeout: 10000 });
    assert.equal(await celdas(), 2, "dos manchas en las últimas 24 h");
    assert.ok(await pintado() > 100, "el calor se ve (píxeles con color)");
    // 🔴 Parados de la última escucha: encendidos por defecto, con su cifra.
    const parados = pagina.locator(".flota-parado");
    assert.equal(await parados.count(), 2);
    assert.deepEqual((await parados.allInnerTexts()).sort(), ["14", "3"]);
    assert.equal(await pagina.locator(".flota-parado[title='Ondarroa · 14 parados']").count(), 1);
    assert.match(await pagina.locator("[data-flota-escucha]").innerText(), /^Última escucha: \d{2}:\d{2}$/);
    const casilla = pagina.locator("[data-flota-parados]");
    assert.equal(await casilla.isChecked(), true);
    await casilla.uncheck();
    assert.equal(await parados.count(), 0, "la casilla los quita");
    await casilla.check();
    assert.equal(await parados.count(), 2);
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

    // ▶️ 14 días: cada fotograma es un día; la barra lo para y enseña ese día.
    const play = pagina.locator("[data-flota-play]");
    assert.equal(await play.isDisabled(), false, "con 2 días de histórico hay play");
    await play.click();
    assert.equal(await play.getAttribute("aria-label"), "Pausar");
    assert.equal(await pagina.locator("[data-periodo='24h']").getAttribute("aria-pressed"), "false");
    await play.click();
    assert.equal(await play.getAttribute("aria-label"), "Reproducir");
    const barra = pagina.locator("[data-flota-dia]");
    await barra.fill("12"); // ayer
    assert.equal(await celdas(), 2, "ayer (histórico): dos manchas");
    assert.match(await pagina.locator("[data-flota-fecha]").innerText(), new RegExp(String(+ayer.slice(8))));
    await barra.fill("13"); // hoy
    assert.equal(await celdas(), 1);
    await barra.fill("0"); // hace 13 días, sin datos
    assert.equal(await celdas(), 0);
    assert.match(await pagina.locator("[data-flota-vacio]").innerText(), /Sin flota faenando registrada el /);
    await pagina.locator("[data-periodo='24h']").click();
    assert.equal(await celdas(), 2, "Hoy (24 h) vuelve a lo de siempre");

    await modalidad("costa");
    assert.equal(await control.count(), 0, "al salir de Embarcación desaparece");
    assert.equal(await pagina.locator(".flota-parado").count(), 0, "y los parados también");
    assert.equal(await celdas(), 0);
    assert.doesNotMatch(await pagina.locator(".leaflet-control-attribution").innerText(), /aisstream\.io/);
    // Al volver con Embarcación recordada, la capa sale sola al cargar.
    await modalidad("embarcacion");
    await pagina.reload({ waitUntil: "load" });
    await pagina.waitForFunction(() => window.Flota, null, { timeout: 15000 });
    await control.waitFor({ state: "visible" });
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

test("flota faenando sin datos: aviso «Sin flota faenando registrada en las últimas 24 h» y ▶️ sin días", async () => {
  const ctx = await contexto(PC);
  const { pagina, errores } = await abrir(ctx, "/");
  await pagina.waitForFunction(() => window.Flota && window.supabaseCliente, null, { timeout: 15000 });
  await pagina.evaluate(() => document.dispatchEvent(new CustomEvent("modalidad", { detail: { modalidad: "embarcacion" } })));
  await pagina.waitForSelector("[data-flota-vacio]:not([hidden])", { state: "attached" });
  assert.equal(await pagina.locator("[data-flota-vacio]").innerText(), "Sin flota faenando registrada en las últimas 24 h");
  assert.equal(await pagina.locator("[data-flota-fecha]").innerText(), "Aún no hay días suficientes");
  assert.equal(await pagina.locator("[data-flota-play]").isDisabled(), true);
  assert.equal(await pagina.locator("[data-flota-escucha]").innerText(), "Sin grupos de 3 o más barcos");
  assert.equal(await pagina.locator(".flota-parado").count(), 0);
  assert.deepEqual(errores, []);
  await ctx.close();
});
