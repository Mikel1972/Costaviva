// scripts/seo/espejo-produccion.mjs — revisión semanal del espejo de idiomas
// en la web publicada (2026-11-20, Mikel: «y que revise cada lunes si son
// espejos 100 %»). Sin IA. Lo lanza .github/workflows/espejo-semanal.yml.
//  1. Lee https://costaviva.org/sitemap.xml y cuenta los huecos (página en un
//     idioma sin su versión en los otros).
//  2. Abre todas las páginas del sitemap y comprueba que responden 200.
//  3. Escribe el resumen (porcentaje de espejo, huecos por tipo y páginas
//     rotas) y sale en rojo si hay huecos NUEVOS (no anotados en
//     datos-robots/seo/espejo-pendientes.json) o páginas rotas.
import { readFileSync, appendFileSync } from "node:fs";
import { huecos, locsDeSitemap, claveDeUrl, IDIOMAS } from "./espejo.mjs";

const SITEMAP = process.env.SITEMAP_URL || "https://costaviva.org/sitemap.xml";
const resumen = (t) => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, t + "\n"); };

const xml = await (await fetch(SITEMAP, { signal: AbortSignal.timeout(60000) })).text();
const locs = locsDeSitemap(xml);
const faltan = huecos(locs);
const pendientes = JSON.parse(readFileSync("datos-robots/seo/espejo-pendientes.json", "utf8")).faltan;
const nuevos = faltan.filter((h) => !pendientes.includes(h));
const claves = new Set(locs.map((l) => claveDeUrl(l).clave));
const total = claves.size * IDIOMAS.length;
const pct = total ? Math.floor((1000 * (total - faltan.length)) / total) / 10 : 0;

const porTipo = {};
for (const h of faltan) { const [i, c] = h.split(" "); const t = `${c.split("/")[0]} (${i})`; porTipo[t] = (porTipo[t] || 0) + 1; }

// Todas las páginas del sitemap responden 200 (de 6 en 6, sin agobiar).
const rotas = [];
const cola = [...locs];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cola.length) {
    const u = cola.shift();
    try {
      const r = await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(30000), headers: { "user-agent": "CostavivaEspejo/1.0" } });
      if (r.status !== 200) rotas.push(`${r.status} ${u}`);
      await r.arrayBuffer().catch(() => {});
    } catch (e) { rotas.push(`ERROR ${u} (${e.message})`); }
  }
}));

resumen(`## Espejo de idiomas (es/en/pt): ${pct} %`);
resumen(`- Páginas distintas: ${claves.size} × 3 idiomas = ${total}. Huecos: **${faltan.length}**${faltan.length ? "" : " — espejo al 100 %"}.`);
if (faltan.length) resumen(`- Por tipo: ${Object.entries(porTipo).map(([t, n]) => `${t}: ${n}`).join(", ")}.`);
resumen(`- Huecos nuevos (no anotados): **${nuevos.length}**.${nuevos.length ? "\n" + nuevos.slice(0, 50).map((h) => `  - ${h}`).join("\n") : ""}`);
resumen(`- Páginas del sitemap que no responden 200: **${rotas.length}**.${rotas.length ? "\n" + rotas.slice(0, 50).map((h) => `  - ${h}`).join("\n") : ""}`);
for (const h of nuevos) console.log(`::error::Sin espejo: ${h}`);
for (const r of rotas.slice(0, 20)) console.log(`::error::Página rota: ${r}`);
if (faltan.length) console.log(`::warning::Espejo al ${pct} %: quedan ${faltan.length} páginas por traducir.`);
process.exit(nuevos.length || rotas.length ? 1 : 0);
