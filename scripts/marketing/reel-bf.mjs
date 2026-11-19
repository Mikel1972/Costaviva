// scripts/marketing/reel-bf.mjs — reel del Black Friday 2x1 (2026-11-19,
// Mikel: "el reel tendría que salir ya para que la gente lo pueda ver antes
// del BF"). Mismo montaje que las series (reel-comun.mjs). Las condiciones
// salen de functions/_lib/black-friday.js: nada que no sea la oferta real.
//
// Uso:  node reel-bf.mjs [--fecha AAAA-MM-DD] [--hora HH:MM]
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BASE_URL } from "./obtener-datos.mjs";
import { campanaDePieza, MARCA_ENLACE, hoyMadrid } from "./calendario.mjs";
import { elegirClip, montarVideo, apuntarReel, leerJson, RUTA_ESTADO } from "./reel-comun.mjs";
import { campanaDe } from "./campana-temporal.mjs";

export function piezaBf(fecha) {
  const durante = fecha >= "2026-11-27";
  return {
    spot: durante ? "Black Friday<br>hasta el lunes 30" : "Black Friday<br>27-30 nov",
    gancho: "2x1: un año para ti y otro para tu compañero de pesca",
    cinta: campanaDe(fecha)?.cinta || "BLACK FRIDAY 2x1",
    tarjetas: [
      { etq: "Tú", val: "1 año de Premium", sub: "Plan anual · 34,99 € (IVA incluido)" },
      { etq: "Tu compañero de pesca", val: "1 año gratis", sub: "Sin tarjeta · se apunta hasta el 31/12" },
      { etq: "Código", val: "BLACKFRIDAY", sub: "Solo del viernes 27 al lunes 30 de noviembre" },
    ],
    lema: "Mareas, olas, normas y el índice de pesca de tu zona. <em>Para los dos.</em>",
    cta: "Código BLACKFRIDAY",
  };
}

async function main() {
  const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : "");
  const fecha = arg("fecha") || process.env.FECHA_PIEZA || hoyMadrid();
  const hora = arg("hora") || "13:00";
  const estado = leerJson(RUTA_ESTADO);
  const clave = `${fecha}-reel-bf`;
  if (estado?.generadas?.[clave] && !arg("fecha")) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "generada=false\n"); return; }
  const clip = elegirClip(process.env.CLIP_REEL || "");
  const p = piezaBf(fecha);
  const datos = { ...p, credito: clip.credito };
  const rutaRelativa = `assets/marketing/reels/${fecha}-black-friday.mp4`;
  await montarVideo({ datos, clip, rutaRelativa });
  const caption = [
    "🖤 BLACK FRIDAY 2x1 en Costaviva 🎣",
    "",
    "Paga el plan anual con el código BLACKFRIDAY y regala otro año de Premium a tu compañero de pesca.",
    "",
    "✅ Tú: 1 año de Premium por 34,99 € (IVA incluido).",
    "🎁 Tu compañero: 1 año gratis, sin tarjeta. Tiene hasta el 31 de diciembre para apuntarse y su año empieza ese día.",
    "📅 Solo del viernes 27 al lunes 30 de noviembre.",
    "",
    "Cómo: entra en Costaviva → Mi suscripción → plan anual → escribe BLACKFRIDAY → paga → regala el año con el email de tu compañero.",
    "",
    "👇 Etiqueta a tu compañero de pesca.",
    `🔗 ${MARCA_ENLACE}`,
    "",
    "Condiciones: solo con el plan anual de 34,99 €; un regalo por compra; tu plan se renueva al año salvo que lo canceles.",
    `${clip.credito}`,
    "",
    "#pesca #blackfriday #surfcasting #regalospesca #costaviva",
  ].join("\n");
  const campana = campanaDePieza(fecha, "reel-black-friday");
  apuntarReel({ tipo: "reel-black-friday", caption, rutaRelativa, baseUrl: BASE_URL, fecha, hora, campana, clip, estado, clave });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Fallo montando el reel del Black Friday:", e); process.exit(1); });
}
