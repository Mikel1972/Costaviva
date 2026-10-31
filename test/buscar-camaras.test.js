// Buscador de cámaras nuevas (scripts/camaras/buscar-camaras.mjs): lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { huecos, candidataDeVideo, cuerpoIssue, nombreBusqueda, RADIO_KM } from "../scripts/camaras/buscar-camaras.mjs";

const spots = [
  { slug: "mundaka", nombre: "Mundaka", lat: 43.4047, lon: -2.6989 },
  { slug: "bermeo", nombre: "Bermeo", lat: 43.42, lon: -2.721 },       // a ~3 km de Mundaka: le vale su cámara
  { slug: "ondarroa", nombre: "Ondarroa", lat: 43.322, lon: -2.418 },  // sin cámara
];

test("huecos: spots sin cámara propia ni de terceros a menos de 5 km", () => {
  assert.equal(RADIO_KM, 5);
  assert.deepEqual(huecos(spots, new Set(["mundaka"])).map((s) => s.slug), ["ondarroa"]);
  assert.deepEqual(huecos(spots, new Set()).map((s) => s.slug), ["mundaka", "bermeo", "ondarroa"]);
});

test("nombre para buscar: sin lo que va tras / ( ,", () => {
  assert.equal(nombreBusqueda("Cape Reinga / Te Rerenga Wairua"), "Cape Reinga");
  assert.equal(nombreBusqueda("Ciutadella (Menorca)"), "Ciutadella");
});

test("candidata de YouTube: en directo, nombra el spot o está cerca, y no está ya en la app", () => {
  const ond = spots[2];
  const ya = { videos: new Set(["viejo"]), canalesPorSpot: new Map([["ondarroa", new Set(["canalYa"])]]) };
  const v = (id, extra = {}) => ({ id, snippet: { liveBroadcastContent: "live", title: "Ondárroa en directo", description: "", channelId: "c1", channelTitle: "Canal", ...extra.snippet }, status: { embeddable: true }, ...extra.resto });
  const c = candidataDeVideo(v("nuevo"), ond, ya);
  assert.equal(c.url, "https://www.youtube.com/watch?v=nuevo");
  assert.equal(c.motivo, "nombra el spot");
  assert.equal(candidataDeVideo(v("viejo"), ond, ya), null, "ya en la app");
  assert.equal(candidataDeVideo(v("x", { snippet: { channelId: "canalYa" } }), ond, ya), null, "canal ya en ese spot");
  assert.equal(candidataDeVideo(v("x", { snippet: { liveBroadcastContent: "none" } }), ond, ya), null, "no es un directo");
  assert.equal(candidataDeVideo(v("x", { snippet: { title: "Playa de Bilbao" } }), ond, ya), null, "ni lo nombra ni está cerca");
  const cerca = candidataDeVideo(v("x", { snippet: { title: "Live beach cam" }, resto: { recordingDetails: { location: { latitude: 43.33, longitude: -2.42 } } } }), ond, ya);
  assert.equal(cerca.motivo, "ubicación del vídeo cerca del spot");
});

test("Issue: avisa si falta la clave y lista candidatas con casilla", () => {
  const sin = cuerpoIssue({ fecha: "2026-11-02", totalSpots: 3, listaHuecos: [spots[2]], candidatas: [], sinClave: true });
  assert.match(sin, /sin ninguna cámara a menos de 5 km: 1/);
  assert.match(sin, /Sin `YOUTUBE_API_KEY`/);
  const con = cuerpoIssue({ fecha: "2026-11-02", totalSpots: 3, listaHuecos: [spots[2]], candidatas: [{ spot: "ondarroa", spot_nombre: "Ondarroa", titulo: "Ondarroa live", url: "https://www.youtube.com/watch?v=a", canal: "C", motivo: "nombra el spot", video_id: "a" }], sinClave: false });
  assert.match(con, /- \[ \] \*\*Ondarroa\*\* — \[Ondarroa live\]\(https:\/\/www\.youtube\.com\/watch\?v=a\)/);
  assert.match(con, /<!-- cand:ondarroa:a -->/);
  assert.match(con, /enlace/);
});
