// scripts/seo/indexnow.mjs
// Avisa por IndexNow (Bing, Yandex, Seznam, Naver, Yep) de las URLs públicas
// que han cambiado. Sin IA, sin cuenta y sin dependencias: solo git y fetch.
// Lo corre .github/workflows/indexnow.yml; la lógica está en
// functions/_lib/seo/indexnow.js (test/indexnow.test.js).
//
//   node scripts/seo/indexnow.mjs cambios --antes <sha> [--despues <sha>]
//       URLs afectadas por los ficheros cambiados entre dos commits y las
//       nuevas o con lastmod distinto en sitemap.xml. Si <sha> no existe
//       (primer push, historial reescrito) avisa de TODAS.
//   node scripts/seo/indexnow.mjs hoy      # /spots/<spot> y /mareas/<spot>
//   node scripts/seo/indexnow.mjs todas    # todo el sitemap.xml
//
//   --probar   enseña lo que mandaría, sin mandar nada
//   --esperar  antes de mandar, espera a que costaviva.org sirva la clave y
//              el mismo sitemap.xml que el repo (el despliegue ha terminado)
import { readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  API_INDEXNOW, CLAVE_INDEXNOW, FICHERO_CLAVE, ORIGEN, urlsDeCambios, urlsCondicionesHoy, todasLasUrls,
  peticionesIndexNow, interpretarRespuesta,
} from "../../functions/_lib/seo/indexnow.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const modo = args[0];
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const probar = args.includes("--probar");
const resumen = (t) => {
  console.log(t);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${t}\n`);
};
const git = (...a) => execFileSync("git", a, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const xmlActual = readFileSync(join(RAIZ, "sitemap.xml"), "utf8");

function urlsSegunModo() {
  if (modo === "hoy") return urlsCondicionesHoy(xmlActual);
  if (modo === "todas") return todasLasUrls(xmlActual);
  if (modo === "cambios") {
    const antes = opcion("--antes");
    const despues = opcion("--despues") || "HEAD";
    let existe = false;
    if (antes && !/^0+$/.test(antes)) {
      try {
        git("cat-file", "-e", `${antes}^{commit}`);
        existe = true;
      } catch { /* no está en el clon */ }
    }
    if (!existe) {
      resumen(`Sin commit anterior válido (${antes || "ninguno"}): se avisa de todas las URLs del sitemap.`);
      return todasLasUrls(xmlActual);
    }
    const ficheros = git("diff", "--name-only", antes, despues).split("\n").filter(Boolean);
    let xmlAntes = "";
    try { xmlAntes = git("show", `${antes}:sitemap.xml`); } catch { /* no existía */ }
    return urlsDeCambios({ ficheros, xmlAntes, xmlDespues: xmlActual });
  }
  console.error("Uso: node scripts/seo/indexnow.mjs cambios|hoy|todas [--antes <sha>] [--probar] [--esperar]");
  process.exit(2);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function textoDe(url) {
  try {
    const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
    return { status: r.status, tipo: r.headers.get("content-type") || "", texto: await r.text() };
  } catch (e) {
    return { status: 0, tipo: "", texto: String(e) };
  }
}

// Cloudflare Pages tarda 1-3 min en desplegar tras el push: si avisamos
// antes, el buscador puede leer la página vieja o no encontrar la clave.
async function esperarDespliegue(maxMin = 12) {
  const fin = Date.now() + maxMin * 60_000;
  while (Date.now() < fin) {
    const clave = await textoDe(`${ORIGEN}${FICHERO_CLAVE}?_=${Date.now()}`);
    const sitemap = await textoDe(`${ORIGEN}/sitemap.xml?_=${Date.now()}`);
    const claveOk = clave.status === 200 && clave.texto.trim() === CLAVE_INDEXNOW && clave.tipo.startsWith("text/plain");
    if (claveOk && sitemap.texto === xmlActual) {
      console.log("Despliegue listo: clave y sitemap.xml servidos como en el repo.");
      await pausa(60_000); // margen para que acabe de propagarse el resto
      return true;
    }
    console.log(`Esperando el despliegue (clave ${clave.status} ${clave.tipo}, sitemap ${sitemap.texto === xmlActual ? "igual" : "distinto"})...`);
    await pausa(30_000);
  }
  return false;
}

const urls = urlsSegunModo();
const lotes = peticionesIndexNow(urls);
resumen(`### IndexNow (${modo})\n\n${urls.length} URL(s) para avisar.`);
if (!lotes.length) {
  resumen("Nada que avisar.");
  process.exit(0);
}
for (const u of lotes[0].urlList.slice(0, 15)) console.log(`  ${u}`);
if (lotes[0].urlList.length > 15) console.log(`  ... y ${urls.length - 15} más`);
if (probar) {
  resumen("Modo --probar: no se ha mandado nada.");
  process.exit(0);
}
if (args.includes("--esperar") && !(await esperarDespliegue())) {
  resumen("::error::costaviva.org no sirve todavía la clave o el sitemap.xml del repo: no se avisa (se reintentará en el siguiente push o mañana).");
  process.exit(1);
}

let fallos = 0;
for (const [i, cuerpo] of lotes.entries()) {
  let status = 0;
  let texto = "";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(API_INDEXNOW, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(cuerpo),
      });
      status = r.status;
      texto = (await r.text()).slice(0, 300);
    } catch (e) {
      status = 0;
      texto = String(e);
    }
    if (status !== 0 && status < 500) break;
    await pausa(10_000 * intento);
  }
  const { ok, texto: significado } = interpretarRespuesta(status);
  resumen(`- Lote ${i + 1}/${lotes.length}: ${cuerpo.urlList.length} URLs → **HTTP ${status}** (${significado})${texto ? ` ${texto.replace(/\s+/g, " ")}` : ""}`);
  if (!ok) fallos++;
}
process.exit(fallos ? 1 : 0);
