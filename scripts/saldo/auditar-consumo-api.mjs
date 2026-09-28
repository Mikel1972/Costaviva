// scripts/saldo/auditar-consumo-api.mjs
// Auditor del gasto de la API de Anthropic en los 4 proyectos (Costaviva,
// Pólizas.ai, Etxeapala, Lurnahi), que comparten la misma cuenta y el mismo
// saldo. Pedido explícito del usuario (2026-09-28): "debemos reducir los
// tokens usados al mínimo (20 €/semana) entre las 4 apps" y "un robot que
// supervise las 4 apps para optimizar el saldo sin perjudicar las
// funcionalidades".
//
// NO USA IA: lee el código de los 4 repos y aplica reglas fijas, así que
// supervisar el gasto no gasta saldo. Lo llama robot-mejores-practicas.yml,
// que después le pasa este informe a su sesión de Claude para que proponga
// los recortes concretos (esa parte sí gasta, una vez por semana).
//
// Las reglas salen de la auditoría real del 2026-09-28, cuando el saldo se
// agotó 6 veces en 13 días (ver TRAMPAS_COMPARTIDAS.md en polizas-ai):
//   R1  robot de CLI sin --max-turns: una sesión sin techo.
//   R2  robot de CLI sin --model: usa el modelo por defecto del CLI.
//   R3  robot que arranca en la raíz de un repo con un CLAUDE.md grande: el
//       CLI lo carga solo y lo reenvía en CADA turno.
//   R4  más de 7 sesiones por semana de un mismo robot.
//   R5  robot con WebSearch/WebFetch y más de 40 turnos.
//   R6  fichero de más de 100 KB metido en el prompt de una llamada de la app.
//   R7  código que llama a la API y nunca lee `usage`: el gasto no se mide.
//   R8  max_tokens de 16.000 o más en una llamada de la app.
// Ninguna regla dice "quita esto": son sitios donde mirar. Recortar
// funcionalidad es siempre decisión del usuario.
//
// Uso:
//   node auditar-consumo-api.mjs Costaviva=/ruta polizas-ai=/ruta ... > informe.md
// Variables opcionales:
//   ANTHROPIC_ADMIN_KEY      clave de administración (sk-ant-admin...) para
//                            leer el gasto REAL de los últimos 7 días.
//   PRESUPUESTO_SEMANAL_EUR  objetivo semanal (por defecto 20).
//   EUR_POR_USD              cambio para mostrar euros (por defecto 0,86).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const PRESUPUESTO_EUR = Number(process.env.PRESUPUESTO_SEMANAL_EUR || 20);
const EUR_POR_USD = Number(process.env.EUR_POR_USD || 0.86);
const KB = 1024;

// Estimación grosera, a propósito: solo sirve para ordenar por peso, no para
// facturar. Contexto base de una sesión del CLI (prompt de sistema +
// herramientas + prompt del robot) antes de leer nada.
const TOKENS_BASE_SESION = 20000;
const BYTES_POR_TOKEN = 3.6;
// Precio medio por millón de tokens de entrada en una sesión de agente con
// Sonnet 5: casi todo es lectura de caché (0,2 $/M) más escrituras (2,5 $/M)
// y algo de salida. 0,4 $/M da el orden de magnitud que se vio en real.
const USD_POR_MILLON_SESION = 0.4;

const repos = process.argv.slice(2).map((a) => {
  const [nombre, ruta] = a.split("=");
  return { nombre, ruta };
}).filter((r) => r.ruta && existsSync(r.ruta));

// ---------------------------------------------------------------- utilidades

function recorrer(dir, filtro, salida = []) {
  let entradas = [];
  try { entradas = readdirSync(dir); } catch { return salida; }
  for (const e of entradas) {
    if (e === "node_modules" || e === ".git" || e === ".wrangler") continue;
    const ruta = join(dir, e);
    let st;
    try { st = statSync(ruta); } catch { continue; }
    if (st.isDirectory()) recorrer(ruta, filtro, salida);
    else if (filtro(ruta)) salida.push(ruta);
  }
  return salida;
}

const tamano = (ruta) => { try { return statSync(ruta).size; } catch { return 0; } };
const kb = (bytes) => `${Math.round(bytes / KB)} KB`;

// Cuántas veces por semana se dispara una expresión cron de 5 campos.
function valoresCampo(campo, min, max) {
  const valores = new Set();
  for (const parte of campo.split(",")) {
    const [rango, pasoTxt] = parte.split("/");
    const paso = Number(pasoTxt || 1);
    let [ini, fin] = rango === "*" ? [min, max] : rango.split("-").map(Number);
    if (fin === undefined) fin = pasoTxt ? max : ini;
    for (let v = ini; v <= fin; v += paso) valores.add(v);
  }
  return valores.size;
}
function ejecucionesPorSemana(cron) {
  const [m, h, dom, mes, dow] = cron.trim().split(/\s+/);
  const porDia = valoresCampo(m, 0, 59) * valoresCampo(h, 0, 23);
  let dias;
  if (dow !== "*") dias = valoresCampo(dow, 0, 6);
  else if (dom !== "*") dias = (valoresCampo(dom, 1, 31) * 12) / 52;
  else dias = 7;
  if (mes !== "*") dias = (dias * valoresCampo(mes, 1, 12)) / 12;
  return porDia * dias;
}

// ------------------------------------------------------ 1) robots del CLI

function auditarRobots(repo) {
  const dirWf = join(repo.ruta, ".github", "workflows");
  if (!existsSync(dirWf)) return [];
  const claudeMd = tamano(join(repo.ruta, "CLAUDE.md"));
  const filas = [];
  for (const f of readdirSync(dirWf).filter((x) => /\.ya?ml$/.test(x))) {
    const texto = readFileSync(join(dirWf, f), "utf8");
    if (!/\bclaude\s+-p\b|anthropics\/claude-code-action/.test(texto)) continue;
    const crons = [...texto.matchAll(/cron:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    let porSemana = crons.reduce((n, c) => n + ejecucionesPorSemana(c), 0);
    // daily-report.yml de Costaviva declara dos crons (verano/invierno) y un
    // job "decidir_hora" descarta uno de los dos cada día.
    if (/decidir_hora/.test(texto) && crons.length === 2) porSemana /= 2;
    const soloManual = crons.length === 0;

    // Cada llamada al CLI dentro del workflow.
    const llamadas = [...texto.matchAll(/\bclaude\s+-p\b/g)].map((m) => m.index);
    for (const inicio of llamadas) {
      const bloque = texto.slice(inicio, inicio + 60000);
      const fin = bloque.search(/\n\s*-\s+name:|\n\s{0,6}[a-z_-]+:\s*\n/);
      const cola = bloque.slice(0, fin > 0 ? fin : undefined);
      const modelo = (cola.match(/--model\s+([\w.-]+)/) || [])[1] || null;
      const turnos = Number((cola.match(/--max-turns\s+(\d+)/) || [])[1]) || null;
      const herramientas = (cola.match(/--allowedTools\s+["']([^"']+)["']/) || [])[1] || "";
      const web = /WebSearch|WebFetch/.test(herramientas);
      // ¿Arranca fuera del repo? (patrón "cd /tmp/..." en las líneas previas
      // del mismo paso, usado para no cargar el CLAUDE.md del repo.)
      const previo = texto.slice(Math.max(0, inicio - 1500), inicio);
      const pasoPrevio = previo.slice(previo.lastIndexOf("- name:"));
      const fueraDelRepo = /\bcd\s+\/tmp\//.test(pasoPrevio);
      const bytesAuto = fueraDelRepo ? 0 : claudeMd;

      const turnosEst = turnos || 100;
      const tokensSesion = turnosEst * (TOKENS_BASE_SESION + bytesAuto / BYTES_POR_TOKEN);
      const usdSemana = soloManual ? 0 : (porSemana * tokensSesion * USD_POR_MILLON_SESION) / 1e6;

      const avisos = [];
      if (!turnos) avisos.push("R1 sin --max-turns");
      if (!modelo) avisos.push("R2 sin --model");
      if (bytesAuto > 40 * KB) avisos.push(`R3 carga CLAUDE.md de ${kb(bytesAuto)} en cada turno`);
      if (porSemana > 7) avisos.push(`R4 ${Math.round(porSemana)} sesiones/semana`);
      if (web && (turnos || 100) > 40) avisos.push("R5 web con más de 40 turnos");

      filas.push({
        app: repo.nombre, fichero: `.github/workflows/${f}`,
        porSemana: soloManual ? 0 : porSemana, soloManual, modelo, turnos, web,
        claudeMd: bytesAuto, usdSemana, avisos,
      });
    }
  }
  return filas;
}

// ------------------------------------------- 2) llamadas desde el código

function auditarCodigo(repo) {
  const ficheros = recorrer(repo.ruta, (r) => /\.(m?js|html)$/.test(r) && !/\/(test|scripts)\//.test(r));
  const filas = [];
  for (const ruta of ficheros) {
    const texto = readFileSync(ruta, "utf8");
    const llamaApi = /api\.anthropic\.com\/v1\/messages/.test(texto);
    const modelos = [...new Set([...texto.matchAll(/["'`](claude-[a-z0-9.-]+)["'`]/g)].map((m) => m[1]))];
    const usaAssets = /ASSETS\.fetch\(/.test(texto);
    if (!llamaApi && !modelos.length && !usaAssets) continue;
    // Tanto "max_tokens: 16000" como "maxTokens = 16000" (valor por defecto
    // de un helper) o una constante MAX_TOKENS_... = 32000.
    const maxTokens = [...texto.matchAll(/(?:max_tokens["']?|maxTokens|MAX_TOKENS\w*)\s*[:=]\s*(\d{3,6})/g)].map((m) => Number(m[1]));
    const mideUsage = /\.usage\b|\busage\s*[.:[]|input_tokens/.test(texto);
    // Ficheros del propio repo metidos en el prompt (patrón env.ASSETS.fetch
    // de Pólizas.ai).
    // Acepta tanto "/FICHERO.md" como "https://internal/FICHERO.md".
    const contexto = [...texto.matchAll(/ASSETS\.fetch\(\s*["'`](?:https?:\/\/[^/"'`]+)?\/?([\w.\-/]+\.(?:md|json|txt))["'`]/g)]
      .map((m) => ({ nombre: m[1], bytes: tamano(join(repo.ruta, m[1])) }))
      .filter((c) => c.bytes > 0);
    if (!llamaApi && !modelos.length && !contexto.length) continue;

    const avisos = [];
    for (const c of contexto) if (c.bytes > 100 * KB) avisos.push(`R6 mete ${c.nombre} (${kb(c.bytes)}) en el prompt`);
    if (llamaApi && !mideUsage) avisos.push("R7 no registra usage");
    const maximo = maxTokens.length ? Math.max(...maxTokens) : null;
    if (maximo && maximo >= 16000) avisos.push(`R8 max_tokens ${maximo}`);
    filas.push({ app: repo.nombre, fichero: relative(repo.ruta, ruta), llamaApi, modelos, maximo, contexto, avisos });
  }
  return filas;
}

// ------------------------------------------------ 3) gasto real (opcional)

async function gastoReal() {
  const clave = process.env.ANTHROPIC_ADMIN_KEY;
  if (!clave) return null;
  const ahora = new Date();
  const fin = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const inicio = new Date(fin.getTime() - 7 * 86400000);
  const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
  url.searchParams.set("starting_at", inicio.toISOString());
  url.searchParams.set("ending_at", fin.toISOString());
  url.searchParams.append("group_by[]", "workspace_id");
  try {
    const resp = await fetch(url, { headers: { "x-api-key": clave, "anthropic-version": "2023-06-01" } });
    const datos = await resp.json();
    if (!resp.ok) return { error: datos?.error?.message || `HTTP ${resp.status}` };
    // Importes en céntimos de dólar, como texto decimal.
    const porWorkspace = {};
    let totalCent = 0;
    for (const dia of datos.data || []) {
      for (const r of dia.results || []) {
        const cent = Number(r.amount || 0);
        totalCent += cent;
        const ws = r.workspace_id || "por defecto";
        porWorkspace[ws] = (porWorkspace[ws] || 0) + cent;
      }
    }
    return { totalUsd: totalCent / 100, porWorkspace, desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
  } catch (e) {
    return { error: e.message };
  }
}

// ------------------------------------------------------------- informe

const eur = (usd) => `${(usd * EUR_POR_USD).toFixed(usd * EUR_POR_USD < 10 ? 1 : 0)} €`;

const robots = repos.flatMap(auditarRobots).sort((a, b) => b.usdSemana - a.usdSemana);
const codigo = repos.flatMap(auditarCodigo).sort((a, b) => b.avisos.length - a.avisos.length);
const real = await gastoReal();

const l = [];
l.push(`# Saldo de API — auditoría automática (${new Date().toISOString().slice(0, 10)})`);
l.push("");
l.push(`Generado por \`scripts/saldo/auditar-consumo-api.mjs\` sin usar IA. Repos analizados: ${repos.map((r) => r.nombre).join(", ") || "ninguno"}. Objetivo: ${PRESUPUESTO_EUR} €/semana entre todas las apps.`);
l.push("");
l.push("## Gasto real (últimos 7 días)");
if (!real) {
  l.push("Sin medir: falta el secret `ANTHROPIC_ADMIN_KEY` (clave de administración `sk-ant-admin...` creada en la consola de Anthropic). Con ella este apartado da el gasto real y no solo la estimación de abajo.");
} else if (real.error) {
  l.push(`No se pudo leer el gasto real: ${real.error}`);
} else {
  const eurTotal = real.totalUsd * EUR_POR_USD;
  l.push(`**${real.totalUsd.toFixed(2)} $ (${eur(real.totalUsd)})** del ${real.desde} al ${real.hasta} — ${eurTotal <= PRESUPUESTO_EUR ? "✅ dentro" : "❌ por encima"} del objetivo de ${PRESUPUESTO_EUR} €.`);
  const ws = Object.entries(real.porWorkspace).sort((a, b) => b[1] - a[1]);
  if (ws.length > 1) for (const [w, c] of ws) l.push(`- ${w}: ${(c / 100).toFixed(2)} $`);
  else l.push("- Todo va a un único workspace: no se puede separar por app. Crear un workspace (y una API key) por app en la consola lo permitiría.");
}
l.push("");
l.push("## Robots de agente (CLI de Claude en GitHub Actions)");
l.push("Estimación de orden de magnitud: sesiones/semana × turnos × contexto por turno. Sirve para ordenar, no para facturar.");
l.push("");
l.push("| App | Workflow | Sesiones/sem | Modelo | Turnos máx | Web | CLAUDE.md cargado | Estimado/sem | Avisos |");
l.push("|---|---|---|---|---|---|---|---|---|");
for (const r of robots) {
  l.push(`| ${r.app} | \`${r.fichero}\` | ${r.soloManual ? "solo manual" : r.porSemana.toFixed(r.porSemana < 1 ? 2 : 0)} | ${r.modelo || "por defecto"} | ${r.turnos || "sin límite"} | ${r.web ? "sí" : "no"} | ${r.claudeMd ? kb(r.claudeMd) : "no"} | ${r.soloManual ? "—" : eur(r.usdSemana)} | ${r.avisos.join("; ") || "—"} |`);
}
const totalRobots = robots.reduce((n, r) => n + r.usdSemana, 0);
l.push("");
l.push(`**Total estimado de robots: ${eur(totalRobots)}/semana** (objetivo de todo: ${PRESUPUESTO_EUR} €).`);
l.push("");
l.push("## Llamadas a la API desde el código de las apps");
l.push("El gasto aquí depende del uso real (subidas, preguntas...), que este auditor no ve. Lo que sí ve son los patrones caros.");
l.push("");
l.push("| App | Fichero | Modelos | max_tokens máx | Contexto metido en el prompt | Avisos |");
l.push("|---|---|---|---|---|---|");
for (const c of codigo) {
  l.push(`| ${c.app} | \`${c.fichero}\` | ${c.modelos.join(", ") || "—"} | ${c.maximo ?? "—"} | ${c.contexto.map((x) => `${x.nombre} (${kb(x.bytes)})`).join(", ") || "—"} | ${c.avisos.join("; ") || "—"} |`);
}
l.push("");
l.push("## Fuera del alcance de este auditor");
l.push("- **Rutinas en la nube de Claude** (claude.ai → Routines): se pagan con el plan de Claude, no con el saldo de la API, y no viven en ningún repo.");
l.push("- **Frecuencia real de uso** de las funciones de las apps: solo se puede medir registrando `usage` (regla R7) o con `ANTHROPIC_ADMIN_KEY`.");

console.log(l.join("\n"));
