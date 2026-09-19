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

async function crearContenedor(imageUrl, caption) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: PAGE_ACCESS_TOKEN,
  });
  const resp = await fetch(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ACCOUNT_ID}/media`, {
    method: "POST",
    body: params,
  });
  const datos = await resp.json();
  if (!resp.ok) throw new Error(`Graph API /media falló: ${JSON.stringify(datos)}`);
  if (!datos.id) throw new Error(`Graph API /media no devolvió id: ${JSON.stringify(datos)}`);
  return datos.id;
}

function crearIssue({ tipo, caption, publicUrl, creationId }) {
  const titulo = `📸 Propuesta de post Instagram — ${tipo} — ${new Date().toISOString().slice(0, 10)}`;
  const cuerpo = [
    `Contenedor creado en Instagram (borrador, sin publicar todavía) -- caduca solo en 24h si no se aprueba.`,
    "",
    `![preview](${publicUrl})`,
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
  const rutaPendiente = join(__dirname, "post-pendiente.json");
  const pendiente = JSON.parse(readFileSync(rutaPendiente, "utf8"));
  const { tipo, caption, publicUrl } = pendiente;

  await esperarUrlPublica(publicUrl);

  const creationId = await crearContenedor(publicUrl, caption);
  console.log(`✓ Contenedor creado en Instagram, id: ${creationId}`);

  crearIssue({ tipo, caption, publicUrl, creationId });

  writeFileSync(rutaPendiente, JSON.stringify({ ...pendiente, creationId }, null, 2));
}

main().catch((e) => {
  console.error("Fallo publicando el borrador:", e);
  process.exit(1);
});
