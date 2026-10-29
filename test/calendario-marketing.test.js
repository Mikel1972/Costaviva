// Calendario de redes y publicación en Instagram + Facebook (2026-10-09).
// Lógica pura, sin red ni Meta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as C from "../scripts/marketing/calendario.mjs";
import { incrustarPieza, extraerPieza, redesPedidas, tipoDeError, cuerpoIssue } from "../scripts/marketing/pieza-issue.mjs";
import { bloqueParaHora, mareaDelDia, tarjetaMareaFutura } from "../scripts/marketing/pieza-datos.mjs";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

test("España: 3 posts y 1 reel por semana, con su hora", () => {
  const es = C.CALENDARIO.filter((h) => h.mercado === "es");
  assert.equal(es.filter((h) => h.formato === "post").length, 3);
  assert.equal(es.filter((h) => h.formato === "reel").length, 1);
  assert.deepEqual(new Set(es.filter((h) => h.formato === "post").map((h) => h.tipo)), new Set(["especie", "funcion", "condiciones"]));
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
  const base = `Texto\n🔗 Pruébala 14 días gratis: ${C.MARCA_ENLACE}`;
  const ig = C.captionParaRed(base, "instagram", campana);
  const fb = C.captionParaRed(base, "facebook", campana);
  assert.match(ig, /costaviva\.org\/empieza\?utm_source=instagram&utm_medium=social&utm_campaign=20261013-especies-lubina-europea \(o en el enlace de la bio\)/);
  assert.doesNotMatch(ig, /https:\/\//);
  assert.match(fb, /https:\/\/costaviva\.org\/empieza\?utm_source=facebook/);
  assert.ok(!ig.includes(C.MARCA_ENLACE) && !fb.includes(C.MARCA_ENLACE));
  // Sin hueco (texto antiguo): se añade al final.
  assert.match(C.captionParaRed("Hola", "facebook", campana), /Hola\n\n🔗 Pruébala 14 días gratis: https:/);
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

// El workflow MANUAL sigue siendo manual. La publicación automática con veto
// (2026-10-11) va aparte: publicar-con-veto.yml (test/publicacion-veto.test.js).
test("el publicador manual sigue siendo manual y pg_cron no puede lanzarlo", () => {
  const pub = leer(".github/workflows/publicar-post-instagram.yml");
  assert.doesNotMatch(pub, /schedule:/);
  assert.match(pub, /ISSUE_NUMBER: \$\{\{ inputs\.issue_number \}\}/, "inputs por entorno, no pegados en el script");
  const sql = leer("supabase/migrations/20261009130000_programador_marketing.sql");
  const lista = sql.match(/if workflow not in \(([^)]*)\)/)[1];
  // Los mismos seis que 20261009140000_programador_aprendizaje.sql (PR #143),
  // para que el orden de aplicación no importe.
  assert.deepEqual([...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(), [
    "aprendizaje-semanal.yml", "camaras-salud.yml", "espuma-camaras.yml",
    "notificar-altas.yml", "robot-marketing-instagram.yml", "robot-reel-instagram.yml",
  ]);
  assert.doesNotMatch(lista, /publicar-post-instagram|aplicar-migraciones/);
  for (const w of ["robot-marketing-instagram.yml", "robot-reel-instagram.yml"]) {
    const t = leer(`.github/workflows/${w}`);
    assert.match(t, /META_PAGE_ID: \$\{\{ vars\.META_PAGE_ID \}\}/);
    assert.match(t, /steps\.generar\.outputs\.generada == 'true'/);
    assert.doesNotMatch(t, /media_publish|publicar-pieza/, `${w} no publica nunca`);
  }
});

// ---------------------------------------------------------------------------
// Nueva Zelanda (2026-10-11, pedido de Mikel): piezas en inglés a las 07:00
// hora de NZ, solo con datos de NZ, y publicación igual de manual.
import * as NZ from "../scripts/marketing/pieza-nz.mjs";
import * as P from "../scripts/marketing/palabras-redes.mjs";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { elegirEspeciePost, leerEspeciesJson } from "../scripts/marketing/especie-post.mjs";
import { resumenDelDia } from "../scripts/marketing/pieza-datos.mjs";

test("NZ: huecos a las 07:00 en Pacific/Auckland, sin funciones de la app", () => {
  assert.equal(C.MERCADOS.nz.zona, "Pacific/Auckland");
  assert.equal(C.MERCADOS.nz.idioma, "en");
  const nz = C.CALENDARIO.filter((h) => h.mercado === "nz");
  assert.ok(nz.length >= 2);
  for (const h of nz) assert.equal(h.hora, "07:00");
  assert.deepEqual(new Set(nz.filter((h) => h.formato === "post").map((h) => h.tipo)), new Set(["especie", "condiciones"]));
  assert.ok(nz.every((h) => h.tipo === null || C.TIPOS_NZ.includes(h.tipo)));
});

test("NZ: 'mañana' es la de NZ y la clave no choca con la de España", () => {
  // Lunes 12/10/2026 06:40 UTC = lunes 19:40 NZDT -> martes 13 (especie).
  const p = C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-12T06:40:00Z"), mercado: "nz" });
  assert.deepEqual({ fecha: p.fecha, tipo: p.tipo, hora: p.hora, clave: p.clave, idioma: p.idioma, zona: p.zona },
    { fecha: "2026-10-13", tipo: "especie", hora: "07:00", clave: "2026-10-13-post-nz", idioma: "en", zona: "Pacific/Auckland" });
  // La de España del mismo martes es otra pieza: hacer una no salta la otra.
  const estado = C.apuntarGenerada({}, p.clave, {});
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-12T17:30:00Z"), estado }).clave, "2026-10-13-post");
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-12T06:40:00Z"), mercado: "nz", estado }), null);
  // Jueves -> viernes condiciones; viernes -> reel del sábado.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-15T06:40:00Z"), mercado: "nz" }).tipo, "condiciones");
  assert.equal(C.piezaAPreparar({ formato: "reel", ahora: new Date("2026-10-16T06:20:00Z"), mercado: "nz" }).fecha, "2026-10-17");
  // Miércoles en NZ no toca post; y en NZ no hay piezas de funciones.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-13T06:40:00Z"), mercado: "nz" }), null);
  assert.throws(() => C.piezaAPreparar({ formato: "post", mercado: "nz", tipoForzado: "diario" }), /NZ/);
  // Un mercado desconocido es España.
  assert.equal(C.piezaAPreparar({ formato: "post", ahora: new Date("2026-10-12T17:30:00Z"), mercado: "xx" }).mercado, "es");
});

test("NZ: 07:00 con horario de verano (NZDT) e invierno (NZST), y su hora de España", () => {
  assert.equal(C.instanteEn("2026-10-13", "07:00", "Pacific/Auckland").toISOString(), "2026-10-12T18:00:00.000Z");
  assert.equal(C.instanteEn("2026-06-16", "07:00", "Pacific/Auckland").toISOString(), "2026-06-15T19:00:00.000Z");
  // El día del cambio (NZ adelanta la hora el 27/09/2026 a las 02:00).
  assert.equal(C.instanteEn("2026-09-27", "07:00", "Pacific/Auckland").toISOString(), "2026-09-26T18:00:00.000Z");
  // Lo de España sigue igual.
  assert.equal(C.instanteMadrid("2026-10-25", "08:00").toISOString(), "2026-10-25T07:00:00.000Z");
  const cuando = C.textoCuando({ fecha: "2026-10-13", hora: "07:00", dia: "martes", mercado: "nz" });
  assert.equal(cuando, "martes 13/10 a las 07:00 hora de Nueva Zelanda (en España: lunes 12/10 a las 20:00)");
  assert.equal(C.textoCuando({ fecha: "2026-10-13", hora: "08:00", dia: "martes" }), "martes 13/10 a las 08:00");
});

test("NZ: enlace con UTM igual que España, con el texto en inglés", () => {
  const campana = C.campanaDePieza("2026-10-13", "especies-" + "nz-snapper");
  assert.equal(campana, "20261013-especies-nz-snapper");
  const base = `Text\n🔗 Try it free for 14 days: ${C.MARCA_ENLACE}`;
  const ig = C.captionParaRed(base, "instagram", campana, "en");
  assert.match(ig, /costaviva\.org\/empieza\?utm_source=instagram&utm_medium=social&utm_campaign=20261013-especies-nz-snapper \(or tap the link in bio\)/);
  assert.match(C.captionParaRed(base, "facebook", campana, "en"), /https:\/\/costaviva\.org\/empieza\?utm_source=facebook/);
  assert.match(C.captionParaRed("Hi", "facebook", campana, "en"), /Hi\n\n🔗 Try it free for 14 days: https:/);
  for (const f of ["scripts/marketing/generar-nz.mjs"]) assert.ok((leer(f).match(/MARCA_ENLACE\}/g) || []).length >= 2, `${f}: falta {ENLACE}`);
  assert.ok((leer("scripts/marketing/generar-reel-instagram.mjs").match(/MARCA_ENLACE\}/g) || []).length >= 5);
});

test("NZ: zonas en ciclos completos, primero la que más se busca en NZ", () => {
  const zonas = NZ.zonasConSpots(SPOTS_NZ);
  assert.ok(zonas.length >= 10);
  for (const z of zonas) for (const slug of z.spots) {
    const s = SPOTS_NZ.find((x) => x.slug === slug);
    assert.ok(s && s.pais === "nz" && s.modalidades.includes("costa"), slug);
  }
  // Sin palabras clave: el orden de la lista, sin repetir hasta acabar.
  let estado = {}, vistas = [];
  for (let i = 0; i < zonas.length; i++) {
    const r = NZ.elegirZonaNZ(zonas, estado, null, 10);
    vistas.push(r.zona.slug); estado = r.estado;
  }
  assert.equal(new Set(vistas).size, zonas.length);
  assert.equal(vistas[0], zonas[0].slug);
  const otra = NZ.elegirZonaNZ(zonas, estado, null, 10);
  assert.equal(otra.estado.ciclo, 2);
  // Con demanda de NZ (y nada de España), manda la zona más buscada.
  const palabras = { terminos: [
    { termino: "otago fishing spots", mercado: "nz", grupo: "region", puntuacion: 80, url: "/en/spots/region/otago" },
    { termino: "pesca otago", mercado: "es", grupo: "region", puntuacion: 99, url: "/en/spots/region/canterbury" },
  ] };
  const r = NZ.elegirZonaNZ(zonas, {}, palabras, 10);
  assert.equal(r.zona.slug, "otago");
  assert.ok(r.porDemanda);
  assert.equal(r.estado.ultimaRegion, SPOTS_NZ.find((s) => s.zona === "Otago").region);
  // Ya usada en el ciclo: no se repite aunque se busque más.
  assert.notEqual(NZ.elegirZonaNZ(zonas, r.estado, palabras, 10).zona.slug, "otago");
});

test("NZ: especie, spot y hashtags por las palabras clave de NZ, nunca las de España", () => {
  const datos = leerEspeciesJson(new URL("..", import.meta.url).pathname);
  const palabras = { terminos: [
    { termino: "kahawai fishing", mercado: "nz", grupo: "especie", puntuacion: 90, tendencia: "sube", url: "/en/species/" + "nz-kahawai" },
    { termino: "snapper", mercado: "es", grupo: "especie", puntuacion: 99, url: "/en/species/" + "nz-snapper" },
    { termino: "surfcasting", mercado: "nz", grupo: "tecnica", puntuacion: 70 },
    { termino: "jigging", mercado: "es", grupo: "tecnica", puntuacion: 99 },
  ] };
  const pref = P.preferenciaEspecie(palabras, 10, "nz");
  const e = elegirEspeciePost(datos, "nz_auckland_kermadec", 10, 3, { preferencia: pref });
  assert.equal(e.especie.id, "nz-" + "kahawai");
  // Sin palabras: igualmente una especie de NZ de temporada en el área.
  const sin = elegirEspeciePost(datos, "nz_auckland_kermadec", 10, 3, {});
  assert.equal(sin.especie.pais, "nz");
  assert.ok(sin.especie.presencia.nz_auckland_kermadec.meses.includes(10));
  assert.deepEqual(P.hashtagsDemanda(palabras, NZ.HASHTAGS_NZ, { mes: 10, mercado: "nz" }), ["#surfcasting"]);
  assert.deepEqual(P.hashtagsDemanda(palabras, "", { mes: 10 }), ["#jigging"]);
  const spots = ["nz-a", "nz-b"].map((x) => x);
  const orden = P.ordenarSpots(spots, { terminos: [{ termino: "b tides", mercado: "nz", grupo: "marea", puntuacion: 50, url: "/en/tides/" + spots[1] }] }, 10, "nz");
  assert.deepEqual(orden, [spots[1], spots[0]]);
  assert.equal(NZ.hashtagZona({ slug: "bay-of-plenty" }), "#bayofplenty");
});

test("NZ: ficha de especie en inglés, solo con datos de NZ y sin cifras de normativa", () => {
  const datos = leerEspeciesJson(new URL("..", import.meta.url).pathname);
  const elegida = elegirEspeciePost(datos, "nz_central", 11, 0, {});
  const f = NZ.fichaEspecieEn(elegida, "nz_central", 11);
  assert.equal(f.nombre, elegida.especie.nombres.en);
  assert.equal(f.area, "Central");
  assert.match(f.normativa, /^https:\/\/www\.mpi\.govt\.nz\/.*central-fishing-rules/);
  const pieza = NZ.piezaEspecieEn(f, "Tuesday 13 Oct<br>07:00");
  assert.equal(pieza.idioma, "en");
  const texto = JSON.stringify(pieza);
  assert.doesNotMatch(texto, /\d+\s*cm|temporada|Temporada|cebos|Talla/, "nada en español ni tallas");
  assert.match(pieza.especie.nota, /^Shore fishing\. Season in the MPI Central area: /);
});

test("NZ: tarjetas y motivos en inglés; el motivo sin clave de traducción se queda fuera", () => {
  const tarjetas = NZ.tarjetasEn({ altura: [0.8, 1.25], periodo: 9, dirOla: "SO 225°", viento: 18.4, dirViento: "NO" },
    { altura: 1.19, tendencia: "subiendo", proximas: [{ tipo: "pleamar", hora: "10:33" }, { tipo: "bajamar", hora: "16:33" }] });
  assert.deepEqual(tarjetas.map((x) => [x.etq, x.val, x.sub]), [
    ["Waves", "0.8–1.3 m", "9 s · SW"], ["Wind", "18 km/h", "NW, moderate"], ["Tide", "1.2 m ↑", "high 10:33, then low 16:33"],
  ]);
  assert.equal(NZ.tarjetasEn(null, null)[2].val, "—");
  assert.equal(NZ.tarjetasEn({ dirOla: "WSW 243°", dirViento: "WNW", viento: 5 }, null)[1].sub, "WNW, light");
  assert.equal(NZ.tarjetasEn({ dirOla: "WSW 243°" }, null)[0].sub, "WSW");
  const r = NZ.resumenEnIngles({ especie: "Pargo", motivos: [{ texto: "Tide rising", clave: "va.x", flecha: "▲" }, { texto: "Regla a mano", flecha: "▼" }], mejorTramo: { texto: "06–09 h" } }, "Snapper");
  assert.equal(r.especie, "Snapper");
  assert.deepEqual(r.motivos.map((m) => m.texto), ["Tide rising"]);
  assert.equal(r.mejorTramo.texto, "06–09");
  assert.equal(NZ.fechaLegibleNZ(C.instanteEn("2026-10-13", "07:00", "Pacific/Auckland")), "Tuesday 13 Oct<br>07:00");
});

test("NZ: el índice en inglés sale con la misma cuenta que la app", async () => {
  const { I18n } = await import("../assets/js/i18n-modulo.js");
  const especies = leerEspeciesJson(new URL("..", import.meta.url).pathname);
  const s = SPOTS_NZ.find((x) => x.modalidades.includes("costa"));
  const horas = Array.from({ length: 72 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 12, i));
    return { hora: d.toISOString().slice(0, 13) + ":00", nivelMar: null, ola: 0.9, olaDir: 200, viento: 15, vientoDir: 220, tempAgua: 16, presion: 1015, lluvia: 0 };
  });
  const antes = I18n.t("comun.meses_cortos");
  I18n.fijarIdioma("en");
  try {
    const res = resumenDelDia(especies, horas, { lat: s.lat, lon: s.lon, ahoraISO: "2026-10-13T07:00" });
    if (res) {
      assert.ok(especies.especies.find((e) => e.id === res.especieId)?.pais === "nz", "en NZ, especie de NZ");
      const r = NZ.resumenEnIngles(res, "x");
      for (const m of r.motivos) assert.ok(m.clave && !/[áéíóúñ]/.test(m.texto), m.texto);
    }
  } finally {
    I18n.fijarIdioma("es");
  }
  assert.equal(I18n.t("comun.meses_cortos"), antes);
});

test("NZ: los workflows preparan las de NZ la víspera de allí y nunca publican", () => {
  const post = leer(".github/workflows/robot-marketing-instagram.yml");
  assert.match(post, /- cron: "40 6 \* \* 1,4"/);
  assert.match(post, /MERCADO: \$\{\{ inputs\.mercado \|\| \(github\.event\.schedule == '40 6 \* \* 1,4' && 'nz'\) \|\| 'es' \}\}/);
  assert.match(post, /rotacion-zonas-nz\.json/);
  const reel = leer(".github/workflows/robot-reel-instagram.yml");
  assert.match(reel, /- cron: "20 6 \* \* 5"/);
  assert.match(reel, /MERCADO: \$\{\{ inputs\.mercado \|\| \(github\.event\.schedule == '20 6 \* \* 5' && 'nz'\) \|\| 'es' \}\}/);
  assert.match(reel, /rotacion-reels-nz\.json/);
  // Lunes/jueves 06:40 UTC es ya la tarde en NZ (víspera del martes/viernes)
  // y el contenedor de Instagram (24 h) sigue vivo a las 07:00 de NZ.
  for (const [ahora, formato] of [["2026-10-12T05:40:00Z", "post"], ["2026-10-16T05:20:00Z", "reel"], ["2026-10-12T06:40:00Z", "post"], ["2026-10-15T06:40:00Z", "post"], ["2026-10-16T06:20:00Z", "reel"], ["2026-06-15T06:40:00Z", "post"]]) {
    const p = C.piezaAPreparar({ formato, ahora: new Date(ahora), mercado: "nz" });
    assert.ok(p, ahora);
    const margen = C.instanteEn(p.fecha, p.hora, "Pacific/Auckland") - new Date(ahora);
    assert.ok(margen > 6 * 3600e3 && margen < 23 * 3600e3, `${ahora}: ${margen / 3600e3} h`);
  }
  // El Issue dice que es de NZ y la hora de España para darle al botón.
  const pieza = { tipo: "especies-nz", mercado: "nz", captionInstagram: "a", captionFacebook: "b", creationId: "1" };
  assert.match(cuerpoIssue({ pieza, previa: "x", cuando: "c", caduca: "d", facebookListo: true }), /Nueva Zelanda\*\*, en inglés/);
  assert.match(leer("scripts/marketing/publicar-borrador-instagram.mjs"), /captionParaRed\(pendiente\.caption, "instagram", campana, pendiente\.idioma\)/);
});

test("NZ: sin minimapa de EMODnet ni cámaras de terceros, y la plantilla en inglés", () => {
  const gen = leer("scripts/marketing/generar-nz.mjs");
  assert.match(gen, /mapa: null/);
  const codigo = gen.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(codigo, /camara|webcam|youtube|skyline/i);
  const html = leer("scripts/marketing/plantillas/pieza.html");
  for (const en of ["out of 100", "Fishing index", "In season now", "Free for 14 days", "Check your spot at costaviva.org"]) assert.ok(html.includes(en), en);
});

test("NZ: pg_cron lanza las de NZ con mercado=nz y nunca puede publicar", () => {
  const sql = leer("supabase/migrations/20261012090000_programador_marketing_nz.sql");
  const codigo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const lista = codigo.match(/if workflow not in \(([^)]*)\)/)[1];
  assert.deepEqual([...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(), ["robot-marketing-instagram.yml", "robot-reel-instagram.yml"]);
  assert.match(codigo, /jsonb_build_object\('ref', 'main', 'inputs', jsonb_build_object\('mercado', 'nz'\)\)/);
  assert.match(codigo, /security definer\s+set search_path = ''/);
  assert.match(codigo, /revoke all on function public\.lanzar_marketing_nz\(text\) from public, anon, authenticated;/);
  assert.match(codigo, /cron\.schedule\('lanzar-marketing-posts-nz', '40 5 \* \* 1,4'/);
  assert.match(codigo, /cron\.schedule\('lanzar-marketing-reel-nz', '20 5 \* \* 5'/);
  assert.doesNotMatch(codigo, /lanzar_workflow_github|publicar-post-instagram/, "no toca la función general ni puede publicar");
  // El input que manda existe en los dos workflows y admite "nz".
  for (const w of ["robot-marketing-instagram.yml", "robot-reel-instagram.yml"]) assert.match(leer(`.github/workflows/${w}`), /mercado:[\s\S]*?options: \["es", "nz"\]/);
});

test("NZ: el reel nunca usa un clip con personas identificables", () => {
  const fuente = readFileSync(new URL("../scripts/marketing/generar-reel-instagram.mjs", import.meta.url), "utf8");
  assert.match(fuente, /mercado === "nz" && candidato\?\.ficha\?\.personaIdentificable !== false \? null/);
});

// Reel de peces (2026-10-18): el reel de los sábados de España.
test("reel de peces: rota spots y clips, y solo usa vídeos de peces con licencia", async () => {
  const { clipsDePeces, siguienteDe, textoCaudal } = await import("../scripts/marketing/reel-peces.mjs");
  const clips = clipsDePeces();
  assert.ok(clips.includes("pexels-peces-arrecife.mp4"));
  for (const c of clips) assert.ok(!/pescador|cana|carrete/.test(c), `${c} no es de peces`);
  assert.deepEqual(siguienteDe(["a", "b", "c"], "b"), ["c", "a", "b"]);
  assert.deepEqual(siguienteDe(["a", "b", "c"], undefined), ["a", "b", "c"]);
  assert.deepEqual(textoCaudal({ caudal: 10.82, umbralBajo: 438, umbralAlto: 885 }), { val: "10,8 m³/s", sub: "caudal bajo" });
  assert.equal(textoCaudal({ caudal: 900, umbralBajo: 438, umbralAlto: 885 }).sub, "crecido");
  assert.equal(textoCaudal(null), null);
  const texto = readFileSync(new URL("../scripts/marketing/plantillas/reel-peces.html", import.meta.url), "utf8");
  assert.ok(!/primera app/i.test(texto), "nada de 'la primera app' (Ley General de Publicidad)");
  assert.match(texto, /clorofila/);
  assert.match(texto, /Desde costa/); assert.match(texto, /En barco/); assert.match(texto, /Pesca submarina/);
});

test("España en vídeo: el robot de posts lanza el reel de peces si mañana toca post", () => {
  const post = leer(".github/workflows/robot-marketing-instagram.yml");
  assert.match(post, /actions: write/);
  assert.match(post, /gh workflow run robot-reel-instagram\.yml --ref "\$\{GITHUB_REF_NAME\}" -f fecha="\$FECHA" -f tipo=peces -f mercado=es/);
  // Solo España y sin tipo forzado; NZ y los tipos a mano siguen con el post.
  assert.match(post, /if \[ "\$MERCADO" != "es" \] \|\| \[ -n "\$TIPO_PIEZA" \]; then exit 0; fi/);
  for (const paso of ["Instalar dependencias del script", "Instalar Chromium para Playwright", "Generar imagen y texto del post"]) {
    const i = post.indexOf(`- name: ${paso}`);
    assert.ok(i > 0, paso);
    assert.match(post.slice(i, i + 200), /if: steps\.video\.outputs\.lanzado != 'true'/, paso);
  }
  // Martes, jueves y viernes tienen post en España; un reel forzado ese día
  // no choca con el del sábado (clave por fecha).
  for (const f of ["2026-11-03", "2026-11-05", "2026-11-06"]) {
    assert.ok(C.huecoDe(f, "post", "es"), f);
    const p = C.piezaAPreparar({ formato: "reel", fechaForzada: f, tipoForzado: "peces", mercado: "es" });
    assert.equal(p.tipo, "peces");
    assert.equal(p.clave, `${f}-reel`);
  }
});
