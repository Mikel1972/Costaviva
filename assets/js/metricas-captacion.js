// assets/js/metricas-captacion.js
// Presentación de los números de captación (2026-10-09), sin IA. Los datos
// salen de metricas_captacion() / admin_metricas_captacion() (migración
// 20261009120000). Lo usan admin.html (tabla) y el informe diario de los
// lunes (scripts/captacion/informe-captacion.mjs). Lógica pura:
// test/captacion.test.js.

export function pct(parte, total) {
  if (!total) return null;
  return Math.round((1000 * parte) / total) / 10;
}

export function textoPct(parte, total) {
  const p = pct(parte, total);
  return p === null ? "—" : `${String(p).replace(".", ",")} % (${parte}/${total})`;
}

// {"google": 3, "instagram": 1} -> "google 3 · instagram 1" (de más a menos).
export function textoPorFuente(obj) {
  const filas = Object.entries(obj || {}).filter(([, n]) => Number(n) > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return filas.length ? filas.map(([f, n]) => `${f} ${n}`).join(" · ") : "—";
}

export function textoSemana(lunesISO) {
  const [a, m, d] = String(lunesISO).split("-").map(Number);
  if (!a) return String(lunesISO);
  const ini = new Date(Date.UTC(a, m - 1, d));
  const fin = new Date(Date.UTC(a, m - 1, d + 6));
  const f = (x) => `${x.getUTCDate()}/${x.getUTCMonth() + 1}`;
  return `${f(ini)}–${f(fin)}`;
}

// La semana cerrada más reciente (la primera de la lista es la actual, aún
// a medias, salvo que solo haya una).
export function semanaCerrada(m) {
  const s = m?.semanas || [];
  return s.length > 1 ? s[1] : s[0] || null;
}

// Bloque del informe (markdown, una línea por dato). Si no hay datos, lo
// dice en vez de dar ceros sin contexto (trampa 8 de comun).
export function lineasInforme(m) {
  if (!m || !Array.isArray(m.semanas)) return ["  - Sin datos de captación (¿migraciones de captación sin aplicar?)."];
  const s = semanaCerrada(m);
  const n = m.norte || {};
  const lineas = [
    `  - ⭐ Prueba → pago (últimas ${m.semanas.length} semanas): ${textoPct(n.pagan || 0, n.pruebas_terminadas || 0)}`,
  ];
  if (!s) return lineas;
  lineas.push(
    `  - Semana ${textoSemana(s.semana)}:`,
    `    - Visitas a páginas públicas: ${s.visitas} (${textoPorFuente(s.visitas_por_fuente)})`,
    `    - Altas confirmadas: ${s.altas_confirmadas} de ${s.altas} (${textoPorFuente(s.altas_por_fuente)})`,
    `    - Invitaciones canjeadas: ${s.invitaciones_canjeadas} · amigos apuntados: ${s.amigos_apuntados} · amigos que pagan: ${s.amigos_que_pagan}`,
    `    - Prueba → pago de las altas de esa semana: ${textoPct(s.pagan, s.pruebas_terminadas)}`,
  );
  // Retención: la cohorte más reciente que ya tiene datos de semana 2 y 4.
  const r2 = m.semanas.find((x) => x.base_s2 > 0);
  const r4 = m.semanas.find((x) => x.base_s4 > 0);
  lineas.push(`  - Siguen usando la app en su semana 2: ${r2 ? `${textoPct(r2.activos_s2, r2.base_s2)}, altas del ${textoSemana(r2.semana)}` : "aún sin cohortes de 2 semanas"}`);
  lineas.push(`  - Siguen usando la app en su semana 4: ${r4 ? `${textoPct(r4.activos_s4, r4.base_s4)}, altas del ${textoSemana(r4.semana)}` : "aún sin cohortes de 4 semanas"}`);
  return lineas;
}

// Filas para la tabla de admin.html (texto plano, se pinta con textContent).
export const COLUMNAS = ["Semana", "Visitas", "Por fuente", "Altas (conf.)", "Altas por fuente", "Invit.", "Amigos (pagan)", "Prueba→pago", "Activos s2", "Activos s4"];
export function filasTabla(m) {
  return (m?.semanas || []).map((s) => [
    textoSemana(s.semana),
    String(s.visitas),
    textoPorFuente(s.visitas_por_fuente),
    `${s.altas} (${s.altas_confirmadas})`,
    textoPorFuente(s.altas_por_fuente),
    String(s.invitaciones_canjeadas),
    `${s.amigos_apuntados} (${s.amigos_que_pagan})`,
    textoPct(s.pagan, s.pruebas_terminadas),
    textoPct(s.activos_s2, s.base_s2),
    textoPct(s.activos_s4, s.base_s4),
  ]);
}
