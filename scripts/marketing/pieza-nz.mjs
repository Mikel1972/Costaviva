// scripts/marketing/pieza-nz.mjs
// Piezas de redes para Nueva Zelanda (2026-10-11, pedido de Mikel): en
// inglés, a las 07:00 hora de NZ (calendario.mjs, mercado "nz"), con datos
// SOLO de NZ y el tema elegido por las palabras clave de NZ
// (datos-robots/seo/palabras-nz.json, del robot de comun). Lógica pura, sin
// red: test/calendario-marketing.test.js.
//
// De dónde sale cada dato (nada inventado):
//   - spots y zonas: SPOTS_NZ (functions/_lib/nz/spots-nz.js) y ZONAS_NZ;
//   - especie: las fichas de NZ de especies.json (pais "nz"), de temporada en
//     el área de MPI del spot, con la misma elección que el post de España
//     (elegirEspeciePost: nunca en veda ni de otra modalidad);
//   - normativa: solo el enlace a la página de MPI del área, nunca cifras
//     (tallas y cupos cambian; igual que /en/species);
//   - índice y motivos: la misma cuenta que la app; los motivos salen en
//     inglés con su clave de traducción (assets/i18n/en.js) y el que no la
//     tiene (texto escrito a mano en español) se deja fuera;
//   - marea: LINZ (datos/nz/linz-*.json), ola y viento: /prevision?region=nz.
// Sin minimapa: la batimetría de EMODnet solo cubre Europa. Sin fotos de
// webcams de terceros ni personas identificables.

import { ZONAS_NZ } from "../../functions/_lib/nz/zonas-nz.js";
import { AREAS_MPI } from "../../assets/js/normativa-nz.js";
import { textoMesesEn } from "../../functions/_lib/seo/paginas-en.js";
import { valoresZonas, elegirPorDemanda, ordenarSpots } from "./palabras-redes.mjs";

export const ZONA_NZ = "Pacific/Auckland";
export const AREA_POR_DEFECTO = "nz_auckland_kermadec";

// ---------------------------------------------------------------------------
// Zonas para las piezas: las de ZONAS_NZ que tienen algún spot de costa (el
// índice del post es "from the shore"), con sus spots en el orden de la lista.
export function zonasConSpots(spots) {
  return ZONAS_NZ.map((z) => ({
    ...z,
    spots: spots.filter((s) => s.zona === z.zona && s.pais === "nz" && (s.modalidades || []).includes("costa")).map((s) => s.slug),
    region: spots.find((s) => s.zona === z.zona)?.region || null,
  })).filter((z) => z.spots.length);
}

// Siguiente zona: cada pieza, una zona distinta, en ciclos completos (la
// regla de España). Dentro del ciclo manda la que más se busca en NZ; sin
// demanda, el orden de la lista. `estado` = rotacion-zonas-nz.json
// ({ usadas: [slug], ciclo }). Devuelve la zona y el estado nuevo.
export function elegirZonaNZ(zonas, estado = {}, palabras = null, mes) {
  let usadas = Array.isArray(estado?.usadas) ? estado.usadas : [];
  let ciclo = estado?.ciclo ?? 1;
  let pendientes = zonas.filter((z) => !usadas.includes(z.slug));
  if (!pendientes.length) { usadas = []; ciclo += 1; pendientes = zonas; }
  const porDemanda = elegirPorDemanda(pendientes, (z) => z.slug, valoresZonas(palabras, mes, "nz"));
  const zona = porDemanda?.elegida || pendientes[0];
  return { zona, porDemanda: !!porDemanda, estado: { usadas: [...usadas, zona.slug], ciclo, ultimaZona: zona.slug, ultimaRegion: zona.region } };
}

// Spots de la zona en el orden en que se prueban: rotación por ciclo y, con
// palabras clave, primero el más buscado.
export function ordenSpotsZona(zona, ciclo, palabras, mes) {
  const rotados = zona.spots.map((_, k) => zona.spots[(ciclo + k) % zona.spots.length]);
  return ordenarSpots(rotados, palabras, mes, "nz");
}

// ---------------------------------------------------------------------------
// Fecha de la pieza en hora de NZ: "Tuesday 13 Oct<br>07:00".
export function fechaLegibleNZ(fecha) {
  const dia = new Intl.DateTimeFormat("en-NZ", { timeZone: ZONA_NZ, weekday: "long", day: "numeric", month: "short" }).format(fecha);
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA_NZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(fecha);
  return `${dia.replace(",", "")}<br>${hora}`;
}

// Mes en NZ (1-12) de un instante.
export function mesEnNZ(fecha) {
  return Number(new Intl.DateTimeFormat("en-NZ", { timeZone: ZONA_NZ, month: "numeric" }).format(fecha));
}

// ---------------------------------------------------------------------------
// Especie de temporada, en inglés. `elegida` es lo que devuelve
// elegirEspeciePost (especie-post.mjs) para el área de MPI.
export function fichaEspecieEn(elegida, region, mes) {
  const e = elegida.especie;
  const area = AREAS_MPI[region] || null;
  const meses = e.presencia?.[region]?.meses || [];
  const fr = e.freza?.por_region?.[region];
  const enFreza = fr?.meses?.includes(mes);
  const habitat = e.habitat?.verificado && e.habitat?.valor_en ? e.habitat.valor_en : null;
  // La página de MPI del área del spot (nunca cifras).
  const normativa = area?.url || null;
  return {
    id: e.id,
    nombre: e.nombres?.en || e.id,
    maori: e.nombres?.mi || null,
    emoji: e.emoji || "🐟",
    area: area?.nombre || null,
    temporada: meses.length ? textoMesesEn(meses) : null,
    habitat,
    freza: enFreza ? `Spawning season (${textoMesesEn(fr.meses)}): if you catch one, consider letting it go.` : null,
    normativa,
  };
}

export function notaEspecieEn(f) {
  return [
    f.temporada ? `Shore fishing. Season in the MPI ${f.area} area: ${f.temporada}.` : "Shore fishing.",
    f.habitat || "",
  ].filter(Boolean).join(" ");
}

// Datos que pinta la plantilla (pieza.html) para la especie.
export function piezaEspecieEn(f, fecha) {
  return {
    tipo: "especie", idioma: "en", fecha,
    especie: {
      nombre: f.nombre, region: f.area || "New Zealand", nota: notaEspecieEn(f),
      filas: [
        ...(f.maori ? [["Māori", f.maori]] : []),
        ...(f.temporada ? [["Season", f.temporada]] : []),
        ["Rules", `Check MPI ${f.area || ""} rules`.replace(/\s+/g, " ")],
      ],
      freza: f.freza, fuente: "Costaviva species pages · Fisheries NZ (CC BY 4.0)",
    },
  };
}

// ---------------------------------------------------------------------------
// Índice en inglés. `resumen` sale de resumenDelDia (pieza-datos.mjs) con el
// idioma de I18n fijado en inglés (I18n.fijarIdioma("en"), lo hace el
// generador de NZ): los motivos ya vienen traducidos y con su clave. Un
// motivo sin clave es texto escrito a mano en español (reglas expertas):
// fuera.
export function resumenEnIngles(resumen, nombreEspecieEn) {
  if (!resumen) return null;
  const motivos = (resumen.motivos || []).filter((m) => m.clave);
  const tramo = resumen.mejorTramo ? { ...resumen.mejorTramo, texto: resumen.mejorTramo.texto.replace(/ h$/, "") } : null;
  return { ...resumen, especie: nombreEspecieEn || resumen.especie, motivos, mejorTramo: tramo };
}

const fmtEn = (n) => String(Math.round(n * 10) / 10);
const PUNTOS = { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SO: "SW", O: "W", NO: "NW", NNE: "NNE", ENE: "ENE", ESE: "ESE", SSE: "SSE", SSO: "SSW", OSO: "WSW", ONO: "WNW", NNO: "NNW" };
// /prevision?region=nz ya los manda en inglés ("WSW 243°"); los de España
// llevan O de oeste ("SO").
const puntoEn = (p) => {
  const x = String(p || "").split(" ")[0];
  return PUNTOS[x] || (/^[NESW]{1,3}$/.test(x) ? x : "");
};
export function fuerzaVientoEn(kmh) {
  if (kmh == null) return "";
  if (kmh < 12) return "light";
  if (kmh < 29) return "moderate";
  if (kmh < 50) return "strong";
  return "very strong";
}
const TIPO_MAREA = { pleamar: "high", bajamar: "low" };

// Tarjetas ola / viento / marea en inglés. `bloque` = bloque de
// /prevision?region=nz a la hora de publicación; `marea` = mareaSpotNZ (LINZ)
// en ese mismo instante.
export function tarjetasEn(bloque, marea) {
  const ola = bloque?.altura ? `${fmtEn(bloque.altura[0])}–${fmtEn(bloque.altura[1])} m` : "—";
  const viento = bloque?.viento != null ? `${Math.round(bloque.viento)} km/h` : "—";
  const p1 = marea?.proximas?.[0], p2 = marea?.proximas?.[1];
  const flecha = marea?.tendencia === "subiendo" ? "↑" : marea?.tendencia === "bajando" ? "↓" : "";
  return [
    { icono: "ola", etq: "Waves", val: ola, sub: [bloque?.periodo ? `${bloque.periodo} s` : "", puntoEn(bloque?.dirOla)].filter(Boolean).join(" · ") },
    { icono: "viento", etq: "Wind", val: viento, sub: [puntoEn(bloque?.dirViento), fuerzaVientoEn(bloque?.viento)].filter(Boolean).join(", ") },
    {
      icono: "marea", etq: "Tide",
      val: marea?.altura != null ? `${fmtEn(marea.altura)} m ${flecha}`.trim() : "—",
      sub: [p1 ? `${TIPO_MAREA[p1.tipo] || p1.tipo} ${p1.hora}` : "", p2 ? `then ${TIPO_MAREA[p2.tipo] || p2.tipo} ${p2.hora}` : ""].filter(Boolean).join(", "),
    },
  ];
}

// ---------------------------------------------------------------------------
// Ganchos y claims del reel en inglés: solo lo que se comprueba abriendo la
// app en NZ (nada de ríos, turbidez ni cámaras: allí no hay esas capas).
export const GANCHOS_EN = {
  condiciones: (spot) => `Worth heading to ${spot} today?`,
  especie: (especie) => `${especie} biting today?`,
};
export const CLAIMS_EN = [
  "Waves, wind, LINZ tides and a fishing index for your spot, hour by hour.",
  "Your fishing diary keeps the sea conditions of every trip.",
];
export const ROTACION_REELS_NZ = ["condiciones", "especie"];
export function siguientePiezaNZ(ultimoIndice) {
  const i = (Number.isInteger(ultimoIndice) ? ultimoIndice + 1 : 0) % ROTACION_REELS_NZ.length;
  return { indice: i, tipo: ROTACION_REELS_NZ[i] };
}

// Hashtags fijos de NZ y el de la zona ("#northland", "#bayofplenty").
export const HASHTAGS_NZ = "#nzfishing #fishingnz #newzealand #kiwifishing #landbasedfishing #costaviva";
export function hashtagZona(zona) {
  const h = String(zona?.slug || "").replace(/-/g, "");
  return h ? `#${h}` : "";
}
