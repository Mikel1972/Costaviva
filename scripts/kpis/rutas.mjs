// scripts/kpis/rutas.mjs — dónde viven los datos de los KPIs.
// Decisión de Mikel (2026-10-11): los KPIs son PRIVADOS. El histórico, KPIS.md,
// los SVG, el resumen, los cambios y el ranking de socios viven en el repo
// privado Mikel1972/comun, carpeta kpis/costaviva/, nunca en este repo público.
// Por defecto se espera el clon de comun al lado de este repo
// (/home/user/Costaviva y /home/user/comun, como en las rutinas); en el
// workflow kpis.yml se pasa KPIS_DIR.
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIR_KPIS = process.env.KPIS_DIR ? resolve(process.env.KPIS_DIR) : join(RAIZ, "..", "comun", "kpis", "costaviva");
export const RUTA_HISTORICO = join(DIR_KPIS, "historico.jsonl");
export const RUTA_CAMBIOS = join(DIR_KPIS, "cambios.jsonl");
