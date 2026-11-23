// functions/_lib/informe-html.js — convierte el texto del informe diario
// (el mismo Markdown sencillo que va al Issue) en HTML para el email.
//
// 2026-11-23, Mikel: «en el mail los temas en cuadros para que pueda ver las
// evoluciones; en párrafos es más difícil». Las tablas Markdown
// (| a | b |) salen como <table> con bordes; las listas («- », «  - »)
// con su sangría; «### fecha» y «## …» como títulos; **negrita**. Todo el
// texto se escapa: lo que no se entiende se pinta tal cual, nunca se pierde.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enLinea = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");

const celdas = (linea) => linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const esSeparador = (linea) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(linea.trim());

const ESTILO_TABLA = "border-collapse:collapse;margin:6px 0 12px;font:13px Arial,sans-serif;";
const ESTILO_TH = "border:1px solid #cfd8dc;background:#0B2532;color:#fff;padding:4px 8px;text-align:left;white-space:nowrap;";
const ESTILO_TD = "border:1px solid #cfd8dc;padding:4px 8px;vertical-align:top;";

function tablaHtml(lineas) {
  const [cab, ...resto] = lineas;
  const filas = resto.filter((l) => !esSeparador(l));
  const th = celdas(cab).map((c) => `<th style="${ESTILO_TH}">${enLinea(c)}</th>`).join("");
  const trs = filas.map((l, i) => `<tr style="background:${i % 2 ? "#f5f7f8" : "#fff"}">${celdas(l).map((c) => `<td style="${ESTILO_TD}">${enLinea(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="${ESTILO_TABLA}"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function informeAHtml(texto) {
  const lineas = String(texto || "").split("\n");
  const out = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const bloque = [];
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) bloque.push(lineas[i++]);
      i--;
      out.push(tablaHtml(bloque));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const n = Math.min(4, h[1].length + 1);
      out.push(`<h${n} style="font:bold ${n === 2 ? 20 : n === 3 ? 17 : 15}px Georgia,serif;color:#0B2532;margin:16px 0 6px">${enLinea(h[2])}</h${n}>`);
      continue;
    }
    const li = /^(\s*)[-*]\s+(.*)$/.exec(l);
    if (li) {
      const nivel = Math.floor(li[1].length / 2);
      out.push(`<div style="margin:2px 0 2px ${nivel * 18}px;font:14px Arial,sans-serif;line-height:1.4">• ${enLinea(li[2])}</div>`);
      continue;
    }
    if (!l.trim()) { out.push('<div style="height:6px"></div>'); continue; }
    out.push(`<div style="font:14px Arial,sans-serif;line-height:1.4;margin:2px 0">${enLinea(l)}</div>`);
  }
  return `<div style="max-width:960px;color:#0B2532">${out.join("\n")}</div>`;
}
