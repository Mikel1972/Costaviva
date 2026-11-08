// Salud de cámaras de terceros con la API de YouTube y de Windy (2026-11-08).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustarConApis, estadoYoutube, estadoWindy, DIAS_WINDY_CONGELADA } from "../scripts/camaras/apis-externas.mjs";

const ok = { ok: true };
const AHORA = Date.parse("2026-11-08T12:00:00Z");

test("YouTube: un directo terminado ya no cuenta como sano aunque oembed dé 200", () => {
  const yt = estadoYoutube({ items: [{ id: "vivo", snippet: { liveBroadcastContent: "live" } }, { id: "fin", snippet: { liveBroadcastContent: "none" } }] });
  assert.deepEqual(ajustarConApis({ youtube_id: "vivo" }, ok, { youtube: yt }), { ok: true });
  assert.deepEqual(ajustarConApis({ youtube_id: "fin" }, ok, { youtube: yt }), { ok: false, motivo: "youtube_sin_directo" });
  assert.deepEqual(ajustarConApis({ youtube_id: "borrado" }, ok, { youtube: yt }), { ok: false, motivo: "youtube_no_existe" });
  assert.deepEqual(ajustarConApis({ youtube_id: "fin" }, ok, {}), ok, "sin clave, lo de siempre");
});

test("Windy: inactiva o sin imagen nueva en 2 días = caída", () => {
  assert.equal(DIAS_WINDY_CONGELADA, 2);
  const w = estadoWindy({ webcams: [
    { webcamId: 1, status: "active", lastUpdatedOn: "2026-11-08T11:50:00Z" },
    { webcamId: 2, status: "inactive", lastUpdatedOn: "2026-11-08T11:50:00Z" },
    { webcamId: 3, status: "active", lastUpdatedOn: "2026-11-01T00:00:00Z" },
  ] });
  const cam = (id) => ({ url: `https://www.windy.com/webcams/${id}` });
  assert.deepEqual(ajustarConApis(cam(1), ok, { windy: w }, AHORA), { ok: true });
  assert.deepEqual(ajustarConApis(cam(2), ok, { windy: w }, AHORA), { ok: false, motivo: "windy_inactiva" });
  assert.deepEqual(ajustarConApis(cam(3), ok, { windy: w }, AHORA), { ok: false, motivo: "windy_congelada" });
  assert.deepEqual(ajustarConApis(cam(9), ok, { windy: w }, AHORA), { ok: false, motivo: "windy_no_existe" });
  assert.deepEqual(ajustarConApis({ windy_id: 1 }, ok, { windy: w }, AHORA), { ok: true }, "por windy_id");
  assert.deepEqual(ajustarConApis({ url: "https://beachcam.meo.pt/x" }, { ok: false, motivo: "http_500" }, { windy: w }, AHORA), { ok: false, motivo: "http_500" }, "las demás no cambian");
});
