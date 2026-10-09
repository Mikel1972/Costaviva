// Tests de idiomas (assets/js/i18n.js, assets/i18n/es.js y en.js; 2026-10-09).
//
// Lo que protegen:
//   1. Cobertura: ninguna clave en español sin inglés ni al revés, con las
//      mismas variables {x} y los mismos plurales.
//   2. Nada sin traducir en las páginas que ya tienen idiomas: todo texto y
//      todo title/aria-label/placeholder/alt del HTML lleva su data-i18n*
//      (salvo la lista de EXCEPCIONES: marcas, unidades...), y ninguna
//      traducción inglesa es igual a la española salvo IGUALES_PERMITIDOS.
//   3. No regresión en español: el texto de es.js de cada data-i18n* es
//      exactamente el que trae el HTML (lo que se ve hoy), y los textos que
//      el JS pinta con I18n.t() dan, en español, lo de siempre.
//   4. El núcleo: t() con variables y plurales, orden de elección del idioma,
//      números con coma/punto, unidades, datos por idioma.
// Sin red ni DOM: corre en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ATRIBUCIONES_HTML } from "../functions/_lib/fuentes.js";
import { analizarHtml, sinTraducir, leerDiccionario, limpio, desescapar, htmlInterior, ATRIBUTOS_TRADUCIBLES } from "./i18n-html.js";

const { I18n } = await import("../assets/js/i18n-modulo.js");
const ES = leerDiccionario(new URL("../assets/i18n/es.js", import.meta.url));
const EN = leerDiccionario(new URL("../assets/i18n/en.js", import.meta.url));
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

// Páginas de la app ya traducidas. admin.html se queda en español a propósito.
export const PAGINAS_I18N = ["index.html", "diario.html", "alarma.html", "grupos.html", "login.html", "suscripcion.html"];
// Sin menú de cuenta: el idioma se cambia desde las demás páginas.
const SIN_SELECTOR = new Set(["suscripcion.html"]);

// Textos del HTML que se quedan igual en los dos idiomas.
const EXCEPCIONES = new Set(["Costaviva", "0 km/h", "54+ km/h", "Open-Meteo", "WhatsApp", "Pexels"]);
// Claves cuya traducción inglesa coincide con la española (nombres propios,
// unidades, palabras iguales en los dos idiomas).
const IGUALES_PERMITIDOS = new Set([
  "mapa.panel.banda_mas3", "comun.admin", "mapa.capa.spots", "mapa.caudal.normal", "mapa.rio.humedad",
  "mapa.marea.coef", "mapa.va.natural", "va.ola.rango", "va.region.atlantico_norte", "va.region.portugal",
  "va.region.madeira", "rayos.lugar_spot", "lluvia.radar", "corriente.ley_tramo",
  "login.region.cantabria", "login.region.asturias", "login.region.galicia", "login.region.portugal",
]);

const variables = (v) => [...new Set(JSON.stringify(v).match(/\{\w+\}/g) || [])].sort();

test("cobertura: mismas claves en es y en, con las mismas variables y plurales", () => {
  const ke = Object.keys(ES), kn = Object.keys(EN);
  assert.deepEqual(ke.filter((k) => !(k in EN)), [], "claves en español sin inglés");
  assert.deepEqual(kn.filter((k) => !(k in ES)), [], "claves en inglés sin español");
  for (const k of ke) {
    assert.equal(typeof ES[k], typeof EN[k], `${k}: uno es plural y el otro no`);
    if (typeof ES[k] === "object") assert.deepEqual(Object.keys(ES[k]).sort(), Object.keys(EN[k]).sort(), `${k}: plurales distintos`);
    assert.deepEqual(variables(ES[k]), variables(EN[k]), `${k}: variables distintas`);
    assert.ok(String(JSON.stringify(EN[k])).replace(/[{}"\s]/g, "").length > 0, `${k}: vacía`);
  }
});

test("nada en español en el diccionario inglés (salvo las iguales permitidas)", () => {
  const iguales = Object.keys(ES).filter((k) => JSON.stringify(ES[k]) === JSON.stringify(EN[k]));
  assert.deepEqual(iguales.filter((k) => !IGUALES_PERMITIDOS.has(k)), [], "traducción igual al español");
  // Señales de español que no deberían aparecer en inglés.
  const espanol = /[ñ¿¡]|\b(de la|del|los|las|para|hoy|mañana|ahora mismo|sin datos)\b/i;
  const sospechosas = Object.entries(EN).filter(([k, v]) => espanol.test(JSON.stringify(v).replace(/<[^>]+>/g, "").replace(/Peñas|España|Augas de Galicia|Puertos del Estado|Diputación|Ayuntamiento/g, "")));
  assert.deepEqual(sospechosas.map(([k]) => k), [], "texto en español dentro de en.js");
});

for (const pagina of PAGINAS_I18N) {
  const src = leer(pagina);

  test(`${pagina}: ningún texto de interfaz sin traducir`, () => {
    const faltan = sinTraducir(src).filter((r) => !EXCEPCIONES.has(r.texto)).map((r) => `${r.tipo}: ${r.texto}`);
    assert.deepEqual(faltan, []);
  });

  test(`${pagina}: en español se ve exactamente lo de hoy (es.js = texto del HTML)`, () => {
    const { elementos } = analizarHtml(src);
    let n = 0;
    for (const el of elementos) {
      const k = el.attrs["data-i18n"];
      if (k !== undefined) {
        assert.ok(k in ES, `${pagina}: falta la clave ${k}`);
        assert.equal(limpio(desescapar(htmlInterior(src, el))), limpio(ES[k]), `${pagina}: ${k}`);
        n++;
      }
      const kh = el.attrs["data-i18n-html"];
      if (kh !== undefined) {
        assert.equal(limpio(htmlInterior(src, el)), limpio(ES[kh]), `${pagina}: ${kh}`);
        n++;
      }
      for (const a of ATRIBUTOS_TRADUCIBLES) {
        const ka = el.attrs[`data-i18n-${a}`];
        if (ka === undefined) continue;
        assert.equal(limpio(el.attrs[a]), limpio(ES[ka]), `${pagina}: ${ka} (${a})`);
        n++;
      }
    }
    assert.ok(n > 20, `${pagina}: casi sin marcas de idioma (${n})`);
  });

  test(`${pagina}: carga los diccionarios y el núcleo antes que ningún otro script, y tiene el selector`, () => {
    const i = src.indexOf('<script src="/assets/i18n/es.js"></script>');
    const j = src.indexOf('<script src="/assets/i18n/en.js"></script>');
    const k = src.indexOf('<script src="/assets/js/i18n.js"></script>');
    assert.ok(i > 0 && i < j && j < k, "orden es.js, en.js, i18n.js");
    assert.equal(src.slice(0, i).indexOf("<script"), -1, "hay un <script> antes de los idiomas");
    if (!SIN_SELECTOR.has(pagina)) assert.match(src, /<div[^>]* data-i18n-selector><\/div>/, "falta el selector de idioma");
    assert.doesNotMatch(src, /\son[a-z]{3,}\s*=\s*["'`]/i, "sin on*= (CSP)");
  });
}

// Todas las claves que el código pide con I18n.t("...")/t("...")/tr("...")
// existen; y en los scripts clásicos con texto de respaldo, ese texto es el de es.js.
const FICHEROS_JS = ["index.html", ...readdirSync(new URL("../assets/js/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `assets/js/${f}`)];
test("toda clave usada en el código existe en es.js", () => {
  const faltan = [];
  for (const f of FICHEROS_JS) {
    const s = leer(f);
    for (const m of s.matchAll(/(?:I18n\.t|\btr|(?<![\w.])t)\("([a-z_]+\.[\w.]*\w)"/g)) if (!(m[1] in ES)) faltan.push(`${f}: ${m[1]}`);
    for (const m of s.matchAll(/\btr\("([\w.]+)", ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')[,)]/g)) {
      assert.equal(ES[m[1]], Function(`return ${m[2]}`)(), `${f}: el respaldo de ${m[1]} no es el texto de es.js`);
    }
  }
  assert.deepEqual(faltan, []);
  // meteo.js compone "meteo.atrib." + fuente: su español es el de fuentes.js.
  for (const [f, html] of Object.entries(ATRIBUCIONES_HTML)) assert.equal(ES[`meteo.atrib.${f}`], html, f);
  // Claves que se componen en el código (`va.luz.${luz}`...): todas las variantes.
  for (const k of ["va.luz.alba", "va.luz.ocaso", "va.luz.dia", "va.luz.noche", "va.marea.repunte", "va.marea.subiendo",
    "va.marea.bajando", "va.presion.bajando", "va.presion.subiendo", "va.presion.estable", "va.rio.bajo", "va.rio.normal",
    "va.rio.alto", "cc.clorofila.baja", "cc.clorofila.moderada", "cc.clorofila.alta"]) assert.ok(k in ES, k);
});

test("t(): variables, plurales, idioma pedido, respaldo en español y clave desconocida", () => {
  assert.equal(I18n.idioma(), "es", "en node (sin DOM) siempre español");
  assert.equal(I18n.t("mapa.vigencia.hace", { minutos: 5 }), "actualizado hace 5 min");
  assert.equal(I18n.t("mapa.vigencia.hace", { minutos: 5 }, "en"), "updated 5 min ago");
  assert.equal(I18n.t("comun.n_dias", { n: 1 }, "en"), "1 day");
  assert.equal(I18n.t("comun.n_dias", { n: 3 }, "en"), "3 days");
  assert.equal(I18n.t("rayos.conteo", { n: 1, min: 5, km: 100 }), "1 rayo en los últimos 5 min a menos de 100 km.");
  assert.equal(I18n.t("rayos.conteo", { n: 2, min: 5, km: 100 }, "en"), "2 strikes in the last 5 min within 100 km.");
  assert.equal(I18n.t("no.existe"), "no.existe");
  assert.equal(I18n.t("mapa.vigencia.hace", {}), "actualizado hace {minutos} min", "sin la variable se ve el hueco");
});

test("elegir idioma: guardado > perfil > navegador > español", () => {
  assert.equal(I18n.elegirIdioma({ guardado: "en", perfil: "es", navegador: "es-ES" }), "en");
  assert.equal(I18n.elegirIdioma({ guardado: null, perfil: "en", navegador: "es-ES" }), "en");
  assert.equal(I18n.elegirIdioma({ guardado: "xx", perfil: null, navegador: "en-NZ" }), "en");
  assert.equal(I18n.elegirIdioma({ navegador: "fr-FR" }), "es");
  assert.equal(I18n.elegirIdioma({}), "es");
});

test("números y unidades: coma en español, punto en inglés; km/h y nudos; °C; m", () => {
  assert.equal(I18n.num(1.25, 1, "es"), "1,3");
  assert.equal(I18n.num(1.25, 1, "en"), "1.3");
  assert.equal(I18n.num(17.04, undefined, "es"), "17");
  assert.equal(I18n.num(0.5, undefined, "es"), "0,5");
  assert.equal(I18n.temp(17.36, 1, "en"), "17.4 °C");
  assert.equal(I18n.temp(17.36, 1, "es"), "17,4 °C");
  assert.equal(I18n.metros(1.5, 1, "en"), "1.5 m");
  assert.equal(I18n.velocidad(18.5, "kmh", "en"), "19 km/h");
  assert.equal(I18n.velocidad(18.52, "nudos", "en"), "10 kn");
  assert.equal(I18n.velocidad(18.52, "nudos", "es"), "10 nudos");
  assert.equal(I18n.decimal("0.2", "es"), "0,2");
  assert.equal(I18n.locale("en"), "en-NZ");
  assert.equal(I18n.locale("es"), "es-ES");
  assert.deepEqual(I18n.mesesCortos("es").slice(0, 3), ["ene", "feb", "mar"]);
  assert.deepEqual(I18n.mesesCortos("en").slice(0, 3), ["Jan", "Feb", "Mar"]);
});

test("datos por idioma (fase de datos): texto_en y nombres.en si existen; si no, el español", () => {
  const veda = { texto: "veda de marzo", texto_en: "March closed season" };
  assert.equal(I18n.dato(veda, "texto", "en"), "March closed season");
  assert.equal(I18n.dato(veda, "texto", "es"), "veda de marzo");
  assert.equal(I18n.dato({ texto: "solo español" }, "texto", "en"), "solo español");
  assert.equal(I18n.nombre({ nombres: { es: "Lubina", en: "European sea bass" } }, "en"), "European sea bass");
  assert.equal(I18n.nombre({ nombres: { es: "Lubina" } }, "en"), "Lubina");
});

test("motivos del índice por clave: en español lo de siempre, en inglés traducidos", async () => {
  const VA = await import("../assets/js/ventana-actividad.js");
  const datos = JSON.parse(leer("assets/datos/especies.json"));
  const especie = datos.especies.find((e) => e.id === "lubina") || datos.especies[0];
  const horas = Array.from({ length: 48 }, (_, i) => ({
    hora: `2026-10-0${i < 24 ? 8 : 9}T${String(i % 24).padStart(2, "0")}:00`,
    nivelMar: 1.6 * Math.sin((i * 2 * Math.PI) / 12.4), ola: 1.2, viento: 45, vientoDir: 300, tempAgua: 17.4, presion: 1016 - i * 0.6, lluvia: 0,
  }));
  const r = VA.calcularVentana(especie, datos.reglas_por_defecto, horas, { lat: 43.43, lon: -2.81, modalidad: "costa" })[30];
  const conClave = r.razones.filter((x) => x.clave);
  assert.ok(conClave.length >= 3, "los motivos base llevan su clave");
  for (const x of conClave) {
    assert.equal(x.texto, I18n.t(x.clave, x.vars, "es"), "en español, el texto es el de la clave");
    assert.equal(x.textoEs, x.texto);
    assert.notEqual(I18n.t(x.clave, x.vars, "en"), x.texto, `${x.clave}: sin traducir`);
  }
  // Puntos clave, letra por letra como antes de los idiomas.
  assert.ok(r.razones.some((x) => x.texto === "viento fuerte (45 km/h)"));
  assert.ok(r.razones.some((x) => x.texto === "mar de 1-1,5 m"));
  assert.ok(r.razones.some((x) => x.texto === "agua a 17,4 °C, cerca de su óptimo (" + especie.temperatura_agua.rango.join("-") + ")" || x.factor !== "temperatura"));
  assert.equal(I18n.t("va.ola.mar_de", { a: "1", b: "1.5" }, "en"), "1-1.5 m sea");
  assert.equal(VA.NOMBRE_MODALIDAD.costa, "Desde costa");
  assert.equal(VA.textoMeses([1, 2, 3]), "ene–mar");
  // Lo interno se reconoce aunque el texto esté en inglés.
  const interno = [{ factor: "marea", texto: "almost no tide here (0.1 m): does not count", textoEs: "marea casi nula aquí (0,1 m): no cuenta", aporte: 3 }];
  assert.equal(VA.paraUsuario(interno).motivos.length, 0);
});

test("index.html en español: puntos clave del mapa, letra por letra", () => {
  const casos = {
    "mapa.panel.indice_mar": "ÍNDICE DE MAR COMBINADO",
    "mapa.panel.indice_pesca": "🎣 ÍNDICE DE PESCA (estimación)",
    "mapa.va.titulo": "⏱ VENTANA DE ACTIVIDAD POR HORAS",
    "mapa.aviso_rayos": "⚡ RIESGO DE RAYOS DETECTADO EN LA ZONA — no salir a roca/muelle hasta que pase",
    "comun.tab.diario": "Diario",
    "comun.menu.cerrar_sesion": "🚪 Cerrar sesión",
    "capas.varias.titulo": "CAPAS DEL MAR",
    "mapa.presion.bajando": "↓ bajando — buena señal, suelen animarse",
    "mapa.ip.mejor_ahora": "{modalidad} · mejor ahora: {especie}",
  };
  for (const [k, v] of Object.entries(casos)) assert.equal(ES[k], v, k);
  assert.equal(I18n.t("mapa.ip.mejor_ahora", { modalidad: "Desde costa", especie: "Lubina" }), "Desde costa · mejor ahora: Lubina");
  assert.equal(I18n.t("mapa.vigencia.caducado", { minutos: 75 }), "sin datos actuales (última respuesta hace 75 min, más de 1h)");
});

test("SEO /en/: preparado pero apagado (sin hreflang, sin rutas, canónicas y sitemap intactos)", async () => {
  const S = await import("../functions/_lib/seo/idiomas.js");
  const { documento } = await import("../functions/_lib/seo/base.js");
  assert.equal(S.PUBLICAR_EN, false, "las rutas /en/ no se publican todavía");
  assert.equal(S.enlacesHreflang("/spots/bakio", "https://costaviva.org", ["es", "en"]), "");
  const forzado = S.enlacesHreflang("/spots/bakio", "https://costaviva.org", ["es", "en"], { forzar: true });
  assert.match(forzado, /hreflang="es" href="https:\/\/costaviva\.org\/spots\/bakio"/);
  assert.match(forzado, /hreflang="en" href="https:\/\/costaviva\.org\/en\/spots\/bakio"/);
  assert.match(forzado, /hreflang="x-default" href="https:\/\/costaviva\.org\/spots\/bakio"/);
  assert.equal(S.rutaIdioma("/", "en"), "/en/");
  assert.deepEqual(S.idiomaDeRuta("/en/especies/lubina"), { idioma: "en", ruta: "/especies/lubina" });
  assert.deepEqual(S.idiomaDeRuta("/spots"), { idioma: "es", ruta: "/spots" });
  const html = documento({ titulo: "T", descripcion: "D", ruta: "/spots/bakio", cuerpo: "", alternos: ["es", "en"] });
  assert.match(html, /<html lang="es">/);
  assert.doesNotMatch(html, /hreflang/);
  assert.match(html, /<link rel="canonical" href="https:\/\/costaviva\.org\/spots\/bakio">\n<meta property="og:type"/);
  assert.doesNotMatch(leer("sitemap.xml"), /\/en\//);
  const rutas = await import("../functions/_lib/rutas-publicas.js");
  assert.equal(rutas.esRutaPermitida("/en/spots/bakio"), false, "/en/ todavía da 404");
});
