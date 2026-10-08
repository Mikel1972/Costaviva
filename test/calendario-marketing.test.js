// Calendario de redes y publicación en Instagram + Facebook (2026-10-09).
// Lógica pura, sin red ni Meta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as C from "../scripts/marketing/calendario.mjs";
import { incrustarPieza, extraerPieza, redesPedidas, tipoDeError, cuerpoIssue } from "../scripts/marketing/pieza-issue.mjs";
import { bloqueParaHora, mareaDelDia, tarjetaMareaFutura } from "../scripts/marketing/pieza-datos.mjs";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

test("3 posts y 1 reel por semana, con su hora", () => {
  assert.equal(C.CALENDARIO.filter((h) => h.formato === "post").length, 3);
  assert.equal(C.CALENDARIO.filter((h) => h.formato === "reel").length, 1);
  assert.deepEqual(new Set(C.CALENDARIO.filter((h) => h.formato === "post").map((h) => h.tipo)), new Set(["especie", "funcion", "condiciones"]));
});

test("la víspera prepara la pieza de mañana, y no la repite", () => {
  // Lunes 12/10/2026 a las 19:30 de Madrid -> post del martes 13 (especie).
  const lunesTarde = new Date("2026-10-12T17:30:00Z");
  const p = C.piezaAPreparar({ formato: "post", ahora: lunesTarde });
  assert.deepEqual({ fecha: p.fecha, tipo: p.tipo, hora: p.hora, dia: p.dia }, { fecha: "2026-10-13", tipo: "especie", hora: "08:00", dia: "martes" });
  // Ya hecha: el respaldo de GitHub no la repite.
  const estado = C.apuntarGenerada({}, p.clave, { tipo: "especies" });
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: lunesTarde, estado }), null);
  // Martes por la tarde: el miércoles no toca post.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-13T17:30:00Z") }), null);
  // Miércoles -> jueves función; jueves -> viernes condiciones; viernes -> reel del sábado.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-14T17:30:00Z") }).tipo, "funcion");
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-15T17:30:00Z") }).tipo, "condiciones");
  assert.equal(C.piezaAPreparar({ formato: "reel", ahora: new Date("2026-10-16T17:10:00Z") }).fecha, "2026-10-17");
  // Forzado a mano: vale cualquier día.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-13T17:30:00Z"), tipoForzado: "condiciones" }).tipo, "condiciones");
  assert.equal(C.piezaAPreparar({ formato: "post", fechaForzada: "2026-10-16" }).tipo, "condiciones");
});

test("cerca de medianoche UTC, 'mañana' es la de España", () => {
  // Lunes 23:30 UTC = martes 01:30 en Madrid: mañana es miércoles (sin post).
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-12T23:30:00Z") }), null);
});

test("hora de España con verano e invierno", () => {
  assert.equal(C.instanteMadrid("2026-10-13", "08:00").toISOString(), "2026-10-13T06:00:00.000Z");
  assert.equal(C.instanteMadrid("2026-11-03", "08:00").toISOString(), "2026-11-03T07:00:00.000Z");
});

test("el estado guarda solo las 40 últimas piezas", () => {
  let e = {};
  for (let i = 0; i < 50; i++) e = C.apuntarGenerada(e, `2026-01-${String(i).padStart(2, "0")}-post`, {});
  assert.equal(Object.keys(e.generadas).length, 40);
});

test("rotación de funciones del jueves", () => {
  assert.equal(C.siguienteFuncion(undefined), "diario");
  assert.equal(C.siguienteFuncion("diario"), "grupos");
  assert.equal(C.siguienteFuncion("alarma"), "diario");
});

test("enlaces con UTM por red y por pieza", () => {
  const campana = C.campanaDePieza("2026-10-13", "especies-lubina-europea");
  assert.equal(campana, "20261013-especies-lubina-europea");
  assert.match(C.campanaDePieza("2026-10-13", "Condiciones Sopelana/ÁÉ"), /^[a-z0-9][a-z0-9_-]{0,59}$/);
  assert.equal(C.enlaceCampana("facebook", campana), "https://costaviva.org/empieza?utm_source=facebook&utm_medium=social&utm_campaign=20261013-especies-lubina-europea");
  const base = `Texto\n🔗 Pruébala 7 días gratis: ${C.MARCA_ENLACE}`;
  const ig = C.captionParaRed(base, "instagram", campana);
  const fb = C.captionParaRed(base, "facebook", campana);
  assert.match(ig, /costaviva\.org\/empieza\?utm_source=instagram&utm_medium=social&utm_campaign=20261013-especies-lubina-europea \(o en el enlace de la bio\)/);
  assert.doesNotMatch(ig, /https:\/\//);
  assert.match(fb, /https:\/\/costaviva\.org\/empieza\?utm_source=facebook/);
  assert.ok(!ig.includes(C.MARCA_ENLACE) && !fb.includes(C.MARCA_ENLACE));
  // Sin hueco (texto antiguo): se añade al final.
  assert.match(C.captionParaRed("Hola", "facebook", campana), /Hola\n\n🔗 Pruébala 7 días gratis: https:/);
  assert.throws(() => C.enlaceCampana("tiktok", campana));
});

test("todos los textos de los robots llevan el enlace de la campaña", () => {
  for (const f of ["scripts/marketing/generar-post-instagram.mjs", "scripts/marketing/generar-reel-instagram.mjs"]) {
    const t = leer(f);
    assert.ok((t.match(/MARCA_ENLACE\}/g) || []).length >= 3, `${f}: falta {ENLACE} en algún texto`);
    assert.doesNotMatch(t, /enlace en la bio\."/, `${f}: texto sin enlace con UTM`);
  }
});

test("la pieza viaja en el Issue y se recupera igual", () => {
  const pieza = { tipo: "condiciones", publicUrl: "https://costaviva.org/x.png", creationId: "123", captionInstagram: "a -- b --> c", captionFacebook: "d", campana: "20261013-x" };
  const cuerpo = cuerpoIssue({ pieza, previa: pieza.publicUrl, cuando: "martes 13/10 a las 08:00", caduca: "mañana", facebookListo: true });
  assert.deepEqual(extraerPieza(cuerpo), pieza);
  assert.equal(incrustarPieza(pieza).slice(4, -3).includes("--"), false, "un -- dentro rompería el comentario HTML");
  assert.equal(extraerPieza("sin pieza"), null);
  assert.equal(extraerPieza("<!-- PIEZA {roto -->"), null);
  assert.match(cuerpoIssue({ pieza, previa: "x", cuando: "c", caduca: "d", facebookListo: false }), /Facebook: \*\*sin configurar\*\*/);
});

test("redes pedidas y errores de Meta", () => {
  assert.deepEqual(redesPedidas("instagram y facebook"), ["instagram", "facebook"]);
  assert.deepEqual(redesPedidas("solo facebook"), ["facebook"]);
  assert.deepEqual(redesPedidas(""), ["instagram", "facebook"]);
  assert.equal(tipoDeError({ error: { code: 190, type: "OAuthException" } }), "token");
  assert.equal(tipoDeError({ error: { code: 200, type: "OAuthException", message: "(#200) Requires pages_manage_posts permission" } }), "permiso");
  assert.equal(tipoDeError({ error: { code: 10 } }), "permiso");
  assert.equal(tipoDeError({ error: { code: 1 } }), "otro");
  assert.equal(tipoDeError({}), null);
});

test("datos de la hora de publicación: bloque, mareas del día", () => {
  const bloques = [{ horaISO: "2026-10-12T21:00" }, { horaISO: "2026-10-13T06:00" }, { horaISO: "2026-10-13T09:00" }];
  assert.equal(bloqueParaHora(bloques, "2026-10-13T08:00").horaISO, "2026-10-13T06:00");
  assert.equal(bloqueParaHora(bloques, "2026-10-12T10:00").horaISO, "2026-10-12T21:00");
  const nivel = [0, 1, 2, 1, 0, -1, -2, -1, 0, 1, 2, 1, 0];
  const horas = nivel.map((n, i) => ({ hora: `2026-10-13T${String(i + 3).padStart(2, "0")}:00`, nivelMar: n }));
  const ext = mareaDelDia(horas, "2026-10-13");
  assert.deepEqual(ext.map((e) => `${e.tipo} ${e.hora}`), ["pleamar 05:00", "bajamar 09:00", "pleamar 13:00"]);
  assert.deepEqual(tarjetaMareaFutura(ext, "08:00"), { icono: "marea", etq: "Marea", val: "↓ 09:00", sub: "bajamar, luego pleamar 13:00" });
  assert.equal(tarjetaMareaFutura([], "08:00").val, "—");
});

test("publicar sigue siendo solo manual y pg_cron no puede lanzarlo", () => {
  const pub = leer(".github/workflows/publicar-post-instagram.yml");
  assert.doesNotMatch(pub, /schedule:/);
  assert.match(pub, /ISSUE_NUMBER: \$\{\{ inputs\.issue_number \}\}/, "inputs por entorno, no pegados en el script");
  const sql = leer("supabase/migrations/20261009130000_programador_marketing.sql");
  const lista = sql.match(/if workflow not in \(([^)]*)\)/)[1];
  assert.match(lista, /robot-marketing-instagram\.yml/);
  assert.match(lista, /robot-reel-instagram\.yml/);
  assert.doesNotMatch(lista, /publicar-post-instagram|aplicar-migraciones/);
  for (const w of ["robot-marketing-instagram.yml", "robot-reel-instagram.yml"]) {
    const t = leer(`.github/workflows/${w}`);
    assert.match(t, /META_PAGE_ID: \$\{\{ vars\.META_PAGE_ID \}\}/);
    assert.match(t, /steps\.generar\.outputs\.generada == 'true'/);
    assert.doesNotMatch(t, /media_publish|publicar-pieza/, `${w} no publica nunca`);
  }
});
