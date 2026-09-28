// Resolvedor de alias de IPCamLive (functions/webcam/hls/[slug].js,
// 2026-09-28): saca el servidor y el streamid actuales de la página del
// reproductor, que es lo único estable de estas cámaras.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseDesdeReproductor, onRequestGet } from "../functions/webcam/hls/[slug].js";

// Formato real de player.php (2026-09-28): las otras *address van antes.
const REPRODUCTOR = `<script>
  var groupaddress = 'http://ipcamlive.com/';
  var timelapseaddress = 'http://t0.ipcamlive.com/';
  var exportaddress = 'http://e0.ipcamlive.com/';
  var address = 'http://s123.ipcamlive.com/';
  var streamid = '7bz57yv0sddgbiwei';
</script>`;

test("saca servidor y streamid del reproductor, y pasa a https", () => {
  assert.equal(baseDesdeReproductor(REPRODUCTOR), "https://s123.ipcamlive.com/streams/7bz57yv0sddgbiwei/");
});

test("sin address o sin streamid no inventa nada", () => {
  assert.equal(baseDesdeReproductor("var streamid = 'abc';"), null);
  assert.equal(baseDesdeReproductor("var address = 'http://s1.ipcamlive.com/';"), null);
  assert.equal(baseDesdeReproductor("var address = 'http://evil.example.com/'; var streamid = 'abc';"), null);
});

test("redirige al stream resuelto, o a la última URL conocida si falla", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(REPRODUCTOR.replace("s123", "s200"));
    let r = await onRequestGet({ request: { url: "https://costaviva.org/webcam/hls/santona" }, params: { slug: "santona" } });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "https://s200.ipcamlive.com/streams/7bz57yv0sddgbiwei/stream.m3u8");

    globalThis.fetch = async () => { throw new Error("sin red"); };
    r = await onRequestGet({ request: { url: "https://costaviva.org/webcam/hls/santona?tipo=snapshot" }, params: { slug: "santona" } });
    assert.equal(r.headers.get("location"), "https://s104.ipcamlive.com/streams/68lowoz31j7i8vum2/snapshot.jpg");

    r = await onRequestGet({ request: { url: "https://costaviva.org/webcam/hls/nada" }, params: { slug: "nada" } });
    assert.equal(r.status, 404);
  } finally {
    globalThis.fetch = original;
  }
});
