// scripts/seo/efectividad-lib.mjs — cálculos puros del bloque «Efectividad
// y visitas» del informe diario (efectividad.mjs). Sin red: se prueba en
// test/efectividad.test.js.
//
// 2026-11-23, Mikel: «controlar en tiempo real los clicks, la efectividad de
// las medidas que implementamos… sin tener que esperar dos semanas», «en el
// email de actividad diaria, que incluya toda la información».

const DIA_MS = 86400000;
// El contador visitas_publicas solo es fiable desde el 21/11 (antes contaba
// robots como «directo»: 666 el 16/11, 1096 el 20/11).
export const CONTADOR_FIABLE_DESDE = "2026-11-21";

export const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
export const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS) + 1;
export const fechaCorta = (f) => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`;

export function num(x, dec = 1) {
  if (!Number.isFinite(x)) return "–";
  return (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec).replace(".", ",").replace(/,0+$/, "");
}

export function pct(actual, previo) {
  if (!(previo > 0)) return actual > 0 ? " (antes 0)" : "";
  const p = Math.round(((actual - previo) / previo) * 100);
  return ` (${p >= 0 ? "+" : ""}${p} %)`;
}

export const rutaDeUrl = (url) => {
  try { return new URL(url).pathname.replace(/\/+$/, "") || "/"; } catch { return String(url); }
};

// Filas de Search Console con dimensión "page" → totales de las páginas que
// casan con alguno de los patrones. Posición media ponderada por impresiones
// (como la calcula Google para un grupo de páginas).
export function totalesPaginas(filas, patrones) {
  const res = (patrones || []).map((p) => new RegExp(p));
  let clics = 0, impresiones = 0, posPond = 0, paginas = 0;
  for (const f of filas || []) {
    const ruta = rutaDeUrl(f.keys?.[0]);
    if (!res.some((r) => r.test(ruta))) continue;
    paginas++;
    clics += f.clicks || 0;
    impresiones += f.impressions || 0;
    posPond += (f.position || 0) * (f.impressions || 0);
  }
  return { clics, impresiones, posicion: impresiones ? posPond / impresiones : NaN, paginas };
}

// Una medida: antes (los 7 días anteriores al día del cambio) frente a
// después (desde el día siguiente al cambio hasta ayer: solo días completos;
// el día del cambio va a medias y el de hoy aún no ha terminado), en media
// por día.
export function lineaMedida(m, antes, despues, diasDespues) {
  const cab = `${m.titulo} (${fechaCorta(m.fecha)}${m.pr?.length ? `, PR ${m.pr.join(", ")}` : ""})`;
  if (!(diasDespues > 0)) return `    - ${cab}: aún sin datos de después: se cuentan los días completos desde el día siguiente al cambio (el primero sale pasado mañana).`;
  const dA = 7;
  const iA = antes.impresiones / dA, iD = despues.impresiones / diasDespues;
  const cA = antes.clics / dA, cD = despues.clics / diasDespues;
  const ctrA = antes.impresiones ? (antes.clics / antes.impresiones) * 100 : NaN;
  const ctrD = despues.impresiones ? (despues.clics / despues.impresiones) * 100 : NaN;
  let pos = "";
  if (Number.isFinite(antes.posicion) && Number.isFinite(despues.posicion)) {
    const d = antes.posicion - despues.posicion; // positivo = sube (mejor)
    pos = `, posición ${num(antes.posicion)} → ${num(despues.posicion)}${Math.abs(d) >= 0.5 ? (d > 0 ? ` (sube ${num(d)} ✅)` : ` (baja ${num(-d)} ⚠️)`) : " (igual)"}`;
  } else if (Number.isFinite(despues.posicion)) {
    pos = `, posición ${num(despues.posicion)} (antes no salía)`;
  }
  const aviso = diasDespues < 3 ? " · pocos días, orientativo" : "";
  return `    - ${cab}: impresiones/día ${num(iA)} → ${num(iD)}${pct(iD, iA)}, clics/día ${num(cA, 2)} → ${num(cD, 2)}, CTR ${num(ctrA)} % → ${num(ctrD)} %${pos} [${diasDespues} días después${aviso}]`;
}

// Google día a día (filas con dimensión "date").
export function lineasDias(filas) {
  return (filas || [])
    .slice()
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
    .map((f) => `    - ${fechaCorta(f.keys[0])}: ${f.clicks} clics, ${f.impressions} impresiones, posición ${num(f.position)}`);
}

// Nuestro contador (visitas_publicas: dia, pagina, fuente, campana, visitas).
export function lineasVisitas(filas, hoy) {
  const ayer = sumarDias(hoy, -1);
  const semanaAntes = sumarDias(ayer, -7);
  const total = (dia) => (filas || []).filter((f) => f.dia === dia).reduce((n, f) => n + (f.visitas || 0), 0);
  const agrupar = (dia, campo) => {
    const m = new Map();
    for (const f of filas || []) if (f.dia === dia) m.set(f[campo], (m.get(f[campo]) || 0) + (f.visitas || 0));
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "–";
  };
  const tAyer = total(ayer), tSem = total(semanaAntes);
  const marca = (d) => (d < CONTADOR_FIABLE_DESDE ? "*" : "");
  const dias7 = Array.from({ length: 7 }, (_, i) => sumarDias(ayer, -6 + i));
  const ultimos7 = dias7.map((d) => `${fechaCorta(d)}: ${total(d)}${marca(d)}`).join(" · ");
  const notaRobots = dias7.some((d) => marca(d)) || marca(semanaAntes) ? ` (* antes del ${fechaCorta(CONTADOR_FIABLE_DESDE)} el contador incluía robots)` : "";
  return [
    marca(semanaAntes)
      ? `    - Ayer (${fechaCorta(ayer)}): ${tAyer} visitas (el mismo día de la semana anterior, ${tSem}, aún contaba robots: sin comparación)`
      : `    - Ayer (${fechaCorta(ayer)}): ${tAyer} visitas${pct(tAyer, tSem)} frente al mismo día de la semana anterior (${tSem})`,
    `    - Ayer por origen: ${agrupar(ayer, "fuente")}`,
    `    - Ayer por tipo de página: ${agrupar(ayer, "pagina")}`,
    `    - Hoy hasta ahora (${fechaCorta(hoy)}): ${total(hoy)} visitas (${agrupar(hoy, "fuente")})`,
    `    - Últimos 7 días: ${ultimos7}${notaRobots}`,
  ];
}
