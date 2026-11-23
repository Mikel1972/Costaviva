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

// Tabla en Markdown (el Issue la pinta y el email la convierte en <table>:
// functions/_lib/informe-html.js). Las barras de las celdas se cambian por «/».
export function tablaMd(columnas, filas) {
  const celda = (x) => String(x ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
  return [
    "",
    `| ${columnas.map(celda).join(" | ")} |`,
    `|${columnas.map(() => "---").join("|")}|`,
    ...filas.map((f) => `| ${f.map(celda).join(" | ")} |`),
    "",
  ];
}

const flecha = (a, b) => `${a} → ${b}`;

// Una medida: antes (los 7 días anteriores al día del cambio) frente a
// después (desde el día siguiente al cambio hasta ayer: solo días completos;
// el día del cambio va a medias y el de hoy aún no ha terminado), en media
// por día. Devuelve la fila de la tabla de efectividad.
export function filaMedida(m, antes, despues, diasDespues) {
  const cambio = `${m.titulo}${m.pr?.length ? ` (PR ${m.pr.join(", ")})` : ""}`;
  if (!(diasDespues > 0)) return [cambio, fechaCorta(m.fecha), "0", "–", "–", "–", "–", "⏳ esperando días completos"];
  const iA = antes.impresiones / 7, iD = despues.impresiones / diasDespues;
  const cA = antes.clics / 7, cD = despues.clics / diasDespues;
  const ctrA = antes.impresiones ? (antes.clics / antes.impresiones) * 100 : NaN;
  const ctrD = despues.impresiones ? (despues.clics / despues.impresiones) * 100 : NaN;
  let pos = "–", veredicto = "= igual";
  if (Number.isFinite(antes.posicion) && Number.isFinite(despues.posicion)) {
    const d = antes.posicion - despues.posicion; // positivo = sube (mejor)
    pos = flecha(num(antes.posicion), num(despues.posicion));
    if (d >= 0.5) veredicto = `✅ sube ${num(d)} puestos`;
    else if (d <= -0.5) veredicto = `⚠️ baja ${num(-d)} puestos`;
  } else if (Number.isFinite(despues.posicion)) {
    pos = flecha("no salía", num(despues.posicion));
    veredicto = "✅ empieza a salir";
  }
  if (diasDespues < 3) veredicto += " (pocos días)";
  return [cambio, fechaCorta(m.fecha), String(diasDespues), `${flecha(num(iA), num(iD))}${pct(iD, iA)}`, flecha(num(cA, 2), num(cD, 2)), `${flecha(num(ctrA), num(ctrD))} %`, pos, veredicto];
}
export const COLUMNAS_MEDIDAS = ["Cambio", "Fecha", "Días después", "Impresiones/día", "Clics/día", "CTR", "Posición", "Resultado"];

// Google día a día (filas con dimensión "date"); hoy, marcado a medias.
export function tablaDias(filas, hoy) {
  const orden = (filas || []).slice().sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  return tablaMd(["Día", "Clics", "Impresiones", "CTR", "Posición media"], orden.map((f) => [
    `${fechaCorta(f.keys[0])}${f.keys[0] === hoy ? " (hoy, a medias)" : ""}`,
    String(f.clicks), String(f.impressions), `${num((f.ctr || 0) * 100)} %`, num(f.position),
  ]));
}

// Nuestro contador (visitas_publicas: dia, pagina, fuente, campana, visitas).
const REDES = new Set(["facebook", "instagram", "x", "whatsapp", "telegram"]);
export function tablaVisitas(filas, hoy) {
  const ayer = sumarDias(hoy, -1);
  const semanaAntes = sumarDias(ayer, -7);
  const de = (dia, cond = () => true) => (filas || []).filter((f) => f.dia === dia && cond(f)).reduce((n, f) => n + (f.visitas || 0), 0);
  const agrupar = (dia, campo) => {
    const m = new Map();
    for (const f of filas || []) if (f.dia === dia) m.set(f[campo], (m.get(f[campo]) || 0) + (f.visitas || 0));
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "–";
  };
  const tAyer = de(ayer), tSem = de(semanaAntes);
  const marca = (d) => (d < CONTADOR_FIABLE_DESDE ? "*" : "");
  const dias = [...Array.from({ length: 7 }, (_, i) => sumarDias(ayer, -6 + i)), hoy];
  const conRobots = dias.some((d) => marca(d)) || marca(semanaAntes);
  return [
    marca(semanaAntes)
      ? `    - Ayer (${fechaCorta(ayer)}): ${tAyer} visitas (el mismo día de la semana anterior, ${tSem}, aún contaba robots: sin comparación)`
      : `    - Ayer (${fechaCorta(ayer)}): ${tAyer} visitas${pct(tAyer, tSem)} frente al mismo día de la semana anterior (${tSem})`,
    `    - Ayer por tipo de página: ${agrupar(ayer, "pagina")}`,
    ...tablaMd(["Día", "Total", "Google", "Bing", "Redes sociales", "Directo", "Otros"], dias.map((d) => {
      const g = de(d, (f) => f.fuente === "google"), b = de(d, (f) => f.fuente === "bing");
      const r = de(d, (f) => REDES.has(f.fuente)), di = de(d, (f) => f.fuente === "directo");
      const t = de(d);
      return [`${fechaCorta(d)}${marca(d)}${d === hoy ? " (hoy, hasta ahora)" : ""}`, String(t), String(g), String(b), String(r), String(di), String(t - g - b - r - di)];
    })),
    ...(conRobots ? [`    - * Antes del ${fechaCorta(CONTADOR_FIABLE_DESDE)} el contador incluía robots (como «directo»).`] : []),
  ];
}
