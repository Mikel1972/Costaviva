// scripts/i18n/contraste.mjs — contraste de nuestras traducciones con DeepL
// (2026-10-11, pedido de Mikel). Sin IA y sin gasto: DeepL API Free (500.000
// caracteres al mes gratis; una pasada completa de es.js son unos 70.000).
//
//   node scripts/i18n/contraste.mjs pt     -> i18n/contraste-pt.md
//   node scripts/i18n/contraste.mjs en     -> i18n/contraste-en.md
//
// Traduce del español cada clave de assets/i18n/es.js (cada forma de los
// plurales por separado) y la compara con la nuestra (pt.js / en.js). El
// informe recoge solo las claves que difieren de verdad:
//   - distancia de edición normalizada > 0,35 (sin etiquetas, sin mayúsculas), o
//   - términos del glosario (i18n/glosario-pt.json) distintos: DeepL usa el
//     término fijado y nosotros no, o al revés.
// Es una LISTA PARA REVISAR: DeepL no manda sobre el glosario ni sobre el
// tono de la app. Las mejoras claras se aplican a mano, por PR.
//
// Sin el secreto DEEPL_API_KEY avisa y sale con 0 (no falla el workflow).
// Las variables {x} y las etiquetas HTML se protegen para que DeepL no las
// toque (tag_handling=html + ignore_tags).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("../../", import.meta.url);
export const UMBRAL = 0.35;
const DESTINO = { pt: "PT-PT", en: "EN-GB" };
const LOTE = 40;

// ---------- utilidades puras (las prueba test/i18n-contraste.test.js) ----------

// Lee el objeto JSON de un diccionario (entre las líneas "{" y "}" sueltas).
export function leerDiccionario(texto) {
  const lineas = texto.split("\n");
  const i = lineas.indexOf("{");
  const j = lineas.lastIndexOf("}");
  return JSON.parse(lineas.slice(i, j + 1).join("\n"));
}

// Aplana los plurales: "clave" o "clave#one" / "clave#other".
export function aplanar(dic) {
  const out = {};
  for (const [k, v] of Object.entries(dic)) {
    if (v && typeof v === "object") for (const [f, s] of Object.entries(v)) out[`${k}#${f}`] = String(s);
    else out[k] = String(v);
  }
  return out;
}

// {var} -> <x>{var}</x> para que DeepL no lo traduzca, y vuelta.
export const proteger = (s) => String(s).replace(/\{(\w+)\}/g, "<x>{$1}</x>");
// Con tag_handling=html, DeepL devuelve "<" y ">" de texto como entidades: se
// deshacen para no marcar como distinto "<0,5 m" frente a "&lt;0,5 m".
export const desproteger = (s) => String(s).replace(/<x>\s*(\{\w+\})\s*<\/x>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export const textoPlano = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\{\w+\}/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

// Distancia de Levenshtein normalizada (0 = igual, 1 = nada en común).
export function distancia(a, b) {
  a = textoPlano(a); b = textoPlano(b);
  if (a === b) return 0;
  if (!a.length || !b.length) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / Math.max(a.length, b.length);
}

const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contiene = (texto, termino) => new RegExp(`(^|[^\\p{L}-])${escRe(termino)}`, "iu").test(textoPlano(texto));

// Términos del glosario en que difieren: [{ termino, nuestra, deepl }].
export function diferenciasGlosario(es, nuestra, deepl, glosario) {
  const out = [];
  for (const t of glosario?.terminos || []) {
    if (!new RegExp(t.es, "iu").test(textoPlano(es))) continue;
    const a = contiene(nuestra, t.pt), b = contiene(deepl, t.pt);
    if (a !== b) out.push({ termino: t.pt, nuestra: a, deepl: b });
  }
  return out;
}

// Compara y devuelve las claves a revisar, ordenadas por distancia.
export function comparar(es, nuestras, deepl, glosario, umbral = UMBRAL) {
  const filas = [];
  for (const k of Object.keys(es)) {
    if (deepl[k] === undefined || nuestras[k] === undefined) continue;
    const d = distancia(nuestras[k], deepl[k]);
    const g = diferenciasGlosario(es[k], nuestras[k], deepl[k], glosario);
    if (d > umbral || g.length) filas.push({ clave: k, es: es[k], nuestra: nuestras[k], deepl: deepl[k], distancia: +d.toFixed(2), glosario: g });
  }
  return filas.sort((a, b) => b.distancia - a.distancia);
}

const celda = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

export function informe({ idioma, filas, total, caracteres, fecha }) {
  const l = [
    `# Contraste ${idioma} con DeepL (${fecha})`,
    "",
    `Generado por \`scripts/i18n/contraste.mjs\` (sin IA; DeepL API Free). Claves comparadas: ${total}. `
      + `Caracteres enviados: ${caracteres}. Claves a revisar: **${filas.length}** (distancia > ${UMBRAL} o glosario distinto).`,
    "",
    "Es una lista para revisar a mano: el glosario (`i18n/glosario-pt.json`) y el tono de la app mandan sobre DeepL.",
    "",
    "| Clave | Distancia | Glosario | Español | Nuestra | DeepL |",
    "|---|---|---|---|---|---|",
  ];
  for (const f of filas) {
    const g = f.glosario.map((x) => `${x.termino}: ${x.nuestra ? "nuestra" : "DeepL"}`).join("; ");
    l.push(`| \`${f.clave}\` | ${f.distancia} | ${celda(g)} | ${celda(f.es)} | ${celda(f.nuestra)} | ${celda(f.deepl)} |`);
  }
  return l.join("\n") + "\n";
}

// ---------- DeepL ----------

async function traducir(textos, destino, clave) {
  const url = clave.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: textos.map(proteger), source_lang: "ES", target_lang: destino,
      tag_handling: "html", ignore_tags: ["x"], preserve_formatting: true,
    }),
  });
  if (!r.ok) throw new Error(`DeepL respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.translations.map((t) => desproteger(t.text));
}

async function principal() {
  const idioma = process.argv[2] || "pt";
  if (!DESTINO[idioma]) throw new Error(`idioma no soportado: ${idioma} (pt o en)`);
  const clave = process.env.DEEPL_API_KEY;
  if (!clave) {
    console.log("::warning::Falta el secreto DEEPL_API_KEY: no se hace el contraste con DeepL (no es un error).");
    return;
  }
  const leer = (r) => readFileSync(new URL(r, RAIZ), "utf8");
  const es = aplanar(leerDiccionario(leer("assets/i18n/es.js")));
  const nuestras = aplanar(leerDiccionario(leer(`assets/i18n/${idioma}.js`)));
  const glosario = idioma === "pt" ? JSON.parse(leer("i18n/glosario-pt.json")) : null;
  const claves = Object.keys(es).filter((k) => nuestras[k] !== undefined);
  const deepl = {};
  let caracteres = 0;
  for (let i = 0; i < claves.length; i += LOTE) {
    const lote = claves.slice(i, i + LOTE);
    const textos = lote.map((k) => es[k]);
    caracteres += textos.reduce((n, t) => n + t.length, 0);
    const res = await traducir(textos, DESTINO[idioma], clave);
    lote.forEach((k, n) => { deepl[k] = res[n]; });
  }
  const filas = comparar(es, nuestras, deepl, glosario);
  const md = informe({ idioma, filas, total: claves.length, caracteres, fecha: new Date().toISOString().slice(0, 10) });
  const salida = fileURLToPath(new URL(`i18n/contraste-${idioma}.md`, RAIZ));
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, md);
  console.log(md);
  console.log(`Claves comparadas: ${claves.length}; a revisar: ${filas.length}; caracteres: ${caracteres}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => { console.error(e.message); process.exit(1); });
}
