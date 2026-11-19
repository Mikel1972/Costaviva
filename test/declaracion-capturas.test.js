// Aviso de declaración obligatoria (assets/js/declaracion-capturas.js), 2026-11-19.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { declaracionNecesaria, paisDeclaracion, puntoEnEspanaOPortugal, textoParaDeclarar, ESPECIES } from "../assets/js/declaracion-capturas.js";

test("España: el anexo II del RD 347/2011 tras el RD 214/2026 (BOE consolidado 2026-11-19)", () => {
  assert.equal(ESPECIES.es.length, 14);
  for (const c of ["Dicentrarchus labrax", "Pollachius pollachius", "Merluccius merluccius", "Thunnus alalunga", "Solea solea", "Coryphaena hippurus", "Pagellus bogaraveo"]) {
    assert.equal(declaracionNecesaria(c, "cantabrico")?.app, "PescaREC", c);
  }
  assert.equal(declaracionNecesaria("Makaira nigricans", "baleares")?.app, "PescaREC"); // Makaira spp.
  assert.equal(declaracionNecesaria("Diplodus sargus", "cantabrico"), null);
  assert.equal(declaracionNecesaria("Conger conger", "cantabrico"), null);
});

test("Portugal: lubina, atún rojo y marlines en RecFishing; merluza no", () => {
  assert.equal(declaracionNecesaria("Dicentrarchus labrax", "portugal")?.app, "RecFishing");
  assert.equal(declaracionNecesaria("Thunnus thynnus", "azores")?.app, "RecFishing");
  assert.equal(declaracionNecesaria("Merluccius merluccius", "portugal"), null);
});

test("Nueva Zelanda y casos dudosos: no se avisa", () => {
  assert.equal(paisDeclaracion("nz_auckland"), null);
  assert.equal(declaracionNecesaria("Dicentrarchus labrax", "nueva_zelanda"), null);
  assert.equal(declaracionNecesaria("Dicentrarchus labrax", null), null);
  assert.equal(declaracionNecesaria(null, "cantabrico"), null);
  assert.equal(declaracionNecesaria("Trachurus trachurus / Scomber scombrus", "cantabrico"), null);
  assert.equal(declaracionNecesaria("Dicentrarchus  LABRAX", "cantabrico")?.pais, "es");
});

test("el texto para copiar omite lo vacío", () => {
  assert.equal(textoParaDeclarar([["Especie", "Lubina"], ["Talla", ""], ["Peso", null], ["Hora", "07:30"]]), "Especie: Lubina\nHora: 07:30");
});

test("el diario enseña el aviso en cada captura y sin onclick", () => {
  const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(html, /avisoDeclaracionHTML\(captura, salida, cientifico\)/);
  assert.match(html, /capturas\.map\(\(c\) => tarjetaCapturaHTML\(c, salida\)\)/);
  assert.doesNotMatch(html, /copiar-declaracion[^>]*onclick/);
});

test("solo puntos de España y Portugal: Francia y el extranjero no", () => {
  assert.equal(puntoEnEspanaOPortugal(43.42, -2.95), true); // Bizkaia
  assert.equal(puntoEnEspanaOPortugal(38.72, -9.14), true); // Lisboa
  assert.equal(puntoEnEspanaOPortugal(39.57, 2.65), true); // Palma
  assert.equal(puntoEnEspanaOPortugal(28.1, -15.4), true); // Gran Canaria
  assert.equal(puntoEnEspanaOPortugal(42.43, 3.15), true); // Portbou
  assert.equal(puntoEnEspanaOPortugal(43.48, -1.56), false); // Biarritz
  assert.equal(puntoEnEspanaOPortugal(43.3, 5.37), false); // Marsella
  assert.equal(puntoEnEspanaOPortugal(42.7, 3.04), false); // Rosellón
  assert.equal(puntoEnEspanaOPortugal(-36.8, 174.8), false); // Auckland
  assert.equal(puntoEnEspanaOPortugal(NaN, 1), false);
});
