// Cámaras caídas (2026-10-11): una cámara congelada se retira por la edad de
// su fotograma (no por la última lectura), las de SOCIB no vuelven sin
// comprobar, y el parte no arrastra filas de cámaras ya retiradas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WEBCAMS } from "../functions/webcam/[slug].js";
import { camaraOculta } from "../assets/js/camaras-externas.js";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const index = leer("index.html");

function funcionDeIndex(nombre) {
  const i = index.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `${nombre} no está en index.html`);
  let nivel = 0;
  for (let j = index.indexOf("{", i); j < index.length; j++) {
    if (index[j] === "{") nivel++;
    else if (index[j] === "}" && --nivel === 0) return index.slice(i, j + 1);
  }
  throw new Error(`no se pudo leer ${nombre}`);
}

function cargarRetirada(CAMARAS, ahora) {
  const fuente = [funcionDeIndex("inicioSinSenal"), funcionDeIndex("camaraRetirada")].join("\n");
  // eslint-disable-next-line no-new-func
  return new Function("CAMARAS", "HORAS_CAMARA_RETIRADA", "Date", `${fuente}; return camaraRetirada;`)(
    CAMARAS, 24, class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } }
  );
}

test("una cámara congelada más de 24 h se retira aunque su última lectura sea de ahora", () => {
  const ahora = Date.parse("2026-10-11T10:00:00Z");
  const CAMARAS = {
    pasaia: { sinSenal: true, motivo: "frame_congelado", ultimaSenalEn: "2026-10-11T09:30:00Z", congeladaDesde: "2026-10-07T14:51:00Z" },
    bakio: { sinSenal: true, motivo: "frame_congelado", ultimaSenalEn: "2026-10-11T09:30:00Z", congeladaDesde: "2026-10-10T17:40:00Z" },
    mundaka: { sinSenal: true, motivo: "frame_plano", ultimaSenalEn: "2026-10-10T18:00:00Z" },
    alicante: { sinSenal: true, motivo: "origen_404", ultimaSenalEn: "2026-10-07T02:31:00Z" },
    sana: { sinSenal: false, motivo: "ok", ultimaSenalEn: "2026-10-11T09:30:00Z" },
  };
  // La regla vive en camaras-externas.js (camaraOculta); index.html la usa
  // y guarda un respaldo por si el módulo aún no ha cargado: los dos igual.
  const retiradaModulo = (slug) => camaraOculta(CAMARAS[slug], ahora);
  for (const retirada of [cargarRetirada(CAMARAS, ahora), retiradaModulo]) {
    assert.equal(retirada("pasaia"), true, "congelada desde el 7 de octubre");
    assert.equal(retirada("bakio"), false, "congelada solo de noche");
    assert.equal(retirada("mundaka"), false, "de noche, menos de 24 h");
    assert.equal(retirada("alicante"), true);
    assert.equal(retirada("sana"), false);
  }
});

test("/prevision manda desde cuándo está congelada cada cámara", () => {
  const prevision = leer("functions/prevision.js");
  assert.match(prevision, /camara_estado\?select=[^`]*hash_desde/);
  assert.match(prevision, /congeladaDesde: f\.hash_desde/);
});

test("el panel no enseña textos de desarrollo cuando la imagen no carga", () => {
  assert.doesNotMatch(index, /mapa\.cam\.solo_desplegado/);
  for (const idioma of ["es", "en"]) assert.doesNotMatch(leer(`assets/i18n/${idioma}.js`), /Cloudflare Pages/);
});

test("las cámaras de SOCIB (paradas desde 2024-2025) no están en el proxy ni en la lista", () => {
  assert.ok(!Object.values(WEBCAMS).flat().some((f) => String(f.url ?? f).includes("socib.es")));
  for (const slug of ["calamillor", "sonbou", "muro"]) {
    assert.equal(WEBCAMS[slug], undefined, slug);
    assert.doesNotMatch(index, new RegExp(`^\\s*"${slug}",`, "m"), `${slug} sigue en SPOTS_CON_WEBCAM`);
  }
});

test("el parte diario solo lleva las cámaras que se vigilan hoy", () => {
  assert.match(leer("scripts/camaras/comprobar-camaras.mjs"), /camaras-vigiladas\.json/);
  assert.match(leer(".github/workflows/camaras-salud.yml"), /camaras-vigiladas\.json/);
});
