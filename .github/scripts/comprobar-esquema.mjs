#!/usr/bin/env node
// Vigía de esquema: compara el estado real de producción contra el baseline
// revisado, y avisa de cualquier diferencia que nadie haya aprobado.
//
// Portado de Pólizas.ai (.github/scripts/check-schema-drift.js, 2026-09-14),
// donde nació al encontrar una tabla con RLS activada en producción sin
// ninguna migración ni commit que lo explicara. Aquí se le añade la
// comprobación de migraciones, que es el incidente propio de este repo (ver
// la cabecera de esquema-seguridad-query.sql).
//
// PRINCIPIO, y es lo que lo hace útil: el vigía NO juzga si un cambio es
// bueno o malo, solo si está documentado. Una RLS que alguien activó a mano
// en producción salta igual que una que alguien desactivó — aunque el
// resultado sea MÁS seguro. Lo que se vigila es que nada entre sin pasar por
// una migración revisada.
//
// supabase/baseline-seguridad.json es el "estado conocido y revisado". Se
// actualiza SOLO como parte de un cambio deliberado, en el mismo commit que
// la migración que lo causa. Cualquier otra diferencia es, por definición,
// algo que nadie ha revisado.
//
// Este script solo compara y describe. Es el workflow el que decide avisar.

import fs from "node:fs";
import path from "node:path";

const [rutaLive, rutaBaseline, dirMigraciones] = process.argv.slice(2);

function normalizarTablas(tablas) {
  // Orden estable de tablas y de políticas dentro de cada una: que Postgres
  // devuelva las políticas en otro orden interno no es un cambio real, y
  // confundirlo con uno haría que el vigía gritara sin motivo (y entonces se
  // deja de mirar, que es la forma habitual de que un aviso muera).
  return [...(tablas || [])]
    .sort((a, b) => a.tablename.localeCompare(b.tablename))
    .map((t) => ({
      tablename: t.tablename,
      rls_enabled: t.rls_enabled,
      policies: [...(t.policies || [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ name: p.name, cmd: p.cmd, roles: [...(p.roles || [])].sort() })),
    }));
}

function diferenciasDeTablas(live, base) {
  const avisos = [];
  const porNombre = (arr) => new Map(arr.map((t) => [t.tablename, t]));
  const vivas = porNombre(live);
  const conocidas = porNombre(base);

  for (const [nombre, t] of vivas) {
    if (!conocidas.has(nombre)) {
      avisos.push(`Tabla NUEVA en producción, no está en el baseline: "${nombre}" (RLS ${t.rls_enabled ? "activada" : "DESACTIVADA"}, ${t.policies.length} políticas).`);
      continue;
    }
    const c = conocidas.get(nombre);
    if (t.rls_enabled !== c.rls_enabled) {
      avisos.push(`"${nombre}": RLS pasó de ${c.rls_enabled ? "activada" : "desactivada"} a ${t.rls_enabled ? "activada" : "DESACTIVADA"}.`);
    }
    const nombresVivos = new Set(t.policies.map((p) => p.name));
    const nombresConocidos = new Set(c.policies.map((p) => p.name));
    for (const p of t.policies) {
      if (!nombresConocidos.has(p.name)) avisos.push(`"${nombre}": política NUEVA sin revisar: "${p.name}" (${p.cmd}, roles: ${p.roles.join(", ") || "ninguno"}).`);
    }
    for (const p of c.policies) {
      if (!nombresVivos.has(p.name)) avisos.push(`"${nombre}": política DESAPARECIDA: "${p.name}". Si no fue deliberado, alguien ha quitado una protección.`);
    }
    // Una política con el mismo nombre pero distinto alcance es el cambio
    // más fácil de pasar por alto, y de los más peligrosos.
    for (const p of t.policies) {
      const previa = c.policies.find((x) => x.name === p.name);
      if (!previa) continue;
      if (previa.cmd !== p.cmd || previa.roles.join(",") !== p.roles.join(",")) {
        avisos.push(`"${nombre}": la política "${p.name}" CAMBIÓ de alcance: ${previa.cmd}/[${previa.roles.join(", ")}] -> ${p.cmd}/[${p.roles.join(", ")}].`);
      }
    }
  }
  for (const nombre of conocidas.keys()) {
    if (!vivas.has(nombre)) avisos.push(`Tabla del baseline que YA NO EXISTE en producción: "${nombre}".`);
  }
  return avisos;
}

function diferenciasDeMigraciones(aplicadas, dir) {
  // Las dos direcciones del desfase importan, y por motivos distintos:
  //  - En producción pero sin fichero: alguien aplicó algo a mano y no queda
  //    rastro revisable de qué hizo.
  //  - Con fichero pero sin aplicar: el repo dice una cosa y la base de datos
  //    hace otra; un despliegue puede depender de algo que no existe.
  const avisos = [];
  let ficheros = [];
  try {
    ficheros = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);
  } catch (e) {
    avisos.push(`No se pudo leer ${dir} (${e.message}); no se comprobaron las migraciones.`);
    return avisos;
  }
  const enProduccion = new Set(aplicadas || []);
  const enRepo = new Set(ficheros);

  for (const v of enProduccion) {
    if (!enRepo.has(v)) avisos.push(`Migración ${v} aplicada en producción pero SIN fichero en supabase/migrations/ — alguien tocó la base de datos sin dejar rastro revisable.`);
  }
  for (const v of enRepo) {
    if (!enProduccion.has(v)) avisos.push(`Migración ${v} existe como fichero pero NO consta aplicada en producción — o falta aplicarla, o se aplicó a mano y la CLI no se enteró (ver CLAUDE.md, 2026-09-20: 'supabase migration repair').`);
  }
  return avisos;
}

const live = JSON.parse(fs.readFileSync(rutaLive, "utf8"));
const tablasVivas = normalizarTablas(live.tablas);

// Arranque: sin baseline no hay nada contra qué comparar. Se crea con el
// estado actual y se dice MUY claro que no lo ha revisado nadie — bendecir
// el presente es el único punto de partida posible, pero no debe parecer una
// aprobación.
if (!fs.existsSync(rutaBaseline)) {
  fs.mkdirSync(path.dirname(rutaBaseline), { recursive: true });
  fs.writeFileSync(rutaBaseline, JSON.stringify({ tablas: tablasVivas, migraciones: live.migraciones || [] }, null, 2) + "\n");
  console.log("BASELINE_CREADO");
  console.log(`Creado ${rutaBaseline} con el estado actual de producción (${tablasVivas.length} tablas).`);
  console.log("NADIE lo ha revisado todavía: míralo antes de fiarte de él. A partir de la próxima pasada, cualquier diferencia contra este fichero se avisa.");
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(rutaBaseline, "utf8"));
const avisos = [
  ...diferenciasDeTablas(tablasVivas, normalizarTablas(baseline.tablas)),
  ...diferenciasDeMigraciones(live.migraciones, dirMigraciones),
];

if (!avisos.length) {
  console.log(`Sin cambios sin revisar: ${tablasVivas.length} tablas y ${(live.migraciones || []).length} migraciones cuadran con el baseline.`);
  process.exit(0);
}

console.log("DIFERENCIAS_ENCONTRADAS");
for (const a of avisos) console.log(`- ${a}`);
process.exit(1);
