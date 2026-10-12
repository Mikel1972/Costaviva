// scripts/marketing/veto.mjs
// Publicación automática con veto (decisión de Mikel, 2026-10-11:
// "Automático con veto"; "no podemos estar improvisando ni aprobando uno a
// uno"). Lógica pura, sin red: test/publicacion-veto.test.js.
//
// El robot prepara la pieza y abre el Issue de aviso (etiqueta "marketing")
// la víspera. Si a la hora prevista nadie la ha vetado, publicar-con-veto.yml
// la publica en Instagram y en Facebook con publicar-pieza.mjs (la misma
// lógica que el workflow manual) y cierra el Issue con el enlace.
//
// Veto (cualquiera de estos basta):
//   - la etiqueta "veto" en el Issue;
//   - un comentario del dueño del repo (Mikel1972) con la palabra "no" o
//     "veto" (en caso de duda, gana el veto);
//   - la variable de repositorio PUBLICACION_AUTOMATICA distinta de "true":
//     entonces no se publica nada solo (interruptor general).
// Barreras: 12 h de aviso como mínimo, 1 publicación al día por red, solo
// piezas de la plantilla propia (nunca webcams de terceros ni personas
// identificables), textos sin huecos, token válido (si falta
// pages_manage_posts, solo Instagram).

import { hoyMadrid, instanteMadrid } from "./calendario.mjs";

export const HORAS_AVISO = 12;
// El contenedor de Instagram caduca a las 24 h de crearse: margen de 1 h.
export const HORAS_CADUCA_INSTAGRAM = 23;
export const ETIQUETA_VETO = "veto";
// Cuando algo sale mal (fallo al publicar, pieza dudosa, caducada), el Issue
// se marca y el robot no lo vuelve a intentar: decide Mikel.
export const ETIQUETA_REVISAR = "revisar-publicacion";
const H = 3600 * 1000;

function normalizar(texto) {
  return String(texto || "")
    .split("\n").filter((l) => !/^\s*>/.test(l)).join("\n") // sin las citas de un email
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

// "no", "No.", "veto", "vetada", "NO, esta no"... -> veto. "sí", "ok" -> no.
export function esComentarioVeto(texto) {
  const palabras = normalizar(texto).split(" ");
  return palabras.includes("no") || palabras.some((p) => /^vet(o|a|ada|ado|amos|ar|ala|alo)$/.test(p));
}

// ¿Vetada? etiquetas: nombres; comentarios: [{ autor, cuerpo }]; dueno: login.
export function vetada({ etiquetas = [], comentarios = [], dueno = "" }) {
  if (etiquetas.map((e) => String(e).toLowerCase()).includes(ETIQUETA_VETO)) return { vetada: true, motivo: "etiqueta veto" };
  const d = String(dueno).toLowerCase();
  const c = comentarios.find((x) => d && String(x.autor || "").toLowerCase() === d && esComentarioVeto(x.cuerpo));
  if (c) return { vetada: true, motivo: "comentario de Mikel" };
  return { vetada: false };
}

// Cuándo puede salir sola: a la hora prevista, pero nunca antes de 12 h desde
// que se abrió el Issue (si el robot llegó tarde, se retrasa).
export function momentoPublicacion(pieza, creadoIssue) {
  if (!pieza?.fecha || !pieza?.hora || !/^\d{4}-\d{2}-\d{2}$/.test(pieza.fecha) || !/^\d{2}:\d{2}$/.test(pieza.hora)) return null;
  const prevista = instanteMadrid(pieza.fecha, pieza.hora);
  const creado = new Date(creadoIssue);
  if (Number.isNaN(creado.getTime())) return null;
  return new Date(Math.max(prevista.getTime(), creado.getTime() + HORAS_AVISO * H));
}

// Solo piezas de nuestra plantilla, servidas desde costaviva.org/assets/marketing.
const URL_PROPIA = /^https:\/\/costaviva\.org\/assets\/marketing\/[A-Za-z0-9._-]+\.(png|jpe?g|mp4)$/;
const HUECOS = /\{ENLACE\}|\bundefined\b|\bNaN\b|\bnull\b|\[object /;
export function piezaSegura(pieza) {
  if (!pieza || typeof pieza !== "object") return { ok: false, motivo: "el Issue no lleva la pieza" };
  if (!URL_PROPIA.test(String(pieza.publicUrl || ""))) return { ok: false, motivo: "la imagen o el vídeo no es una pieza propia de costaviva.org/assets/marketing" };
  if (/webcam|camara|cámara|\bcam\b/i.test(pieza.publicUrl)) return { ok: false, motivo: "parece un fotograma de cámara" };
  for (const k of ["captionInstagram", "captionFacebook"]) {
    const t = String(pieza[k] || "");
    if (t.trim().length < 20) return { ok: false, motivo: `falta el texto (${k})` };
    if (HUECOS.test(t)) return { ok: false, motivo: `el texto tiene un hueco sin datos reales (${k})` };
  }
  if (pieza.esReel) {
    // clip: null = sin vídeo de gancho (fondo de la marca). Un clip tiene que
    // traer su ficha con persona_identificable === false.
    if (pieza.clip === null) return { ok: true };
    if (!pieza.clip || pieza.clip.personaIdentificable !== false) {
      return { ok: false, motivo: "el reel usa un clip sin ficha que diga que no sale ninguna persona identificable" };
    }
  }
  return { ok: true };
}

// ¿Ya salió esta pieza en esta red? ¿Ya salió otra pieza hoy en esta red?
// publicados: [{ issueNumber, fecha, red }] (posts-publicados.jsonl /
// posts-facebook.jsonl).
export function yaPublicada(publicados = [], issue) {
  return publicados.some((p) => String(p.issueNumber ?? "") === String(issue));
}
export function publicadaHoy(publicados = [], ahora) {
  const hoy = hoyMadrid(ahora);
  return publicados.some((p) => p.fecha && hoyMadrid(new Date(p.fecha)) === hoy);
}

// Decisión para un Issue. Devuelve { accion, redes, motivo, notas }:
//   publicar  -> publicar en `redes`
//   esperar   -> aún no es la hora (o falta el aviso de 12 h)
//   saltar    -> no se publica y no hace falta decir nada
//   avisar    -> no se publica y hay que decírselo a Mikel en el Issue
// El token se mira aparte (ajustarPorToken): así solo se llama a Meta
// cuando de verdad toca publicar.
export function decidir({ issue, pieza, etiquetas = [], comentarios = [], dueno, creado, abierto = true, ahora = new Date(), automatica, publicados = {} }) {
  const r = (accion, motivo, extra = {}) => ({ accion, motivo, redes: [], notas: [], ...extra });
  if (String(automatica ?? "").trim().toLowerCase() !== "true") return r("saltar", "PUBLICACION_AUTOMATICA no es true");
  if (!abierto) return r("saltar", "Issue cerrado");
  if (!pieza) return r("saltar", "Issue sin pieza");
  // Las piezas de Nueva Zelanda solo salen con el OK manual de Mikel (2026-10-11).
  if (pieza.mercado === "nz") return r("saltar", "pieza de Nueva Zelanda: solo se publica a mano, con el OK de Mikel");
  if (etiquetas.includes(ETIQUETA_REVISAR)) return r("saltar", `etiqueta ${ETIQUETA_REVISAR}`);
  const v = vetada({ etiquetas, comentarios, dueno });
  if (v.vetada) return r("saltar", `vetada (${v.motivo})`, { vetada: true });
  const momento = momentoPublicacion(pieza, creado);
  if (!momento) return r("saltar", "la pieza no dice fecha y hora de publicación");
  if (ahora < momento) return r("esperar", `sale el ${momento.toISOString()}`, { momento });

  const ig = publicados.instagram || [], fb = publicados.facebook || [];
  let redes = ["instagram", "facebook"].filter((red) => !yaPublicada(red === "instagram" ? ig : fb, issue));
  if (!redes.length) return r("saltar", "ya publicada");

  const seg = piezaSegura(pieza);
  if (!seg.ok) return r("avisar", seg.motivo, { clave: "pieza", revisar: true });

  const notas = [];
  const creadaEn = new Date(pieza.creadoEn || creado);
  if (redes.includes("instagram") && ahora.getTime() > creadaEn.getTime() + HORAS_CADUCA_INSTAGRAM * H) {
    return r("avisar", "el borrador de Instagram ha caducado (24 h): vuelve a lanzar el robot para esa fecha", { clave: "caducada", revisar: true });
  }
  for (const [red, lista] of [["instagram", ig], ["facebook", fb]]) {
    if (redes.includes(red) && publicadaHoy(lista, ahora)) {
      redes = redes.filter((x) => x !== red);
      notas.push(`${red === "instagram" ? "Instagram" : "Facebook"}: hoy ya salió otra pieza (máximo 1 al día por red).`);
    }
  }
  if (!redes.length) return r("avisar", "hoy ya se publicó otra pieza en las dos redes (máximo 1 al día por red)", { clave: "limite", notas });
  return r("publicar", "sin veto y en hora", { redes, notas });
}

// token: { instagram: { ok, motivo }, facebook: { ok, motivo } } (estado-token.mjs).
// Token inválido o sin permisos para Instagram -> no se publica nada y se
// avisa. Sin pages_manage_posts (o sin Página) -> solo Instagram, anotado.
export function ajustarPorToken(decision, token) {
  if (decision.accion !== "publicar") return decision;
  if (!token?.instagram?.ok) {
    return { ...decision, accion: "avisar", redes: [], clave: "token", motivo: `el token de Meta no vale para publicar (${token?.instagram?.motivo || "sin detalle"}); lanza "Comprobar token de Instagram"` };
  }
  if (decision.redes.includes("facebook") && !token?.facebook?.ok) {
    const redes = decision.redes.filter((x) => x !== "facebook");
    const notas = [...decision.notas, `Facebook: no se publica (${token?.facebook?.motivo || "sin permiso"}); solo Instagram.`];
    if (!redes.length) return { ...decision, accion: "avisar", redes, notas, clave: "token-facebook", motivo: notas.at(-1) };
    return { ...decision, redes, notas };
  }
  return decision;
}

// Input "redes" de publicar-pieza.mjs (redesPedidas de pieza-issue.mjs).
export function textoRedes(redes) {
  if (redes.length === 2) return "instagram y facebook";
  return redes[0] === "facebook" ? "solo facebook" : "solo instagram";
}

// Marca invisible para no repetir el mismo aviso cada 30 min.
export function marcaAviso(clave) {
  return `<!-- veto-auto:${clave} -->`;
}
export function yaAvisado(comentarios = [], clave) {
  return comentarios.some((c) => String(c.cuerpo || "").includes(marcaAviso(clave)));
}

// "martes 13/10 a las 08:00" del momento real de publicación.
export function textoMomento(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", {
    // Hora de Madrid a propósito (ZONA_NEGOCIO): aviso para Mikel.
    timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}/${p.month} a las ${p.hour}:${p.minute}`;
}
