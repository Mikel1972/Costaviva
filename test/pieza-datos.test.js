// Lógica pura de las piezas de Instagram (scripts/marketing/pieza-datos.mjs,
// 2026-10-08): índice del día, motivos, ventana, guion del reel, rotación y
// los textos (sin afirmaciones que no se puedan demostrar). Sin red: corre en
// tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resumenDelDia, flecha, motivosDestacados, mejorTramo, tarjetasCondiciones, textoFuerzaViento,
  GANCHOS, CLAIMS, FUNCIONES, ROTACION_REELS, siguientePieza, GUION_REEL, DURACION_REEL, escenaEn, contar, fotogramas, bboxMercator,
} from "../scripts/marketing/pieza-datos.mjs";
import * as VA from "../assets/js/ventana-actividad.js";

const especies = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));

// Serie de ejemplo con la forma de serieHoraria(): ayer, hoy y mañana.
function serie(dia = "2026-10-08") {
  const horas = [];
  const base = new Date(`${dia}T00:00:00Z`).getTime();
  for (let h = -24; h < 48; h++) {
    const t = new Date(base + h * 3600e3).toISOString().slice(0, 13) + ":00";
    horas.push({ hora: t, nivelMar: +(1.8 * Math.sin((h * 2 * Math.PI) / 12.42)).toFixed(2), ola: 0.8, tempAgua: 19.2, viento: 10, vientoDir: 190, presion: 1016, lluvia: 0 });
  }
  return horas;
}

test("resumenDelDia: misma nota que indiceSpot y 24 barras de hoy", () => {
  const horas = serie();
  const lat = 43.4297, lon = -2.8103, ahoraISO = "2026-10-08T13:00";
  const r = resumenDelDia(especies, horas, { lat, lon, ahoraISO });
  assert.ok(r, "debe haber resumen");
  const i = horas.findIndex((h) => h.hora === ahoraISO);
  const ind = VA.indiceSpot(especies, horas, i, { lat, lon, modalidad: "costa", horaActual: ahoraISO });
  assert.equal(r.puntuacion, Math.round(ind.puntuacion));
  assert.equal(r.especie, ind.especie.nombre);
  assert.equal(r.barras.length, 24);
  assert.ok(["bueno", "medio", "malo"].includes(r.nivel));
  assert.ok(r.motivos.length <= 3);
});

test("resumenDelDia: ola peligrosa como aviso aparte, no como motivo ni tope", () => {
  const ahoraISO = "2026-10-08T13:00", lat = 43.4297, lon = -2.8103;
  const tranquila = resumenDelDia(especies, serie(), { lat, lon, ahoraISO });
  assert.equal(tranquila.avisoOla, null);
  const horas = serie().map((h) => ({ ...h, ola: 3.2 }));
  const r = resumenDelDia(especies, horas, { lat, lon, ahoraISO });
  assert.equal(r.avisoOla, "⚠️ Ola peligrosa desde costa (3-3,5 m): extrema la precaución");
  assert.ok(!r.motivos.some((m) => /peligros|tope/i.test(m.texto)));
  const i = horas.findIndex((h) => h.hora === ahoraISO);
  const ind = VA.indiceSpot(especies, horas, i, { lat, lon, modalidad: "costa", horaActual: ahoraISO });
  assert.equal(r.puntuacion, Math.round(ind.puntuacion));
  assert.ok(!ind.resultado.razones.some((x) => x.factor === "tope"));
});

test("resumenDelDia: sin la hora actual en la serie, null (no se inventa)", () => {
  assert.equal(resumenDelDia(especies, serie(), { lat: 43.4, lon: -2.8, ahoraISO: "2030-01-01T10:00" }), null);
});

test("flechas y motivos como en la ficha", () => {
  assert.equal(flecha(8), "▲▲"); assert.equal(flecha(2), "▲");
  assert.equal(flecha(-7), "▼▼"); assert.equal(flecha(-1), "▼"); assert.equal(flecha(0), "");
  const m = motivosDestacados([{ texto: "a", aporte: 2 }, { texto: "b", aporte: -9 }, { texto: "c", aporte: 0 }, { texto: "d", aporte: 5 }]);
  assert.deepEqual(m.map((x) => x.texto), ["b", "d", "a"]);
  assert.equal(m[0].sube, false);
});

test("mejorTramo: las 3 horas seguidas con mejor media", () => {
  const b = Array(24).fill(40); b[19] = 80; b[20] = 82; b[21] = 79;
  assert.deepEqual(mejorTramo(b), { desde: 19, hasta: 22, texto: "19–22 h" });
  assert.equal(mejorTramo([50, 60]), null);
});

test("tarjetas de ola, viento y marea", () => {
  const t = tarjetasCondiciones({ altura: [0.7, 1.04], periodo: 11, dirOla: "NW 318°", viento: 11.4, dirViento: "SSW 200°" },
    { altura: 3.1, tendencia: "subiendo", proximas: [{ tipo: "pleamar", hora: "16:42" }] });
  assert.deepEqual(t.map((x) => x.val), ["0,7–1 m", "11 km/h", "3,1 m ↑"]);
  assert.equal(t[0].sub, "11 s · NW");
  assert.equal(t[1].sub, "SSW, flojo");
  assert.equal(t[2].sub, "pleamar 16:42");
  assert.equal(textoFuerzaViento(35), "fuerte");
});

test("guion del reel: 3 escenas, ~10 s y la cuenta acaba en el valor exacto", () => {
  assert.deepEqual(GUION_REEL.map((e) => e.escena), ["gancho", "datos", "cierre"]);
  assert.ok(DURACION_REEL >= 8 && DURACION_REEL <= 10.5);
  assert.equal(escenaEn(0).escena, "gancho");
  assert.equal(escenaEn(4).escena, "datos");
  assert.equal(escenaEn(DURACION_REEL - 0.01).escena, "cierre");
  assert.equal(escenaEn(99).progreso, 1);
  assert.equal(contar(77, 0), 0); assert.equal(contar(77, 1), 77); assert.equal(contar(77, 2), 77);
  assert.equal(fotogramas(30), Math.round(30 * DURACION_REEL));
});

test("rotación de reels: no todos son de condiciones y pasa por diario, grupos y alarma", () => {
  for (const t of ["diario", "grupos", "alarma", "especie"]) assert.ok(ROTACION_REELS.includes(t), t);
  const vistos = new Set();
  let i;
  for (let k = 0; k < ROTACION_REELS.length; k++) { const s = siguientePieza(i); vistos.add(s.tipo); i = s.indice; }
  assert.equal(vistos.size, new Set(ROTACION_REELS).size);
  assert.equal(siguientePieza(ROTACION_REELS.length - 1).indice, 0);
});

test("textos sin afirmaciones indemostrables ni promesas de seguridad", () => {
  const textos = [
    ...CLAIMS, GANCHOS.condiciones("Bakio"), GANCHOS.especie("Lubina"), GANCHOS.diario(), GANCHOS.grupos(), GANCHOS.alarma(),
    ...Object.values(FUNCIONES).flatMap((f) => [f.titulo, f.frase, f.claim, ...(f.puntos || []), f.aviso || ""]),
  ].join(" | ").toLowerCase();
  for (const prohibido of ["la primera", "la única", "la mejor", "salva", "segundo plano", "garantiza", "tipo de fondo"]) {
    assert.ok(!textos.includes(prohibido), `no debe decir "${prohibido}"`);
  }
  const alarma = JSON.stringify(FUNCIONES.alarma).toLowerCase();
  assert.ok(alarma.includes("experimental"));
  assert.ok(alarma.includes("app abierta"));
});

test("bboxMercator: el spot queda dentro del recorte", () => {
  const b = bboxMercator(43.4297, -2.8103);
  assert.ok(b.x > b.minx && b.x < b.maxx && b.y > b.miny && b.y < b.maxy);
});
