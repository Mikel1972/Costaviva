// Preferencias de unidades y de fecha (2026-10-12, Mikel: "el viento se suele
// dar también en nudos; en el perfil, un menú para elegir unidades, métrico o
// imperial, y el formato de la fecha").
//
// Lo que protege:
//   1. Las conversiones de assets/js/i18n.js con cada opción (métrico /
//      imperial; km/h, nudos, mph, m/s; 31/12/2026, 12/31/2026, 2026-12-31).
//   2. Que los diccionarios no lleven la unidad pegada detrás de una variable
//      ("{v} km/h"): la pone el código con I18n.velocidad, I18n.metros...
//   3. Que los textos de la app (motivos del índice, corriente, rayos,
//      oleaje del diario, isotermas) siguen las preferencias, y que lo que se
//      guarda (textoEs) sigue en métrico.
//   4. Que el menú de cuenta de cada página tiene el selector.
// Sin red ni DOM: corre en tests.yml.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerDiccionario } from "./i18n-html.js";

const { I18n } = await import("../assets/js/i18n-modulo.js");
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");
// Cada test empieza con lo de por defecto (métrico, km/h, 31/12/2026).
afterEach(() => I18n.fijarPreferencias({}));

test("por defecto: métrico, km/h y día/mes/año (lo de siempre)", () => {
  assert.deepEqual(I18n.fijarPreferencias({}), { unidades: "metrico", viento: "kmh", fecha: "dmy" });
  assert.equal(I18n.temp(18.4), "18,4 °C");
  assert.equal(I18n.temp(17, null), "17 °C", "null: sin decimales fijos");
  assert.equal(I18n.metros(1.5), "1,5 m");
  assert.equal(I18n.distancia(100, 0), "100 km");
  assert.equal(I18n.centimetros(30), "30 cm");
  assert.equal(I18n.kilos(1.2), "1,2 kg");
  assert.equal(I18n.velocidad(20), "20 km/h");
  assert.equal(I18n.difTemp(0.5), "0,5 °C");
  assert.equal(I18n.unidadMetros(), "m");
  // Lo que no es válido se ignora.
  assert.deepEqual(I18n.fijarPreferencias({ unidades: "marciano", viento: "nudos" }), { unidades: "metrico", viento: "nudos", fecha: "dmy" });
});

test("imperial: °F, pies, millas, pulgadas y libras", () => {
  I18n.fijarPreferencias({ unidades: "imperial" });
  assert.equal(I18n.temp(18.4), "65 °F");
  assert.equal(I18n.temp(18.4, 1), "65,1 °F");
  assert.equal(I18n.temp(18.4, 1, "en"), "65.1 °F");
  assert.equal(I18n.metros(1.5), "4,9 ft");
  assert.equal(I18n.metros(5000, 0), "16404 ft");
  assert.equal(I18n.distancia(100, 0), "62 mi");
  assert.equal(I18n.distancia(10), "6,2 mi");
  assert.equal(I18n.centimetros(30), "11,8 in");
  assert.equal(I18n.kilos(1.2), "2,6 lb");
  // Una diferencia de temperatura no suma 32.
  assert.equal(I18n.difTemp(0.5), "0,9 °F");
  assert.equal(I18n.difTemp(1, "en"), "1.8 °F");
  assert.equal(I18n.unidadMetros(), "ft");
});

test("viento: km/h, nudos, mph y m/s (en cada idioma)", () => {
  const casos = { kmh: ["20 km/h", "20 km/h"], nudos: ["11 nudos", "11 kn"], mph: ["12 mph", "12 mph"], ms: ["5,6 m/s", "5.6 m/s"] };
  for (const [viento, [es, en]] of Object.entries(casos)) {
    I18n.fijarPreferencias({ viento });
    assert.equal(I18n.velocidad(20), es, viento);
    assert.equal(I18n.velocidad(20, undefined, "en"), en, viento);
  }
  I18n.fijarPreferencias({ viento: "nudos" });
  assert.equal(I18n.velocidad(18.52, undefined, "pt"), "10 nós");
  assert.equal(I18n.unidadVelocidad(), "nudos");
  assert.ok(Math.abs(I18n.velocidadNumero(18.52) - 10) < 1e-9);
  assert.equal(I18n.velocidad(54, "kmh"), "54 km/h", "una unidad pedida a propósito manda");
});

test("rangoMetros: una sola unidad al final", () => {
  assert.equal(I18n.rangoMetros(1, 1.5), "1-1,5 m");
  assert.equal(I18n.rangoMetros(1, 2, undefined, "en"), "1-2 m");
  I18n.fijarPreferencias({ unidades: "imperial" });
  assert.equal(I18n.rangoMetros(1, 2), "3,3-6,6 ft");
  assert.equal(I18n.rangoMetros(null, 2), "");
});

test("fechaNumerica: 31/12/2026, 12/31/2026 o 2026-12-31 (con y sin año)", () => {
  const d = new Date(2026, 11, 31, 18, 30);
  const casos = { dmy: ["31/12/2026", "31/12"], mdy: ["12/31/2026", "12/31"], ymd: ["2026-12-31", "12-31"] };
  for (const [fecha, [con, sin]] of Object.entries(casos)) {
    I18n.fijarPreferencias({ fecha });
    assert.equal(I18n.fechaNumerica(d), con, fecha);
    assert.equal(I18n.fechaNumerica(d, false), sin, fecha);
  }
  assert.equal(I18n.fechaNumerica("no es una fecha"), "");
});

test("al pasar a imperial, el viento pasa de km/h a mph (y al revés)", async () => {
  await I18n.cambiarPreferencias({ unidades: "imperial" });
  assert.equal(I18n.preferencias().viento, "mph");
  await I18n.cambiarPreferencias({ unidades: "metrico" });
  assert.equal(I18n.preferencias().viento, "kmh");
  await I18n.cambiarPreferencias({ viento: "nudos" });
  await I18n.cambiarPreferencias({ unidades: "imperial" });
  assert.equal(I18n.preferencias().viento, "nudos", "los nudos se respetan");
});

test("diccionarios: ninguna unidad pegada detrás de una variable (es, en, pt)", () => {
  // "{v} km/h", "{t} °C", "{km} km", "{a}-{b} m"...: la unidad la pone el
  // código según las preferencias. "{mm} mm" (lluvia) se queda en mm.
  const unidadTrasVariable = /\{\w+\} ?(km\/h|m\/s|mph|°C|°F|km|m|cm|kg|ft|mi|nudos?|knots?|kn|nós|nó)(?![\p{L}\d/])/u;
  for (const idioma of ["es", "en", "pt"]) {
    const D = leerDiccionario(new URL(`../assets/i18n/${idioma}.js`, import.meta.url));
    const malas = Object.entries(D).filter(([, v]) => unidadTrasVariable.test(JSON.stringify(v))).map(([k]) => k);
    assert.deepEqual(malas, [], `${idioma}: unidad fija detrás de una variable`);
    // Ni umbrales fijos con km/h dentro de un texto (van como variables).
    assert.doesNotMatch(D["mapa.mod.nota_embarcacion"], /km\/h|\d m\b/, idioma);
    for (const k of ["va.viento.fuerte", "va.seg.viento", "va.seg.ola", "va.ola.mar_de", "rayos.sin_rayos", "frentes.corriente", "corriente.ley_tramo", "capas.tagua.formato", "iso.intervalo", "sos.precision", "diario.sonda.nota"]) {
      assert.doesNotMatch(JSON.stringify(D[k]), /km\/h|°C|nudos|knots|nós/, `${idioma}: ${k}`);
    }
  }
});

test("motivos del índice: en la unidad del usuario; lo que se guarda (textoEs), en métrico", async () => {
  const VA = await import("../assets/js/ventana-actividad.js");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 37 }, "es"), "viento fuerte (37 km/h)");
  I18n.fijarPreferencias({ viento: "nudos", unidades: "imperial" });
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 37 }, "es"), "viento fuerte (20 nudos)");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 37 }, "en"), "strong wind (20 kn)");
  assert.equal(VA.textoMotivo("va.viento.fuerte", { v: 37 }, "es", true), "viento fuerte (37 km/h)", "métrico a la fuerza");
  assert.equal(VA.textoMotivo("va.ola.mar_de", { a: 1, b: 1.5 }, "es"), "mar de 3,3-4,9 ft");
  assert.equal(VA.textoMotivo("va.ola.plana", { h: 0.5 }, "es"), "mar casi plana (<1,6 ft)");
  assert.equal(VA.textoMotivo("va.temp.optimo", { t: 18.4, min: 14, max: 20 }, "es"), "agua a 65 °F, cerca de su óptimo (57-68)");
  // Un motivo guardado antes de las unidades ("1,5" ya escrito) también vale.
  assert.equal(VA.textoMotivo("va.seg.ola", { v: "1,5" }, "es"), "ola 4,9 ft");

  // El cálculo entero, con viento fuerte, en nudos.
  I18n.fijarPreferencias({ viento: "nudos" });
  const datos = JSON.parse(leer("assets/datos/especies.json"));
  const especie = datos.especies.find((e) => e.id === "lubina") || datos.especies[0];
  const horas = Array.from({ length: 48 }, (_, i) => ({
    hora: `2026-10-0${i < 24 ? 8 : 9}T${String(i % 24).padStart(2, "0")}:00`,
    nivelMar: 1.6 * Math.sin((i * 2 * Math.PI) / 12.4), ola: 1.2, viento: 45, vientoDir: 300, tempAgua: 17.4, presion: 1016 - i * 0.6, lluvia: 0,
  }));
  const r = VA.calcularVentana(especie, datos.reglas_por_defecto, horas, { lat: 43.43, lon: -2.81, modalidad: "costa" })[30];
  const viento = r.razones.find((x) => x.clave === "va.viento.fuerte");
  assert.equal(viento.texto, "viento fuerte (24 nudos)");
  assert.equal(viento.textoEs, "viento fuerte (45 km/h)", "lo que se guarda, en km/h");
  assert.deepEqual(viento.vars, { v: 45 }, "vars en métrico, sin unidad");
  const ola = r.razones.find((x) => x.factor === "oleaje");
  assert.equal(ola.textoEs, "mar de 1-1,5 m");
});

test("corriente: en nudos y, entre paréntesis, en la unidad del viento (nada si ya son nudos)", async () => {
  const C = await import("../assets/js/corriente.js");
  const F = await import("../assets/js/frentes.js");
  assert.equal(C.textoToque({ ms: 0.5144, u: 0, v: -0.5 }), "Corriente hacia el S, 1 nudo (1,9 km/h).");
  assert.equal(F.textoCorriente(0.3, 0), "Corriente hacia el E: 1,1 km/h (0,6 nudos)");
  I18n.fijarPreferencias({ viento: "mph" });
  assert.equal(C.textoToque({ ms: 0.5144, u: 0, v: -0.5 }), "Corriente hacia el S, 1 nudo (1,2 mph).");
  assert.equal(C.leyendaTramos()[0][1], "Menos de 0,15 nudos (< 0,2 mph): muy floja");
  I18n.fijarPreferencias({ viento: "nudos" });
  assert.equal(C.textoToque({ ms: 0.5144, u: 0, v: -0.5 }), "Corriente hacia el S, 1 nudo.");
  assert.deepEqual(C.leyendaTramos().map((f) => f[1]), ["Menos de 0,15 nudos: muy floja", "0,15-0,3 nudos", "0,3-0,5 nudos", "0,5-1 nudo", "Más de 1 nudo"]);
  assert.equal(F.textoCorriente(0.3, 0), "Corriente hacia el E: 0,6 nudos");
});

test("rayos, frentes, isotermas, oleaje y temperatura del diario en imperial", async () => {
  const R = await import("../assets/js/rayos.js");
  const CC = await import("../assets/js/capas-combinadas.js");
  const I = await import("../assets/js/isotermas.js");
  const CS = await import("../assets/js/condiciones-salida.js");
  I18n.fijarPreferencias({ unidades: "imperial" });
  const r = R.resumenRayos({ estado: "ok", ref: { de: "de ti" }, total: 4, masCercano: { km: 12.4, cardinal: "NO", edadMin: 8.2 } });
  assert.equal(r.texto, "⚡ Rayo más cercano: 7 mi al NO de ti · hace 8 min");
  assert.equal(r.conteo, "4 rayos en los últimos 5 min a menos de 62 mi.");
  assert.match(R.resumenRayos({ estado: "ok", ref: { de: "de ti" }, total: 1, masCercano: { km: 0.3, cardinal: "E", edadMin: 0 } }).texto, /menos de 0,6 mi al E/);
  assert.equal(CC.textoFrentes({ frente_clorofila: false, frente_termico: false }), "Sin frentes a menos de 6,2 mi");
  assert.equal(CC.textoTemperatura(19.375), "66,9 °F en superficie");
  assert.equal(I.textoGrados(18), "64°");
  assert.equal(I.textoExtremo(16), "61 °F");
  assert.equal(I.textoIntervalo(1), "Líneas cada 1,8 °F");
  assert.equal(CS.textoOleaje(1.71, 2.09), "5,6–6,9 ft");
  assert.equal(CS.textoOleaje(1.9, 1.9), "6,2 ft");
  assert.equal(CS.textoTemp(17.2), "63 °F");
  // Y en métrico, lo de siempre.
  I18n.fijarPreferencias({});
  assert.equal(CS.textoOleaje(1.71, 2.09), "1,7–2,1 m");
  assert.equal(CS.textoTemp(17.2), "17,2 °C");
  assert.equal(CS.textoTemp(20.456, 2), "20,46 °C");
  assert.equal(CC.textoTemperatura(19.375, 3.4), "19,4 °C a 3 km, el modelo no llega a la orilla");
});

test("cada página con menú de cuenta tiene el selector de preferencias", () => {
  for (const p of ["index.html", "diario.html", "alarma.html", "grupos.html"]) {
    assert.match(leer(p), /<div data-preferencias-selector><\/div>/, p);
  }
});

test("index.html: la leyenda del viento y las bandas de ola se rellenan con la unidad elegida", () => {
  const html = leer("index.html");
  assert.match(html, /getElementById\("vientoLeyendaMin"\)\.textContent = I18n\.velocidad\(0\)/);
  assert.match(html, /getElementById\("vientoLeyendaMax"\)\.textContent = I18n\.velocidad\(VIENTO_MAX_MS \* 3\.6\)/);
  assert.match(html, /#panelOlaRealBandas \.ola-banda/);
  // Nada de cifras con la unidad escrita a mano en lo que ve el usuario.
  assert.doesNotMatch(html, /\$\{s\.viento\} km\/h|\$\{s\.tempAgua\}°C|\$\{s\.marea\.altura\}m|\$\{boya\.tempAgua\}°C|\$\{estacion\.vv\} m\/s/);
});
