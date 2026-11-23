// functions/_lib/seo/faq-region.js — preguntas frecuentes de las páginas de
// región (/mareas/region/<r> y /spots/region/<r>, en es/en/pt).
//
// 2026-11-23, Mikel: «añade preguntas frecuentes a las páginas de región».
// Search Console: el pico de impresiones del 14/11 vino de las páginas de
// región (mareas de Cantabria 1 → 10, País Vasco 1 → 5, Mediterráneo 1 → 5),
// y salen búsquedas como «mareas en el mediterraneo» (pos. 4), «pleamar y
// bajamar» (pos. 5) o «mareas santander» (pos. 20).
//
// Regla de fiabilidad («no publiques probables»): aquí no hay texto
// inventado. Cada respuesta sale de los mismos datos que la tabla de la
// página (próxima pleamar y bajamar de cada spot, y especies de temporada de
// especies.json, con fuente cada una), así que siempre coincide con lo que
// se ve. La diferencia entre pleamar y bajamar no depende del cero de
// referencia de las alturas. Puro: recibe datos, devuelve [{ pregunta,
// respuesta }].

import { TITULOS_REGION } from "../../mareas/_regiones.js";
import { esc } from "./base.js";

const TEXTOS = {
  es: {
    manana: "mañana a las ", a: "a las ",
    pleamarQ: (l) => `¿A qué hora es la pleamar hoy ${l}?`,
    pleamarA: (lista) => `Próxima pleamar: ${lista}. Cada spot tiene su hora: en la tabla de esta página están todos.`,
    bajamarQ: (l) => `¿A qué hora es la bajamar hoy ${l}?`,
    bajamarA: (lista) => `Próxima bajamar: ${lista}. Cada spot tiene su hora: en la tabla de esta página están todos.`,
    carreraQ: (l) => `¿Cuánto sube y baja la marea ${l}?`,
    carreraUno: (x, s) => `En la marea de ahora, entre la pleamar y la bajamar hay ${x} m de diferencia ${s}.`,
    carreraVarios: (a, sa, b, sb) => `En la marea de ahora, entre la pleamar y la bajamar hay de ${a} m (${sa}) a ${b} m (${sb}) de diferencia, según el spot.`,
    pequena: " Hay marea, pero pequeña: menos de medio metro.",
    temporadaQ: (l, mes) => `¿Qué se pesca ${l} en ${mes}?`,
    temporadaA: (mes, n, lista, mas) => `En ${mes} están de temporada ${n} especies: ${lista}${mas}. En esta página están todas, con los meses de cada una.`,
    mas: (n) => ` y ${n} más`,
    titulo: "Preguntas frecuentes",
    y: " y ",
  },
  en: {
    manana: "tomorrow at ", a: "at ",
    pleamarQ: (l) => `What time is high tide today ${l}?`,
    pleamarA: (lista) => `Next high tide: ${lista}. Each spot has its own time: they are all in the table on this page.`,
    bajamarQ: (l) => `What time is low tide today ${l}?`,
    bajamarA: (lista) => `Next low tide: ${lista}. Each spot has its own time: they are all in the table on this page.`,
    carreraQ: (l) => `How big is the tidal range ${l}?`,
    carreraUno: (x, s) => `In the current tide, the difference between high and low water is ${x} m ${s}.`,
    carreraVarios: (a, sa, b, sb) => `In the current tide, the difference between high and low water ranges from ${a} m (${sa}) to ${b} m (${sb}), depending on the spot.`,
    pequena: " There is a tide, but a small one: under half a metre.",
    temporadaQ: (l, mes) => `What can you catch ${l} in ${mes}?`,
    temporadaA: (mes, n, lista, mas) => `In ${mes}, ${n} species are in season: ${lista}${mas}. They are all on this page, with the months for each one.`,
    mas: (n) => ` and ${n} more`,
    titulo: "Frequently asked questions",
    y: " and ",
  },
  pt: {
    manana: "amanhã às ", a: "às ",
    pleamarQ: (l) => `A que horas é a preia-mar hoje ${l}?`,
    pleamarA: (lista) => `Próxima preia-mar: ${lista}. Cada pesqueiro tem a sua hora: estão todos na tabela desta página.`,
    bajamarQ: (l) => `A que horas é a baixa-mar hoje ${l}?`,
    bajamarA: (lista) => `Próxima baixa-mar: ${lista}. Cada pesqueiro tem a sua hora: estão todos na tabela desta página.`,
    carreraQ: (l) => `Quanto sobe e desce a maré ${l}?`,
    carreraUno: (x, s) => `Na maré de agora, entre a preia-mar e a baixa-mar há ${x} m de diferença ${s}.`,
    carreraVarios: (a, sa, b, sb) => `Na maré de agora, entre a preia-mar e a baixa-mar há de ${a} m (${sa}) a ${b} m (${sb}) de diferença, conforme o pesqueiro.`,
    pequena: " Há maré, mas pequena: menos de meio metro.",
    temporadaQ: (l, mes) => `O que se pesca ${l} em ${mes}?`,
    temporadaA: (mes, n, lista, mas) => `Em ${mes} estão na época ${n} espécies: ${lista}${mas}. Estão todas nesta página, com os meses de cada uma.`,
    mas: (n) => ` e mais ${n}`,
    titulo: "Perguntas frequentes",
    y: " e ",
  },
};

const T = (idioma) => TEXTOS[idioma] || TEXTOS.es;

// «en Cantabria», «in the Basque Country», «na Galiza»: en portugués la
// preposición va contraída con el artículo de cada región.
const EM_PT = { "pais-vasco": "no", cantabria: "na", asturias: "nas", galicia: "na", portugal: "em", mediterraneo: "no", "golfo-de-cadiz": "no", canarias: "nas" };
export function enLugar(idioma, regionSlug, lugar) {
  if (idioma === "en") return `in ${lugar}`;
  if (idioma === "pt") return `${EM_PT[regionSlug] || "em"} ${lugar}`;
  return `en ${lugar}`;
}

function numero(x, idioma) {
  const s = (Math.round(Number(x) * 10) / 10).toFixed(1);
  return idioma === "en" ? s : s.replace(".", ",");
}

const evento = (s, tipo) => (s.marea?.proximas || []).find((e) => e.tipo === tipo && Number.isFinite(Number(e.altura)) && e.hora);

// Hasta 3 spots: primero los pueblos del título de la región (los más
// buscados), luego el resto en el orden de la tabla.
function representativos(spots, regionSlug, nombreDe) {
  const pueblos = String(TITULOS_REGION[regionSlug]?.pueblos || "").toLowerCase();
  const primero = spots.filter((s) => pueblos && pueblos.includes(nombreDe(s).toLowerCase()));
  const resto = spots.filter((s) => !primero.includes(s));
  return [...primero, ...resto].slice(0, 3);
}

function listaTexto(partes, t) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")}${t.y}${partes[partes.length - 1]}`;
}

// Mareas de la región: próxima pleamar, próxima bajamar y diferencia entre
// las dos (de la misma tabla de la página).
export function preguntasMareasRegion({ spots, regionSlug, lugar, idioma = "es", nombreDe = (s) => s.nombre }) {
  const t = T(idioma);
  const validos = (spots || []).filter((s) => !s.error);
  const out = [];
  for (const [tipo, q, a] of [["pleamar", t.pleamarQ, t.pleamarA], ["bajamar", t.bajamarQ, t.bajamarA]]) {
    const con = validos.filter((s) => evento(s, tipo));
    if (!con.length) continue;
    const partes = representativos(con, regionSlug, nombreDe).map((s) => {
      const e = evento(s, tipo);
      return `${nombreDe(s)} ${e.manana ? t.manana : t.a}${e.hora} (${numero(e.altura, idioma)} m)`;
    });
    out.push({ pregunta: q(enLugar(idioma, regionSlug, lugar)), respuesta: a(listaTexto(partes, t)) });
  }
  const carreras = validos
    .map((s) => {
      const p = evento(s, "pleamar"), b = evento(s, "bajamar");
      return p && b ? { s, m: Math.abs(Number(p.altura) - Number(b.altura)) } : null;
    })
    // Menos de 5 cm no es una marea que se pueda dar por buena (curva casi
    // plana, p. ej. Guardamar el 2026-11-23 daba 0,0 m): no se cita.
    .filter((x) => x && x.m >= 0.05)
    .sort((x, y) => x.m - y.m);
  if (carreras.length) {
    const min = carreras[0], max = carreras[carreras.length - 1];
    const nMin = numero(min.m, idioma), nMax = numero(max.m, idioma);
    let r = carreras.length === 1 || nMin === nMax
      ? t.carreraUno(nMax, carreras.length === 1 ? enLugar(idioma, null, nombreDe(max.s)) : enLugar(idioma, regionSlug, lugar))
      : t.carreraVarios(nMin, nombreDe(min.s), nMax, nombreDe(max.s));
    if (max.m < 0.5) r += t.pequena;
    out.push({ pregunta: t.carreraQ(enLugar(idioma, regionSlug, lugar)), respuesta: r });
  }
  return out;
}

// Pesca en la región: qué está de temporada este mes (especies.json, cada
// especie con su fuente en su ficha).
export function preguntasSpotsRegion({ deTemporada, regionSlug, lugar, mes, idioma = "es" }) {
  const t = T(idioma);
  const lista = (deTemporada || []).map((e) => e.nombre).filter(Boolean);
  if (!lista.length) return [];
  // Sin pasar a minúsculas: «Pez de San Pedro», «European sea bass».
  const primeras = lista.slice(0, 8);
  const mas = lista.length > 8 ? t.mas(lista.length - 8) : "";
  return [{ pregunta: t.temporadaQ(enLugar(idioma, regionSlug, lugar), mes), respuesta: t.temporadaA(mes, lista.length, primeras.join(", "), mas) }];
}

export function faqLd(preguntas, idioma = "es") {
  if (!preguntas.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: idioma,
    mainEntity: preguntas.map((q) => ({ "@type": "Question", name: q.pregunta, acceptedAnswer: { "@type": "Answer", text: q.respuesta } })),
  };
}

export function faqHtml(preguntas, idioma = "es") {
  if (!preguntas.length) return "";
  return `<section class="tarjeta" aria-labelledby="t-preg"><h2 id="t-preg">${esc(T(idioma).titulo)}</h2>
${preguntas.map((q) => `<h3>${esc(q.pregunta)}</h3><p>${esc(q.respuesta)}</p>`).join("\n")}
</section>`;
}

// Cómo se dice la región en la pregunta (el título de la región en español
// ya lo tiene: «el Mediterráneo», «Euskadi»...).
export function lugarRegionEs(region, tipo = "mareas") {
  const t = TITULOS_REGION[region.slug];
  return (tipo === "spots" ? t?.lugarPesca : t?.lugar) || region.nombre;
}
