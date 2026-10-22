// scripts/lonjas/galicia.mjs
// Primera venta en las lonjas de Galicia (2026-10-22, aprobado por Mikel):
// para poder etiquetar después las zonas calientes de la flota (AIS) como
// "probablemente <especie>" según lo que se vende en el puerto más cercano.
// Sin IA y sin dependencias. Lo lanza .github/workflows/lonjas-galicia.yml.
//
// Fuente: "Principais indicadores de vendas nas lonxas" de la Xunta de
// Galicia, https://www.pescadegalicia.gal/informe-notasventa/agregation
// (kg, € y €/kg por día, lonja, grupo biológico y especie). Aviso legal
// (https://www.pescadegalicia.gal/gl/aviso-legal): reutilización comercial y
// no comercial permitida si no se desnaturalizan los datos y se cita la
// fuente. Por eso se guardan tal cual vienen (nombres de lonja y especie sin
// tocar, números solo pasados de "8.224,20" a 8224.2) y la cita va en el
// registro, en la migración y en los créditos: CITA más abajo.
//
// Cómo se pide: GET de la página (cookie de sesión + token _csrf) y POST JSON
// a la misma URL con la cabecera X-CSRF-TOKEN, un filtro de fecha y las
// columnas de agrupación. Devuelve HTML (la tabla); se lee con expresiones
// regulares. Vigo a veces no ha subido D-1 a la hora de la pasada, así que
// cada día se vuelven a bajar D-1, D-2 y D-3 y se hace upsert.
//
// Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/lonjas/galicia.mjs [--dias 3]
//      node scripts/lonjas/galicia.mjs --probar      (solo baja y suma; no escribe)
// Solo totales en el registro (el repo es público). Lo puro se prueba en
// test/lonjas-galicia.test.js.

export const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
export const URL_FUENTE = "https://www.pescadegalicia.gal/informe-notasventa/agregation";
export const CITA = "Fonte: Xunta de Galicia – pescadegalicia.gal";
export const REGION = "galicia";
export const TAM_PAGINA = 1000;
const UA = "CostavivaLonjasBot/1.0 (+https://costaviva.org)";

const AGRUPABLES = ["ejercicio", "mes", "fecha", "diaSemana", "provincia", "zonaAdministrativa", "lonjaAgrupacionView", "grupoBiologico", "especie"];
const AGRUPADAS = new Set(["fecha", "lonjaAgrupacionView", "grupoBiologico", "especie"]);
const INDICADORES = ["cantidadsum", "importesum", "precioMedioany"];

// "8.224,20" -> 8224.2 ; "" o basura -> null
export function numeroGal(texto) {
  const t = String(texto ?? "").trim().replace(/\s/g, "");
  if (!/^-?[\d.]*\d(,\d+)?$/.test(t)) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// "21/10/2026" -> "2026-10-21"
export function fechaISO(texto) {
  const m = String(texto ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// "2026-10-21" -> "21/10/2026"
export const fechaGal = (iso) => iso.split("-").reverse().join("/");

// Los N días anteriores a `hoy` (Date), del más reciente al más antiguo.
// La fecha de hoy va en hora de Madrid a propósito: las lonjas de Galicia
// fechan sus ventas en hora peninsular (a las 10:17 UTC coincide igual).
export function diasAnteriores(hoy, n = 3) {
  const base = new Date(`${hoy.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" })}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(base.getTime() - (i + 1) * 864e5).toISOString().slice(0, 10));
}

export function cuerpoPeticion(desdeISO, hastaISO, pagina = 1, tam = TAM_PAGINA) {
  const col = (c, agregada) => ({ codigo: c, path: c, agregated: agregada, updated: false, selected: false });
  const desde = fechaGal(desdeISO), hasta = fechaGal(hastaISO);
  return {
    totalRegistros: "1", paginaActual: pagina, tamanhoPagina: tam, ordenacionList: [],
    columnasAgregateGroups: AGRUPABLES.map((c) => col(c, AGRUPADAS.has(c))),
    columnasAgregateIndexes: INDICADORES.map((c) => col(c, true)),
    headerOrder: [], mailData: {},
    listaFiltros: [{ tipo: "TYPE_FECHA", codigo: "fecha", path: "fecha", isDatetime: false, isTimeOnly: false, valorDesde: desde, valorHasta: hasta, texto: `${desde} - ${hasta}` }],
  };
}

export function csrfDe(html) {
  const m = String(html).match(/name="_csrf"\s+content="([^"]+)"/);
  return m ? m[1] : null;
}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const textoLimpio = (s) => s
  .replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "")
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (e, c) => c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : Number(c.slice(1))) : (ENTIDADES[c.toLowerCase()] ?? e))
  .replace(/\s+/g, " ").trim();

// Celdas <td ... data-codigo="X" ...>: valor (data-item-value) y texto.
function celdas(trozo) {
  const out = {};
  for (const m of trozo.matchAll(/<td\b([^>]*\bdata-codigo="(\w+)"[^>]*)>([\s\S]*?)<\/td>/g)) {
    const valor = m[1].match(/\bdata-item-value="([^"]*)"/);
    out[m[2]] = { valor: valor ? valor[1] : null, texto: textoLimpio(m[3]) };
  }
  return out;
}

const bloque = (html, etiqueta) => {
  const m = String(html).match(new RegExp(`<${etiqueta}\\b[^>]*>([\\s\\S]*?)</${etiqueta}>`));
  return m ? m[1] : "";
};

// Filas de la tabla de agregación -> objetos de lonja_ventas.
export function leerFilas(html) {
  const filas = [];
  for (const tr of bloque(html, "tbody").split(/<tr\b[^>]*>/).slice(1)) {
    const c = celdas(tr);
    if (!c.fecha || !c.lonjaAgrupacionView || !c.especie) continue;
    const fecha = fechaISO(c.fecha.valor ?? c.fecha.texto);
    const lonja = c.lonjaAgrupacionView.texto, especie = c.especie.texto;
    if (!fecha || !lonja || !especie) continue;
    filas.push({
      fecha, region: REGION, lonja, especie,
      kg: numeroGal(c.cantidadsum?.valor),
      importe: numeroGal(c.importesum?.valor),
      precio_medio: numeroGal(c.precioMedioany?.valor),
      grupo: c.grupoBiologico?.texto || null,
    });
  }
  return filas;
}

// Fila "Totais" del pie de la tabla (para cuadrar lo leído).
export function leerTotales(html) {
  const c = celdas(bloque(html, "tfoot"));
  return { kg: numeroGal(c.cantidadsum?.valor), importe: numeroGal(c.importesum?.valor) };
}

// El pie "Totais" es el total de TODA la consulta (no de la página): lo
// leído tiene que sumar lo mismo, o el parseo se ha comido algo.
export function cuadra(filas, pie) {
  if (pie?.kg == null) return true;
  const kg = filas.reduce((a, f) => a + (f.kg ?? 0), 0);
  return Math.abs(kg - pie.kg) <= Math.max(1, pie.kg * 1e-6);
}

export function totalElementos(html) {
  const m = String(html).match(/id="total-elements"[^>]*value="(\d+)"/);
  return m ? Number(m[1]) : null;
}

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Una sola fila por clave primaria (dos filas iguales en un upsert harían
// fallar a Postgres). Si la fuente repitiera clave, se suman kg e importe.
export function unificar(filas) {
  const porClave = new Map();
  for (const f of filas) {
    const k = [f.fecha, f.region, f.lonja, f.especie].join("|");
    const previa = porClave.get(k);
    if (!previa) { porClave.set(k, { ...f }); continue; }
    previa.kg = redondear((previa.kg ?? 0) + (f.kg ?? 0));
    previa.importe = redondear((previa.importe ?? 0) + (f.importe ?? 0));
    previa.precio_medio = previa.kg ? redondear(previa.importe / previa.kg) : null;
    previa.grupo ||= f.grupo;
  }
  return [...porClave.values()];
}

// Totales para el registro: nada de detalle (lo pide el repo público).
export function resumen(filas) {
  return {
    filas: filas.length,
    lonjas: new Set(filas.map((f) => f.lonja)).size,
    especies: new Set(filas.map((f) => f.especie)).size,
    kg: redondear(filas.reduce((a, f) => a + (f.kg ?? 0), 0), 0),
    importe: redondear(filas.reduce((a, f) => a + (f.importe ?? 0), 0), 0),
  };
}

// Lonjas leídas que no están en lonjas-galicia.json (sin coordenadas).
export function lonjasSinCoordenadas(filas, catalogo) {
  const conocidas = new Set(catalogo.lonjas.map((l) => l.nombre));
  return [...new Set(filas.map((f) => f.lonja))].filter((n) => !conocidas.has(n)).sort();
}

// ---------- red ----------

async function sesion() {
  const r = await fetch(URL_FUENTE, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`pescadegalicia GET ${r.status}`);
  const html = await r.text();
  const token = csrfDe(html);
  if (!token) throw new Error("pescadegalicia: no aparece el token _csrf en la página.");
  const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  return { token, cookie };
}

async function pedirPagina(s, dia, pagina) {
  const r = await fetch(URL_FUENTE, {
    method: "POST",
    headers: { "content-type": "application/json", "X-CSRF-TOKEN": s.token, cookie: s.cookie, "user-agent": UA },
    body: JSON.stringify(cuerpoPeticion(dia, dia, pagina)),
  });
  if (!r.ok) throw new Error(`pescadegalicia POST ${r.status} (${dia}, página ${pagina})`);
  return r.text();
}

export async function bajarDia(s, dia) {
  const filas = [];
  let total = null, pie = null;
  for (let pagina = 1; pagina <= 20; pagina++) {
    const html = await pedirPagina(s, dia, pagina);
    total ??= totalElementos(html) ?? 0;
    pie ??= leerTotales(html);
    const nuevas = leerFilas(html);
    filas.push(...nuevas);
    if (!nuevas.length || filas.length >= total) break;
  }
  if (total && filas.length !== total) throw new Error(`${dia}: la fuente dice ${total} filas y se han leído ${filas.length}.`);
  if (filas.some((f) => f.fecha !== dia)) throw new Error(`${dia}: han llegado filas de otro día.`);
  if (!cuadra(filas, pie)) throw new Error(`${dia}: los kg leídos no cuadran con la fila "Totais" de la fuente.`);
  return filas;
}

async function supabase(ruta, opciones = {}) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, "content-type": "application/json", ...(opciones.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} ${ruta.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function main() {
  const probar = process.argv.includes("--probar");
  const i = process.argv.indexOf("--dias");
  const n = i > -1 ? Number(process.argv[i + 1]) : 3;
  if (!(n >= 1 && n <= 31)) throw new Error("--dias tiene que ir de 1 a 31.");
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!probar && !clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  const { readFileSync } = await import("node:fs");
  const catalogo = JSON.parse(readFileSync(new URL("./lonjas-galicia.json", import.meta.url), "utf8"));

  const s = await sesion();
  const todas = [];
  for (const dia of diasAnteriores(new Date(), n)) {
    const filas = unificar(await bajarDia(s, dia));
    const r = resumen(filas);
    console.log(`${dia}: ${r.filas} filas, ${r.lonjas} lonjas, ${r.especies} especies, ${r.kg} kg, ${r.importe} €.`);
    todas.push(...filas);
  }
  const t = resumen(todas);
  const sin = lonjasSinCoordenadas(todas, catalogo);
  console.log(`Total ${n} días: ${t.filas} filas, ${t.lonjas} lonjas, ${t.kg} kg. Lonjas sin coordenadas en lonjas-galicia.json: ${sin.length}.`);
  console.log(CITA);
  if (sin.length) console.log(`::warning::${sin.length} lonja(s) nuevas sin coordenadas: añadirlas a scripts/lonjas/lonjas-galicia.json.`);
  if (!t.filas) throw new Error(`pescadegalicia no ha devuelto ninguna venta en ${n} días: ¿ha cambiado la página?`);
  if (probar) { console.log("Modo probar: no se escribe nada en Supabase."); return; }

  for (let k = 0; k < todas.length; k += 500) {
    await supabase("lonja_ventas?on_conflict=fecha,region,lonja,especie", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(todas.slice(k, k + 500)),
    });
  }
  console.log(`Guardadas ${todas.length} filas en lonja_ventas (upsert).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
