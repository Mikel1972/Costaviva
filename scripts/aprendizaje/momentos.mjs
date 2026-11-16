// scripts/aprendizaje/momentos.mjs
// Momentos de actividad (2026-11-16, Mikel: "que saque o no el pez aporta
// más datos, pero saber en qué momento y condiciones pica / saco el pez
// prescribe lo mismo"; "para el robot, debes guardar marea, luna, etc...").
// Cada picada (picadas_pesca) y cada captura con hora es un MOMENTO con su
// marea y, en las picadas, sus condiciones. El aprendizaje los agrupa por
// marea (sube/baja), por franja horaria y por fase de luna. Solo se
// publican los grupos con gente suficiente (privacidad: nunca lugar ni fecha).
// Sin IA. Test en test/aprendizaje-momentos.test.js.

export const CONFIG_MOMENTOS = { min_personas: 3 };

// Franja de 3 h de la hora local "HH:MM[:SS]".
export function franja(hora) {
  const m = String(hora || "").match(/^(\d{1,2}):/);
  const h = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  const a = Math.floor(h / 3) * 3;
  return `${String(a).padStart(2, "0")}-${String(a + 3).padStart(2, "0")}`;
}

// Momentos de una salida a partir de sus picadas y capturas con hora.
export function momentosSalida(picadas = [], capturas = []) {
  const out = [];
  for (const p of picadas) {
    if (!p?.hora) continue;
    const c = p.condiciones && typeof p.condiciones === "object" ? p.condiciones : {};
    out.push({ tipo: "picada", hora: String(p.hora).slice(0, 5), marea_tendencia: p.marea_tendencia || null,
      marea_altura: p.marea_altura ?? null, luna_fase: c.luna_fase ?? null, presion_tendencia: c.presion_tendencia ?? null, condiciones: c });
  }
  for (const k of capturas) {
    if (!k?.hora) continue;
    out.push({ tipo: "captura", hora: String(k.hora).slice(0, 5), marea_tendencia: k.marea_tendencia || null,
      marea_altura: k.marea_altura ?? null, luna_fase: null, presion_tendencia: null, condiciones: {} });
  }
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}

// Recuento por variable (marea, franja, luna, presión) de picadas y capturas,
// con cuántas personas distintas hay detrás de cada valor.
export function agruparMomentos(casos, cfg = CONFIG_MOMENTOS) {
  const grupos = new Map();
  const sumar = (variable, valor, tipo, usuario) => {
    if (valor === null || valor === undefined || valor === "") return;
    const k = `${variable}|${valor}`;
    if (!grupos.has(k)) grupos.set(k, { variable, valor, picadas: 0, capturas: 0, personas: new Set() });
    const g = grupos.get(k);
    g[tipo === "picada" ? "picadas" : "capturas"]++;
    g.personas.add(usuario);
  };
  for (const c of casos) {
    for (const m of c.momentos || []) {
      sumar("marea", m.marea_tendencia, m.tipo, c.usuario);
      sumar("franja", franja(m.hora), m.tipo, c.usuario);
      sumar("luna", m.luna_fase, m.tipo, c.usuario);
      sumar("presion", m.presion_tendencia, m.tipo, c.usuario);
    }
  }
  const todos = [...grupos.values()].map((g) => ({ variable: g.variable, valor: g.valor, picadas: g.picadas, capturas: g.capturas, personas: g.personas.size }));
  return {
    total_momentos: casos.reduce((n, c) => n + (c.momentos?.length || 0), 0),
    grupos: todos.filter((g) => g.personas >= cfg.min_personas).sort((a, b) => a.variable.localeCompare(b.variable) || String(a.valor).localeCompare(String(b.valor))),
    grupos_retenidos: todos.filter((g) => g.personas < cfg.min_personas).length,
  };
}
