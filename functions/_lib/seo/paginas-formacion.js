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
    if (!fs.length) return `<li><div class="tema-vacio">${esc(nombre)} <span class="nota">· en preparación</span></div></li>`;
    // Desplegable (2026-11-20, Mikel: «como en cada línea va a haber muchos
    // campos, deben ser desplegables»): <details>, sin JavaScript.
    // Tarjeta grande que se toca para abrir (Mikel: «cada línea del menú
    // debe ser desplegable y, una vez abierto, ahí mostrar todos los nudos,
    // anzuelos o lo que sea»).
    return `<li><details class="tema bloque tarjeta"><summary><strong>${esc(nombre)}</strong> <span class="nota">(${fs.length})</span></summary><ul class="chips">${fs.map((f) => `<li><a href="/aprende/${esc(f.id)}">${esc(f.nombre)}</a></li>`).join("")}</ul></details></li>`;
  };
  const cuerpo = `${migasHtml(migas)}
<h1>Aprende a pescar</h1>
<p class="intro">Fichas cortas y prácticas para pescar mejor: qué es cada cosa, para qué sirve, con qué combina y cuándo no usarla. Cada ficha cita su fuente.</p>
${datos.capitulos.map((c) => `<section aria-labelledby="t-${esc(c.id)}"><h2 id="t-${esc(c.id)}"><span aria-hidden="true">${esc(c.emoji)}</span> ${esc(c.nombre)}</h2><ul class="temas-aprende">${c.temas.map(tema).join("")}</ul></section>`).join("\n")}
${cta()}
<p><a href="/especies">Especies →</a> · <a href="/spots">Spots →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("especies"), imagenAlt: "Aprende a pescar con Costaviva" }) };
}

// Fichas de materiales (sedales…): sin «paso a paso»; cada apartado es un
// desplegable (2026-11-20, Mikel: «recuerda que tienen que ser
// desplegables») y los usos van separados para costa y embarcación.
function paginaMaterial(datos, f) {
  const ruta = `/aprende/${f.id}`;
  const titulo = `${f.nombre}: ${f.colores?.length ? "características, colores" : "cómo es, grosor, largo"} y usos en costa y embarcación | Costaviva`;
  const descripcion = `${f.nombre}: ${f.para} ${f.resumen}`.slice(0, 300);
  const nombreTema = datos.temas[f.tema] || f.tema;
  const migas = [{ nombre: "Aprende", ruta: "/aprende" }, { nombre: f.nombre, ruta }];
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: f.nombre, description: f.resumen, inLanguage: "es", url: `${DOMINIO}${ruta}`, publisher: ORG_LD, author: ORG_LD },
    migasJsonLd(migas),
  ];
  const lista = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const bloque = (id, titulo, html) => `<details class="tema bloque tarjeta" id="${id}"><summary><strong>${titulo}</strong></summary>${html}</details>`;
  const hermanas = fichasDeTema(datos, f.tema).filter((x) => x.id !== f.id);
  const cuerpo = `${migasHtml(migas)}
<h1>${esc(f.nombre)}</h1>
${f.otros_nombres?.length ? `<p class="cientifico">También: ${f.otros_nombres.map(esc).join(" · ")}</p>` : ""}
<p class="intro"><strong>Qué es:</strong> ${esc(f.para)} ${esc(f.resumen)}</p>
${f.como_es?.length ? bloque("como-es", "Cómo es", lista(f.como_es)) : ""}
${f.colores?.length ? bloque("colores", "🎨 Colores", `<ul>${f.colores.map((c) => `<li><strong>${esc(c.color)}:</strong> ${esc(c.para)}</li>`).join("")}</ul>`) : ""}
${f.medidas?.length ? bloque("medidas", "📏 Grosor y largo", lista(f.medidas)) : ""}
${f.usos_costa?.length ? bloque("costa", "🪨 Desde costa", lista(f.usos_costa)) : ""}
${f.usos_embarcacion?.length ? bloque("embarcacion", "🚤 Desde embarcación", lista(f.usos_embarcacion)) : ""}
${f.ojo ? bloque("ojo", "⚠️ Ojo", `<p>${esc(f.ojo)}</p>`) : ""}
${bloque("fuentes", "Fuentes", `<ul>${f.fuentes.map((x) => `<li><a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">${esc(x.titulo)}</a></li>`).join("")}</ul><p class="nota">Consultadas el ${esc(f.consultada)}. Texto propio de Costaviva.</p>`)}
${hermanas.length ? `<section aria-labelledby="t-mas"><h2 id="t-mas">Más ${esc(nombreTema.split(":")[0].toLowerCase())}</h2><ul class="chips">${hermanas.map((x) => `<li><a href="/aprende/${esc(x.id)}">${esc(x.nombre)}</a></li>`).join("")}</ul></section>` : ""}
${cta()}
<p><a href="/aprende">Todo el centro de formación →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: f.nombre }) };
}

export function paginaFicha(datos, f) {
  if (f.tipo === "material") return paginaMaterial(datos, f);
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
      ...(f.imagen ? { image: `${DOMINIO}${f.imagen.src}` } : {}),
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
${f.imagen ? `<figure class="tarjeta"><img src="${esc(f.imagen.src)}" alt="${esc(f.imagen.alt)}" loading="lazy" style="width:100%;height:auto;border-radius:10px"><figcaption class="nota">${esc(f.imagen.alt)}. Imagen: ${esc(f.imagen.autor)}, ${f.imagen.licencia_url ? `<a href="${esc(f.imagen.licencia_url)}" rel="noopener nofollow" target="_blank">${esc(f.imagen.licencia)}</a>` : esc(f.imagen.licencia)}, vía <a href="${esc(f.imagen.fuente_url)}" rel="noopener nofollow" target="_blank">Wikimedia Commons</a>.</figcaption></figure>` : ""}
<details class="tema bloque tarjeta" id="pasos" open><summary><strong>Paso a paso</strong></summary>
<ol>${f.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
<p class="nota">Para verlo en movimiento: <a href="${esc(f.fuente.url)}" rel="noopener nofollow" target="_blank">animación en ${esc(f.fuente.titulo.split(":")[0])}</a>.</p></details>
${f.resistencia ? `<details class="tema bloque tarjeta" id="resistencia"><summary><strong>💪 Resistencia: ~${esc(f.resistencia.media_pct)} %</strong></summary><p>Aguanta en torno al ${esc(f.resistencia.media_pct)} % de la resistencia del sedal <span class="nota">(media de ${f.resistencia.fuentes.length === 1 ? "una prueba publicada" : `${f.resistencia.fuentes.length} pruebas publicadas`}: ${f.resistencia.fuentes.map((u, i) => `<a href="${esc(u)}" rel="noopener nofollow" target="_blank">${i + 1}</a>`).join(", ")}; depende mucho del estado del sedal y de cómo se ate)</span></p></details>` : ""}
${f.bien_con?.length ? `<details class="tema bloque tarjeta" id="bien-con"><summary><strong>🧵 Va bien con</strong></summary><p>${f.bien_con.map((s) => esc(NOMBRE_SEDAL[s] || s)).join(", ")}.</p></details>` : ""}
${f.ojo ? `<details class="tema bloque tarjeta" id="ojo"><summary><strong>⚠️ Ojo</strong></summary><p>${esc(f.ojo)}</p></details>` : ""}
<details class="tema bloque tarjeta" id="fuentes"><summary><strong>Fuente</strong></summary><p class="nota"><a href="${esc(f.fuente.url)}" rel="noopener nofollow" target="_blank">${esc(f.fuente.titulo)}</a> (consultada el ${esc(f.fuente.consultada)}). Texto propio de Costaviva.</p></details>
${hermanas.length ? `<section aria-labelledby="t-mas"><h2 id="t-mas">Más ${esc(nombreTema.toLowerCase())}</h2><ul class="chips">${hermanas.map((x) => `<li><a href="/aprende/${esc(x.id)}">${esc(x.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<p class="nota">Sirve para: ${capitulos.map((c) => `${esc(c.emoji)} ${esc(c.nombre.toLowerCase())}`).join(" · ")}</p>
${cta()}
<p><a href="/aprende">Todo el centro de formación →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: f.nombre }) };
}
