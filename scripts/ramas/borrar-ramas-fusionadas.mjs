// scripts/ramas/borrar-ramas-fusionadas.mjs
// Borra las ramas remotas cuyo contenido ya está en main. Copia exacta de
// comun/scripts/ramas/borrar-ramas-fusionadas.mjs (2026-10-22): las apps
// privadas usan el workflow reutilizable de comun, pero GitHub no deja a un
// repo público como Costaviva usar un workflow de un repo privado. Si cambia
// allí, cambiarlo aquí igual. Lo lanza .github/workflows/borrar-ramas.yml.
//
// Una rama se borra SOLO si se cumple todo:
//   - no es main;
//   - no tiene ninguna PR abierta;
//   - y su contenido ya está en main: o su último commit está dentro de main
//     (compare = "behind"/"identical"), o tiene una PR FUSIONADA cuyo último
//     commit es exactamente el de la rama (squash: el contenido entró).
// Sin IA. Con --probar solo lista. Usa GH_TOKEN y GITHUB_REPOSITORY.
import { execFileSync } from "node:child_process";

export function decidir(rama, { abiertas, fusionadas, comparacion }) {
  if (rama.name === "main") return "main";
  if (abiertas.has(rama.name)) return "PR abierta";
  if (["behind", "identical"].includes(comparacion)) return null;
  if (fusionadas.get(rama.name)?.has(rama.commit.sha)) return null;
  return "con cambios que no están en main";
}

function main() {
  const REPO = process.env.GITHUB_REPOSITORY;
  if (!REPO) throw new Error("Falta GITHUB_REPOSITORY");
  const PROBAR = process.argv.includes("--probar");
  const gh = (args) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  const paginar = (ruta) => {
    const out = [];
    for (let p = 1; p < 50; p++) {
      const r = gh([`${ruta}${ruta.includes("?") ? "&" : "?"}per_page=100&page=${p}`]);
      out.push(...r);
      if (r.length < 100) break;
    }
    return out;
  };
  const ramas = paginar(`repos/${REPO}/branches`);
  const prs = paginar(`repos/${REPO}/pulls?state=all`);
  const abiertas = new Set(prs.filter((p) => p.state === "open").map((p) => p.head.ref));
  const fusionadas = new Map();
  for (const p of prs.filter((p) => p.merged_at)) {
    if (!fusionadas.has(p.head.ref)) fusionadas.set(p.head.ref, new Set());
    fusionadas.get(p.head.ref).add(p.head.sha);
  }
  let borradas = 0, quedan = 0;
  for (const r of ramas) {
    let comparacion = null;
    if (r.name !== "main" && !abiertas.has(r.name) && !fusionadas.get(r.name)?.has(r.commit.sha)) {
      comparacion = gh([`repos/${REPO}/compare/main...${encodeURIComponent(r.name)}`]).status;
    }
    const motivo = decidir(r, { abiertas, fusionadas, comparacion });
    if (motivo) { quedan++; if (r.name !== "main") console.log(`se queda    ${r.name} (${motivo})`); continue; }
    if (!PROBAR) execFileSync("gh", ["api", "-X", "DELETE", `repos/${REPO}/git/refs/heads/${r.name}`]);
    borradas++;
    console.log(`${PROBAR ? "se borraría" : "borrada    "} ${r.name}`);
  }
  console.log(`\n${borradas} ramas ${PROBAR ? "se borrarían" : "borradas"}, ${quedan} se quedan (main incluida).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
