// scripts/marketing/generar-nz.mjs
// Datos y textos de las piezas de Nueva Zelanda (2026-10-11, pedido de
// Mikel), en inglés. Los usan generar-post-instagram.mjs y
// generar-reel-instagram.mjs cuando MERCADO=nz. La lógica pura está en
// pieza-nz.mjs; aquí, la red (/prevision?region=nz, /meteo) y el disco
// (especies.json, mareas de LINZ, rotacion-zonas-nz.json).
//
// Igual que las de España: solo datos reales (si falta uno, no sale), sin
// IA, sin fotos de webcams de terceros ni personas, con {ENLACE} (UTM) y
// solo se publican con el OK de Mikel (workflow manual).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { I18n } from "../../assets/js/i18n-modulo.js";
import { SPOTS } from "../../functions/prevision.js";
import { elegirEspeciePost, leerEspeciesJson } from "./especie-post.mjs";
import { bloqueParaHora } from "./pieza-datos.mjs";
import { previsionDeSpot, resumenDeSpot, nombreSpot, leerEspecies, mareaNZ } from "./obtener-datos.mjs";
import { instanteEn, MARCA_ENLACE } from "./calendario.mjs";
import { leerPalabras, preferenciaEspecie, hashtagsDemanda } from "./palabras-redes.mjs";
import {
  ZONA_NZ, AREA_POR_DEFECTO, zonasConSpots, elegirZonaNZ, ordenSpotsZona, fechaLegibleNZ, mesEnNZ,
  fichaEspecieEn, piezaEspecieEn, resumenEnIngles, tarjetasEn, HASHTAGS_NZ, hashtagZona, CLAIMS_EN,
} from "./pieza-nz.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const RUTA_ROTACION = join(__dirname, "rotacion-zonas-nz.json");
export const PALABRAS_NZ = leerPalabras(join(RAIZ_REPO, "datos-robots", "seo", "palabras-nz.json"));

// Motivos, números y avisos del índice, en inglés (assets/i18n/en.js).
I18n.fijarIdioma("en");

const leerRotacion = () => { try { return JSON.parse(readFileSync(RUTA_ROTACION, "utf8")); } catch { return {}; } };
const zonas = () => zonasConSpots(SPOTS);
const instante = (objetivo) => instanteEn(objetivo.fecha, objetivo.hora, ZONA_NZ);

// ¿Página pública en el sitemap? (si no, no se enlaza).
function paginaPublica(ruta) {
  const sitemap = readFileSync(join(RAIZ_REPO, "sitemap.xml"), "utf8");
  return sitemap.includes(`<loc>https://costaviva.org${ruta}</loc>`) ? `costaviva.org${ruta}` : null;
}

// Zona siguiente (con demanda en NZ, si la hay) y su primer spot con
// previsión. `forzado`: un spot de NZ concreto (input "spot" del reel).
async function elegirSpotNZ(forzado = "") {
  if (forzado) {
    const spot = SPOTS.find((s) => s.slug === forzado && s.pais === "nz");
    if (!spot) throw new Error(`"${forzado}" no es un spot de NZ`);
    return { slug: forzado, zona: zonas().find((z) => z.zona === spot.zona) || null, ...(await previsionDeSpot(forzado, "nz")) };
  }
  const mes = mesEnNZ(new Date());
  const rot = leerRotacion();
  const { zona, porDemanda, estado } = elegirZonaNZ(zonas(), rot, PALABRAS_NZ, mes);
  console.log(`Zona de NZ: ${zona.nombre}${porDemanda ? " (palabras clave de NZ)" : " (rotación)"}`);
  for (const slug of ordenSpotsZona(zona, estado.ciclo, PALABRAS_NZ, mes)) {
    try {
      const prevision = await previsionDeSpot(slug, "nz");
      writeFileSync(RUTA_ROTACION, JSON.stringify({ ...estado, ultimoSpot: slug, fecha: new Date().toISOString() }, null, 2) + "\n");
      return { slug, zona, ...prevision };
    } catch (e) {
      console.warn(`${slug}: ${e.message}; se prueba otro spot de ${zona.nombre}.`);
    }
  }
  throw new Error(`Ningún spot de ${zona.nombre} tiene previsión ahora mismo`);
}

// Condiciones de un spot de NZ a la hora de publicación (07:00 NZ).
export async function datosCondicionesNZ(objetivo, spotForzado = "") {
  const { slug, zona, spot } = await elegirSpotNZ(spotForzado);
  const cuando = instante(objetivo);
  const objetivoISO = `${objetivo.fecha}T${objetivo.hora.slice(0, 2)}:00`;
  const especies = leerEspecies();
  const { resumen } = await resumenDeSpot(slug, especies, objetivoISO, ZONA_NZ);
  if (!resumen) throw new Error(`Sin índice de pesca para ${slug} a las ${objetivoISO} (hora de NZ)`);
  const especieEn = especies.especies.find((e) => e.id === resumen.especieId)?.nombres?.en;
  const r = resumenEnIngles(resumen, especieEn);
  const tarjetas = tarjetasEn(bloqueParaHora(spot.bloques, objetivoISO), mareaNZ(slug, cuando));
  const nombre = nombreSpot(slug);
  return {
    slug, zona, nombre, resumen: r, tarjetas,
    pieza: {
      tipo: "condiciones", idioma: "en", spot: nombre, fecha: fechaLegibleNZ(cuando), modalidad: "from the shore",
      resumen: r, tarjetas, mapa: null, fuentes: "Weather: Open-Meteo (CC BY 4.0) · Tides: LINZ (CC BY 4.0)",
    },
  };
}

export async function postCondicionesNZ(objetivo) {
  const { slug, zona, nombre, resumen, tarjetas, pieza } = await datosCondicionesNZ(objetivo);
  const [ola, viento, marea] = tarjetas;
  const mareas = paginaPublica(`/en/tides/${slug}`) || "costaviva.org/en/tides";
  const base = `${HASHTAGS_NZ} ${hashtagZona(zona)}`.trim();
  const caption = [
    `🎣 ${nombre} at 7am: fishing index ${resumen.puntuacion}/100 from the shore`,
    `Top species: ${resumen.especie}${resumen.mejorTramo ? ` · best hours: ${resumen.mejorTramo.texto}` : ""}`,
    ...(resumen.motivos.length ? ["", ...resumen.motivos.map((m) => `${m.flecha} ${m.texto}`)] : []),
    ...(resumen.avisoOla ? ["", resumen.avisoOla] : []),
    "",
    `🌊 Waves: ${ola.val}${ola.sub ? ` (${ola.sub})` : ""}`,
    `💨 Wind: ${viento.val} ${viento.sub}`,
    `🌙 Tide: ${marea.val}${marea.sub ? ` (${marea.sub})` : ""}`,
    "",
    CLAIMS_EN[0],
    `🔗 Check your spot and try it free for 7 days: ${MARCA_ENLACE}`,
    `Free tide times for ${nombre}, no account needed: ${mareas}`,
    "The index is a guide built on public rules, not a guarantee. Always check the MPI fishing rules and any rāhui.",
    "",
    "Data: Open-Meteo (CC BY 4.0) · Tides: sourced from LINZ data (CC BY 4.0), not official tide tables",
    "",
    [base, ...hashtagsDemanda(PALABRAS_NZ, base, { mes: mesEnNZ(instante(objetivo)), mercado: "nz" })].join(" "),
  ].join("\n");
  return { tipo: "condiciones-nz", pieza, caption, slug: `condiciones-${slug}` };
}

// Especie de temporada en el área de MPI de la última zona de NZ (o
// Auckland/Kermadec al principio).
export function datosEspecieNZ(objetivo) {
  const cuando = instante(objetivo);
  const mes = Number(objetivo.fecha.slice(5, 7));
  const region = leerRotacion().ultimaRegion || AREA_POR_DEFECTO;
  const dia = Math.floor((cuando - Date.UTC(cuando.getUTCFullYear(), 0, 0)) / 86400000);
  const elegida = elegirEspeciePost(leerEspeciesJson(RAIZ_REPO), region, mes, dia, { modalidad: "costa", preferencia: preferenciaEspecie(PALABRAS_NZ, mes, "nz") });
  if (!elegida || elegida.especie.pais !== "nz") throw new Error(`Ninguna especie de NZ de temporada en ${region} para el mes ${mes}`);
  const ficha = fichaEspecieEn(elegida, region, mes);
  return { ficha, pieza: piezaEspecieEn(ficha, fechaLegibleNZ(cuando)) };
}

export function postEspecieNZ(objetivo) {
  const { ficha, pieza } = datosEspecieNZ(objetivo);
  console.log(`Especie de NZ: ${ficha.nombre}`);
  const pagina = paginaPublica(`/en/species/${ficha.id}`);
  const base = HASHTAGS_NZ;
  const caption = [
    `${ficha.emoji} ${ficha.nombre}${ficha.maori ? ` (${ficha.maori})` : ""}: in season now`,
    "",
    pieza.especie.nota,
    "",
    ...(ficha.freza ? [`🥚 ${ficha.freza}`, ""] : []),
    `📏 Size and bag limits change: check the MPI rules for the ${ficha.area} area${ficha.normativa ? ` (${ficha.normativa})` : ""} or the NZ Fishing Rules app, and respect any rāhui.`,
    "",
    "Costaviva shows its fishing index hour by hour at your spot.",
    `🔗 Try it free for 7 days: ${MARCA_ENLACE}`,
    ...(pagina ? [`Full species page, free and no account needed: ${pagina}`] : []),
    "",
    "Species data: Fisheries New Zealand (CC BY 4.0)",
    "",
    [base, ...hashtagsDemanda(PALABRAS_NZ, base, { mes: Number(objetivo.fecha.slice(5, 7)), mercado: "nz" })].join(" "),
  ].join("\n");
  return { tipo: "especies-nz", pieza, caption, slug: `especies-${ficha.id}` };
}
