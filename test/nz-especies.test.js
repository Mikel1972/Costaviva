// Especies de Nueva Zelanda (fase 2c, 2026-10-09): 17 fichas en
// especies.json con fuentes de MPI/Fisheries NZ (CC BY 4.0, nunca FishBase),
// presencia y freza propias del hemisferio sur por área de MPI, temperatura
// en null (el índice lo tolera), tallas solo con enlace a MPI. El índice de NZ
// usa solo especies de NZ y el de España solo las suyas; mientras NZ esté
// oculta, sus especies no salen en /especies ni en el sitemap. Sin red.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  regionPorCoordenadas, especiesDeTemporada, especiesParaModalidad, indiceSpot, calcularVentana, estadoFreza,
  tallasParaRegion, normativaModalidad, paisEspecie, REGIONES, REGIONES_NZ, vedaActiva, NOMBRE_REGION,
} from "../assets/js/ventana-actividad.js";
import { areaPescaNZ, regionPescaPorCoordenadas, regionPorCoordenadas as regionGeografica, usaDatosGenerales, paisDeRegion, AREAS_NZ } from "../assets/js/regiones.js";
import { enAmbito } from "../assets/js/reglas-expertas.js";
import { SPOTS_NZ } from "../functions/_lib/nz/spots-nz.js";
import { especiesVisibles, datosEspeciesVisibles } from "../functions/_lib/regiones-activas.js";
import { urlsSitemap } from "../functions/_lib/seo/sitemap.js";
import { SPOTS } from "../functions/prevision.js";
import { AREAS_MPI } from "../assets/js/normativa-nz.js";

const DATOS = JSON.parse(readFileSync(new URL("../assets/datos/especies.json", import.meta.url), "utf8"));
const NZ = DATOS.especies.filter((e) => e.pais === "nz");
const ES = DATOS.especies.filter((e) => e.pais !== "nz");

function serie(mes = 1) {
  const horas = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, mes - 1, 10, 0, 0) + i * 3600000);
    horas.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.2 * Math.sin((2 * Math.PI * i) / 12.42), ola: 1.0, viento: 10, tempAgua: 18, presion: 1015,
    });
  }
  return horas;
}

test("17 especies de NZ con su forma: ids nz-, nombres en/mi, área de MPI y fuentes de MPI", () => {
  assert.equal(NZ.length, 17);
  const ids = ["snapper", "kingfish", "kahawai", "trevally", "tarakihi", "blue-cod", "red-gurnard", "john-dory", "hapuku",
    "yellowbelly-flounder", "sand-flounder", "arrow-squid", "rock-lobster", "paua", "blue-moki", "butterfish", "red-cod"];
  assert.deepEqual(NZ.map((e) => e.id), ids.map((i) => `nz-${i}`));
  const areas = new Set(AREAS_NZ);
  assert.deepEqual(DATOS.regiones_nz, AREAS_NZ);
  for (const e of NZ) {
    assert.ok(e.nombres.en && e.nombres.mi && e.nombres.es, e.id);
    assert.ok(e.cientifico, e.id);
    assert.ok(e.habitat.valor && e.habitat.valor_en, `${e.id}: hábitat es/en`);
    for (const r of [...Object.keys(e.presencia), ...Object.keys(e.freza.por_region)]) assert.ok(areas.has(r), `${e.id}: ${r}`);
    assert.ok(Object.keys(e.presencia).length >= 1, e.id);
    // Fuentes: todas existen, ninguna es FishBase ni NC.
    const fuentes = new Set([...e.nombres_fuentes, ...e.habitat.fuentes, ...(e.profundidad_m.fuentes || []),
      ...Object.values(e.presencia).flatMap((p) => p.fuentes), ...Object.values(e.freza.por_region).flatMap((p) => p.fuentes),
      ...e.talla_minima.map((t) => t.fuente)]);
    for (const f of fuentes) {
      assert.ok(DATOS.fuentes[f], `${e.id}: fuente ${f}`);
      assert.doesNotMatch(f, /fishbase/i);
      assert.doesNotMatch(DATOS.fuentes[f].licencia, /\bNC\b|non-?commercial/i, `${e.id}: ${f} no comercial`);
    }
    // Temperatura sin fuente abierta: null (no se inventa).
    assert.equal(e.temperatura_agua.rango, null, e.id);
    // Nunca un rango heredado de España ni datos "general" (hemisferio norte).
    assert.equal(e.freza.por_region.general, undefined, e.id);
    assert.equal(e.vedas, undefined, e.id);
  }
});

test("normativa de especie NZ: solo enlace a la página de MPI del área, ninguna cifra", () => {
  for (const e of NZ) {
    for (const t of e.talla_minima) {
      assert.equal(t.valor_cm, null, e.id);
      assert.equal(t.peso_g, undefined, e.id);
      const area = Object.entries(AREAS_MPI).find(([, a]) => a.url === t.url);
      assert.ok(area, `${e.id}: ${t.url} no es una página de área de MPI`);
      assert.ok(e.presencia[area[0]], `${e.id}: enlace a un área sin presencia`);
    }
    for (const m of Object.values(e.modalidades)) {
      for (const n of m.normativa || []) {
        assert.equal(n.jurisdiccion, "NZ");
        assert.doesNotMatch(n.texto + n.texto_en, /\d/, `${e.id}: cifra en la normativa`);
      }
    }
  }
  const snapper = NZ.find((e) => e.id === "nz-snapper");
  const t = tallasParaRegion(snapper, "nz_auckland_kermadec");
  assert.equal(t.length, 1);
  assert.equal(t[0].url, AREAS_MPI.nz_auckland_kermadec.url);
  const paua = NZ.find((e) => e.id === "nz-paua");
  assert.equal(normativaModalidad(DATOS, "submarina", "nz_central", { especie: paua }).especie.length, 1);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /const enlaceNZ = tallas\.find\(\(x\) => \/\^NZ-\/\.test\(x\.jurisdiccion\) && x\.url\);/);
  assert.match(html, /mapa\.va\.rahui/);
});

test("región de pesca: en NZ el área de MPI (coincide con los 60 spots), en España la de siempre", () => {
  for (const s of SPOTS_NZ) assert.equal(areaPescaNZ(s.lat, s.lon), s.region, s.slug);
  assert.equal(regionPorCoordenadas(-36.85, 174.76), "nz_auckland_kermadec");
  assert.equal(regionPorCoordenadas(-45.88, 170.5), "nz_south_east");
  assert.equal(regionGeografica(-45.88, 170.5), "nueva_zelanda");
  for (const s of SPOTS) assert.equal(regionPescaPorCoordenadas(s.lat, s.lon), regionGeografica(s.lat, s.lon), s.slug);
  for (const a of AREAS_NZ) {
    assert.equal(usaDatosGenerales(a), false, a);
    assert.equal(paisDeRegion(a), "nz");
    assert.ok(NOMBRE_REGION[a], a);
  }
  assert.equal(paisDeRegion("cantabrico"), "es");
  assert.deepEqual(REGIONES_NZ, AREAS_NZ);
  assert.ok(!REGIONES.some((r) => r.startsWith("nz_")));
});

test("el índice de NZ usa solo especies de NZ y el de España solo las suyas", () => {
  for (const mes of [1, 4, 7, 10]) {
    for (const r of REGIONES) {
      assert.ok(especiesDeTemporada(DATOS, r, mes).every((e) => paisEspecie(e) === "es"), `${r} ${mes}`);
    }
    for (const r of AREAS_NZ) {
      const lista = especiesDeTemporada(DATOS, r, mes);
      assert.ok(lista.length > 0, `${r} ${mes}: sin especies`);
      assert.ok(lista.every((e) => e.pais === "nz"), `${r} ${mes}`);
    }
  }
  // Aunque una especie de España tuviera presencia en un área de NZ, no entra.
  const trampa = { ...DATOS, especies: [{ ...ES[0], presencia: { nz_central: { meses: [1] } } }] };
  assert.deepEqual(especiesDeTemporada(trampa, "nz_central", 1), []);
  assert.deepEqual(especiesParaModalidad(trampa, "nz_central", "costa"), []);
});

test("índice en un spot de NZ con temperatura null: puntúa sin romperse", () => {
  const horas = serie(1);
  const leigh = SPOTS_NZ.find((s) => s.slug === "nz-leigh");
  const r = indiceSpot(DATOS, horas, 12, { lat: leigh.lat, lon: leigh.lon, zona: "Pacific/Auckland", modalidad: "costa" });
  assert.equal(r.region, "nz_auckland_kermadec");
  assert.ok(Number.isFinite(r.puntuacion), JSON.stringify(r).slice(0, 200));
  assert.match(r.especie.id, /^nz-/);
  const snapper = NZ.find((e) => e.id === "nz-snapper");
  const v = calcularVentana(snapper, DATOS.reglas_por_defecto, horas, { lat: leigh.lat, lon: leigh.lon, zona: "Pacific/Auckland" });
  assert.ok(v.every((h) => Number.isFinite(h.puntuacion)));
  assert.equal(estadoFreza(snapper, "nz_auckland_kermadec", 11).enFreza, true);
  assert.equal(vedaActiva(snapper, "nz_auckland_kermadec", 1), null);
});

test("reglas expertas sin `regiones` (de España) no se aplican en NZ", () => {
  const regla = { ambito: { modalidades: ["costa"] } };
  assert.equal(enAmbito(regla, { especieId: "nz-snapper", modalidad: "costa", region: "nz_central", mes: 1 }), false);
  assert.equal(enAmbito(regla, { especieId: "lubina", modalidad: "costa", region: "cantabrico", mes: 1 }), true);
  assert.equal(enAmbito({ ambito: { regiones: ["nz_central"] } }, { especieId: "nz-snapper", modalidad: "costa", region: "nz_central", mes: 1 }), true);
});

test("región oculta: las especies de NZ no salen en /especies ni en el sitemap", () => {
  assert.equal(especiesVisibles(DATOS.especies).length, ES.length);
  assert.ok(!especiesVisibles(DATOS.especies).some((e) => e.pais === "nz"));
  assert.equal(especiesVisibles(DATOS.especies, ["es", "nz"]).length, DATOS.especies.length);
  const urls = urlsSitemap({ spots: SPOTS, especies: DATOS, tipoFondo: null, profundidad: null });
  assert.ok(!urls.some((u) => /\/especies\/nz-/.test(u.loc)));
  assert.ok(!readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8").includes("/especies/nz-"));
  assert.equal(datosEspeciesVisibles(DATOS).especies.length, ES.length);
  assert.match(readFileSync(new URL("../functions/_lib/seo/carga.js", import.meta.url), "utf8"), /datosEspeciesVisibles\(d\)/);
});
