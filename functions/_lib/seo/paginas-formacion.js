// functions/_lib/seo/paginas-formacion.js — centro de formación (/aprende).
//
// 2026-11-20, Mikel: «una pestaña de información… nudos, tipos de sedal,
// anzuelos, cañas, plomos, quitavueltas, perlas, topes, corchos, señuelos…
// lo mismo para embarcación y submarinismo». Datos en
// assets/datos/formacion.json: tres capítulos (costa, embarcación,
// submarina) que comparten temas, y fichas con fuente. Solo se publica lo
// escrito; el resto del índice sale como «en preparación», sin enlace.
//
// En tres idiomas (2026-11-20, Mikel: «todo lo que hagamos debe estar en
// todos los idiomas»): /aprende, /en/aprende y /pt/aprende, con los datos
// traducidos en formacion.en.json y formacion.pt.json (mismos id) y los
// textos de la página en TEXTOS.
import { DOMINIO, esc, documento, migasHtml, migasJsonLd, cta, ctaPt, imagenOg } from "./base.js";
import { ctaEn } from "./paginas-en.js";
import { rutaIdioma } from "./idiomas.js";

const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
export const IDIOMAS_FORMACION = ["es", "en", "pt"];

const TEXTOS = {
  es: {
    aprende: "Aprende",
    h1: "Aprende a pescar",
    tituloIndice: "Aprende a pescar: nudos, sedales, anzuelos y montajes | Costaviva",
    descIndice: "Centro de formación de pesca: nudos paso a paso (palomar, clinch, uni, FG…), sedales, anzuelos y montajes para costa, embarcación y pesca submarina.",
    intro: "Fichas cortas y prácticas para pescar mejor: qué es cada cosa, para qué sirve, con qué combina y cuándo no usarla. Cada ficha cita su fuente.",
    enPreparacion: "en preparación",
    pieIndice: '<a href="/especies">Especies →</a> · <a href="/spots">Spots →</a>',
    imagenAltIndice: "Aprende a pescar con Costaviva",
    tambien: "También",
    queEs: "Qué es",
    paraQue: "Para qué",
    comoEs: "Cómo es",
    colores: "🎨 Colores",
    pasarse: "🎯 El tamaño justo: no te pases",
    porEspecie: "🐟 Qué tamaño para cada pez",
    colPez: "Pez", colAnzuelo: "Anzuelo", colPesca: "Pesca", colTamano: "Tamaño",
    orientativo: "Orientativo: cada marca numera a su manera.",
    orientativoAnzuelo: " Empieza por aquí y ajusta con el cebo.",
    medidas: "📏 Grosor y largo",
    costa: "🪨 Desde costa",
    embarcacion: "🚤 Desde embarcación",
    ojo: "⚠️ Ojo",
    fuentes: "Fuentes",
    fuente: "Fuente",
    consultadas: (f) => `Consultadas el ${f}. Texto propio de Costaviva.`,
    consultada: (f) => `consultada el ${f}`,
    textoPropio: "Texto propio de Costaviva.",
    mas: (t) => `Más ${t}`,
    todo: "Todo el centro de formación →",
    pasos: "Paso a paso",
    animacion: (sitio) => `Para verlo en movimiento: <a href="URL" rel="noopener nofollow" target="_blank">animación en ${sitio}</a>.`,
    resistencia: (p) => `💪 Resistencia: ~${p} %`,
    resistenciaTxt: (p, n, enlaces) => `Aguanta en torno al ${p} % de la resistencia del sedal <span class="nota">(media de ${n === 1 ? "una prueba publicada" : `${n} pruebas publicadas`}: ${enlaces}; depende mucho del estado del sedal y de cómo se ate)</span>`,
    bienCon: "🧵 Va bien con",
    sedal: { nylon: "nylon", fluorocarbono: "fluorocarbono", trenzado: "trenzado" },
    imagen: "Imagen", via: "vía",
    sirvePara: "Sirve para",
    tituloNudo: (n) => `${n}: cómo se hace paso a paso y para qué sirve | Costaviva`,
    tituloMaterial: (f) => `${f.nombre}: ${f.colores?.length ? "características, colores" : f.tema === "anzuelos" ? "cómo es, tamaños" : f.tema === "bajos" ? "cómo es, grosor, largo" : "tipos, cuál usar"} y usos en costa y embarcación | Costaviva`,
    cta: () => cta(),
  },
  en: {
    aprende: "Learn",
    h1: "Learn to fish",
    tituloIndice: "Learn to fish: knots, lines, hooks and rigs | Costaviva",
    descIndice: "Fishing know-how: step-by-step knots (palomar, clinch, uni, FG…), lines, leaders, hooks, lures, rods and reels for shore and boat fishing.",
    intro: "Short, practical guides to fish better: what each thing is, what it is for, what it works with and when not to use it. Every guide cites its sources.",
    enPreparacion: "coming soon",
    pieIndice: '<a href="/en/species">Species →</a> · <a href="/en/spots">Spots →</a>',
    imagenAltIndice: "Learn to fish with Costaviva",
    tambien: "Also",
    queEs: "What it is",
    paraQue: "What for",
    comoEs: "What it is like",
    colores: "🎨 Colours",
    pasarse: "🎯 The right size: don't go too big",
    porEspecie: "🐟 Which size for each fish",
    colPez: "Fish", colAnzuelo: "Hook", colPesca: "Fishing", colTamano: "Size",
    orientativo: "A guide only: every brand numbers its own way.",
    orientativoAnzuelo: " Start here and adjust to the bait.",
    medidas: "📏 Thickness and length",
    costa: "🪨 From the shore",
    embarcacion: "🚤 From a boat",
    ojo: "⚠️ Watch out",
    fuentes: "Sources",
    fuente: "Source",
    consultadas: (f) => `Checked on ${f}. Original text by Costaviva.`,
    consultada: (f) => `checked on ${f}`,
    textoPropio: "Original text by Costaviva.",
    mas: (t) => `More: ${t}`,
    todo: "All the guides →",
    pasos: "Step by step",
    animacion: (sitio) => `To see it in motion: <a href="URL" rel="noopener nofollow" target="_blank">animation on ${sitio}</a>.`,
    resistencia: (p) => `💪 Strength: ~${p}%`,
    resistenciaTxt: (p, n, enlaces) => `Holds about ${p}% of the line's strength <span class="nota">(average of ${n === 1 ? "one published test" : `${n} published tests`}: ${enlaces}; it depends a lot on the state of the line and how it is tied)</span>`,
    bienCon: "🧵 Works with",
    sedal: { nylon: "nylon", fluorocarbono: "fluorocarbon", trenzado: "braid" },
    imagen: "Image", via: "via",
    sirvePara: "Useful for",
    tituloNudo: (n) => `${n}: how to tie it step by step and what it is for | Costaviva`,
    tituloMaterial: (f) => `${f.nombre}: ${f.colores?.length ? "features, colours" : f.tema === "anzuelos" ? "types, sizes" : f.tema === "bajos" ? "types, thickness, length" : "types, which to use"} and uses from shore and boat | Costaviva`,
    cta: () => ctaEn(),
  },
  pt: {
    aprende: "Aprender",
    h1: "Aprender a pescar",
    tituloIndice: "Aprender a pescar: nós, linhas, anzóis e montagens | Costaviva",
    descIndice: "Formação de pesca: nós passo a passo (palomar, clinch, uni, FG…), linhas, baixadas, anzóis, amostras, canas e carretos para pesca de costa e embarcada.",
    intro: "Fichas curtas e práticas para pescar melhor: o que é cada coisa, para que serve, com que combina e quando não a usar. Cada ficha cita as suas fontes.",
    enPreparacion: "em preparação",
    pieIndice: '<a href="/pt/especies">Espécies →</a> · <a href="/pt/spots/region/portugal">Pesqueiros →</a>',
    imagenAltIndice: "Aprender a pescar com a Costaviva",
    tambien: "Também",
    queEs: "O que é",
    paraQue: "Para que serve",
    comoEs: "Como é",
    colores: "🎨 Cores",
    pasarse: "🎯 O tamanho certo: não exagere",
    porEspecie: "🐟 Que tamanho para cada peixe",
    colPez: "Peixe", colAnzuelo: "Anzol", colPesca: "Pesca", colTamano: "Tamanho",
    orientativo: "Orientativo: cada marca numera à sua maneira.",
    orientativoAnzuelo: " Comece por aqui e ajuste ao isco.",
    medidas: "📏 Espessura e comprimento",
    costa: "🪨 De costa",
    embarcacion: "🚤 De embarcação",
    ojo: "⚠️ Atenção",
    fuentes: "Fontes",
    fuente: "Fonte",
    consultadas: (f) => `Consultadas em ${f}. Texto original da Costaviva.`,
    consultada: (f) => `consultada em ${f}`,
    textoPropio: "Texto original da Costaviva.",
    mas: (t) => `Mais: ${t}`,
    todo: "Toda a formação →",
    pasos: "Passo a passo",
    animacion: (sitio) => `Para ver em movimento: <a href="URL" rel="noopener nofollow" target="_blank">animação em ${sitio}</a>.`,
    resistencia: (p) => `💪 Resistência: ~${p} %`,
    resistenciaTxt: (p, n, enlaces) => `Aguenta cerca de ${p} % da resistência da linha <span class="nota">(média de ${n === 1 ? "um teste publicado" : `${n} testes publicados`}: ${enlaces}; depende muito do estado da linha e de como se ata)</span>`,
    bienCon: "🧵 Combina com",
    sedal: { nylon: "nylon", fluorocarbono: "fluorocarbono", trenzado: "multifilamento" },
    imagen: "Imagem", via: "via",
    sirvePara: "Serve para",
    tituloNudo: (n) => `${n}: como se faz passo a passo e para que serve | Costaviva`,
    tituloMaterial: (f) => `${f.nombre}: ${f.colores?.length ? "características, cores" : f.tema === "anzuelos" ? "tipos, tamanhos" : f.tema === "bajos" ? "tipos, espessura, comprimento" : "tipos, qual usar"} e usos de costa e embarcação | Costaviva`,
    cta: () => ctaPt(),
  },
};

const T = (idioma) => TEXTOS[idioma] || TEXTOS.es;
// Ruta pública de una página de formación en un idioma: "/aprende/x",
// "/en/aprende/x", "/pt/aprende/x".
const enlace = (ruta, idioma) => rutaIdioma(ruta, idioma);
const opciones = (idioma) => ({ idioma, alternos: IDIOMAS_FORMACION });

// Una ficha puede salir en más de un tema (p. ej. las partes de la caña, en
// costa y en barco) con `tambien_en`.
const fichasDeTema = (datos, tema) => datos.fichas.filter((f) => f.tema === tema || f.tambien_en?.includes(tema));

export function paginaIndiceFormacion(datos, idioma = "es") {
  const t = T(idioma);
  const ruta = "/aprende";
  const titulo = t.tituloIndice;
  const migas = [{ nombre: t.aprende, ruta: enlace(ruta, idioma) }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${enlace(ruta, idioma)}`, inLanguage: idioma, publisher: ORG_LD }, migasJsonLd(migas)];
  const tema = (id) => {
    const fs = fichasDeTema(datos, id);
    const nombre = datos.temas[id] || id;
    if (!fs.length) return `<li><div class="tema-vacio">${esc(nombre)} <span class="nota">· ${esc(t.enPreparacion)}</span></div></li>`;
    // Desplegable (2026-11-20, Mikel: «como en cada línea va a haber muchos
    // campos, deben ser desplegables»): <details>, sin JavaScript.
    // Tarjeta grande que se toca para abrir (Mikel: «cada línea del menú
    // debe ser desplegable y, una vez abierto, ahí mostrar todos los nudos,
    // anzuelos o lo que sea»).
    return `<li><details class="tema bloque tarjeta"><summary><strong>${esc(nombre)}</strong> <span class="nota">(${fs.length})</span></summary><ul class="chips">${fs.map((f) => `<li><a href="${esc(enlace(`/aprende/${f.id}`, idioma))}">${esc(f.nombre)}</a></li>`).join("")}</ul></details></li>`;
  };
  const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(t.h1)}</h1>
<p class="intro">${esc(t.intro)}</p>
${datos.capitulos.map((c) => `<section aria-labelledby="t-${esc(c.id)}"><h2 id="t-${esc(c.id)}"><span aria-hidden="true">${esc(c.emoji)}</span> ${esc(c.nombre)}</h2><ul class="temas-aprende">${c.temas.map(tema).join("")}</ul></section>`).join("\n")}
${t.cta()}
<p>${t.pieIndice}</p>`;
  return { titulo, html: documento({ titulo, descripcion: t.descIndice, ruta, cuerpo, ld, imagen: imagenOg("especies"), imagenAlt: t.imagenAltIndice, ...opciones(idioma) }) };
}

// Fichas de materiales (sedales…): sin «paso a paso»; cada apartado es un
// desplegable (2026-11-20, Mikel: «recuerda que tienen que ser
// desplegables») y los usos van separados para costa y embarcación.
function paginaMaterial(datos, f, idioma) {
  const t = T(idioma);
  const ruta = `/aprende/${f.id}`;
  const titulo = t.tituloMaterial(f);
  const descripcion = `${f.nombre}: ${f.para} ${f.resumen}`.slice(0, 300);
  const nombreTema = datos.temas[f.tema] || f.tema;
  const migas = [{ nombre: t.aprende, ruta: enlace("/aprende", idioma) }, { nombre: f.nombre, ruta: enlace(ruta, idioma) }];
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: f.nombre, description: f.resumen, inLanguage: idioma, url: `${DOMINIO}${enlace(ruta, idioma)}`, publisher: ORG_LD, author: ORG_LD },
    migasJsonLd(migas),
  ];
  const lista = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const bloque = (id, titulo, html) => `<details class="tema bloque tarjeta" id="${id}"><summary><strong>${titulo}</strong></summary>${html}</details>`;
  const hermanas = fichasDeTema(datos, f.tema).filter((x) => x.id !== f.id);
  const anzuelos = f.tema === "anzuelos";
  const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(f.nombre)}</h1>
${f.otros_nombres?.length ? `<p class="cientifico">${esc(t.tambien)}: ${f.otros_nombres.map(esc).join(" · ")}</p>` : ""}
<p class="intro"><strong>${esc(t.queEs)}:</strong> ${esc(f.para)} ${esc(f.resumen)}</p>
${f.como_es?.length ? bloque("como-es", esc(t.comoEs), lista(f.como_es)) : ""}
${f.colores?.length ? bloque("colores", esc(t.colores), `<ul>${f.colores.map((c) => `<li><strong>${esc(c.color)}:</strong> ${esc(c.para)}</li>`).join("")}</ul>`) : ""}
${f.pasarse?.length ? bloque("pasarse", esc(t.pasarse), f.pasarse.map((x) => `<p>${esc(x)}</p>`).join("")) : ""}
${f.por_especie?.length ? bloque("por-especie", esc(f.por_especie_titulo || t.porEspecie), `<table class="tabla-especies"><thead><tr><th>${esc(anzuelos ? t.colPez : t.colPesca)}</th><th>${esc(anzuelos ? t.colAnzuelo : t.colTamano)}</th></tr></thead><tbody>${f.por_especie.map((e) => `<tr><td>${esc(e.pez)}</td><td><strong>${esc(e.tam)}</strong>${e.nota ? `<br><span class="nota">${esc(e.nota)}</span>` : ""}</td></tr>`).join("")}</tbody></table><p class="nota">${esc(t.orientativo)}${anzuelos ? esc(t.orientativoAnzuelo) : ""}</p>`) : ""}
${f.medidas?.length ? bloque("medidas", esc(f.medidas_titulo || t.medidas), lista(f.medidas)) : ""}
${f.usos_costa?.length ? bloque("costa", esc(t.costa), lista(f.usos_costa)) : ""}
${f.usos_embarcacion?.length ? bloque("embarcacion", esc(t.embarcacion), lista(f.usos_embarcacion)) : ""}
${f.ojo ? bloque("ojo", esc(t.ojo), `<p>${esc(f.ojo)}</p>`) : ""}
${bloque("fuentes", esc(t.fuentes), `<ul>${f.fuentes.map((x) => `<li><a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">${esc(x.titulo)}</a></li>`).join("")}</ul><p class="nota">${esc(t.consultadas(f.consultada))}</p>`)}
${hermanas.length ? `<section aria-labelledby="t-mas"><h2 id="t-mas">${esc(t.mas(nombreTema.split(":")[0].toLowerCase()))}</h2><ul class="chips">${hermanas.map((x) => `<li><a href="${esc(enlace(`/aprende/${x.id}`, idioma))}">${esc(x.nombre)}</a></li>`).join("")}</ul></section>` : ""}
${t.cta()}
<p><a href="${esc(enlace("/aprende", idioma))}">${esc(t.todo)}</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: f.nombre, ...opciones(idioma) }) };
}

export function paginaFicha(datos, f, idioma = "es") {
  if (f.tipo === "material") return paginaMaterial(datos, f, idioma);
  const t = T(idioma);
  const ruta = `/aprende/${f.id}`;
  const capitulos = datos.capitulos.filter((c) => c.temas.includes(f.tema));
  const titulo = t.tituloNudo(f.nombre);
  const descripcion = `${f.nombre}: ${f.para} ${f.resumen}`.slice(0, 300);
  const nombreTema = datos.temas[f.tema] || f.tema;
  const migas = [{ nombre: t.aprende, ruta: enlace("/aprende", idioma) }, { nombre: f.nombre, ruta: enlace(ruta, idioma) }];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: f.nombre,
      description: f.resumen,
      inLanguage: idioma,
      ...(f.imagen ? { image: `${DOMINIO}${f.imagen.src}` } : {}),
      step: f.pasos.map((p, i) => ({ "@type": "HowToStep", position: i + 1, text: p })),
      publisher: ORG_LD,
    },
    migasJsonLd(migas),
  ];
  const hermanas = fichasDeTema(datos, f.tema).filter((x) => x.id !== f.id);
  const enlaces = f.resistencia ? f.resistencia.fuentes.map((u, i) => `<a href="${esc(u)}" rel="noopener nofollow" target="_blank">${i + 1}</a>`).join(", ") : "";
  const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(f.nombre)}</h1>
${f.otros_nombres?.length ? `<p class="cientifico">${esc(t.tambien)}: ${f.otros_nombres.map(esc).join(" · ")}</p>` : ""}
<p class="intro"><strong>${esc(t.paraQue)}:</strong> ${esc(f.para)} ${esc(f.resumen)}</p>
${f.imagen ? `<figure class="tarjeta"><img src="${esc(f.imagen.src)}" alt="${esc(f.imagen.alt)}" loading="lazy" style="width:100%;height:auto;border-radius:10px"><figcaption class="nota">${esc(f.imagen.alt)}. ${esc(t.imagen)}: ${esc(f.imagen.autor)}, ${f.imagen.licencia_url ? `<a href="${esc(f.imagen.licencia_url)}" rel="noopener nofollow" target="_blank">${esc(f.imagen.licencia)}</a>` : esc(f.imagen.licencia)}, ${esc(t.via)} <a href="${esc(f.imagen.fuente_url)}" rel="noopener nofollow" target="_blank">Wikimedia Commons</a>.</figcaption></figure>` : ""}
<details class="tema bloque tarjeta" id="pasos" open><summary><strong>${esc(t.pasos)}</strong></summary>
<ol>${f.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
<p class="nota">${t.animacion(esc(f.fuente.titulo.split(":")[0])).replace("URL", esc(f.fuente.url))}</p></details>
${f.resistencia ? `<details class="tema bloque tarjeta" id="resistencia"><summary><strong>${esc(t.resistencia(f.resistencia.media_pct))}</strong></summary><p>${t.resistenciaTxt(esc(f.resistencia.media_pct), f.resistencia.fuentes.length, enlaces)}</p></details>` : ""}
${f.bien_con?.length ? `<details class="tema bloque tarjeta" id="bien-con"><summary><strong>${esc(t.bienCon)}</strong></summary><p>${f.bien_con.map((s) => esc(t.sedal[s] || s)).join(", ")}.</p></details>` : ""}
${f.ojo ? `<details class="tema bloque tarjeta" id="ojo"><summary><strong>${esc(t.ojo)}</strong></summary><p>${esc(f.ojo)}</p></details>` : ""}
<details class="tema bloque tarjeta" id="fuentes"><summary><strong>${esc(t.fuente)}</strong></summary><p class="nota"><a href="${esc(f.fuente.url)}" rel="noopener nofollow" target="_blank">${esc(f.fuente.titulo)}</a> (${esc(t.consultada(f.fuente.consultada))}). ${esc(t.textoPropio)}</p></details>
${hermanas.length ? `<section aria-labelledby="t-mas"><h2 id="t-mas">${esc(t.mas(nombreTema.toLowerCase()))}</h2><ul class="chips">${hermanas.map((x) => `<li><a href="${esc(enlace(`/aprende/${x.id}`, idioma))}">${esc(x.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<p class="nota">${esc(t.sirvePara)}: ${capitulos.map((c) => `${esc(c.emoji)} ${esc(c.nombre.toLowerCase())}`).join(" · ")}</p>
${t.cta()}
<p><a href="${esc(enlace("/aprende", idioma))}">${esc(t.todo)}</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: f.nombre, ...opciones(idioma) }) };
}
