// scripts/marketing/publicar-pieza.mjs
// Publica de verdad una pieza YA APROBADA por Mikel (2026-10-09). Solo lo
// corre el workflow manual "Publicar post de Instagram"
// (publicar-post-instagram.yml): nunca un cron, nunca un robot.
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

async function publicarInstagram(creationId) {
  if (!IG_ID) throw new Error("Falta la variable META_IG_BUSINESS_ACCOUNT_ID");
  const d = await post(`${API}/${IG_ID}/media_publish`, { creation_id: creationId, access_token: TOKEN });
  return d.id;
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
        if (!creationId) throw new Error("No hay borrador de Instagram para esta pieza");
        const id = await publicarInstagram(creationId);
        apuntar("posts-publicados.jsonl", { postId: id, red: "instagram", fecha: new Date().toISOString(), issueNumber: ISSUE || null, campana: pieza.campana || null, medido: false });
        hechos.push(`Instagram (id ${id})`);
      } else {
        const id = await publicarFacebook(pieza);
        apuntar("posts-facebook.jsonl", { postId: id, red: "facebook", fecha: new Date().toISOString(), issueNumber: ISSUE || null, campana: pieza.campana || null, reel: !!pieza.esReel });
        hechos.push(`Facebook (id ${id})`);
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

main().catch((e) => {
  console.error("Fallo publicando la pieza:", e.message);
  process.exit(1);
});
