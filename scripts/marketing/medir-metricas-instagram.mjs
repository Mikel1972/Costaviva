// scripts/marketing/medir-metricas-instagram.mjs
// Corrido a diario por .github/workflows/metricas-instagram.yml. Pedido
// explícito del usuario (2026-09-19): llevar cuenta de impacto/
// impresiones de cada post publicado por el robot de marketing, para ir
// afinando qué contenido funciona mejor -- mismo criterio que el resto de
// calibraciones del repo (nunca inventar un número, y si la API no lo da,
// se guarda null en vez de estimarlo).
//
// Lee scripts/marketing/posts-publicados.jsonl (lo escribe
// publicar-post-instagram.yml al publicar de verdad), mide con la API de
// Instagram los posts de 48h o más que aún no se hayan medido (las
// métricas de Instagram tardan en asentarse, medir demasiado pronto da
// números artificialmente bajos), y guarda el resultado real en
// CALIBRACION.jsonl -- el mismo fichero que ya usa el resto de
// calibraciones (oleaje, mareas, corrientes...), para tener todo el
// historial de "cuánto de fiable es cada cosa que hacemos" en un solo
// sitio.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const RUTA_POSTS = join(__dirname, "posts-publicados.jsonl");
const RUTA_CALIBRACION = join(RAIZ_REPO, "CALIBRACION.jsonl");

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
if (!PAGE_ACCESS_TOKEN) {
  console.error("Falta META_PAGE_ACCESS_TOKEN");
  process.exit(1);
}

const MARGEN_MINIMO_MS = 48 * 60 * 60 * 1000; // 48h -- a las métricas de Instagram les hace falta asentarse

function leerLineasJsonl(ruta) {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function medirPost(postId) {
  // "reach" (alcance de cuentas distintas) está disponible para casi
  // cualquier versión de la API; "impressions" se pidió aparte porque
  // Meta lo ha ido deprecando/renombrando en distintas versiones -- si
  // falla, se guarda null en vez de romper la medición del resto.
  let alcance = null;
  let impresiones = null;
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${postId}/insights?metric=reach&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const datos = await resp.json();
    if (resp.ok) alcance = datos.data?.find((m) => m.name === "reach")?.values?.[0]?.value ?? null;
    else console.warn(`No se pudo leer "reach" de ${postId}: ${JSON.stringify(datos)}`);
  } catch (e) {
    console.warn(`Error pidiendo "reach" de ${postId}: ${e.message}`);
  }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${postId}/insights?metric=impressions&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const datos = await resp.json();
    if (resp.ok) impresiones = datos.data?.find((m) => m.name === "impressions")?.values?.[0]?.value ?? null;
  } catch (e) {
    console.warn(`"impressions" no disponible para ${postId} (esperado en algunas versiones de la API): ${e.message}`);
  }

  let likes = null, comentarios = null, guardados = null;
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${postId}?fields=like_count,comments_count&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const datos = await resp.json();
    if (resp.ok) {
      likes = datos.like_count ?? null;
      comentarios = datos.comments_count ?? null;
    }
  } catch (e) {
    console.warn(`No se pudo leer like_count/comments_count de ${postId}: ${e.message}`);
  }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${postId}/insights?metric=saved&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const datos = await resp.json();
    if (resp.ok) guardados = datos.data?.find((m) => m.name === "saved")?.values?.[0]?.value ?? null;
  } catch (e) {
    console.warn(`"saved" no disponible para ${postId}: ${e.message}`);
  }

  return { alcance, impresiones, likes, comentarios, guardados };
}

async function main() {
  const posts = leerLineasJsonl(RUTA_POSTS);
  if (!posts.length) {
    console.log("No hay posts_publicados.jsonl todavía, nada que medir.");
    return;
  }

  const ahora = Date.now();
  let algunoMedido = false;

  for (const post of posts) {
    if (post.medido) continue;
    const edadMs = ahora - new Date(post.fecha).getTime();
    if (edadMs < MARGEN_MINIMO_MS) {
      console.log(`⏳ ${post.postId} todavía no tiene 48h (publicado ${post.fecha}), se mide otro día`);
      continue;
    }

    console.log(`Midiendo ${post.postId}…`);
    const metricas = await medirPost(post.postId);
    const entrada = {
      fecha: new Date().toISOString(),
      tipo: "instagram_metricas",
      postId: post.postId,
      publicadoEn: post.fecha,
      issueNumber: post.issueNumber ?? null,
      ...metricas,
      nota: "medido 48h después de publicar, para que las métricas de Instagram ya estén asentadas",
    };
    appendFileSync(RUTA_CALIBRACION, JSON.stringify(entrada) + "\n");
    console.log(`✓ ${post.postId}: alcance=${metricas.alcance} impresiones=${metricas.impresiones} likes=${metricas.likes} comentarios=${metricas.comentarios} guardados=${metricas.guardados}`);
    post.medido = true;
    algunoMedido = true;
  }

  if (algunoMedido) {
    writeFileSync(RUTA_POSTS, posts.map((p) => JSON.stringify(p)).join("\n") + "\n");
    console.log("✓ posts-publicados.jsonl actualizado");
  } else {
    console.log("Nada nuevo que medir hoy.");
  }
}

main().catch((e) => {
  console.error("Fallo midiendo métricas:", e);
  process.exit(1);
});
