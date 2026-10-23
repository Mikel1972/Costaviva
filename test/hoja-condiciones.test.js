// Hoja de condiciones del alta (2026-10-22, diseño aprobado por Mikel). Sin red.
//   - login.html ya no tiene la casilla "Autorizo el uso anónimo..." ni la de
//     términos: la hoja se acepta antes de pedir el enlace del alta.
//   - La aceptación (versión, fecha, idioma) y consiente_uso_datos_capturas =
//     true (interés legítimo) viajan en el metadato del alta.
//   - Los precios de la hoja son los de functions/_lib/precios-zonas.json.
//   - La oposición existe (suscripcion.html + RPC con su migración) y el
//     aprendizaje del índice deja fuera a quien se opuso.
//   - privacidad.html explica el interés legítimo y la oposición.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { VERSION_HOJA, metadatosAceptacion } from "../assets/js/hoja-condiciones.js";
import { tablaZona } from "../functions/_lib/precios.js";
import { usuariosExcluidos } from "../scripts/aprendizaje/casos.mjs";
import { leerDiccionario } from "./i18n-html.js";

const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
const DIC = Object.fromEntries(["es", "en", "pt"].map((i) => [i, leerDiccionario(new URL(`../assets/i18n/${i}.js`, import.meta.url))]));
const config = JSON.parse(leer("functions/_lib/precios-zonas.json"));
const login = leer("login.html");

test("login.html: sin la casilla de capturas anónimas ni la de términos", () => {
  assert.doesNotMatch(login, /checkDatosCapturas|autorizo_capturas|Autorizo el uso anónimo|checkTerminos/);
  for (const i of ["es", "en", "pt"]) assert.ok(!("login.autorizo_capturas" in DIC[i]), `${i}: clave antigua`);
});

test("login.html: la hoja se acepta antes del alta (casilla + botón, sin on*=)", () => {
  assert.match(login, /id="hojaCondiciones"[^>]*hidden/);
  assert.match(login, /role="dialog" aria-modal="true"/);
  assert.match(login, /<input type="checkbox" id="checkHoja" \/>/);
  assert.match(login, /id="btnAceptarHoja" disabled/);
  // enviarAlta() abre la hoja si no está aceptada, antes de signInWithOtp.
  const f = login.slice(login.indexOf("async function enviarAlta()"));
  assert.ok(f.indexOf("if (!hojaAceptadaEn)") > 0 && f.indexOf("if (!hojaAceptadaEn)") < f.indexOf("signInWithOtp"));
  assert.match(f, /\.\.\.metadatosAceptacion\(hojaAceptadaEn, I18n\.idioma\(\)\)/);
  assert.doesNotMatch(login, /\son[a-z]{3,}\s*=\s*["'`]/i);
});

test("metadato del alta: versión, fecha, idioma y estadísticas por interés legítimo", () => {
  assert.match(VERSION_HOJA, /^\d{4}-\d{2}-\d{2}$/);
  const m = metadatosAceptacion(new Date("2026-10-22T10:00:00Z"), "pt");
  assert.deepEqual(m, {
    condiciones_alta_version: VERSION_HOJA,
    condiciones_alta_aceptadas_en: "2026-10-22T10:00:00.000Z",
    condiciones_alta_idioma: "pt",
    consiente_uso_datos_capturas: true,
  });
  assert.equal(metadatosAceptacion(new Date(), "fr").condiciones_alta_idioma, "es");
  // El trigger lo copia desde ese nombre exacto.
  assert.match(leer("supabase/migrations/20260917110508_bienvenida_pendiente.sql"), /raw_user_meta_data ->> 'consiente_uso_datos_capturas'/);
});

test("hoja: todas las secciones en es, en y pt, y la versión coincide con la fecha del texto", () => {
  const claves = Object.keys(DIC.es).filter((k) => k.startsWith("hoja."));
  for (const k of ["hoja.datos_responsable", "hoja.datos_quien", "hoja.datos_derechos", "hoja.anon_texto", "hoja.pago_precios", "hoja.pago_desistimiento", "hoja.terceros_texto", "hoja.terceros_aviso", "hoja.enlaces", "hoja.acepto"]) {
    assert.ok(claves.includes(k), k);
  }
  for (const i of ["en", "pt"]) for (const k of claves) assert.ok(k in DIC[i], `${i}: falta ${k}`);
  assert.match(DIC.es["hoja.intro"], /22 de octubre de 2026/);
  assert.equal(VERSION_HOJA, "2026-10-22");
  assert.match(DIC.es["hoja.anon_texto"], /interés legítimo \(art\. 6\.1\.f RGPD\)/);
  assert.match(DIC.es["hoja.anon_texto"], /Puedes oponerte cuando quieras/);
  assert.match(DIC.es["hoja.datos_derechos"], /Agencia Española de Protección de Datos/);
  assert.match(DIC.es["hoja.datos_responsable"], /pendiente de completar/);
  for (const i of ["es", "en", "pt"]) {
    assert.match(DIC[i]["hoja.datos_responsable"], /datos@costaviva\.org/);
    assert.match(DIC[i]["hoja.enlaces"], /href="\/terminos"[\s\S]*href="\/privacidad"/);
  }
});

const eur = (c) => (c / 100).toFixed(2).replace(".", ",") + " €";
const nzd = (c) => "NZ$" + (c / 100).toFixed(2);

test("hoja: los precios son los de precios-zonas.json (UE en es/pt, NZ y UE en en)", () => {
  const ue = tablaZona(config, "ue_eee").planes, nz = tablaZona(config, "nz").planes;
  for (const i of ["es", "pt"]) {
    const t = DIC[i]["hoja.pago_precios"];
    for (const c of [ue.regional.mensual, ue.regional.anual, ue.mundial.mensual, ue.mundial.anual, ue.regional.fundador_anual, ue.mundial.fundador_anual]) assert.ok(t.includes(eur(c)), `${i}: ${eur(c)}`);
    assert.ok(t.includes(String(config.plazas_fundador)), `${i}: plazas de fundador`);
  }
  const en = DIC.en["hoja.pago_precios"];
  for (const c of [nz.regional.mensual, nz.regional.anual, nz.mundial.mensual, nz.mundial.anual, nz.regional.fundador_anual, nz.mundial.fundador_anual]) assert.ok(en.includes(nzd(c)), `en: ${nzd(c)}`);
  for (const c of [ue.regional.mensual, ue.regional.anual]) assert.ok(en.includes("€" + (c / 100).toFixed(2)), "en: precio UE");
  for (const i of ["es", "en", "pt"]) assert.match(DIC[i]["hoja.pago_prueba"], /14/);
});

test("oposición: suscripcion.html tiene la casilla y la RPC tiene su migración (solo authenticated)", () => {
  const s = leer("suscripcion.html");
  assert.match(s, /id="bloqueDatos"/);
  assert.match(s, /id="checkEstadisticas"/);
  assert.match(s, /select\("consiente_uso_datos_capturas"\)/); // sin la migración 20261023120000
  assert.match(s, /select\("consiente_uso_datos_capturas,aviso_condiciones_en,oposicion_estadisticas_en"\)/);
  assert.match(s, /rpc\("fijar_uso_capturas_estadisticas", \{ p_usar: usar \}\)/);
  const f = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((x) => /fijar_uso_capturas_estadisticas/.test(leer(`supabase/migrations/${x}`)));
  // La 20261023120000 la reescribe para guardar la fecha de oposición: las dos
  // con las mismas propiedades de seguridad.
  assert.deepEqual(f, ["20261022233000_estadisticas_interes_legitimo.sql", "20261023120000_aviso_condiciones_oposicion.sql"]);
  for (const m of f) {
    const sql = leer(`supabase/migrations/${m}`);
    assert.match(sql, /security definer/);
    assert.match(sql, /where id = auth\.uid\(\)/);
    assert.match(sql, /revoke execute on function public\.fijar_uso_capturas_estadisticas\(boolean\) from public, anon;/);
    assert.match(sql, /grant execute on function public\.fijar_uso_capturas_estadisticas\(boolean\) to authenticated;/);
    assert.doesNotMatch(sql, /\b(begin|commit);/i);
  }
});

test("aprendizaje del índice: fuera las cuentas de prueba y quien se opuso, salvo el dueño", () => {
  const perfiles = [
    { id: "a", email: "prueba@x.es", consiente_uso_datos_capturas: true },
    { id: "b", email: "b@x.es", consiente_uso_datos_capturas: false },
    { id: "c", email: "c@x.es", consiente_uso_datos_capturas: true },
    { id: "d", email: "dueno@x.es", consiente_uso_datos_capturas: false },
    { id: "e", email: "e@x.es" },
  ];
  const fuera = usuariosExcluidos({ perfiles, emailsPrueba: ["PRUEBA@x.es"], propios: new Set(["d"]) });
  assert.deepEqual([...fuera].sort(), ["a", "b"]);
});

test("privacidad.html: interés legítimo y oposición, sin la casilla del alta", () => {
  const p = leer("privacidad.html");
  assert.doesNotMatch(p, /casilla del alta|Autorizo el uso anónimo/);
  assert.match(p, /interés legítimo/);
  assert.match(p, /Puedes oponerte cuando quieras/);
  assert.match(p, /Tus datos/);
  assert.match(p, /Compartir esta captura de forma anónima/);
  assert.match(p, /Agencia Española de Protección de Datos/);
  for (const enc of ["Supabase", "Cloudflare", "Stripe", "Resend", "Anthropic", "GitHub"]) assert.match(p, new RegExp(enc));
});

test("terminos.html: datos de terceros y disponibilidad en los tres idiomas", () => {
  const t = leer("terminos.html");
  assert.match(t, /Datos de terceros y disponibilidad/);
  assert.match(t, /Third-party data and availability/);
  assert.match(t, /Dados de terceiros e disponibilidade/);
});
