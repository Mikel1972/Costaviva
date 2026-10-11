// Palabras clave de comun en el calendario de redes (2026-10-11) y datos de
// Search Console para comun. Lógica pura, sin red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as P from "../scripts/marketing/palabras-redes.mjs";
import { elegirEspeciePost, leerEspeciesJson } from "../scripts/marketing/especie-post.mjs";
import { agruparSemanas, filaConsulta, lunesDe } from "../scripts/seo/gsc-palabras.mjs";

const PALABRAS = {
  generado: new Date().toISOString(),
  terminos: [
    { termino: "pesca de lubina", mercado: "es", grupo: "especie", puntuacion: 40, tendencia: "estable", url: "/especies/lubina" },
    { termino: "pesca de calamar", mercado: "es", grupo: "especie", puntuacion: 60, tendencia: "sube", estacionalidad: { indice_mes_actual: 1.4 }, url: "/especies/calamar" },
    { termino: "mareas bakio", mercado: "es", grupo: "spot", puntuacion: 10, url: "/mareas/bakio" },
    { termino: "mareas mundaka", mercado: "es", grupo: "spot", puntuacion: 70, url: "/mareas/mundaka" },
    { termino: "jigging", mercado: "es", grupo: "tecnica", puntuacion: 80, tendencia: "sube" },
    { termino: "pesca a spinning", mercado: "es", grupo: "tecnica", puntuacion: 50 },
    { termino: "mejor hora para pescar", mercado: "es", grupo: "prevision", puntuacion: 90 },
    { termino: "snapper fishing", mercado: "nz", grupo: "especie", puntuacion: 99, url: "/en/species/nz-snapper" },
  ],
};

test("valor para redes: demanda, tendencia y temporada, acotados", () => {
  assert.equal(P.valorRedes({ puntuacion: 0 }, 10), 0);
  assert.equal(P.valorRedes({ puntuacion: 50, tendencia: "sube" }, 10), 65);
  assert.equal(P.valorRedes({ puntuacion: 50, estacionalidad: { indice_mes_actual: 9 } }, 10), 75, "la temporada pesa como mucho x1,5");
  assert.equal(P.valorRedes({ puntuacion: 50, estacionalidad: { picos: [10] } }, 10), 60);
});

test("especie: entre las que ya valen, la más buscada; si ninguna tiene demanda, rotación", () => {
  const pref = P.preferenciaEspecie(PALABRAS, 10);
  assert.equal(pref({ id: "calamar" }) > pref({ id: "lubina" }), true);
  assert.equal(pref({ id: "pez_limon" }), 0);
  assert.equal(P.preferenciaEspecie(null, 10), null);
  const lista = [{ id: "lubina" }, { id: "calamar" }, { id: "sargo" }];
  assert.equal(P.elegirPorDemanda(lista, (e) => e.id, P.valoresPorSlug(PALABRAS, { grupos: ["especie"], prefijos: ["/especies/"], mes: 10 })).elegida.id, "calamar");
  assert.equal(P.elegirPorDemanda([{ id: "sargo" }], (e) => e.id, new Map()), null);
});

test("elegirEspeciePost respeta temporada y veda: la preferencia solo ordena", () => {
  const datos = leerEspeciesJson(fileURLToPath(new URL("..", import.meta.url)));
  const sin = elegirEspeciePost(datos, "cantabrico", 10, 1).especie.id;
  const otra = elegirEspeciePost(datos, "cantabrico", 10, 2).especie.id;
  assert.notEqual(sin, otra, "hacen falta dos candidatas distintas para la prueba");
  assert.equal(elegirEspeciePost(datos, "cantabrico", 10, 1, { preferencia: (e) => (e.id === otra ? 50 : 0) }).especie.id, otra);
  // Demanda de una especie que no vale ese mes en esa región (de altura): no
  // entra; manda la rotación de siempre.
  assert.equal(elegirEspeciePost(datos, "cantabrico", 10, 1, { preferencia: (e) => (e.id === "atun_rojo" ? 50 : 0) }).especie.id, sin);
});

test("spots: misma zona, primero el más buscado, empates en el orden de la rotación", () => {
  assert.deepEqual(P.ordenarSpots(["bakio", "sopelana", "mundaka"], PALABRAS, 10), ["mundaka", "bakio", "sopelana"]);
  assert.deepEqual(P.ordenarSpots(["sopelana", "getxo"], PALABRAS, 10), ["sopelana", "getxo"]);
  assert.deepEqual(P.ordenarSpots(["a", "b"], null, 10), ["a", "b"]);
});

test("hashtags: términos cortos con demanda, sin repetir los fijos", () => {
  const h = P.hashtagsDemanda(PALABRAS, "#pesca #jigging", { mes: 10, max: 3 });
  assert.deepEqual(h, ["#pescaspinning"], "jigging ya estaba; 'mejor hora para pescar' es largo");
  assert.deepEqual(P.hashtagsDemanda(null), []);
});

test("palabras.json viejo o roto: no se usa", () => {
  const dir = mkdtempSync(join(tmpdir(), "pal-"));
  writeFileSync(join(dir, "ok.json"), JSON.stringify(PALABRAS));
  writeFileSync(join(dir, "viejo.json"), JSON.stringify({ ...PALABRAS, generado: "2026-01-01T00:00:00Z" }));
  writeFileSync(join(dir, "roto.json"), "{");
  assert.ok(P.leerPalabras(join(dir, "ok.json")));
  assert.equal(P.leerPalabras(join(dir, "viejo.json")), null);
  assert.equal(P.leerPalabras(join(dir, "roto.json")), null);
  assert.equal(P.leerPalabras(join(dir, "no.json")), null);
});

test("Search Console para comun: semanas completas y búsquedas con página", () => {
  assert.equal(lunesDe("2026-10-11"), "2026-10-05");
  const dias = [];
  for (let d = 28; d <= 30; d++) dias.push({ keys: [`2026-09-${d}`], clicks: 1, impressions: 10, position: 20 });
  for (let d = 1; d <= 11; d++) dias.push({ keys: [`2026-10-${String(d).padStart(2, "0")}`], clicks: 0, impressions: 5, position: 30 });
  const s = agruparSemanas(dias, "2026-10-09");
  assert.deepEqual(s.map((x) => x.semana), ["2026-09-28"], "la semana del 5/10 no está cerrada el 9/10");
  assert.deepEqual(s[0], { semana: "2026-09-28", clics: 3, impresiones: 50, posicion: 24 });
  assert.deepEqual(filaConsulta({ keys: ["mareas mundaka", "https://costaviva.org/mareas/mundaka"], clicks: 0, impressions: 3, position: 24.04 }), { query: "mareas mundaka", pagina: "/mareas/mundaka", clics: 0, impresiones: 3, posicion: 24 });
});
