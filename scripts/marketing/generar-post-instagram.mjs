// scripts/marketing/generar-post-instagram.mjs
// Corrido por .github/workflows/robot-marketing-instagram.yml (lunes/
// miércoles/viernes). Pedido de Mikel (2026-09-19): marketing orgánico en
// Instagram para captar usuarios, sin anuncios de pago.
//
// Desde el 2026-10-08 las piezas salen en el estilo "Amanecer" de la app
// (plantillas/pieza.html, renderizada con Playwright; fuentes Unbounded y
// Manrope incluidas en fuentes/, licencia OFL). Por cada pasada se generan
// el POST (1080x1350, el que va al borrador) y la STORY (1080x1920, para
// subirla a mano si se quiere). Siempre a partir de datos reales, nunca
// inventados, y sin IA:
//   - "condiciones" (lunes y viernes): índice de pesca del spot con su mejor
//     especie y motivos ▲▼, ola/viento/marea de /prevision, la ventana del día
//     y un minimapa de batimetría de EMODnet. YA NO lleva fotos de webcams:
//     Skyline, YouTube o MEO no permiten republicar sus imágenes.
//   - "especies" (miércoles): una especie de temporada, fuera de veda, con
//     los datos de assets/datos/especies.json (nunca de FishBase, CC BY-NC).
//
// Este script SOLO genera las imágenes y el texto, no publica nada: escribe
// post-pendiente.json, y publicar-borrador-instagram.mjs crea el borrador en
// Instagram y abre el Issue de revisión. Publicar es un paso manual aparte
// (aprobación humana, pedido explícito de Mikel).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { textoMeses, NOMBRE_REGION } from "../../assets/js/ventana-actividad.js";
import { regionDelPost, postEnEuskadi, elegirEspeciePost, leerEspeciesJson, modalidadDelPost } from "./especie-post.mjs";
import { CLAIMS } from "./pieza-datos.mjs";
import { BASE_URL, previsionDeSpot, resumenDeSpot, mapaDeSpot, nombreSpot, datosTarjetas, fechaLegible, leerEspecies, FUENTES_TEXTO } from "./obtener-datos.mjs";
import { abrirNavegador, renderImagen } from "./render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");

function diaDelAnio(fecha) {
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  return Math.floor((fecha - inicio) / 86400000);
}

// Zonas de la costa, en el orden en que se van publicando (2026-09-25,
// pedido de Mikel: "cada publicación un spot de una zona diferente, en ciclos
// completos"). Se recorren todas antes de repetir; el estado está en
// rotacion-zonas.json, que el workflow comitea. Desde el 2026-10-08 ya no hace
// falta que el spot tenga webcam: vale cualquiera con previsión.
const ZONAS = [
  { nombre: "País Vasco — Bizkaia", hashtags: "#euskadi #bizkaia #cantabrico", spots: ["mundaka", "bakio", "sopelana", "lekeitio", "getxo"] },
  { nombre: "País Vasco — Gipuzkoa", hashtags: "#euskadi #gipuzkoa #cantabrico", spots: ["getaria", "pasaia"] },
  { nombre: "Cantabria", hashtags: "#cantabria #cantabrico", spots: ["santona", "laredo", "castrourdiales", "suances", "comillas", "sanvicente"] },
  { nombre: "Galicia", hashtags: "#galicia #riasbaixas #atlantico", spots: ["acoruna", "baiona", "camarinas", "cangas", "corrubedo", "ribadeo", "ons", "portosin", "cies"] },
  { nombre: "Castellón", hashtags: "#castellon #costaazahar #mediterraneo", spots: ["peniscola", "alcossebre", "benicassim", "oropesa", "burriana", "castellon", "torreblanca", "vinaros", "xilxes"] },
  { nombre: "Valencia", hashtags: "#valencia #mediterraneo", spots: ["valencia", "alboraya", "cullera", "gandia", "oliva", "piles", "canetdeberenguer", "pobladefarnals"] },
  { nombre: "Alicante", hashtags: "#alicante #costablanca #mediterraneo", spots: ["denia", "javea", "calpe", "altea", "benidorm", "vilajoiosa", "alicante", "santapola", "guardamardelsegura", "pilardelahoradada"] },
  { nombre: "Murcia y Baleares", hashtags: "#mediterraneo", spots: ["aguilas", "calamillor", "sonbou", "muro"] },
];

// Hashtags regionales del post de condiciones (2026-10-02).
const HASHTAGS_SPOT = {
  aguilas: "#murcia #aguilas #mediterraneo",
  calamillor: "#mallorca #baleares #mediterraneo",
  muro: "#mallorca #baleares #mediterraneo",
  sonbou: "#menorca #baleares #mediterraneo",
};
export function hashtagsRegionales(slug) {
  return HASHTAGS_SPOT[slug] || ZONAS.find((z) => z.spots.includes(slug))?.hashtags || "#pescaenespaña";
}

const RUTA_ROTACION = join(__dirname, "rotacion-zonas.json");
function leerRotacion() {
  try {
    return JSON.parse(readFileSync(RUTA_ROTACION, "utf8"));
  } catch {
    return { ultimoIndice: -1, ciclo: 1 };
  }
}

// Siguiente zona del ciclo y, dentro de ella, un spot que alterna por ciclo.
// Si /prevision no trae datos del elegido se prueba el siguiente de la zona.
export async function elegirSpot() {
  const rotacion = leerRotacion();
  const indice = (rotacion.ultimoIndice + 1) % ZONAS.length;
  const zona = ZONAS[indice];
  const ciclo = indice === 0 && rotacion.ultimoIndice >= 0 ? (rotacion.ciclo ?? 1) + 1 : (rotacion.ciclo ?? 1);
  for (let k = 0; k < zona.spots.length; k++) {
    const slug = zona.spots[(ciclo + k) % zona.spots.length];
    try {
      const prevision = await previsionDeSpot(slug);
      writeFileSync(RUTA_ROTACION, JSON.stringify({ ultimoIndice: indice, ciclo, ultimaZona: zona.nombre, ultimoSpot: slug, fecha: new Date().toISOString() }, null, 2) + "\n");
      console.log(`Zona de esta publicación: ${zona.nombre} -> ${slug} (ciclo ${ciclo})`);
      return { slug, ...prevision };
    } catch (e) {
      console.warn(`${slug}: ${e.message}; se prueba otro spot de ${zona.nombre}.`);
    }
  }
  throw new Error(`Ningún spot de ${zona.nombre} tiene previsión ahora mismo`);
}

// Página pública de mareas del spot (si está en sitemap.xml) o el índice.
// En Instagram los enlaces del texto no son clicables: sin https://.
function paginaMareas(slug) {
  const sitemap = readFileSync(join(RAIZ_REPO, "sitemap.xml"), "utf8");
  return slug && sitemap.includes(`<loc>https://costaviva.org/mareas/${slug}</loc>`)
    ? `costaviva.org/mareas/${slug}`
    : "costaviva.org/mareas";
}

// Datos de la pieza de condiciones (los usa también el reel).
export async function datosCondiciones() {
  const { slug, spot } = await elegirSpot();
  const { resumen } = await resumenDeSpot(slug, leerEspecies());
  if (!resumen) throw new Error(`Sin índice de pesca para ${slug} ahora mismo`);
  const nombre = nombreSpot(slug);
  return {
    slug, nombre, spot, resumen,
    pieza: {
      tipo: "condiciones", spot: nombre, fecha: fechaLegible(), modalidad: "desde costa",
      resumen, tarjetas: datosTarjetas(spot), mapa: await mapaDeSpot(slug), fuentes: FUENTES_TEXTO.replace("<br>", " · "),
    },
  };
}

async function generarCondiciones() {
  const { slug, nombre, spot, resumen, pieza } = await datosCondiciones();
  const [ola, viento] = pieza.tarjetas;
  const caption = [
    `🎣 ${nombre} hoy: índice de pesca ${resumen.puntuacion}/100 desde costa`,
    `Mejor especie ahora: ${resumen.especie}${resumen.mejorTramo ? ` · mejores horas: ${resumen.mejorTramo.texto}` : ""}`,
    "",
    ...resumen.motivos.map((m) => `${m.flecha} ${m.texto}`),
    "",
    `🌊 Ola: ${ola.val} (${ola.sub})`,
    `💨 Viento: ${viento.val} ${viento.sub}`,
    `🌙 Marea: ${spot.marea?.tendencia || "—"}${spot.marea?.coeficiente != null ? ` (coef. ${spot.marea.coeficiente})` : ""}`,
    "",
    CLAIMS[1],
    `🔗 Marea y oleaje de ${nombre}, gratis y sin cuenta: ${paginaMareas(slug)}`,
    "El índice es una orientación con reglas públicas, no una garantía.",
    "",
    "Datos: Open-Meteo (CC BY 4.0) · Batimetría: EMODnet",
    "",
    `#pesca #fishing #pescadeportiva #pescadesdecosta #surfcasting #costaviva ${hashtagsRegionales(slug)}`,
  ].join("\n");
  return { tipo: "condiciones", pieza, caption, slug: `condiciones-${slug}` };
}

export function datosEspecie() {
  const mesActual = new Date().getMonth() + 1;
  const rotacion = leerRotacion();
  const region = regionDelPost(rotacion);
  const elegida = elegirEspeciePost(leerEspeciesJson(RAIZ_REPO), region, mesActual, diaDelAnio(new Date()), { euskadi: postEnEuskadi(rotacion), modalidad: modalidadDelPost() });
  if (!elegida) throw new Error(`Ninguna especie de temporada (y fuera de veda) en ${region} para el mes ${mesActual}`);
  const { nota, talla, freza, cebos } = elegida;
  const especie = { ...elegida.especie, nombre: elegida.especie.nombres.es };
  const textoTalla = talla ? `${talla.valor_cm !== null ? `${talla.valor_cm} cm` : `${talla.peso_g} g`} (${talla.ambito_corto})` : null;
  const textoFreza = freza?.enFreza ? `En freza (${textoMeses(freza.meses)}): si lo pescas, devuélvelo al agua.` : null;
  return {
    especie, nota, cebos, textoTalla, textoFreza,
    pieza: {
      tipo: "especie", fecha: fechaLegible(),
      especie: {
        nombre: especie.nombre, region: NOMBRE_REGION[region] || region, nota,
        cebos: cebos.length ? cebos.join(", ") : null, talla: textoTalla, freza: textoFreza,
        alimentacion: especie.alimentacion?.valor || null, fuente: "Fichas de especies de Costaviva, con fuente por dato",
      },
    },
  };
}

function generarEspecies() {
  const { especie, nota, cebos, textoTalla, textoFreza, pieza } = datosEspecie();
  console.log(`Especie del post: ${especie.nombre}`);
  const caption = [
    `${especie.emoji} ${especie.nombre}: de temporada ahora mismo`,
    "",
    nota,
    "",
    ...(especie.alimentacion?.valor ? [`🍽️ Se alimenta de: ${especie.alimentacion.valor}`, ""] : []),
    ...(cebos.length ? [`🪝 Cebos típicos: ${cebos.join(", ")}`, ""] : []),
    ...(textoFreza ? [`🥚 ${textoFreza}`, ""] : []),
    ...(textoTalla ? [`📏 Talla mínima: ${textoTalla}. Manda siempre la norma publicada.`, ""] : []),
    `En Costaviva ves su índice de pesca hora a hora en tu spot. 🔗 ${paginaMareas(null)}`,
    "",
    "#pesca #fishing #pescarecreativa #pescadeportiva #costaviva #pescaenespaña",
  ].join("\n");
  const slug = especie.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  return { tipo: "especies", pieza, caption, slug: `especies-${slug}` };
}

async function main() {
  // Miércoles especies; lunes y viernes condiciones (cron L/X/V del workflow).
  const generador = new Date().getDay() === 3 ? generarEspecies : generarCondiciones;
  const { tipo, pieza, caption, slug } = await generador();

  const fecha = new Date().toISOString().slice(0, 10);
  mkdirSync(join(RAIZ_REPO, "assets", "marketing"), { recursive: true });
  const rutaRelativa = `assets/marketing/${fecha}-${slug}.png`;
  const rutaStory = `assets/marketing/${fecha}-${slug}-story.png`;
  const navegador = await abrirNavegador();
  try {
    for (const [formato, ruta] of [["post", rutaRelativa], ["story", rutaStory]]) {
      const cabe = await renderImagen(navegador, { ...pieza, formato }, join(RAIZ_REPO, ruta));
      if (!cabe) console.warn(`::warning::La ${formato} de ${slug} se sale del lienzo; revísala antes de aprobarla.`);
      console.log(`✓ ${formato}: ${ruta}`);
    }
  } finally {
    await navegador.close();
  }

  const pendiente = { tipo, caption, rutaRelativa, publicUrl: `${BASE_URL}/${rutaRelativa}`, storyUrl: `${BASE_URL}/${rutaStory}`, fecha };
  writeFileSync(join(__dirname, "post-pendiente.json"), JSON.stringify(pendiente, null, 2));
  console.log(`✓ scripts/marketing/post-pendiente.json escrito (tipo: ${tipo})`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((e) => {
    console.error("Fallo generando el post:", e);
    process.exit(1);
  });
}
