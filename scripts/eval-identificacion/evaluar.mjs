// scripts/eval-identificacion/evaluar.mjs
// Compara Claude Haiku 4.5 y Haiku 5.5 en la identificación de especies por
// foto (2026-10-08, aprobado por Mikel con gasto mínimo). Usa EXACTAMENTE la
// petición del endpoint (cuerpoPeticion/interpretarRespuesta de
// functions/identificar-captura.js), solo cambia el modelo.
//
// Fotos: la imagen principal del artículo de Wikipedia de cada especie
// (Wikimedia Commons, dominio público o CC), pedida a 1000 px como la que
// sube la app. La URL de cada foto sale en el log para poder revisarla.
//
// Uso: ANTHROPIC_API_KEY=... node scripts/eval-identificacion/evaluar.mjs
// No es una prueba automática: gasta (poco) saldo de la API. Se lanzó una
// vez desde un workflow temporal y ese disparador se quitó después.

import { cuerpoPeticion, interpretarRespuesta } from "../../functions/identificar-captura.js";

const MODELOS = ["claude-haiku-4-5-20251001", "claude-haiku-5-5"];
// USD por millón de tokens (entrada, salida), prompts de menos de 100K.
const PRECIOS = {
  "claude-haiku-4-5-20251001": [1, 5],
  "claude-haiku-5-5": [0.1, 0.5],
};
const UA = "CostavivaEval/1.0 (https://github.com/Mikel1972/costaviva)";

// especie esperada, título de Wikipedia (inglés), nombres aceptados
const CASOS = [
  ["Lubina", "Dicentrarchus labrax", ["lubina", "robalo"]],
  ["Dorada", "Sparus aurata", ["dorada"]],
  ["Sargo", "Diplodus sargus", ["sargo"]],
  ["Salmonete", "Mullus surmuletus", ["salmonete"]],
  ["Caballa", "Atlantic mackerel", ["caballa", "verdel", "xarda"]],
  ["Jurel", "Atlantic horse mackerel", ["jurel", "chicharro", "txitxarro"]],
  ["Faneca", "Trisopterus luscus", ["faneca", "mollera", "paneka"]],
  ["Congrio", "European conger", ["congrio"]],
  ["Pulpo", "Common octopus", ["pulpo"]],
  ["Sepia", "Common cuttlefish", ["sepia", "choco", "jibia"]],
  ["Calamar", "European squid", ["calamar", "chipiron", "txipiron"]],
  ["Lenguado", "Common sole", ["lenguado"]],
  ["Rodaballo", "Turbot", ["rodaballo"]],
  ["Mero", "Dusky grouper", ["mero"]],
  ["Chopa", "Black seabream", ["chopa", "choupa"]],
];

const normalizar = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function urlFoto(titulo) {
  const api = "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1" +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=1000&titles=${encodeURIComponent(titulo)}`;
  const r = await fetch(api, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`Wikipedia HTTP ${r.status}`);
  const paginas = Object.values((await r.json())?.query?.pages || {});
  const url = paginas[0]?.thumbnail?.source;
  if (!url) throw new Error("el artículo no tiene imagen principal");
  return url;
}

async function descargar(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`imagen HTTP ${r.status}`);
  const tipo = (r.headers.get("content-type") || "").split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(tipo)) throw new Error(`tipo no admitido ${tipo}`);
  return { base64: Buffer.from(await r.arrayBuffer()).toString("base64"), tipo };
}

async function identificar(modelo, foto) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(cuerpoPeticion({ imagenBase64: foto.base64, tipoMime: foto.tipo, modelo })),
  });
  // Del error solo se enseña tipo y estado, nunca cabeceras ni la clave.
  if (!r.ok) {
    let tipo = "";
    try { tipo = (await r.json())?.error?.type || ""; } catch (e) { /* nada */ }
    return { error: `HTTP ${r.status} ${tipo}`.trim(), usage: {} };
  }
  const datos = await r.json();
  const usage = datos.usage || {};
  let interpretado;
  try { interpretado = interpretarRespuesta(datos); } catch (e) { interpretado = { codigo: "respuesta_invalida" }; }
  return { ...interpretado, usage, stop: datos.stop_reason };
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("Sin ANTHROPIC_API_KEY: no se ejecuta la evaluación.");
  process.exit(0);
}

const totales = Object.fromEntries(MODELOS.map((m) => [m, { aciertos: 0, n: 0, entrada: 0, salida: 0, usd: 0, maxSalida: 0, fallos: 0 }]));
const filas = [];
for (const [esperada, titulo, aceptados] of CASOS) {
  let foto, url;
  try {
    url = await urlFoto(titulo);
    foto = await descargar(url);
  } catch (e) {
    console.log(`- ${esperada}: sin foto (${e.message}), se salta`);
    continue;
  }
  console.log(`- ${esperada}: ${url}`);
  const fila = { esperada };
  for (const modelo of MODELOS) {
    const r = await identificar(modelo, foto);
    const t = totales[modelo];
    const entrada = r.usage.input_tokens || 0;
    const salida = r.usage.output_tokens || 0;
    const [pIn, pOut] = PRECIOS[modelo];
    const usd = (entrada * pIn + salida * pOut) / 1e6;
    const especie = r.resultado?.especie ?? null;
    const acierto = !!especie && aceptados.some((a) => normalizar(especie).includes(a));
    t.n++; t.entrada += entrada; t.salida += salida; t.usd += usd;
    t.maxSalida = Math.max(t.maxSalida, salida);
    if (acierto) t.aciertos++;
    if (r.error || r.codigo) t.fallos++;
    fila[modelo] = { especie: especie ?? (r.error || r.codigo || "(vacía)"), confianza: r.resultado?.confianza ?? "-", acierto, entrada, salida, usd, stop: r.stop };
    await esperar(300);
  }
  filas.push(fila);
}

const corto = { "claude-haiku-4-5-20251001": "4.5", "claude-haiku-5-5": "5.5" };
console.log("\n| Especie | 4.5 dice | ok | 5.5 dice | ok | tokens 4.5 (ent/sal) | tokens 5.5 (ent/sal) | USD 4.5 | USD 5.5 |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const f of filas) {
  const a = f[MODELOS[0]], b = f[MODELOS[1]];
  console.log(`| ${f.esperada} | ${a.especie} (${a.confianza}) | ${a.acierto ? "sí" : "no"} | ${b.especie} (${b.confianza}) | ${b.acierto ? "sí" : "no"} | ${a.entrada}/${a.salida} | ${b.entrada}/${b.salida} | ${a.usd.toFixed(5)} | ${b.usd.toFixed(5)} |`);
}
console.log("\nResumen:");
for (const m of MODELOS) {
  const t = totales[m];
  console.log(`  Haiku ${corto[m]}: ${t.aciertos}/${t.n} aciertos, fallos de servicio ${t.fallos}, ` +
    `media ${Math.round(t.entrada / (t.n || 1))} ent / ${Math.round(t.salida / (t.n || 1))} sal tokens, ` +
    `máx salida ${t.maxSalida}, ${(t.usd / (t.n || 1)).toFixed(5)} USD/foto, total ${t.usd.toFixed(4)} USD`);
}
