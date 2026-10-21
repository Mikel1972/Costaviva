// scripts/seo/fusion-automatica.mjs
// Fusión automática de las PR del robot de SEO (Mikel, 2026-10-11: que el
// robot de SEO trabaje de forma autónoma). Lo corre fusion-robot-seo.yml
// cuando los tests de la rama salen en verde. Sin IA.
//
// Solo se fusionan solas (squash) las PR de:
//   robot/palabras-*        páginas públicas generadas, metadatos,
//                           datos-robots/** y seo/**; máx. 3 a la semana.
//   robot/etiquetas-olas-*  solo datos-robots/oleaje-camaras/**.
// y solo si TODOS los ficheros cambiados están en su lista blanca y todos los
// checks están en verde. Si algún fichero queda fuera, la PR se queda abierta
// con la etiqueta "revisar". Nunca: cobro, login, suscripción,
// supabase/migrations ni .github/workflows (la lista negra gana siempre).
// Lógica pura exportada: test/fusion-robot.test.js.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ETIQUETA_FUSION = "fusion-automatica";
export const ETIQUETA_REVISAR = "revisar";
export const MAX_PALABRAS_SEMANA = 3;

// Lista negra: gana a cualquier lista blanca.
export const PROHIBIDOS = [
  /^\.github\//,
  /^supabase\//,
  /^functions\/_middleware\.js$/,
  /^functions\/_lib\/(?!seo\/)/, // de functions/_lib solo valen las piezas de SEO de abajo
  /cobro|login|suscripci|stripe|checkout|auth|pago|referido|invitaci|admin/i,
  /(^|\/)\.\.(\/|$)/,
];

export const LISTA_BLANCA = {
  palabras: [
    // Páginas públicas generadas (mareas, spots, especies, inglés para NZ,
    // técnicas nuevas).
    /^functions\/(mareas|spots|especies|en|tecnicas)\/[A-Za-z0-9_.\-[\]/]+\.js$/,
    // Metadatos: plantillas de las páginas públicas y el sitemap.
    /^functions\/_lib\/seo\/(paginas|paginas-en|datos|sitemap)\.js$/,
    /^sitemap\.xml$/,
    /^robots\.txt$/,
    /^datos-robots\//,
    /^seo\//,
  ],
  etiquetasOlas: [/^datos-robots\/oleaje-camaras\//],
};

// Ficheros de solo añadir líneas (una por etiqueta). Si dos pasadas de la
// rutina añaden a la vez, la PR choca con main aunque no haya nada que
// decidir (2026-10-21, PR #286 tras #283): se juntan las líneas de las dos.
export const SOLO_ANADIR = new Set(["datos-robots/oleaje-camaras/etiquetas-claude.jsonl"]);

// main + las líneas que la rama añadió respecto a la base común y main aún
// no tiene, en el orden de la rama. Puro: test/fusion-robot.test.js.
export function unirLineas(base, rama, main) {
  const lineas = (t) => String(t || "").split("\n").filter((l) => l.trim());
  const enBase = new Set(lineas(base)), enMain = new Set(lineas(main));
  const nuevas = lineas(rama).filter((l) => !enBase.has(l) && !enMain.has(l));
  const m = lineas(main);
  return [...m, ...nuevas].join("\n") + "\n";
}

export function tipoRama(rama) {
  if (/^robot\/palabras-/.test(rama)) return "palabras";
  if (/^robot\/etiquetas-olas-/.test(rama)) return "etiquetasOlas";
  return null;
}

// ficheros: rutas cambiadas (incluido el nombre anterior de los renombrados).
export function clasificar(tipo, ficheros) {
  const blanca = LISTA_BLANCA[tipo];
  if (!blanca) return { ok: false, fuera: [...ficheros], motivo: "rama sin fusión automática" };
  const lista = [...new Set(ficheros.map(String))];
  if (!lista.length) return { ok: false, fuera: [], motivo: "la PR no cambia ningún fichero" };
  const fuera = lista.filter((f) => PROHIBIDOS.some((r) => r.test(f)) || !blanca.some((r) => r.test(f)));
  return { ok: fuera.length === 0, fuera };
}

// Fusiones automáticas de palabras en los últimos 7 días.
export function cabeEnSemana(fusionadas = [], ahora = new Date(), max = MAX_PALABRAS_SEMANA) {
  const desde = ahora.getTime() - 7 * 24 * 3600 * 1000;
  const n = fusionadas.filter((p) => /^robot\/palabras-/.test(p.headRefName || "") && p.mergedAt && new Date(p.mergedAt).getTime() >= desde).length;
  return { cabe: n < max, n };
}

// checkRuns: [{ name, status, conclusion, runId }]; estados: [{ context, state }].
// propio: id del run de este workflow (sus checks no cuentan: se esperaría a
// sí mismo). Devuelve "verde", "esperando" o "rojo".
const BUENAS = new Set(["success", "neutral", "skipped"]);
export function estadoChecks(checkRuns = [], estados = [], propio = "") {
  const runs = checkRuns.filter((c) => !propio || String(c.runId || "") !== String(propio));
  if (runs.some((c) => c.status === "completed" && !BUENAS.has(c.conclusion))) return "rojo";
  if (estados.some((s) => s.state === "failure" || s.state === "error")) return "rojo";
  if (runs.some((c) => c.status !== "completed") || estados.some((s) => s.state === "pending")) return "esperando";
  if (!runs.length) return "esperando";
  return "verde";
}

export const MARCA = (clave) => `<!-- fusion-auto:${clave} -->`;

// ---------------------------------------------------------------------------
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function comentarUnaVez(repo, pr, clave, texto) {
  const previos = JSON.parse(gh(["api", `repos/${repo}/issues/${pr}/comments?per_page=100`]));
  if (previos.some((c) => String(c.body || "").includes(MARCA(clave)))) return;
  gh(["pr", "comment", String(pr), "--repo", repo, "--body", `${texto}\n\n${MARCA(clave)}`]);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const rama = process.env.RAMA || "";
  const sha = process.env.SHA || "";
  const propio = process.env.GITHUB_RUN_ID || "";
  const tipo = tipoRama(rama);
  if (!tipo) return console.log(`${rama}: sin fusión automática.`);

  // La PR la abre robot-diseno-pr.yml al recibir el push: se espera un poco.
  let pr = null;
  for (let i = 0; i < 10 && !pr; i++) {
    pr = JSON.parse(gh(["pr", "list", "--repo", repo, "--head", rama, "--state", "open", "--json", "number,headRefOid"]))[0] || null;
    if (!pr) await dormir(30000);
  }
  if (!pr) return console.log(`No hay PR abierta para ${rama}: nada que fusionar.`);
  if (sha && pr.headRefOid !== sha) return console.log(`La rama ha avanzado (${pr.headRefOid}); se encargará la pasada de ese commit.`);

  const ficheros = gh(["api", "--paginate", `repos/${repo}/pulls/${pr.number}/files?per_page=100`, "--jq", ".[] | .filename, (.previous_filename // empty)"])
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const c = clasificar(tipo, ficheros);
  if (!c.ok) {
    gh(["label", "create", ETIQUETA_REVISAR, "--repo", repo, "--color", "FBCA04", "--description", "Necesita revisión humana", "--force"]);
    gh(["pr", "edit", String(pr.number), "--repo", repo, "--add-label", ETIQUETA_REVISAR]);
    comentarUnaVez(repo, pr.number, "fuera", [
      "🔍 **No se fusiona sola**: cambia ficheros fuera de la lista blanca del robot (`scripts/seo/fusion-automatica.mjs`). Revísala tú.",
      "", ...c.fuera.map((f) => `- \`${f}\``), ...(c.motivo ? [c.motivo] : []),
    ].join("\n"));
    return console.log(`Fuera de la lista blanca: ${c.fuera.join(", ")}`);
  }

  if (tipo === "palabras") {
    const fusionadas = JSON.parse(gh(["pr", "list", "--repo", repo, "--state", "merged", "--label", ETIQUETA_FUSION, "--limit", "50", "--json", "headRefName,mergedAt"]));
    const s = cabeEnSemana(fusionadas);
    if (!s.cabe) {
      comentarUnaVez(repo, pr.number, "limite", `⏸️ No se fusiona sola: ya van ${s.n} fusiones automáticas de palabras clave en 7 días (máximo ${MAX_PALABRAS_SEMANA}). Queda abierta para ti.`);
      return console.log("Límite semanal alcanzado.");
    }
  }

  // Todos los checks del commit en verde (tests, preview de Cloudflare...).
  let estado = "esperando";
  for (let i = 0; i < 80; i++) {
    const runs = JSON.parse(gh(["api", `repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100`])).check_runs
      .map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion, runId: (String(r.details_url || "").match(/\/actions\/runs\/(\d+)/) || [])[1] }));
    const estados = JSON.parse(gh(["api", `repos/${repo}/commits/${pr.headRefOid}/status`])).statuses || [];
    estado = estadoChecks(runs, estados, propio);
    if (estado !== "esperando") break;
    await dormir(30000);
  }
  if (estado !== "verde") {
    comentarUnaVez(repo, pr.number, `checks-${pr.headRefOid}`, `⏸️ No se fusiona sola: los checks ${estado === "rojo" ? "han fallado" : "no terminaron en 40 min"}. Queda abierta.`);
    return console.log(`Checks: ${estado}`);
  }

  // Choque con main solo en ficheros de solo añadir: se juntan las líneas en
  // un commit de unión en la rama y se fusiona ese commit. Lo que se añade es lo
  // mismo que ya pasó los checks, encima del main actual.
  let cabeza = pr.headRefOid;
  let estadoFusion = null;
  for (let i = 0; i < 6 && estadoFusion === null; i++) {   // GitHub lo calcula en segundo plano
    estadoFusion = JSON.parse(gh(["api", `repos/${repo}/pulls/${pr.number}`])).mergeable;
    if (estadoFusion === null) await dormir(5000);
  }
  if (estadoFusion === false && tipo === "etiquetasOlas" && ficheros.every((f) => SOLO_ANADIR.has(f))) {
    const base = JSON.parse(gh(["api", `repos/${repo}/compare/main...${rama}`])).merge_base_commit.sha;
    const leer = (ref, f) => {
      try { return Buffer.from(JSON.parse(gh(["api", `repos/${repo}/contents/${f}?ref=${ref}`])).content, "base64").toString("utf8"); }
      catch { return ""; }
    };
    // Commit de UNIÓN (padres: la rama y main), no un simple cambio del
    // fichero: si no, GitHub sigue viendo el choque contra la base antigua
    // (2026-10-21, primer intento con #286). Árbol = el de main con los
    // ficheros unidos (la rama no toca nada más: lo exige SOLO_ANADIR).
    const api = (metodo, ruta, cuerpo) => JSON.parse(execFileSync("gh", ["api", "-X", metodo, ruta, "--input", "-"], { encoding: "utf8", input: JSON.stringify(cuerpo) }));
    const mainSha = JSON.parse(gh(["api", `repos/${repo}/git/ref/heads/main`])).object.sha;
    const mainArbol = JSON.parse(gh(["api", `repos/${repo}/git/commits/${mainSha}`])).tree.sha;
    const entradas = ficheros.map((f) => ({
      path: f, mode: "100644", type: "blob",
      sha: api("POST", `repos/${repo}/git/blobs`, { content: Buffer.from(unirLineas(leer(base, f), leer(rama, f), leer(mainSha, f))).toString("base64"), encoding: "base64" }).sha,
    }));
    const arbol = api("POST", `repos/${repo}/git/trees`, { base_tree: mainArbol, tree: entradas }).sha;
    cabeza = api("POST", `repos/${repo}/git/commits`, { message: "Unir con main (etiquetas: solo añadir líneas)", tree: arbol, parents: [pr.headRefOid, mainSha] }).sha;
    api("PATCH", `repos/${repo}/git/refs/heads/${rama}`, { sha: cabeza, force: false });
    await dormir(5000);
    console.log(`Choque solo en ficheros de solo añadir: líneas unidas en ${cabeza}.`);
  }

  gh(["label", "create", ETIQUETA_FUSION, "--repo", repo, "--color", "0E8A16", "--description", "Fusionada sola por el robot (lista blanca + checks en verde)", "--force"]);
  gh(["pr", "edit", String(pr.number), "--repo", repo, "--add-label", ETIQUETA_FUSION]);
  gh(["pr", "merge", String(pr.number), "--repo", repo, "--squash", "--match-head-commit", cabeza]);
  gh(["pr", "comment", String(pr.number), "--repo", repo, "--body", `🤖 Fusionada sola (squash): todos los ficheros en la lista blanca de \`${tipo === "palabras" ? "robot/palabras-*" : "robot/etiquetas-olas-*"}\` y todos los checks en verde.`]);
  console.log(`PR #${pr.number} fusionada.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("Fallo en la fusión automática:", e.message);
    process.exit(1);
  });
}
