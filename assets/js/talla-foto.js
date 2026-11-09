// assets/js/talla-foto.js
//
// La foto aprende a calcular la talla (2026-11-09, Mikel: la foto de su sargo
// calculó 30 cm y medía 30; "sí, hazlo; instruir al robot para que vaya
// aprendiendo"). Puro, sin red; lo usan functions/identificar-captura.js y
// el aprendizaje semanal (scripts/aprendizaje/talla-foto.mjs).
//
// Cada captura guarda lo que calculó la foto (talla_estimada_cm, sin
// corregir) y si el pescador midió la talla (talla_medida). Con las medidas,
// por especie: sesgo = media de (foto − medida), margen = error absoluto
// medio. El aprendizaje semanal publica la calibración en
// assets/js/talla-foto-calibracion.js y la función la aplica sola:
//   - el margen siempre ("suele acertar ±2 cm");
//   - la corrección del sesgo solo si es claro (≥ 1 cm y ≥ 2 errores típicos).
// Solo especies con 10 medidas o más de 5 personas distintas o más (repo
// público, como el resto del aprendizaje).

export const CONFIG_TALLA_FOTO = { min_muestras: 10, min_personas: 5, sesgo_min_cm: 1, errores_tipicos: 2 };
// Peso (2026-11-09, Mikel: "la medida acertó pero el peso no": sargo de 30 cm,
// la foto dijo 450 g y pesó 560). El error del peso crece con el pez, así que
// el sesgo va en % y el margen en gramos.
export const CONFIG_PESO_FOTO = { min_muestras: 10, min_personas: 5, sesgo_min_pct: 5, errores_tipicos: 2 };

export function claveEspecie(nombre) {
  return String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split("/")[0].replace(/[^a-z0-9]+/g, " ").trim();
}

const num = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

// salidas: [{ id, user_id }]; capturas: [{ salida_id, especie, talla_cm,
// talla_estimada_cm, talla_medida }]. Solo tallas medidas con cálculo previo.
export function muestrasTallaFoto({ salidas = [], capturas = [], excluir = new Set(), propios = new Set() }) {
  const dueno = new Map(salidas.map((s) => [s.id, s.user_id]));
  const out = [];
  for (const c of capturas) {
    const usuario = dueno.get(c.salida_id);
    if (!usuario || excluir.has(usuario) || c.talla_medida !== true) continue;
    const est = num(c.talla_estimada_cm), med = num(c.talla_cm);
    if (est === null || med === null || med <= 0) continue;
    out.push({ especie: claveEspecie(c.especie), error: +(est - med).toFixed(2), usuario: propios.has(usuario) ? "dueño" : usuario });
  }
  return out;
}

export function gruposTallaFoto(muestras) {
  const g = new Map();
  for (const m of muestras) {
    if (!m.especie) continue;
    if (!g.has(m.especie)) g.set(m.especie, []);
    g.get(m.especie).push(m);
  }
  return [...g.entries()].map(([especie, ms]) => {
    const n = ms.length;
    const media = ms.reduce((a, m) => a + m.error, 0) / n;
    const mae = ms.reduce((a, m) => a + Math.abs(m.error), 0) / n;
    const sd = n > 1 ? Math.sqrt(ms.reduce((a, m) => a + (m.error - media) ** 2, 0) / (n - 1)) : null;
    return {
      especie, n, personas: new Set(ms.map((m) => m.usuario)).size,
      sesgo_cm: +media.toFixed(1), margen_cm: +mae.toFixed(1), error_tipico_cm: sd === null ? null : +(sd / Math.sqrt(n)).toFixed(2),
    };
  }).sort((a, b) => a.especie.localeCompare(b.especie));
}

// Peso: solo capturas pesadas (peso_medido) con cálculo previo de la foto.
export function muestrasPesoFoto({ salidas = [], capturas = [], excluir = new Set(), propios = new Set() }) {
  const dueno = new Map(salidas.map((s) => [s.id, s.user_id]));
  const out = [];
  for (const c of capturas) {
    const usuario = dueno.get(c.salida_id);
    if (!usuario || excluir.has(usuario) || c.peso_medido !== true) continue;
    const est = num(c.peso_estimado_g), med = num(c.peso_g);
    if (est === null || med === null || med <= 0) continue;
    out.push({ especie: claveEspecie(c.especie), error_g: est - med, error_pct: +((100 * (est - med)) / med).toFixed(2), usuario: propios.has(usuario) ? "dueño" : usuario });
  }
  return out;
}

export function gruposPesoFoto(muestras) {
  const g = new Map();
  for (const m of muestras) {
    if (!m.especie) continue;
    if (!g.has(m.especie)) g.set(m.especie, []);
    g.get(m.especie).push(m);
  }
  return [...g.entries()].map(([especie, ms]) => {
    const n = ms.length;
    const media = ms.reduce((a, m) => a + m.error_pct, 0) / n;
    const mae = ms.reduce((a, m) => a + Math.abs(m.error_g), 0) / n;
    const sd = n > 1 ? Math.sqrt(ms.reduce((a, m) => a + (m.error_pct - media) ** 2, 0) / (n - 1)) : null;
    return {
      especie, n, personas: new Set(ms.map((m) => m.usuario)).size,
      sesgo_pct: +media.toFixed(1), margen_g: Math.round(mae), error_tipico_pct: sd === null ? null : +(sd / Math.sqrt(n)).toFixed(2),
    };
  }).sort((a, b) => a.especie.localeCompare(b.especie));
}

export function calibracionPesoFoto(grupos, cfg = CONFIG_PESO_FOTO) {
  const out = {};
  for (const g of grupos) {
    if (g.n < cfg.min_muestras || g.personas < cfg.min_personas) continue;
    const claro = g.error_tipico_pct !== null && Math.abs(g.sesgo_pct) >= cfg.sesgo_min_pct && Math.abs(g.sesgo_pct) >= cfg.errores_tipicos * g.error_tipico_pct;
    out[g.especie] = { n: g.n, margen_g: g.margen_g, sesgo_pct: claro ? g.sesgo_pct : 0 };
  }
  return out;
}

// Calibración publicable: { especie: { n, margen_cm, sesgo_cm (0 si no es claro) } }.
export function calibracionTallaFoto(grupos, cfg = CONFIG_TALLA_FOTO) {
  const out = {};
  for (const g of grupos) {
    if (g.n < cfg.min_muestras || g.personas < cfg.min_personas) continue;
    const claro = g.error_tipico_cm !== null && Math.abs(g.sesgo_cm) >= cfg.sesgo_min_cm && Math.abs(g.sesgo_cm) >= cfg.errores_tipicos * g.error_tipico_cm;
    out[g.especie] = { n: g.n, margen_cm: g.margen_cm, sesgo_cm: claro ? g.sesgo_cm : 0 };
  }
  return out;
}

// Aplica la calibración a lo que devolvió la foto. Devuelve lo corregido y,
// aparte, lo que calculó la foto (es lo que se guarda: el aprendizaje mide
// siempre la foto sin corregir, para no corregirse a sí mismo).
export function aplicarCalibracion(resultado, calibracion = {}) {
  // Forma { talla: {...}, peso: {...} }; la antigua (solo talla) también vale.
  const calT = calibracion.talla || calibracion.peso ? calibracion.talla || {} : calibracion;
  const calP = calibracion.peso || {};
  const talla = num(resultado?.talla_cm), peso = num(resultado?.peso_g);
  const out = { ...resultado, talla_foto_cm: talla, peso_foto_g: peso, margen_cm: null, margen_peso_g: null, calibrada: false };
  const clave = resultado?.especie ? claveEspecie(resultado.especie) : null;
  const ct = clave ? calT[clave] : null, cp = clave ? calP[clave] : null;
  if (ct && talla !== null) {
    out.margen_cm = ct.margen_cm;
    if (ct.sesgo_cm) {
      out.talla_cm = Math.max(1, Math.round((talla - ct.sesgo_cm) * 2) / 2);
      out.calibrada = true;
      if (peso !== null && !cp?.sesgo_pct) out.peso_g = Math.round(peso * (out.talla_cm / talla) ** 3);
    }
  }
  if (cp && peso !== null) {
    out.margen_peso_g = cp.margen_g;
    if (cp.sesgo_pct) {
      out.peso_g = Math.max(1, Math.round(peso / (1 + cp.sesgo_pct / 100)));
      out.calibrada = true;
    }
  }
  return out;
}
