// functions/_lib/marea-extremo.js — hora y altura de una pleamar o bajamar
// al minuto (2026-11-20, Mikel: «haz lo de las horas de marea al minuto»).
//
// El modelo da la marea cada hora, así que la pleamar salía siempre a la hora
// en punto (12:00, 18:00). Con los tres valores horarios alrededor del
// extremo (antes, el extremo y después) se ajusta una parábola y se toma su
// vértice: la hora real cae entre media hora antes y media hora después.
// Cerca de un extremo la marea es casi una parábola, así que el error es de
// pocos minutos.

// prev, cur, next: alturas (m) a las horas h-1, h y h+1. Devuelve
// { desfaseMin (-30..30), altura } o null si no se puede (datos que faltan o
// tramo plano).
export function vertice(prev, cur, next) {
  if (![prev, cur, next].every(Number.isFinite)) return null;
  const den = prev - 2 * cur + next;
  if (Math.abs(den) < 1e-9) return { desfaseMin: 0, altura: cur };
  const x = Math.max(-0.5, Math.min(0.5, (0.5 * (prev - next)) / den));
  return { desfaseMin: Math.round(x * 60), altura: cur - 0.25 * (prev - next) * x };
}

// horaISO local "AAAA-MM-DDTHH:MM" + minutos -> "AAAA-MM-DDTHH:MM" (sin zona:
// se suma en UTC sobre los mismos números, así no lo mueve ningún cambio de
// hora del sistema).
export function sumarMinutos(horaISO, min) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(horaISO));
  if (!m) return horaISO;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + min * 60e3;
  return new Date(t).toISOString().slice(0, 16);
}
