// scripts/marketing/publicar-con-veto.mjs
// Publicación automática con veto de 12 h (Mikel, 2026-10-11). Lo corre
// publicar-con-veto.yml cada 30 min (pg_cron y, de respaldo, `schedule:`).
// Decide con veto.mjs y publica con publicar-pieza.mjs, la misma lógica que
// el workflow manual "Publicar post de Instagram". Como mucho una pieza por
// pasada.
//
// Entorno: PUBLICACION_AUTOMATICA (variable de repo; sin "true" no hace
// nada), GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER,
// META_PAGE_ACCESS_TOKEN (secret), META_IG_BUSINESS_ACCOUNT_ID, META_PAGE_ID.
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { extraerPieza } from "./pieza-issue.mjs";
import { decidir, ajustarPorToken, textoRedes, marcaAviso, yaAvisado, ETIQUETA_REVISAR } from "./veto.mjs";
import { consultarToken } from "./estado-token.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.GITHUB_REPOSITORY || "Mikel1972/Costaviva";
const DUENO = process.env.GITHUB_REPOSITORY_OWNER || REPO.split("/")[0];
const AUTOMATICA = process.env.PUBLICACION_AUTOMATICA || "";

const gh = (args) => execFileSync("gh", args, { encoding: "utf8" });

function leerJsonl(fichero) {
  const ruta = join(__dirname, fichero);
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
}

function comentar(numero, texto) {
  gh(["issue", "comment", String(numero), "--body", texto]);
}

function salida(clave, valor) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

async function main() {
  if (AUTOMATICA.trim().toLowerCase() !== "true") {
    console.log("PUBLICACION_AUTOMATICA no es \"true\": no se publica nada solo.");
    return;
  }
  const issues = JSON.parse(gh(["issue", "list", "--repo", REPO, "--label", "marketing", "--state", "open", "--limit", "50", "--json", "number,body,labels,createdAt,state"]))
    .sort((a, b) => a.number - b.number);
  const publicados = {
    // Las líneas antiguas de Instagram no llevan "red".
    instagram: leerJsonl("posts-publicados.jsonl").filter((p) => !p.red || p.red === "instagram"),
    facebook: leerJsonl("posts-facebook.jsonl"),
  };
  let token = null;
  let publicadas = 0;

  for (const issue of issues) {
    // Un Issue de pieza no llega a 100 comentarios.
    const comentarios = JSON.parse(gh(["api", `repos/${REPO}/issues/${issue.number}/comments?per_page=100`]))
      .map((c) => ({ autor: c.user?.login || "", cuerpo: c.body || "" }));
    const etiquetas = (issue.labels || []).map((l) => l.name);
    let d = decidir({
      issue: issue.number, pieza: extraerPieza(issue.body), etiquetas, comentarios, dueno: DUENO,
      creado: issue.createdAt, abierto: issue.state === "OPEN", ahora: new Date(), automatica: AUTOMATICA, publicados,
    });
    if (d.accion === "publicar") {
      token ??= await consultarToken({ token: process.env.META_PAGE_ACCESS_TOKEN, igId: process.env.META_IG_BUSINESS_ACCOUNT_ID, pageId: process.env.META_PAGE_ID });
      d = ajustarPorToken(d, token);
    }
    console.log(`#${issue.number}: ${d.accion} (${d.motivo})${d.redes.length ? ` -> ${d.redes.join(" + ")}` : ""}`);

    if (d.vetada && !yaAvisado(comentarios, "vetada")) {
      comentar(issue.number, `🛑 Vetada (${d.motivo.replace(/^vetada \(|\)$/g, "")}): no se publicará sola. Si cambias de idea, publícala a mano con **Publicar post de Instagram**.\n\n${marcaAviso("vetada")}`);
    }
    if (d.accion === "avisar") {
      if (!yaAvisado(comentarios, d.clave)) {
        comentar(issue.number, [`⚠️ No se ha publicado sola: ${d.motivo}.`, ...d.notas, "", "Puedes publicarla a mano con **Publicar post de Instagram** si todo está bien.", "", marcaAviso(d.clave)].join("\n"));
      }
      if (d.revisar) gh(["issue", "edit", String(issue.number), "--add-label", ETIQUETA_REVISAR]);
      continue;
    }
    if (d.accion !== "publicar" || publicadas > 0) continue;

    // Publicar con la misma lógica que el workflow manual.
    const dir = mkdtempSync(join(tmpdir(), "veto-"));
    const salidaHija = join(dir, "salida.txt");
    const r = spawnSync("node", [join(__dirname, "publicar-pieza.mjs")], {
      env: { ...process.env, ISSUE_NUMBER: String(issue.number), REDES: textoRedes(d.redes), CREATION_ID: "", GITHUB_OUTPUT: salidaHija },
      encoding: "utf8", stdio: ["ignore", "inherit", "inherit"],
    });
    const out = existsSync(salidaHija) ? readFileSync(salidaHija, "utf8") : "";
    const resumen = (out.match(/resumen<<FIN_RESUMEN\n([\s\S]*?)\nFIN_RESUMEN/) || [])[1] || "❌ No se pudo publicar (mira el log del workflow).";
    const fallos = Number((out.match(/^fallos=(\d+)/m) || [])[1] ?? 1);
    const hechos = Number((out.match(/^hechos=(\d+)/m) || [])[1] ?? 0);
    publicadas += hechos > 0 ? 1 : 0;
    salida("publicadas", publicadas);
    const texto = [
      "🤖 **Publicación automática**: nadie la vetó en las 12 h de aviso.",
      "",
      resumen,
      ...(d.notas.length ? ["", ...d.notas.map((n) => `- ${n}`)] : []),
    ].join("\n");
    comentar(issue.number, texto);
    if (r.status === 0 && fallos === 0) {
      gh(["issue", "close", String(issue.number), "--reason", "completed"]);
    } else {
      // Algo falló: no se reintenta solo, decide Mikel.
      gh(["issue", "edit", String(issue.number), "--add-label", ETIQUETA_REVISAR]);
    }
  }
  console.log(`Publicadas en esta pasada: ${publicadas}`);
}

main().catch((e) => {
  console.error("Fallo en la publicación automática:", e.message);
  process.exit(1);
});
