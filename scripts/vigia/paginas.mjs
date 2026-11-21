// Vigía de páginas (2026-11-21, Mikel: "que el robot aprenda el error y cree
// un agente que lo revise para que no vuelva a pasar"). Sin IA.
//
// Lo que pasó: Cloudflare (plan gratis, 10 ms de CPU por petición) cortaba
// 367 de las 1.702 páginas del sitemap con "error code: 1102" y 105
// /mareas/<slug> daban 500, porque /prevision (Open-Meteo en 429) no se
// guardaba en caché y cada página la recalculaba. Nadie lo vio hasta el
// email de Cloudflare. Este robot recorre cada día TODO el sitemap, despacio,
// y se pone en rojo (Centro de mando) si alguna página falla dos veces o si
// /prevision trae la mayoría de spots en error.
import { appendFileSync } from "node:fs";

export const ORIGEN = process.env.ORIGEN || "https://costaviva.org";
export const PARALELO = 2;
export const ESPERA_REINTENTO_MS = 30000;
export const MAX_ERROR_PREVISION = 0.5;

export function urlsDeSitemap(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

// Qué le pasa a una respuesta: null si está bien.
export function problema(status, cuerpo = "") {
  if (status === 200) return null;
  const m = /error code: (\d+)/.exec(cuerpo);
  if (m) return `Cloudflare ${m[1]}${m[1] === "1102" ? " (CPU)" : ""}`;
  return `HTTP ${status}`;
}

// /prevision: proporción de spots en error y el primer motivo.
export function estadoPrevision(datos) {
  const spots = Array.isArray(datos?.spots) ? datos.spots : [];
  const conError = spots.filter((s) => s.error);
  const motivo = conError[0] ? String(conError[0].error).replace(/\s*\(https?:\/\/[^)]*\)/, "").slice(0, 120) : null;
  return { total: spots.length, conError: conError.length, proporcion: spots.length ? conError.length / spots.length : 1, motivo };
}

export function agrupar(fallos) {
  const g = new Map();
  for (const f of fallos) {
    const tipo = new URL(f.url).pathname.replace(/\/[^/]+$/, "/…");
    const k = `${tipo} · ${f.problema}`;
    g.set(k, (g.get(k) || 0) + 1);
  }
  return [...g.entries()].sort((a, b) => b[1] - a[1]);
}

async function probar(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "costaviva-vigia-paginas" }, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const cuerpo = r.status === 200 ? "" : (await r.text()).slice(0, 300);
    return problema(r.status, cuerpo);
  } catch (e) {
    return `sin respuesta (${e.name})`;
  }
}

async function enParalelo(lista, n, fn) {
  const out = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < lista.length) { const k = i++; out[k] = await fn(lista[k]); }
  }));
  return out;
}

async function main() {
  const salida = (t) => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${t}\n`); };
  const urls = urlsDeSitemap(await (await fetch(`${ORIGEN}/sitemap.xml`)).text());
  if (urls.length < 100) throw new Error(`sitemap con solo ${urls.length} URL`);
  const primera = await enParalelo(urls, PARALELO, probar);
  const dudosas = urls.filter((_, k) => primera[k]);
  await new Promise((r) => setTimeout(r, dudosas.length ? ESPERA_REINTENTO_MS : 0));
  const segunda = await enParalelo(dudosas, 1, probar);
  const fallos = dudosas.map((url, k) => ({ url, problema: segunda[k] })).filter((f) => f.problema);

  const prev = estadoPrevision(await (await fetch(`${ORIGEN}/prevision`)).json().catch(() => null));
  salida(`## Vigía de páginas (${new Date().toISOString().slice(0, 16)} UTC)`);
  salida(`- Páginas del sitemap: ${urls.length}. Fallan a la primera: ${dudosas.length}. Fallan también al repetir: **${fallos.length}**.`);
  for (const [k, n] of agrupar(fallos)) salida(`  - ${k}: ${n}`);
  for (const f of fallos.slice(0, 30)) salida(`  - ${f.url} → ${f.problema}`);
  salida(`- /prevision: ${prev.conError} de ${prev.total} spots en error${prev.motivo ? ` (${prev.motivo})` : ""}.`);

  let rojo = false;
  if (fallos.length) { console.log(`::error::${fallos.length} páginas del sitemap fallan dos veces (ver resumen)`); rojo = true; }
  if (prev.proporcion > MAX_ERROR_PREVISION) { console.log(`::error::/prevision con ${prev.conError}/${prev.total} spots en error: ${prev.motivo}`); rojo = true; }
  if (dudosas.length > urls.length * 0.02) console.log(`::warning::${dudosas.length} páginas fallaron a la primera (cortes sueltos de CPU)`);
  process.exit(rojo ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
