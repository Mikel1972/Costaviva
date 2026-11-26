// test/extra-nz.test.js — contenido añadido a las páginas de NZ (2026-11-26).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profundidadNZ, bloqueProfundidadNZ, camarasEnlaceNZ, bloqueCamarasNZ, cambiosDeTemporada } from "../functions/_lib/seo/extra-nz.js";
import { paginaSpotNZ, paginaZonaSpotsNZ } from "../functions/_lib/seo/paginas-en.js";
import { NZ } from "../functions/_lib/seo/paginas-nz.js";
import { SPOTS } from "../functions/prevision.js";
import { ZONAS_NZ } from "../functions/_lib/nz/zonas-nz.js";

const PROF = JSON.parse(readFileSync(new URL("../assets/datos/profundidad-spots.json", import.meta.url), "utf8"));
const ESPECIES = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));

test("profundidad de un spot NZ con GEBCO, en cada idioma y con la atribución", () => {
  const en = profundidadNZ(PROF, "nz-cape-reinga", "en");
  assert.ok(en.some((f) => /^Typical depth 1 km off the shore: about 13 m\.$/.test(f)));
  assert.ok(en.some((f) => /10 m at 580 m, 20 m at 840 m, 30 m at 1.7 km/.test(f)));
  assert.ok(profundidadNZ(PROF, "nz-cape-reinga", "es").some((f) => /30 m a 1,7 km/.test(f)));
  assert.match(bloqueProfundidadNZ(PROF, "nz-cape-reinga", "pt"), /GEBCO_2026 Grid/);
  assert.equal(profundidadNZ(PROF, "no-existe", "en"), null);
  assert.equal(bloqueProfundidadNZ(null, "nz-cape-reinga"), "");
});

test("cámaras NZ: solo enlace a la web de su dueño, nada insertado", () => {
  const cams = camarasEnlaceNZ("nz-tairua", "en");
  assert.ok(cams.length >= 2);
  assert.ok(cams.every((c) => /^https:\/\//.test(c.url) && c.dueno));
  const html = bloqueCamarasNZ("nz-tairua", "es");
  assert.match(html, /rel="noopener nofollow"/);
  assert.doesNotMatch(html, /<img|<iframe/);
  assert.equal(bloqueCamarasNZ("nz-no-existe"), "");
});

test("especies que empiezan temporada y las de su último mes", () => {
  const e = (id, meses) => ({ id, presencia: { A: { meses } } });
  const r = cambiosDeTemporada([e("a", [11, 12, 1]), e("b", [9, 10, 11]), e("c", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), e("d", [10, 11, 12])], new Set(["A"]), 11);
  assert.deepEqual(r.empiezan.map((x) => x.id), ["a"]);
  assert.deepEqual(r.terminan.map((x) => x.id), ["b"]);
  // Diciembre → enero da la vuelta al año.
  assert.deepEqual(cambiosDeTemporada([e("x", [12, 1, 2])], new Set(["A"]), 12).empiezan.map((x) => x.id), ["x"]);
});

test("las páginas NZ (en/es/pt) llevan profundidad, cámaras y el botón arriba", () => {
  const spot = SPOTS.find((s) => s.slug === "nz-tairua");
  const d = { especiesDatos: ESPECIES, spotPrev: null, reservas: [], profundidad: PROF, mes: 12 };
  const en = paginaSpotNZ(spot, SPOTS, d).html;
  assert.match(en, /id="t-cam"/);
  assert.match(en, /class="cta-arriba"/);
  if (PROF.spots["nz-tairua"]) assert.match(en, /id="t-fondo"/);
  for (const idioma of ["es", "pt"]) {
    const h = NZ[idioma].paginaSpot(spot, SPOTS, d).html;
    assert.match(h, /id="t-cam"/);
    assert.match(h, /class="cta-arriba"/);
  }
  const zona = ZONAS_NZ.find((z) => SPOTS.some((s) => s.slug === "nz-tairua" && s.zona === z.zona)) || ZONAS_NZ[0];
  assert.doesNotThrow(() => paginaZonaSpotsNZ(zona, SPOTS, ESPECIES, 12));
});
