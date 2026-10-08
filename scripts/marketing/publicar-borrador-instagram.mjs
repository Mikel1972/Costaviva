// scripts/marketing/publicar-borrador-instagram.mjs
// Segundo paso del robot de marketing -- corre DESPUÉS de que el workflow
// haya comiteado y desplegado la imagen generada por
// generar-post-instagram.mjs (necesita que la URL pública ya sirva la
// imagen de verdad, Instagram la descarga él mismo al crear el
// contenedor).
//
// Crea el "contenedor" del post en la API de Instagram (Content
// Publishing API, dos pasos: /media crea el borrador, /media_publish lo
// publica de verdad) -- este script SOLO hace el primer paso. El
// contenedor caduca solo a las 24h si nadie lo publica, así que no hace
// falta "cancelarlo" a mano si no se aprueba.
//
// Después abre un Issue de GitHub con la vista previa + el texto + el ID
// del contenedor, para que el usuario decida si lo publica (workflow
// aparte, publicar-post-instagram.yml, disparado a mano con ese ID) --
// pedido explícito del usuario: nunca se publica nada en Instagram sin
// aprobación humana.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const IG_BUSINESS_ACCOUNT_ID = process.env.META_IG_BUSINESS_ACCOUNT_ID;
if (!PAGE_ACCESS_TOKEN || !IG_BUSINESS_ACCOUNT_ID) {
  console.error("Faltan META_PAGE_ACCESS_TOKEN o META_IG_BUSINESS_ACCOUNT_ID");
  process.exit(1);
}

// Bug real visto en producción 2026-09-19: el primer intento ya daba 200
// (la propia comprobación tocó un nodo de Cloudflare que ya tenía el
// fichero recién publicado), pero la API de Instagram rechazó la imagen
// con "formato desconocido" al intentar descargarla ella misma segundos
// después -- lo más probable, su rastreador tocó OTRO nodo del borde de
// Cloudflare que todavía no había recibido la propagación global del
// deploy. Por eso, tras el primer 200, se espera un margen fijo antes de
// darlo por bueno de verdad, en vez de seguir al instante.
const MARGEN_PROPAGACION_MS = 45000;

async function esperarUrlPublica(url, intentosMax = 20, esperaMs = 15000) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    try {
      const resp = await fetch(url, { method: "HEAD" });
      if (resp.ok) {
        console.log(`✓ ${url} respondió 200 (intento ${intento}) -- esperando ${MARGEN_PROPAGACION_MS / 1000}s más para que se propague por todo el borde de Cloudflare`);
        await new Promise((r) => setTimeout(r, MARGEN_PROPAGACION_MS));
        return;
      }
      console.log(`… ${url} respondió ${resp.status}, reintentando (${intento}/${intentosMax})`);
    } catch (e) {
      console.log(`… ${url} aún no responde (${e.message}), reintentando (${intento}/${intentosMax})`);
    }
    await new Promise((r) => setTimeout(r, esperaMs));
  }
  throw new Error(`${url} no respondió 200 tras ${intentosMax} intentos -- ¿el deploy de Cloudflare Pages tardó más de lo normal?`);
}

// Detección de token de Meta caducado/inválido (añadido 2026-09-25).
// Caso real: el token se guardó el 2026-09-19 a las 17:47 UTC y caducó a
// las 19:00 UTC del mismo día — era un token de CORTA duración del Graph
// API Explorer (~1h), no uno de larga duración. El robot publicó un único
// post y desde entonces falló en silencio 6 días, porque el informe diario
// solo decía "Posts publicados (24h): 0", que parece normal.
//
// Un token caducado no es un fallo del repo ni de la tarea: es una
// credencial que hay que renovar. Se distingue con el código de error 190
// de Meta (subcódigo 463 = sesión expirada) para que el workflow avise con
// la causa escrita en vez de un rojo genérico. SALIDA_TOKEN_CADUCADO es el
// código de salida que los workflows reconocen.
const SALIDA_TOKEN_CADUCADO = 3;
function esTokenCaducado(datos) {
  const e = datos?.error;
  if (!e) return false;
  return e.code === 190 || e.type === "OAuthException";
}
function abortarPorTokenCaducado(datos) {
  const mensaje = datos?.error?.message || "sin detalle";
  console.error("TOKEN_META_CADUCADO");
  console.error(`El token de Meta (META_PAGE_ACCESS_TOKEN) no es válido: ${mensaje}`);
  console.error("Hay que regenerarlo y volver a guardarlo como secret. Ver CLAUDE.md, sección del token de Instagram.");
  process.exit(SALIDA_TOKEN_CADUCADO);
}

// Imagen: un paso. Reel (2026-10-08): media_type=REELS con video_url, y hay
// que esperar a que Instagram termine de procesar el vídeo (status_code
// FINISHED) antes de que /media_publish lo acepte.
async function crearContenedor({ publicUrl, caption, esReel }) {
  const params = new URLSearchParams(esReel
    ? { media_type: "REELS", video_url: publicUrl, caption, share_to_feed: "true", access_token: PAGE_ACCESS_TOKEN }
    : { image_url: publicUrl, caption, access_token: PAGE_ACCESS_TOKEN });
  const resp = await fetch(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ACCOUNT_ID}/media`, {
    method: "POST",
    body: params,
  });
  const datos = await resp.json();
  if (!resp.ok && esTokenCaducado(datos)) abortarPorTokenCaducado(datos);
  if (!resp.ok) throw new Error(`Graph API /media falló: ${JSON.stringify(datos)}`);
  if (!datos.id) throw new Error(`Graph API /media no devolvió id: ${JSON.stringify(datos)}`);
  if (esReel) await esperarProcesado(datos.id);
  return datos.id;
}

async function esperarProcesado(id, intentosMax = 30, esperaMs = 10000) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=status_code,status&access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`);
    const d = await r.json();
    if (d.status_code === "FINISHED") { console.log(`✓ Vídeo procesado por Instagram (intento ${intento})`); return; }
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el reel: ${JSON.stringify(d)}`);
    console.log(`… Instagram procesando el reel (${d.status_code || "?"}), ${intento}/${intentosMax}`);
    await new Promise((res) => setTimeout(res, esperaMs));
  }
  throw new Error("Instagram no terminó de procesar el reel en 5 minutos");
}

function crearIssue({ tipo, caption, publicUrl, creationId }) {
  const titulo = `${tipo.startsWith("reel") ? "🎬 Propuesta de reel" : "📸 Propuesta de post"} Instagram — ${tipo} — ${new Date().toISOString().slice(0, 10)}`;
  const cuerpo = [
    `Contenedor creado en Instagram (borrador, sin publicar todavía) -- caduca solo en 24h si no se aprueba.`,
    "",
    publicUrl.endsWith(".mp4") ? `🎬 Vídeo: ${publicUrl}` : `![preview](${publicUrl})`,
    "",
    "**Texto propuesto:**",
    "",
    "```",
    caption,
    "```",
    "",
    "---",
    "",
    "### Para publicarlo de verdad",
    "",
    "Ve a la pestaña **Actions** de este repo → workflow **\"Publicar post de Instagram\"** → **\"Run workflow\"** → pega estos datos:",
    "",
    `- \`creation_id\`: \`${creationId}\``,
    `- \`issue_number\`: (el número de este mismo Issue, para que se comente aquí cuando se publique)`,
    "",
    "Si no lo apruebas, no hace falta hacer nada -- el contenedor caduca solo.",
  ].join("\n");

  const salida = execFileSync("gh", ["issue", "create", "--title", titulo, "--body", cuerpo, "--label", "marketing"], {
    encoding: "utf8",
  });
  console.log(salida.trim());
}

async function main() {
  // post-pendiente.json (robot de posts) o reel-pendiente.json (robot de reels).
  const rutaPendiente = join(__dirname, process.argv[2] || "post-pendiente.json");
  const pendiente = JSON.parse(readFileSync(rutaPendiente, "utf8"));
  const { tipo, caption, publicUrl } = pendiente;

  await esperarUrlPublica(publicUrl);

  const creationId = await crearContenedor(pendiente);
  console.log(`✓ Contenedor creado en Instagram, id: ${creationId}`);

  crearIssue({ tipo, caption, publicUrl, creationId });

  writeFileSync(rutaPendiente, JSON.stringify({ ...pendiente, creationId }, null, 2));
}

main().catch((e) => {
  console.error("Fallo publicando el borrador:", e);
  process.exit(1);
});
