// Pueblos de NZ con página de mareas propia (functions/_lib/nz/pueblos-nz.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUEBLOS_NZ } from "../functions/_lib/nz/pueblos-nz.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { eventosDePuerto } from "../functions/_lib/nz/mareas-linz.js";
import { paginaMareaNZ, paginaZonaMareasNZ, urlsEn } from "../functions/_lib/seo/paginas-en.js";
import { ZONAS_NZ } from "../functions/_lib/nz/zonas-nz.js";
import { SPOTS } from "../functions/prevision.js";
import { PUEBLOS_ALIAS } from "../functions/mareas/_regiones.js";

const catalogo = JSON.parse(readFileSync(new URL("../datos/nz/linz-puertos.json", import.meta.url)));
const anios = [JSON.parse(readFileSync(new URL("../datos/nz/linz-mareas-2026.json", import.meta.url)))];

test("cada pueblo: puerto oficial de LINZ, no aproximado, con alturas y en sus coordenadas", () => {
  for (const p of PUEBLOS_NZ) {
    const sec = catalogo.secundarios[p.puerto_linz.id];
    assert.ok(sec, p.slug);
    assert.equal(sec.nombre, p.puerto_linz.nombre, p.slug);
    assert.equal(sec.aproximado, false, p.slug);
    assert.notEqual(sec.msl, null, p.slug);
    assert.equal(sec.lat, p.lat, p.slug);
    assert.equal(sec.lon, p.lon, p.slug);
    assert.equal(p.puerto_linz.tabla, sec.tabla || null, p.slug);
  }
});

test("los pueblos no chocan con spots y su marea sale de LINZ", () => {
  const slugs = new Set(SPOTS_NZ.map((s) => s.slug));
  for (const p of PUEBLOS_NZ) {
    assert.ok(!slugs.has(p.slug), p.slug);
    assert.ok(p.slug.startsWith("nz-"));
    // Con la tabla propia si ya está bajada; si no, el secundario (como [slug].js).
    let ev = eventosDePuerto(p.puerto_linz, catalogo, anios);
    if (!ev.length) ev = eventosDePuerto({ ...p.puerto_linz, tabla: null }, catalogo, anios);
    if (p.slug === "nz-clarks-beach" && !ev.length) continue; // Onehunga: la baja linz-mareas.yml
    assert.ok(ev.length > 100, `${p.slug}: ${ev.length} eventos`);
  }
});

test("página del pueblo: tabla de LINZ y enlace al spot más cercano, no a /en/spots/<pueblo>", () => {
  const p = PUEBLOS_NZ.find((x) => x.slug === "nz-opotiki");
  const dias = [{ dia: "today", tipo: "pleamar", hora: "10:00", altura: 1.6 }];
  const { html } = paginaMareaNZ(p, SPOTS, { dias });
  assert.match(html, /Ōpōtiki tide times today/);
  assert.match(html, /Ōpōtiki Wharf/);
  assert.match(html, new RegExp(`/en/spots/${p.spotCercano.slug}`));
  assert.doesNotMatch(html, /\/en\/spots\/nz-opotiki/);
});

test("zona y sitemap enlazan los pueblos", () => {
  const z = ZONAS_NZ.find((x) => x.zona === "Bay of Plenty");
  const { html } = paginaZonaMareasNZ(z, SPOTS, []);
  assert.match(html, /Tide times today by town/);
  assert.match(html, /href="\/en\/tides\/nz-mount-maunganui">Mount Maunganui tide times/);
  const urls = urlsEn({ spots: SPOTS, especies: { especies: [] }, fecha: "2026-11-25" }).map((u) => u.loc);
  for (const p of PUEBLOS_NZ) assert.ok(urls.includes(`https://costaviva.org/en/tides/${p.slug}`), p.slug);
});

test("pueblos de España con la marea de un spot: solo spots que existen", () => {
  const slugs = new Set(SPOTS.map((s) => s.slug));
  for (const k of Object.keys(PUEBLOS_ALIAS)) assert.ok(slugs.has(k), k);
});
