// Test de la lista blanca que decide qué se sirve en público
// (functions/_lib/rutas-publicas.js, usada por functions/_middleware.js).
//
// Portado de Pólizas.ai (test/rutas-publicas.test.js) — propuesto por el
// robot de mejores prácticas en su primera pasada, 2026-09-25. No necesita
// red ni Supabase: es lógica pura y corre en milisegundos.
//
// EL CASO QUE DE VERDAD IMPORTA no es "lo que ya sabíamos que había que
// bloquear", sino la regresión al revés: un fichero NUEVO, que nadie ha
// añadido a ninguna lista, debe seguir bloqueado por defecto. Eso es
// exactamente lo que falló TRES veces en este repo bajo el modelo de lista
// negra —CLAUDE.md y functions/ (2026-09-13), scripts/ (2026-09-18) y
// .github/ (2026-09-25)— y lo que la migración a lista blanca pretende
// hacer estructuralmente imposible.
//
// Hasta ahora ese mecanismo solo se había comprobado UNA vez, a mano con
// curl contra producción tras el despliegue. Este test lo fija en CI, así
// que una regresión futura del tipo "alguien amplía un prefijo de más" o
// "alguien borra una entrada sin querer" se ve antes de mergear, no meses
// después.

import { test } from "node:test";
import assert from "node:assert/strict";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

test("las páginas de la app son públicas, en sus dos formas", () => {
  // Cloudflare Pages redirige (308) /x.html -> /x, así que hacen falta las
  // dos: la .html para que el middleware no corte la petición original antes
  // del redirect, y la corta porque es la que el navegador acaba pidiendo.
  for (const ruta of [
    "/",
    "/index.html",
    "/login.html",
    "/login",
    "/diario.html",
    "/diario",
    "/alarma.html",
    "/alarma",
    "/grupos.html",
    "/grupos",
    "/suscripcion.html",
    "/suscripcion",
    "/admin.html",
    "/admin",
  ]) {
    assert.equal(esRutaPermitida(ruta), true, `${ruta} debería ser pública`);
  }
});

test("los estáticos de la raíz son públicos", () => {
  for (const ruta of ["/icon.svg", "/manifest.json", "/robots.txt", "/sitemap.xml"]) {
    assert.equal(esRutaPermitida(ruta), true, `${ruta} debería ser pública`);
  }
});

test("los endpoints de functions/ llegan a su propio código", () => {
  // Listarlos aquí no los abre: cada uno mantiene su autenticación (token de
  // sesión, X-Cron-Secret, firma de Stripe). Lo que se comprueba es que el
  // middleware no los corta antes de llegar a ella.
  for (const ruta of [
    "/prevision",
    "/luna",
    "/rayos-imagen",
    "/geocodificar",
    "/sos-alerta",
    "/identificar-captura",
    "/viento-campo",
    "/crear-checkout-stripe",
    "/crear-portal-stripe",
    "/stripe-webhook",
    "/notificar-altas",
    "/avisar-fin-prueba",
    "/registrar-presion",
    "/registrar-turbidez",
    "/registrar-estado-camaras",
    "/actualizar-euskalmet-rios",
    "/informe-diario-email",
    "/mareas",
  ]) {
    assert.equal(esRutaPermitida(ruta), true, `${ruta} debería llegar a su función`);
  }
});

test("los prefijos dinámicos son públicos", () => {
  for (const ruta of [
    "/webcam/mundaka",
    "/webcam/aguilas",
    "/mareas/mundaka",
    "/mareas/region/pais-vasco",
    "/assets/hero-peces.mp4",
    "/assets/js/leaflet-velocity.js",
    // Las imágenes del robot de marketing TIENEN que ser públicas:
    // Instagram las descarga por URL al crear el borrador del post.
    "/assets/marketing/2026-09-25-condiciones-bakio.png",
  ]) {
    assert.equal(esRutaPermitida(ruta), true, `${ruta} debería ser pública`);
  }
});

test("los tres incidentes históricos de exposición siguen cerrados", () => {
  // Cada una de estas rutas se sirvió en público de verdad en algún momento.
  // No es una lista teórica.
  for (const ruta of [
    "/CLAUDE.md", // 2026-09-13
    "/functions/prevision.js", // 2026-09-13
    "/functions/webcam/[slug].js",
    "/scripts/turbidez/medir-turbidez.mjs", // 2026-09-18
    "/scripts/camaras/comprobar-camaras.mjs",
    "/.github/workflows/daily-report.yml", // 2026-09-25
    "/.github/workflows/smoke-test.yml",
  ]) {
    assert.equal(esRutaPermitida(ruta), false, `${ruta} NO debería servirse: ya se expuso una vez`);
  }
});

test("el resto de ficheros internos está bloqueado", () => {
  for (const ruta of [
    "/ROBOT.md",
    "/ROBOT_REGLAS.md",
    "/CALIBRACION.jsonl",
    "/COMPARATIVA_PROYECTOS.md",
    "/README.md",
    "/start.ps1",
    "/supabase/schema.sql",
    "/supabase/migrations/20260925180000_aviso_fin_prueba.sql",
    "/supabase/baseline-seguridad.json",
    "/test/rutas-publicas.test.js",
    "/functions/_lib/rutas-publicas.js",
    "/.git/config",
  ]) {
    assert.equal(esRutaPermitida(ruta), false, `${ruta} NO debería servirse`);
  }
});

test("FAIL-CLOSED: un fichero nunca visto está bloqueado por defecto", () => {
  // Este es el test importante, y el motivo de haber migrado a lista blanca.
  // Ninguna de estas rutas existe hoy: son las que alguien podría crear
  // mañana sin acordarse de tocar el middleware. Con lista negra, todas se
  // habrían servido en silencio.
  for (const ruta of [
    "/notas-internas.md",
    "/credenciales.json",
    "/backup/usuarios.csv",
    "/data/snapshot/watchdog.json", // el fichero real que expuso Pólizas.ai
    "/.env",
    "/.env.local",
    "/config/secretos.yml",
    "/docs/arquitectura.md",
    "/tmp/volcado.sql",
    "/node_modules/paquete/index.js",
    "/package.json",
    "/wrangler.toml",
  ]) {
    assert.equal(
      esRutaPermitida(ruta),
      false,
      `${ruta} debería estar bloqueada por defecto: si este test falla, la lista blanca ha dejado de ser fail-closed`
    );
  }
});

test("un prefijo público no abre la puerta a rutas de fuera", () => {
  // Comprobación de que los prefijos son prefijos de verdad y no comodines
  // sueltos: algo que solo se PAREZCA a un prefijo público no debe colarse.
  for (const ruta of ["/assets", "/webcam", "/mareasx", "/assetsfalso/x.js", "/webcams-privado/a.jpg"]) {
    assert.equal(esRutaPermitida(ruta), false, `${ruta} no debería colarse por parecerse a un prefijo público`);
  }
});
