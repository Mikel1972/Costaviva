// Región Nueva Zelanda detrás del interruptor (fase 1 de NZ, 2026-10-09).
// Con "nz" fuera de REGIONES_ACTIVAS no cambia nada de lo que se ve en
// España: ni /prevision, ni el sitemap, ni las páginas /spots, ni el mapa,
// ni el diario, ni el marketing. Sin red. Corre en tests.yml.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { REGIONES_ACTIVAS, regionActiva, spotsRegionesActivas } from "../functions/_lib/regiones-activas.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { SPOTS } from "../functions/prevision.js";
import { SPOTS as SPOTS_SEO } from "../functions/_lib/seo/carga.js";
import { urlsSitemap } from "../functions/_lib/seo/sitemap.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const especies = JSON.parse(leer("assets/datos/especies.json"));
const esNZ = (s) => s.pais === "nz" || String(s.slug).startsWith("nz-") || s.lon > 160 || s.lat < -30;

test("interruptor: NZ apagada en producción", () => {
  assert.deepEqual([...REGIONES_ACTIVAS], ["es"]);
  assert.equal(regionActiva("nz"), false);
  assert.equal(regionActiva("es"), true);
  assert.deepEqual(spotsRegionesActivas(), []);
  assert.equal(spotsRegionesActivas(["es", "nz"]).length, 60);
});

test("/prevision y las páginas públicas no llevan ningún spot de NZ", () => {
  assert.equal(SPOTS.filter(esNZ).length, 0);
  assert.equal(SPOTS_SEO.filter(esNZ).length, 0);
  assert.equal(SPOTS.length, 105);
});

test("datos/nz no se sirve en público (lista blanca de rutas)", () => {
  for (const r of ["/datos/nz/linz-puertos.json", "/datos/nz/linz-mareas-2026.json", "/datos/nz/reservas-marinas-doc.geojson"]) {
    assert.equal(esRutaPermitida(r), false, r);
  }
});

test("sitemap (generado y el de disco) sin NZ", () => {
  const urls = urlsSitemap({ spots: SPOTS, especies, tipoFondo: null, profundidad: null });
  assert.ok(urls.length > 0);
  assert.ok(!urls.some((u) => /\/nz-|\/nz\//.test(u.loc)));
  assert.ok(!/\/nz-|\/nz\//.test(leer("sitemap.xml")));
});

test("mapa, diario, marketing y páginas de la app sin spots de NZ", () => {
  const ficheros = [
    ...readdirSync(RAIZ).filter((f) => f.endsWith(".html")),
    "assets/js/tarjetas-mapa.js",
    ...readdirSync(join(RAIZ, "scripts/marketing")).filter((f) => f.endsWith(".mjs")).map((f) => `scripts/marketing/${f}`),
  ];
  for (const f of ficheros) {
    const texto = leer(f);
    assert.ok(!/["']nz-[a-z]/.test(texto), `${f} menciona un slug de NZ`);
    for (const s of SPOTS_NZ) assert.ok(!texto.includes(String(s.lat)) || !texto.includes(String(s.lon)), `${f}: coordenadas de ${s.slug}`);
  }
});

test("spots NZ: forma, región, zona horaria y ubicaciones por revisar", () => {
  assert.equal(SPOTS_NZ.length, 60);
  const slugs = new Set(SPOTS_NZ.map((s) => s.slug));
  assert.equal(slugs.size, 60);
  const espana = new Set(SPOTS.filter((s) => s.pais !== "nz").map((s) => s.slug));
  const regiones = new Set(["nz_auckland_kermadec", "nz_central", "nz_challenger", "nz_south_east", "nz_kaikoura", "nz_southland", "nz_fiordland"]);
  for (const s of SPOTS_NZ) {
    assert.match(s.slug, /^nz-[a-z0-9-]+$/);
    assert.ok(!espana.has(s.slug));
    assert.equal(s.pais, "nz");
    assert.equal(s.tz, "Pacific/Auckland");
    assert.ok(regiones.has(s.region), `${s.slug}: ${s.region}`);
    assert.ok(s.lat < -34 && s.lat > -47.5 && s.lon > 166 && s.lon < 179, `${s.slug} fuera de NZ`);
    assert.ok(s.modalidades.length && s.modalidades.every((m) => ["costa", "embarcacion"].includes(m)));
    assert.ok(s.puerto_linz && s.puerto_linz.nombre, `${s.slug} sin puerto LINZ`);
    // Centro de pueblo, fiordo o edificio: hay que moverlo antes de publicar.
    const centro = /\b(place|boundary|amenity|tourism)=|natural=(bay|peak)/.test(s.osm);
    assert.equal(Boolean(s.revisar_ubicacion), centro, `${s.slug} (${s.osm})`);
  }
  assert.equal(SPOTS_NZ.find((s) => s.slug === "nz-kaikoura").region, "nz_kaikoura");
  assert.equal(SPOTS_NZ.find((s) => s.slug === "nz-milford-sound").region, "nz_fiordland");
});
