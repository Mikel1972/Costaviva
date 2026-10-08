// functions/_lib/seo/datos.js
// Lógica pura (sin red ni DOM) de las páginas públicas de spots y especies:
// qué se cuenta de cada spot y de cada especie a partir de los datos que ya
// usa la app (assets/datos/*.json, SPOTS de /prevision, cámaras). Tests en
// test/seo-paginas.test.js.
//
// Regla de contenido: SOLO texto para el usuario. Nada de notas internas
// ("pendiente", "no cuenta", "por verificar", fuentes por confirmar...): lo
// que lleve una de esas palabras no se publica (TEXTO_INTERNO_PUBLICO).

import * as VA from "../../../assets/js/ventana-actividad.js";
import { textoFondo } from "../../../assets/js/capa-tipo-fondo.js";
import { CAMARAS_EXTERNAS, CONDICIONES } from "../../../assets/js/camaras-externas.js";
import { REGIONES as REGIONES_MAREAS, regionDeSlug } from "../../mareas/_regiones.js";

export { REGIONES_MAREAS, regionDeSlug };

// Más estricto que VA.TEXTO_INTERNO: también lo heredado de la app vieja,
// las notas de trabajo y FishBase (que no se puede usar: CC BY-NC).
export const TEXTO_INTERNO_PUBLICO =
  /pendiente|no cuenta|fuente|por validar|fiabilidad|sin dato|por confirmar|confirmar|verificar|\bapp\b|index\.html|heredad|fishbase|\bojo\b|informe|discrepancia|robot|heur[ií]stic/i;
export const esPublico = (t) => typeof t === "string" && t.trim() !== "" && !TEXTO_INTERNO_PUBLICO.test(t);

// Ríos con su spot de desembocadura: copia de `rio`/`spotCosta` de RIOS en
// index.html (no se puede importar un <script> de un .html). El test
// comprueba que no se desvía. `clave` = clave de /prevision.caudales.
export const RIOS_SPOT = {
  lekeitio: { rio: "Lea" },
  mundaka: { rio: "Oka" },
  bakio: { rio: "Estepona (Zarraga)" },
  plentzia: { rio: "Butroe" },
  sopelana: { rio: "Arroyo Sopelana" },
  getxo: { rio: "Nervión" },
  ribadesella: { rio: "Sella", clave: "sella" },
  suances: { rio: "Besaya", clave: "besaya" },
  santander: { rio: "Pas", clave: "pas" },
  santona: { rio: "Asón", clave: "ason" },
  ribadeo: { rio: "Eo", clave: "eo" },
  cullera: { rio: "Júcar", clave: "jucar" },
  valencia: { rio: "Turia", clave: "turia" },
  burriana: { rio: "Mijares", clave: "mijares" },
  guardamardelsegura: { rio: "Segura", clave: "segura" },
  cangas: { rio: "Lagares", clave: "lagares" },
};

export const NOMBRE_REGION_ESPECIES = {
  cantabrico: "Cantábrico", atlantico_norte: "Galicia", portugal: "Portugal",
  golfo_cadiz: "Golfo de Cádiz", mediterraneo: "Mediterráneo", baleares: "Baleares",
  canarias: "Canarias", azores: "Azores", madeira: "Madeira",
};
const NOMBRE_IDIOMA = { eu: "euskera", gl: "gallego", ca: "catalán", pt: "portugués" };
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const mesLargo = (m) => MESES_LARGOS[m - 1];

// Slugs de URL de especie: "bonito_norte" -> "bonito-norte".
export const slugEspecie = (id) => String(id).replace(/_/g, "-");
export const idDeSlugEspecie = (slug) => String(slug).replace(/-/g, "_");

export function nombreCortoSpot(nombre) {
  // "Getxo (Ereaga)" -> "Getxo (Ereaga)"; "Nazaré (PT)" -> "Nazaré".
  return String(nombre).replace(/\s*\(PT\)\s*$/, "");
}

export function regionEspeciesDeSpot(spot) {
  return VA.regionPorCoordenadas(spot.lat, spot.lon);
}

// ---------------------------------------------------------------------------
// Spot
// ---------------------------------------------------------------------------

// Especies del spot por modalidad: las que tienen presencia en su región y
// se pescan así; marca las de temporada este mes y las vedadas.
export function especiesDeSpot(especiesDatos, spot, mes) {
  const region = regionEspeciesDeSpot(spot);
  const porModalidad = {};
  for (const m of VA.MODALIDADES) {
    porModalidad[m] = VA.especiesParaModalidad(especiesDatos, region, m)
      .map((e) => {
        const meses = e.presencia[region].meses;
        const veda = VA.vedaActiva(e, region, mes);
        return {
          id: e.id,
          slug: slugEspecie(e.id),
          nombre: e.nombres?.es || e.id,
          emoji: e.emoji || "🐟",
          meses,
          temporada: VA.textoMeses(meses),
          deTemporada: meses.includes(mes) && !veda,
          veda: veda ? textoVeda(veda) : null,
        };
      })
      .sort((a, b) => (b.deTemporada - a.deTemporada) || a.nombre.localeCompare(b.nombre, "es"));
  }
  return { region, porModalidad };
}

const NOMBRE_ORILLA_LARGO = {
  acantilado: "acantilado", roca: "roca", escollera: "escollera o espigón", playa_arena: "playa de arena",
  playa_cantos: "playa de cantos", playa: "playa", puerto: "puerto",
};

export function fondoDeSpot(tipoFondo, slug) {
  const e = tipoFondo?.spots?.[slug];
  if (!e) return null;
  // "Fondo: roca y arena · orilla de ..." -> solo la parte del fondo, y nada
  // si EUSeaMap no tiene dato cerca de la orilla.
  const parteFondo = (textoFondo(e) || "").split(" · ")[0];
  const texto = /^Fondo: /.test(parteFondo) && !/sin dato/i.test(parteFondo) ? parteFondo : null;
  const orilla = e.orilla?.tipo ? NOMBRE_ORILLA_LARGO[e.orilla.tipo] || null : null;
  return texto || orilla ? { texto, orilla } : null;
}

// Profundidad sin decimales de más: "a 1,1 km hay 20 m".
const km = (m) => (m >= 1000 ? `${String(Math.round(m / 100) / 10).replace(".", ",")} km` : `${Math.round(m / 10) * 10} m`);
export function profundidadDeSpot(prof, slug) {
  const p = prof?.spots?.[slug];
  if (!p) return null;
  const frases = [];
  if (Number.isFinite(p.zona_m)) frases.push(`Fondo típico a 1 km de la orilla: unos ${Math.round(p.zona_m)} m.`);
  const hitos = [[10, p.dist_10m_m], [20, p.dist_20m_m], [30, p.dist_30m_m], [50, p.dist_50m_m], [100, p.dist_100m_m]]
    .filter(([, d]) => Number.isFinite(d));
  if (hitos.length) frases.push(`Profundidades desde el spot: ${hitos.map(([h, d]) => `${h} m a ${km(d)}`).join(", ")}.`);
  if (Number.isFinite(p.prof_max_5km_m)) frases.push(`Lo más profundo a 5 km o menos: unos ${Math.round(p.prof_max_5km_m)} m (lo que alcanza una embarcación que sale de aquí).`);
  return frases.length ? { frases, zona_m: p.zona_m ?? null, max5: p.prof_max_5km_m ?? null } : null;
}

// Cámaras del spot que se pueden enseñar en público: SOLO como enlace a la
// web de su dueño (modo "enlace", que todos los dueños permiten). Nada se
// inserta ni se descarga aquí (analisis_permitido es false en todas).
export function camarasPublicasDeSpot(slug, propias = {}) {
  const externas = CAMARAS_EXTERNAS.filter((c) => c.spot === slug)
    .filter((c) => (CONDICIONES[c.condiciones]?.modos_permitidos || []).includes("enlace"))
    .map((c) => ({ nombre: c.nombre, dueno: c.dueno, url: c.url }));
  const enApp = !!propias[slug];
  return { externas, enApp };
}

export function rioDeSpot(slug, caudales) {
  const r = RIOS_SPOT[slug];
  if (!r) return null;
  const c = r.clave ? caudales?.[r.clave] : null;
  const caudal = c && Number.isFinite(c.caudal) && c.caudal > 0
    ? { valor: c.caudal, estacion: c.estacion || null, categoria: categoriaCaudal(c.caudal, c.umbralBajo, c.umbralAlto) }
    : null;
  return { nombre: r.rio, caudal };
}

// Igual que categoriaCaudal() de index.html: "bajo" | "normal" | "alto" | null.
export function categoriaCaudal(caudal, bajo, alto) {
  if (!Number.isFinite(caudal) || bajo == null || alto == null) return null;
  return caudal < bajo ? "bajo" : caudal < alto ? "normal" : "alto";
}

export function spotsCercanos(todos, spot, n = 6) {
  return todos
    .filter((s) => s.slug !== spot.slug)
    .map((s) => ({ ...s, distancia: VA.distanciaKm(spot.lat, spot.lon, s.lat, s.lon) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, n);
}

// Especies de temporada este mes, primero las de temporada corta (las que
// "entran" ahora dicen más que las residentes de todo el año).
export function especiesDestacadas(especies, modalidades = VA.MODALIDADES) {
  const vistas = new Map();
  for (const m of modalidades) for (const e of especies.porModalidad[m]) if (e.deTemporada && !vistas.has(e.id)) vistas.set(e.id, e);
  return [...vistas.values()].sort((a, b) => a.meses.length - b.meses.length || a.nombre.localeCompare(b.nombre, "es")).map((e) => e.nombre);
}

// Intro propia de cada spot, compuesta con SUS datos (orilla, fondo,
// profundidad, especies de temporada, cámaras, río): evita 105 páginas
// iguales con el nombre cambiado.
export function introSpot(spot, { region, fondo, prof, especies, camaras, rio, mes }) {
  const n = nombreCortoSpot(spot.nombre);
  const partes = [];
  const donde = region ? ` (${region.nombre.split(" (")[0]})` : "";
  partes.push(`${n}${donde} es uno de los spots de pesca que sigue Costaviva.`);
  if (fondo?.orilla || fondo?.texto) {
    const f = fondo.texto ? fondo.texto.replace(/^Fondo: /, "").split(" · ")[0] : null;
    partes.push(`La orilla es de ${fondo.orilla || "tipo variado"}${f && f !== "sin dato cerca" ? ` y el fondo cercano, de ${f}` : ""}.`);
  }
  if (prof?.zona_m != null && prof?.max5 != null) {
    partes.push(`A un kilómetro de la orilla hay unos ${Math.round(prof.zona_m)} m de agua y a 5 km se llega a unos ${Math.round(prof.max5)} m.`);
  }
  const deTemp = especiesDestacadas(especies);
  if (deTemp.length) {
    const lista = deTemp.slice(0, 4).map((x) => x.toLowerCase());
    partes.push(`En ${mesLargo(mes)} es temporada de ${lista.join(", ").replace(/, ([^,]*)$/, " y $1")}${deTemp.length > 4 ? `, entre otras ${deTemp.length} especies` : ""}.`);
  }
  if (rio) partes.push(`Cerca desemboca el río ${rio.nombre}.`);
  if (camaras.externas.length || camaras.enApp) partes.push("Tiene cámara para ver el mar antes de salir.");
  return partes.join(" ");
}

// ---------------------------------------------------------------------------
// Especie
// ---------------------------------------------------------------------------

const TEXTO_TIPO_VEDA = {
  veda_recreativa: "Veda en pesca recreativa",
  prohibida: "Prohibida su captura",
  solo_captura_y_suelta: "Solo captura y suelta",
};
export function textoVeda(v) {
  const base = TEXTO_TIPO_VEDA[v.tipo] || "Veda";
  return esPublico(v.texto) ? `${base}: ${v.texto}` : base;
}

export function nombresEspecie(e) {
  const otros = Object.entries(e.nombres || {})
    .filter(([k, v]) => k !== "es" && v)
    .map(([k, v]) => ({ idioma: NOMBRE_IDIOMA[k] || k, nombre: v }));
  return { es: e.nombres?.es || e.id, cientifico: e.cientifico || null, otros };
}

// Zona de cada tabla de tallas: varias comparten el mismo "ámbito corto".
const ZONA_JURISDICCION = {
  "ES-RD560-I": "Cantábrico-Noroeste y Golfo de Cádiz",
  "ES-RD560-II": "Mediterráneo",
  "ES-RD560-III": "Canarias",
  "UE-SWW": "aguas suroccidentales",
  "UE-MED": "Mediterráneo",
};
export function ambitoTalla(t) {
  const base = t.ambito_corto || t.ambito || "";
  const zona = ZONA_JURISDICCION[t.jurisdiccion];
  return zona ? `${base} · ${zona}` : base;
}

// Vista pública de una especie. `spots` = SPOTS de /prevision.
export function fichaEspecie(e, datos, spots, mes) {
  const temporada = VA.REGIONES.filter((r) => e.presencia?.[r]?.meses?.length).map((r) => ({
    region: r,
    nombre: NOMBRE_REGION_ESPECIES[r],
    meses: e.presencia[r].meses,
    texto: VA.textoMeses(e.presencia[r].meses),
    ahora: e.presencia[r].meses.includes(mes),
    freza: e.freza?.por_region?.[r]?.meses?.length ? VA.textoMeses(e.freza.por_region[r].meses) : null,
    veda: VA.vedaActiva(e, r, mes) ? textoVeda(VA.vedaActiva(e, r, mes)) : null,
  }));
  const modalidades = VA.MODALIDADES.filter((m) => e.modalidades?.[m]?.aplica === true).map((m) => ({
    id: m,
    nombre: VA.NOMBRE_MODALIDAD[m],
    consejo: VA.consejoProfundidad(e, m),
    normativa: (e.modalidades[m].normativa || []).filter((n) => esPublico(n.texto)).map((n) => ({ texto: n.texto, url: n.url || null })),
  }));
  const tallas = (e.talla_minima || [])
    .filter((t) => Number.isFinite(t.valor_cm))
    .map((t) => ({ cm: t.valor_cm, ambito: ambitoTalla(t), url: t.url || null, revisado: t.fecha_revision || null }));
  const vedas = (e.vedas || []).map((v) => ({
    texto: textoVeda(v),
    meses: VA.textoMeses(v.meses),
    regiones: (v.regiones || []).map((r) => NOMBRE_REGION_ESPECIES[r] || r),
    url: v.url || null,
  }));
  const cebos = [];
  const vistos = new Set();
  for (const c of e.cebos || []) {
    const clave = c.nombre?.toLowerCase();
    if (!c.nombre || vistos.has(clave)) continue;
    vistos.add(clave);
    cebos.push({ nombre: c.nombre, tipo: c.tipo || null, modalidades: VA.modalidadesDeCebo(c).map((m) => VA.NOMBRE_MODALIDAD[m]) });
  }
  const textos = {};
  for (const k of ["habitat", "actividad", "alimentacion"]) if (esPublico(e[k]?.valor)) textos[k] = e[k].valor;
  // Dónde pescarla: spots de las regiones donde está, agrupados por la
  // región de /mareas (la misma de /spots/region/...).
  const regionesConPresencia = new Set(temporada.map((t) => t.region));
  const dondeSpots = spots.filter((s) => regionesConPresencia.has(regionEspeciesDeSpot(s)));
  const porRegion = REGIONES_MAREAS.map((r) => ({
    slug: r.slug,
    nombre: r.nombre.split(" (")[0],
    spots: dondeSpots.filter((s) => r.spots.has(s.slug)).map((s) => ({ slug: s.slug, nombre: nombreCortoSpot(s.nombre) })),
  })).filter((r) => r.spots.length);
  return { id: e.id, slug: slugEspecie(e.id), emoji: e.emoji || "🐟", nombres: nombresEspecie(e), temporada, modalidades, tallas, vedas, cebos, textos, porRegion };
}

export function introEspecie(f, mes) {
  const n = f.nombres.es;
  const partes = [];
  partes.push(`${n}${f.nombres.cientifico ? ` (${f.nombres.cientifico})` : ""}: dónde y cuándo se pesca en España y Portugal, tallas mínimas y cebos.`);
  if (f.modalidades.length) partes.push(`Se pesca ${f.modalidades.map((m) => m.nombre.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " y $1")}.`);
  const ahora = f.temporada.filter((t) => t.ahora && !t.veda).map((t) => t.nombre);
  if (ahora.length) partes.push(`En ${mesLargo(mes)} está de temporada en ${ahora.join(", ").replace(/, ([^,]*)$/, " y $1")}.`);
  const max = f.tallas.length ? Math.max(...f.tallas.map((t) => t.cm)) : null;
  const min = f.tallas.length ? Math.min(...f.tallas.map((t) => t.cm)) : null;
  if (max != null) partes.push(min === max ? `Talla mínima: ${max} cm.` : `Talla mínima: de ${min} a ${max} cm según la zona.`);
  return partes.join(" ");
}

// Últimas fechas de los datos (para lastmod del sitemap y dateModified).
export function fechaDatos(...fechas) {
  return fechas.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f || "")).map((f) => f.slice(0, 10)).sort().pop() || null;
}
