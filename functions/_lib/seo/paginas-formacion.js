// functions/_lib/seo/paginas-formacion.js — centro de formación (/aprende).
//
// 2026-11-20, Mikel: «una pestaña de información… nudos, tipos de sedal,
// anzuelos, cañas, plomos, quitavueltas, perlas, topes, corchos, señuelos…
// lo mismo para embarcación y submarinismo». Datos en
// assets/datos/formacion.json: tres capítulos (costa, embarcación,
// submarina) que comparten temas, y fichas con fuente. Solo se publica lo
// escrito; el resto del índice sale como «en preparación», sin enlace.
import { DOMINIO, esc, documento, migasHtml, migasJsonLd, cta, imagenOg } from "./base.js";

const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
const NOMBRE_SEDAL = { nylon: "nylon", fluorocarbono: "fluorocarbono", trenzado: "trenzado" };

const fichasDeTema = (datos, tema) => datos.fichas.filter((f) => f.tema === tema);

export function paginaIndiceFormacion(datos) {
  const ruta = "/aprende";
  const titulo = "Aprende a pescar: nudos, sedales, anzuelos y montajes | Costaviva";
  const descripcion = "Centro de formación de pesca: nudos paso a paso (palomar, clinch, uni, FG…), sedales, anzuelos y montajes para costa, embarcación y pesca submarina.";
  const migas = [{ nombre: "Aprende", ruta }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${ruta}`, inLanguage: "es", publisher: ORG_LD }, migasJsonLd(migas)];
  const tema = (id) => {
    const fs = fichasDeTema(datos, id);
    const nombre = datos.temas[id] || id;
    if (!fs.length) return `<li><span class="nota">${esc(nombre)} · en preparación</span></li>`;
    return `<li><strong>${esc(nombre)}</strong><ul class="chips">${fs.map((f) => `<li><a href="/aprende/${esc(f.id)}">${esc(f.nombre)}</a></li>`).join("")}</ul></li>`;
  };
  const cuerpo = `${migasHtml(migas)}
<h1>Aprende a pescar</h1>
<p class="intro">Fichas cortas y prácticas para pescar mejor: qué es cada cosa, para qué sirve, con qué combina y cuándo no usarla. Cada ficha cita su fuente.</p>
${datos.capitulos.map((c) => `<section aria-labelledby="t-${esc(c.id)}"><h2 id="t-${esc(c.id)}"><span aria-hidden="true">${esc(c.emoji)}</span> ${esc(c.nombre)}</h2><ul class="modos">${c.temas.map(tema).join("")}</ul></section>`).join("\n")}
${cta()}
<p><a href="/especies">Especies →</a> · <a href="/spots">Spots →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("especies"), imagenAlt: "Aprende a pescar con Costaviva" }) };
}

export function paginaFicha(datos, f) {
  const ruta = `/aprende/${f.id}`;
  const capitulos = datos.capitulos.filter((c) => c.temas.includes(f.tema));
  const titulo = `${f.nombre}: cómo se hace paso a paso y para qué sirve | Costaviva`;
  const descripcion = `${f.nombre}: ${f.para} ${f.resumen}`.slice(0, 300);
  const nombreTema = datos.temas[f.tema] || f.tema;
  const migas = [{ nombre: "Aprende", ruta: "/aprende" }, { nombre: f.nombre, ruta }];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: f.nombre,
      description: f.resumen,
      inLanguage: "es",
      step: f.pasos.map((p, i) => ({ "@type": "HowToStep", position: i + 1, text: p })),
      publisher: ORG_LD,
    },
    migasJsonLd(migas),
  ];
  const hermanas = fichasDeTema(datos, f.tema).filter((x) => x.id !== f.id);
  const cuerpo = `${migasHtml(migas)}
<h1>${esc(f.nombre)}</h1>
${f.otros_nombres?.length ? `<p class="cientifico">También: ${f.otros_nombres.map(esc).join(" · ")}</p>` : ""}
<p class="intro"><strong>Para qué:</strong> ${esc(f.para)} ${esc(f.resumen)}</p>
<section class="tarjeta" aria-labelledby="t-pasos"><h2 id="t-pasos">Paso a paso</h2>
<ol>${f.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
<p class="nota">Para verlo en movimiento: <a href="${esc(f.fuente.url)}" rel="noopener nofollow" target="_blank">animación en ${esc(f.fuente.titulo.split(":")[0])}</a>.</p></section>
${f.bien_con?.length ? `<p><strong>Va bien con:</strong> ${f.bien_con.map((s) => esc(NOMBRE_SEDAL[s] || s)).join(", ")}.</p>` : ""}
${f.ojo ? `<section class="tarjeta aviso" aria-labelledby="t-ojo"><h2 id="t-ojo">Ojo</h2><p>${esc(f.ojo)}</p></section>` : ""}
<p class="nota">Fuente: <a href="${esc(f.fuente.url)}" rel="noopener nofollow" target="_blank">${esc(f.fuente.titulo)}</a> (consultada el ${esc(f.fuente.consultada)}). Texto propio de Costaviva.</p>
${hermanas.length ? `<section aria-labelledby="t-mas"><h2 id="t-mas">Más ${esc(nombreTema.toLowerCase())}</h2><ul class="chips">${hermanas.map((x) => `<li><a href="/aprende/${esc(x.id)}">${esc(x.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<p class="nota">Sirve para: ${capitulos.map((c) => `${esc(c.emoji)} ${esc(c.nombre.toLowerCase())}`).join(" · ")}</p>
${cta()}
<p><a href="/aprende">Todo el centro de formación →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: f.nombre }) };
}
