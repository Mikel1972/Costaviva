// Guardas de migraciones (incidente del 2026-10-11).
//
// Mikel aprobó UNA migración (20261011230000_cobro_prueba_14_dias_plan_gratis)
// y al lanzar aplicar-migraciones.yml se aplicaron también otras dos que otros
// agentes habían fusionado en main sin su "sí": `supabase db push` aplica
// TODAS las pendientes. Regla de Mikel: "Claude pregunta, Claude ejecuta"; no
// se aplica SQL sin su sí. Dos cerrojos, lógica pura aquí (sin red):
//
//   guardia  -> check `migraciones-aprobadas` en cada PR: si la PR añade o
//               modifica algo en supabase/migrations/, falla salvo que lleve
//               la etiqueta `sql-aprobado` (la pone el Claude principal tras
//               el sí de Mikel).
//   pendientes -> aplicar-migraciones.yml: lo pendiente en producción tiene
//               que ser EXACTAMENTE la migración aprobada (input `migracion`).
//               Si hay otra, falla sin tocar nada y las lista.
//
// Uso desde los workflows:
//   node .github/scripts/migraciones.mjs guardia <ficheros.txt> '<etiquetas JSON>'
//   node .github/scripts/migraciones.mjs pendientes <migracion> <aplicadas.txt>
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CARPETA = "supabase/migrations/";
export const ETIQUETA = "sql-aprobado";

// Ficheros de la PR que caen en supabase/migrations/.
export function migracionesTocadas(ficheros) {
  return ficheros.map((f) => f.trim()).filter((f) => f.startsWith(CARPETA));
}

export function decidirGuardia({ ficheros, etiquetas }) {
  const tocadas = migracionesTocadas(ficheros);
  if (tocadas.length === 0) {
    return { ok: true, tocadas, mensaje: "La PR no toca supabase/migrations/: nada que aprobar." };
  }
  if (etiquetas.includes(ETIQUETA)) {
    return { ok: true, tocadas, mensaje: `La PR toca migraciones y lleva la etiqueta '${ETIQUETA}' (sí de Mikel).` };
  }
  return {
    ok: false,
    tocadas,
    mensaje:
      `La PR añade o modifica migraciones y no lleva la etiqueta '${ETIQUETA}'. ` +
      "Enseña el SQL a Mikel y espera su sí; después el Claude principal pone la etiqueta y el check se reevalúa solo.",
  };
}

// La versión de una migración es lo que va antes del primer "_" (como la CLI).
export function version(fichero) {
  const base = fichero.split("/").pop();
  const m = /^(\d+)_.+\.sql$/.exec(base);
  return m ? m[1] : null;
}

export function calcularPendientes({ enRepo, aplicadas }) {
  const hechas = new Set(aplicadas.map((v) => v.trim()).filter(Boolean));
  return enRepo.filter((f) => version(f) && !hechas.has(version(f))).sort();
}

export function decidirAplicar({ migracion, enRepo, aplicadas }) {
  const nombre = (migracion || "").trim();
  if (!nombre) return { ok: false, pendientes: [], mensaje: "Falta el input 'migracion' (nombre exacto del fichero)." };
  if (!enRepo.includes(nombre)) {
    return { ok: false, pendientes: [], mensaje: `'${nombre}' no existe en ${CARPETA} de esta rama. Pon el nombre exacto del fichero, con .sql.` };
  }
  const pendientes = calcularPendientes({ enRepo, aplicadas });
  if (!pendientes.includes(nombre)) {
    return { ok: false, pendientes, mensaje: `'${nombre}' ya consta aplicada en producción. No se ha tocado nada.` };
  }
  const otras = pendientes.filter((f) => f !== nombre);
  if (otras.length > 0) {
    return {
      ok: false,
      pendientes,
      mensaje:
        `Hay ${otras.length} migración(es) pendiente(s) además de la aprobada; supabase db push las aplicaría todas. ` +
        `No se ha tocado nada. Otras pendientes: ${otras.join(", ")}`,
    };
  }
  return { ok: true, pendientes, mensaje: `Solo está pendiente la aprobada: ${nombre}.` };
}

function main(argv) {
  const [modo, a, b] = argv;
  if (modo === "guardia") {
    const ficheros = readFileSync(a, "utf8").split("\n").filter(Boolean);
    const etiquetas = JSON.parse(b || "[]");
    const d = decidirGuardia({ ficheros, etiquetas });
    if (d.tocadas.length) console.log("Migraciones tocadas por la PR:\n  " + d.tocadas.join("\n  "));
    console.log(d.ok ? d.mensaje : `::error::${d.mensaje}`);
    return d.ok ? 0 : 1;
  }
  if (modo === "pendientes") {
    const enRepo = readdirSync(CARPETA).filter((f) => f.endsWith(".sql"));
    const aplicadas = readFileSync(b, "utf8").split("\n");
    const d = decidirAplicar({ migracion: a, enRepo, aplicadas });
    if (d.pendientes.length) console.log("Pendientes en producción:\n  " + d.pendientes.join("\n  "));
    console.log(d.ok ? d.mensaje : `::error::${d.mensaje}`);
    return d.ok ? 0 : 1;
  }
  console.error("Uso: migraciones.mjs guardia <ficheros.txt> '<etiquetas JSON>' | pendientes <migracion> <aplicadas.txt>");
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exit(main(process.argv.slice(2)));
}
