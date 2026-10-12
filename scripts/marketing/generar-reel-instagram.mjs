// scripts/marketing/generar-reel-instagram.mjs
// Reel semanal de Instagram (2026-10-08, aprobado por Mikel), corrido por
// .github/workflows/robot-reel-instagram.yml. Sin IA y a coste 0:
// plantillas/pieza.html pinta cada fotograma con Playwright (30 fps) y
// ffmpeg monta el MP4 (H.264, 1080x1920, ~10 s, objetivo < 8 MB).
//
// Guion (pieza-datos.mjs, GUION_REEL):
//   1. Gancho (3,5 s): vídeo de pesca + pregunta grande. Los clips salen de
//      clips/propios/ (los que grabe Mikel, prioridad) o, si no hay, de
//      clips/stock/ (solo con su .licencia.json al lado: uso comercial y
//      modificación permitidos, comprobado con URL y cita). Nunca YouTube,
//      webcams de terceros ni Instagram de otros. scripts/ no se publica en
//      la web (ver functions/_lib/rutas-publicas.js): los clips en bruto no
//      quedan servidos en público, solo el reel montado.
//   2. Datos (5,5 s): el índice contando hasta su valor, la ventana del día
//      creciendo y el viento real (/viento-campo) en partículas sobre la
//      batimetría de EMODnet; o una pantalla real de la app (diario, grupos,
//      alarma) en un marco de móvil.
//   3. Cierre (1,5 s): claim comprobable y llamada a la acción.
//
// Rotación (ROTACION_REELS): no todos los reels son de condiciones. El
// estado va en rotacion-reels.json, que el workflow comitea.
//
// Igual que los posts: solo genera; el borrador + Issue + aprobación manual
// los hace publicar-borrador-instagram.mjs reel-pendiente.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GANCHOS, CLAIMS, FUNCIONES, siguientePieza, escogerClip } from "./pieza-datos.mjs";
import { BASE_URL, vientoDeSpot, fechaLegible } from "./obtener-datos.mjs";
import { datosCondiciones, datosEspecie, hashtagsRegionales } from "./generar-post-instagram.mjs";
import { abrirNavegador, renderReel } from "./render.mjs";
import { servirRepo, capturarPantalla } from "./capturas-app.mjs";
import { piezaAPreparar, apuntarGenerada, campanaDePieza, MARCA_ENLACE, instanteMadrid } from "./calendario.mjs";
import { siguientePiezaNZ } from "./pieza-nz.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const RUTA_ROTACION = join(__dirname, "rotacion-reels.json");
const RUTA_ROTACION_NZ = join(__dirname, "rotacion-reels-nz.json");
const LIMITE_BYTES = 8 * 1024 * 1024;

// Clip del gancho: primero los propios (rotando), luego los de stock con
// licencia guardada; CLIP_REEL (input "clip" del workflow) fuerza uno.
// Devuelve también el crédito para el texto del reel.
export function elegirClip(indice, dir = join(__dirname, "clips"), forzado = process.env.CLIP_REEL || "") {
  const listar = (sub) => (existsSync(join(dir, sub)) ? readdirSync(join(dir, sub)).filter((f) => f.endsWith(".mp4")) : []);
  const stock = listar("stock").filter((f) => existsSync(join(dir, "stock", f.replace(/\.mp4$/, ".licencia.json"))));
  const elegido = escogerClip({ propios: listar("propios"), stock, indice, forzado });
  if (!elegido) return null;
  const ruta = join(dir, elegido.carpeta, elegido.fichero);
  // persona_identificable (2026-10-11): la publicación automática solo saca
  // reels cuyo clip diga false en su .licencia.json (los propios también
  // pueden llevarla); sin ficha, el reel solo sale a mano.
  const rutaFicha = ruta.replace(/\.mp4$/, ".licencia.json");
  const lic = existsSync(rutaFicha) ? JSON.parse(readFileSync(rutaFicha, "utf8")) : {};
  const ficha = { carpeta: elegido.carpeta, fichero: elegido.fichero, personaIdentificable: typeof lic.persona_identificable === "boolean" ? lic.persona_identificable : null };
  if (elegido.carpeta === "propios") return { ruta, credito: null, ficha };
  return { ruta, credito: `Vídeo: ${new URL(lic.origen).hostname.replace(/^www\./, "")}`, ficha };
}

// Reel de NZ (2026-10-11): en inglés, condiciones o especie (sin pantallas
// de la app, que están en español). generar-nz.mjs se importa solo aquí:
// fija el idioma del índice en inglés.
async function piezaDelReelNZ(tipo, objetivo) {
  const NZ = await import("./generar-nz.mjs");
  const { GANCHOS_EN, CLAIMS_EN, HASHTAGS_NZ, hashtagZona } = await import("./pieza-nz.mjs");
  if (tipo === "condiciones") {
    const { slug, zona, nombre, resumen, pieza } = await NZ.datosCondicionesNZ(objetivo, process.env.SPOT_REEL || "");
    return {
      datos: { ...pieza, gancho: GANCHOS_EN.condiciones(nombre), claim: CLAIMS_EN[0], viento: null },
      caption: [`Worth heading to ${nombre} at 7am? Fishing index ${resumen.puntuacion}/100, top species: ${resumen.especie}.`,
        ...(resumen.avisoOla ? [resumen.avisoOla] : []), "", CLAIMS_EN[0],
        "The index is a guide built on public rules, not a guarantee.", `🔗 Try it free for 14 days: ${MARCA_ENLACE}`, "",
        "Data: Open-Meteo (CC BY 4.0) · Tides: sourced from LINZ data (CC BY 4.0)", "", `${HASHTAGS_NZ} ${hashtagZona(zona)}`.trim()],
      nombre: `condiciones-${slug}`,
    };
  }
  const { ficha, pieza } = NZ.datosEspecieNZ(objetivo);
  return {
    datos: { ...pieza, gancho: GANCHOS_EN.especie(ficha.nombre), claim: CLAIMS_EN[0] },
    caption: [`${ficha.nombre}${ficha.maori ? ` (${ficha.maori})` : ""}: in season now in the ${ficha.area} area.`, "",
      "Size and bag limits change: always check the MPI rules and any rāhui.", CLAIMS_EN[0], `🔗 Try it free for 14 days: ${MARCA_ENLACE}`, "",
      "Species data: Fisheries New Zealand (CC BY 4.0)", "", HASHTAGS_NZ],
    nombre: `especie-${ficha.id}`,
  };
}

async function piezaDelReel(tipo, navegador, objetivo) {
  if (objetivo?.mercado === "nz") return piezaDelReelNZ(tipo, objetivo);
  if (tipo === "condiciones") {
    const { slug, nombre, resumen, pieza } = await datosCondiciones(process.env.SPOT_REEL || "", objetivo);
    return {
      datos: { ...pieza, gancho: GANCHOS.condiciones(nombre), claim: CLAIMS[0], viento: await vientoDeSpot(slug, objetivo ? `${objetivo.fecha}T${objetivo.hora.slice(0, 2)}:00` : null), rotuloMapa: objetivo ? `Viento a las ${objetivo.hora}` : "Viento ahora" },
      caption: [`¿Te merece la pena ir hoy a ${nombre}? Índice de pesca ${resumen.puntuacion}/100, mejor especie ahora: ${resumen.especie}.`,
        ...(resumen.avisoOla ? [resumen.avisoOla] : []), "", CLAIMS[0],
        "El índice es una orientación con reglas públicas, no una garantía.", `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`, "", `#pesca #fishing #pescadesdecosta #costaviva ${hashtagsRegionales(slug)}`],
      nombre: `condiciones-${slug}`,
    };
  }
  if (tipo === "especie") {
    const { especie, pieza } = datosEspecie(objetivo);
    return {
      datos: { ...pieza, gancho: GANCHOS.especie(especie.nombre), claim: CLAIMS[1] },
      caption: [`${especie.nombre}: de temporada ahora mismo.`, "", CLAIMS[1], `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`, "", "#pesca #fishing #pescarecreativa #costaviva #pescaenespaña"],
      nombre: `especie-${especie.id}`,
    };
  }
  // Funciones de la app: captura real de la pantalla (datos de demostración).
  const f = FUNCIONES[tipo];
  const servidor = await servirRepo();
  let captura;
  try {
    captura = await capturarPantalla(navegador, f.pagina, { puerto: servidor.address().port });
  } finally {
    servidor.close();
  }
  return {
    datos: {
      tipo: "funcion", fecha: fechaLegible(objetivo ? instanteMadrid(objetivo.fecha, objetivo.hora) : new Date()), gancho: GANCHOS[tipo](), claim: f.claim,
      funcion: { ...f, captura: `data:image/png;base64,${captura.toString("base64")}` },
    },
    caption: [f.frase, "", ...(f.aviso ? [f.aviso, ""] : []), `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`, "", "#pesca #fishing #pescadeportiva #costaviva"],
    nombre: tipo,
  };
}

const RUTA_ESTADO = join(__dirname, "calendario-estado.json");
function salidaWorkflow(clave, valor) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

async function main() {
  let rotacion = {};
  let estado = {};
  try { estado = JSON.parse(readFileSync(RUTA_ESTADO, "utf8")); } catch {}
  // Calendario (2026-10-09): el reel del sábado se prepara el viernes por la
  // tarde. Forzar tipo o fecha (inputs del workflow) salta el calendario.
  // MERCADO=nz (2026-10-11): reel de Nueva Zelanda para las 07:00 del
  // sábado de allí, con su propia rotación (rotacion-reels-nz.json).
  const mercado = process.env.MERCADO === "nz" ? "nz" : "es";
  const rutaRotacion = mercado === "nz" ? RUTA_ROTACION_NZ : RUTA_ROTACION;
  try { rotacion = JSON.parse(readFileSync(rutaRotacion, "utf8")); } catch { rotacion = {}; }
  const objetivo = piezaAPreparar({
    formato: "reel", fechaForzada: process.env.FECHA_PIEZA || "", tipoForzado: process.env.TIPO_REEL || "", estado, mercado,
  });
  if (!objetivo) {
    console.log(`Mañana no toca reel${mercado === "nz" ? " de NZ" : ""} (o ya está preparado). Nada que hacer.`);
    salidaWorkflow("generada", "false");
    return;
  }
  const siguiente = mercado === "nz" ? siguientePiezaNZ : siguientePieza;
  const { indice, tipo } = process.env.TIPO_REEL ? { indice: rotacion.ultimoIndice ?? -1, tipo: process.env.TIPO_REEL } : siguiente(rotacion.ultimoIndice);
  console.log(`Reel para el ${objetivo.dia} ${objetivo.fecha} a las ${objetivo.hora}: ${tipo}`);

  const navegador = await abrirNavegador();
  try {
    const { datos, caption, nombre } = await piezaDelReel(tipo, navegador, objetivo);
    // NZ (2026-10-11): nada de personas identificables; solo clips cuya ficha
    // diga persona_identificable false, si no, sin clip (fondo de la marca).
    const candidato = elegirClip(indice);
    const clip = mercado === "nz" && candidato?.ficha?.personaIdentificable !== false ? null : candidato;
    console.log(`Clip del gancho: ${clip ? clip.ruta : "ninguno (fondo de la marca)"}`);
    const fecha = objetivo.fecha;
    const rutaRelativa = `assets/marketing/reels/${fecha}-${nombre}.mp4`;
    mkdirSync(join(RAIZ_REPO, "assets/marketing/reels"), { recursive: true });
    let bytes = await renderReel(navegador, datos, { salida: join(RAIZ_REPO, rutaRelativa), clip: clip?.ruta });
    if (bytes > LIMITE_BYTES) {
      console.warn(`Reel de ${(bytes / 1e6).toFixed(1)} MB; se recomprime.`);
      bytes = await renderReel(navegador, datos, { salida: join(RAIZ_REPO, rutaRelativa), clip: clip?.ruta, crf: 30 });
    }
    console.log(`✓ Reel: ${rutaRelativa} (${(bytes / 1e6).toFixed(1)} MB)`);
    const texto = [...caption, ...(clip?.credito ? ["", clip.credito] : [])].join("\n");
    const campana = campanaDePieza(fecha, `reel-${nombre}`);
    writeFileSync(join(__dirname, "reel-pendiente.json"), JSON.stringify({
      tipo: `reel-${tipo}`, esReel: true, caption: texto, rutaRelativa, publicUrl: `${BASE_URL}/${rutaRelativa}`,
      fecha, hora: objetivo.hora, dia: objetivo.dia, campana, mercado, idioma: objetivo.idioma, clip: clip ? clip.ficha : null,
    }, null, 2));
    if (!process.env.TIPO_REEL) writeFileSync(rutaRotacion, JSON.stringify({ ultimoIndice: indice, ultimoTipo: tipo, fecha: new Date().toISOString() }, null, 2) + "\n");
    writeFileSync(RUTA_ESTADO, JSON.stringify(apuntarGenerada(estado, objetivo.clave, { tipo: `reel-${tipo}`, campana }), null, 2) + "\n");
    salidaWorkflow("generada", "true");
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error("Fallo generando el reel:", e);
  process.exit(1);
});
