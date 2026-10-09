// test/i18n-html.js
// Lector mínimo de HTML para los tests de idiomas (test/i18n.test.js) y para
// marcar páginas: elementos con sus atributos y posiciones, y nodos de texto.
// No es un parser completo (no hace falta): las páginas de la app están bien
// cerradas. <script>, <style> y comentarios no cuentan como texto; lo que va
// dentro de <svg> tampoco.
import { readFileSync } from "node:fs";

const VACIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "param"]);
const CRUDOS = new Set(["script", "style", "textarea", "title"]);
const RE_ETIQUETA = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
const RE_CIERRE = /<\/([a-zA-Z][\w-]*)\s*>/y;
const RE_ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", copy: "©", laquo: "«", raquo: "»", euro: "€", deg: "°", rarr: "→", larr: "←", times: "×" };
export function desescapar(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()] ?? todo;
  });
}
export const limpio = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function leerAtributos(raw) {
  const attrs = {};
  for (const m of raw.matchAll(RE_ATRIBUTO)) attrs[m[1].toLowerCase()] = desescapar(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

export function analizarHtml(src) {
  const elementos = [];
  const textos = [];
  const raizEl = { tag: "#raiz", attrs: {}, ini: 0, finAbre: 0, cierreIni: src.length, hijos: [], padre: null };
  const pila = [raizEl];
  let i = 0;
  let inicioTexto = 0;
  const cerrarTexto = (hasta) => {
    if (hasta > inicioTexto) {
      const padre = pila[pila.length - 1];
      const nodo = { tipo: "texto", ini: inicioTexto, fin: hasta, raw: src.slice(inicioTexto, hasta), padre };
      textos.push(nodo);
      padre.hijos.push(nodo);
    }
  };
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (src.startsWith("<!--", lt)) {
      cerrarTexto(lt);
      const fin = src.indexOf("-->", lt + 4);
      i = inicioTexto = fin < 0 ? src.length : fin + 3;
      continue;
    }
    if (src.startsWith("<!", lt)) {
      cerrarTexto(lt);
      const fin = src.indexOf(">", lt);
      i = inicioTexto = fin + 1;
      continue;
    }
    RE_CIERRE.lastIndex = lt;
    let m = RE_CIERRE.exec(src);
    if (m) {
      cerrarTexto(lt);
      const tag = m[1].toLowerCase();
      const k = pila.map((e) => e.tag).lastIndexOf(tag);
      if (k > 0) {
        while (pila.length > k) {
          const e = pila.pop();
          e.cierreIni = lt;
          e.cierreFin = lt + m[0].length;
        }
      }
      i = inicioTexto = lt + m[0].length;
      continue;
    }
    RE_ETIQUETA.lastIndex = lt;
    m = RE_ETIQUETA.exec(src);
    if (!m) { i = lt + 1; continue; }
    cerrarTexto(lt);
    const tag = m[1].toLowerCase();
    const padre = pila[pila.length - 1];
    const el = { tipo: "elemento", tag, attrs: leerAtributos(m[2]), raw: m[0], ini: lt, finAbre: lt + m[0].length, padre, hijos: [] };
    elementos.push(el);
    padre.hijos.push(el);
    i = inicioTexto = el.finAbre;
    if (CRUDOS.has(tag)) {
      const re = new RegExp(`</${tag}\\s*>`, "ig");
      re.lastIndex = i;
      const c = re.exec(src);
      const fin = c ? c.index : src.length;
      if (tag === "title" || tag === "textarea") {
        const nodo = { tipo: "texto", ini: i, fin, raw: src.slice(i, fin), padre: el };
        textos.push(nodo);
        el.hijos.push(nodo);
      } else {
        el.crudo = true;
      }
      el.cierreIni = fin;
      el.cierreFin = c ? fin + c[0].length : fin;
      i = inicioTexto = el.cierreFin;
      continue;
    }
    if (VACIOS.has(tag) || m[3] === "/") {
      el.cierreIni = el.cierreFin = el.finAbre;
      continue;
    }
    pila.push(el);
  }
  cerrarTexto(src.length);
  return { src, elementos, textos };
}

export function htmlInterior(src, el) {
  return src.slice(el.finAbre, el.cierreIni);
}

export function ancestros(nodo) {
  const r = [];
  for (let p = nodo.padre; p; p = p.padre) r.push(p);
  return r;
}

// ¿Lo cubre un data-i18n / data-i18n-html suyo o de un antepasado?
export function cubierto(nodo) {
  return ancestros(nodo).some((e) => e.attrs && (e.attrs["data-i18n"] !== undefined || e.attrs["data-i18n-html"] !== undefined));
}

// Dentro de <svg>, <script>, <style>, <noscript>: no es texto de interfaz.
export function ignorado(nodo) {
  return ancestros(nodo).some((e) => ["svg", "script", "style", "noscript", "template"].includes(e.tag));
}

export const ATRIBUTOS_TRADUCIBLES = ["title", "aria-label", "placeholder", "alt"];
export const tieneLetras = (s) => /[A-Za-zÀ-ÿ]/.test(s);

// Textos y atributos con letras que nadie traduce: [{ tipo, texto, el }].
export function sinTraducir(src) {
  const { elementos, textos } = analizarHtml(src);
  const r = [];
  const cuerpo = elementos.find((e) => e.tag === "body");
  const enCuerpo = (n) => cuerpo && n.ini >= cuerpo.ini && n.ini < (cuerpo.cierreIni ?? src.length);
  for (const n of textos) {
    if (ignorado(n) || cubierto(n)) continue;
    if (!(enCuerpo(n) || n.padre?.tag === "title")) continue;
    const texto = limpio(desescapar(n.raw));
    if (tieneLetras(texto)) r.push({ tipo: "texto", texto, nodo: n });
  }
  for (const el of elementos) {
    if (!enCuerpo(el) || ignorado(el)) continue;
    for (const a of ATRIBUTOS_TRADUCIBLES) {
      const v = el.attrs[a];
      if (v === undefined || !tieneLetras(v) || el.attrs[`data-i18n-${a}`] !== undefined) continue;
      r.push({ tipo: a, texto: limpio(v), el });
    }
  }
  return r;
}

// Lee el objeto JSON de assets/i18n/<idioma>.js (entre "{" y "}" sueltas).
export function leerDiccionario(ruta) {
  const lineas = readFileSync(ruta, "utf8").split("\n");
  const a = lineas.indexOf("{");
  const b = lineas.lastIndexOf("}");
  return JSON.parse(lineas.slice(a, b + 1).join("\n"));
}

// La fuente "tal como se lee en español": I18n.t("clave"...) con el texto de
// es.js en lugar de la clave, sin los atributos data-i18n* y sin los <span
// data-i18n> que solo envuelven un texto. Para los tests que buscan textos o
// marcado concretos en index.html (y demás páginas) escritos antes de los
// idiomas: siguen comprobando lo mismo que ve el usuario en español.
let _es = null;
export function fuenteEs(src) {
  _es ||= leerDiccionario(new URL("../assets/i18n/es.js", import.meta.url));
  return String(src)
    .replace(/\$\{I18n\.t\("([\w.]+)"\)\}/g, (todo, k) => (typeof _es[k] === "string" ? _es[k] : todo))
    .replace(/I18n\.t\("([\w.]+)"/g, (todo, k) => (typeof _es[k] === "string" ? `I18n.t(${JSON.stringify(_es[k])}` : todo))
    .replace(/<span data-i18n="[\w.]+">([^<]*)<\/span>/g, "$1")
    .replace(/ data-i18n(?:-[a-z-]+)?="[\w.]+"/g, "");
}
