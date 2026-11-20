// scripts/marketing/reel-calamar.mjs — reel «¿Calamar, chipirón o txipirón?»
// (2026-11-20, Mikel: «tenemos muchas consultas del calamar; igual
// debiéramos sacar un reel»). Google nos enseña /especies/calamar sobre todo
// por «chipiron pescado» y «diferencia entre chipirón y calamar».
// Mismo montaje que las series (reel-comun.mjs), con el vídeo de calamar de
// clips/stock (pexels-calamar.mp4, elegido por Mikel). Solo datos
// verificados: el nombre en euskera sale del Egungo Euskararen Hiztegia
// (UPV/EHU), la temporada de assets/datos/especies.json, y la imagen NO se
// rotula con la especie (no se sabe si es exactamente Loligo vulgaris).
//
// Uso:  node reel-calamar.mjs [--fecha AAAA-MM-DD] [--hora HH:MM]
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BASE_URL } from "./obtener-datos.mjs";
import { campanaDePieza, MARCA_ENLACE, hoyMadrid } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO, LEMA } from "./reel-comun.mjs";
import { campanaDe } from "./campana-temporal.mjs";

export const CLIP_CALAMAR = "pexels-calamar.mp4";

export function piezaCalamar(fecha) {
  return {
    spot: "Calamar · chipirón · txipirón",
    gancho: "¿Calamar, chipirón o txipirón?",
    cinta: campanaDe(fecha)?.cinta || "",
    tarjetas: [
      { etq: "Es el mismo animal", val: "El calamar común", sub: "Loligo vulgaris" },
      { etq: "En Euskadi", val: "Txipirón", sub: "Así se le llama popularmente; en euskera, txipiroi" },
      { etq: "Temporada", val: "Ahora", sub: "Cantábrico, Galicia, Portugal y Mediterráneo" },
    ],
    lema: LEMA,
  };
}

async function main() {
  const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : "");
  const fecha = arg("fecha") || process.env.FECHA_PIEZA || hoyMadrid();
  const hora = arg("hora") || "13:00";
  const estado = leerJson(RUTA_ESTADO);
  const clave = `${fecha}-reel-calamar`;
  if (estado?.generadas?.[clave] && !arg("fecha")) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const clip = elegirClip(process.env.CLIP_REEL || CLIP_CALAMAR);
  const datos = { ...piezaCalamar(fecha), credito: clip.credito };
  const rutaRelativa = `assets/marketing/reels/${fecha}-calamar.mp4`;
  await montarVideo({ datos, clip, rutaRelativa });
  const caption = [
    "🦑 ¿Calamar, chipirón o txipirón?",
    "",
    "Es el mismo animal: el calamar común (Loligo vulgaris). Lo que cambia es el nombre según dónde estés:",
    "• En la mayor parte de España: calamar o chipirón.",
    "• En Euskadi: txipirón (en euskera, txipiroi).",
    "",
    "Y ahora es temporada en el Cantábrico, Galicia, Portugal y el Mediterráneo.",
    "",
    "👇 ¿Cómo lo llamas tú?",
    "📖 Dónde y cuándo se pesca, talla mínima y cebos: costaviva.org/especies/calamar",
    `🔗 Pruébala 14 días gratis: ${MARCA_ENLACE}`,
    "",
    `${clip.credito}`,
    "",
    "#calamar #chipiron #txipiron #eging #pesca #costaviva",
  ].join("\n");
  const campana = campanaDePieza(fecha, "reel-calamar");
  apuntarReel({ tipo: "reel-calamar", caption, rutaRelativa, baseUrl: BASE_URL, fecha, hora, campana, clip, estado, clave, sinRotacionPeces: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel del calamar:", e); process.exit(1); });
}
