// scripts/aprendizaje/momentos.mjs
// Momentos de actividad (2026-11-16, Mikel: "que saque o no el pez aporta
// más datos, pero saber en qué momento y condiciones pica / saco el pez
// prescribe lo mismo"; "para el robot, debes guardar marea, luna, etc...").
// Cada picada (picadas_pesca) y cada captura con hora es un MOMENTO con su
// marea y, en las picadas, sus condiciones. El aprendizaje los agrupa por
// marea (sube/baja), por franja horaria, por fase de luna, por momento del
// sol (día / crepúsculo / noche) y por periodo solunar (sol-luna.js). Solo se
// publican los grupos con gente suficiente (privacidad: nunca lugar ni fecha).
// Sin IA. Test en test/aprendizaje-momentos.test.js.

import { solLuna } from "../../assets/js/sol-luna.js";
import { msDeEtiqueta, zonaPorCoordenadas } from "../../assets/js/regiones.js";

export const CONFIG_MOMENTOS = { min_personas: 3 };

// Sol y Luna de un momento (assets/js/sol-luna.js), con la fecha de la
// salida: si la hora es anterior a la de inicio, la jornada cruzó la
// medianoche. Así también las capturas antiguas tienen sol y luna.
function solLunaMomento(salida, hora) {
  if (!salida || !Number.isFinite(Number(salida.lat)) || !Number.isFinite(Number(salida.lon)) || !salida.fecha) return {};
  const inicio = salida.hora_inicio ? String(salida.hora_inicio).slice(0, 5) : null;
  let fecha = salida.fecha;
  if (inicio && hora < inicio) {
    const d = new Date(Date.parse(`${fecha}T12:00:00Z`) + 864e5);
    fecha = d.toISOString().slice(0, 10);
  }
  try {
    const lat = Number(salida.lat), lon = Number(salida.lon);
    return solLuna(msDeEtiqueta(`${fecha}T${hora}`, zonaPorCoordenadas(lat, lon)), lat, lon);
  } catch { return {}; }
}

// Franja de 3 h de la hora local "HH:MM[:SS]".
export function franja(hora) {
  const m = String(hora || "").match(/^(\d{1,2}):/);
  const h = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  const a = Math.floor(h / 3) * 3;
  return `${String(a).padStart(2, "0")}-${String(a + 3).padStart(2, "0")}`;
}

// Momentos de una salida a partir de sus picadas y capturas con hora.
export function momentosSalida(picadas = [], capturas = [], salida = null) {
  const out = [];
  for (const p of picadas) {
    if (!p?.hora) continue;
    const c = p.condiciones && typeof p.condiciones === "object" ? p.condiciones : {};
    const hora = String(p.hora).slice(0, 5);
    const sl = c.sol_momento !== undefined ? c : solLunaMomento(salida, hora);
    out.push({ tipo: "picada", hora, marea_tendencia: p.marea_tendencia || null,
      marea_altura: p.marea_altura ?? null, luna_fase: c.luna_fase ?? null, presion_tendencia: c.presion_tendencia ?? null,
      sol_momento: sl.sol_momento ?? null, solunar: sl.solunar ?? null, luna_visible: sl.luna_visible ?? null, condiciones: c });
  }
  for (const k of capturas) {
    if (!k?.hora) continue;
    const hora = String(k.hora).slice(0, 5);
    const c = k.condiciones && typeof k.condiciones === "object" ? k.condiciones : {};
    const sl = c.sol_momento !== undefined ? c : solLunaMomento(salida, hora);
    out.push({ tipo: "captura", hora, especie: normalizarEspecie(k.especie), marea_tendencia: k.marea_tendencia || null,
      marea_altura: k.marea_altura ?? null, luna_fase: c.luna_fase ?? salida?.luna_fase ?? null, presion_tendencia: c.presion_tendencia ?? null,
      sol_momento: sl.sol_momento ?? null, solunar: sl.solunar ?? null, luna_visible: sl.luna_visible ?? null, condiciones: c });
  }
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}

// Especie en minúsculas y sin acentos ("Pulpo común" -> "pulpo comun").
export function normalizarEspecie(texto) {
  const t = String(texto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t || null;
}

// Tramos de las variables numéricas extra (extras-momento.js), para contar.
export function tramos(m) {
  const c = m.condiciones || {};
  const t = (v, cortes, nombres) => {
    if (!Number.isFinite(v)) return null;
    const i = cortes.findIndex((x) => v < x);
    return nombres[i === -1 ? nombres.length - 1 : i];
  };
  return {
    marea_ciclo: Number.isFinite(c.marea_min_desde_extremo) && c.marea_ultimo_extremo
      ? `${c.marea_ultimo_extremo}+${Math.min(6, Math.floor(c.marea_min_desde_extremo / 60))}h` : null,
    presion_3h: t(c.presion_cambio_3h, [-1, 1], ["baja", "estable", "sube"]),
    lluvia_72h: t(c.lluvia_72h, [1, 10], ["seco", "algo", "mucha"]),
    ola: t(c.oleaje_altura_max, [0.5, 1, 2], ["<0.5", "0.5-1", "1-2", ">2"]),
    agua_72h: t(c.temp_agua_cambio_72h, [-0.5, 0.5], ["enfria", "estable", "calienta"]),
  };
}

// Recuento por variable (marea, franja, luna, presión) de picadas y capturas,
// con cuántas personas distintas hay detrás de cada valor.
export function agruparMomentos(casos, cfg = CONFIG_MOMENTOS) {
  const grupos = new Map();
  const especies = new Map();
  const sumarEspecie = (especie, variable, valor, usuario) => {
    if (valor === null || valor === undefined || valor === "") return;
    if (!especies.has(especie)) especies.set(especie, { personas: new Set(), capturas: 0, grupos: new Map() });
    const e = especies.get(especie);
    e.personas.add(usuario);
    const k = `${variable}|${valor}`;
    if (!e.grupos.has(k)) e.grupos.set(k, { variable, valor, capturas: 0 });
    e.grupos.get(k).capturas++;
  };
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
      sumar("sol", m.sol_momento, m.tipo, c.usuario);
      sumar("solunar", m.solunar, m.tipo, c.usuario);
      sumar("luna_visible", m.luna_visible === null || m.luna_visible === undefined ? null : (m.luna_visible ? "si" : "no"), m.tipo, c.usuario);
      for (const [variable, v] of Object.entries(tramos(m))) sumar(variable, v, m.tipo, c.usuario);
      // Por especie (solo capturas): la misma cuenta, separada por pez.
      if (m.tipo === "captura" && m.especie) {
        sumarEspecie(m.especie, "marea", m.marea_tendencia, c.usuario);
        sumarEspecie(m.especie, "sol", m.sol_momento, c.usuario);
        sumarEspecie(m.especie, "solunar", m.solunar, c.usuario);
        sumarEspecie(m.especie, "luna", m.luna_fase, c.usuario);
        sumarEspecie(m.especie, "franja", franja(m.hora), c.usuario);
        for (const [variable, v] of Object.entries(tramos(m))) sumarEspecie(m.especie, variable, v, c.usuario);
      }
    }
  }
  const todos = [...grupos.values()].map((g) => ({ variable: g.variable, valor: g.valor, picadas: g.picadas, capturas: g.capturas, personas: g.personas.size }));
  return {
    total_momentos: casos.reduce((n, c) => n + (c.momentos?.length || 0), 0),
    grupos: todos.filter((g) => g.personas >= cfg.min_personas).sort((a, b) => a.variable.localeCompare(b.variable) || String(a.valor).localeCompare(String(b.valor))),
    grupos_retenidos: todos.filter((g) => g.personas < cfg.min_personas).length,
    // Por especie: solo las pescadas por 3 personas distintas o más.
    por_especie: [...especies.entries()]
      .filter(([, e]) => e.personas.size >= cfg.min_personas)
      .map(([especie, e]) => ({ especie, personas: e.personas.size, grupos: [...e.grupos.values()].sort((a, b) => a.variable.localeCompare(b.variable) || String(a.valor).localeCompare(String(b.valor))) }))
      .sort((a, b) => a.especie.localeCompare(b.especie)),
    especies_retenidas: [...especies.values()].filter((e) => e.personas.size < cfg.min_personas).length,
  };
}
