// scripts/marketing/publicar-pieza.mjs
// Publica de verdad una pieza (2026-10-09). La corren el workflow manual
// "Publicar post de Instagram" (publicar-post-instagram.yml) y, desde el
// 2026-10-11, la publicación automática con veto de 12 h
// (publicar-con-veto.mjs / publicar-con-veto.yml), que solo la llama si
// nadie ha vetado el Issue y PUBLICACION_AUTOMATICA es "true".
//
// Entrada (entorno):
//   ISSUE_NUMBER  Issue de revisión con etiqueta "marketing" que abrió el
//                 robot; dentro va la pieza (pieza-issue.mjs).
//   REDES         "instagram y facebook" (por defecto), "solo instagram" o
//                 "solo facebook".
//   CREATION_ID   opcional: contenedor de Instagram a publicar (Issues
//                 antiguos sin bloque de pieza).
//   META_PAGE_ACCESS_TOKEN (secret), META_IG_BUSINESS_ACCOUNT_ID y
//   META_PAGE_ID (variables).
//
// Instagram: /media_publish del contenedor que creó el robot (caduca a las
// 24 h). Facebook: se publica ahora mismo en la Página, con el Page token
// que se obtiene del token guardado (Usuario del Sistema): foto con
// /{page}/photos; reel con la API de Reels de Páginas (/video_reels: start,
// subida por URL y finish).
//
// Códigos de salida: 0 todo bien; 3 token caducado; 4 falta un permiso
// (pages_manage_posts); 1 cualquier otro fallo. Si una red sale bien y la
// otra no, se apunta la que salió y se sale con error para que se vea.
import { appendFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extraerPieza, redesPedidas, tipoDeError, SALIDA_TOKEN_CADUCADO, SALIDA_SIN_PERMISO } from "./pieza-issue.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = "https://graph.facebook.com/v21.0";
const TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const IG_ID = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const PAGE_ID = process.env.META_PAGE_ID;
const ISSUE = String(process.env.ISSUE_NUMBER || "").trim();

class ErrorMeta extends Error {
  constructor(paso, datos) {
    super(`${paso}: ${datos?.error?.message || JSON.stringify(datos)}`);
    this.tipo = tipoDeError(datos) || "otro";
  }
}

async function post(url, params) {
  const r = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new ErrorMeta(url.replace(/access_token=[^&]+/, ""), d);
  return d;
}

function leerIssue() {
  if (!/^\d+$/.test(ISSUE)) return { pieza: null, etiquetas: [] };
  const salida = execFileSync("gh", ["issue", "view", ISSUE, "--json", "body,labels,state"], { encoding: "utf8" });
  const d = JSON.parse(salida);
  return { pieza: extraerPieza(d.body), etiquetas: (d.labels || []).map((l) => l.name), estado: d.state };
}

async function publicarInstagram(creationId, pieza = {}) {
  if (!IG_ID) throw new Error("Falta la variable META_IG_BUSINESS_ACCOUNT_ID");
  const contenedor = await contenedorListo(creationId, pieza);
  const d = await post(`${API}/${IG_ID}/media_publish`, { creation_id: contenedor, access_token: TOKEN });
  return d.id;
}

// 2026-10-30 (#342): el contenedor de Instagram caduca a las 24 h; publicado
// a mano 23,5 h después, /media_publish dijo "Fatal" y se tomó por token
// caducado. Ahora se mira antes su estado: si sigue procesando se espera; si
// caducó o falló (o ya no existe) y el Issue trae la pieza, se crea uno nuevo
// con el mismo vídeo o imagen y el mismo texto.
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function estadoContenedor(id) {
  if (!id) return null;
  const r = await fetch(`${API}/${id}?fields=status_code&access_token=${encodeURIComponent(TOKEN)}`);
  const d = await r.json().catch(() => ({}));
  if (d.error && tipoDeError(d) === "token") throw new ErrorMeta("estado del borrador de Instagram", d);
  return d.status_code || (d.error ? "NO_EXISTE" : null);
}
async function esperarProcesado(id, intentos = 30, ms = 10000) {
  for (let i = 1; i <= intentos; i++) {
    const estado = await estadoContenedor(id);
    if (estado === "FINISHED" || estado === null) return estado;
    if (estado !== "IN_PROGRESS") return estado;
    console.log(`… Instagram procesando el borrador (${i}/${intentos})`);
    await esperar(ms);
  }
  return "IN_PROGRESS";
}
export async function contenedorListo(creationId, pieza, { estadoDe = esperarProcesado, crear = crearContenedor } = {}) {
  const estado = creationId ? await estadoDe(creationId) : "NO_EXISTE";
  if (estado === "FINISHED" || estado === null) return creationId;
  if (!pieza.publicUrl || !pieza.captionInstagram) throw new Error(`El borrador de Instagram no se puede publicar (${estado}) y el Issue no trae la pieza para rehacerlo`);
  console.log(`Borrador de Instagram ${estado}: se crea uno nuevo con la misma pieza.`);
  const nuevo = await crear(pieza);
  const estadoNuevo = await estadoDe(nuevo);
  if (estadoNuevo !== "FINISHED" && estadoNuevo !== null) throw new Error(`Instagram no terminó de procesar el borrador nuevo (${estadoNuevo})`);
  return nuevo;
}
async function crearContenedor(pieza) {
  const d = await post(`${API}/${IG_ID}/media`, pieza.esReel
    ? { media_type: "REELS", video_url: pieza.publicUrl, caption: pieza.captionInstagram, share_to_feed: "true", access_token: TOKEN }
    : { image_url: pieza.publicUrl, caption: pieza.captionInstagram, access_token: TOKEN });
  return d.id;
}

// Enlace público de lo publicado, para cerrar el Issue con él (2026-10-11).
// Si Meta no lo da, se sigue sin enlace: la publicación ya está hecha.
async function enlaceInstagram(id) {
  try {
    const r = await fetch(`${API}/${id}?fields=permalink&access_token=${encodeURIComponent(TOKEN)}`);
    const d = await r.json();
    return d.permalink || null;
  } catch {
    return null;
  }
}
function enlaceFacebook(id, esReel) {
  return esReel ? `https://www.facebook.com/reel/${id}` : `https://www.facebook.com/${id}`;
}

// Page token a partir del token guardado. Con un token de Usuario del
// Sistema, /{page}?fields=access_token devuelve el de la Página; si el token
// guardado ya es de Página, se usa tal cual.
async function tokenDePagina() {
  const r = await fetch(`${API}/${PAGE_ID}?fields=access_token&access_token=${encodeURIComponent(TOKEN)}`);
  const d = await r.json().catch(() => ({}));
  if (d.error && tipoDeError(d) === "token") throw new ErrorMeta("token de Página", d);
  return d.access_token || TOKEN;
}

async function publicarFacebook(pieza) {
  if (!PAGE_ID) throw Object.assign(new Error("Falta la variable META_PAGE_ID (id de la Página de Facebook)"), { tipo: "permiso" });
  const tokenPagina = await tokenDePagina();
  if (!pieza.esReel) {
    const d = await post(`${API}/${PAGE_ID}/photos`, { url: pieza.publicUrl, caption: pieza.captionFacebook, published: "true", access_token: tokenPagina });
    return d.post_id || d.id;
  }
  // Reels de Página: 1) start -> video_id; 2) subida por URL; 3) finish.
  const inicio = await post(`${API}/${PAGE_ID}/video_reels`, { upload_phase: "start", access_token: tokenPagina });
  const subida = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${inicio.video_id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${tokenPagina}`, file_url: pieza.publicUrl },
  });
  const ds = await subida.json().catch(() => ({}));
  if (!subida.ok || !ds.success) throw new ErrorMeta("subida del reel a Facebook", ds);
  await post(`${API}/${PAGE_ID}/video_reels`, {
    upload_phase: "finish", video_id: inicio.video_id, video_state: "PUBLISHED", description: pieza.captionFacebook, access_token: tokenPagina,
  });
  return inicio.video_id;
}

function apuntar(fichero, linea) {
  mkdirSync(__dirname, { recursive: true });
  appendFileSync(join(__dirname, fichero), JSON.stringify(linea) + "\n");
}

async function main() {
  if (!TOKEN) {
    console.error("Falta META_PAGE_ACCESS_TOKEN");
    process.exit(1);
  }
  const { pieza: piezaIssue, etiquetas, estado } = leerIssue();
  // Solo Issues del robot (etiqueta marketing) y abiertos: nada de publicar
  // un texto que alguien haya puesto en otro Issue.
  if (ISSUE && !etiquetas.includes("marketing")) throw new Error(`El Issue #${ISSUE} no tiene la etiqueta "marketing"`);
  if (ISSUE && estado && estado !== "OPEN") throw new Error(`El Issue #${ISSUE} está cerrado: ¿ya se publicó?`);
  const pieza = piezaIssue || {};
  const creationId = String(process.env.CREATION_ID || "").trim() || pieza.creationId;
  let redes = redesPedidas(process.env.REDES);
  if (!piezaIssue) {
    // Issue antiguo (antes del 2026-10-09) o sin Issue: solo Instagram.
    if (!creationId) throw new Error("Sin pieza en el Issue y sin creation_id: no hay nada que publicar");
    redes = ["instagram"];
  }

  const hechos = [], fallos = [];
  for (const red of redes) {
    try {
      if (red === "instagram") {
        if (!creationId && !pieza.publicUrl) throw new Error("No hay borrador de Instagram para esta pieza");
        const id = await publicarInstagram(creationId, pieza);
        apuntar("posts-publicados.jsonl", { postId: id, red: "instagram", fecha: new Date().toISOString(), issueNumber: ISSUE || null, campana: pieza.campana || null, medido: false });
        const enlace = await enlaceInstagram(id);
        hechos.push(`Instagram (id ${id})${enlace ? `: ${enlace}` : ""}`);
      } else {
        const id = await publicarFacebook(pieza);
        apuntar("posts-facebook.jsonl", { postId: id, red: "facebook", fecha: new Date().toISOString(), issueNumber: ISSUE || null, campana: pieza.campana || null, reel: !!pieza.esReel });
        hechos.push(`Facebook (id ${id}): ${enlaceFacebook(id, pieza.esReel)}`);
      }
    } catch (e) {
      console.error(`✗ ${red}: ${e.message}`);
      fallos.push({ red, tipo: e.tipo || "otro", mensaje: e.message });
    }
  }

  const resumen = [
    ...hechos.map((h) => `✅ Publicado en ${h}.`),
    ...fallos.map((f) => `❌ ${f.red}: ${f.tipo === "token" ? "el token de Meta ha caducado o no vale" : f.tipo === "permiso" ? "falta un permiso o la configuración de Facebook (ver CLAUDE.md, \"Facebook\")" : f.mensaje}`),
  ].join("\n");
  console.log(resumen);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `resumen<<FIN_RESUMEN\n${resumen}\nFIN_RESUMEN\nhechos=${hechos.length}\nfallos=${fallos.length}\n`);
  }
  if (fallos.some((f) => f.tipo === "token")) process.exit(SALIDA_TOKEN_CADUCADO);
  if (fallos.some((f) => f.tipo === "permiso")) process.exit(SALIDA_SIN_PERMISO);
  if (fallos.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Fallo publicando la pieza:", e.message);
    process.exit(1);
  });
}
