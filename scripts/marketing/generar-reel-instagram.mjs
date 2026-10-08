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

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const RUTA_ROTACION = join(__dirname, "rotacion-reels.json");
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
  if (elegido.carpeta === "propios") return { ruta, credito: null };
  const lic = JSON.parse(readFileSync(ruta.replace(/\.mp4$/, ".licencia.json"), "utf8"));
  return { ruta, credito: `Vídeo: ${new URL(lic.origen).hostname.replace(/^www\./, "")}` };
}

async function piezaDelReel(tipo, navegador, objetivo) {
  if (tipo === "condiciones") {
    const { slug, nombre, resumen, pieza } = await datosCondiciones(process.env.SPOT_REEL || "", objetivo);
    return {
      datos: { ...pieza, gancho: GANCHOS.condiciones(nombre), claim: CLAIMS[0], viento: await vientoDeSpot(slug, objetivo ? `${objetivo.fecha}T${objetivo.hora.slice(0, 2)}:00` : null), rotuloMapa: objetivo ? `Viento a las ${objetivo.hora}` : "Viento ahora" },
      caption: [`¿Te merece la pena ir hoy a ${nombre}? Índice de pesca ${resumen.puntuacion}/100, mejor especie ahora: ${resumen.especie}.`,
        ...(resumen.avisoOla ? [resumen.avisoOla] : []), "", CLAIMS[0],
        "El índice es una orientación con reglas públicas, no una garantía.", `🔗 Pruébala 7 días gratis: ${MARCA_ENLACE}`, "", `#pesca #fishing #pescadesdecosta #costaviva ${hashtagsRegionales(slug)}`],
      nombre: `condiciones-${slug}`,
    };
  }
  if (tipo === "especie") {
    const { especie, pieza } = datosEspecie(objetivo);
    return {
      datos: { ...pieza, gancho: GANCHOS.especie(especie.nombre), claim: CLAIMS[1] },
      caption: [`${especie.nombre}: de temporada ahora mismo.`, "", CLAIMS[1], `🔗 Pruébala 7 días gratis: ${MARCA_ENLACE}`, "", "#pesca #fishing #pescarecreativa #costaviva #pescaenespaña"],
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
    caption: [f.frase, "", ...(f.aviso ? [f.aviso, ""] : []), `🔗 Pruébala 7 días gratis: ${MARCA_ENLACE}`, "", "#pesca #fishing #pescadeportiva #costaviva"],
    nombre: tipo,
  };
}

const RUTA_ESTADO = join(__dirname, "calendario-estado.json");
function salidaWorkflow(clave, valor) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

async function main() {
  let rotacion = {};
  try { rotacion = JSON.parse(readFileSync(RUTA_ROTACION, "utf8")); } catch {}
  let estado = {};
  try { estado = JSON.parse(readFileSync(RUTA_ESTADO, "utf8")); } catch {}
  // Calendario (2026-10-09): el reel del sábado se prepara el viernes por la
  // tarde. Forzar tipo o fecha (inputs del workflow) salta el calendario.
  const objetivo = piezaAPreparar({
    formato: "reel", fechaForzada: process.env.FECHA_PIEZA || "", tipoForzado: process.env.TIPO_REEL || "", estado,
  });
  if (!objetivo) {
    console.log("Mañana no toca reel (o ya está preparado). Nada que hacer.");
    salidaWorkflow("generada", "false");
    return;
  }
  const { indice, tipo } = process.env.TIPO_REEL ? { indice: rotacion.ultimoIndice ?? -1, tipo: process.env.TIPO_REEL } : siguientePieza(rotacion.ultimoIndice);
  console.log(`Reel para el ${objetivo.dia} ${objetivo.fecha} a las ${objetivo.hora}: ${tipo}`);

  const navegador = await abrirNavegador();
  try {
    const { datos, caption, nombre } = await piezaDelReel(tipo, navegador, objetivo);
    const clip = elegirClip(indice);
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
      fecha, hora: objetivo.hora, dia: objetivo.dia, campana,
    }, null, 2));
    if (!process.env.TIPO_REEL) writeFileSync(RUTA_ROTACION, JSON.stringify({ ultimoIndice: indice, ultimoTipo: tipo, fecha: new Date().toISOString() }, null, 2) + "\n");
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
