// scripts/seo/efectividad.mjs — bloque «Efectividad y visitas (diario)» del
// informe diario (daily-report.yml). Sin IA y sin coste:
//   1. Visitas reales de ayer y de hoy (nuestro contador visitas_publicas).
//   2. Google día a día (Search Console, últimos días con datos, incluidos
//      los recientes todavía provisionales: dataState "all").
//   3. Efectividad de cada cambio de datos-robots/seo/medidas.json: 7 días
//      antes frente a los días desde el cambio, en media por día.
// Escribe el texto en stdout; si una parte falla lo dice y sigue con el resto.
// Credenciales: las de Google del paso de autenticación del informe (Workload
// Identity, sin clave) y SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sumarDias, diasEntre, totalesPaginas, lineaMedida, lineasDias, lineasVisitas } from "./efectividad-lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_SUPABASE = "https://imncbmizxkorotpeisic.supabase.co";
const VENTANA_MEDIDAS_DIAS = 60;
// Hora de Madrid a propósito: el informe sale a las 08:13 de España y «hoy»
// es el día de España (como el contador visitas_publicas).
const hoyMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

async function visitas(lineas) {
  lineas.push("  - Visitas reales a las páginas públicas (nuestro contador; el detalle en directo está en Cloudflare → Web Analytics):");
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return lineas.push("    - N/D (falta el secret SUPABASE_SERVICE_ROLE_KEY)");
  const hoy = hoyMadrid();
  try {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/visitas_publicas?select=dia,pagina,fuente,visitas&dia=gte.${sumarDias(hoy, -9)}`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    lineas.push(...lineasVisitas(await r.json(), hoy));
  } catch (e) {
    lineas.push(`    - N/D (no se pudo leer el contador: ${e.message})`);
    process.exitCode = 1;
  }
}

async function google(lineas) {
  let GoogleAuth;
  try {
    ({ GoogleAuth } = await import("google-auth-library"));
  } catch {
    lineas.push("  - Google: N/D (falta google-auth-library: npm ci en scripts/seo)");
    return;
  }
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
    const token = (await (await auth.getClient()).getAccessToken()).token;
    const cab = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const sites = await (await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: cab })).json();
    const sitio = sites.siteEntry?.[0]?.siteUrl;
    if (!sitio) throw new Error("la cuenta de servicio no ve ninguna propiedad");
    const cache = new Map();
    const consulta = async (desde, hasta, dimensions) => {
      const k = `${desde}|${hasta}|${dimensions.join(",")}`;
      if (!cache.has(k)) {
        cache.set(k, (async () => {
          const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/searchAnalytics/query`, {
            method: "POST", headers: cab,
            body: JSON.stringify({ startDate: desde, endDate: hasta, dimensions, rowLimit: 25000, dataState: "all" }),
          });
          if (!r.ok) throw new Error(`Search Console ${r.status}`);
          return (await r.json()).rows || [];
        })());
      }
      return cache.get(k);
    };

    const hoy = hoyMadrid();
    const dias = await consulta(sumarDias(hoy, -10), hoy, ["date"]);
    const ultimo = dias.map((f) => f.keys[0]).sort().pop();
    lineas.push(`  - Google día a día (Search Console; los 2 últimos días aún son provisionales y suben):`);
    lineas.push(...(dias.length ? lineasDias(dias.slice(-8)) : ["    - Sin datos en los últimos 10 días."]));

    const { medidas = [] } = JSON.parse(readFileSync(join(RAIZ, "datos-robots/seo/medidas.json"), "utf8"));
    const recientes = medidas.filter((m) => m.fecha >= sumarDias(hoy, -VENTANA_MEDIDAS_DIAS)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    lineas.push(`  - Efectividad de los cambios (7 días antes frente a los días desde el cambio, media por día):`);
    if (!recientes.length) lineas.push("    - Ningún cambio apuntado en los últimos 60 días (datos-robots/seo/medidas.json).");
    for (const m of recientes) {
      try {
        const antes = totalesPaginas(await consulta(sumarDias(m.fecha, -7), sumarDias(m.fecha, -1), ["page"]), m.paginas);
        const n = ultimo && ultimo >= m.fecha ? diasEntre(m.fecha, ultimo) : 0;
        const despues = n ? totalesPaginas(await consulta(m.fecha, ultimo, ["page"]), m.paginas) : null;
        lineas.push(lineaMedida(m, antes, despues, n));
      } catch (e) {
        lineas.push(`    - ${m.titulo}: N/D (${e.message})`);
      }
    }
  } catch (e) {
    lineas.push(`  - Google: N/D (${e.message})`);
    process.exitCode = 1;
  }
}

const lineas = [];
await visitas(lineas);
await google(lineas);
console.log(lineas.join("\n"));
