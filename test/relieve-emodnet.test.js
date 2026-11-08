// Teselas de relieve de EMODnet (2026-11-08): el script de Python y su
// workflow. La codificación terrarium es la de MapLibre (encoding: "terrarium").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PY = readFileSync(new URL("../scripts/relieve/emodnet_teselas.py", import.meta.url), "utf8");
const YML = readFileSync(new URL("../.github/workflows/relieve-emodnet.yml", import.meta.url), "utf8");

test("script: WCS de EMODnet, zoom 5-10, terrarium al metro y AWS donde no hay dato", () => {
  assert.match(PY, /ows\.emodnet-bathymetry\.eu\/wcs\?service=WCS&version=2\.0\.1&request=GetCoverage/);
  assert.match(PY, /coverageId=emodnet__mean/);
  assert.match(PY, /ZOOM_MIN, ZOOM_MAX = 5, 10/);
  assert.match(PY, /np\.round\(np\.nan_to_num\(alto, nan=0\.0\)\)/);
  assert.match(PY, /elevation-tiles-prod\/terrarium/);
  assert.doesNotMatch(PY, /anthropic|openai/i, "sin IA");
});

test("workflow: solo a mano, sin IA, sube al bucket público con caché larga", () => {
  assert.match(YML, /workflow_dispatch:/);
  assert.doesNotMatch(YML, /schedule:/);
  assert.doesNotMatch(YML, /ANTHROPIC/);
  assert.match(YML, /subir-storage\.mjs \/tmp\/relieve relieve-emodnet/);
  assert.match(YML, /SUBIR_CACHE_SEGUNDOS: "2592000"/);
  assert.match(YML, /runs-on: ubuntu-24\.04/);
});
