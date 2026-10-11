// Publicación automática con veto de 12 h en Instagram y Facebook
// (decisión de Mikel, 2026-10-11: "Automático con veto"). Lógica pura, sin
// red ni Meta: scripts/marketing/veto.mjs y estado-token.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as V from "../scripts/marketing/veto.mjs";
import { evaluarToken, PERMISOS_INSTAGRAM, PERMISO_FACEBOOK } from "../scripts/marketing/estado-token.mjs";
import { cuerpoIssue, extraerPieza } from "../scripts/marketing/pieza-issue.mjs";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

// Post del martes 13/10/2026 a las 08:00 de Madrid (06:00 UTC), Issue
// abierto el lunes a las 19:30 de Madrid (17:30 UTC): 12,5 h de aviso.
const PIEZA = {
  tipo: "especies", esReel: false, publicUrl: "https://costaviva.org/assets/marketing/2026-10-13-especie-lubina.png",
  fecha: "2026-10-13", hora: "08:00", dia: "martes", creationId: "1789", creadoEn: "2026-10-12T17:30:00Z",
  captionInstagram: "Lubina: de temporada ahora mismo. costaviva.org/empieza?utm_source=instagram (o en el enlace de la bio)",
  captionFacebook: "Lubina: de temporada ahora mismo. https://costaviva.org/empieza?utm_source=facebook",
};
const CREADO = "2026-10-12T17:30:00Z";
const EN_HORA = new Date("2026-10-13T06:10:00Z");
const base = (extra = {}) => ({
  issue: 200, pieza: PIEZA, etiquetas: ["marketing"], comentarios: [], dueno: "Mikel1972",
  creado: CREADO, abierto: true, ahora: EN_HORA, automatica: "true", publicados: { instagram: [], facebook: [] }, ...extra,
});
const TOKEN_OK = { instagram: { ok: true }, facebook: { ok: true } };

test("sin veto, en hora y con la variable a true: publica en las dos redes", () => {
  const d = V.decidir(base());
  assert.equal(d.accion, "publicar");
  assert.deepEqual(d.redes, ["instagram", "facebook"]);
  assert.equal(V.textoRedes(d.redes), "instagram y facebook");
});

test("veto por etiqueta: no publica", () => {
  const d = V.decidir(base({ etiquetas: ["marketing", "veto"] }));
  assert.equal(d.accion, "saltar");
  assert.equal(d.vetada, true);
});

test("veto por comentario de Mikel: no publica", () => {
  for (const cuerpo of ["no", "No.", "NO, esta no", "veto", "Vetada, el dato de marea no me cuadra", "> cita del email\nno"]) {
    const d = V.decidir(base({ comentarios: [{ autor: "Mikel1972", cuerpo }] }));
    assert.equal(d.accion, "saltar", cuerpo);
    assert.equal(d.vetada, true, cuerpo);
  }
  // El login se compara sin mayúsculas.
  assert.equal(V.decidir(base({ comentarios: [{ autor: "mikel1972", cuerpo: "veto" }] })).vetada, true);
});

test("comentario de Mikel sin veto, o de otro usuario diciendo no: sí publica", () => {
  assert.equal(V.decidir(base({ comentarios: [{ autor: "Mikel1972", cuerpo: "¡Qué buena pinta! 👍" }] })).accion, "publicar");
  assert.equal(V.decidir(base({ comentarios: [{ autor: "otro-usuario", cuerpo: "no, veto" }] })).accion, "publicar");
  assert.equal(V.decidir(base({ comentarios: [{ autor: "github-actions[bot]", cuerpo: "no" }] })).accion, "publicar");
  // "nota" o "novedad" no son "no".
  assert.equal(V.esComentarioVeto("Nota: novedad de la semana"), false);
});

test("variable PUBLICACION_AUTOMATICA distinta de true: no publica", () => {
  for (const automatica of [undefined, "", "false", "TRUE?", "1"]) {
    assert.equal(V.decidir(base({ automatica })).accion, "saltar", String(automatica));
  }
  assert.equal(V.decidir(base({ automatica: "TRUE" })).accion, "publicar");
});

test("antes de la hora: no publica (espera)", () => {
  const d = V.decidir(base({ ahora: new Date("2026-10-13T05:59:00Z") }));
  assert.equal(d.accion, "esperar");
});

test("12 h de aviso como mínimo: si el Issue llegó tarde, se retrasa", () => {
  // Issue abierto a las 22:00 de Madrid (20:00 UTC) para las 08:00: sale a las 10:00 de Madrid.
  const tarde = "2026-10-12T20:00:00Z";
  assert.equal(V.momentoPublicacion(PIEZA, tarde).toISOString(), "2026-10-13T08:00:00.000Z");
  assert.equal(V.decidir(base({ creado: tarde, pieza: { ...PIEZA, creadoEn: tarde } })).accion, "esperar");
  assert.equal(V.decidir(base({ creado: tarde, pieza: { ...PIEZA, creadoEn: tarde }, ahora: new Date("2026-10-13T08:05:00Z") })).accion, "publicar");
  // Hora de invierno: 08:00 de Madrid = 07:00 UTC.
  assert.equal(V.momentoPublicacion({ fecha: "2026-11-10", hora: "08:00" }, "2026-11-09T10:00:00Z").toISOString(), "2026-11-10T07:00:00.000Z");
  assert.equal(V.momentoPublicacion({ tipo: "x" }, CREADO), null);
});

test("ya publicada: no repite", () => {
  const ig = [{ issueNumber: "200", red: "instagram", fecha: "2026-10-13T06:05:00Z" }];
  const fb = [{ issueNumber: "200", red: "facebook", fecha: "2026-10-13T06:05:00Z" }];
  assert.equal(V.decidir(base({ publicados: { instagram: ig, facebook: fb } })).accion, "saltar");
  assert.equal(V.decidir(base({ abierto: false })).accion, "saltar");
  // Si solo salió en Instagram, falta Facebook.
  const d = V.decidir(base({ publicados: { instagram: ig, facebook: [] } }));
  assert.deepEqual(d.redes, ["facebook"]);
});

test("como mucho 1 publicación al día por red", () => {
  const otraHoy = [{ issueNumber: "199", fecha: "2026-10-13T05:00:00Z" }];
  const d = V.decidir(base({ publicados: { instagram: otraHoy, facebook: [] } }));
  assert.deepEqual(d.redes, ["facebook"]);
  assert.match(d.notas.join(" "), /máximo 1 al día/);
  assert.equal(V.decidir(base({ publicados: { instagram: otraHoy, facebook: otraHoy } })).accion, "avisar");
  // La de ayer no cuenta.
  const ayer = [{ issueNumber: "190", fecha: "2026-10-12T06:00:00Z" }];
  assert.equal(V.decidir(base({ publicados: { instagram: ayer, facebook: ayer } })).redes.length, 2);
});

test("solo piezas propias: nada de webcams de terceros ni personas identificables", () => {
  assert.equal(V.piezaSegura(PIEZA).ok, true);
  assert.equal(V.piezaSegura({ ...PIEZA, publicUrl: "https://www.skylinewebcams.com/foto.jpg" }).ok, false);
  assert.equal(V.piezaSegura({ ...PIEZA, publicUrl: "https://costaviva.org/assets/marketing/webcam-bakio.jpg" }).ok, false);
  const reel = { ...PIEZA, esReel: true, publicUrl: "https://costaviva.org/assets/marketing/reel.mp4" };
  assert.equal(V.piezaSegura({ ...reel, clip: null }).ok, true, "sin clip: fondo de la marca");
  assert.equal(V.piezaSegura({ ...reel, clip: { carpeta: "stock", fichero: "a.mp4", personaIdentificable: false } }).ok, true);
  assert.equal(V.piezaSegura({ ...reel, clip: { carpeta: "stock", fichero: "a.mp4", personaIdentificable: true } }).ok, false);
  assert.equal(V.piezaSegura({ ...reel, clip: { carpeta: "propios", fichero: "b.mp4", personaIdentificable: null } }).ok, false);
  assert.equal(V.piezaSegura(reel).ok, false, "reel antiguo sin datos del clip: solo a mano");
  const d = V.decidir(base({ pieza: { ...PIEZA, publicUrl: "https://example.com/x.png" } }));
  assert.equal(d.accion, "avisar");
  assert.equal(d.revisar, true);
});

test("solo datos reales: un texto con huecos no sale", () => {
  for (const t of ["Índice undefined/100 en Bakio, enlace {ENLACE}", "Índice NaN/100 hoy en la costa", "Mejor especie: null hoy en la costa"]) {
    assert.equal(V.piezaSegura({ ...PIEZA, captionInstagram: t }).ok, false, t);
  }
});

test("borrador de Instagram caducado (24 h): no lo intenta y avisa", () => {
  const d = V.decidir(base({ ahora: new Date("2026-10-13T17:00:00Z") }));
  assert.equal(d.accion, "avisar");
  assert.equal(d.clave, "caducada");
});

test("token: inválido o sin permisos no publica; sin pages_manage_posts, solo Instagram", () => {
  const d = V.decidir(base());
  assert.equal(V.ajustarPorToken(d, TOKEN_OK).accion, "publicar");
  const malo = V.ajustarPorToken(d, { instagram: { ok: false, motivo: "token no válido" }, facebook: { ok: false } });
  assert.equal(malo.accion, "avisar");
  assert.equal(malo.clave, "token");
  const sinFb = V.ajustarPorToken(d, { instagram: { ok: true }, facebook: { ok: false, motivo: "al token le falta pages_manage_posts" } });
  assert.equal(sinFb.accion, "publicar");
  assert.deepEqual(sinFb.redes, ["instagram"]);
  assert.match(sinFb.notas.join(" "), /pages_manage_posts/);
  assert.equal(V.textoRedes(sinFb.redes), "solo instagram");
});

test("evaluarToken: lo mismo que comprobar-token-instagram.yml", () => {
  const todos = [...PERMISOS_INSTAGRAM, PERMISO_FACEBOOK];
  const cuenta = { username: "costaviva" };
  const pagina = { name: "Costaviva", access_token: "x" };
  assert.deepEqual(evaluarToken({ debug: { data: { is_valid: true, scopes: todos } }, cuenta, pagina, pageId: "1" }), { instagram: { ok: true }, facebook: { ok: true } });
  // Hoy (2026-10-11): sin pages_manage_posts.
  const hoy = evaluarToken({ debug: { data: { is_valid: true, scopes: PERMISOS_INSTAGRAM } }, cuenta, pagina, pageId: "1" });
  assert.equal(hoy.instagram.ok, true);
  assert.equal(hoy.facebook.ok, false);
  assert.equal(evaluarToken({ debug: { error: { code: 190, message: "Session has expired" } } }).instagram.ok, false);
  assert.equal(evaluarToken({ debug: { data: { is_valid: false, scopes: todos } }, cuenta }).instagram.ok, false);
  assert.equal(evaluarToken({ debug: { data: { is_valid: true, scopes: ["instagram_basic"] } }, cuenta }).instagram.ok, false);
  assert.equal(evaluarToken({ debug: { data: { is_valid: true, scopes: todos } }, cuenta: { error: { message: "no" } } }).instagram.ok, false);
  // Los permisos coinciden con los del workflow de comprobación.
  const yml = leer(".github/workflows/comprobar-token-instagram.yml");
  for (const p of todos) assert.ok(yml.includes(`"${p}"`), p);
});

test("avisos sin repetir cada 30 min", () => {
  const c = [{ autor: "github-actions[bot]", cuerpo: `⚠️ algo\n\n${V.marcaAviso("token")}` }];
  assert.equal(V.yaAvisado(c, "token"), true);
  assert.equal(V.yaAvisado(c, "caducada"), false);
});

test("el Issue dice cuándo sale sola y cómo vetarla", () => {
  const cuerpo = cuerpoIssue({ pieza: PIEZA, previa: PIEZA.publicUrl, cuando: "martes 13/10 a las 08:00", caduca: "mañana", facebookListo: false, automatica: true, publicaEn: V.textoMomento(V.momentoPublicacion(PIEZA, CREADO)) });
  assert.match(cuerpo, /Se publica SOLA el martes 13\/10 a las 08:00/);
  assert.match(cuerpo, /etiqueta `veto`/);
  assert.deepEqual(extraerPieza(cuerpo), PIEZA);
  assert.match(cuerpoIssue({ pieza: PIEZA, previa: "x", cuando: "c", caduca: "d", facebookListo: true }), /PUBLICACION_AUTOMATICA/);
});

test("workflow: programado, con interruptor, mismo grupo que el manual, y pg_cron puede lanzarlo", () => {
  const yml = leer(".github/workflows/publicar-con-veto.yml");
  assert.match(yml, /schedule:/);
  assert.match(yml, /vars\.PUBLICACION_AUTOMATICA == 'true'/);
  assert.match(yml, /group: publicar-pieza/);
  assert.match(leer(".github/workflows/publicar-post-instagram.yml"), /group: publicar-pieza/);
  assert.doesNotMatch(yml, /ANTHROPIC_API_KEY|claude -p/);
  const sql = leer("supabase/migrations/20261011200000_programador_publicar_veto.sql");
  const lista = [...sql.match(/if workflow not in \(([^)]*)\)/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const w of ["camaras-salud.yml", "notificar-altas.yml", "espuma-camaras.yml", "robot-marketing-instagram.yml", "robot-reel-instagram.yml", "aprendizaje-semanal.yml", "publicar-con-veto.yml"]) assert.ok(lista.includes(w), w);
  assert.ok(!lista.includes("publicar-post-instagram.yml") && !lista.includes("aplicar-migraciones.yml"));
});

test("clips de stock: todos dicen si sale una persona identificable", () => {
  const dir = new URL("../scripts/marketing/clips/stock/", import.meta.url);
  for (const f of ["coverr-pescador-costa-rocosa", "coverr-pescador-recogiendo-carrete", "coverr-pescador-rocas-oleaje", "mixkit-cana-al-atardecer", "mixkit-carrete-frente-al-mar"]) {
    const lic = JSON.parse(readFileSync(new URL(`${f}.licencia.json`, dir), "utf8"));
    assert.equal(typeof lic.persona_identificable, "boolean", f);
  }
});
