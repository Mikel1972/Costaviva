// Tests de las modalidades de pesca (2026-10-08): pestañas "Desde costa",
// "Embarcación" y "Submarina". Comprueba que cada pestaña solo propone
// especies que se pescan así (el bonito nunca desde costa), que una especie
// puede estar en varias (la lubina, en las tres), las reglas propias de cada
// modalidad (seguridad en embarcación, visibilidad y prohibición nocturna en
// submarina) y la normativa con fuente. Lógica pura, sin red.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MODALIDADES, aplicaModalidad, especiesParaModalidad, especiesDeTemporada, cebosParaRegion,
  modalidadesDeCebo, calcularVentana, reglasParaModalidad, normativaModalidad, solDelDia, minutosMadrid, consejoProfundidad,
} from "../assets/js/ventana-actividad.js";
import { elegirEspeciePost, modalidadDelPost } from "../scripts/marketing/especie-post.mjs";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const especie = (id) => DATOS.especies.find((e) => e.id === id);
const ids = (l) => l.map((e) => e.id);
const MUNDAKA = { lat: 43.407, lon: -2.698 };

// 48 h desde el 8/10/2026 00:00 (hora local, como etiqueta Open-Meteo).
function serie(extra = {}) {
  const horas = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, 9, 8, 0, 0) + i * 3600000);
    horas.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.8 * Math.sin((2 * Math.PI * i) / 12.42), ola: 0.4, viento: 8, tempAgua: 17, presion: 1016, lluvia: 0,
      ...(typeof extra === "function" ? extra(i) : extra),
    });
  }
  return horas;
}
const ventana = (id, modalidad, horas, ctx = {}) => calcularVentana(especie(id), DATOS.reglas_por_defecto, horas, {
  ...MUNDAKA, modalidad, reglasModalidad: DATOS.reglas_por_modalidad, ...ctx,
});
const hora = (res, hh) => res.find((r) => r.hora === `2026-10-08T${hh}:00`);

test("Mundaka (Cantábrico): el bonito nunca sale desde costa ni en submarina; sí en embarcación", () => {
  assert.ok(!ids(especiesParaModalidad(DATOS, "cantabrico", "costa")).includes("bonito_norte"));
  assert.ok(!ids(especiesParaModalidad(DATOS, "cantabrico", "submarina")).includes("bonito_norte"));
  assert.ok(ids(especiesParaModalidad(DATOS, "cantabrico", "embarcacion")).includes("bonito_norte"));
  for (let mes = 1; mes <= 12; mes++) {
    assert.ok(!ids(especiesDeTemporada(DATOS, "cantabrico", mes, "costa")).includes("bonito_norte"), `mes ${mes}`);
  }
  assert.ok(ids(especiesDeTemporada(DATOS, "cantabrico", 8, "embarcacion")).includes("bonito_norte"));
});

test("muchos a muchos: la lubina y el sargo están en las tres pestañas", () => {
  for (const id of ["lubina", "sargo"]) {
    for (const m of MODALIDADES) {
      assert.ok(aplicaModalidad(especie(id), m, "cantabrico"), `${id} ${m}`);
      assert.ok(ids(especiesParaModalidad(DATOS, "cantabrico", m)).includes(id), `${id} ${m}`);
    }
  }
});

test("las listas de cada pestaña son la unión filtrada de las especies de la región", () => {
  for (const region of DATOS.regiones) {
    const presentes = new Set(DATOS.especies.filter((e) => e.presencia?.[region]?.meses?.length).map((e) => e.id));
    const union = new Set();
    for (const m of MODALIDADES) {
      for (const e of especiesParaModalidad(DATOS, region, m)) {
        assert.ok(presentes.has(e.id), `${e.id} sin presencia en ${region}`);
        assert.equal(e.modalidades[m].aplica, true, `${e.id} ${m}`);
        union.add(e.id);
      }
    }
    // Una especie con presencia y alguna modalidad afirmativa aparece en alguna pestaña.
    for (const id of presentes) {
      const e = especie(id);
      if (MODALIDADES.some((m) => e.modalidades[m].aplica === true)) assert.ok(union.has(id), `${id} en ${region}`);
    }
  }
});

test("sin dato (aplica: null) no se muestra, y queda en pendiente", () => {
  const urta = especie("urta");
  assert.equal(urta.modalidades.costa.aplica, null);
  assert.equal(aplicaModalidad(urta, "costa", "golfo_cadiz"), false);
  assert.ok(urta.pendiente.some((p) => p.includes("costa")));
});

test("especies.json: cada especie tiene las tres modalidades, con valor válido y su porqué", () => {
  for (const e of DATOS.especies) {
    for (const m of MODALIDADES) {
      const x = e.modalidades?.[m];
      assert.ok(x, `${e.id} sin ${m}`);
      assert.ok([true, false, null].includes(x.aplica), `${e.id} ${m}`);
      assert.ok(x.criterio || x.fuentes?.length, `${e.id} ${m} sin criterio ni fuente`);
      for (const f of x.fuentes || []) assert.ok(DATOS.fuentes[f], `${e.id} ${m}: fuente ${f}`);
      for (const n of x.normativa || []) {
        assert.ok(n.url && n.fecha_revision && DATOS.fuentes[n.fuente], `${e.id} ${m}: normativa sin url/fecha/fuente`);
      }
    }
  }
});

test("cebos: cada uno con pestañas válidas; en submarina no hay cebos", () => {
  for (const e of DATOS.especies) {
    for (const c of e.cebos) {
      const ms = modalidadesDeCebo(c);
      assert.ok(ms.length, `${e.id}: ${c.nombre} sin modalidad`);
      for (const m of ms) assert.ok(["costa", "embarcacion"].includes(m), `${e.id}: ${c.nombre} → ${m}`);
    }
    assert.deepEqual(cebosParaRegion(e, "cantabrico", 5, "submarina"), []);
  }
  assert.deepEqual(modalidadesDeCebo({ modalidad: "roca/embarcación" }), ["costa", "embarcacion"]);
  assert.deepEqual(modalidadesDeCebo({ modalidad: "jigging" }), ["embarcacion"]);
  for (const c of cebosParaRegion(especie("lubina"), "cantabrico", 5, "costa")) assert.ok(c.modalidades.includes("costa"));
});

test("reglas por modalidad: cada factor explica su porqué", () => {
  for (const [m, r] of Object.entries(DATOS.reglas_por_modalidad)) {
    assert.ok(MODALIDADES.includes(m));
    for (const [k, v] of Object.entries(r)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      assert.ok(v.criterio || v.fuente, `${m}.${k} sin criterio`);
    }
  }
});

test("submarina: de noche puntúa 0 y se dice por qué (art. 16.d RD 347/2011)", () => {
  const res = ventana("lubina", "submarina", serie(), { turbidez: "no turbia" });
  const sol = solDelDia("2026-10-08", MUNDAKA.lat, MUNDAKA.lon);
  const am = minutosMadrid(sol.amanecer), an = minutosMadrid(sol.anochecer);
  for (const r of res.filter((x) => x.hora.startsWith("2026-10-08"))) {
    const ini = Number(r.hora.slice(11, 13)) * 60;
    if (ini + 60 <= am || ini >= an) {
      assert.equal(r.puntuacion, 0, r.hora);
      assert.equal(r.prohibida, true);
      assert.match(r.razones[0].texto, /prohibida/);
    }
  }
  assert.equal(hora(res, "02").prohibida, true);
  assert.equal(hora(res, "13").prohibida, false);
  assert.ok(hora(res, "13").puntuacion > 0);
});

test("submarina: el agua clara suma y la turbia resta (aunque a la lubina desde costa le guste turbia)", () => {
  const clara = hora(ventana("lubina", "submarina", serie(), { turbidez: "no turbia" }), "13");
  const turbia = hora(ventana("lubina", "submarina", serie(), { turbidez: "turbia" }), "13");
  // Escala logística v2: lejos de 50 la curva se satura, así que la misma
  // diferencia en log-odds da algo menos de puntos que con la suma lineal
  // antigua (antes se pedían 25).
  assert.ok(clara.puntuacion - turbia.puntuacion >= 20, `${clara.puntuacion} vs ${turbia.puntuacion}`);
  const costaClara = hora(ventana("lubina", "costa", serie(), { turbidez: "no turbia" }), "13");
  const costaTurbia = hora(ventana("lubina", "costa", serie(), { turbidez: "turbia" }), "13");
  assert.ok(costaTurbia.puntuacion > costaClara.puntuacion);
  // Las reglas de la lubina para turbidez no se cuelan en submarina.
  const r = reglasParaModalidad(DATOS.reglas_por_defecto, especie("lubina"), "submarina", DATOS.reglas_por_modalidad);
  assert.equal(r.turbidez.preferencia.turbia, -0.6);
});

test("submarina: mar de fondo, lluvia previa y río crecido restan", () => {
  const base = hora(ventana("sargo", "submarina", serie()), "13").puntuacion;
  const fondo = hora(ventana("sargo", "submarina", serie({ ola: 1.2 })), "13").puntuacion;
  const peligrosa = hora(ventana("sargo", "submarina", serie({ ola: 1.8 })), "13");
  const lluvia = hora(ventana("sargo", "submarina", serie((i) => ({ lluvia: i < 12 ? 2 : 0 }))), "13");
  const rio = hora(ventana("sargo", "submarina", serie(), { caudalRio: "alto" }), "13").puntuacion;
  assert.ok(fondo < base && rio < base && lluvia.puntuacion < base);
  assert.ok(peligrosa.marPeligrosa && peligrosa.puntuacion <= 15);
  assert.ok(lluvia.razones.some((x) => x.factor === "lluvia" && /24 h/.test(x.texto)));
});

test("embarcación: avisos de kayak y de embarcación pequeña con tope", () => {
  const tranquila = hora(ventana("lubina", "embarcacion", serie()), "13");
  assert.equal(tranquila.avisos.length, 0);
  const kayak = hora(ventana("lubina", "embarcacion", serie({ viento: 25 })), "13");
  assert.equal(kayak.avisos[0].nivel, "kayak");
  assert.ok(kayak.puntuacion <= 35);
  const pequena = hora(ventana("lubina", "embarcacion", serie({ viento: 35 })), "13");
  assert.equal(pequena.avisos[0].nivel, "embarcacion_pequena");
  assert.ok(pequena.puntuacion <= 15);
  const olaKayak = hora(ventana("lubina", "embarcacion", serie({ ola: 1.8 })), "13");
  assert.equal(olaKayak.avisos[0].nivel, "kayak");
  // Desde costa, 25 km/h no da aviso ni tope.
  const costa = hora(ventana("lubina", "costa", serie({ viento: 25 })), "13");
  assert.equal(costa.avisos.length, 0);
  assert.ok(costa.puntuacion > 35);
});

test("costa: sin modalidad en el contexto se comporta como antes", () => {
  const sinMod = calcularVentana(especie("lubina"), DATOS.reglas_por_defecto, serie(), { ...MUNDAKA, turbidez: "turbia" });
  const conMod = ventana("lubina", "costa", serie(), { turbidez: "turbia" });
  assert.deepEqual(sinMod.map((r) => r.puntuacion), conMod.map((r) => r.puntuacion));
});

test("normativa: submarina en Euskadi y en Portugal, con artículo, url y fecha", () => {
  const eus = normativaModalidad(DATOS, "submarina", "cantabrico", { euskadi: true });
  const js = new Set(eus.general.map((n) => n.jurisdiccion));
  assert.ok(js.has("ES") && js.has("ES-PV") && !js.has("ES-CB"));
  assert.equal(eus.general[0].jurisdiccion, "ES-PV", "lo autonómico primero");
  assert.ok(eus.general.some((n) => /noche/.test(n.texto) && n.articulo === "art. 16"));
  assert.ok(eus.general.some((n) => /250 m/.test(n.texto)));
  const pt = normativaModalidad(DATOS, "submarina", "portugal");
  assert.ok(pt.general.every((n) => n.jurisdiccion === "PT"));
  assert.ok(pt.general.some((n) => /15 kg/.test(n.texto)));
  const cant = normativaModalidad(DATOS, "costa", "cantabrico");
  assert.ok(cant.pendiente.some((p) => p.jurisdiccion === "ES-CB"));
  for (const m of MODALIDADES) {
    for (const n of DATOS.normativa_modalidades[m]) {
      assert.ok(n.url && n.fecha_revision && DATOS.fuentes[n.fuente], `${m}: ${n.texto.slice(0, 40)}`);
    }
  }
  const bonito = normativaModalidad(DATOS, "embarcacion", "cantabrico", { euskadi: true, especie: especie("bonito_norte") });
  assert.ok(bonito.especie.some((n) => /20/.test(n.texto) && n.jurisdiccion === "ES-PV"));
});

test("post de Instagram: por defecto de costa, nunca con el bonito; en embarcación sí puede salir", () => {
  assert.equal(modalidadDelPost({}), "costa");
  assert.equal(modalidadDelPost({ MODALIDAD_POST: "embarcacion" }), "embarcacion");
  for (let mes = 1; mes <= 12; mes++) {
    for (let dia = 0; dia < 10; dia++) {
      const r = elegirEspeciePost(DATOS, "cantabrico", mes, dia, { euskadi: true });
      if (r) {
        assert.notEqual(r.especie.id, "bonito_norte");
        assert.ok(aplicaModalidad(r.especie, "costa", "cantabrico"));
      }
    }
  }
  const salen = new Set();
  for (let dia = 0; dia < 20; dia++) salen.add(elegirEspeciePost(DATOS, "cantabrico", 8, dia, { modalidad: "embarcacion" })?.especie.id);
  assert.ok(salen.has("bonito_norte"));
});

// Especies añadidas el 2026-10-08 ("¿y el resto de especies? rodaballo, cabracho…").
test("especies nuevas: cada una en sus pestañas; las de mar adentro nunca en 'Desde costa'", () => {
  const MAR_ADENTRO = ["besugo", "merluza", "gallo", "rape", "atun_rojo", "llampuga"];
  for (const region of DATOS.regiones) {
    const costa = ids(especiesParaModalidad(DATOS, region, "costa"));
    for (const id of MAR_ADENTRO) assert.ok(!costa.includes(id), `${id} desde costa en ${region}`);
    for (let mes = 1; mes <= 12; mes++) {
      const tc = ids(especiesDeTemporada(DATOS, region, mes, "costa"));
      for (const id of MAR_ADENTRO) assert.ok(!tc.includes(id), `${id} costa ${region} ${mes}`);
    }
    assert.ok(!ids(especiesParaModalidad(DATOS, region, "submarina")).includes("atun_rojo"));
  }
  const emb = ids(especiesParaModalidad(DATOS, "cantabrico", "embarcacion"));
  for (const id of ["merluza", "besugo", "gallo", "rape", "rodaballo", "remol", "maragota"]) assert.ok(emb.includes(id), `${id} embarcación`);
  const med = (m) => ids(especiesParaModalidad(DATOS, "mediterraneo", m));
  for (const id of ["cabracho", "pez_limon", "sargo_picudo", "mojarra"]) assert.ok(med("submarina").includes(id), `${id} submarina`);
  for (const id of ["herrera", "raspallon", "oblada", "anjova", "mojarra"]) assert.ok(med("costa").includes(id), `${id} costa`);
  // El mero no sale en submarina hasta verificar la norma de cada comunidad.
  assert.ok(!med("submarina").includes("mero"));
  assert.ok(ids(especiesParaModalidad(DATOS, "canarias", "embarcacion")).includes("abade"));
});

test("Mikel (Bizkaia): rodaballo desde playa oct-dic y rayas y pintarroja desde costa nov-ene en el Cantábrico", () => {
  for (const mes of [10, 11, 12]) assert.ok(ids(especiesDeTemporada(DATOS, "cantabrico", mes, "costa")).includes("rodaballo"), `rodaballo ${mes}`);
  for (const mes of [11, 12, 1]) {
    const c = ids(especiesDeTemporada(DATOS, "cantabrico", mes, "costa"));
    assert.ok(c.includes("raya") && c.includes("pintarroja"), `mes ${mes}`);
  }
  assert.ok(!ids(especiesDeTemporada(DATOS, "cantabrico", 7, "costa")).includes("pintarroja"));
  assert.ok(!("freza" in especie("rodaballo")), "Mikel: sin freza en la ficha del rodaballo");
  for (const id of ["rodaballo", "raya", "pintarroja"]) assert.ok(especie(id).modalidades.costa.fuentes.includes("mikel_campo_bizkaia"));
});

test("atún rojo: nunca de temporada (solo captura y suelta en España, prohibido en Portugal) y la norma se ve en embarcación", () => {
  for (const region of DATOS.regiones) {
    for (let mes = 1; mes <= 12; mes++) {
      for (const m of MODALIDADES) assert.ok(!ids(especiesDeTemporada(DATOS, region, mes, m)).includes("atun_rojo"), `${region} ${mes} ${m}`);
    }
  }
  const n = normativaModalidad(DATOS, "embarcacion", "mediterraneo", { especie: especie("atun_rojo") });
  assert.ok(n.especie.some((x) => /captura y suelta/.test(x.texto)));
  const pv = normativaModalidad(DATOS, "embarcacion", "cantabrico", { euskadi: true, especie: especie("atun_rojo") });
  assert.ok(pv.especie.some((x) => x.jurisdiccion === "ES-PV" && /prohibida/.test(x.texto)));
});

test("profundidad por temporada (Mikel, embarcación): pargo, dorada y dentón; consejo corto y solo en embarcación", () => {
  for (const id of ["bocinegro", "dorada", "denton"]) {
    assert.equal(consejoProfundidad(especie(id), "embarcacion"), "Verano: a unos 20 m · Invierno: más profundo");
    assert.equal(consejoProfundidad(especie(id), "costa"), null);
    const p = especie(id).modalidades.embarcacion.profundidad_temporada;
    assert.ok(p.fuentes.every((f) => DATOS.fuentes[f]));
  }
  assert.equal(consejoProfundidad(especie("lubina"), "embarcacion"), null);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(/consejoProfundidad\(especie, vaEstado\.modalidad\)/.test(html));
  assert.ok(!/hondo/.test(JSON.stringify(DATOS)));
});
