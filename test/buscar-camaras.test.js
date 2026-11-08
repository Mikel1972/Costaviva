// Buscador de cámaras nuevas (scripts/camaras/buscar-camaras.mjs): lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  huecos, candidataDeVideo, cuerpoIssue, nombreBusqueda, RADIO_KM, paisSpot, consultaYoutube, canalDeFuera,
  consultaOverpass, candidatasDeOsm, candidatasDeWindy, yaPropuestas, slugsHls, categoriaValida,
  miniatura, enlaceMuerto, spotsConCamaraCaida,
} from "../scripts/camaras/buscar-camaras.mjs";

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
  assert.equal(candidataDeVideo(v("x", { snippet: { title: "Live", description: "Ondarroa" } }), ond, ya), null, "solo en la descripción no basta");
  assert.equal(candidataDeVideo(v("x", { snippet: { title: "Ondarroatik live" } }), ond, ya), null, "palabra entera");
  assert.equal(candidataDeVideo(v("x", { snippet: { title: "Ondarroa Colombia LIVE" } }), ond, ya), null, "otro país en el título");
  assert.equal(candidataDeVideo(v("x", { snippet: { title: "Motril vs Ondarroa 🔴 En Directo || Tercera RFEF" } }), ond, ya), null, "partido de fútbol");
  assert.ok(candidataDeVideo(v("x", { snippet: { title: "Ondarroa España LIVE" } }), ond, ya), "su propio país sí");
  assert.equal(candidataDeVideo(v("x", { resto: { recordingDetails: { location: { latitude: 10.4, longitude: -75.5 } } } }), ond, ya), null, "ubicación lejana");
  const cerca = candidataDeVideo(v("x", { snippet: { title: "Live beach cam" }, resto: { recordingDetails: { location: { latitude: 43.33, longitude: -2.42 } } } }), ond, ya);
  assert.equal(cerca.motivo, "ubicación del vídeo cerca del spot");
});

test("Issue: avisa si falta la clave y lista candidatas con casilla", () => {
  const sin = cuerpoIssue({ fecha: "2026-11-02", totalSpots: 3, listaHuecos: [spots[2]], candidatas: [], sinClave: true });
  assert.match(sin, /sin ninguna cámara a menos de 5 km: 1/);
  assert.match(sin, /Sin `YOUTUBE_API_KEY`/);
  assert.match(sin, /Sin `WINDY_WEBCAMS_KEY`/);
  const con = cuerpoIssue({ fecha: "2026-11-02", totalSpots: 3, listaHuecos: [spots[2]], candidatas: [{ spot: "ondarroa", spot_nombre: "Ondarroa", titulo: "Ondarroa live", url: "https://www.youtube.com/watch?v=a", canal: "C", motivo: "nombra el spot", video_id: "a" }], sinClave: false });
  assert.match(con, /- \[ \] \*\*Ondarroa\*\* — \[Ondarroa live\]\(https:\/\/www\.youtube\.com\/watch\?v=a\)/);
  assert.match(con, /<!-- cand:ondarroa:a -->/);
  assert.match(con, /enlace/);
});

// Mejoras del 2026-11-08 ("no puede ser que no encuentre ninguna").
test("huecos: las cámaras HLS de index.html cuentan como cámara", () => {
  const hls = slugsHls(readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  for (const s of ["hondarribia", "deba", "orio", "mutriku", "zarautz"]) assert.ok(hls.includes(s), s);
  assert.deepEqual(slugsHls("const WEBCAMS_HLS = {\n  a: \"x\",\n  b2: \"y\",\n};\n"), ["a", "b2"]);
  assert.deepEqual(slugsHls("nada"), []);
});

test("YouTube: país del spot, consulta en su idioma y canales de fuera", () => {
  const nz = { slug: "nz-timaru", nombre: "Timaru", lat: -44.4, lon: 171.25 };
  const pt = { slug: "nazare", nombre: "Nazaré (PT)", lat: 39.6, lon: -9.08 };
  const es = spots[2];
  assert.equal(paisSpot(nz), "NZ");
  assert.equal(paisSpot(pt), "PT");
  assert.equal(paisSpot(es), "ES");
  assert.match(consultaYoutube(es), /^Ondarroa .*"en directo"/);
  assert.match(consultaYoutube(pt), /^Nazaré .*"ao vivo"/);
  assert.match(consultaYoutube(nz), /^Timaru New Zealand /);
  assert.equal(canalDeFuera("CO", es), true, "Cartagena de Colombia fuera");
  assert.equal(canalDeFuera("PT", es), false);
  assert.equal(canalDeFuera(undefined, es), false, "sin país, se queda");
  assert.equal(canalDeFuera("AU", nz), true);
  assert.equal(canalDeFuera("nz", nz), false);
});

test("OpenStreetMap: consulta y candidatas con webcam=URL cerca del spot", () => {
  const q = consultaOverpass([spots[2]]);
  assert.equal(q, '[out:json][timeout:60];(nwr[~"^(contact:)?webcam$"~"."](around:8000,43.322,-2.418););out center tags;');
  const ya = { urls: new Set(["https://ya.example/cam"]) };
  const els = [
    { type: "node", id: 1, lat: 43.33, lon: -2.42, tags: { webcam: "https://cofradia.example/cam", name: "Cofradía" } },
    { type: "way", id: 2, center: { lat: 43.33, lon: -2.42 }, tags: { "contact:webcam": "https://ya.example/cam" } },
    { type: "node", id: 3, lat: 43.33, lon: -2.42, tags: { webcam: "no es url" } },
    { type: "node", id: 4, lat: 40.0, lon: -3.7, tags: { webcam: "https://lejos.example" } },
    { type: "node", id: 5, lat: 43.33, lon: -2.42, tags: { webcam: "https://trafficnz.info/camera/90.jpg", name: "SH1 South Eastern Hwy" } },
  ];
  const c = candidatasDeOsm(els, [spots[2]], ya);
  assert.equal(c.length, 1);
  assert.equal(c[0].spot, "ondarroa");
  assert.equal(c[0].url, "https://cofradia.example/cam");
  assert.equal(c[0].video_id, "osm-node-1");
  assert.equal(c[0].fuente, "OpenStreetMap");
  assert.match(c[0].motivo, /^a \d+\.\d km del spot$/);
});

test("Windy: solo activas y a menos del radio", () => {
  const ws = [
    { webcamId: 10, title: "Ondarroa puerto", status: "active", location: { latitude: 43.32, longitude: -2.42, city: "Ondarroa" }, urls: { detail: "https://www.windy.com/webcams/10" } },
    { webcamId: 11, title: "Inactiva", status: "inactive", location: { latitude: 43.32, longitude: -2.42 } },
    { webcamId: 12, title: "Lejos", status: "active", location: { latitude: 43.0, longitude: -2.0 } },
    { webcamId: 13, title: "Autovía", status: "active", categories: [{ id: "traffic" }], location: { latitude: 43.32, longitude: -2.42 } },
  ];
  assert.equal(categoriaValida([{ id: "traffic" }]), false);
  assert.equal(categoriaValida([{ id: "city" }, { id: "harbor" }]), true, "ciudad con puerto sí");
  assert.equal(categoriaValida([]), true, "sin categorías, se queda");
  assert.equal(categoriaValida([{ id: "landscape" }]), true);
  const c = candidatasDeWindy(ws, spots[2], { urls: new Set() });
  assert.deepEqual(c.map((x) => x.video_id), ["windy-10"]);
  assert.deepEqual(candidatasDeWindy(ws, spots[2], { urls: new Set(), windy: new Set(["10"]) }), [], "ya en la app");
  assert.equal(c[0].fuente, "Windy");
});

test("Issue: lo ya propuesto otras semanas no se repite como nuevo", () => {
  const prev = "- [ ] **Cartagena** — [x](u) <!-- cand:cartagena:obYSVVM7RB0 -->\n<!-- cand:nz-timaru:FgePIvvAE88 -->";
  assert.deepEqual([...yaPropuestas(prev)], ["cartagena:obYSVVM7RB0", "nz-timaru:FgePIvvAE88"]);
  const rep = { spot: "cartagena", spot_nombre: "Cartagena", titulo: "x", url: "u", video_id: "obYSVVM7RB0", fuente: "YouTube" };
  const cuerpo = cuerpoIssue({ fecha: "2026-11-09", totalSpots: 3, listaHuecos: [], candidatas: [], sinClave: false, sinWindy: false, repetidas: [rep] });
  assert.match(cuerpo, /Candidatas nuevas: 0\*\*; ya propuestas otras semanas: 1/);
  assert.match(cuerpo, /<summary>Ya propuestas otras semanas/);
  assert.doesNotMatch(cuerpo, /WINDY_WEBCAMS_KEY/);
});

test("Issue con miniatura de cada candidata", () => {
  assert.equal(miniatura({ fuente: "Windy", video_id: "windy-123" }), "https://imgproxy.windy.com/_/preview/plain/daylight/123/original.jpg");
  assert.equal(miniatura({ fuente: "YouTube", video_id: "abcdefghijk", url: "https://www.youtube.com/watch?v=abcdefghijk" }), "https://i.ytimg.com/vi/abcdefghijk/hqdefault_live.jpg");
  assert.equal(miniatura({ fuente: "OpenStreetMap", video_id: "osm-node-1", url: "https://youtu.be/qjfzvIBf_qw" }), "https://i.ytimg.com/vi/qjfzvIBf_qw/hqdefault_live.jpg");
  assert.equal(miniatura({ fuente: "OpenStreetMap", video_id: "osm-node-2", url: "http://x.example/cam.jpg" }), "https://x.example/cam.jpg");
  assert.equal(miniatura({ fuente: "OpenStreetMap", video_id: "osm-node-3", url: "https://x.example/webcam" }), null);
  const cuerpo = cuerpoIssue({ fecha: "2026-11-09", totalSpots: 3, listaHuecos: [], candidatas: [{ spot: "x", spot_nombre: "X", titulo: "Cam \"X\"", url: "u", video_id: "windy-5", fuente: "Windy", canal: "-", motivo: "m" }], sinClave: false, sinWindy: false, descartadas: [{}], caidas: ["Orio"] });
  assert.match(cuerpo, /<img src="https:\/\/imgproxy\.windy\.com\/_\/preview\/plain\/daylight\/5\/original\.jpg" width="320" alt="Cam 'X'">/);
  assert.match(cuerpo, /Descartadas solas por enlace caído o imagen parada: 1/);
  assert.match(cuerpo, /cámara caída hace más de 7 días \(se les busca sustituta\): Orio/);
});

test("enlaces muertos o imágenes paradas", () => {
  const ahora = Date.parse("2026-11-08T12:00:00Z");
  assert.equal(enlaceMuerto({ status: 404 }, ahora), "http_404");
  assert.equal(enlaceMuerto({ status: 503 }, ahora), "http_503");
  assert.equal(enlaceMuerto({ status: 0 }, ahora), null, "sin respuesta no descarta");
  assert.equal(enlaceMuerto({ status: 200, ultimaModificacion: "Fri, 10 Feb 2023 15:23:35 GMT" }, ahora), "imagen_parada");
  assert.equal(enlaceMuerto({ status: 200, ultimaModificacion: "Sun, 08 Nov 2026 11:00:00 GMT" }, ahora), null);
  assert.equal(enlaceMuerto({ status: 403 }, ahora), null, "antibots no es caída");
});

test("spots con la cámara caída más de 7 días cuentan como hueco", () => {
  const ahora = Date.parse("2026-11-08T12:00:00Z");
  const estado = { camaras: [
    { spot_slug: "orio", sin_senal: true, ultima_senal_en: "2026-10-21T18:30:00Z" },
    { spot_slug: "mutriku", sin_senal: true, ultima_senal_en: "2026-11-07T16:30:00Z" },
    { spot_slug: "deba", sin_senal: false, ultima_senal_en: "2026-11-08T11:00:00Z" },
    { spot_slug: "ext-nz-geonet-te-kaha", sin_senal: true, ultima_senal_en: null },
  ] };
  assert.deepEqual([...spotsConCamaraCaida(estado, ahora)], ["orio"]);
  assert.deepEqual([...spotsConCamaraCaida(null, ahora)], []);
});
