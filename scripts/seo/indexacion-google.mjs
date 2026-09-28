// scripts/seo/indexacion-google.mjs
// Estado de indexación real en Google de cada URL del sitemap (pedido
// explícito del usuario, 2026-09-28: "cómo reviso las indexaciones de las
// páginas"). Hasta ahora el informe diario solo traía el RENDIMIENTO de
// Search Console (clics, impresiones); esto dice qué páginas ha indexado
// Google y, las que no, por qué.
//
// Usa la API de inspección de URLs (searchconsole v1, urlInspection) con la
// misma cuenta de servicio y la misma Workload Identity Federation que el
// paso "Search Console" de daily-report.yml — el workflow que llama a esto
// tiene que haber pasado antes por google-github-actions/auth.
//
// Cuota de Google: 2.000 inspecciones al día y 600 por minuto por propiedad.
// El sitemap tiene ~116 URLs, así que se pueden inspeccionar todas cada día
// sin rotar. Si algún día pasa de LIMITE_URLS, se inspeccionan las primeras
// y se dice explícitamente cuántas quedaron fuera.
//
// Lo llaman daily-report.yml (paso "Search Console -- indexación") y
// indexacion-google.yml (a mano). Escribe el resumen en $GITHUB_OUTPUT
// (resultado, indexadas, total) y en $GITHUB_STEP_SUMMARY si existen.
// Nunca sale con error: un fallo se cuenta en el propio resumen, igual que
// el resto de pasos del informe diario.

import { readFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIMITE_URLS = 500;
const CONCURRENCIA = 4;
const MAX_NO_INDEXADAS_LISTADAS = 10;

// Traducción de los coverageState más habituales. Uno que no esté aquí se
// muestra tal cual lo da Google.
const ESTADOS = {
  "Submitted and indexed": "Enviada e indexada",
  "Indexed, not submitted in sitemap": "Indexada, no enviada en el sitemap",
  "Crawled - currently not indexed": "Rastreada: actualmente sin indexar",
  "Discovered - currently not indexed": "Descubierta: actualmente sin indexar",
  "URL is unknown to Google": "Google no conoce la URL",
  "Duplicate without user-selected canonical": "Duplicada sin canónica elegida",
  "Duplicate, Google chose different canonical than user": "Duplicada: Google eligió otra canónica",
  "Alternate page with proper canonical tag": "Página alternativa con canónica correcta",
  "Page with redirect": "Página con redirección",
  "Not found (404)": "No encontrada (404)",
  "Excluded by 'noindex' tag": "Excluida por noindex",
  "Blocked by robots.txt": "Bloqueada por robots.txt",
  "Soft 404": "Soft 404",
  "Server error (5xx)": "Error del servidor (5xx)",
};
const traducir = (estado) => ESTADOS[estado] || estado || "sin estado";

function urlsDelSitemap() {
  const xml = readFileSync(join(RAIZ_REPO, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

function escribirSalida(lineas, indexadas, total) {
  const texto = lineas.join("\n");
  console.log(texto);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `resultado<<EOF\n${texto}\nEOF\nindexadas=${indexadas ?? ""}\ntotal=${total ?? ""}\n`
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Indexación en Google\n\n${texto}\n`);
  }
}

async function main() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const cabecera = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const sites = await (await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: cabecera })).json();
  const sitio = sites.siteEntry?.[0]?.siteUrl;
  if (!sitio) throw new Error("la cuenta de servicio no ve ninguna propiedad en Search Console");

  const lineas = [];

  // Estado del sitemap tal como lo ve Google.
  try {
    const resp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/sitemaps`, { headers: cabecera });
    const { sitemap = [] } = await resp.json();
    if (!sitemap.length) {
      lineas.push("  - ⚠️ Sitemap: Google no tiene ningún sitemap enviado para esta propiedad. Envíalo en Search Console → Sitemaps.");
    } else {
      for (const s of sitemap) {
        const enviadas = (s.contents || []).reduce((n, c) => n + Number(c.submitted || 0), 0);
        const leido = s.lastDownloaded ? s.lastDownloaded.slice(0, 10) : "nunca";
        const problemas = Number(s.errors || 0) + Number(s.warnings || 0);
        lineas.push(`  - Sitemap ${s.path}: ${enviadas} URLs, leído por última vez ${leido}${s.isPending ? " (pendiente de procesar)" : ""}${problemas ? `, ⚠️ ${s.errors || 0} errores y ${s.warnings || 0} avisos` : ""}`);
      }
    }
  } catch (e) {
    lineas.push(`  - Sitemap: no se pudo consultar (${e.message})`);
  }

  const todas = urlsDelSitemap();
  const urls = todas.slice(0, LIMITE_URLS);

  async function inspeccionar(url) {
    const resp = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: cabecera,
      body: JSON.stringify({ inspectionUrl: url, siteUrl: sitio, languageCode: "es-ES" }),
    });
    const datos = await resp.json();
    if (!resp.ok) {
      const error = new Error(datos.error?.message || `HTTP ${resp.status}`);
      error.status = resp.status;
      throw error;
    }
    const r = datos.inspectionResult?.indexStatusResult || {};
    return { url, veredicto: r.verdict, estado: r.coverageState, rastreo: r.lastCrawlTime };
  }

  // La primera sola: si la cuenta no tiene permiso para inspeccionar, se ve
  // aquí con un mensaje claro en vez de 116 errores iguales.
  const resultados = [];
  try {
    resultados.push(await inspeccionar(urls[0]));
  } catch (e) {
    if (e.status === 403) {
      lineas.push(`  - ❌ La cuenta de servicio no tiene permiso para inspeccionar URLs (${e.message}). En Search Console → Configuración → Usuarios y permisos, sube costaviva-search-console-reade@… de "Restringido" a "Completo". Este script solo pide permiso de lectura (webmasters.readonly), así que no puede cambiar nada aunque el rol lo permitiera.`);
      escribirSalida(lineas);
      return;
    }
    throw e;
  }

  const fallos = [];
  let siguiente = 1;
  async function trabajador() {
    while (siguiente < urls.length) {
      const url = urls[siguiente++];
      try {
        resultados.push(await inspeccionar(url));
      } catch (e) {
        fallos.push({ url, motivo: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

  const indexadas = resultados.filter((r) => r.veredicto === "PASS");
  const noIndexadas = resultados.filter((r) => r.veredicto !== "PASS");
  const porcentaje = resultados.length ? Math.round((indexadas.length / resultados.length) * 100) : 0;

  lineas.unshift(`  - Indexadas en Google: ${indexadas.length} de ${resultados.length} URLs del sitemap (${porcentaje}%)`);

  const porEstado = {};
  for (const r of noIndexadas) porEstado[traducir(r.estado)] = (porEstado[traducir(r.estado)] || 0) + 1;
  const estadosOrdenados = Object.entries(porEstado).sort((a, b) => b[1] - a[1]);
  if (estadosOrdenados.length) {
    lineas.push("  - No indexadas, por motivo:");
    for (const [estado, n] of estadosOrdenados) lineas.push(`    - ${estado}: ${n}`);
    const ruta = (u) => u.replace(/^https?:\/\/[^/]+/, "") || "/";
    const listadas = noIndexadas.slice(0, MAX_NO_INDEXADAS_LISTADAS).map((r) => ruta(r.url));
    lineas.push(`  - Ejemplos sin indexar: ${listadas.join(", ")}${noIndexadas.length > listadas.length ? ` y ${noIndexadas.length - listadas.length} más` : ""}`);
  }
  if (fallos.length) {
    lineas.push(`  - ⚠️ ${fallos.length} URLs no se pudieron inspeccionar (primer motivo: ${fallos[0].motivo})`);
  }
  if (todas.length > urls.length) {
    lineas.push(`  - El sitemap tiene ${todas.length} URLs; solo se inspeccionan las ${urls.length} primeras (límite de cuota).`);
  }

  escribirSalida(lineas, indexadas.length, resultados.length);
}

main().catch((e) => {
  escribirSalida([`  - No se pudo consultar la indexación (${e.message || e})`]);
});
